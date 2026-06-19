import { z } from "zod";
import {
  attentionSeveritySchema,
  capabilityLevelSchema,
  documentAuthoritySchema,
  documentStatusSchema,
  evidenceKindSchema,
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
    authority_caveat: z.string().optional()
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
    authority_caveat: z.string().optional()
  })
  .strict();
export type DocsSearchHit = z.infer<typeof docsSearchHitSchema>;

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
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type DocsSearchResult = z.infer<typeof docsSearchResultSchema>;

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
