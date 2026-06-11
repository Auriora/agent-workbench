import { z } from "zod";
import {
  attentionSeveritySchema,
  capabilityLevelSchema,
  contextRiskSchema,
  evidenceKindSchema,
  fileReferenceSchema,
  nextActionSchema,
  skippedPathSchema,
  verificationStatusSchema
} from "./runtime-core-contracts.js";
import { sourceRangeSchema } from "./runtime-graph-contracts.js";

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
