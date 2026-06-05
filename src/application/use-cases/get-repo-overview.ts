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
  if (paths.has("package.json")) {
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
  if ([...paths].some((file) => file.toLowerCase().endsWith("dockerfile") || file === "Dockerfile")) platforms.add("docker");
  if ([...paths].some((file) => file.startsWith(".github/workflows/"))) platforms.add("github_actions");
  return [...platforms].sort();
}

function isKeyFile(filePath: string): boolean {
  return (
    filePath === "package.json" ||
    filePath === "pyproject.toml" ||
    filePath === "Dockerfile" ||
    filePath.startsWith(".github/workflows/") ||
    filePath.startsWith("src/") ||
    filePath.startsWith("tests/")
  );
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
