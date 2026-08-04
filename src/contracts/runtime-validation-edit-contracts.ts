/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { z } from "zod";
import {
  attentionSeveritySchema,
  capabilityLevelSchema,
  contextRiskSchema,
  evidenceKindSchema,
  fileReferenceSchema,
  nextActionSchema,
  skippedPathSchema,
  validationSkippedPathSummarySchema,
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

const MAX_REPO_RELATIVE_PATH_LENGTH = 500;
const MAX_PROJECT_UNIT_COUNT = 20;
const MAX_PROJECT_UNIT_MARKER_COUNT = 8;
const MAX_PROJECT_UNIT_BLOCKER_COUNT = 8;
const MAX_PROJECT_UNIT_BLOCKED_CLAIM_COUNT = 4;
const MAX_PROJECT_UNIT_EVIDENCE_PATH_COUNT = 8;
const MAX_PROJECT_UNIT_MESSAGE_LENGTH = 500;
const MAX_PROJECT_UNIT_REASON_LENGTH = 300;
const MAX_PROJECT_UNIT_COMMAND_ARGUMENT_COUNT = 12;

const repoRelativePathSchema = z
  .string()
  .min(1)
  .max(MAX_REPO_RELATIVE_PATH_LENGTH)
  .refine((value) => {
    if (value === ".") {
      return !value.includes("\0");
    }

    if (
      value.startsWith("/") ||
      value.endsWith("/") ||
      value.includes("\\") ||
      value.includes("\0")
    ) {
      return false;
    }

    const segments = value.split("/");
    return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
  }, {
    message: "Expected a normalized repo-relative path."
  });

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

export const projectUnitPlannedValidationCommandSchema = z
  .object({
    command: z.string().min(1).max(MAX_PROJECT_UNIT_REASON_LENGTH),
    args: z
      .array(z.string().max(MAX_PROJECT_UNIT_REASON_LENGTH))
      .max(MAX_PROJECT_UNIT_COMMAND_ARGUMENT_COUNT),
    display: z.string().min(1).max(MAX_PROJECT_UNIT_MESSAGE_LENGTH),
    reason: z.string().min(1).max(MAX_PROJECT_UNIT_MESSAGE_LENGTH),
    status: z.literal("planned"),
    execution: z.literal("not_executed")
  })
  .strict();
export type ProjectUnitPlannedValidationCommand = z.infer<
  typeof projectUnitPlannedValidationCommandSchema
>;

export const projectUnitKindSchema = z.enum([
  "dotnet",
  "maven",
  "cargo",
  "repository_script"
]);
export type ProjectUnitKind = z.infer<typeof projectUnitKindSchema>;

export const projectUnitMarkerKindSchema = z.enum([
  "csproj",
  "pom_xml",
  "cargo_toml",
  "extensionless_script"
]);
export type ProjectUnitMarkerKind = z.infer<typeof projectUnitMarkerKindSchema>;

export const projectUnitMarkerEvidenceSourceSchema = z.enum([
  "manifest",
  "repository_guidance",
  "validation_protocol"
]);
export type ProjectUnitMarkerEvidenceSource = z.infer<typeof projectUnitMarkerEvidenceSourceSchema>;

export const projectUnitSelectionRelationshipSchema = z.enum([
  "containing",
  "intersects_subtree",
  "explicit_aggregator"
]);
export type ProjectUnitSelectionRelationship = z.infer<
  typeof projectUnitSelectionRelationshipSchema
>;

export const projectUnitBoundaryStateSchema = z.enum([
  "same_repository",
  "declared_submodule",
  "repository_boundary_unknown"
]);
export type ProjectUnitBoundaryState = z.infer<typeof projectUnitBoundaryStateSchema>;

export const projectUnitReadinessSchema = z.enum(["ready", "blocked", "limited"]);
export type ProjectUnitReadiness = z.infer<typeof projectUnitReadinessSchema>;

export const projectUnitBlockerKindSchema = z.enum([
  "dependency_unknown",
  "environment_unknown",
  "marker_unreadable",
  "marker_conflict",
  "git_claim_unavailable",
  "submodule_unavailable",
  "repository_boundary_unknown",
  "unsupported_unit"
]);
export type ProjectUnitBlockerKind = z.infer<typeof projectUnitBlockerKindSchema>;

export const projectUnitBlockedClaimSchema = z.enum([
  "validation_candidate",
  "worktree_cleanliness",
  "diff_completeness",
  "repository_traversal"
]);
export type ProjectUnitBlockedClaim = z.infer<typeof projectUnitBlockedClaimSchema>;

export const projectUnitMarkerSchema = z
  .object({
    path: repoRelativePathSchema,
    kind: projectUnitMarkerKindSchema,
    evidence_source: projectUnitMarkerEvidenceSourceSchema,
    evidence_path: repoRelativePathSchema.optional()
  })
  .superRefine((value, context) => {
    if (
      (value.evidence_source === "repository_guidance" ||
        value.evidence_source === "validation_protocol") &&
      value.evidence_path === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "Documented script marker evidence requires an evidence_path."
      });
    }

    if (value.evidence_source === "manifest" && value.evidence_path !== undefined) {
      context.addIssue({
        code: "custom",
        message: "Manifest marker evidence must not include an evidence_path."
      });
    }
  })
  .strict();
export type ProjectUnitMarker = z.infer<typeof projectUnitMarkerSchema>;

export const projectUnitBlockerSchema = z
  .object({
    kind: projectUnitBlockerKindSchema,
    unit_root: repoRelativePathSchema,
    evidence_paths: z.array(repoRelativePathSchema).max(MAX_PROJECT_UNIT_EVIDENCE_PATH_COUNT),
    message: z.string().min(1).max(MAX_PROJECT_UNIT_MESSAGE_LENGTH),
    blocked_claims: z
      .array(projectUnitBlockedClaimSchema)
      .min(1)
      .max(MAX_PROJECT_UNIT_BLOCKED_CLAIM_COUNT),
    next_action: nextActionSchema.optional()
  })
  .strict();
export type ProjectUnitBlocker = z.infer<typeof projectUnitBlockerSchema>;

export const projectUnitEvidenceSchema = z
  .object({
    root: repoRelativePathSchema,
    kind: projectUnitKindSchema,
    markers: z.array(projectUnitMarkerSchema).min(1).max(MAX_PROJECT_UNIT_MARKER_COUNT),
    selection: projectUnitSelectionRelationshipSchema,
    boundary: projectUnitBoundaryStateSchema,
    readiness: projectUnitReadinessSchema,
    blockers: z.array(projectUnitBlockerSchema).max(MAX_PROJECT_UNIT_BLOCKER_COUNT),
    planned_commands: z
      .array(projectUnitPlannedValidationCommandSchema)
      .max(MAX_PROJECT_UNIT_COUNT)
  })
  .strict()
  .superRefine((value, context) => {
    if (value.readiness === "blocked" && value.blockers.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Blocked project units must include at least one blocker."
      });
    }
    if (value.readiness === "blocked" && value.planned_commands.length > 0) {
      context.addIssue({
        code: "custom",
        message: "Blocked project units must not include planned commands."
      });
    }
  });
export type ProjectUnitEvidence = z.infer<typeof projectUnitEvidenceSchema>;

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
    project_units: z.array(projectUnitEvidenceSchema).max(MAX_PROJECT_UNIT_COUNT).optional(),
    static_feedback: staticFeedbackSchema.optional(),
    risks: z.array(contextRiskSchema),
    skipped_path_summary: validationSkippedPathSummarySchema.optional(),
    /** @deprecated Accepted for compatibility inputs; current plans do not emit it. */
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
    files: z.array(z.string()).max(50).default([]),
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

export const postEditFeedbackOutcomeSchema = z.enum([
  "checked",
  "actionable",
  "queued",
  "skipped",
  "unavailable",
  "errored",
  "silent"
]);
export type PostEditFeedbackOutcome = z.infer<typeof postEditFeedbackOutcomeSchema>;

export const postEditDeferredCheckSchema = z
  .object({
    reason: z.enum([
      "too_many_files",
      "provider_failed",
      "provider_unavailable",
      "provider_not_applicable",
      "diagnostics_skipped",
      "diagnostics_error"
    ]),
    outcome: z.enum(["queued", "skipped", "unavailable", "errored"]),
    count: z.number().int().positive(),
    paths: z.array(z.string()).optional(),
    message: z.string().optional(),
    follow_up_tool: z.enum(["diagnostics_for_files", "verification_plan"]).optional()
  })
  .strict();
export type PostEditDeferredCheck = z.infer<typeof postEditDeferredCheckSchema>;

export const postEditFeedbackRequestSchema = z
  .object({
    repo_root: z.string().optional(),
    changed_files: z.array(z.string()).default([]),
    max_inline_files: z.number().int().positive().max(50).default(20),
    diagnostics: diagnosticsForFilesResultSchema.optional(),
    edit_risks: z.array(postEditFeedbackRiskSchema).default([]),
    validation_status: verificationStatusSchema.optional(),
    deferred_checks: z.array(postEditDeferredCheckSchema).default([])
  })
  .strict();
export type PostEditFeedbackRequest = z.infer<typeof postEditFeedbackRequestSchema>;

export const postEditFeedbackResultSchema = z
  .object({
    repo_root: z.string(),
    status: verificationStatusSchema,
    outcome: postEditFeedbackOutcomeSchema,
    summary: z.string(),
    checked_files: z.array(z.string()),
    findings: z.array(postEditFeedbackFindingSchema),
    deferred_checks: z.array(postEditDeferredCheckSchema),
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
      base_exists: z.boolean(),
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
    preview: editTokenSchema.nullable(),
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
