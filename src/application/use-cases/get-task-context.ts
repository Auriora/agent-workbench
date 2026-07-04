/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

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
import {
  classifyMarkdownDoc,
  isExplicitHiddenCatalogPathAllowed
} from "../../domain/policies/index.js";
import { getCatalogRepoStatus } from "./get-repo-status.js";
import { buildStatBackedFileCatalogEntry } from "./file-catalog-entry.js";
import { capNextActions } from "./response-metadata.js";
import type {
  FileCatalogPort,
  FileCatalogScanPort,
  FileCatalogSkippedPath,
  GraphQueryPort,
  SnapshotPort,
  WorkspaceFilePort
} from "../../ports/index.js";
import { resolveSnapshot, toSymbolReference } from "./query-helpers.js";
import {
  detectJsTsProjectShape,
  isJsTsLanguage,
  isJsTsProjectConfigPath,
  isJsTsTestPath,
  jsTsPackageRootForPath
} from "./js-ts-project-shape.js";
import {
  detectMcpServerShape,
  isMcpServerEvidencePath,
  mcpEvidenceReason,
  mcpTransportLabels
} from "./mcp-server-shape.js";
import {
  classifyMarkdownEntryCurrency,
  currencyRank,
  loadDocumentationMapOwners,
  publicCurrency
} from "./document-currency-routing.js";

export type GetTaskContextResult = {
  context: Omit<TaskContext, "lifecycle_evidence"> & {
    lifecycle_evidence?: TaskContext["lifecycle_evidence"];
  };
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
    max_files: 15000
  });
  const byPath = new Map(scanned.files.map((file) => [file.path, file]));
  const jsTsShape = detectJsTsProjectShape(scanned.files);
  const specRouting = await buildSpecRouting({
    request: input.request,
    byPath,
    workspace: input.workspace,
    maxFiles,
    maxDocs
  });
  const directRequestedEntries = await resolveExplicitEntries({
    filePaths: uniqueStrings([...input.request.files, ...specRouting.files]),
    byPath,
    workspace: input.workspace
  });
  const requestedFiles = uniqueStrings([...input.request.files, ...specRouting.files]).map((filePath) =>
    toFileReference(filePath, directRequestedEntries.get(normalizeRepoPath(filePath)))
  );
  const catalogFiles = [...directRequestedEntries.values()].sort((left, right) => left.path.localeCompare(right.path));
  const relatedFiles = selectRelatedFiles({
    task: input.request.task,
    symbols: input.request.symbols,
    requestedPaths: requestedFiles.filter((file) => file.exists).map((file) => file.path),
    files: scanned.files,
    exclude: new Set(requestedFiles.map((file) => file.path)),
    jsTsPackageRoots: jsTsShape.package_roots,
    limit: maxFiles
  });
  const governingDocs = await selectGoverningDocs({
    task: input.request.task,
    files: scanned.files,
    limit: maxDocs,
    workspace: input.workspace
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
      lifecycle_evidence: specRouting.lifecycle_evidence,
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
        ...specRouting.next_actions,
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
        row_limit: 15000
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

type SpecReference = {
  spec_path?: string;
  spec_id?: string;
  task_id?: string;
};

async function buildSpecRouting(input: {
  request: TaskContextRequest;
  byPath: Map<string, FileCatalogEntry>;
  workspace?: WorkspaceFilePort;
  maxFiles: number;
  maxDocs: number;
}): Promise<{
  files: string[];
  lifecycle_evidence: TaskContext["lifecycle_evidence"];
  next_actions: NextAction[];
}> {
  const explicitLifecycleContext = input.request.lifecycle_context;
  const lifecycleEvidence: TaskContext["lifecycle_evidence"] = [];
  const files: string[] = [];
  const nextActions: NextAction[] = [];

  if (explicitLifecycleContext !== undefined) {
    for (const output of explicitLifecycleContext.outputs) {
      lifecycleEvidence.push({
        source: explicitLifecycleContext.source,
        kind: output.kind,
        status: output.status,
        summary: output.summary,
        files: output.files,
        validation_hints: output.validation_hints,
        next_actions: output.next_actions
      });
      files.push(...output.files);
      nextActions.push(...output.next_actions);
    }
  }

  const reference = detectSpecReference(input.request);
  if (reference === undefined && explicitLifecycleContext === undefined) {
    return {
      files: [],
      lifecycle_evidence: [],
      next_actions: []
    };
  }

  const specPath =
    explicitLifecycleContext?.spec_path ??
    reference?.spec_path ??
    (reference?.spec_id === undefined ? undefined : resolveSpecPath(reference.spec_id, input.byPath));
  const taskId = explicitLifecycleContext?.task_id ?? reference?.task_id;

  if (specPath !== undefined) {
    const local = await readLocalSpecRouting({
      specPath,
      taskId,
      workspace: input.workspace,
      maxFiles: input.maxFiles,
      maxDocs: input.maxDocs
    });
    lifecycleEvidence.push(local.evidence);
    files.push(...local.files);
  }

  const lifecycleToolsCallable = explicitLifecycleContext?.state === "callable";
  if (!lifecycleToolsCallable && specPath !== undefined) {
    nextActions.push({
      tool: "spec-lifecycle-manager.task_context",
      args: {
        spec_path: specPath,
        ...(taskId === undefined ? {} : { task_id: taskId })
      }
    });
  }

  return {
    files: uniqueStrings(files).slice(0, input.maxFiles),
    lifecycle_evidence: lifecycleEvidence,
    next_actions: nextActions
  };
}

function detectSpecReference(request: TaskContextRequest): SpecReference | undefined {
  const combined = [request.task, ...request.files].join(" ");
  const specPathMatch = /docs\/specs\/([0-9]{3}[-a-z0-9_]*)/iu.exec(combined);
  const specIdMatch = /\bSpec\s+([0-9]{3})\b/iu.exec(combined);
  const taskIdMatch = /\bT([0-9]{3})\b/iu.exec(combined);
  if (specPathMatch === null && specIdMatch === null && taskIdMatch === null) {
    return undefined;
  }
  return {
    spec_path: specPathMatch === null ? undefined : `docs/specs/${specPathMatch[1]}`,
    spec_id: specIdMatch === null ? undefined : specIdMatch[1],
    task_id: taskIdMatch === null ? undefined : `T${taskIdMatch[1]}`
  };
}

function resolveSpecPath(specId: string, byPath: Map<string, FileCatalogEntry>): string | undefined {
  const prefix = `docs/specs/${specId}-`;
  const candidates = [...byPath.keys()]
    .filter((filePath) => filePath.startsWith(prefix))
    .map((filePath) => filePath.split("/").slice(0, 3).join("/"))
    .sort();
  return candidates[0];
}

async function readLocalSpecRouting(input: {
  specPath: string;
  taskId?: string;
  workspace?: WorkspaceFilePort;
  maxFiles: number;
  maxDocs: number;
}): Promise<{
  files: string[];
  evidence: TaskContext["lifecycle_evidence"][number];
}> {
  const artifactPaths = ["requirements.md", "design.md", "tasks.md", "traceability.md", "verification.md"].map(
    (artifact) => `${input.specPath}/${artifact}`
  );
  const existing = [];
  const missing = [];
  const mentionedFiles: string[] = [];
  let statusLine = "unknown";
  let taskSnippet = "";

  if (input.workspace === undefined) {
    return {
      files: artifactPaths.slice(0, input.maxDocs),
      evidence: {
        source: "agent-workbench-local-reader",
        kind: "local_spec_routing",
        status: "unknown",
        summary: "Spec reference detected, but local direct reads are unavailable in this context.",
        files: artifactPaths.slice(0, input.maxDocs),
        validation_hints: [],
        next_actions: []
      }
    };
  }

  for (const artifactPath of artifactPaths) {
    const stat = await input.workspace.stat({ path: artifactPath });
    if (!stat.exists || !stat.is_file) {
      missing.push(artifactPath);
      continue;
    }
    existing.push(artifactPath);
    const text = await input.workspace.readText({ path: artifactPath });
    if (artifactPath.endsWith("/requirements.md")) {
      statusLine = frontmatterValue(text, "status") ?? statusLine;
    }
    if (input.taskId !== undefined && taskSnippet.length === 0) {
      taskSnippet = extractTaskBlock(text, input.taskId);
      mentionedFiles.push(...extractBacktickedFilePaths(taskSnippet));
    }
    mentionedFiles.push(...extractBacktickedFilePaths(text).filter((filePath) => filePath.startsWith("src/") || filePath.startsWith("docs/") || filePath.startsWith("tests/")));
  }

  const historical = statusLine === "archived" || statusLine === "closed" || input.specPath.includes("/archive/");
  const malformed = missing.includes(`${input.specPath}/requirements.md`) || missing.includes(`${input.specPath}/tasks.md`);
  const label = historical
    ? "historical delivery record"
    : malformed
      ? "malformed spec package"
      : "active spec package";
  const taskSummary = input.taskId === undefined
    ? ""
    : taskSnippet.length > 0
      ? ` Task ${input.taskId} was found in local checklist evidence.`
      : ` Task ${input.taskId} was not found in local checklist evidence.`;

  return {
    files: uniqueStrings([...existing, ...mentionedFiles]).slice(0, input.maxFiles),
    evidence: {
      source: "agent-workbench-local-reader",
      kind: "local_spec_routing",
      status: "non_authoritative",
      summary: `${label}: ${input.specPath}. Existing artifacts: ${existing.length}; missing artifacts: ${missing.length}.${taskSummary} Use spec-lifecycle-manager for authoritative lifecycle decisions.`,
      files: uniqueStrings([...existing, ...mentionedFiles]).slice(0, input.maxFiles),
      validation_hints: [
        {
          command: `spec-lifecycle-manager task_context ${input.specPath}${input.taskId === undefined ? "" : ` --task ${input.taskId}`}`,
          reason: "Authoritative lifecycle context is owned by spec-lifecycle-manager; local spec routing is non-authoritative.",
          status: "needed"
        }
      ],
      next_actions: [
        {
          tool: "spec-lifecycle-manager.task_context",
          args: {
            spec_path: input.specPath,
            ...(input.taskId === undefined ? {} : { task_id: input.taskId })
          }
        }
      ]
    }
  };
}

function frontmatterValue(text: string, key: string): string | undefined {
  const match = new RegExp(`^${key}:\\s*([^\\n]+)$`, "imu").exec(text);
  return match?.[1]?.trim();
}

function extractTaskBlock(text: string, taskId: string): string {
  const lines = text.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.includes(taskId));
  if (start < 0) return "";
  const end = lines.findIndex((line, index) => index > start && /^- \[[^\]]+\] T[0-9]{3}\b/u.test(line));
  return lines.slice(start, end < 0 ? Math.min(lines.length, start + 12) : end).join("\n");
}

function extractBacktickedFilePaths(text: string): string[] {
  return [...text.matchAll(/`((?:src|tests|docs|plugins)\/[^`]+)`/gu)]
    .map((match) => match[1])
    .filter((filePath): filePath is string => filePath !== undefined);
}

function selectRelatedFiles(input: {
  task: string;
  symbols: readonly string[];
  requestedPaths: readonly string[];
  files: readonly FileCatalogEntry[];
  exclude: Set<string>;
  jsTsPackageRoots: readonly string[];
  limit: number;
}): FileReference[] {
  const terms = tokenSet([input.task, ...input.symbols]);
  return input.files
    .filter((file) => input.exclude.has(file.path) === false)
    .map((file) => ({
      file,
      score: scoreFile(file, terms) + scoreFileSeededEvidence(file, input.requestedPaths, input.jsTsPackageRoots),
      reason: reasonForRelatedFile(file, terms, input.requestedPaths, input.jsTsPackageRoots)
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.file.path.localeCompare(right.file.path))
    .slice(0, input.limit)
    .map((item) => toFileReference(item.file.path, item.file, item.reason));
}

async function selectGoverningDocs(input: {
  task: string;
  files: readonly FileCatalogEntry[];
  limit: number;
  workspace?: WorkspaceFilePort;
}): Promise<TaskContext["governing_docs"]> {
  const terms = tokenSet([input.task]);
  const docs = input.files.filter((file) => file.file_identity.language === "markdown");
  const owners = await loadDocumentationMapOwners({
    files: input.files,
    workspace: input.workspace
  });
  const candidates = await Promise.all(docs
    .map((file) => ({
      file,
      score: scoreFile(file, terms) + docPriority(file.path)
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.file.path.localeCompare(right.file.path))
    .slice(0, Math.max(input.limit * 4, input.limit))
    .map(async (item) => {
      const title = titleFromPath(item.file.path);
      const content = input.workspace === undefined ? undefined : await readOptionalText(input.workspace, item.file.path);
      const authority = classifyMarkdownEntryCurrency({
        path: item.file.path,
        title,
        content,
        mtime_ms: item.file.file_identity.mtime_ms,
        owners
      });
      return {
        score: item.score + currencyRank(authority),
        doc: {
          path: item.file.path,
          title,
          reason: [
            "Matched task terms or repository documentation priority.",
            authority.authority_caveat,
            authority.currency_caveats[0]
          ].filter((part) => part !== undefined && part.length > 0).join(" "),
          evidence_kinds: ["docs" as const],
          ...publicAuthority(authority),
          ...publicCurrency(authority)
        }
      };
    }));
  return candidates
    .sort((left, right) => right.score - left.score || left.doc.path.localeCompare(right.doc.path))
    .slice(0, input.limit)
    .map((candidate) => candidate.doc);
}

async function readOptionalText(workspace: WorkspaceFilePort, filePath: string): Promise<string | undefined> {
  try {
    return await workspace.readText({ path: filePath });
  } catch {
    return undefined;
  }
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

  const expandedCandidates = await expandLambdaRankedSymbolCandidates({
    graph: input.graph,
    snapshot_id: resolved.snapshot_id,
    candidates: Array.from(candidates.values()),
    limit: input.limit
  });
  const ranked = await Promise.all(
    expandedCandidates
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

async function expandLambdaRankedSymbolCandidates(input: {
  graph: GraphQueryPort;
  snapshot_id: string;
  candidates: Array<{ node: GraphNode; score: number; reason: string }>;
  limit: number;
}): Promise<Array<{ node: GraphNode; score: number; reason: string }>> {
  const sorted = [...input.candidates].sort(compareRankedSymbolCandidates);
  const expanded: Array<{ node: GraphNode; score: number; reason: string }> = [];
  const seen = new Set<string>();
  for (const candidate of sorted) {
    if (!seen.has(candidate.node.id)) {
      expanded.push(candidate);
      seen.add(candidate.node.id);
    }
    if (candidate.node.kind === "lambda_handler_binding") {
      const anchors = await lambdaHandlerFileAnchors({
        graph: input.graph,
        snapshot_id: input.snapshot_id,
        node: candidate.node
      });
      for (const anchor of anchors) {
        if (!seen.has(anchor.id)) {
          expanded.push({
            node: anchor,
            score: candidate.score,
            reason: "Matched Lambda handler file routing evidence for a grouped handler result."
          });
          seen.add(anchor.id);
        }
      }
    }
    if (expanded.length >= input.limit) {
      break;
    }
  }
  return expanded.slice(0, input.limit);
}

async function lambdaHandlerFileAnchors(input: {
  graph: GraphQueryPort;
  snapshot_id: string;
  node: GraphNode;
}): Promise<readonly GraphNode[]> {
  const edges = await input.graph.getOutgoingEdges({
    snapshot_id: input.snapshot_id,
    node_id: input.node.id,
    max_rows: 5
  });
  const anchors = await Promise.all(
    edges
      .filter((edge) => edge.kind === "routes_to_handler_file" && edge.target_node_id !== undefined)
      .map((edge) =>
        input.graph.getNode({
          snapshot_id: input.snapshot_id,
          node_id: edge.target_node_id ?? ""
        })
      )
  );
  return anchors.filter((node): node is GraphNode => node !== null).sort(compareLambdaNodes);
}

function compareRankedSymbolCandidates(
  left: { node: GraphNode; score: number },
  right: { node: GraphNode; score: number }
): number {
  if (isLambdaHandlerNode(left.node) && isLambdaHandlerNode(right.node)) {
    return compareLambdaNodes(left.node, right.node) ||
      right.score - left.score;
  }
  return right.score - left.score ||
    compareLambdaNodes(left.node, right.node);
}

function isLambdaHandlerNode(node: GraphNode): boolean {
  return node.kind === "lambda_handler_binding" || node.kind === "lambda_handler_file";
}

function compareLambdaNodes(left: GraphNode, right: GraphNode): number {
  return lambdaTemplateKey(left).localeCompare(lambdaTemplateKey(right)) ||
    lambdaLogicalId(left).localeCompare(lambdaLogicalId(right)) ||
    lambdaKindRank(left) - lambdaKindRank(right) ||
    left.name.localeCompare(right.name) ||
    left.file_path.localeCompare(right.file_path);
}

function lambdaTemplateKey(node: GraphNode): string {
  const value = node.metadata.template_path;
  return typeof value === "string" ? value : node.file_path;
}

function lambdaLogicalId(node: GraphNode): string {
  const value = node.metadata.logical_id;
  return typeof value === "string" ? value : "";
}

function lambdaKindRank(node: GraphNode): number {
  if (node.kind === "lambda_handler_binding") return 0;
  if (node.kind === "lambda_handler_file") return 1;
  if (node.kind === "lambda_function") return 2;
  return 5;
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
    cppStructureBoost(file.path, terms) +
    jsTsStructureBoost(file.path, terms) +
    webAppStructureBoost(file.path, terms) +
    dotnetStructureBoost(file.path, terms) +
    samStructureBoost(file.path, terms) +
    mcpServerStructureBoost(file.path, terms);
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
  if (file.file_identity.language === "cpp" || file.file_identity.language === "c") {
    score += hasAnyTerm(terms, ["c", "cpp", "cplusplus", "cmake"]) ? 2 : 0;
  }
  return Math.max(0, score - noisyArtifactPenalty(file.path));
}

function firstPartyPathBoost(filePath: string): number {
  const lower = filePath.toLowerCase();
  if (/^(src|lib|app|cmd|internal|include|tests?|packages)\//u.test(lower)) return 2;
  if (/^src\/(app|base|gui|mod)\//u.test(lower)) return 3;
  return 0;
}

function scoreFileSeededEvidence(
  file: FileCatalogEntry,
  requestedPaths: readonly string[],
  jsTsPackageRoots: readonly string[]
): number {
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
    if (isSamTemplatePath(requestedPath) && isLambdaHandlerPath(file.path)) {
      score = Math.max(score, 13);
    }
    if (isSamTemplatePath(requestedPath) && isSamInfraTestPath(file.path)) {
      score = Math.max(score, 12);
    }
    if (isJsTsRequestPath(requestedPath)) {
      const requestedPackageRoot = jsTsPackageRootForPath(requestedPath, jsTsPackageRoots);
      const candidatePackageRoot = jsTsPackageRootForPath(file.path, jsTsPackageRoots);
      if (requestedPackageRoot !== undefined && requestedPackageRoot === candidatePackageRoot && isJsTsProjectConfigPath(file.path)) {
        score = Math.max(score, 15);
      }
      if (isJsTsProjectConfigPath(file.path) && (file.path === "package.json" || file.path.includes("workspace"))) {
        score = Math.max(score, 11);
      }
      if (isJsTsTestPath(file.path) && sameTopLevelWorkspace(requestedPath, file.path)) {
        score = Math.max(score, 13);
      }
      if (sameTopLevelWorkspace(requestedPath, file.path) && isJsTsLanguage(file.file_identity.language)) {
        score = Math.max(score, 8);
      }
    }
  }
  return score;
}

function reasonForRelatedFile(
  file: FileCatalogEntry,
  terms: Set<string>,
  requestedPaths: readonly string[],
  jsTsPackageRoots: readonly string[]
): string {
  for (const requestedPath of requestedPaths) {
    const requestedDir = path.posix.dirname(requestedPath);
    const requestedStem = stemFromPath(requestedPath);
    const candidateDir = path.posix.dirname(file.path);
    const candidateStem = stemFromPath(file.path);
    if (isJsTsRequestPath(requestedPath)) {
      const requestedPackageRoot = jsTsPackageRootForPath(requestedPath, jsTsPackageRoots);
      const candidatePackageRoot = jsTsPackageRootForPath(file.path, jsTsPackageRoots);
      if (requestedPackageRoot !== undefined && requestedPackageRoot === candidatePackageRoot && isJsTsProjectConfigPath(file.path)) {
        return "Package-local JavaScript/TypeScript configuration associated with an explicitly supplied source file.";
      }
      if (isJsTsProjectConfigPath(file.path) && (file.path === "package.json" || file.path.includes("workspace"))) {
        return "Workspace-level JavaScript/TypeScript configuration associated with an explicitly supplied source file.";
      }
      if (isJsTsTestPath(file.path) && sameTopLevelWorkspace(requestedPath, file.path)) {
        return "Package-local JavaScript/TypeScript test associated with an explicitly supplied source file.";
      }
    }
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
    if (isSamTemplatePath(requestedPath) && isLambdaHandlerPath(file.path)) {
      return "Lambda handler source associated with an explicitly supplied SAM/CloudFormation template.";
    }
    if (isSamTemplatePath(requestedPath) && isSamInfraTestPath(file.path)) {
      return "Infrastructure test associated with an explicitly supplied SAM/CloudFormation template.";
    }
  }
  const pathTerms = tokenSet([file.path]);
  const hasExactPathTerm = [...terms].some((term) => pathTerms.has(term));
  const cppReason = cppStructureReason(file.path, terms);
  if (cppReason !== undefined) {
    return cppReason;
  }
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
  const mcpReason = mcpServerStructureReason(file.path, terms);
  if (mcpReason !== undefined) {
    return mcpReason;
  }
  return hasExactPathTerm
    ? "Matched task terms in the repo-relative path."
    : "Weak path-term match; use as routing evidence only.";
}

function cppStructureBoost(filePath: string, terms: Set<string>): number {
  const reason = cppStructureReason(filePath, terms);
  if (reason === undefined) {
    return 0;
  }
  const lower = filePath.toLowerCase();
  if (lower.endsWith("cmakelists.txt")) return 14;
  if (isTestLikePath(lower)) return 12;
  if (/^(src|lib|app|cmd|internal|include)\//u.test(lower)) return 9;
  return 5;
}

function cppStructureReason(filePath: string, terms: Set<string>): string | undefined {
  if (!hasAnyTerm(terms, ["c", "cpp", "cplusplus", "cmake", "recompute", "execute", "execution", "build", "test"])) {
    return undefined;
  }
  const lower = filePath.toLowerCase();
  if (lower.endsWith("cmakelists.txt")) {
    return "Matched CMake build metadata for C/C++ routing.";
  }
  if (!/\.(?:c|cc|cpp|cxx|h|hh|hpp|hxx)$/u.test(lower)) {
    return undefined;
  }
  if (isTestLikePath(lower)) {
    return "Matched first-party C/C++ test routing evidence.";
  }
  if (/^(src|lib|app|cmd|internal|include)\//u.test(lower)) {
    return "Matched first-party C/C++ source routing evidence.";
  }
  return undefined;
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

function mcpServerStructureBoost(filePath: string, terms: Set<string>): number {
  const reason = mcpServerStructureReason(filePath, terms);
  if (reason === undefined) {
    return 0;
  }
  const lower = filePath.toLowerCase();
  if (mcpEvidenceReason(lower)?.includes("entrypoint")) return 18;
  if (mcpEvidenceReason(lower)?.includes("tool registry")) return 16;
  if (mcpEvidenceReason(lower)?.includes("documentation")) return 10;
  return 8;
}

function mcpServerStructureReason(filePath: string, terms: Set<string>): string | undefined {
  if (!hasAnyTerm(terms, ["mcp", "server", "stdio", "sse", "http", "streamable", "transport", "tools", "initialize", "inspector"])) {
    return undefined;
  }
  const reason = mcpEvidenceReason(filePath);
  if (reason !== undefined) {
    return reason;
  }
  if (isMcpServerEvidencePath(filePath)) {
    const shape = detectMcpServerShape([filePath]);
    if (shape.transports.length > 0) {
      return `MCP server transport evidence (${mcpTransportLabels(shape.transports).join(", ")}).`;
    }
    return "MCP server routing evidence.";
  }
  return undefined;
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

function isSamInfraTestPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.endsWith(".py") && (lower.startsWith("tests/infra/") || lower.startsWith("test/infra/") || lower.includes("/tests/infra/") || lower.includes("/test/infra/"));
}

function noisyArtifactPenalty(filePath: string): number {
  const lower = filePath.toLowerCase();
  if (/(^|\/)(vendor|third_party|thirdparty|3rdparty|external|extern)\//u.test(lower)) return 12;
  if (lower.startsWith("tests/fixtures/") || lower.includes("/fixtures/") || lower.includes("/fixture/")) return 12;
  if (lower.startsWith("generated/") || lower.includes("/installer/") || lower.includes("/generated/")) return 12;
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
  const authority = classifyMarkdownDoc({ path: filePath, title: titleFromPath(filePath) });
  let score = authority.priority;
  if (lower === "readme.md" || lower.endsWith("/readme.md")) {
    score += 2;
  }
  if (lower.includes("docs/") || lower.startsWith("docs/")) {
    score += 1;
  }
  return score;
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

function publicAuthority(input: ReturnType<typeof classifyMarkdownDoc>) {
  return {
    doc_status: input.doc_status,
    authority: input.authority,
    authority_caveat: input.authority_caveat
  };
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.map(normalizeRepoPath).filter((value) => value.length > 0)));
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
  if (language === "javascript" || language === "typescript") {
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
  if (language === "javascript" || language === "typescript") {
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

function isJsTsRequestPath(filePath: string): boolean {
  return /\.[cm]?[jt]sx?$/u.test(filePath.toLowerCase());
}

function sameTopLevelWorkspace(left: string, right: string): boolean {
  const leftParts = left.split("/");
  const rightParts = right.split("/");
  if (leftParts[0] === "apps" || leftParts[0] === "services" || leftParts[0] === "packages") {
    return leftParts[0] === rightParts[0] && leftParts[1] === rightParts[1];
  }
  return leftParts[0] === rightParts[0];
}
