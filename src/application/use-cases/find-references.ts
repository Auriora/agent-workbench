/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import type {
  EvidenceKind,
  FindReferencesRequest,
  FindReferencesResult,
  ReferenceAccounting,
  ReferenceCoverageReceipt,
  ReferenceCursorPayload,
  ReferenceHit,
  RuntimeError,
  ResponseMetadata
} from "../../contracts/index.js";
import type { FileCatalogEntry, GraphNode } from "../../domain/models/index.js";
import type {
  FileCatalogPort,
  GraphQueryPort,
  ReferenceCursorCodecPort,
  SnapshotPort,
  SnapshotPublicationPort,
  WorkspaceFilePort,
  WorkspaceSafetyPort
} from "../../ports/index.js";
import type { SnapshotValidityReceipt } from "../../domain/models/runtime.js";
import {
  blockedMeta,
  publicationSelectionMeta,
  resolveSnapshot,
  snapshotValidityMeta,
  validityForResolvedSnapshot
} from "./query-helpers.js";
import { capNextActions } from "./response-metadata.js";

export type FindReferencesUseCaseResult = {
  references: FindReferencesResult;
  meta: ResponseMetadata;
  errors?: RuntimeError[];
};

const DEFAULT_REFERENCE_LIMITS = {
  max_files: 100,
  max_declared_bytes: 1_000_000,
  max_file_bytes: 128_000,
  time_ms: 100
} as const;

export async function findReferences(input: {
  request: FindReferencesRequest;
  graph: GraphQueryPort;
  snapshots: SnapshotPort & SnapshotPublicationPort;
  catalog: FileCatalogPort;
  workspace?: WorkspaceFilePort;
  workspace_safety: WorkspaceSafetyPort;
  cursor_codec: ReferenceCursorCodecPort;
  reference_limits?: {
    max_files: number;
    max_declared_bytes: number;
    max_file_bytes: number;
    time_ms: number;
  };
  monotonic_now_ms?: () => number;
  snapshot_validity?: SnapshotValidityReceipt;
  selected_snapshot_id?: string | null;
  default_repo_root: string;
}): Promise<FindReferencesUseCaseResult> {
  const repoRoot = input.request.repo_root ?? input.default_repo_root;
  const resolved = input.selected_snapshot_id === null ? null : await resolveSnapshot({
    repo_root: repoRoot,
    snapshot_id: input.selected_snapshot_id ?? input.request.snapshot_id,
    snapshots: input.snapshots,
    catalog: input.catalog,
    row_limit: input.request.max_results,
    traversal_depth: input.request.max_depth
  });
  if (!resolved || resolved.status !== "selected") {
    const meta = blockedMeta({
      repo_root: repoRoot,
      row_limit: input.request.max_results,
      traversal_depth: input.request.max_depth
    });
    return {
      references: {
        repo_root: repoRoot,
        snapshot_id: input.request.snapshot_id ?? "",
        coverage_status: "legacy_unverified",
        references: [],
        result_count: 0,
        next_actions: capNextActions([])
      },
      meta: resolved === null ? meta : publicationSelectionMeta({ selection: resolved, meta })
    };
  }
  const snapshotValidity = validityForResolvedSnapshot(input.snapshot_validity, resolved.snapshot_id);
  if (snapshotValidity !== undefined && snapshotValidity.state !== "valid") {
    return {
      references: {
        repo_root: resolved.repo_root,
        snapshot_id: resolved.snapshot_id,
        coverage_status: "legacy_unverified",
        references: [],
        result_count: 0,
        next_actions: capReferenceNextActions([{
          tool: "read_resource",
          args: { uri: "repo:///status", repo_root: resolved.repo_root },
          reason: "Refresh or revalidate the repository snapshot before graph traversal."
        }], resolved.repo_root)
      },
      meta: snapshotValidityMeta({ meta: resolved.meta, validity: snapshotValidity })
    };
  }

  const target = input.request.node_id
    ? await input.graph.getNode({ snapshot_id: resolved.snapshot_id, node_id: input.request.node_id })
    : (await input.graph.findNodesByName({
        snapshot_id: resolved.snapshot_id,
        query: input.request.symbol ?? "",
        exact: true,
        max_rows: 2
      }))[0] ?? null;
  if (!target) {
    return {
      references: {
        repo_root: resolved.repo_root,
        snapshot_id: resolved.snapshot_id,
        coverage_status: "legacy_unverified",
        references: [],
        result_count: 0,
        next_actions: [{
          tool: "symbol_search",
          args: { query: input.request.symbol ?? input.request.node_id ?? "", repo_root: resolved.repo_root }
        }]
      },
      meta: resolved.meta
    };
  }

  return findEvidenceBackedReferences({
    ...input,
    target,
    repo_root: resolved.repo_root,
    snapshot_id: resolved.snapshot_id,
    base_meta: snapshotValidity === undefined
      ? snapshotValidityMeta({
          meta: resolved.meta,
          validity: {
            snapshot_id: resolved.snapshot_id,
            state: "degraded",
            complete: false,
            checked_path_count: 0,
            observed_path_count: 0,
            missing_paths: [],
            inaccessible_paths: [],
            refresh_required: false,
            reason: "Snapshot path-validity evidence was not supplied for this reference query."
          }
        })
      : resolved.meta,
    snapshot_validity_verified: snapshotValidity?.state === "valid" && snapshotValidity.complete
  });
}

type EvidenceBackedInput = {
  request: FindReferencesRequest;
  graph: GraphQueryPort;
  catalog: FileCatalogPort;
  workspace?: WorkspaceFilePort;
  workspace_safety: WorkspaceSafetyPort;
  cursor_codec: ReferenceCursorCodecPort;
  reference_limits?: {
    max_files: number;
    max_declared_bytes: number;
    max_file_bytes: number;
    time_ms: number;
  };
  monotonic_now_ms?: () => number;
  target: GraphNode;
  repo_root: string;
  snapshot_id: string;
  base_meta: ResponseMetadata;
  snapshot_validity_verified: boolean;
};

type ReferenceBounds = ReferenceCursorPayload["bounds"];

async function findEvidenceBackedReferences(input: EvidenceBackedInput): Promise<FindReferencesUseCaseResult> {
  const configuredLimits = input.reference_limits ?? DEFAULT_REFERENCE_LIMITS;
  const bounds: ReferenceBounds = {
    max_depth: input.request.max_depth,
    max_results: input.request.max_results,
    max_files: positiveBudget(configuredLimits.max_files),
    max_declared_bytes: positiveBudget(configuredLimits.max_declared_bytes),
    max_file_bytes: positiveBudget(configuredLimits.max_file_bytes),
    time_ms: positiveBudget(configuredLimits.time_ms)
  };
  const decoded = decodeAuthenticatedCursor(input.request.cursor, input.cursor_codec);
  if (!decoded.ok) {
    return invalidCursorResult(input, decoded.code);
  }
  if (decoded.payload !== undefined && !cursorIdentityMatches(decoded.payload, input, bounds)) {
    return invalidCursorResult(input, "invalid_cursor");
  }

  if (decoded.payload?.kind === "parser_composite") {
    return findParserPage(input, bounds, decoded.payload);
  }
  if (decoded.payload?.kind === "lexical_scan" || decoded.payload?.kind === "lexical_result") {
    return findLexicalPage(input, bounds, decoded.payload);
  }

  const parserProbe = await probeParserRoute(input, bounds.max_results);
  if (parserProbe !== undefined) {
    return findParserPage(input, bounds, undefined, parserProbe);
  }
  return findLexicalPage(input, bounds);
}

function decodeAuthenticatedCursor(
  cursor: string | undefined,
  codec: ReferenceCursorCodecPort
): { ok: true; payload?: ReferenceCursorPayload } | { ok: false; code: "invalid_cursor" | "cursor_expired" } {
  if (cursor === undefined) {
    return { ok: true };
  }
  const decoded = codec.decode(cursor);
  return decoded.ok ? { ok: true, payload: decoded.payload } : decoded;
}

function cursorIdentityMatches(
  payload: ReferenceCursorPayload,
  input: EvidenceBackedInput,
  bounds: ReferenceBounds
): boolean {
  return payload.snapshot_id === input.snapshot_id &&
    payload.target_node_id === input.target.id &&
    payload.target_name === input.target.name &&
    JSON.stringify(payload.bounds) === JSON.stringify(bounds);
}

function invalidCursorResult(
  input: EvidenceBackedInput,
  code: "invalid_cursor" | "cursor_expired"
): FindReferencesUseCaseResult {
  const message = code === "cursor_expired"
    ? "The reference continuation expired after the runtime cursor-key epoch changed."
    : "The reference continuation is malformed, tampered, or does not match this query.";
  return {
    references: {
      repo_root: input.repo_root,
      snapshot_id: input.snapshot_id,
      coverage_status: "legacy_unverified",
      references: [],
      result_count: 0,
      next_actions: []
    },
    meta: {
      ...input.base_meta,
      analysis_validity: "invalid",
      verification_status: "blocked",
      truncated: false
    },
    errors: [{ code, message, retryable: false }]
  };
}

type ParserOffsets = { outgoing: number; incoming: number; unresolved: number };
type ParserRoute = keyof ParserOffsets;
type ParserProbe = {
  route: ParserRoute;
  rows: ReferenceHit[];
  prior_exhaustion: { outgoing: boolean; incoming: boolean; unresolved: boolean };
};

async function probeParserRoute(input: EvidenceBackedInput, pageLimit: number): Promise<ParserProbe | undefined> {
  const exhaustion = { outgoing: false, incoming: false, unresolved: false };
  for (const route of ["outgoing", "incoming", "unresolved"] as const) {
    const rows = await loadParserRoute(input, route, 0, pageLimit);
    if (rows.length > 0) return { route, rows, prior_exhaustion: exhaustion };
    exhaustion[route] = true;
  }
  return undefined;
}

async function loadParserRoute(
  input: EvidenceBackedInput,
  route: ParserRoute,
  offset: number,
  pageLimit: number
): Promise<ReferenceHit[]> {
  if (route === "outgoing") {
    const rows = await input.graph.getReferences({
      snapshot_id: input.snapshot_id,
      node_id: input.target.id,
      max_depth: input.request.max_depth,
      max_rows: pageLimit + 1,
      offset
    });
    return rows.map((item) => ({
      source_node_id: item.source_node_id,
      target_node_id: item.target_node_id,
      target_file_path: item.target_file_path,
      reference_kind: "resolved",
      confidence: item.confidence,
      evidence_kinds: evidenceKindsForProvenance(item.provenance),
      provenance: item.provenance,
      status: "resolved"
    }));
  }
  if (route === "incoming") {
    const rows = await input.graph.getIncomingEdges({
      snapshot_id: input.snapshot_id,
      node_id: input.target.id,
      max_rows: pageLimit + 1,
      offset,
      exclude_source_node_id: input.target.id
    });
    return Promise.all(rows.map(async (edge) => {
      const source = await input.graph.getNode({ snapshot_id: input.snapshot_id, node_id: edge.source_node_id });
      return {
        source_node_id: edge.source_node_id,
        source_file_path: source?.file_path,
        source_range: edge.source_range,
        target_node_id: input.target.id,
        target_file_path: input.target.file_path,
        reference_name: String(edge.metadata.reference_name ?? input.target.name),
        reference_kind: edge.kind,
        confidence: edge.confidence,
        evidence_kinds: evidenceKindsForProvenance(edge.provenance),
        provenance: edge.provenance,
        status: "resolved" as const
      };
    }));
  }
  const rows = await input.graph.getUnresolvedReferences({
    snapshot_id: input.snapshot_id,
    max_rows: pageLimit + 1,
    offset,
    source_node_id: input.target.id,
    reference_name: input.target.name,
    qualified_reference_name: input.target.qualified_name
  });
  return rows.map((item) => ({
      source_node_id: item.source_node_id,
      source_file_path: item.source_file_path,
      source_range: item.source_range,
      reference_name: item.reference_name,
      reference_kind: item.reference_kind,
      confidence: item.candidate_metadata.resolution === "ambiguous" ? 0.4 : 0.35,
      evidence_kinds: ["parser", "heuristic"],
      provenance: "unresolved_reference",
      status: item.candidate_metadata.resolution === "ambiguous" ? "ambiguous" : "unresolved"
    }));
}

async function findParserPage(
  input: EvidenceBackedInput,
  bounds: ReferenceBounds,
  cursor?: Extract<ReferenceCursorPayload, { kind: "parser_composite" }>,
  probe?: ParserProbe
): Promise<FindReferencesUseCaseResult> {
  const offsets: ParserOffsets = cursor?.route_offsets ?? { outgoing: 0, incoming: 0, unresolved: 0 };
  const exhausted = cursor?.route_exhaustion ?? probe?.prior_exhaustion ?? { outgoing: false, incoming: false, unresolved: false };
  const references: ReferenceHit[] = [];
  const nextOffsets = { ...offsets };
  const nextExhausted = { ...exhausted };
  for (const route of ["outgoing", "incoming", "unresolved"] as const) {
    if (nextExhausted[route] || references.length >= bounds.max_results) continue;
    const available = probe?.route === route
      ? probe.rows
      : await loadParserRoute(input, route, nextOffsets[route], bounds.max_results - references.length);
    const taken = available.slice(0, bounds.max_results - references.length);
    references.push(...taken);
    nextOffsets[route] += taken.length;
    nextExhausted[route] = available.length <= taken.length;
    if (!nextExhausted[route]) break;
  }
  const allExhausted = nextExhausted.outgoing && nextExhausted.incoming && nextExhausted.unresolved;
  const matchedBefore = cursor?.combined_rows_returned ?? 0;
  const matchedSoFar = matchedBefore + references.length;
  const nextRoute = (["outgoing", "incoming", "unresolved"] as const)
    .find((route) => !nextExhausted[route]);
  const nextCursor = allExhausted || nextRoute === undefined ? undefined : input.cursor_codec.encode({
    version: 1,
    key_epoch: input.cursor_codec.key_epoch,
    snapshot_id: input.snapshot_id,
    target_node_id: input.target.id,
    target_name: input.target.name,
    bounds,
    kind: "parser_composite",
    current_route: nextRoute,
    route_offsets: nextOffsets,
    route_exhaustion: nextExhausted,
    combined_rows_returned: matchedSoFar
  });
  const coverage: ReferenceCoverageReceipt = {
    state: allExhausted ? "complete" : "partial",
    route: "parser",
    route_exhaustion: nextExhausted,
    page: emptyAccounting(references.length),
    sequence: emptyAccounting(matchedSoFar),
    searchable_candidates_classified: { page: 0, sequence: 0 },
    languages_inspected: [],
    page_matches: references.length,
    matched_so_far: matchedSoFar,
    complete_matches: allExhausted ? matchedSoFar : undefined,
    policy_exclusions: { page: [], sequence: [] },
    unresolved_searchable_candidates: { page: [], sequence: [] },
    stop_reason: allExhausted ? "route_exhausted" : "result",
    continuation_kind: nextCursor === undefined ? undefined : "parser_composite"
  };
  return evidenceResult(input, references, coverage, nextCursor);
}

type ReasonCount<T extends string> = { reason: T; count: number };
type CursorTotals = Extract<ReferenceCursorPayload, { kind: "lexical_scan" }>["totals"];

async function findLexicalPage(
  input: EvidenceBackedInput,
  bounds: ReferenceBounds,
  cursor?: Extract<ReferenceCursorPayload, { kind: "lexical_scan" | "lexical_result" }>
): Promise<FindReferencesUseCaseResult> {
  const now = input.monotonic_now_ms ?? (() => performance.now());
  const startedAt = now();
  const prior = cursor?.totals ?? emptyTotals();
  const page = emptyAccounting();
  const pagePolicy: ReasonCount<any>[] = [];
  const pageUnresolved: ReasonCount<any>[] = [];
  const pageLanguages = new Set<string>();
  const references: ReferenceHit[] = [];
  let afterPath = cursor?.after_path;
  let stopReason: ReferenceCoverageReceipt["stop_reason"] = "catalog_exhausted";
  let catalogExhausted = false;
  let continuation: ReferenceCursorPayload | undefined;

  if (cursor?.kind === "lexical_result") {
    const replay = await replayResultFile(input, bounds, cursor, references.length);
    if (replay.failure !== undefined) {
      replay.accounting.elapsed_admission_ms = Math.max(0, Math.trunc(now() - startedAt));
      return failedResultReplay(input, cursor, replay, replay.failure);
    }
    addAccounting(page, replay.accounting);
    replay.languages.forEach((language) => pageLanguages.add(language));
    references.push(...replay.references);
    if (replay.next_ordinal !== undefined) {
      continuation = { ...cursor, next_occurrence_ordinal: replay.next_ordinal };
      stopReason = "result";
    }
  }

  const pageSize = Math.min(100, Math.max(10, bounds.max_files + 1));
  while (continuation === undefined && references.length < bounds.max_results) {
    const files = await input.catalog.listFiles({
      snapshot_id: input.snapshot_id,
      after_path: normalizeAfterPath(afterPath),
      max_rows: pageSize
    });
    if (files.length === 0) {
      catalogExhausted = true;
      break;
    }
    let processed = 0;
    for (const file of files) {
      if (references.length >= bounds.max_results) break;
      if (now() - startedAt >= bounds.time_ms) {
        stopReason = "time";
        break;
      }
      const classification = classifyCatalogEntry(file) ?? classifyLiveWorkspacePolicy(input, file.path);
      if (classification?.kind === "policy_exclusion") {
        incrementReason(pagePolicy, classification.reason);
        afterPath = file.path;
        processed += 1;
        continue;
      }
      if (classification?.kind === "unresolved") {
        incrementReason(pageUnresolved, classification.reason);
        afterPath = file.path;
        processed += 1;
        continue;
      }
      if (file.file_identity.size_bytes > bounds.max_file_bytes ||
          file.file_identity.size_bytes > bounds.max_declared_bytes) {
        incrementReason(pageUnresolved, "oversized");
        afterPath = file.path;
        processed += 1;
        continue;
      }
      if (page.file_read_attempts >= bounds.max_files) {
        stopReason = "file";
        break;
      }
      if (page.declared_bytes_admitted + file.file_identity.size_bytes > bounds.max_declared_bytes) {
        stopReason = "byte";
        break;
      }
      if (now() - startedAt >= bounds.time_ms) {
        stopReason = "time";
        break;
      }
      const inspected = await inspectFile(input, file);
      page.file_read_attempts += inspected.attempted ? 1 : 0;
      page.declared_bytes_admitted += inspected.attempted ? file.file_identity.size_bytes : 0;
      page.actual_bytes_observed += inspected.actual_bytes;
      afterPath = file.path;
      processed += 1;
      if (inspected.failure !== undefined) {
        incrementReason(pageUnresolved, inspected.failure);
        continue;
      }
      page.unique_files_inspected += 1;
      pageLanguages.add(file.file_identity.language);
      const remaining = bounds.max_results - references.length;
      references.push(...inspected.references.slice(0, remaining));
      if (inspected.references.length > remaining) {
        continuation = lexicalResultCursor(input, bounds, afterPath, file, remaining + 1, prior, page,
          pagePolicy, pageUnresolved, pageLanguages, references.length);
        stopReason = "result";
        break;
      }
      if (now() - startedAt >= bounds.time_ms) {
        stopReason = "time";
        break;
      }
    }
    if (continuation !== undefined || stopReason !== "catalog_exhausted") break;
    if (processed < files.length) break;
    if (files.length < pageSize) {
      catalogExhausted = true;
      break;
    }
  }

  page.elapsed_admission_ms = Math.max(0, Math.trunc(now() - startedAt));
  page.occurrences = references.length;
  const sequence = sumAccounting(prior.accounting, page);
  const sequencePolicy = mergeReasons(prior.policy_exclusions, pagePolicy);
  const sequenceUnresolved = mergeReasons(prior.unresolved_searchable_candidates, pageUnresolved);
  const languages = [...new Set([...prior.languages_inspected, ...pageLanguages])].sort();
  const classifiedPage = page.unique_files_inspected + countReasons(pageUnresolved);
  const classifiedSequence = prior.searchable_candidates_classified + classifiedPage;
  const matchedSoFar = prior.matched_so_far + references.length;

  if (continuation === undefined && !catalogExhausted) {
    if (stopReason === "catalog_exhausted") stopReason = "result";
    continuation = {
      version: 1,
      key_epoch: input.cursor_codec.key_epoch,
      snapshot_id: input.snapshot_id,
      target_node_id: input.target.id,
      target_name: input.target.name,
      bounds,
      kind: "lexical_scan",
      after_path: afterPath ?? "\u0000",
      totals: { accounting: sequence, matched_so_far: matchedSoFar,
        searchable_candidates_classified: classifiedSequence, policy_exclusions: sequencePolicy,
        unresolved_searchable_candidates: sequenceUnresolved, languages_inspected: languages }
    };
  }
  if (continuation?.kind === "lexical_result") {
    continuation = {
      ...continuation,
      totals: { accounting: sequence, matched_so_far: matchedSoFar,
        searchable_candidates_classified: classifiedSequence, policy_exclusions: sequencePolicy,
        unresolved_searchable_candidates: sequenceUnresolved, languages_inspected: languages }
    };
  }
  const unresolvedCount = countReasons(sequenceUnresolved);
  const complete = catalogExhausted && continuation === undefined && unresolvedCount === 0;
  const coverage: ReferenceCoverageReceipt = {
    state: complete ? "complete" : "partial",
    route: "lexical",
    catalog_exhausted: catalogExhausted,
    page,
    sequence,
    searchable_candidates_classified: { page: classifiedPage, sequence: classifiedSequence },
    languages_inspected: languages,
    page_matches: references.length,
    matched_so_far: matchedSoFar,
    complete_matches: complete ? matchedSoFar : undefined,
    policy_exclusions: { page: pagePolicy, sequence: sequencePolicy },
    unresolved_searchable_candidates: { page: pageUnresolved, sequence: sequenceUnresolved },
    stop_reason: complete ? "catalog_exhausted" : stopReason,
    continuation_kind: continuation?.kind
  };
  return evidenceResult(input, references, coverage,
    continuation === undefined ? undefined : input.cursor_codec.encode(continuation));
}

async function inspectFile(input: EvidenceBackedInput, file: FileCatalogEntry): Promise<{
  attempted: boolean;
  actual_bytes: number;
  failure?: "missing" | "changed" | "read_failure";
  references: ReferenceHit[];
}> {
  if (input.workspace === undefined) return { attempted: false, actual_bytes: 0, failure: "read_failure", references: [] };
  let stat: { exists: boolean; is_file: boolean; size_bytes: number; mtime_ms: number };
  try {
    stat = await input.workspace.stat({ path: file.path });
  } catch {
    return { attempted: false, actual_bytes: 0, failure: "read_failure", references: [] };
  }
  if (!stat.exists || !stat.is_file) return { attempted: false, actual_bytes: 0, failure: "missing", references: [] };
  let text: string;
  try {
    text = await input.workspace.readText({ path: file.path });
  } catch {
    return { attempted: true, actual_bytes: 0, failure: "read_failure", references: [] };
  }
  const actualBytes = Buffer.byteLength(text, "utf8");
  if (!fileIdentityMatches(file, text, stat)) {
    return { attempted: true, actual_bytes: actualBytes, failure: "changed", references: [] };
  }
  return { attempted: true, actual_bytes: actualBytes, references: lexicalOccurrences(input.target, file.path, text) };
}

async function replayResultFile(
  input: EvidenceBackedInput,
  bounds: ReferenceBounds,
  cursor: Extract<ReferenceCursorPayload, { kind: "lexical_result" }>,
  alreadyReturned: number
) {
  const file = await input.catalog.getFile({ snapshot_id: input.snapshot_id, path: cursor.result_path });
  if (file === null) {
    return { accounting: { ...emptyAccounting(), occurrences: 0 }, languages: [] as string[], references: [] as ReferenceHit[], failure: "missing" as const };
  }
  if (file.file_identity.content_hash !== cursor.result_file_identity.content_hash ||
      file.file_identity.size_bytes !== cursor.result_file_identity.size_bytes ||
      file.file_identity.language !== cursor.result_file_identity.language) {
    return { accounting: { ...emptyAccounting(), occurrences: 0 }, languages: [] as string[], references: [] as ReferenceHit[], failure: "changed" as const };
  }
  const inspected = await inspectFile(input, file);
  const start = cursor.next_occurrence_ordinal - 1;
  const capacity = bounds.max_results - alreadyReturned;
  const refs = inspected.references.slice(start, start + capacity);
  const next = start + refs.length < inspected.references.length ? start + refs.length + 1 : undefined;
  return {
    accounting: {
      unique_files_inspected: 0,
      file_read_attempts: inspected.attempted ? 1 : 0,
      replay_reads: inspected.attempted ? 1 : 0,
      declared_bytes_admitted: inspected.attempted ? file.file_identity.size_bytes : 0,
      actual_bytes_observed: inspected.actual_bytes,
      elapsed_admission_ms: 0,
      occurrences: refs.length
    },
    languages: inspected.failure === undefined ? [file.file_identity.language] : [],
    references: refs,
    failure: inspected.failure,
    next_ordinal: next
  };
}

function failedResultReplay(
  input: EvidenceBackedInput,
  cursor: Extract<ReferenceCursorPayload, { kind: "lexical_result" }>,
  replay: Awaited<ReturnType<typeof replayResultFile>>,
  failure: "missing" | "changed" | "read_failure"
): FindReferencesUseCaseResult {
  const pageUnresolved = [{ reason: failure, count: 1 }];
  const sequenceUnresolved = mergeReasons(cursor.totals.unresolved_searchable_candidates, pageUnresolved);
  const sequence = sumAccounting(cursor.totals.accounting, replay.accounting);
  const coverage: ReferenceCoverageReceipt = {
    state: "partial",
    route: "lexical",
    catalog_exhausted: false,
    page: replay.accounting,
    sequence,
    searchable_candidates_classified: {
      page: 1,
      sequence: cursor.totals.searchable_candidates_classified + 1
    },
    languages_inspected: [...cursor.totals.languages_inspected],
    page_matches: 0,
    matched_so_far: cursor.totals.matched_so_far,
    policy_exclusions: {
      page: [],
      sequence: [...cursor.totals.policy_exclusions]
    },
    unresolved_searchable_candidates: {
      page: pageUnresolved,
      sequence: sequenceUnresolved
    },
    stop_reason: failure
  };
  return evidenceResult(input, [], coverage);
}

function lexicalResultCursor(
  input: EvidenceBackedInput,
  bounds: ReferenceBounds,
  afterPath: string,
  file: FileCatalogEntry,
  nextOrdinal: number,
  prior: CursorTotals,
  page: ReferenceAccounting,
  pagePolicy: ReasonCount<any>[],
  pageUnresolved: ReasonCount<any>[],
  languages: Set<string>,
  pageMatches: number
): Extract<ReferenceCursorPayload, { kind: "lexical_result" }> {
  const accounting = sumAccounting(prior.accounting, { ...page, occurrences: pageMatches });
  return {
    version: 1,
    key_epoch: input.cursor_codec.key_epoch,
    snapshot_id: input.snapshot_id,
    target_node_id: input.target.id,
    target_name: input.target.name,
    bounds,
    kind: "lexical_result",
    after_path: afterPath,
    result_path: file.path,
    result_file_identity: {
      content_hash: file.file_identity.content_hash,
      size_bytes: file.file_identity.size_bytes,
      language: file.file_identity.language
    },
    next_occurrence_ordinal: nextOrdinal,
    totals: {
      accounting,
      matched_so_far: prior.matched_so_far + pageMatches,
      searchable_candidates_classified: prior.searchable_candidates_classified + page.unique_files_inspected + countReasons(pageUnresolved),
      policy_exclusions: mergeReasons(prior.policy_exclusions, pagePolicy),
      unresolved_searchable_candidates: mergeReasons(prior.unresolved_searchable_candidates, pageUnresolved),
      languages_inspected: [...new Set([...prior.languages_inspected, ...languages])].sort()
    }
  };
}

function evidenceResult(
  input: EvidenceBackedInput,
  references: ReferenceHit[],
  coverage: ReferenceCoverageReceipt,
  cursor?: string
): FindReferencesUseCaseResult {
  const effectiveCoverage = coverage.state === "complete" && !input.snapshot_validity_verified
    ? withoutCompleteMatch(coverage)
    : coverage;
  const complete = effectiveCoverage.state === "complete";
  const staleWorkspaceEvidence = effectiveCoverage.unresolved_searchable_candidates.sequence.some(
    ({ reason }) => reason === "missing" || reason === "changed"
  );
  const blockedWithoutEvidence = !complete && cursor === undefined && references.length === 0 &&
    (effectiveCoverage.unresolved_searchable_candidates.sequence.length > 0 || !input.snapshot_validity_verified);
  const nextActions = blockedWithoutEvidence
    ? [{
        tool: "read_resource",
        args: { uri: "repo:///status", repo_root: input.repo_root },
        reason: "Resolve or refresh the blocked snapshot and workspace evidence before continuing reference analysis."
      }]
    : [
        ...(cursor === undefined ? [] : [{
          tool: "find_references",
          args: {
            node_id: input.target.id,
            snapshot_id: input.snapshot_id,
            repo_root: input.repo_root,
            max_depth: input.request.max_depth,
            max_results: input.request.max_results,
            cursor
          },
          reason: "Continue the authenticated bounded reference query."
        }]),
        {
          tool: "impact",
          args: { node_id: input.target.id, snapshot_id: input.snapshot_id, repo_root: input.repo_root }
        }
      ];
  return {
    references: {
      repo_root: input.repo_root,
      snapshot_id: input.snapshot_id,
      coverage_status: "evidence_backed",
      target: {
        node_id: input.target.id,
        kind: input.target.kind,
        name: input.target.name,
        qualified_name: input.target.qualified_name,
        path: input.target.file_path,
        language: input.target.language,
        source_range: input.target.source_range,
        capability_level: "partial_semantic",
        evidence_kinds: ["parser"]
      },
      references,
      cursor,
      result_count: effectiveCoverage.complete_matches ?? effectiveCoverage.matched_so_far,
      coverage: effectiveCoverage,
      next_actions: capReferenceNextActions(nextActions, input.repo_root)
    },
    meta: {
      ...input.base_meta,
      freshness: staleWorkspaceEvidence ? "stale" : input.base_meta.freshness,
      analysis_validity: complete ? "valid" : "partial",
      verification_status: complete
        ? "done"
        : blockedWithoutEvidence || staleWorkspaceEvidence || input.base_meta.verification_status === "blocked"
          ? "blocked"
          : "needed",
      truncated: !complete,
      reference_coverage: effectiveCoverage
    }
  };
}

function withoutCompleteMatch(coverage: ReferenceCoverageReceipt): ReferenceCoverageReceipt {
  const { complete_matches: _completeMatches, ...partial } = coverage;
  return { ...partial, state: "partial" };
}

function capReferenceNextActions(
  actions: Parameters<typeof capNextActions>[0],
  repoRoot: string
): ReturnType<typeof capNextActions> {
  return capNextActions(actions).map((action) => ({
    ...action,
    args: { ...action.args, repo_root: repoRoot }
  }));
}

function fileIdentityMatches(
  file: FileCatalogEntry,
  text: string,
  stat: { size_bytes: number; mtime_ms: number }
): boolean {
  if (stat.size_bytes !== file.file_identity.size_bytes || Buffer.byteLength(text, "utf8") !== file.file_identity.size_bytes) {
    return false;
  }
  if (file.file_identity.content_hash.startsWith("sha256:")) {
    const observed = `sha256:${createHash("sha256").update(text).digest("hex")}`;
    return observed === file.file_identity.content_hash;
  }
  if (file.file_identity.content_hash.startsWith("stat:")) {
    return `stat:${stat.size_bytes}:${Math.trunc(stat.mtime_ms)}` === file.file_identity.content_hash;
  }
  return false;
}

function lexicalOccurrences(target: GraphNode, filePath: string, text: string): ReferenceHit[] {
  const pattern = new RegExp(`(^|[^A-Za-z0-9_])(${escapeRegExp(target.name)})(?=[^A-Za-z0-9_]|$)`, "gu");
  const hits: ReferenceHit[] = [];
  for (const [lineIndex, line] of text.split(/\r?\n/u).entries()) {
    pattern.lastIndex = 0;
    for (const match of line.matchAll(pattern)) {
      const column = (match.index ?? 0) + (match[1]?.length ?? 0);
      hits.push({
        source_file_path: filePath,
        source_range: { start_line: lineIndex + 1, start_column: column, end_line: lineIndex + 1, end_column: column + target.name.length },
        target_node_id: target.id,
        target_file_path: target.file_path,
        reference_name: target.name,
        reference_kind: "lexical",
        confidence: 0.2,
        evidence_kinds: ["text_fallback", "heuristic"],
        provenance: "bounded_lexical_identifier_scan",
        status: "unresolved"
      });
    }
  }
  return hits;
}

type CatalogEntryClassification =
  | { kind: "policy_exclusion"; reason: "generated_or_vendor" | "secret" | "configured_skip" | "unsafe_path" | "unsupported_language" }
  | { kind: "unresolved"; reason: "read_failure" };

function classifyCatalogEntry(file: FileCatalogEntry): CatalogEntryClassification | undefined {
  if (file.skipped_reason !== undefined) {
    const reason = normalizePolicyReason(file.skipped_reason);
    return reason === undefined
      ? { kind: "unresolved", reason: "read_failure" }
      : { kind: "policy_exclusion", reason };
  }
  if (!file.indexed) return { kind: "policy_exclusion", reason: "configured_skip" };
  if (!["python", "typescript", "javascript", "markdown", "text"].includes(file.file_identity.language)) {
    return { kind: "policy_exclusion", reason: "unsupported_language" };
  }
  return undefined;
}

function classifyLiveWorkspacePolicy(
  input: Pick<EvidenceBackedInput, "workspace_safety">,
  filePath: string
): CatalogEntryClassification | undefined {
  try {
    const decision = input.workspace_safety.resolveWorkspacePath(filePath);
    if (!decision.allowed) {
      return { kind: "policy_exclusion", reason: "unsafe_path" };
    }
    return decision.readOnly
      ? { kind: "policy_exclusion", reason: "configured_skip" }
      : undefined;
  } catch {
    return { kind: "policy_exclusion", reason: "unsafe_path" };
  }
}

function normalizePolicyReason(reason: string): Extract<CatalogEntryClassification, { kind: "policy_exclusion" }>["reason"] | undefined {
  if (reason === "generated_or_vendor" || reason === "secret" || reason === "configured_skip" ||
      reason === "unsafe_path" || reason === "unsupported_language") return reason;
  if (reason === "workspace_escape") return "unsafe_path";
  return undefined;
}

function emptyAccounting(occurrences = 0): ReferenceAccounting {
  return { unique_files_inspected: 0, file_read_attempts: 0, replay_reads: 0,
    declared_bytes_admitted: 0, actual_bytes_observed: 0, elapsed_admission_ms: 0, occurrences };
}

function emptyTotals(): CursorTotals {
  return { accounting: emptyAccounting(), matched_so_far: 0, searchable_candidates_classified: 0,
    policy_exclusions: [], unresolved_searchable_candidates: [], languages_inspected: [] };
}

function addAccounting(target: ReferenceAccounting, addition: ReferenceAccounting): void {
  for (const key of Object.keys(target) as (keyof ReferenceAccounting)[]) target[key] += addition[key];
}

function sumAccounting(left: ReferenceAccounting, right: ReferenceAccounting): ReferenceAccounting {
  const result = { ...left };
  addAccounting(result, right);
  return result;
}

function incrementReason(entries: ReasonCount<any>[], reason: string): void {
  const existing = entries.find((entry) => entry.reason === reason);
  if (existing === undefined) entries.push({ reason, count: 1 });
  else existing.count += 1;
}

function mergeReasons<T extends string>(left: readonly ReasonCount<T>[], right: readonly ReasonCount<T>[]): ReasonCount<T>[] {
  const result = left.map((entry) => ({ ...entry }));
  for (const entry of right) {
    const existing = result.find((candidate) => candidate.reason === entry.reason);
    if (existing === undefined) result.push({ ...entry });
    else existing.count += entry.count;
  }
  return result;
}

function countReasons(entries: readonly ReasonCount<any>[]): number {
  return entries.reduce((total, entry) => total + entry.count, 0);
}

function normalizeAfterPath(afterPath: string | undefined): string | undefined {
  return afterPath === "\u0000" ? undefined : afterPath;
}

function positiveBudget(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1;
}

function evidenceKindsForProvenance(provenance: string): EvidenceKind[] {
  return provenance.includes("cloudformation")
    ? ["config", "infra_parser"]
    : ["parser"];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
