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
import { isExplicitHiddenCatalogPathAllowed } from "../../domain/policies/index.js";
import { getCatalogRepoStatus } from "./get-repo-status.js";
import { buildStatBackedFileCatalogEntry } from "./file-catalog-entry.js";
import { capNextActions } from "../../presentation/metadata.js";
import type {
  FileCatalogPort,
  FileCatalogScanPort,
  FileCatalogSkippedPath,
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
  const directRequestedEntries = await resolveExplicitEntries({
    filePaths: input.request.files,
    byPath,
    workspace: input.workspace
  });
  const requestedFiles = input.request.files.map((filePath) =>
    toFileReference(filePath, directRequestedEntries.get(normalizeRepoPath(filePath)))
  );
  const catalogFiles = [...directRequestedEntries.values()].sort((left, right) => left.path.localeCompare(right.path));
  const relatedFiles = selectRelatedFiles({
    task: input.request.task,
    symbols: input.request.symbols,
    requestedPaths: requestedFiles.filter((file) => file.exists).map((file) => file.path),
    files: scanned.files,
    exclude: new Set(requestedFiles.map((file) => file.path)),
    limit: maxFiles
  });
  const governingDocs = selectGoverningDocs({
    task: input.request.task,
    files: scanned.files,
    limit: maxDocs
  });
  const validationHints = inferValidationHints(catalogFiles);
  const status = getCatalogRepoStatus({
    repo_root: scanned.repo_root,
    indexed_roots: scanned.indexed_roots,
    skipped_roots: scanned.skipped_roots,
    files: catalogFiles,
    freshness: "unknown"
  });
  const rankedSymbolResult = await selectRankedSymbols({
    task: input.request.task,
    symbols: input.request.symbols,
    requestedPaths: requestedFiles.filter((file) => file.exists).map((file) => file.path),
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
      next_actions: capNextActions([
        ...input.request.symbols.map((symbol) => ({
          tool: "symbol_search",
          args: {
            query: symbol,
            repo_root: scanned.repo_root
          }
        })),
        ...rankedSymbolResult.ranked_symbols.flatMap((candidate) => [
          {
            tool: "find_references",
            args: {
              node_id: candidate.symbol.node_id,
              symbol: candidate.symbol.name,
              repo_root: scanned.repo_root
            }
          },
          {
            tool: "impact",
            args: {
              node_id: candidate.symbol.node_id,
              repo_root: scanned.repo_root
            }
          }
        ]),
        ...input.request.symbols.map((symbol) => ({
          tool: "find_references",
          args: {
            symbol,
            repo_root: scanned.repo_root
          }
        })),
        {
          tool: "verification_plan",
          args: {
            files: [...requestedFiles, ...relatedFiles].filter((file) => file.exists).map((file) => file.path)
          }
        }
      ])
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
  requestedPaths: readonly string[];
  files: readonly FileCatalogEntry[];
  exclude: Set<string>;
  limit: number;
}): FileReference[] {
  const terms = tokenSet([input.task, ...input.symbols]);
  return input.files
    .filter((file) => input.exclude.has(file.path) === false)
    .map((file) => ({
      file,
      score: scoreFile(file, terms) + scoreFileSeededEvidence(file, input.requestedPaths),
      reason: reasonForRelatedFile(file, terms, input.requestedPaths)
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.file.path.localeCompare(right.file.path))
    .slice(0, input.limit)
    .map((item) => toFileReference(item.file.path, item.file, item.reason));
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
  requestedPaths: readonly string[];
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
          reason: "No graph snapshot is available, so symbol ranking is deferred."
        }
      ]
    };
  }

  const terms = symbolTerms(input);
  const requestedPaths = new Set(input.requestedPaths);
  const candidates = new Map<string, { node: GraphNode; score: number; reason: string }>();
  for (const term of terms) {
    const nodes = await input.graph.searchNodes({
      snapshot_id: resolved.snapshot_id,
      query: term,
      max_rows: input.limit
    });
    for (const node of nodes) {
      const requestedFileMatch = requestedPaths.has(node.file_path);
      const score = scoreSymbol(node, term, input.symbols) + (requestedFileMatch ? 50 : 0);
      const existing = candidates.get(node.id);
      if (existing === undefined || score > existing.score) {
        candidates.set(node.id, {
          node,
          score,
          reason: requestedFileMatch
            ? "Matched task terms in a caller-supplied implementation file."
            : input.symbols.includes(term)
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
  scanned: { truncated: boolean; skipped_paths?: readonly FileCatalogSkippedPath[] };
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
  for (const skippedPathSummary of summarizeSkippedPaths(input.scanned.skipped_paths ?? [])) {
    skipped.push(skippedPathSummary);
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

function summarizeSkippedPaths(skippedPaths: readonly FileCatalogSkippedPath[]): SkippedWork[] {
  const counts = new Map<FileCatalogSkippedPath["reason"], { count: number; sample: string }>();
  for (const skippedPath of skippedPaths) {
    const existing = counts.get(skippedPath.reason);
    counts.set(skippedPath.reason, {
      count: (existing?.count ?? 0) + 1,
      sample: existing?.sample ?? skippedPath.path
    });
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 5)
    .map(([reason, summary]) => ({
      kind: "skipped_paths",
      reason: `${summary.count} path(s) skipped with reason ${reason}; sample: ${summary.sample}.`
    }));
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
  let score =
    firstPartyPathBoost(file.path) +
    jsTsStructureBoost(file.path, terms) +
    webAppStructureBoost(file.path, terms) +
    dotnetStructureBoost(file.path, terms) +
    samStructureBoost(file.path, terms);
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
  return Math.max(0, score - noisyArtifactPenalty(file.path));
}

function firstPartyPathBoost(filePath: string): number {
  const lower = filePath.toLowerCase();
  if (/^(src|lib|app|cmd|internal|include|tests?|packages)\//u.test(lower)) return 2;
  if (/^src\/(app|base|gui|mod)\//u.test(lower)) return 3;
  return 0;
}

function scoreFileSeededEvidence(file: FileCatalogEntry, requestedPaths: readonly string[]): number {
  if (requestedPaths.length === 0) {
    return 0;
  }
  let score = 0;
  for (const requestedPath of requestedPaths) {
    const requestedDir = path.posix.dirname(requestedPath);
    const requestedStem = stemFromPath(requestedPath);
    const candidateDir = path.posix.dirname(file.path);
    const candidateStem = stemFromPath(file.path);
    if (candidateDir === requestedDir && path.posix.basename(file.path).toLowerCase() === "cmakelists.txt") {
      score = Math.max(score, 20);
    }
    if (candidateDir === requestedDir && candidateStem.toLowerCase() === requestedStem.toLowerCase()) {
      score = Math.max(score, 12);
    }
    if (candidateDir === requestedDir && isTestLikePath(file.path)) {
      score = Math.max(score, 10);
    }
    if (isNearbyTestPath(file.path, requestedDir, requestedStem)) {
      score = Math.max(score, 9);
    }
  }
  return score;
}

function reasonForRelatedFile(
  file: FileCatalogEntry,
  terms: Set<string>,
  requestedPaths: readonly string[]
): string {
  for (const requestedPath of requestedPaths) {
    const requestedDir = path.posix.dirname(requestedPath);
    const requestedStem = stemFromPath(requestedPath);
    const candidateDir = path.posix.dirname(file.path);
    const candidateStem = stemFromPath(file.path);
    if (candidateDir === requestedDir && path.posix.basename(file.path).toLowerCase() === "cmakelists.txt") {
      return "Local build file adjacent to an explicitly supplied source file.";
    }
    if (candidateDir === requestedDir && candidateStem.toLowerCase() === requestedStem.toLowerCase()) {
      return "Same-stem sibling file adjacent to an explicitly supplied source file.";
    }
    if (candidateDir === requestedDir && isTestLikePath(file.path)) {
      return "Nearby test file associated with an explicitly supplied source file.";
    }
    if (isNearbyTestPath(file.path, requestedDir, requestedStem)) {
      return "Nearby test file associated with an explicitly supplied source file.";
    }
  }
  const pathTerms = tokenSet([file.path]);
  const hasExactPathTerm = [...terms].some((term) => pathTerms.has(term));
  const webReason = webAppStructureReason(file.path, terms);
  if (webReason !== undefined) {
    return webReason;
  }
  const jsTsReason = jsTsStructureReason(file.path, terms);
  if (jsTsReason !== undefined) {
    return jsTsReason;
  }
  const dotnetReason = dotnetStructureReason(file.path, terms);
  if (dotnetReason !== undefined) {
    return dotnetReason;
  }
  const samReason = samStructureReason(file.path, terms);
  if (samReason !== undefined) {
    return samReason;
  }
  return hasExactPathTerm
    ? "Matched task terms in the repo-relative path."
    : "Weak path-term match; use as routing evidence only.";
}

function jsTsStructureBoost(filePath: string, terms: Set<string>): number {
  const reason = jsTsStructureReason(filePath, terms);
  if (reason === undefined) {
    return 0;
  }
  const lower = filePath.toLowerCase();
  if (lower.endsWith("package.json")) return 5;
  if (lower.endsWith("tsconfig.json") || lower.includes("tsconfig.")) return 5;
  if (lower.endsWith("pnpm-workspace.yaml") || lower.endsWith("pnpm-workspace.yml")) return 4;
  if (lower.startsWith("apps/") || lower.startsWith("packages/")) return 8;
  if (lower.startsWith("services/") || lower.includes("/api/") || lower.includes("/server/")) return 8;
  if (lower.startsWith("e2e/") || lower.includes("/e2e/")) return 7;
  return 4;
}

function jsTsStructureReason(filePath: string, terms: Set<string>): string | undefined {
  if (!hasAnyTerm(terms, ["javascript", "typescript", "js", "ts", "tsx", "client", "web", "server", "api", "e2e", "workspace", "package", "monorepo", "auth", "login"])) {
    return undefined;
  }
  const lower = filePath.toLowerCase();
  if (lower.endsWith("package.json")) {
    return "Matched JavaScript/TypeScript package boundary evidence.";
  }
  if (lower.endsWith("tsconfig.json") || lower.includes("tsconfig.")) {
    return "Matched TypeScript project configuration evidence.";
  }
  if (lower.endsWith("pnpm-workspace.yaml") || lower.endsWith("pnpm-workspace.yml")) {
    return "Matched JavaScript/TypeScript workspace configuration evidence.";
  }
  if (lower.startsWith("apps/") || lower.startsWith("packages/")) {
    return "Matched JavaScript/TypeScript app or package workspace convention.";
  }
  if (lower.startsWith("services/") || lower.includes("/api/") || lower.includes("/server/")) {
    return "Matched JavaScript/TypeScript service or API workspace convention.";
  }
  if (lower.startsWith("e2e/") || lower.includes("/e2e/")) {
    return "Matched end-to-end test workspace convention.";
  }
  return undefined;
}

function webAppStructureBoost(filePath: string, terms: Set<string>): number {
  const reason = webAppStructureReason(filePath, terms);
  if (reason === undefined) {
    return 0;
  }
  const lower = filePath.toLowerCase();
  if (lower.includes("/controllers/") || lower.includes("/routes/")) return 9;
  if (lower.includes("/services/") || lower.includes("/strategies/")) return 8;
  if (lower.includes("/pages/") || lower.includes("/components/")) return 15;
  if (lower.startsWith("e2e/") || lower.includes("/e2e/")) return 6;
  if (lower.includes("data-provider") || lower.includes("api-endpoint")) return 5;
  return 4;
}

function webAppStructureReason(filePath: string, terms: Set<string>): string | undefined {
  if (!hasAnyTerm(terms, ["auth", "login", "logout", "oauth", "openid", "session", "user"])) {
    return undefined;
  }
  const lower = filePath.toLowerCase();
  const pathMentionsAuth = /auth|login|logout|oauth|openid|session|user/u.test(lower);
  if (!pathMentionsAuth) {
    return undefined;
  }
  if (lower.includes("/controllers/")) {
    return "Matched web application controller convention and authentication task terms.";
  }
  if (lower.includes("/routes/")) {
    return "Matched web application route convention and authentication task terms.";
  }
  if (lower.includes("/services/")) {
    return "Matched web application service convention and authentication task terms.";
  }
  if (lower.includes("/strategies/")) {
    return "Matched web authentication strategy convention and task terms.";
  }
  if (lower.includes("/pages/") || lower.includes("/components/")) {
    return "Matched web UI page/component convention and authentication task terms.";
  }
  if (lower.startsWith("e2e/") || lower.includes("/e2e/")) {
    return "Matched end-to-end authentication test/setup convention.";
  }
  if (lower.includes("data-provider") || lower.includes("api-endpoint")) {
    return "Matched web data-provider/API endpoint convention and authentication task terms.";
  }
  return undefined;
}

function hasAnyTerm(terms: Set<string>, expected: readonly string[]): boolean {
  return expected.some((term) => terms.has(term));
}

function dotnetStructureBoost(filePath: string, terms: Set<string>): number {
  const reason = dotnetStructureReason(filePath, terms);
  if (reason === undefined) {
    return 0;
  }
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".sln")) return 22;
  if (lower.endsWith(".csproj")) return 20;
  if (lower.endsWith("/program.cs")) return 10;
  if (lower.includes("dbcontext") || lower.includes("/migrations/")) return 10;
  if (lower.includes("/controllers/")) return 9;
  if (lower.endsWith(".razor") || lower.includes("/pages/") || lower.includes("/shared/")) return 8;
  if (lower.includes("appsettings")) return 7;
  return 4;
}

function dotnetStructureReason(filePath: string, terms: Set<string>): string | undefined {
  if (!hasAnyTerm(terms, ["dotnet", "net", "csharp", "blazor", "razor", "controller", "api", "ef", "entity", "migration", "dbcontext"])) {
    return undefined;
  }
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".sln")) {
    return "Matched .NET solution file convention.";
  }
  if (lower.endsWith(".csproj") || lower.endsWith(".fsproj") || lower.endsWith(".vbproj")) {
    return "Matched .NET project file convention.";
  }
  if (lower.endsWith("/program.cs")) {
    return "Matched .NET application entrypoint convention.";
  }
  if (lower.includes("/controllers/")) {
    return "Matched ASP.NET controller convention.";
  }
  if (lower.endsWith(".razor") || lower.includes("/pages/") || lower.includes("/shared/")) {
    return "Matched Razor/Blazor UI convention.";
  }
  if (lower.includes("dbcontext") || lower.includes("/migrations/")) {
    return "Matched Entity Framework context or migration convention.";
  }
  if (lower.includes("appsettings")) {
    return "Matched .NET appsettings configuration convention.";
  }
  return undefined;
}

function samStructureBoost(filePath: string, terms: Set<string>): number {
  const reason = samStructureReason(filePath, terms);
  if (reason === undefined) {
    return 0;
  }
  const lower = filePath.toLowerCase();
  if (isSamTemplatePath(lower)) return 18;
  if (lower.includes("/tests/infra/") || lower.includes("/test/infra/")) return 11;
  if (isLambdaHandlerPath(lower)) return 10;
  return 5;
}

function samStructureReason(filePath: string, terms: Set<string>): string | undefined {
  if (!hasAnyTerm(terms, ["sam", "cloudformation", "lambda", "handler", "template", "stack", "event", "schedule", "aws", "test", "validation"])) {
    return undefined;
  }
  const lower = filePath.toLowerCase();
  if (isSamTemplatePath(lower)) {
    return "Matched SAM/CloudFormation template convention.";
  }
  if (isLambdaHandlerPath(lower)) {
    return "Matched Lambda handler source convention.";
  }
  if (lower.startsWith("tests/infra/") || lower.startsWith("test/infra/") || lower.includes("/tests/infra/") || lower.includes("/test/infra/")) {
    return "Matched infrastructure test convention.";
  }
  return undefined;
}

function isSamTemplatePath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    (lower.endsWith("template.yaml") || lower.endsWith("template.yml") || lower.endsWith("template.json")) &&
    (lower.includes("/sam/") || lower.includes("/cloudformation/") || lower.startsWith("infra/") || lower.startsWith("template."))
  );
}

function isLambdaHandlerPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return /\.(py|ts|js|mjs|cjs)$/u.test(lower) && (lower.includes("/lambda/") || lower.includes("/handlers/") || lower.endsWith("/app.py"));
}

function noisyArtifactPenalty(filePath: string): number {
  const lower = filePath.toLowerCase();
  if (/(^|\/)(vendor|third_party|thirdparty|3rdparty|external|extern)\//u.test(lower)) return 12;
  if (lower.includes("/fixtures/") || lower.includes("/fixture/")) return 7;
  if (lower.includes("/installer/") || lower.includes("/generated/")) return 6;
  if (lower.endsWith(".md") || lower.endsWith(".txt")) return 3;
  return 0;
}

function isNearbyTestPath(filePath: string, requestedDir: string, requestedStem: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    isTestLikePath(filePath) &&
    (path.posix.dirname(filePath) === requestedDir || lower.includes(`/${requestedStem.toLowerCase()}`))
  );
}

function isTestLikePath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.includes("test") || lower.includes("spec");
}

function stemFromPath(filePath: string): string {
  return path.posix.basename(filePath).replace(/\.[^.]+$/u, "");
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

async function resolveExplicitEntries(input: {
  filePaths: readonly string[];
  byPath: Map<string, FileCatalogEntry>;
  workspace?: WorkspaceFilePort;
}): Promise<Map<string, FileCatalogEntry>> {
  const resolved = new Map(input.byPath);
  if (input.workspace === undefined) {
    return resolved;
  }

  for (const filePath of input.filePaths) {
    const normalizedPath = normalizeRepoPath(filePath);
    if (resolved.has(normalizedPath)) {
      continue;
    }
    if (!isExplicitHiddenCatalogPathAllowed(normalizedPath)) {
      continue;
    }
    const stat = await input.workspace.stat({ path: normalizedPath });
    if (!stat.exists || !stat.is_file) {
      continue;
    }
    resolved.set(
      normalizedPath,
      buildStatBackedFileCatalogEntry({
        path: normalizedPath,
        size_bytes: stat.size_bytes,
        mtime_ms: stat.mtime_ms
      })
    );
  }

  return resolved;
}

function capabilityFromLanguage(language: string): CapabilityLevel {
  if (language === "python") {
    return "partial_semantic";
  }
  if (["csharp", "markdown", "json", "toml", "yaml", "infrastructure"].includes(language)) {
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
  if (language === "csharp") {
    return ["heuristic"];
  }
  if (["json", "toml", "yaml", "infrastructure"].includes(language)) {
    return ["config"];
  }
  return [];
}
