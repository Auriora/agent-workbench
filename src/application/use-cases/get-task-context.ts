import path from "node:path";
import type {
  CapabilityLevel,
  EvidenceKind,
  FileReference,
  NextAction,
  RankedSymbolCandidate,
  ResponseMetadata,
  SkippedWork,
  TaskContext,
  TaskContextRequest,
  ValidationHint
} from "../../contracts/index.js";
import type { FileCatalogEntry, GraphNode } from "../../domain/models/index.js";
import { getCatalogRepoStatus } from "./get-repo-status.js";
import type {
  FileCatalogPort,
  FileCatalogScanPort,
  GraphQueryPort,
  SnapshotPort,
  WorkspaceFilePort
} from "../../ports/index.js";
import { resolveSnapshot, toSymbolReference } from "./query-helpers.js";

export type GetTaskContextResult = {
  context: TaskContext;
  meta: ResponseMetadata;
};

export async function getTaskContext(input: {
  request: TaskContextRequest;
  scanner: FileCatalogScanPort;
  graph?: GraphQueryPort;
  snapshots?: SnapshotPort;
  catalog?: FileCatalogPort;
  workspace?: WorkspaceFilePort;
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
  const rankedSymbolResult = await selectRankedSymbols({
    task: input.request.task,
    symbols: input.request.symbols,
    repo_root: scanned.repo_root,
    graph: input.graph,
    snapshots: input.snapshots,
    catalog: input.catalog,
    workspace: input.workspace,
    limit: Math.min(10, Math.max(1, input.request.max_files))
  });
  const skippedWork = [
    ...rankedSymbolResult.skipped_work,
    ...skippedWorkForCatalog({
      scanned,
      requestedFiles,
      relatedFiles,
      governingDocs
    })
  ];
  const completeness = buildCompleteness({
    requestedFiles,
    relatedFiles,
    governingDocs,
    rankedSymbols: rankedSymbolResult.ranked_symbols,
    validationHints,
    skippedWork
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
      ranked_symbols: rankedSymbolResult.ranked_symbols,
      governing_docs: governingDocs,
      validation_hints: validationHints,
      skipped_work: skippedWork,
      completeness,
      risks,
      next_actions: [
        ...input.request.symbols.map((symbol) => ({
          tool: "symbol_search",
          args: {
            query: symbol,
            repo_root: scanned.repo_root
          }
        })),
        ...input.request.symbols.map((symbol) => ({
          tool: "find_references",
          args: {
            symbol,
            repo_root: scanned.repo_root
          }
        })),
        ...rankedSymbolResult.ranked_symbols.map((candidate) => ({
          tool: "find_references",
          args: {
            node_id: candidate.symbol.node_id,
            symbol: candidate.symbol.name,
            repo_root: scanned.repo_root
          }
        })),
        ...rankedSymbolResult.ranked_symbols.map((candidate) => ({
          tool: "impact",
          args: {
            node_id: candidate.symbol.node_id,
            repo_root: scanned.repo_root
          }
        })),
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

async function selectRankedSymbols(input: {
  task: string;
  symbols: readonly string[];
  repo_root: string;
  graph?: GraphQueryPort;
  snapshots?: SnapshotPort;
  catalog?: FileCatalogPort;
  workspace?: WorkspaceFilePort;
  limit: number;
}): Promise<{
  ranked_symbols: RankedSymbolCandidate[];
  skipped_work: SkippedWork[];
}> {
  if (input.graph === undefined || input.snapshots === undefined || input.catalog === undefined) {
    return {
      ranked_symbols: [],
      skipped_work: [
        {
          kind: "ranked_symbols",
          reason: "Graph query ports were not available for this context request.",
          next_action: {
            tool: "symbol_search",
            args: {
              query: input.symbols[0] ?? firstUsefulTerm(input.task) ?? input.task,
              repo_root: input.repo_root
            }
          }
        }
      ]
    };
  }

  const resolved = await resolveSnapshot({
    repo_root: input.repo_root,
    snapshots: input.snapshots,
    catalog: input.catalog,
    row_limit: input.limit
  });
  if (resolved === null) {
    return {
      ranked_symbols: [],
      skipped_work: [
        {
          kind: "ranked_symbols",
          reason: "No graph snapshot is available, so symbol ranking is deferred.",
          next_action: {
            tool: "prewarm_graph",
            args: {
              repo_root: input.repo_root
            }
          }
        }
      ]
    };
  }

  const terms = symbolTerms(input);
  const candidates = new Map<string, { node: GraphNode; score: number; reason: string }>();
  for (const term of terms) {
    const nodes = await input.graph.searchNodes({
      snapshot_id: resolved.snapshot_id,
      query: term,
      max_rows: input.limit
    });
    for (const node of nodes) {
      const score = scoreSymbol(node, term, input.symbols);
      const existing = candidates.get(node.id);
      if (existing === undefined || score > existing.score) {
        candidates.set(node.id, {
          node,
          score,
          reason: input.symbols.includes(term)
            ? "Matched a caller-supplied symbol through indexed graph evidence."
            : "Matched task terms through indexed graph evidence."
        });
      }
    }
  }

  const ranked = await Promise.all(
    Array.from(candidates.values())
      .sort((left, right) => right.score - left.score || left.node.file_path.localeCompare(right.node.file_path))
      .slice(0, input.limit)
      .map(async (candidate, index) => ({
        rank: index + 1,
        score: candidate.score,
        symbol: await toSymbolReference({
          node: candidate.node,
          workspace: input.workspace,
          source_byte_limit: 0
        }),
        reason: candidate.reason
      }))
  );

  return {
    ranked_symbols: ranked,
    skipped_work:
      ranked.length === 0
        ? [
            {
              kind: "ranked_symbols",
              reason: "Graph search returned no symbol candidates for the task terms.",
              next_action: {
                tool: "symbol_search",
                args: {
                  query: terms[0] ?? input.task,
                  repo_root: input.repo_root
                }
              }
            }
          ]
        : []
  };
}

function skippedWorkForCatalog(input: {
  scanned: { truncated: boolean };
  requestedFiles: readonly FileReference[];
  relatedFiles: readonly FileReference[];
  governingDocs: TaskContext["governing_docs"];
}): SkippedWork[] {
  const skipped: SkippedWork[] = [];
  if (input.scanned.truncated) {
    skipped.push({
      kind: "file_catalog",
      reason: "File catalog scan reached its row limit, so additional related files may exist."
    });
  }
  if (input.requestedFiles.length === 0 && input.relatedFiles.length === 0) {
    skipped.push({
      kind: "source_verification",
      reason: "No concrete source file was identified; direct reads are deferred until the task is narrowed."
    });
  }
  if (input.governingDocs.length === 0) {
    skipped.push({
      kind: "governing_docs",
      reason: "No governing documentation matched the bounded task terms."
    });
  }
  return skipped;
}

function buildCompleteness(input: {
  requestedFiles: readonly FileReference[];
  relatedFiles: readonly FileReference[];
  governingDocs: TaskContext["governing_docs"];
  rankedSymbols: readonly RankedSymbolCandidate[];
  validationHints: readonly ValidationHint[];
  skippedWork: readonly SkippedWork[];
}): TaskContext["completeness"] {
  const hasSource = [...input.requestedFiles, ...input.relatedFiles].some((file) => file.exists);
  const missingRequested = input.requestedFiles.some((file) => file.exists === false);
  const graphDeferred = input.skippedWork.some((item) => item.kind === "ranked_symbols");
  const markers = [
    hasSource ? "source_candidates_ranked" : "source_candidates_missing",
    input.governingDocs.length > 0 ? "governing_docs_ranked" : "governing_docs_missing",
    input.rankedSymbols.length > 0 ? "symbols_ranked" : "symbols_not_ranked",
    input.validationHints.length > 0 ? "validation_hints_available" : "validation_hints_missing",
    input.skippedWork.length > 0 ? "skipped_work_reported" : "no_skipped_work"
  ];
  const caveats = [
    "Related files and governing docs are routing evidence; directly read source before editing.",
    ...(missingRequested ? ["One or more requested files were not found."] : []),
    ...(graphDeferred ? ["Symbol ranking is deferred until graph evidence is available or narrowed."] : [])
  ];
  return {
    complete_enough: hasSource && !missingRequested && !graphDeferred,
    markers,
    caveats
  };
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

function symbolTerms(input: { task: string; symbols: readonly string[] }): string[] {
  const explicit = input.symbols.map((symbol) => symbol.trim()).filter((symbol) => symbol.length > 0);
  if (explicit.length > 0) {
    return Array.from(new Set(explicit)).slice(0, 5);
  }
  return Array.from(tokenSet([input.task]))
    .filter((term) => term.length >= 3)
    .slice(0, 5);
}

function firstUsefulTerm(task: string): string | undefined {
  return Array.from(tokenSet([task])).find((term) => term.length >= 3);
}

function scoreSymbol(node: GraphNode, term: string, explicitSymbols: readonly string[]): number {
  const lowerTerm = term.toLowerCase();
  const lowerName = node.name.toLowerCase();
  const lowerQualified = node.qualified_name?.toLowerCase() ?? "";
  let score = explicitSymbols.includes(term) ? 20 : 5;
  if (lowerName === lowerTerm || lowerQualified === lowerTerm) {
    score += 20;
  } else if (lowerName.includes(lowerTerm) || lowerQualified.includes(lowerTerm)) {
    score += 10;
  }
  if (node.language === "python") {
    score += 2;
  }
  return score;
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
