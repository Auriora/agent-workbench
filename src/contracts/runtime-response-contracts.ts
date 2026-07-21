/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { z } from "zod";
import {
  adapterDomainSchema,
  analysisValiditySchema,
  attentionKindSchema,
  attentionSeveritySchema,
  capabilityLevelSchema,
  CONTRACT_VERSION,
  evidenceKindSchema,
  evidenceCoverageStateSchema,
  freshnessSchema,
  nextActionSchema,
  type RuntimeError,
  runtimeErrorSchema,
  runtimeStatusCaveatSchema,
  verificationStatusSchema
} from "./runtime-core-contracts.js";
import { referenceCoverageReceiptSchema } from "./runtime-graph-contracts.js";

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

export const indexCoverageSchema = z
  .object({
    evidence_class: z.enum(["docs", "graph"]),
    state: evidenceCoverageStateSchema,
    indexed_files: z.number().int().nonnegative().optional(),
    eligible_files_seen: z.number().int().nonnegative().optional(),
    scan_truncated: z.boolean().optional(),
    indexed_roots: z.array(z.string()).optional(),
    missing_priority_roots: z.array(z.string()).optional(),
    reason: z.string().optional()
  })
  .strict();
export type IndexCoverage = z.infer<typeof indexCoverageSchema>;

export const trustUseSchema = z.enum([
  "navigation",
  "next_read_selection",
  "local_structure_reference",
  "precise_direct_read_claim",
  "runtime_availability",
  "validation_planning",
  "edit_preview_review",
  "applied_edit_observation",
  "bounded_executed_validation_claim",
  "implementation_claim",
  "passed_validation_claim",
  "task_completion_claim",
  "closure_claim",
  "safe_mutation_claim",
  "whole_program_impact_claim",
  "security_or_vulnerability_claim"
]);
export type TrustUse = z.infer<typeof trustUseSchema>;

export const trustVerificationRequirementSchema = z.enum([
  "direct_read_relevant_source",
  "inspect_ranked_evidence",
  "run_planned_validation",
  "review_diagnostics_output",
  "review_generated_diff",
  "refresh_runtime_snapshot",
  "resolve_blocked_environment",
  "consult_lifecycle_authority",
  "obtain_executed_validation_evidence",
  "perform_security_review"
]);
export type TrustVerificationRequirement = z.infer<typeof trustVerificationRequirementSchema>;

export const trustCalibrationSchema = z
  .object({
    safe_to_use_for: z.array(trustUseSchema),
    not_safe_to_use_for: z.array(trustUseSchema),
    must_verify_by: z.array(trustVerificationRequirementSchema)
  })
  .strict()
  .superRefine((value, context) => {
    const safeUses = new Set(value.safe_to_use_for);
    const contradictoryUses = value.not_safe_to_use_for.filter((use) => safeUses.has(use));
    for (const use of contradictoryUses) {
      context.addIssue({
        code: "custom",
        message: `Trust use '${use}' cannot be both safe and unsafe.`
      });
    }
  });
export type TrustCalibration = z.infer<typeof trustCalibrationSchema>;

export const responseMetadataSchema = z
  .object({
    analysis_validity: analysisValiditySchema,
    freshness: freshnessSchema,
    scope: scopeMetadataSchema,
    capability_level: capabilityLevelSchema,
    evidence_kinds: z.array(evidenceKindSchema),
    verification_status: verificationStatusSchema,
    truncated: z.boolean(),
    budget: budgetMetadataSchema.optional(),
    index_coverage: z.array(indexCoverageSchema).optional(),
    reference_coverage: referenceCoverageReceiptSchema.optional(),
    caveats: z.array(runtimeStatusCaveatSchema).optional(),
    trust: trustCalibrationSchema.optional()
  })
  .superRefine((value, context) => {
    const coverage = value.reference_coverage;
    if (coverage === undefined) {
      return;
    }
    const inspectedLanguages = [...new Set(coverage.languages_inspected)].sort();
    const scopeLanguages = [...new Set(value.scope.languages)].sort();
    if (scopeLanguages.length !== value.scope.languages.length ||
        JSON.stringify(inspectedLanguages) !== JSON.stringify(scopeLanguages)) {
      context.addIssue({
        code: "custom",
        message: "Reference scope languages must be derived from inspected files."
      });
    }
    if (coverage.state === "complete") {
      if (value.analysis_validity !== "valid" || value.truncated) {
        context.addIssue({
          code: "custom",
          message: "Complete reference evidence requires valid, untruncated response metadata."
        });
      }
    } else if (value.analysis_validity === "valid" || !value.truncated) {
      context.addIssue({
        code: "custom",
        message: "Partial reference evidence requires partial or blocked, truncated metadata."
      });
    }
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
