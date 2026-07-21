/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

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

export const evidenceCoverageStateSchema = z.enum([
  "complete",
  "partial",
  "refreshing",
  "stale",
  "blocked",
  "unknown"
]);
export type EvidenceCoverageState = z.infer<typeof evidenceCoverageStateSchema>;

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
  args: z.record(z.string(), z.unknown()),
  reason: z.string().optional(),
  expected_evidence: z.string().optional()
});
export type NextAction = z.infer<typeof nextActionSchema>;

export const runtimeStatusCaveatKindSchema = z.enum([
  "no_adapter_coverage",
  "missing_tree_sitter_parser",
  "missing_parser_grammar",
  "parser_timeout",
  "parser_crash",
  "missing_optional_enrichment_evidence",
  "unsupported_language_or_platform",
  "missing_test_runner",
  "stale_snapshot_paths",
  "degraded_snapshot_path_validity",
  "stale_watcher_snapshot",
  "watcher_refreshing",
  "degraded_watcher_freshness",
  "snapshot_unpublished",
  "authority_map_absent"
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

export const snapshotValidityReceiptSchema = z
  .object({
    snapshot_id: z.string().min(1),
    state: z.enum(["valid", "stale", "degraded"]),
    complete: z.boolean(),
    checked_path_count: z.number().int().nonnegative(),
    observed_path_count: z.number().int().nonnegative(),
    missing_paths: z.array(z.string()),
    inaccessible_paths: z.array(z.string()),
    refresh_required: z.boolean(),
    reason: z.string().optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.checked_path_count > value.observed_path_count) {
      context.addIssue({
        code: "custom",
        message: "checked_path_count cannot exceed observed_path_count."
      });
    }
    if (value.state === "valid" && (
      !value.complete ||
      value.missing_paths.length > 0 ||
      value.inaccessible_paths.length > 0 ||
      value.refresh_required
    )) {
      context.addIssue({
        code: "custom",
        message: "A valid snapshot receipt requires complete evidence with no missing or inaccessible paths."
      });
    }
    if (value.state === "stale" && (value.missing_paths.length === 0 || !value.refresh_required)) {
      context.addIssue({
        code: "custom",
        message: "A stale snapshot receipt requires missing paths and refresh_required."
      });
    }
    if (value.state === "degraded" && value.complete && value.inaccessible_paths.length === 0) {
      context.addIssue({
        code: "custom",
        message: "A degraded snapshot receipt requires incomplete or inaccessible evidence."
      });
    }
  });
export type SnapshotValidityReceipt = z.infer<typeof snapshotValidityReceiptSchema>;

export const DEFAULT_WORKSPACE_WATCHER_ENABLED = false as const;
export const DEFAULT_WORKSPACE_WATCHER_DEBOUNCE_MS = 250;
export const DEFAULT_WORKSPACE_WATCHER_EVENT_BUDGET = 1000;

export const workspaceWatcherConfigSchema = z
  .object({
    enabled: z.boolean().default(DEFAULT_WORKSPACE_WATCHER_ENABLED),
    debounce_ms: z.number().int().min(0).max(60_000).default(DEFAULT_WORKSPACE_WATCHER_DEBOUNCE_MS),
    event_budget: z.number().int().min(1).max(100_000).default(DEFAULT_WORKSPACE_WATCHER_EVENT_BUDGET)
  })
  .strict();
export type WorkspaceWatcherConfigContract = z.infer<typeof workspaceWatcherConfigSchema>;

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

export const documentStatusSchema = z.enum([
  "current",
  "draft",
  "historical",
  "legacy",
  "archived",
  "template",
  "sample",
  "unknown"
]);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

export const documentAuthoritySchema = z.enum(["canonical", "supporting", "non_authoritative"]);
export type DocumentAuthority = z.infer<typeof documentAuthoritySchema>;

export const documentCurrencyStateSchema = z.enum(["current", "stale", "superseded", "historical", "unknown"]);
export type DocumentCurrencyState = z.infer<typeof documentCurrencyStateSchema>;

export const documentCurrencyFieldsSchema = z.object({
  currency_state: documentCurrencyStateSchema.optional(),
  currency_caveats: z.array(z.string()).optional(),
  canonical_owner: z.string().optional(),
  superseded_by: z.string().optional(),
  last_reviewed: z.string().optional(),
  modified_at: z.string().optional(),
  git_first_seen: z.string().optional(),
  git_last_touched: z.string().optional()
});
export type DocumentCurrencyFields = z.infer<typeof documentCurrencyFieldsSchema>;

export const documentReferenceSchema = z
  .object({
    path: z.string(),
    title: z.string(),
    reason: z.string(),
    evidence_kinds: z.array(evidenceKindSchema),
    doc_status: documentStatusSchema.optional(),
    authority: documentAuthoritySchema.optional(),
    authority_caveat: z.string().optional(),
    ...documentCurrencyFieldsSchema.shape
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
