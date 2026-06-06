import { z } from "zod";

export const CONTRACT_VERSION = "0.1" as const;

export const capabilityLevelSchema = z.enum([
  "semantic",
  "partial_semantic",
  "resource_backed",
  "unsupported"
]);
export type CapabilityLevel = z.infer<typeof capabilityLevelSchema>;

export const evidenceKindSchema = z.enum([
  "parser",
  "lsp",
  "compiler_api",
  "sqlite",
  "fts",
  "docs",
  "tests",
  "direct_read",
  "config",
  "infra_parser",
  "heuristic",
  "text_fallback",
  "executed_command"
]);
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;

export const adapterDomainSchema = z.enum([
  "language",
  "framework",
  "package_manager",
  "config",
  "infrastructure",
  "documentation",
  "test",
  "tooling"
]);
export type AdapterDomain = z.infer<typeof adapterDomainSchema>;

export const freshnessSchema = z.enum([
  "fresh",
  "stale",
  "cold",
  "refreshing",
  "unknown"
]);
export type Freshness = z.infer<typeof freshnessSchema>;

export const analysisValiditySchema = z.enum([
  "valid",
  "partial",
  "invalid",
  "invalid_due_to_environment"
]);
export type AnalysisValidity = z.infer<typeof analysisValiditySchema>;

export const verificationStatusSchema = z.enum([
  "done",
  "planned",
  "needed",
  "blocked",
  "not_applicable"
]);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export const attentionSeveritySchema = z.enum(["blocker", "warning"]);
export type AttentionSeverity = z.infer<typeof attentionSeveritySchema>;

export const attentionKindSchema = z.enum([
  "stale_preview",
  "syntax_error",
  "missing_tool",
  "low_confidence",
  "validation_blocked",
  "path_refused",
  "command_refused",
  "markdown_heading_level",
  "markdown_numbering",
  "markdown_table_readability",
  "markdown_frontmatter",
  "markdown_link",
  "markdown_format_preview"
]);
export type AttentionKind = z.infer<typeof attentionKindSchema>;

export const toolCapabilityClassSchema = z.enum([
  "read_only",
  "planning",
  "workspace_write",
  "process_execute",
  "generated_write"
]);
export type ToolCapabilityClass = z.infer<typeof toolCapabilityClassSchema>;

export const nextActionSchema = z.object({
  tool: z.string(),
  args: z.record(z.string(), z.unknown())
});
export type NextAction = z.infer<typeof nextActionSchema>;

export const runtimeStatusCaveatKindSchema = z.enum([
  "missing_tree_sitter_parser",
  "missing_parser_grammar",
  "parser_timeout",
  "parser_crash",
  "missing_optional_enrichment_evidence",
  "unsupported_language_or_platform",
  "missing_test_runner",
  "stale_watcher_snapshot"
]);
export type RuntimeStatusCaveatKind = z.infer<typeof runtimeStatusCaveatKindSchema>;

export const runtimeStatusCaveatSchema = z.object({
  kind: runtimeStatusCaveatKindSchema,
  severity: attentionSeveritySchema,
  message: z.string(),
  evidence_kinds: z.array(evidenceKindSchema),
  next_action: nextActionSchema.optional()
});
export type RuntimeStatusCaveat = z.infer<typeof runtimeStatusCaveatSchema>;

export const runtimeErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  next_action: nextActionSchema.optional()
});
export type RuntimeError = z.infer<typeof runtimeErrorSchema>;

export const fileReferenceSchema = z
  .object({
    path: z.string(),
    language: z.string(),
    exists: z.boolean(),
    capability_level: capabilityLevelSchema,
    evidence_kinds: z.array(evidenceKindSchema),
    reason: z.string()
  })
  .strict();
export type FileReference = z.infer<typeof fileReferenceSchema>;

export const documentReferenceSchema = z
  .object({
    path: z.string(),
    title: z.string(),
    reason: z.string(),
    evidence_kinds: z.array(evidenceKindSchema)
  })
  .strict();
export type DocumentReference = z.infer<typeof documentReferenceSchema>;

export const validationHintSchema = z
  .object({
    command: z.string(),
    reason: z.string(),
    status: verificationStatusSchema
  })
  .strict();
export type ValidationHint = z.infer<typeof validationHintSchema>;

export const contextRiskSchema = z
  .object({
    severity: attentionSeveritySchema,
    message: z.string(),
    why_this_matters: z.string()
  })
  .strict();
export type ContextRisk = z.infer<typeof contextRiskSchema>;

export const rankedSymbolCandidateSchema = z
  .object({
    rank: z.number().int().positive(),
    score: z.number().nonnegative(),
    symbol: z.lazy(() => symbolReferenceSchema),
    reason: z.string()
  })
  .strict();
export type RankedSymbolCandidate = z.infer<typeof rankedSymbolCandidateSchema>;

export const skippedWorkSchema = z
  .object({
    kind: z.string(),
    reason: z.string(),
    next_action: nextActionSchema.optional()
  })
  .strict();
export type SkippedWork = z.infer<typeof skippedWorkSchema>;

export const skippedPathReasonSchema = z.enum([
  "permission_denied",
  "missing",
  "not_directory",
  "generated_or_vendor",
  "configured_skip",
  "hidden_path",
  "gitignore",
  "secret",
  "nested_git_repository",
  "file_too_large",
  "workspace_escape"
]);
export type SkippedPathReason = z.infer<typeof skippedPathReasonSchema>;

export const skippedPathSchema = z
  .object({
    path: z.string(),
    reason: skippedPathReasonSchema,
    detail: z.string()
  })
  .strict();
export type SkippedPath = z.infer<typeof skippedPathSchema>;

export const contextCompletenessSchema = z
  .object({
    complete_enough: z.boolean(),
    markers: z.array(z.string()),
    caveats: z.array(z.string())
  })
  .strict();
export type ContextCompleteness = z.infer<typeof contextCompletenessSchema>;

export const taskContextRequestSchema = z
  .object({
    task: z.string().min(1),
    repo_root: z.string().optional(),
    files: z.array(z.string()).default([]),
    symbols: z.array(z.string()).default([]),
    max_files: z.number().int().positive().max(50).default(10),
    max_docs: z.number().int().positive().max(20).default(5)
  })
  .strict();
export type TaskContextRequest = z.infer<typeof taskContextRequestSchema>;

export const taskContextSchema = z
  .object({
    task: z.string(),
    repo_root: z.string(),
    summary: z.string(),
    requested_files: z.array(fileReferenceSchema),
    related_files: z.array(fileReferenceSchema),
    ranked_symbols: z.array(rankedSymbolCandidateSchema),
    governing_docs: z.array(documentReferenceSchema),
    validation_hints: z.array(validationHintSchema),
    skipped_work: z.array(skippedWorkSchema),
    completeness: contextCompletenessSchema,
    risks: z.array(contextRiskSchema),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type TaskContext = z.infer<typeof taskContextSchema>;

export const repoScopeSchema = z
  .object({
    repo_root: z.string(),
    indexed_roots: z.array(z.string()),
    skipped_roots: z.array(z.string()),
    languages: z.array(z.string()),
    file_counts: z.record(z.string(), z.number().int().nonnegative()),
    capability_counts: z.record(capabilityLevelSchema, z.number().int().nonnegative()),
    generated_or_vendor_roots: z.array(z.string()),
    skipped_paths: z.array(skippedPathSchema).optional()
  })
  .strict();
export type RepoScope = z.infer<typeof repoScopeSchema>;

export const repoOverviewSchema = z
  .object({
    repo_root: z.string(),
    summary: z.string(),
    languages: z.array(z.string()),
    platforms: z.array(z.string()),
    key_files: z.array(fileReferenceSchema),
    key_docs: z.array(documentReferenceSchema),
    validation_hints: z.array(validationHintSchema),
    skipped_paths: z.array(skippedPathSchema).optional(),
    recommended_first_calls: z.array(nextActionSchema)
  })
  .strict();
export type RepoOverview = z.infer<typeof repoOverviewSchema>;

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
    direct_read_caveat: z.string()
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
    direct_read_caveat: z.string()
  })
  .strict();
export type DocsSearchHit = z.infer<typeof docsSearchHitSchema>;

export const docsOverviewRequestSchema = z
  .object({
    repo_root: z.string().optional(),
    max_docs: z.number().int().positive().max(50).default(10),
    max_headings_per_doc: z.number().int().positive().max(20).default(5)
  })
  .strict();
export type DocsOverviewRequest = z.infer<typeof docsOverviewRequestSchema>;

export const docsMapRequestSchema = z
  .object({
    repo_root: z.string().optional(),
    max_docs: z.number().int().positive().max(200).default(50),
    max_headings_per_doc: z.number().int().positive().max(50).default(20)
  })
  .strict();
export type DocsMapRequest = z.infer<typeof docsMapRequestSchema>;

export const docsSearchRequestSchema = z
  .object({
    repo_root: z.string().optional(),
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

export const sourceRangeSchema = z
  .object({
    start_line: z.number().int().positive(),
    start_column: z.number().int().nonnegative(),
    end_line: z.number().int().positive(),
    end_column: z.number().int().nonnegative()
  })
  .strict();
export type SourceRangeContract = z.infer<typeof sourceRangeSchema>;

export const symbolReferenceSchema = z
  .object({
    node_id: z.string(),
    kind: z.string(),
    name: z.string(),
    qualified_name: z.string().optional(),
    path: z.string(),
    language: z.string(),
    source_range: sourceRangeSchema,
    signature: z.string().optional(),
    docstring: z.string().optional(),
    capability_level: capabilityLevelSchema,
    evidence_kinds: z.array(evidenceKindSchema),
    source_section: sourceSectionSchema.optional()
  })
  .strict();
export type SymbolReference = z.infer<typeof symbolReferenceSchema>;

export const symbolSearchRequestSchema = z
  .object({
    query: z.string().min(1),
    repo_root: z.string().optional(),
    snapshot_id: z.string().optional(),
    exact: z.boolean().default(false),
    languages: z.array(z.string()).default([]),
    max_results: z.number().int().positive().max(100).default(20),
    source_byte_limit: z.number().int().nonnegative().max(2000).default(0)
  })
  .strict();
export type SymbolSearchRequest = z.infer<typeof symbolSearchRequestSchema>;

export const symbolSearchResultSchema = z
  .object({
    query: z.string(),
    repo_root: z.string(),
    snapshot_id: z.string(),
    symbols: z.array(symbolReferenceSchema),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type SymbolSearchResult = z.infer<typeof symbolSearchResultSchema>;

export const findReferencesRequestSchema = z
  .object({
    node_id: z.string().optional(),
    symbol: z.string().optional(),
    repo_root: z.string().optional(),
    snapshot_id: z.string().optional(),
    max_depth: z.number().int().positive().max(5).default(1),
    max_results: z.number().int().positive().max(100).default(50)
  })
  .strict()
  .refine((value) => value.node_id !== undefined || value.symbol !== undefined, {
    message: "Either node_id or symbol is required."
  });
export type FindReferencesRequest = z.infer<typeof findReferencesRequestSchema>;

export const referenceHitSchema = z
  .object({
    source_node_id: z.string().optional(),
    source_file_path: z.string().optional(),
    source_range: sourceRangeSchema.optional(),
    target_node_id: z.string().optional(),
    target_file_path: z.string().optional(),
    reference_name: z.string().optional(),
    reference_kind: z.string(),
    confidence: z.number().min(0).max(1).optional(),
    evidence_kinds: z.array(evidenceKindSchema),
    provenance: z.string(),
    status: z.enum(["resolved", "unresolved", "ambiguous"])
  })
  .strict();
export type ReferenceHit = z.infer<typeof referenceHitSchema>;

export const findReferencesResultSchema = z
  .object({
    repo_root: z.string(),
    snapshot_id: z.string(),
    target: symbolReferenceSchema.optional(),
    references: z.array(referenceHitSchema),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type FindReferencesResult = z.infer<typeof findReferencesResultSchema>;

export const impactRequestSchema = z
  .object({
    node_id: z.string(),
    repo_root: z.string().optional(),
    snapshot_id: z.string().optional(),
    max_depth: z.number().int().positive().max(5).default(2),
    max_nodes: z.number().int().positive().max(200).default(50),
    direction: z.enum(["incoming", "outgoing", "both"]).default("both")
  })
  .strict();
export type ImpactRequest = z.infer<typeof impactRequestSchema>;

export const impactResultSchema = z
  .object({
    repo_root: z.string(),
    snapshot_id: z.string(),
    start_node_ids: z.array(z.string()),
    affected_symbols: z.array(symbolReferenceSchema),
    affected_files: z.array(fileReferenceSchema),
    edge_count: z.number().int().nonnegative(),
    reached_depth: z.number().int().nonnegative(),
    traversal_truncated: z.boolean(),
    confidence: z
      .object({
        level: z.enum(["high", "medium", "low"]),
        scope: z.enum(["graph", "local_only", "empty"]),
        reason: z.string(),
        evidence_kinds: z.array(evidenceKindSchema)
      })
      .strict(),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type ImpactResult = z.infer<typeof impactResultSchema>;

export const verificationPlanRequestSchema = z
  .object({
    task: z.string().optional(),
    repo_root: z.string().optional(),
    files: z.array(z.string()).default([]),
    changed_files: z.array(z.string()).default([]),
    include_static_feedback: z.boolean().default(true),
    max_commands: z.number().int().positive().max(20).default(10)
  })
  .strict();
export type VerificationPlanRequest = z.infer<typeof verificationPlanRequestSchema>;

export const plannedValidationCommandSchema = z
  .object({
    command: z.string(),
    args: z.array(z.string()),
    display: z.string(),
    reason: z.string(),
    status: z.literal("planned"),
    execution: z.literal("not_executed")
  })
  .strict();
export type PlannedValidationCommand = z.infer<typeof plannedValidationCommandSchema>;

export const staticFeedbackFindingSchema = z
  .object({
    path: z.string(),
    severity: attentionSeveritySchema,
    message: z.string(),
    suggested_action: z.string()
  })
  .strict();
export type StaticFeedbackFinding = z.infer<typeof staticFeedbackFindingSchema>;

export const staticFeedbackSchema = z
  .object({
    status: z.enum(["silent", "actionable"]),
    checked_files: z.array(z.string()),
    findings: z.array(staticFeedbackFindingSchema)
  })
  .strict();
export type StaticFeedback = z.infer<typeof staticFeedbackSchema>;

export const verificationPlanSchema = z
  .object({
    task: z.string().optional(),
    repo_root: z.string(),
    status: verificationStatusSchema,
    summary: z.string(),
    planned_commands: z.array(plannedValidationCommandSchema),
    static_feedback: staticFeedbackSchema.optional(),
    risks: z.array(contextRiskSchema),
    skipped_paths: z.array(skippedPathSchema).optional(),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type VerificationPlan = z.infer<typeof verificationPlanSchema>;

export const diagnosticCategorySchema = z.enum([
  "syntax",
  "config",
  "documentation",
  "format",
  "type",
  "lint",
  "edit_risk",
  "unsupported"
]);
export type DiagnosticCategory = z.infer<typeof diagnosticCategorySchema>;

export const diagnosticsProviderStatusSchema = z
  .object({
    provider_id: z.string(),
    path: z.string().optional(),
    status: z.enum(["checked", "clean", "not_applicable", "unavailable", "failed"]),
    message: z.string().optional(),
    capability_level: capabilityLevelSchema,
    evidence_kinds: z.array(evidenceKindSchema)
  })
  .strict();
export type DiagnosticsProviderStatus = z.infer<typeof diagnosticsProviderStatusSchema>;

export const diagnosticFindingSchema = z
  .object({
    path: z.string(),
    range: sourceRangeSchema.optional(),
    severity: attentionSeveritySchema,
    message: z.string(),
    category: diagnosticCategorySchema,
    provider_id: z.string(),
    capability_level: capabilityLevelSchema,
    evidence_kinds: z.array(evidenceKindSchema),
    blocking: z.boolean(),
    fix_hint: z.string().optional()
  })
  .strict();
export type DiagnosticFinding = z.infer<typeof diagnosticFindingSchema>;

export const diagnosticsForFilesRequestSchema = z
  .object({
    repo_root: z.string().optional(),
    files: z.array(z.string()).default([]),
    max_files: z.number().int().positive().max(50).default(20)
  })
  .strict();
export type DiagnosticsForFilesRequest = z.infer<typeof diagnosticsForFilesRequestSchema>;

export const diagnosticsForFilesResultSchema = z
  .object({
    repo_root: z.string(),
    status: verificationStatusSchema,
    summary: z.string(),
    checked_files: z.array(z.string()),
    findings: z.array(diagnosticFindingSchema),
    provider_statuses: z.array(diagnosticsProviderStatusSchema),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type DiagnosticsForFilesResult = z.infer<typeof diagnosticsForFilesResultSchema>;

export const postEditFeedbackFindingSchema = z
  .object({
    path: z.string().optional(),
    severity: attentionSeveritySchema,
    message: z.string(),
    category: z.enum(["diagnostic", "edit_risk", "validation"]),
    blocking: z.boolean(),
    suggested_action: z.string().optional()
  })
  .strict();
export type PostEditFeedbackFinding = z.infer<typeof postEditFeedbackFindingSchema>;

export const postEditFeedbackRiskSchema = z
  .object({
    path: z.string().optional(),
    severity: attentionSeveritySchema,
    message: z.string(),
    blocking: z.boolean().default(false),
    suggested_action: z.string().optional()
  })
  .strict();
export type PostEditFeedbackRisk = z.infer<typeof postEditFeedbackRiskSchema>;

export const postEditFeedbackRequestSchema = z
  .object({
    repo_root: z.string().optional(),
    changed_files: z.array(z.string()).default([]),
    diagnostics: diagnosticsForFilesResultSchema.optional(),
    edit_risks: z.array(postEditFeedbackRiskSchema).default([]),
    validation_status: verificationStatusSchema.optional()
  })
  .strict();
export type PostEditFeedbackRequest = z.infer<typeof postEditFeedbackRequestSchema>;

export const postEditFeedbackResultSchema = z
  .object({
    repo_root: z.string(),
    status: verificationStatusSchema,
    summary: z.string(),
    checked_files: z.array(z.string()),
    findings: z.array(postEditFeedbackFindingSchema),
    visible_message: z.string().optional(),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type PostEditFeedbackResult = z.infer<typeof postEditFeedbackResultSchema>;

export const scopeMetadataSchema = z.object({
  repo_root: z.string(),
  indexed_roots: z.array(z.string()),
  skipped_roots: z.array(z.string()),
  languages: z.array(z.string())
});
export type ScopeMetadata = z.infer<typeof scopeMetadataSchema>;

export const adapterEvidenceSchema = z
  .object({
    domain: adapterDomainSchema,
    name: z.string(),
    capability_level: capabilityLevelSchema,
    evidence_kinds: z.array(evidenceKindSchema),
    paths: z.array(z.string()),
    provenance: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
    metadata: z.record(z.string(), z.unknown()).default({})
  })
  .strict();
export type AdapterEvidence = z.infer<typeof adapterEvidenceSchema>;

export const budgetMetadataSchema = z
  .object({
    time_ms: z.number().int().nonnegative().optional(),
    row_limit: z.number().int().nonnegative().optional(),
    traversal_depth: z.number().int().nonnegative().optional(),
    source_byte_limit: z.number().int().nonnegative().optional()
  })
  .strict();
export type BudgetMetadata = z.infer<typeof budgetMetadataSchema>;

export const responseMetadataSchema = z.object({
  analysis_validity: analysisValiditySchema,
  freshness: freshnessSchema,
  scope: scopeMetadataSchema,
  capability_level: capabilityLevelSchema,
  evidence_kinds: z.array(evidenceKindSchema),
  verification_status: verificationStatusSchema,
  truncated: z.boolean(),
  budget: budgetMetadataSchema.optional(),
  caveats: z.array(runtimeStatusCaveatSchema).optional()
});
export type ResponseMetadata = z.infer<typeof responseMetadataSchema>;

export const attentionItemSchema = z.object({
  severity: attentionSeveritySchema,
  kind: attentionKindSchema,
  scope: z
    .object({
      files: z.array(z.string()).optional(),
      symbols: z.array(z.string()).optional()
    })
    .default({}),
  message: z.string(),
  why_this_matters: z.string(),
  evidence_kinds: z.array(evidenceKindSchema),
  freshness: freshnessSchema,
  next_action: nextActionSchema.optional(),
  expires_when: z.string().optional()
});
export type AttentionItem = z.infer<typeof attentionItemSchema>;

export const editTokenSchema = z.object({
  preview_token: z.string(),
  created_at: z.string(),
  expires_at: z.string(),
  files: z.array(
    z.object({
      path: z.string(),
      base_hash: z.string(),
      after_hash: z.string(),
      change_count: z.number().int().nonnegative()
    })
  ),
  operation: z.literal("bounded_text_edit"),
  mutation_class: z.literal("workspace_write")
});
export type EditToken = z.infer<typeof editTokenSchema>;

export const workspaceEditFileSchema = z
  .object({
    path: z.string().min(1),
    replacement_text: z.string()
  })
  .strict();
export type WorkspaceEditFile = z.infer<typeof workspaceEditFileSchema>;

export const previewWorkspaceEditRequestSchema = z
  .object({
    repo_root: z.string().optional(),
    edits: z.array(workspaceEditFileSchema).min(1).max(20),
    expires_in_ms: z.number().int().positive().max(3_600_000).default(600_000)
  })
  .strict();
export type PreviewWorkspaceEditRequest = z.infer<typeof previewWorkspaceEditRequestSchema>;

export const previewWorkspaceEditResultSchema = z
  .object({
    repo_root: z.string(),
    preview: editTokenSchema,
    changed_files: z.array(fileReferenceSchema),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type PreviewWorkspaceEditResult = z.infer<typeof previewWorkspaceEditResultSchema>;

export const applyWorkspaceEditRequestSchema = z
  .object({
    repo_root: z.string().optional(),
    preview_token: z.string().min(1),
    edits: z.array(workspaceEditFileSchema).min(1).max(20)
  })
  .strict();
export type ApplyWorkspaceEditRequest = z.infer<typeof applyWorkspaceEditRequestSchema>;

export const applyWorkspaceEditResultSchema = z
  .object({
    repo_root: z.string(),
    preview_token: z.string(),
    applied_files: z.array(fileReferenceSchema),
    status: z.enum(["applied", "blocked"]),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type ApplyWorkspaceEditResult = z.infer<typeof applyWorkspaceEditResultSchema>;

export const responseEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    contract_version: z.literal(CONTRACT_VERSION),
    data: dataSchema,
    meta: responseMetadataSchema,
    warnings: z.array(attentionItemSchema),
    errors: z.array(runtimeErrorSchema)
  });

export type ResponseEnvelope<T> = {
  contract_version: typeof CONTRACT_VERSION;
  data: T;
  meta: ResponseMetadata;
  warnings: AttentionItem[];
  errors: RuntimeError[];
};

export const agentIntegrationSurfaceSchema = z.enum([
  "mcp",
  "instructions",
  "skills",
  "hooks",
  "commands",
  "plugins",
  "extensions",
  "subagents",
  "acp"
]);
export type AgentIntegrationSurface = z.infer<typeof agentIntegrationSurfaceSchema>;

export const agentTargetSchema = z.enum([
  "codex",
  "claude_code",
  "kiro",
  "augment",
  "gemini",
  "junie",
  "generic"
]);
export type AgentTarget = z.infer<typeof agentTargetSchema>;

export const integrationArtifactSchema = z.object({
  target_agent: agentTargetSchema,
  surface: agentIntegrationSurfaceSchema,
  path: z.string().optional(),
  status: z.enum(["supported", "unsupported", "deferred"]),
  provenance: z.string(),
  regeneration_safe: z.boolean(),
  notes: z.array(z.string()).default([])
});
export type IntegrationArtifact = z.infer<typeof integrationArtifactSchema>;

export const codexIntegrationFeatureStatusSchema = z.enum([
  "active",
  "available",
  "deferred",
  "unsupported"
]);
export type CodexIntegrationFeatureStatus = z.infer<typeof codexIntegrationFeatureStatusSchema>;

export const codexIntegrationFeatureSchema = z
  .object({
    surface: agentIntegrationSurfaceSchema,
    status: codexIntegrationFeatureStatusSchema,
    artifact_path: z.string().optional(),
    purpose: z.string(),
    behavior: z.array(z.string()).default([]),
    constraints: z.array(z.string()).default([])
  })
  .strict();
export type CodexIntegrationFeature = z.infer<typeof codexIntegrationFeatureSchema>;

export const codexHookSpecSchema = z
  .object({
    name: z.string(),
    event: z.string(),
    matcher: z.string().optional(),
    path: z.string(),
    default_mode: z.enum(["silent", "basic_feedback"]),
    blocks_workflow: z.literal(false),
    emits_when: z.array(z.string()),
    quiet_when: z.array(z.string()),
    schema_mapping: z.string()
  })
  .strict();
export type CodexHookSpec = z.infer<typeof codexHookSpecSchema>;

export const codexSkillSpecSchema = z
  .object({
    name: z.string(),
    path: z.string(),
    purpose: z.string(),
    workflow: z.array(z.string()),
    constraints: z.array(z.string())
  })
  .strict();
export type CodexSkillSpec = z.infer<typeof codexSkillSpecSchema>;

export const codexPluginSpecSchema = z
  .object({
    name: z.string(),
    manifest_path: z.string(),
    mcp_config_path: z.string().optional(),
    runtime_source: z.string(),
    packaging_model: z.string(),
    mcp_binding_model: z.string().optional(),
    update_model: z.object({
      source_changes: z.string(),
      dependency_changes: z.string(),
      copied_runtime_allowed: z.literal(false)
    })
  })
  .strict();
export type CodexPluginSpec = z.infer<typeof codexPluginSpecSchema>;

export const codexInstallPackageSpecSchema = z
  .object({
    registry: z.literal("ghcr.io"),
    image: z.string(),
    containerfile_path: z.string(),
    manifest_path: z.string(),
    installer_path: z.string(),
    release_workflow_path: z.string(),
    installed_components: z.array(z.string()),
    dependency_install_model: z.string(),
    mcp_install_model: z.string(),
    hook_install_model: z.string()
  })
  .strict();
export type CodexInstallPackageSpec = z.infer<typeof codexInstallPackageSpecSchema>;

export const codexIntegrationProfileSchema = z
  .object({
    target_agent: z.literal("codex"),
    profile_name: z.string(),
    runtime_version: z.string(),
    mcp_server_id: z.string(),
    runtime_source: z.string(),
    active_surfaces: z.array(codexIntegrationFeatureSchema),
    wrapper_surfaces: z.array(codexIntegrationFeatureSchema),
    mcp_bindings: z.array(
      z.object({
        name: z.string(),
        uri: z.string().optional(),
        kind: z.enum(["tool", "resource", "prompt"]),
        capability_class: toolCapabilityClassSchema,
        description: z.string()
      })
    ),
    plugin: codexPluginSpecSchema,
    install_package: codexInstallPackageSpecSchema,
    skills: z.array(codexSkillSpecSchema),
    hooks: z.array(codexHookSpecSchema),
    guardrails: z.array(z.string()),
    artifacts: z.array(integrationArtifactSchema)
  })
  .strict();
export type CodexIntegrationProfile = z.infer<typeof codexIntegrationProfileSchema>;

export const integrationProfileSchema = z.object({
  runtime_version: z.string(),
  target_agents: z.array(agentTargetSchema),
  mcp_bindings: z.array(
    z.object({
      name: z.string(),
      kind: z.enum(["tool", "resource", "prompt"]),
      capability_class: toolCapabilityClassSchema
    })
  ),
  artifacts: z.array(integrationArtifactSchema),
  unsupported_surfaces: z.array(
    z.object({
      target_agent: agentTargetSchema,
      surface: agentIntegrationSurfaceSchema,
      reason: z.string()
    })
  )
});
export type IntegrationProfile = z.infer<typeof integrationProfileSchema>;

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

export function makeEnvelope<T>(input: {
  data: T;
  meta: ResponseMetadata;
  warnings?: AttentionItem[];
  errors?: RuntimeError[];
}): ResponseEnvelope<T> {
  return {
    contract_version: CONTRACT_VERSION,
    data: input.data,
    meta: input.meta,
    warnings: input.warnings ?? [],
    errors: input.errors ?? []
  };
}
