import type {
  DocumentReference,
  FileReference,
  RepoOverview,
  ResponseMetadata,
  ValidationHint
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import type {
  FileCatalogScanPort,
  SnapshotPort,
  WarmupCoordinatorPort
} from "../../ports/index.js";
import { getCatalogRepoStatus } from "./get-repo-status.js";

export type GetRepoOverviewResult = {
  overview: RepoOverview;
  meta: ResponseMetadata;
};

export async function getRepoOverview(input: {
  repo_root: string;
  scanner: FileCatalogScanPort;
  snapshots?: SnapshotPort;
  warmups?: WarmupCoordinatorPort;
}): Promise<GetRepoOverviewResult> {
  const [scanned, snapshot, warmup] = await Promise.all([
    input.scanner.scan({
      repo_root: input.repo_root,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 2000
    }),
    input.snapshots?.getSnapshot({ repo_root: input.repo_root }) ?? Promise.resolve(undefined),
    input.warmups?.getState({ repo_root: input.repo_root }) ?? Promise.resolve(undefined)
  ]);
  const languages = uniqueSorted(scanned.files.map((file) => file.file_identity.language));
  const status = getCatalogRepoStatus({
    repo_root: scanned.repo_root,
    indexed_roots: scanned.indexed_roots,
    skipped_roots: scanned.skipped_roots,
    files: scanned.files,
    freshness: snapshot?.freshness ?? "unknown",
    snapshot: snapshot ?? undefined,
    warmup: warmup ?? undefined
  });

  return {
    overview: {
      repo_root: scanned.repo_root,
      summary: `Repository has ${scanned.files.length} indexed file(s) across ${languages.length} language/category value(s).`,
      languages,
      platforms: detectPlatforms(scanned.files),
      key_files: selectKeyFiles(scanned.files),
      key_docs: selectKeyDocs(scanned.files),
      validation_hints: inferValidationHints(scanned.files),
      recommended_first_calls: [
        { tool: "read_resource", args: { uri: "repo:///status" } },
        { tool: "read_resource", args: { uri: "repo:///scope" } },
        { tool: "context_for_task", args: { task: "Describe the planned change before editing." } },
        { tool: "verification_plan", args: { files: [] } }
      ]
    },
    meta: {
      ...status.meta,
      truncated: scanned.truncated,
      budget: {
        row_limit: 2000
      }
    }
  };
}

function selectKeyFiles(files: readonly FileCatalogEntry[]): FileReference[] {
  return files
    .filter((file) => isKeyFile(file.path))
    .sort((left, right) => keyFileRank(right) - keyFileRank(left) || left.path.localeCompare(right.path))
    .slice(0, 20)
    .map((file) => ({
      path: file.path,
      language: file.file_identity.language,
      exists: true,
      capability_level: file.adapter_evidence?.capability_level ?? "unsupported",
      evidence_kinds: file.adapter_evidence?.evidence_kinds ?? [],
      reason: "Recognized repository configuration, source, test, or infrastructure file."
    }));
}

function selectKeyDocs(files: readonly FileCatalogEntry[]): DocumentReference[] {
  return files
    .filter((file) => file.file_identity.language === "markdown")
    .filter((file) => isOverviewDocCandidate(file.path))
    .sort((left, right) => docRank(right.path) - docRank(left.path) || left.path.localeCompare(right.path))
    .slice(0, 10)
    .map((file) => ({
      path: file.path,
      title: titleFromPath(file.path),
      reason: reasonForDoc(file.path),
      evidence_kinds: ["docs"]
    }));
}

function isOverviewDocCandidate(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower === "readme.md" || lower === "agents.md" || lower.startsWith("docs/");
}

function docRank(filePath: string): number {
  const lower = filePath.toLowerCase();
  let score = 0;
  if (lower === "agents.md") score += 220;
  if (lower === "readme.md") score += 210;
  if (lower.startsWith("docs/guides/")) score += 90;
  if (lower.includes("architecture") || lower.includes("design")) score += 70;
  if (lower.includes("runbook") || lower.includes("operations") || lower.includes("developer")) score += 60;
  if (lower.startsWith("docs/reference/")) score += 50;
  if (lower.includes("template")) score -= 80;
  if (lower.includes("/archive/") || lower.startsWith("docs/archive/")) score -= 70;
  if (lower.includes("/updates/") || lower.startsWith("docs/updates/")) score -= 60;
  if (lower.includes("project-management") || lower.includes("/plans/")) score -= 40;
  return score;
}

function reasonForDoc(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower === "readme.md") return "Repository entry document.";
  if (lower === "agents.md") return "Agent guidance document.";
  if (lower.startsWith("docs/guides/")) return "Durable guide document.";
  if (lower.includes("architecture") || lower.includes("design")) return "Durable architecture or design document.";
  if (lower.startsWith("docs/reference/")) return "Durable reference document.";
  return "Repository documentation file.";
}

function inferValidationHints(files: readonly FileCatalogEntry[]): ValidationHint[] {
  const paths = new Set(files.map((file) => file.path));
  const hints: ValidationHint[] = [];
  const hasCmake = hasCMakeEvidence(paths);
  const hasCpp = files.some((file) => file.file_identity.language === "c" || file.file_identity.language === "cpp");
  const hasGo = paths.has("go.mod") || paths.has("go.work");
  const hasPackage = paths.has("package.json");

  if (hasCmake && hasCpp) {
    hints.push({
      command: "manual_review cmake-build-test",
      reason: "CMakeLists.txt and C/C++ files indicate CMake build/test validation should drive this repository area.",
      status: "needed"
    });
  }
  if (hasGo) {
    hints.push({
      command: "verification_plan",
      reason: "go.mod/go.work indicates Go validation is available; repo guidance may constrain whether host or container commands are allowed.",
      status: "needed"
    });
  }
  if (hasDevcontainerEvidence(paths)) {
    hints.push({
      command: "manual_review devcontainer-validation-environment",
      reason: ".devcontainer configuration indicates containerized development environment evidence; it is not proof of Docker-only validation by itself.",
      status: "needed"
    });
  }
  if (hasPackage && !(hasCmake && hasCpp) && !hasGo) {
    hints.push({ command: "pnpm typecheck", reason: "package.json indicates TypeScript/JavaScript validation.", status: "needed" });
    hints.push({ command: "pnpm test", reason: "package.json indicates JavaScript/TypeScript tests may be available.", status: "needed" });
  }
  if (paths.has("pyproject.toml")) {
    hints.push({ command: "python3 -m pytest", reason: "pyproject.toml indicates Python tests may be available.", status: "needed" });
  }
  return hints;
}

function detectPlatforms(files: readonly FileCatalogEntry[]): string[] {
  const paths = new Set(files.map((file) => file.path));
  const platforms = new Set<string>();
  if (paths.has("package.json")) platforms.add("node");
  if (paths.has("pyproject.toml")) platforms.add("python");
  if (paths.has("go.mod") || paths.has("go.work")) platforms.add("go");
  if (hasCMakeEvidence(paths)) platforms.add("cmake");
  if (hasDockerEvidence(paths)) platforms.add("docker");
  if (hasDevcontainerEvidence(paths)) platforms.add("devcontainer");
  if ([...paths].some((file) => file.startsWith(".github/workflows/"))) platforms.add("github_actions");
  return [...platforms].sort();
}

function isKeyFile(filePath: string): boolean {
  return (
    filePath === "package.json" ||
    filePath === "pyproject.toml" ||
    filePath === "go.mod" ||
    filePath === "go.work" ||
    pathBasename(filePath).toLowerCase() === "cmakelists.txt" ||
    filePath === "Dockerfile" ||
    filePath.startsWith(".devcontainer/") ||
    filePath.startsWith(".github/workflows/") ||
    filePath.startsWith("src/") ||
    filePath.startsWith("tests/")
  );
}

function keyFileRank(file: FileCatalogEntry): number {
  const lower = file.path.toLowerCase();
  if (lower === "cmakelists.txt") return 130;
  if (lower.endsWith("/cmakelists.txt")) return 125;
  let score = 0;
  if (lower === "go.mod" || lower === "go.work") score += 120;
  if (lower === "pyproject.toml" || lower === "package.json") score += 100;
  if (lower === "dockerfile" || lower.startsWith(".devcontainer/")) score += 80;
  if (/^(src|lib|app|cmd|internal|include)\//u.test(lower)) score += 70;
  if (/^(test|tests)\//u.test(lower)) score += 55;
  if (lower.startsWith(".github/workflows/")) score += 20;
  if (file.file_identity.language === "cpp" || file.file_identity.language === "c" || file.file_identity.language === "go") score += 8;
  if (file.file_identity.language === "python") score += 6;
  if (lower.includes("/generated/") || lower.includes("/fixtures/")) score -= 60;
  return score;
}

function hasCMakeEvidence(paths: Set<string>): boolean {
  return [...paths].some((file) => pathBasename(file).toLowerCase() === "cmakelists.txt");
}

function hasDockerEvidence(paths: Set<string>): boolean {
  return [...paths].some((file) => {
    const lower = file.toLowerCase();
    return lower.endsWith("dockerfile") || lower.includes("docker-compose") || lower.endsWith(".devcontainer/dockerfile");
  });
}

function hasDevcontainerEvidence(paths: Set<string>): boolean {
  return [...paths].some((file) => file.startsWith(".devcontainer/"));
}

function pathBasename(filePath: string): string {
  return filePath.slice(filePath.lastIndexOf("/") + 1);
}

function titleFromPath(filePath: string): string {
  const basename = filePath.slice(filePath.lastIndexOf("/") + 1).replace(/\.[^.]+$/, "");
  return basename
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}
