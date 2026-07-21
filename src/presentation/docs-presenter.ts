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
  ResponseEnvelope
} from "../contracts/index.js";
import {
  documentReferenceSchema,
  docsDocumentSchema,
  docsCurrentForTaskResultSchema,
  docsHeadingSchema,
  docsLinkSchema,
  docsMapSchema,
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
import type { CurrentDocsForTaskUseCaseResult } from "../application/use-cases/current-docs-for-task.js";
import {
  buildResponseMeta,
  invalidResponseMeta,
  makeTrustedEnvelope,
  presentNextActions,
  type PresentationSessionContext
} from "../application/use-cases/response-metadata.js";
import { redactPresentationText } from "./redaction.js";

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
  return makeTrustedEnvelope({
    data: sanitizeDocsMap(result.map, context),
    meta: responseMetadataSchema.strip().parse(result.meta),
    trust_policy: { surface_kind: "docs_routing" }
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
  result: RankedDocsSearchResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<RankedDocsSearchResult> {
  const data = sanitizeRankedDocsSearch(result, context);
  const coverageState = "counts" in data
    ? data.counts.priority_scan_coverage_state ?? data.docs_index_state ?? "unknown"
    : "unknown";
  const blocked = data.status === "blocked";
  const countReceipt = "counts" in data ? data.counts : undefined;
  return makeTrustedEnvelope({
    data,
    meta: {
      ...buildResponseMeta({
        analysis_validity: blocked ? "invalid" : coverageState === "complete" ? "valid" : "partial",
        freshness: data.trust_state === "blocked_cursor_stale"
          ? "stale"
          : data.trust_state === "blocked_ranking_unavailable" ||
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
          scan_truncated: countReceipt.priority_scan_truncated,
          indexed_roots: ["AGENTS.md", "README.md", "docs", "doc", "documentation"],
          reason: countReceipt.priority_scan_coverage_note
        }]
      })
    },
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
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      status: "blocked",
      summary: input.message,
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
    errors: [providerUnavailableError(input.message)]
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
      docs: [],
      warnings: [],
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
      docs: [],
      warnings: [],
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
    docs: [...input.docs].sort(compareDocuments).map(sanitizeDocument),
    warnings: sortWarnings(input.warnings).map(sanitizeWarning),
    truncated: input.truncated,
    cursor: input.cursor,
    result_count: input.result_count,
    next_actions: presentNextActions(input.next_actions, context).map((action) => nextActionSchema.parse(action))
  });
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

function sanitizeDocumentReference(input: DocumentReference): DocumentReference {
  return documentReferenceSchema.parse({
    path: normalizeRepoPath(input.path),
    title: input.title,
    reason: input.reason,
    evidence_kinds: [...input.evidence_kinds].sort(),
    doc_status: input.doc_status,
    authority: input.authority,
    authority_caveat: input.authority_caveat,
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
    message: redactPresentationText(input.message, { context: "message" })
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
    message,
    retryable: false
  };
}

function providerUnavailableError(message: string) {
  return {
    code: "provider_unavailable",
    message,
    retryable: true
  };
}

function normalizeRepoPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function segmentCount(value: string): number {
  return value.split("/").filter(Boolean).length;
}
