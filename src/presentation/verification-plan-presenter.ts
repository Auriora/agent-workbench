/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  contextRiskSchema,
  nextActionSchema,
  plannedValidationCommandSchema,
  projectUnitEvidenceSchema,
  skippedPathSchema,
  validationSkippedPathSummarySchema,
  staticFeedbackFindingSchema,
  staticFeedbackSchema,
  responseMetadataSchema,
  verificationPlanSchema,
  type ResponseEnvelope,
  type VerificationPlan
} from "../contracts/index.js";
import type { PlanVerificationResult } from "../application/use-cases/plan-verification.js";
import {
  invalidResponseMeta,
  makeTrustedEnvelope,
  presentNextActions,
  type PresentationSessionContext
} from "../application/use-cases/response-metadata.js";
import { redactPresentationText, sanitizePublicMcpFailureMessage } from "./redaction.js";

export function buildVerificationPlanEnvelope(
  result: PlanVerificationResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<VerificationPlan> {
  const data = sanitizeVerificationPlan(result.plan, context);
  const meta = responseMetadataSchema.strip().parse(result.meta);
  return makeTrustedEnvelope({
    data,
    meta,
    trust_policy: { surface_kind: "validation_plan" }
  });
}

export function buildInvalidVerificationPlanInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<VerificationPlan> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      status: "blocked",
      summary: "Verification plan input was invalid.",
      planned_commands: [],
      risks: [],
      next_actions: []
    },
    meta: invalidResponseMeta({ repoRoot: input.repoRoot }),
    trust_policy: { surface_kind: "validation_plan" },
    errors: [
      {
        code: "invalid_input",
        message: sanitizePublicMcpFailureMessage(
          input.message,
          "Verification-plan input was invalid; inspect the request and retry."
        ),
        retryable: false
      }
    ]
  });
}

function sanitizeVerificationPlan(
  plan: PlanVerificationResult["plan"],
  context: PresentationSessionContext
): VerificationPlan {
  return verificationPlanSchema.parse({
    repo_root: plan.repo_root,
    status: plan.status,
    summary: redactPresentationText(plan.summary, { context: "message" }),
    planned_commands: plan.planned_commands.map(sanitizePlannedCommand),
    project_units: plan.project_units?.map((unit) => sanitizeProjectUnit(unit, context)),
    static_feedback: plan.static_feedback === undefined ? undefined : sanitizeStaticFeedback(plan.static_feedback),
    risks: plan.risks.map(sanitizeRisk),
    skipped_path_summary: plan.skipped_path_summary === undefined
      ? undefined
      : sanitizeSkippedPathSummary(plan.skipped_path_summary),
    next_actions: presentNextActions(plan.next_actions, context).map(sanitizeNextAction),
    task: plan.task
  });
}

function sanitizeSkippedPath(input: NonNullable<PlanVerificationResult["plan"]["skipped_paths"]>[number]) {
  return skippedPathSchema.parse({
    path: redactPresentationText(input.path, { context: "path" }),
    reason: input.reason,
    detail: redactPresentationText(input.detail, { context: "message" })
  });
}

function sanitizeSkippedPathSummary(
  input: NonNullable<PlanVerificationResult["plan"]["skipped_path_summary"]>
) {
  return validationSkippedPathSummarySchema.parse({
    total_count: input.total_count,
    groups: input.groups.map((group) => ({
      reason: group.reason,
      count: group.count,
      sample_paths: group.sample_paths.map((samplePath) =>
        redactPresentationText(samplePath, { context: "path" })
      ),
      sample_truncated: group.sample_truncated
    })),
    count_basis: input.count_basis,
    source_truncated: input.source_truncated,
    actionable_paths: input.actionable_paths.map(sanitizeSkippedPath)
  });
}

function sanitizePlannedCommand(
  command: PlanVerificationResult["plan"]["planned_commands"][number]
) {
  return plannedValidationCommandSchema.parse({
    command: redactPresentationText(command.command, { context: "source" }),
    args: command.args.map((arg) => redactPresentationText(arg, { context: "source" })),
    display: redactPresentationText(command.display, { context: "source" }),
    reason: redactPresentationText(command.reason, { context: "message" }),
    status: command.status,
    execution: command.execution
  });
}

function sanitizeProjectUnit(
  unit: NonNullable<PlanVerificationResult["plan"]["project_units"]>[number],
  context: PresentationSessionContext
) {
  return projectUnitEvidenceSchema.parse({
    root: redactPresentationText(unit.root, { context: "path" }),
    kind: unit.kind,
    markers: unit.markers.map((marker) => ({
      path: redactPresentationText(marker.path, { context: "path" }),
      kind: marker.kind,
      evidence_source: marker.evidence_source,
      evidence_path: marker.evidence_path === undefined
        ? undefined
        : redactPresentationText(marker.evidence_path, { context: "path" })
    })),
    selection: unit.selection,
    boundary: unit.boundary,
    readiness: unit.readiness,
    blockers: unit.blockers.map((blocker) => ({
      kind: blocker.kind,
      unit_root: redactPresentationText(blocker.unit_root, { context: "path" }),
      evidence_paths: blocker.evidence_paths.map((evidencePath) =>
        redactPresentationText(evidencePath, { context: "path" })
      ),
      message: redactPresentationText(blocker.message, { context: "message" }),
      blocked_claims: blocker.blocked_claims,
      next_action: blocker.next_action === undefined
        ? undefined
        : presentNextActions([blocker.next_action], context).map(sanitizeNextAction)[0]
    })),
    planned_commands: unit.planned_commands.map(sanitizePlannedCommand)
  });
}

function sanitizeStaticFeedback(
  input: NonNullable<PlanVerificationResult["plan"]["static_feedback"]>
) {
  return staticFeedbackSchema.parse({
    status: input.status,
    checked_files: input.checked_files,
    findings: input.findings.map(sanitizeStaticFinding)
  });
}

function sanitizeStaticFinding(input: NonNullable<PlanVerificationResult["plan"]["static_feedback"]>["findings"][number]) {
  return staticFeedbackFindingSchema.parse({
    path: input.path,
    severity: input.severity,
    message: sanitizePublicMcpFailureMessage(
      input.message,
      "Static validation found an issue; inspect the finding category and suggested action."
    ),
    suggested_action: input.suggested_action
  });
}

function sanitizeRisk(input: PlanVerificationResult["plan"]["risks"][number]) {
  return contextRiskSchema.parse({
    severity: input.severity,
    message: redactPresentationText(input.message, { context: "message" }),
    why_this_matters: redactPresentationText(input.why_this_matters, { context: "message" })
  });
}

function sanitizeNextAction(input: PlanVerificationResult["plan"]["next_actions"][number]) {
  return nextActionSchema.parse({
    tool: input.tool,
    args: input.args,
    reason: input.reason === undefined
      ? undefined
      : redactPresentationText(input.reason, { context: "message" }),
    expected_evidence: input.expected_evidence === undefined
      ? undefined
      : redactPresentationText(input.expected_evidence, { context: "message" })
  });
}
