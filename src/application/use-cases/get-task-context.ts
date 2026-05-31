import path from "node:path";
import type {
  CapabilityLevel,
  EvidenceKind,
  FileReference,
  ResponseMetadata,
  TaskContext,
  TaskContextRequest,
  ValidationHint
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import { getCatalogRepoStatus } from "./get-repo-status.js";
import type { FileCatalogScanPort } from "../../ports/index.js";

export type GetTaskContextResult = {
  context: TaskContext;
  meta: ResponseMetadata;
};

export async function getTaskContext(input: {
  request: TaskContextRequest;
  scanner: FileCatalogScanPort;
  default_repo_root: string;
}): Promise<GetTaskContextResult> {
  const repoRoot = path.resolve(input.request.repo_root ?? input.default_repo_root);
  const maxFiles = input.request.max_files;
  const maxDocs = input.request.max_docs;
  const scanned = await input.scanner.scan({
    repo_root: repoRoot,
    indexed_roots: ["."],
    skipped_roots: [],
    max_files: 2000
  });
  const byPath = new Map(scanned.files.map((file) => [file.path, file]));
  const requestedFiles = input.request.files.map((filePath) =>
    toFileReference(filePath, byPath.get(normalizeRepoPath(filePath)))
  );
  const relatedFiles = selectRelatedFiles({
    task: input.request.task,
    symbols: input.request.symbols,
    files: scanned.files,
    exclude: new Set(requestedFiles.map((file) => file.path)),
    limit: maxFiles
  });
  const governingDocs = selectGoverningDocs({
    task: input.request.task,
    files: scanned.files,
    limit: maxDocs
  });
  const validationHints = inferValidationHints(scanned.files);
  const status = getCatalogRepoStatus({
    repo_root: scanned.repo_root,
    indexed_roots: scanned.indexed_roots,
    skipped_roots: scanned.skipped_roots,
    files: scanned.files,
    freshness: "unknown"
  });
  const risks = [
    ...(requestedFiles.some((file) => file.exists === false)
      ? [
          {
            severity: "warning" as const,
            message: "Some requested files were not found in the scanned repository.",
            why_this_matters: "Context is limited to existing indexed files; verify missing paths before editing."
          }
        ]
      : []),
    ...(relatedFiles.length === 0 && governingDocs.length === 0
      ? [
          {
            severity: "warning" as const,
            message: "No strong related files or governing docs were found from bounded local evidence.",
            why_this_matters: "Narrow the task with explicit files or symbols before making broad implementation claims."
          }
        ]
      : [])
  ];

  return {
    context: {
      task: input.request.task,
      repo_root: scanned.repo_root,
      summary: buildSummary({
        requestedCount: requestedFiles.length,
        relatedCount: relatedFiles.length,
        docCount: governingDocs.length,
        validationCount: validationHints.length
      }),
      requested_files: requestedFiles,
      related_files: relatedFiles,
      governing_docs: governingDocs,
      validation_hints: validationHints,
      risks,
      next_actions: [
        {
          tool: "verification_plan",
          args: {
            files: [...requestedFiles, ...relatedFiles].filter((file) => file.exists).map((file) => file.path)
          }
        }
      ]
    },
    meta: {
      ...status.meta,
      verification_status: "needed",
      truncated: scanned.truncated,
      budget: {
        row_limit: 2000
      }
    }
  };
}

function buildSummary(input: {
  requestedCount: number;
  relatedCount: number;
  docCount: number;
  validationCount: number;
}): string {
  return [
    `Task context found ${input.requestedCount} requested file(s)`,
    `${input.relatedCount} related file candidate(s)`,
    `${input.docCount} governing doc(s)`,
    `and ${input.validationCount} validation hint(s).`
  ].join(", ");
}

function selectRelatedFiles(input: {
  task: string;
  symbols: readonly string[];
  files: readonly FileCatalogEntry[];
  exclude: Set<string>;
  limit: number;
}): FileReference[] {
  const terms = tokenSet([input.task, ...input.symbols]);
  return input.files
    .filter((file) => input.exclude.has(file.path) === false)
    .map((file) => ({
      file,
      score: scoreFile(file, terms)
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.file.path.localeCompare(right.file.path))
    .slice(0, input.limit)
    .map((item) => toFileReference(item.file.path, item.file, "Matched task terms in the repo-relative path."));
}

function selectGoverningDocs(input: {
  task: string;
  files: readonly FileCatalogEntry[];
  limit: number;
}): TaskContext["governing_docs"] {
  const terms = tokenSet([input.task]);
  const docs = input.files.filter((file) => file.file_identity.language === "markdown");
  return docs
    .map((file) => ({
      file,
      score: scoreFile(file, terms) + docPriority(file.path)
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.file.path.localeCompare(right.file.path))
    .slice(0, input.limit)
    .map((item) => ({
      path: item.file.path,
      title: titleFromPath(item.file.path),
      reason: "Matched task terms or repository documentation priority.",
      evidence_kinds: ["docs"]
    }));
}

function inferValidationHints(files: readonly FileCatalogEntry[]): ValidationHint[] {
  const paths = new Set(files.map((file) => file.path));
  const hints: ValidationHint[] = [];
  if (paths.has("package.json")) {
    hints.push({
      command: "pnpm typecheck",
      reason: "package.json indicates a TypeScript/JavaScript project.",
      status: "needed"
    });
    hints.push({
      command: "pnpm test",
      reason: "package.json indicates a testable TypeScript/JavaScript project.",
      status: "needed"
    });
  }
  if (paths.has("pyproject.toml")) {
    hints.push({
      command: "python3 -m pytest",
      reason: "pyproject.toml indicates a Python project.",
      status: "needed"
    });
  }
  return hints;
}

function toFileReference(pathInput: string, entry?: FileCatalogEntry, reason = "Requested explicitly by the caller."): FileReference {
  if (entry === undefined) {
    return {
      path: normalizeRepoPath(pathInput),
      language: "unknown",
      exists: false,
      capability_level: "unsupported",
      evidence_kinds: [],
      reason
    };
  }
  return {
    path: entry.path,
    language: entry.file_identity.language,
    exists: true,
    capability_level: entry.adapter_evidence?.capability_level ?? capabilityFromLanguage(entry.file_identity.language),
    evidence_kinds: entry.adapter_evidence?.evidence_kinds ?? evidenceFromLanguage(entry.file_identity.language),
    reason
  };
}

function scoreFile(file: FileCatalogEntry, terms: Set<string>): number {
  const pathTerms = tokenSet([file.path]);
  let score = 0;
  for (const term of terms) {
    if (pathTerms.has(term)) {
      score += 3;
    } else if (file.path.toLowerCase().includes(term)) {
      score += 1;
    }
  }
  if (file.file_identity.language === "python") {
    score += terms.has("python") ? 2 : 0;
  }
  if (file.file_identity.language === "typescript") {
    score += terms.has("typescript") || terms.has("codex") || terms.has("mcp") ? 2 : 0;
  }
  return score;
}

function docPriority(filePath: string): number {
  const lower = filePath.toLowerCase();
  if (lower === "readme.md" || lower.endsWith("/readme.md")) {
    return 2;
  }
  if (lower.includes("docs/") || lower.startsWith("docs/")) {
    return 1;
  }
  return 0;
}

function titleFromPath(filePath: string): string {
  const basename = filePath.slice(filePath.lastIndexOf("/") + 1).replace(/\.[^.]+$/, "");
  return basename
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function tokenSet(values: readonly string[]): Set<string> {
  return new Set(
    values
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter((term) => term.length >= 2)
  );
}

function normalizeRepoPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function capabilityFromLanguage(language: string): CapabilityLevel {
  if (language === "python") {
    return "partial_semantic";
  }
  if (["markdown", "json", "toml", "yaml", "infrastructure"].includes(language)) {
    return "resource_backed";
  }
  return "unsupported";
}

function evidenceFromLanguage(language: string): EvidenceKind[] {
  if (language === "python") {
    return ["parser"];
  }
  if (language === "markdown") {
    return ["docs"];
  }
  if (["json", "toml", "yaml", "infrastructure"].includes(language)) {
    return ["config"];
  }
  return [];
}
