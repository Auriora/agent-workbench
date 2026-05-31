import type {
  DocumentReference,
  FileReference,
  RepoOverview,
  ResponseMetadata,
  ValidationHint
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import type { FileCatalogScanPort } from "../../ports/index.js";
import { getCatalogRepoStatus } from "./get-repo-status.js";

export type GetRepoOverviewResult = {
  overview: RepoOverview;
  meta: ResponseMetadata;
};

export async function getRepoOverview(input: {
  repo_root: string;
  scanner: FileCatalogScanPort;
}): Promise<GetRepoOverviewResult> {
  const scanned = await input.scanner.scan({
    repo_root: input.repo_root,
    indexed_roots: ["."],
    skipped_roots: [],
    max_files: 2000
  });
  const languages = uniqueSorted(scanned.files.map((file) => file.file_identity.language));
  const status = getCatalogRepoStatus({
    repo_root: scanned.repo_root,
    indexed_roots: scanned.indexed_roots,
    skipped_roots: scanned.skipped_roots,
    files: scanned.files,
    freshness: "unknown"
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
    .filter((file) => file.path.toLowerCase() === "readme.md" || file.path.startsWith("docs/"))
    .slice(0, 10)
    .map((file) => ({
      path: file.path,
      title: titleFromPath(file.path),
      reason: "Top-level README or docs directory file.",
      evidence_kinds: ["docs"]
    }));
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
