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
  docsWarningSchema,
  makeEnvelope,
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
  invalidResponseMeta,
  presentNextActions,
  type PresentationSessionContext
} from "../application/use-cases/response-metadata.js";
import { redactPresentationText } from "./redaction.js";

export function buildDocsOverviewEnvelope(
  result: DocsOverviewUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<DocsOverview> {
  return makeEnvelope({
    data: sanitizeDocsOverview(result.overview, context),
    meta: responseMetadataSchema.strip().parse(result.meta)
  });
}

export function buildDocsMapEnvelope(
  result: DocsMapUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<DocsMap> {
  return makeEnvelope({
    data: sanitizeDocsMap(result.map, context),
    meta: responseMetadataSchema.strip().parse(result.meta)
  });
}

export function buildDocsSearchEnvelope(
  result: DocsSearchUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<DocsSearchResult> {
  return makeEnvelope({
    data: sanitizeDocsSearch(result.search, context),
    meta: responseMetadataSchema.strip().parse(result.meta)
  });
}

export function buildDocsCurrentForTaskEnvelope(
  result: CurrentDocsForTaskUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<DocsCurrentForTaskResult> {
  return makeEnvelope({
    data: sanitizeDocsCurrentForTask(result.current_docs, context),
    meta: responseMetadataSchema.strip().parse(result.meta)
  });
}

export function buildInvalidDocsCurrentForTaskInputEnvelope(input: {
  repoRoot: string;
  task?: string;
  message: string;
}): ResponseEnvelope<DocsCurrentForTaskResult> {
  return makeEnvelope({
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
    errors: [invalidInputError(input.message)]
  });
}

export function buildDocsOutlineEnvelope(
  result: DocsOutlineUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<DocsOutlineResult> {
  return makeEnvelope({
    data: sanitizeDocsOutline(result.outline, context),
    meta: responseMetadataSchema.strip().parse(result.meta)
  });
}

export function buildDocsReadSectionEnvelope(
  result: DocsReadSectionUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<DocsReadSectionResult> {
  return makeEnvelope({
    data: sanitizeDocsReadSection(result.read, context),
    meta: responseMetadataSchema.strip().parse(result.meta)
  });
}

export function buildInvalidDocsOverviewInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<DocsOverview> {
  return makeEnvelope({
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
    errors: [invalidInputError(input.message)]
  });
}

export function buildInvalidDocsMapInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<DocsMap> {
  return makeEnvelope({
    data: {
      repo_root: input.repoRoot,
      status: "blocked",
      docs: [],
      warnings: [],
      truncated: false,
      next_actions: []
    },
    meta: invalidResponseMeta({ repoRoot: input.repoRoot }),
    errors: [invalidInputError(input.message)]
  });
}

export function buildInvalidDocsSearchInputEnvelope(input: {
  repoRoot: string;
  query?: string;
  message: string;
}): ResponseEnvelope<DocsSearchResult> {
  return makeEnvelope({
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
    errors: [invalidInputError(input.message)]
  });
}

export function buildInvalidDocsOutlineInputEnvelope(input: {
  repoRoot: string;
  path?: string;
  message: string;
}): ResponseEnvelope<DocsOutlineResult> {
  return makeEnvelope({
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
    errors: [invalidInputError(input.message)]
  });
}

export function buildInvalidDocsReadSectionInputEnvelope(input: {
  repoRoot: string;
  path?: string;
  headingId?: string;
  message: string;
}): ResponseEnvelope<DocsReadSectionResult> {
  return makeEnvelope({
    data: {
      repo_root: input.repoRoot,
      path: input.path ?? "",
      heading_id: input.headingId ?? "",
      status: "blocked",
      warnings: [],
      next_actions: []
    },
    meta: invalidResponseMeta({ repoRoot: input.repoRoot }),
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
    next_actions: presentNextActions(input.next_actions, context).map((action) => nextActionSchema.parse(action))
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
    message: input.message
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

function normalizeRepoPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function segmentCount(value: string): number {
  return value.split("/").filter(Boolean).length;
}
