/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { z } from "zod";
import {
  attentionSeveritySchema,
  capabilityLevelSchema,
  documentAuthoritySchema,
  documentCurrencyStateSchema,
  documentCurrencyFieldsSchema,
  documentReferenceSchema,
  documentStatusSchema,
  evidenceKindSchema,
  evidenceCoverageStateSchema,
  nextActionSchema,
  skippedPathReasonSchema,
  verificationStatusSchema
} from "./runtime-core-contracts.js";

export const sourceSectionSchema = z
  .object({
    path: z.string(),
    start_line: z.number().int().positive(),
    end_line: z.number().int().positive(),
    byte_count: z.number().int().nonnegative(),
    truncated: z.boolean(),
    text: z.string(),
    caveat: z.string().optional()
  })
  .strict();
export type SourceSection = z.infer<typeof sourceSectionSchema>;

export const docsHeadingSchema = z
  .object({
    id: z.string(),
    text: z.string(),
    depth: z.number().int().positive().max(6),
    line: z.number().int().positive()
  })
  .strict();
export type DocsHeading = z.infer<typeof docsHeadingSchema>;

export const docsLinkSchema = z
  .object({
    label: z.string(),
    target: z.string(),
    resolved_path: z.string().optional(),
    exists: z.boolean()
  })
  .strict();
export type DocsLink = z.infer<typeof docsLinkSchema>;

export const docsWarningSchema = z
  .object({
    path: z.string().optional(),
    reason: skippedPathReasonSchema,
    message: z.string()
  })
  .strict();
export type DocsWarning = z.infer<typeof docsWarningSchema>;

export const docsDocumentSchema = z
  .object({
    path: z.string(),
    title: z.string(),
    headings: z.array(docsHeadingSchema),
    links: z.array(docsLinkSchema),
    capability_level: capabilityLevelSchema,
    evidence_kinds: z.array(evidenceKindSchema),
    direct_read_caveat: z.string(),
    doc_status: documentStatusSchema.optional(),
    authority: documentAuthoritySchema.optional(),
    authority_caveat: z.string().optional(),
    ...documentCurrencyFieldsSchema.shape
  })
  .strict();
export type DocsDocument = z.infer<typeof docsDocumentSchema>;

export const docsSearchHitSchema = z
  .object({
    path: z.string(),
    title: z.string(),
    heading_id: z.string().optional(),
    heading: z.string().optional(),
    snippet: z.string().optional(),
    score: z.number().nonnegative(),
    evidence_kinds: z.array(evidenceKindSchema),
    direct_read_caveat: z.string(),
    doc_status: documentStatusSchema.optional(),
    authority: documentAuthoritySchema.optional(),
    authority_caveat: z.string().optional(),
    ...documentCurrencyFieldsSchema.shape
  })
  .strict();
export type DocsSearchHit = z.infer<typeof docsSearchHitSchema>;

export const DOCS_RANKING_CONTRACT_VERSION = 1 as const;
export const DOCS_RANKING_SCHEMA_VERSION = 1 as const;
export const DOCS_RANKING_POLICY_VERSION = "authority-aware-v1" as const;
export const DOCS_RANKING_CANDIDATE_LIMIT = 500 as const;
export const DOCS_RANKING_OVERFLOW_SENTINEL = 501 as const;

export const documentationConcernOwnerStateSchema = z.enum([
  "valid",
  "draft",
  "missing",
  "archived",
  "superseded",
  "conflicting"
]);
export type DocumentationConcernOwnerState = z.infer<typeof documentationConcernOwnerStateSchema>;

export const docsConcernMatchStateSchema = z.enum(["matched", "no_match"]);
export type DocsConcernMatchState = z.infer<typeof docsConcernMatchStateSchema>;

export const documentationConcernOwnerEvidenceSchema = z
  .object({
    document_id: z.string().min(1).optional(),
    path: z.string().min(1),
    state: documentationConcernOwnerStateSchema,
    superseded_by: z.string().min(1).optional(),
    declared_canonical_owner: z.string().min(1).optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.state === "missing" && value.document_id !== undefined) {
      context.addIssue({ code: "custom", message: "Missing concern owners cannot identify an indexed document." });
    }
    if (value.state !== "missing" && value.document_id === undefined) {
      context.addIssue({ code: "custom", message: "Repository-present concern owners require a stable document id." });
    }
    if (value.state === "superseded" && value.superseded_by === undefined) {
      context.addIssue({ code: "custom", message: "Superseded concern owners require superseded_by evidence." });
    }
    if (value.state === "conflicting" &&
        (value.declared_canonical_owner === undefined || value.declared_canonical_owner === value.path)) {
      context.addIssue({
        code: "custom",
        message: "Conflicting concern owners require a different declared canonical owner path."
      });
    }
    if (value.state !== "conflicting" && value.declared_canonical_owner !== undefined) {
      context.addIssue({
        code: "custom",
        message: "Only a contradictory declared canonical owner is conflict evidence."
      });
    }
    if (value.document_id !== undefined && value.document_id !== value.path) {
      context.addIssue({
        code: "custom",
        message: "Stable document id must equal the canonical repo-relative POSIX path."
      });
    }
  });
export type DocumentationConcernOwnerEvidence = z.infer<typeof documentationConcernOwnerEvidenceSchema>;

export const docsConcernMatchEvidenceSchema = z
  .object({
    concern_key: z.string().min(1),
    normalized_term: z.string().min(1),
    query_token_start: z.number().int().nonnegative(),
    query_token_end_exclusive: z.number().int().positive(),
    token_count: z.number().int().positive(),
    owners: z.array(documentationConcernOwnerEvidenceSchema)
  })
  .strict()
  .superRefine((value, context) => {
    if (value.query_token_end_exclusive - value.query_token_start !== value.token_count) {
      context.addIssue({ code: "custom", message: "Concern match token span must equal token_count." });
    }
    const identities = value.owners.map((owner) => `${owner.path}\u0000${owner.state}`);
    if (new Set(identities).size !== identities.length) {
      context.addIssue({ code: "custom", message: "Concern match owner evidence must be deduplicated." });
    }
  });
export type DocsConcernMatchEvidence = z.infer<typeof docsConcernMatchEvidenceSchema>;

export const docsCandidateSourceSchema = z.enum(["fts", "matched_owner", "fts_and_matched_owner"]);
export type DocsCandidateSource = z.infer<typeof docsCandidateSourceSchema>;

export const docsRelevanceBandSchema = z.enum([
  "exact_document_phrase",
  "all_query_tokens_title_or_heading",
  "all_query_tokens_body",
  "intent_owner_match",
  "partial_fts_match"
]);
export type DocsRelevanceBand = z.infer<typeof docsRelevanceBandSchema>;

export const docsGoverningOwnerTierSchema = z.enum([
  "valid_owner",
  "non_owner",
  "invalid_owner",
  "invalid_conflicting_owner"
]);
export type DocsGoverningOwnerTier = z.infer<typeof docsGoverningOwnerTierSchema>;

export const docsFinalRankComponentsSchema = z
  .object({
    relevance_band: docsRelevanceBandSchema,
    governing_owner_tier: docsGoverningOwnerTierSchema,
    authority_tier: documentAuthoritySchema,
    currency_tier: documentCurrencyStateSchema,
    lexical_score: z.number().finite().optional(),
    normalized_path: z.string().min(1),
    stable_document_id: z.string().min(1)
  })
  .strict();
export type DocsFinalRankComponents = z.infer<typeof docsFinalRankComponentsSchema>;

export const rankedDocsSearchHitSchema = docsSearchHitSchema
  .extend({
    authority: documentAuthoritySchema,
    currency_state: documentCurrencyStateSchema,
    lexical_score: z.number().finite().optional(),
    candidate_source: docsCandidateSourceSchema,
    concern_match_state: docsConcernMatchStateSchema,
    matched_concerns: z.array(docsConcernMatchEvidenceSchema),
    governing_owner_tier: docsGoverningOwnerTierSchema,
    final_rank_components: docsFinalRankComponentsSchema,
    ranking_policy_version: z.literal(DOCS_RANKING_POLICY_VERSION),
    ranking_reasons: z.array(z.string().min(1)).min(1).max(32)
  })
  .strict()
  .superRefine((value, context) => {
    const issue = (message: string): void => context.addIssue({ code: "custom", message });
    const ftsBacked = value.candidate_source !== "matched_owner";
    if (ftsBacked !== (value.lexical_score !== undefined)) {
      issue("FTS-backed hits require lexical_score and owner-only hits must omit it.");
    }
    if (value.concern_match_state === "no_match" && value.matched_concerns.length !== 0) {
      issue("A no-match hit cannot contain matched concern evidence.");
    }
    if (value.concern_match_state === "matched" && value.matched_concerns.length === 0) {
      issue("A matched hit requires concern evidence.");
    }
    const relatedOwners = value.matched_concerns.flatMap((match) =>
      match.owners.filter((owner) => owner.document_id === value.path && owner.path === value.path)
    );
    if (value.candidate_source === "fts" &&
        (value.governing_owner_tier !== "non_owner" || relatedOwners.length !== 0)) {
      issue("An FTS-only candidate must remain a non-owner without a related matched-owner row.");
    }
    if (value.candidate_source !== "fts" &&
        (value.governing_owner_tier === "non_owner" || value.concern_match_state !== "matched" ||
          relatedOwners.length === 0)) {
      issue("A matched-owner candidate requires at least one related owner row and a governing-owner tier.");
    }
    if (value.candidate_source === "matched_owner" && value.final_rank_components.relevance_band !== "intent_owner_match") {
      issue("An owner-only candidate must use the intent_owner_match relevance band.");
    }
    const relevanceBand = value.final_rank_components.relevance_band;
    const allowedRelevanceBands: Record<DocsCandidateSource, readonly DocsRelevanceBand[]> = {
      fts: [
        "exact_document_phrase",
        "all_query_tokens_title_or_heading",
        "all_query_tokens_body",
        "partial_fts_match"
      ],
      matched_owner: ["intent_owner_match"],
      fts_and_matched_owner: [
        "exact_document_phrase",
        "all_query_tokens_title_or_heading",
        "all_query_tokens_body",
        "intent_owner_match"
      ]
    };
    if (!allowedRelevanceBands[value.candidate_source].includes(relevanceBand)) {
      issue("Candidate source and relevance band must agree with the complete ranking matrix.");
    }
    const ownerStates = relatedOwners.map((owner) => owner.state);
    const expectedOwnerTier = ownerStates.some((state) => state === "valid" || state === "draft")
      ? "valid_owner"
      : ownerStates.includes("conflicting")
        ? "invalid_conflicting_owner"
        : ownerStates.length > 0
          ? "invalid_owner"
          : "non_owner";
    if (value.governing_owner_tier !== expectedOwnerTier) {
      issue("Governing owner tier must agree with the exhaustive matched owner states.");
    }
    if (value.final_rank_components.governing_owner_tier !== value.governing_owner_tier ||
        value.final_rank_components.authority_tier !== value.authority ||
        value.final_rank_components.currency_tier !== value.currency_state ||
        value.final_rank_components.lexical_score !== value.lexical_score ||
        value.final_rank_components.normalized_path !== value.path) {
      issue("Final rank components must agree with the public hit evidence.");
    }
    const canonicalSegments = value.path.split("/");
    if (value.path.startsWith("/") || value.path.startsWith("./") || value.path.includes("\\") ||
        canonicalSegments.some((segment) => segment.length === 0 || segment === "." || segment === "..") ||
        value.final_rank_components.stable_document_id !== value.path) {
      issue("Ranked hit path and stable document id must be the same canonical repo-relative POSIX path.");
    }
  });
export type RankedDocsSearchHit = z.infer<typeof rankedDocsSearchHitSchema>;

export const docsRankingCandidateSchema = z
  .object({
    stable_document_id: z.string().min(1),
    hit: docsSearchHitSchema,
    lexical_score: z.number().finite().optional()
  })
  .strict()
  .superRefine((value, context) => {
    const path = value.hit.path;
    const segments = path.split("/");
    if (value.stable_document_id !== path || path.startsWith("/") || path.startsWith("./") ||
        path.includes("\\") || segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
      context.addIssue({
        code: "custom",
        message: "Candidate stable document id must equal its canonical repo-relative POSIX hit path."
      });
    }
  });
export type DocsRankingCandidate = z.infer<typeof docsRankingCandidateSchema>;

export const docsRankingCandidateQueryResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("exact"),
      candidates: z.array(docsRankingCandidateSchema).max(DOCS_RANKING_CANDIDATE_LIMIT)
    })
    .strict(),
  z
    .object({
      status: z.literal("overflow"),
      candidates: z.array(docsRankingCandidateSchema).length(0),
      candidate_count_lower_bound: z.literal(DOCS_RANKING_OVERFLOW_SENTINEL)
    })
    .strict()
]);
export type DocsRankingCandidateQueryResult = z.infer<typeof docsRankingCandidateQueryResultSchema>;

export const docsQueryFilterBasisSchema = z
  .object({
    fts_candidate_documents_count: z.literal("normalized_fts_match_within_scope"),
    matched_owner_candidate_documents_count: z.literal("exact_matched_concern_owners_within_scope"),
    candidate_union_documents_count: z.literal("distinct_fts_and_exact_owner_union_within_scope"),
    ranked_candidate_universe_count: z.literal("distinct_fts_and_exact_owner_union_within_scope")
  })
  .strict();
export type DocsQueryFilterBasis = z.infer<typeof docsQueryFilterBasisSchema>;

const docsCountReceiptBaseShape = {
  searchable_snapshot_documents_count: z.number().int().nonnegative(),
  searchable_scope_documents_count: z.number().int().nonnegative(),
  returned_page_documents_count: z.number().int().nonnegative(),
  priority_scan_eligible_markdown_files_count: z.number().int().nonnegative(),
  priority_scan_indexed_markdown_files_count: z.number().int().nonnegative(),
  priority_scan_skipped_markdown_files_count: z.number().int().nonnegative(),
  searchable_filter_basis: z.literal("merged_graph_and_priority_markdown"),
  scope_filter_basis: z.enum(["repo_root", "normalized_scope_path"]),
  query_filter_basis: docsQueryFilterBasisSchema,
  page_filter_basis: z.literal("frozen_universe_position_and_requested_page_size"),
  priority_scan_filter_basis: z.literal("configured_priority_roots")
};

function validateDocsCountReceiptBase(
  value: {
    searchable_snapshot_documents_count: number;
    searchable_scope_documents_count: number;
    priority_scan_eligible_markdown_files_count: number;
    priority_scan_indexed_markdown_files_count: number;
    priority_scan_skipped_markdown_files_count: number;
  },
  context: z.RefinementCtx
): void {
  if (value.searchable_scope_documents_count > value.searchable_snapshot_documents_count) {
    context.addIssue({ code: "custom", message: "Searchable scope count cannot exceed the snapshot count." });
  }
  if (value.priority_scan_indexed_markdown_files_count + value.priority_scan_skipped_markdown_files_count !==
      value.priority_scan_eligible_markdown_files_count) {
    context.addIssue({ code: "custom", message: "Priority indexed and skipped counts must exhaust eligible files." });
  }
}

export const docsRankingCountReceiptSchema = z
  .object({
    ...docsCountReceiptBaseShape,
    fts_candidate_documents_count: z.number().int().nonnegative().max(DOCS_RANKING_CANDIDATE_LIMIT),
    matched_owner_candidate_documents_count: z.number().int().nonnegative().max(DOCS_RANKING_CANDIDATE_LIMIT),
    candidate_union_documents_count: z.number().int().nonnegative().max(DOCS_RANKING_CANDIDATE_LIMIT),
    ranked_candidate_universe_count: z.number().int().nonnegative().max(DOCS_RANKING_CANDIDATE_LIMIT)
  })
  .strict()
  .superRefine((value, context) => {
    validateDocsCountReceiptBase(value, context);
    if (value.candidate_union_documents_count < Math.max(
      value.fts_candidate_documents_count,
      value.matched_owner_candidate_documents_count
    ) || value.candidate_union_documents_count >
      value.fts_candidate_documents_count + value.matched_owner_candidate_documents_count) {
      context.addIssue({ code: "custom", message: "Candidate union count must agree with its two deduplicated sources." });
    }
    if (value.ranked_candidate_universe_count !== value.candidate_union_documents_count) {
      context.addIssue({ code: "custom", message: "A complete ranked universe must contain the complete candidate union." });
    }
    if (value.returned_page_documents_count > value.ranked_candidate_universe_count) {
      context.addIssue({ code: "custom", message: "Returned page count cannot exceed the ranked universe count." });
    }
  });
export type DocsRankingCountReceipt = z.infer<typeof docsRankingCountReceiptSchema>;

export const docsRankingOverflowCountReceiptSchema = z
  .object({
    ...docsCountReceiptBaseShape,
    returned_page_documents_count: z.literal(0),
    fts_candidate_documents_count: z.number().int().nonnegative().max(DOCS_RANKING_CANDIDATE_LIMIT).optional(),
    fts_candidate_count_lower_bound: z.literal(DOCS_RANKING_OVERFLOW_SENTINEL).optional(),
    matched_owner_candidate_documents_count: z.number().int().nonnegative().max(DOCS_RANKING_CANDIDATE_LIMIT).optional(),
    matched_owner_candidate_count_lower_bound: z.literal(DOCS_RANKING_OVERFLOW_SENTINEL).optional(),
    candidate_union_count_lower_bound: z.literal(DOCS_RANKING_OVERFLOW_SENTINEL)
  })
  .strict()
  .superRefine((value, context) => {
    validateDocsCountReceiptBase(value, context);
    if ((value.fts_candidate_documents_count === undefined) ===
        (value.fts_candidate_count_lower_bound === undefined)) {
      context.addIssue({ code: "custom", message: "FTS overflow receipt requires exactly one exact count or lower bound." });
    }
    if ((value.matched_owner_candidate_documents_count === undefined) ===
        (value.matched_owner_candidate_count_lower_bound === undefined)) {
      context.addIssue({ code: "custom", message: "Matched-owner overflow receipt requires exactly one exact count or lower bound." });
    }
  });
export type DocsRankingOverflowCountReceipt = z.infer<typeof docsRankingOverflowCountReceiptSchema>;

export const docsRankingCursorPayloadSchema = z
  .object({
    version: z.literal(DOCS_RANKING_CONTRACT_VERSION),
    universe_id: z.string().min(1),
    next_position: z.number().int().positive(),
    snapshot_id: z.string().min(1),
    normalized_query: z.string().min(1),
    normalized_scope_path: z.string().min(1).optional(),
    retrieval_bound: z.literal(DOCS_RANKING_CANDIDATE_LIMIT),
    ranking_schema_version: z.literal(DOCS_RANKING_SCHEMA_VERSION),
    ranking_policy_version: z.literal(DOCS_RANKING_POLICY_VERSION)
  })
  .strict();
export type DocsRankingCursorPayload = z.infer<typeof docsRankingCursorPayloadSchema>;

const rankedDocsSearchResultBaseShape = {
  ranking_contract_version: z.literal(DOCS_RANKING_CONTRACT_VERSION),
  repo_root: z.string(),
  snapshot_id: z.string().min(1),
  query: z.string().min(1),
  normalized_query: z.string().min(1),
  normalized_scope_path: z.string().min(1).optional(),
  ranking_schema_version: z.literal(DOCS_RANKING_SCHEMA_VERSION),
  ranking_policy_version: z.literal(DOCS_RANKING_POLICY_VERSION),
  warnings: z.array(docsWarningSchema),
  next_actions: z.array(nextActionSchema)
};

export const rankedDocsSearchSuccessResultSchema = z
  .object({
    ...rankedDocsSearchResultBaseShape,
    status: z.enum(["done", "not_applicable"]),
    trust_state: z.literal("complete_ranked_universe"),
    universe_id: z.string().min(1),
    hits: z.array(rankedDocsSearchHitSchema),
    counts: docsRankingCountReceiptSchema,
    cursor: z.string().min(1).optional(),
    truncated: z.boolean()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.counts.returned_page_documents_count !== value.hits.length) {
      context.addIssue({ code: "custom", message: "Returned page count must equal the number of ranked hits." });
    }
    if ((value.cursor !== undefined) !== value.truncated) {
      context.addIssue({ code: "custom", message: "A complete ranked result is truncated exactly when a cursor is present." });
    }
    if ((value.status === "not_applicable") !== (value.counts.ranked_candidate_universe_count === 0)) {
      context.addIssue({ code: "custom", message: "Only an empty ranked universe is not applicable." });
    }
  });
export type RankedDocsSearchSuccessResult = z.infer<typeof rankedDocsSearchSuccessResultSchema>;

export const rankedDocsSearchOverflowResultSchema = z
  .object({
    ...rankedDocsSearchResultBaseShape,
    status: z.literal("blocked"),
    trust_state: z.literal("blocked_candidate_overflow"),
    blocker: z.literal("candidate_universe_exceeds_limit"),
    hits: z.array(rankedDocsSearchHitSchema).length(0),
    counts: docsRankingOverflowCountReceiptSchema,
    truncated: z.literal(false)
  })
  .strict();
export type RankedDocsSearchOverflowResult = z.infer<typeof rankedDocsSearchOverflowResultSchema>;

export const rankedDocsSearchUnavailableResultSchema = z
  .object({
    ...rankedDocsSearchResultBaseShape,
    status: z.literal("blocked"),
    trust_state: z.enum(["blocked_cursor_stale", "blocked_cursor_invalid", "blocked_ranking_unavailable"]),
    blocker: z.enum(["ranked_universe_expired", "ranking_cursor_invalid", "ranking_unavailable"]),
    hits: z.array(rankedDocsSearchHitSchema).length(0),
    truncated: z.literal(false)
  })
  .strict()
  .superRefine((value, context) => {
    const expected = {
      ranked_universe_expired: "blocked_cursor_stale",
      ranking_cursor_invalid: "blocked_cursor_invalid",
      ranking_unavailable: "blocked_ranking_unavailable"
    } as const;
    if (value.trust_state !== expected[value.blocker]) {
      context.addIssue({ code: "custom", message: "Unavailable ranking trust state must agree with its blocker." });
    }
  });
export type RankedDocsSearchUnavailableResult = z.infer<typeof rankedDocsSearchUnavailableResultSchema>;

export const rankedDocsSearchResultSchema = z.union([
  rankedDocsSearchSuccessResultSchema,
  rankedDocsSearchOverflowResultSchema,
  rankedDocsSearchUnavailableResultSchema
]);
export type RankedDocsSearchResult = z.infer<typeof rankedDocsSearchResultSchema>;

export const docsOverviewRequestSchema = z
  .object({
    repo_root: z.string().optional(),
    scope_path: z.string().min(1).optional(),
    max_docs: z.number().int().positive().max(50).default(10),
    max_headings_per_doc: z.number().int().positive().max(20).default(5),
    cursor: z.string().optional()
  })
  .strict();
export type DocsOverviewRequest = z.infer<typeof docsOverviewRequestSchema>;

export const docsMapRequestSchema = z
  .object({
    repo_root: z.string().optional(),
    scope_path: z.string().min(1).optional(),
    max_docs: z.number().int().positive().max(200).default(50),
    max_headings_per_doc: z.number().int().positive().max(50).default(20),
    cursor: z.string().optional()
  })
  .strict();
export type DocsMapRequest = z.infer<typeof docsMapRequestSchema>;

export const docsSearchRequestSchema = z
  .object({
    repo_root: z.string().optional(),
    scope_path: z.string().min(1).optional(),
    query: z.string().min(1),
    max_results: z.number().int().positive().max(50).default(10),
    include_snippets: z.boolean().default(true),
    cursor: z.string().optional()
  })
  .strict();
export type DocsSearchRequest = z.infer<typeof docsSearchRequestSchema>;

export const docsCurrentForTaskRequestSchema = z
  .object({
    repo_root: z.string().optional(),
    task: z.string().min(1),
    files: z.array(z.string()).default([]),
    scope_path: z.string().min(1).optional(),
    max_docs: z.number().int().positive().max(50).default(10)
  })
  .strict();
export type DocsCurrentForTaskRequest = z.infer<typeof docsCurrentForTaskRequestSchema>;

export const docsOutlineRequestSchema = z
  .object({
    repo_root: z.string().optional(),
    path: z.string().min(1)
  })
  .strict();
export type DocsOutlineRequest = z.infer<typeof docsOutlineRequestSchema>;

export const docsReadSectionRequestSchema = z
  .object({
    repo_root: z.string().optional(),
    path: z.string().min(1),
    heading_id: z.string().min(1),
    max_bytes: z.number().int().positive().max(12000).default(4000)
  })
  .strict();
export type DocsReadSectionRequest = z.infer<typeof docsReadSectionRequestSchema>;

export const markdownQualityRuleSchema = z.enum([
  "markdown.heading.skipped_level",
  "markdown.heading.duplicate",
  "markdown.frontmatter.missing_required",
  "markdown.link.broken_relative",
  "markdown.list.numbering",
  "markdown.table.readability"
]);
export type MarkdownQualityRule = z.infer<typeof markdownQualityRuleSchema>;

export const markdownQualityCheckStatusSchema = z.enum([
  "done",
  "skipped",
  "blocked"
]);
export type MarkdownQualityCheckStatus = z.infer<typeof markdownQualityCheckStatusSchema>;

export const checkMarkdownDocumentRequestSchema = z
  .object({
    repo_root: z.string().optional(),
    path: z.string().min(1),
    max_findings: z.number().int().positive().max(200).default(50),
    max_evidence_bytes: z.number().int().positive().max(2000).default(240),
    max_file_bytes: z.number().int().positive().max(1_000_000).default(200_000),
    required_frontmatter: z.array(z.string().min(1)).default([
      "title",
      "doc_type",
      "status",
      "owner",
      "last_reviewed"
    ])
  })
  .strict();
export type CheckMarkdownDocumentRequest = z.infer<typeof checkMarkdownDocumentRequestSchema>;

export const checkMarkdownSetRequestSchema = z
  .object({
    repo_root: z.string().optional(),
    paths: z.array(z.string().min(1)).default([]),
    scope_path: z.string().min(1).optional(),
    max_documents: z.number().int().positive().max(100).default(20),
    max_findings: z.number().int().positive().max(500).default(100),
    max_evidence_bytes: z.number().int().positive().max(2000).default(240),
    max_file_bytes: z.number().int().positive().max(1_000_000).default(200_000),
    required_frontmatter: z.array(z.string().min(1)).default([
      "title",
      "doc_type",
      "status",
      "owner",
      "last_reviewed"
    ])
  })
  .strict();
export type CheckMarkdownSetRequest = z.infer<typeof checkMarkdownSetRequestSchema>;

export const docsOverviewSchema = z
  .object({
    repo_root: z.string(),
    status: verificationStatusSchema,
    summary: z.string(),
    important_docs: z.array(docsDocumentSchema),
    warnings: z.array(docsWarningSchema),
    truncated: z.boolean(),
    cursor: z.string().optional(),
    result_count: z.number().int().nonnegative().optional(),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type DocsOverview = z.infer<typeof docsOverviewSchema>;

export const docsMapSchema = z
  .object({
    repo_root: z.string(),
    status: verificationStatusSchema,
    docs: z.array(docsDocumentSchema),
    warnings: z.array(docsWarningSchema),
    truncated: z.boolean(),
    cursor: z.string().optional(),
    result_count: z.number().int().nonnegative().optional(),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type DocsMap = z.infer<typeof docsMapSchema>;

export const docsSearchResultSchema = z
  .object({
    repo_root: z.string(),
    query: z.string(),
    status: verificationStatusSchema,
    hits: z.array(docsSearchHitSchema),
    warnings: z.array(docsWarningSchema),
    truncated: z.boolean(),
    cursor: z.string().optional(),
    result_count: z.number().int().nonnegative().optional(),
    result_count_basis: z.enum(["page", "indexed_matches"]).optional(),
    docs_index_state: evidenceCoverageStateSchema.optional(),
    indexed_docs_count: z.number().int().nonnegative().optional(),
    docs_scan_truncated: z.boolean().optional(),
    coverage_note: z.string().optional(),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type DocsSearchResult = z.infer<typeof docsSearchResultSchema>;

export const docsCurrentForTaskResultSchema = z
  .object({
    repo_root: z.string(),
    task: z.string(),
    status: verificationStatusSchema,
    canonical_docs: z.array(documentReferenceSchema),
    supporting_docs: z.array(documentReferenceSchema),
    non_authoritative_docs: z.array(documentReferenceSchema),
    unknown_docs: z.array(documentReferenceSchema),
    warnings: z.array(docsWarningSchema),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type DocsCurrentForTaskResult = z.infer<typeof docsCurrentForTaskResultSchema>;

export const docsOutlineResultSchema = z
  .object({
    repo_root: z.string(),
    path: z.string(),
    status: verificationStatusSchema,
    title: z.string(),
    headings: z.array(docsHeadingSchema),
    warnings: z.array(docsWarningSchema),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type DocsOutlineResult = z.infer<typeof docsOutlineResultSchema>;

export const docsReadSectionResultSchema = z
  .object({
    repo_root: z.string(),
    path: z.string(),
    heading_id: z.string(),
    status: verificationStatusSchema,
    heading: docsHeadingSchema.optional(),
    section: sourceSectionSchema.optional(),
    warnings: z.array(docsWarningSchema),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type DocsReadSectionResult = z.infer<typeof docsReadSectionResultSchema>;

export const markdownQualityCategorySchema = z.enum([
  "heading_structure",
  "numbering",
  "table_readability",
  "frontmatter",
  "link",
  "formatting"
]);
export type MarkdownQualityCategory = z.infer<typeof markdownQualityCategorySchema>;

export const markdownQualityFindingSchema = z.object({
  category: markdownQualityCategorySchema,
  severity: attentionSeveritySchema,
  rule_id: markdownQualityRuleSchema,
  code: z.string(),
  path: z.string(),
  start_line: z.number().int().positive(),
  start_column: z.number().int().nonnegative(),
  end_line: z.number().int().positive(),
  end_column: z.number().int().nonnegative(),
  message: z.string(),
  evidence: z.string().optional(),
  suggested_action: z.string().optional(),
  evidence_kinds: z.array(evidenceKindSchema)
});
export type MarkdownQualityFinding = z.infer<typeof markdownQualityFindingSchema>;

export const markdownQualityWarningSchema = z
  .object({
    path: z.string().optional(),
    reason: skippedPathReasonSchema,
    message: z.string()
  })
  .strict();
export type MarkdownQualityWarning = z.infer<typeof markdownQualityWarningSchema>;

export const checkMarkdownDocumentResultSchema = z
  .object({
    repo_root: z.string(),
    path: z.string(),
    status: markdownQualityCheckStatusSchema,
    summary: z.string(),
    findings: z.array(markdownQualityFindingSchema),
    warnings: z.array(markdownQualityWarningSchema),
    truncated: z.boolean(),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type CheckMarkdownDocumentResult = z.infer<typeof checkMarkdownDocumentResultSchema>;

export const checkMarkdownSetResultSchema = z
  .object({
    repo_root: z.string(),
    status: markdownQualityCheckStatusSchema,
    summary: z.string(),
    checked_documents: z.array(z.string()),
    skipped_documents: z.array(z.string()),
    findings: z.array(markdownQualityFindingSchema),
    warnings: z.array(markdownQualityWarningSchema),
    truncated: z.boolean(),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type CheckMarkdownSetResult = z.infer<typeof checkMarkdownSetResultSchema>;

export const markdownFormatStrategySchema = z.enum([
  "align_table",
  "split_table",
  "table_to_definition_list",
  "renumber_list",
  "frontmatter_fix",
  "preserve"
]);
export type MarkdownFormatStrategy = z.infer<typeof markdownFormatStrategySchema>;

export const markdownFormatPlanSchema = z.object({
  path: z.string(),
  strategy: markdownFormatStrategySchema,
  rationale: z.string(),
  preserves_rendered_meaning: z.boolean(),
  requires_preview: z.literal(true),
  findings: z.array(markdownQualityFindingSchema),
  preview_token: z.string().optional()
});
export type MarkdownFormatPlan = z.infer<typeof markdownFormatPlanSchema>;
