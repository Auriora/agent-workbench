/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  DocumentReference,
  DocsDocument,
  DocsCurrentForTaskResult,
  DocsHeading,
  DocsLink,
  DocsMap,
  DocsOutlineResult,
  DocsOverview,
  DocsReadSectionResult,
  DocsSearchHit,
  DocsSearchResult,
  DocsWarning,
  RankedDocsSearchHit,
  RankedDocsSearchResult,
  ResponseEnvelope,
  ResponseMetadata
} from "../contracts/index.js";
import {
  documentReferenceSchema,
  docsDocumentSchema,
  docsCurrentForTaskResultSchema,
  docsHeadingSchema,
  docsLinkSchema,
  docsMapSchema,
  docsMapDocumentSchema,
  docsOutlineResultSchema,
  docsOverviewSchema,
  docsReadSectionResultSchema,
  docsSearchHitSchema,
  docsSearchResultSchema,
  rankedDocsSearchHitSchema,
  rankedDocsSearchResultSchema,
  docsWarningSchema,
  nextActionSchema,
  responseMetadataSchema,
  sourceSectionSchema
} from "../contracts/index.js";
import type {
  DocsMapUseCaseResult,
  DocsOutlineUseCaseResult,
  DocsOverviewUseCaseResult,
  DocsReadSectionUseCaseResult,
  DocsSearchUseCaseResult
} from "../application/use-cases/query-docs.js";
import type { RankedDocsSearchUseCaseResult } from "../application/use-cases/query-docs.js";
import { mergeDocumentationRankingTrust } from "../application/use-cases/documentation-ranking-readiness.js";
import type { CurrentDocsForTaskUseCaseResult } from "../application/use-cases/current-docs-for-task.js";
import {
  buildResponseMeta,
  invalidResponseMeta,
  makeTrustedEnvelope,
  presentNextActions,
  type PresentationSessionContext
} from "../application/use-cases/response-metadata.js";
import {
  redactPresentationText,
  sanitizePublicMcpFailureMessage
} from "./redaction.js";

const DOCS_MAP_DIRECT_READ_CAVEAT = "Docs search is routing evidence; use docs_read_section for precise claims.";
const DOCS_MAP_MAX_SERIALIZED_BYTES = 32_768;
const DOCS_MAP_CURSOR_KIND = "docs";

export function buildDocsOverviewEnvelope(
  result: DocsOverviewUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<DocsOverview> {
  return makeTrustedEnvelope({
    data: sanitizeDocsOverview(result.overview, context),
    meta: responseMetadataSchema.strip().parse(result.meta),
    trust_policy: { surface_kind: "docs_routing" }
  });
}

export function buildDocsMapEnvelope(
  result: DocsMapUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<DocsMap> {
  const sanitized = sanitizeDocsMap(result.map, context);
  const meta = responseMetadataSchema.strip().parse(result.meta);
  return boundDocsMapEnvelope({
    data: sanitized,
    meta,
    presentation: result.presentation
  });
}

export function buildDocsSearchEnvelope(
  result: DocsSearchUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<DocsSearchResult> {
  return makeTrustedEnvelope({
    data: sanitizeDocsSearch(result.search, context),
    meta: responseMetadataSchema.strip().parse(result.meta),
    trust_policy: { surface_kind: "docs_routing" }
  });
}

export function buildRankedDocsSearchEnvelope(
  result: RankedDocsSearchResult | RankedDocsSearchUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<RankedDocsSearchResult> {
  const readiness = "documentation_ranking_readiness" in result
    ? result.documentation_ranking_readiness
    : undefined;
  const { documentation_ranking_readiness: _readiness, ...publicResult } = result as RankedDocsSearchUseCaseResult;
  const data = sanitizeRankedDocsSearch(publicResult as RankedDocsSearchResult, context);
  const coverageState = "counts" in data
    ? data.counts.priority_scan_coverage_state ?? data.docs_index_state ?? "unknown"
    : "unknown";
  const blocked = data.status === "blocked";
  const environmentBlocked = data.trust_state === "blocked_ranking_environment_unavailable";
  const countReceipt = "counts" in data ? data.counts : undefined;
  const meta = {
    ...buildResponseMeta({
      analysis_validity: environmentBlocked
        ? "invalid_due_to_environment"
        : blocked ? "invalid" : coverageState === "complete" ? "valid" : "partial",
      freshness: data.trust_state === "blocked_cursor_stale"
        ? "stale"
        : data.trust_state === "blocked_ranking_unavailable" ||
            environmentBlocked ||
            data.trust_state === "blocked_snapshot_unavailable"
          ? "unknown"
          : "fresh",
      scope: {
        repo_root: data.repo_root,
        indexed_roots: ["."],
        skipped_roots: [],
        languages: ["markdown"]
      },
      capability_level: blocked ? "unsupported" : "resource_backed",
      evidence_kinds: blocked ? [] : ["docs", "fts"],
      verification_status: blocked ? "blocked" : data.status,
      truncated: data.truncated,
      budget: { row_limit: 500 }
    }),
    ...(countReceipt === undefined ? {} : {
      index_coverage: [{
        evidence_class: "docs" as const,
        state: coverageState,
        indexed_files: countReceipt.priority_scan_indexed_markdown_files_count,
        eligible_files_seen: countReceipt.priority_scan_eligible_markdown_files_count,
        documentation_corpus_policy_version: countReceipt.documentation_corpus_policy_version,
        policy_excluded_files: countReceipt.policy_excluded_files,
        policy_exclusions: countReceipt.policy_exclusions,
        scan_truncated: countReceipt.priority_scan_truncated,
        indexed_roots: ["AGENTS.md", "README.md", "docs", "doc", "documentation"],
        reason: countReceipt.priority_scan_coverage_note
      }]
    })
  };
  return makeTrustedEnvelope({
    data,
    meta: readiness === undefined ? meta : mergeDocumentationRankingTrust(meta, readiness),
    trust_policy: { surface_kind: "docs_routing" }
  });
}

export function buildDocsCurrentForTaskEnvelope(
  result: CurrentDocsForTaskUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<DocsCurrentForTaskResult> {
  return makeTrustedEnvelope({
    data: sanitizeDocsCurrentForTask(result.current_docs, context),
    meta: responseMetadataSchema.strip().parse(result.meta),
    trust_policy: { surface_kind: "docs_routing" }
  });
}

export function buildInvalidDocsCurrentForTaskInputEnvelope(input: {
  repoRoot: string;
  task?: string;
  message: string;
}): ResponseEnvelope<DocsCurrentForTaskResult> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      task: input.task ?? "",
      status: "blocked",
      documentation_corpus: {
        policy_version: "production-docs-v1",
        discovered_markdown_files: 0,
        eligible_markdown_files: 0,
        excluded_markdown_files: 0,
        exclusions: []
      },
      canonical_docs: [],
      supporting_docs: [],
      non_authoritative_docs: [],
      unknown_docs: [],
      warnings: [],
      next_actions: []
    },
    meta: invalidResponseMeta({ repoRoot: input.repoRoot }),
    trust_policy: { surface_kind: "docs_routing" },
    errors: [invalidInputError(input.message)]
  });
}

export function buildDocsOutlineEnvelope(
  result: DocsOutlineUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<DocsOutlineResult> {
  return makeTrustedEnvelope({
    data: sanitizeDocsOutline(result.outline, context),
    meta: responseMetadataSchema.strip().parse(result.meta),
    trust_policy: { surface_kind: "docs_routing" }
  });
}

export function buildDocsReadSectionEnvelope(
  result: DocsReadSectionUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<DocsReadSectionResult> {
  return makeTrustedEnvelope({
    data: sanitizeDocsReadSection(result.read, context),
    meta: responseMetadataSchema.strip().parse(result.meta),
    trust_policy: { surface_kind: "docs_direct_read", includes_direct_read: true }
  });
}

export function buildInvalidDocsOverviewInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<DocsOverview> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      status: "blocked",
      summary: "Docs overview input was invalid.",
      important_docs: [],
      warnings: [],
      truncated: false,
      next_actions: []
    },
    meta: invalidResponseMeta({ repoRoot: input.repoRoot }),
    trust_policy: { surface_kind: "docs_routing" },
    errors: [invalidInputError(input.message)]
  });
}

export function buildDocsOverviewProviderFailureEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<DocsOverview> {
  const message = sanitizePublicMcpFailureMessage(
    input.message,
    "Documentation overview is unavailable; inspect the error code and retry guidance."
  );
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      status: "blocked",
      summary: message,
      important_docs: [],
      warnings: [],
      truncated: false,
      next_actions: []
    },
    meta: invalidResponseMeta({
      repoRoot: input.repoRoot,
      analysis_validity: "invalid_due_to_environment"
    }),
    trust_policy: { surface_kind: "docs_routing" },
    errors: [providerUnavailableError(message)]
  });
}

export function buildInvalidDocsMapInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<DocsMap> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      status: "blocked",
      direct_read_caveat: DOCS_MAP_DIRECT_READ_CAVEAT,
      docs: [],
      warnings: [],
      warning_count: 0,
      warning_samples_truncated: false,
      truncated: false,
      next_actions: []
    },
    meta: invalidResponseMeta({ repoRoot: input.repoRoot }),
    trust_policy: { surface_kind: "docs_routing" },
    errors: [invalidInputError(input.message)]
  });
}

export function buildDocsMapProviderFailureEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<DocsMap> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      status: "blocked",
      direct_read_caveat: DOCS_MAP_DIRECT_READ_CAVEAT,
      docs: [],
      warnings: [],
      warning_count: 0,
      warning_samples_truncated: false,
      truncated: false,
      next_actions: []
    },
    meta: invalidResponseMeta({
      repoRoot: input.repoRoot,
      analysis_validity: "invalid_due_to_environment"
    }),
    trust_policy: { surface_kind: "docs_routing" },
    errors: [providerUnavailableError(input.message)]
  });
}

export function buildInvalidDocsSearchInputEnvelope(input: {
  repoRoot: string;
  query?: string;
  message: string;
}): ResponseEnvelope<DocsSearchResult> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      query: input.query ?? "",
      status: "blocked",
      hits: [],
      warnings: [],
      truncated: false,
      next_actions: []
    },
    meta: invalidResponseMeta({ repoRoot: input.repoRoot }),
    trust_policy: { surface_kind: "docs_routing" },
    errors: [invalidInputError(input.message)]
  });
}

export function buildInvalidDocsOutlineInputEnvelope(input: {
  repoRoot: string;
  path?: string;
  message: string;
}): ResponseEnvelope<DocsOutlineResult> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      path: input.path ?? "",
      status: "blocked",
      title: "",
      headings: [],
      warnings: [],
      next_actions: []
    },
    meta: invalidResponseMeta({ repoRoot: input.repoRoot }),
    trust_policy: { surface_kind: "docs_routing" },
    errors: [invalidInputError(input.message)]
  });
}

export function buildInvalidDocsReadSectionInputEnvelope(input: {
  repoRoot: string;
  path?: string;
  headingId?: string;
  message: string;
}): ResponseEnvelope<DocsReadSectionResult> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      path: input.path ?? "",
      heading_id: input.headingId ?? "",
      status: "blocked",
      warnings: [],
      next_actions: []
    },
    meta: invalidResponseMeta({ repoRoot: input.repoRoot }),
    trust_policy: { surface_kind: "docs_direct_read", includes_direct_read: true },
    errors: [invalidInputError(input.message)]
  });
}

function sanitizeDocsOverview(
  input: DocsOverview,
  context: PresentationSessionContext
): DocsOverview {
  return docsOverviewSchema.parse({
    repo_root: input.repo_root,
    status: input.status,
    summary: input.summary,
    important_docs: input.important_docs.map(sanitizeDocument),
    warnings: sortWarnings(input.warnings).map(sanitizeWarning),
    truncated: input.truncated,
    cursor: input.cursor,
    result_count: input.result_count,
    next_actions: presentNextActions(input.next_actions, context).map((action) => nextActionSchema.parse(action))
  });
}

function sanitizeDocsMap(
  input: DocsMap,
  context: PresentationSessionContext
): DocsMap {
  return docsMapSchema.parse({
    repo_root: input.repo_root,
    status: input.status,
    direct_read_caveat: redactPresentationText(input.direct_read_caveat),
    docs: input.docs.map((document) =>
      docsMapDocumentSchema.parse({
        path: normalizeRepoPath(document.path),
        title: redactPresentationText(document.title),
        headings: [...document.headings]
          .sort((left, right) => left.id.localeCompare(right.id))
          .map((heading) => ({
            id: redactPresentationText(heading.id),
            id_truncated: heading.id_truncated,
            text: redactPresentationText(heading.text),
            text_truncated: heading.text_truncated
          })),
        title_truncated: document.title_truncated,
        heading_sample_count: document.heading_sample_count,
        heading_samples_truncated: document.heading_samples_truncated,
        total_heading_count: document.total_heading_count,
        total_link_count: document.total_link_count,
        doc_status: document.doc_status,
        authority: document.authority,
        currency_state: document.currency_state,
        canonical_owner: document.canonical_owner === undefined
          ? undefined
          : normalizeRepoPath(document.canonical_owner),
        superseded_by: document.superseded_by === undefined
          ? undefined
          : normalizeRepoPath(document.superseded_by)
      })
    ),
    warnings: sortWarnings(input.warnings).map(sanitizeWarning),
    warning_count: input.warning_count,
    warning_samples_truncated: input.warning_samples_truncated,
    truncated: input.truncated,
    cursor: input.cursor,
    result_count: input.result_count,
    blocker: input.blocker,
    blocking_message: input.blocking_message === undefined
      ? undefined
      : redactPresentationText(input.blocking_message, { context: "message" }),
    next_actions: presentNextActions(input.next_actions, context).map((action) => nextActionSchema.parse(action))
  });
}

function boundDocsMapEnvelope(input: {
  data: DocsMap;
  meta: ResponseMetadata;
  presentation?: DocsMapUseCaseResult["presentation"];
}): ResponseEnvelope<DocsMap> {
  const docs = input.data.docs;
  const warnings = input.data.warnings;
  const docsPage = packDocsMapEntries({
    docs,
    warnings,
    base: input.data,
    presentation: input.presentation,
    meta: input.meta
  });

  if (docs.length > 0 && docsPage.docs.length === 0) {
    const firstPath = docs[0]?.path;
    const blockedData = docsMapSchema.parse({
      repo_root: input.data.repo_root,
      status: "blocked",
      direct_read_caveat: input.data.direct_read_caveat,
      docs: [],
      warnings: docsPage.warnings,
      warning_count: input.data.warning_count,
      warning_samples_truncated: docsPage.warning_samples_truncated,
      truncated: false,
      blocker: "payload_too_large",
      blocking_message: firstPath === undefined
        ? "The bounded docs map could not fit a minimal typed envelope within 32768 UTF-8 bytes."
        : `The docs-map entry for ${firstPath} could not fit a minimal typed envelope within 32768 UTF-8 bytes.`,
      next_actions: firstPath === undefined
        ? []
        : [
            {
              tool: "docs_outline",
              args: { path: firstPath }
            }
          ]
    });
    return boundedBlockedDocsMapEnvelope(blockedData, input.meta);
  }

  return buildDocsMapPageEnvelope({
    base: input.data,
    docs: docsPage.docs,
    warnings: docsPage.warnings,
    warning_samples_truncated: docsPage.warning_samples_truncated,
    hasMoreDocs: docsPage.has_more_docs,
    presentation: input.presentation,
    meta: input.meta
  });
}

function docsMapTrustedEnvelope(
  data: DocsMap,
  meta: ResponseMetadata
): ResponseEnvelope<DocsMap> {
  return makeTrustedEnvelope({
    data,
    meta,
    trust_policy: { surface_kind: "docs_routing" }
  });
}

function packDocsMapEntries(input: {
  docs: DocsMap["docs"];
  warnings: DocsMap["warnings"];
  base: DocsMap;
  presentation?: DocsMapUseCaseResult["presentation"];
  meta: ResponseMetadata;
}): {
  docs: DocsMap["docs"];
  warnings: DocsMap["warnings"];
  warning_samples_truncated: boolean;
  has_more_docs: boolean;
} {
  const docs: DocsMap["docs"] = [];
  let warnings: DocsMap["warnings"] = [];
  let warningSamplesTruncated = input.base.warning_samples_truncated || input.base.warning_count > 0;

  for (let index = 0; index < input.docs.length; index += 1) {
    const candidate = input.docs[index];
    const nextDocs = [...docs, candidate];
    const hasMoreDocs = index + 1 < input.docs.length || input.presentation?.has_more === true;
    if (!fitsBoundedDocsMap({
      base: input.base,
      docs: nextDocs,
      warnings,
      warningSamplesTruncated,
      hasMoreDocs,
      presentation: input.presentation,
      meta: input.meta
    })) {
      break;
    }
    docs.push(candidate);
  }

  for (const candidate of input.warnings) {
    const nextWarnings = [...warnings, candidate];
    const nextWarningSamplesTruncated = input.base.warning_count > nextWarnings.length;
    const hasMoreDocs = docs.length < input.docs.length || input.presentation?.has_more === true;
    if (!fitsBoundedDocsMap({
      base: input.base,
      docs,
      warnings: nextWarnings,
      warningSamplesTruncated: nextWarningSamplesTruncated,
      hasMoreDocs,
      presentation: input.presentation,
      meta: input.meta
    })) {
      warningSamplesTruncated = true;
      break;
    }
    warnings = nextWarnings;
    warningSamplesTruncated = nextWarningSamplesTruncated;
  }

  return {
    docs,
    warnings,
    warning_samples_truncated: warningSamplesTruncated,
    has_more_docs: docs.length < input.docs.length || input.presentation?.has_more === true
  };
}

function fitsBoundedDocsMap(input: {
  base: DocsMap;
  docs: DocsMap["docs"];
  warnings: DocsMap["warnings"];
  warningSamplesTruncated: boolean;
  hasMoreDocs: boolean;
  presentation?: DocsMapUseCaseResult["presentation"];
  meta: ResponseMetadata;
}): boolean {
  const candidate = buildDocsMapCandidate(input);
  return serializedDocsMapBytes(
    candidate,
    docsMapMeta(input.meta, candidate.truncated, candidate.status)
  ) <= DOCS_MAP_MAX_SERIALIZED_BYTES;
}

function serializedDocsMapBytes(data: DocsMap, meta: ResponseMetadata): number {
  return new TextEncoder().encode(JSON.stringify(docsMapTrustedEnvelope(
    docsMapSchema.parse(data),
    meta
  ), null, 2)).byteLength;
}

function buildDocsMapPageEnvelope(input: {
  base: DocsMap;
  docs: DocsMap["docs"];
  warnings: DocsMap["warnings"];
  warning_samples_truncated: boolean;
  hasMoreDocs: boolean;
  presentation?: DocsMapUseCaseResult["presentation"];
  meta: ResponseMetadata;
}): ResponseEnvelope<DocsMap> {
  const data = buildDocsMapCandidate({
    base: input.base,
    docs: input.docs,
    warnings: input.warnings,
    warningSamplesTruncated: input.warning_samples_truncated,
    hasMoreDocs: input.hasMoreDocs,
    presentation: input.presentation,
    meta: input.meta
  });
  return docsMapTrustedEnvelope(data, docsMapMeta(input.meta, data.truncated, data.status));
}

function buildDocsMapCandidate(input: {
  base: DocsMap;
  docs: DocsMap["docs"];
  warnings: DocsMap["warnings"];
  warningSamplesTruncated: boolean;
  hasMoreDocs: boolean;
  presentation?: DocsMapUseCaseResult["presentation"];
  meta: ResponseMetadata;
}): DocsMap {
  const returnedDocCount = input.docs.length;
  const cursor = input.hasMoreDocs
    ? encodeDocsMapCursor((input.presentation?.cursor_offset ?? decodeDocsMapCursor(input.base.cursor)) + returnedDocCount)
    : undefined;
  return docsMapSchema.parse({
    ...input.base,
    docs: input.docs,
    warnings: input.warnings,
    warning_samples_truncated: input.warningSamplesTruncated,
    truncated: input.hasMoreDocs || input.presentation?.source_truncated === true ||
      (input.presentation === undefined && input.base.truncated),
    cursor,
    blocker: undefined,
    blocking_message: undefined,
    next_actions: buildDocsMapNextActions({
      repoRoot: input.base.repo_root,
      filePath: input.docs[0]?.path,
      cursor,
      scopePath: input.presentation?.scope_path,
      maxDocs: input.presentation?.max_docs ?? 50,
      maxHeadingsPerDoc: input.presentation?.max_headings_per_doc ?? 20
    })
  });
}

function boundedBlockedDocsMapEnvelope(data: DocsMap, meta: ResponseMetadata): ResponseEnvelope<DocsMap> {
  const actualMeta = docsMapMeta(meta, false, "blocked");
  if (serializedDocsMapBytes(data, actualMeta) <= DOCS_MAP_MAX_SERIALIZED_BYTES) {
    return docsMapTrustedEnvelope(data, actualMeta);
  }
  const minimal = docsMapSchema.parse({
    repo_root: data.repo_root,
    status: "blocked",
    direct_read_caveat: data.direct_read_caveat,
    docs: [],
    warnings: [],
    warning_count: data.warning_count,
    warning_samples_truncated: data.warning_count > 0,
    truncated: false,
    blocker: "payload_too_large",
    blocking_message: "The bounded docs map could not fit within 32768 UTF-8 bytes.",
    next_actions: []
  });
  return docsMapTrustedEnvelope(
    minimal,
    docsMapMeta(
      invalidResponseMeta({ repoRoot: data.repo_root }),
      false,
      "blocked"
    )
  );
}

function docsMapMeta(
  meta: ResponseMetadata,
  truncated: boolean,
  status: DocsMap["status"]
): ResponseMetadata {
  return responseMetadataSchema.strip().parse({
    ...meta,
    verification_status: status,
    truncated
  });
}

function buildDocsMapNextActions(input: {
  repoRoot: string;
  filePath?: string;
  cursor?: string;
  scopePath?: string;
  maxDocs: number;
  maxHeadingsPerDoc: number;
}): DocsMap["next_actions"] {
  const actions: Array<{ tool: string; args: Record<string, unknown>; reason?: string }> = [];
  if (input.cursor !== undefined) {
    actions.push({
      tool: "docs_map",
      args: {
        repo_root: input.repoRoot,
        cursor: input.cursor,
        max_docs: input.maxDocs,
        max_headings_per_doc: input.maxHeadingsPerDoc,
        ...(input.scopePath === undefined ? {} : { scope_path: input.scopePath })
      },
      reason: "Continue the truncated documentation map from this cursor."
    });
  }
  if (input.filePath !== undefined) {
    actions.push({
      tool: "docs_outline",
      args: {
        repo_root: input.repoRoot,
        path: input.filePath
      }
    });
  }
  return actions.map((action) => nextActionSchema.parse(action));
}

function decodeDocsMapCursor(cursor: string | undefined): number {
  if (cursor === undefined) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      kind?: unknown;
      offset?: unknown;
    };
    if (
      parsed.kind !== DOCS_MAP_CURSOR_KIND ||
      typeof parsed.offset !== "number" ||
      !Number.isInteger(parsed.offset) ||
      parsed.offset < 0
    ) {
      throw invalidDocsMapCursorError();
    }
    return parsed.offset;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "invalid_cursor") {
      throw error;
    }
    throw invalidDocsMapCursorError();
  }
}

function invalidDocsMapCursorError(): Error & { code: string } {
  return Object.assign(new Error("Invalid docs_map cursor."), { code: "invalid_cursor" });
}

function encodeDocsMapCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ kind: DOCS_MAP_CURSOR_KIND, offset }), "utf8").toString("base64url");
}

function sanitizeDocsSearch(
  input: DocsSearchResult,
  context: PresentationSessionContext
): DocsSearchResult {
  return docsSearchResultSchema.parse({
    repo_root: input.repo_root,
    query: input.query,
    status: input.status,
    hits: [...input.hits].sort(compareSearchHits).map(sanitizeSearchHit),
    warnings: sortWarnings(input.warnings).map(sanitizeWarning),
    truncated: input.truncated,
    cursor: input.cursor,
    result_count: input.result_count,
    result_count_basis: input.result_count_basis,
    docs_index_state: input.docs_index_state,
    indexed_docs_count: input.indexed_docs_count,
    docs_scan_truncated: input.docs_scan_truncated,
    coverage_note: input.coverage_note,
    next_actions: presentNextActions(input.next_actions, context).map((action) => nextActionSchema.parse(action))
  });
}

function sanitizeRankedDocsSearch(
  input: RankedDocsSearchResult,
  context: PresentationSessionContext
): RankedDocsSearchResult {
  const parsed = rankedDocsSearchResultSchema.parse(input);
  const coverageNote = "counts" in parsed
    ? parsed.counts.priority_scan_coverage_note ?? parsed.coverage_note
    : undefined;
  const sanitizedCoverageNote = coverageNote === undefined
    ? undefined
    : redactPresentationText(coverageNote, { context: "source" });
  return rankedDocsSearchResultSchema.parse({
    ...parsed,
    query: redactPresentationText(parsed.query, { context: "source" }),
    normalized_query: redactPresentationText(parsed.normalized_query, { context: "source" }),
    normalized_scope_path: parsed.normalized_scope_path === undefined
      ? undefined
      : redactPresentationText(parsed.normalized_scope_path, { context: "source" }),
    hits: parsed.hits.map(sanitizeRankedSearchHit),
    warnings: parsed.warnings.map(sanitizeWarning),
    next_actions: presentNextActions(parsed.next_actions, context).map((action) => nextActionSchema.parse({
      ...action,
      args: sanitizeNextActionArgs(action.args),
      reason: action.reason === undefined
        ? undefined
        : redactPresentationText(action.reason, { context: "message" }),
      expected_evidence: action.expected_evidence === undefined
        ? undefined
        : redactPresentationText(action.expected_evidence, { context: "message" })
    })),
    ...("counts" in parsed ? {
      counts: {
        ...parsed.counts,
        ...(sanitizedCoverageNote === undefined ? {} : { priority_scan_coverage_note: sanitizedCoverageNote })
      },
      coverage_note: sanitizedCoverageNote
    } : {})
  });
}

function sanitizeNextActionArgs(value: unknown): unknown {
  if (typeof value === "string") {
    return redactPresentationText(value, { context: "source" });
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeNextActionArgs);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeNextActionArgs(item)]));
  }
  return value;
}

function sanitizeRankedSearchHit(input: RankedDocsSearchHit): RankedDocsSearchHit {
  const parsed = rankedDocsSearchHitSchema.parse(input);
  return rankedDocsSearchHitSchema.parse({
    ...parsed,
    title: redactPresentationText(parsed.title, { context: "source" }),
    heading: parsed.heading === undefined
      ? undefined
      : redactPresentationText(parsed.heading, { context: "source" }),
    snippet: parsed.snippet === undefined
      ? undefined
      : redactPresentationText(parsed.snippet, { context: "source" }),
    direct_read_caveat: redactPresentationText(parsed.direct_read_caveat, { context: "source" }),
    authority_caveat: parsed.authority_caveat === undefined
      ? undefined
      : redactPresentationText(parsed.authority_caveat, { context: "source" }),
    repository: parsed.repository === undefined ? undefined : sanitizeRepositoryReference(parsed.repository),
    canonical_owner: parsed.canonical_owner === undefined
      ? undefined
      : redactPresentationText(parsed.canonical_owner, { context: "source" }),
    superseded_by: parsed.superseded_by === undefined
      ? undefined
      : redactPresentationText(parsed.superseded_by, { context: "source" }),
    currency_caveats: parsed.currency_caveats?.map((caveat) =>
      redactPresentationText(caveat, { context: "source" })
    ),
    ranking_reasons: parsed.ranking_reasons.map((reason) =>
      redactPresentationText(reason, { context: "source" })
    )
  });
}

function sanitizeDocsCurrentForTask(
  input: DocsCurrentForTaskResult,
  context: PresentationSessionContext
): DocsCurrentForTaskResult {
  return docsCurrentForTaskResultSchema.parse({
    repo_root: input.repo_root,
    task: input.task,
    status: input.status,
    documentation_corpus: input.documentation_corpus,
    canonical_docs: input.canonical_docs.map(sanitizeDocumentReference),
    supporting_docs: input.supporting_docs.map(sanitizeDocumentReference),
    non_authoritative_docs: input.non_authoritative_docs.map(sanitizeDocumentReference),
    unknown_docs: input.unknown_docs.map(sanitizeDocumentReference),
    warnings: sortWarnings(input.warnings).map(sanitizeWarning),
    next_actions: presentNextActions(input.next_actions, context).map((action) => nextActionSchema.parse(action))
  });
}

function sanitizeDocsOutline(
  input: DocsOutlineResult,
  context: PresentationSessionContext
): DocsOutlineResult {
  return docsOutlineResultSchema.parse({
    repo_root: input.repo_root,
    path: normalizeRepoPath(input.path),
    status: input.status,
    title: input.title,
    headings: sortHeadings(input.headings).map(sanitizeHeading),
    warnings: sortWarnings(input.warnings).map(sanitizeWarning),
    next_actions: presentNextActions(input.next_actions, context).map((action) => nextActionSchema.parse(action))
  });
}

function sanitizeDocsReadSection(
  input: DocsReadSectionResult,
  context: PresentationSessionContext
): DocsReadSectionResult {
  return docsReadSectionResultSchema.parse({
    repo_root: input.repo_root,
    path: normalizeRepoPath(input.path),
    heading_id: input.heading_id,
    status: input.status,
    heading: input.heading === undefined ? undefined : sanitizeHeading(input.heading),
    section: input.section === undefined
      ? undefined
      : sourceSectionSchema.parse({
          ...input.section,
          path: normalizeRepoPath(input.section.path),
          text: redactPresentationText(input.section.text, { context: "source" })
        }),
    warnings: sortWarnings(input.warnings).map(sanitizeWarning),
    next_actions: presentNextActions(input.next_actions, context).map((action) => nextActionSchema.parse(action))
  });
}

function sanitizeDocument(input: DocsDocument): DocsDocument {
  return docsDocumentSchema.parse({
    path: normalizeRepoPath(input.path),
    title: input.title,
    headings: sortHeadings(input.headings).map(sanitizeHeading),
    links: [...input.links].sort(compareLinks).map(sanitizeLink),
    capability_level: input.capability_level,
    evidence_kinds: [...input.evidence_kinds].sort(),
    direct_read_caveat: input.direct_read_caveat,
    doc_status: input.doc_status,
    authority: input.authority,
    authority_caveat: input.authority_caveat,
    repository: input.repository === undefined ? undefined : sanitizeRepositoryReference(input.repository),
    currency_state: input.currency_state,
    currency_caveats: input.currency_caveats,
    canonical_owner: input.canonical_owner,
    superseded_by: input.superseded_by,
    last_reviewed: input.last_reviewed,
    modified_at: input.modified_at,
    git_first_seen: input.git_first_seen,
    git_last_touched: input.git_last_touched
  });
}

function sanitizeHeading(input: DocsHeading): DocsHeading {
  return docsHeadingSchema.parse({
    id: input.id,
    text: input.text,
    depth: input.depth,
    line: input.line
  });
}

function sanitizeLink(input: DocsLink): DocsLink {
  return docsLinkSchema.parse({
    label: input.label,
    target: input.target,
    resolved_path: input.resolved_path === undefined ? undefined : normalizeRepoPath(input.resolved_path),
    exists: input.exists
  });
}

function sanitizeSearchHit(input: DocsSearchHit): DocsSearchHit {
  return docsSearchHitSchema.parse({
    path: normalizeRepoPath(input.path),
    title: input.title,
    heading_id: input.heading_id,
    heading: input.heading,
    snippet: input.snippet === undefined ? undefined : redactPresentationText(input.snippet, { context: "source" }),
    score: input.score,
    evidence_kinds: [...input.evidence_kinds].sort(),
    direct_read_caveat: input.direct_read_caveat,
    doc_status: input.doc_status,
    authority: input.authority,
    authority_caveat: input.authority_caveat,
    repository: input.repository === undefined ? undefined : sanitizeRepositoryReference(input.repository),
    currency_state: input.currency_state,
    currency_caveats: input.currency_caveats,
    canonical_owner: input.canonical_owner,
    superseded_by: input.superseded_by,
    last_reviewed: input.last_reviewed,
    modified_at: input.modified_at,
    git_first_seen: input.git_first_seen,
    git_last_touched: input.git_last_touched
  });
}

function sanitizeRepositoryReference(input: NonNullable<DocsDocument["repository"]>) {
  return {
    repository_key: redactPresentationText(input.repository_key, { context: "source" }),
    path_prefix: redactPresentationText(input.path_prefix, { context: "path" }),
    state: input.state
  };
}

function sanitizeDocumentReference(input: DocumentReference): DocumentReference {
  return documentReferenceSchema.parse({
    path: normalizeRepoPath(input.path),
    title: input.title,
    reason: input.reason,
    evidence_kinds: [...input.evidence_kinds].sort(),
    doc_status: input.doc_status,
    authority: input.authority,
    authority_caveat: input.authority_caveat,
    repository: input.repository === undefined ? undefined : sanitizeRepositoryReference(input.repository),
    currency_state: input.currency_state,
    currency_caveats: input.currency_caveats,
    canonical_owner: input.canonical_owner,
    superseded_by: input.superseded_by,
    last_reviewed: input.last_reviewed,
    modified_at: input.modified_at,
    git_first_seen: input.git_first_seen,
    git_last_touched: input.git_last_touched
  });
}

function sanitizeWarning(input: DocsWarning): DocsWarning {
  return docsWarningSchema.parse({
    path: input.path === undefined ? undefined : normalizeRepoPath(input.path),
    reason: input.reason,
    message: sanitizePublicMcpFailureMessage(
      input.message,
      "Documentation evidence is incomplete; inspect the warning reason and next action."
    )
  });
}

function sortHeadings(headings: readonly DocsHeading[]): DocsHeading[] {
  return [...headings].sort((left, right) =>
    left.line - right.line ||
    left.depth - right.depth ||
    left.id.localeCompare(right.id)
  );
}

function sortWarnings(warnings: readonly DocsWarning[]): DocsWarning[] {
  return [...warnings].sort((left, right) =>
    `${left.path ?? ""}:${left.reason}:${left.message}`.localeCompare(
      `${right.path ?? ""}:${right.reason}:${right.message}`
    )
  );
}

function compareDocuments(left: DocsDocument, right: DocsDocument): number {
  const leftPath = normalizeRepoPath(left.path);
  const rightPath = normalizeRepoPath(right.path);
  return segmentCount(leftPath) - segmentCount(rightPath) ||
    leftPath.toLowerCase().localeCompare(rightPath.toLowerCase()) ||
    leftPath.localeCompare(rightPath);
}

function compareLinks(left: DocsLink, right: DocsLink): number {
  return `${left.target}:${left.label}`.localeCompare(`${right.target}:${right.label}`);
}

function compareSearchHits(left: DocsSearchHit, right: DocsSearchHit): number {
  return right.score - left.score ||
    left.path.localeCompare(right.path) ||
    (left.heading_id ?? "").localeCompare(right.heading_id ?? "");
}

function invalidInputError(message: string) {
  return {
    code: "invalid_input",
    message: sanitizePublicMcpFailureMessage(
      message,
      "Documentation input was invalid; inspect the request and retry."
    ),
    retryable: false
  };
}

function providerUnavailableError(message: string) {
  return {
    code: "provider_unavailable",
    message: sanitizePublicMcpFailureMessage(
      message,
      "Documentation evidence is unavailable; inspect the error code and retry guidance."
    ),
    retryable: true
  };
}

function normalizeRepoPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function segmentCount(value: string): number {
  return value.split("/").filter(Boolean).length;
}
