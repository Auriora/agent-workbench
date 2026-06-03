import {
  makeEnvelope,
  contextRiskSchema,
  nextActionSchema,
  plannedValidationCommandSchema,
  staticFeedbackFindingSchema,
  staticFeedbackSchema,
  responseMetadataSchema,
  verificationPlanSchema,
  type ResponseEnvelope,
  type VerificationPlan
} from "../contracts/index.js";
import type { PlanVerificationResult } from "../application/use-cases/plan-verification.js";

export function buildVerificationPlanEnvelope(
  result: PlanVerificationResult
): ResponseEnvelope<VerificationPlan> {
  const data = sanitizeVerificationPlan(result.plan);
  const meta = responseMetadataSchema.strip().parse(result.meta);
  return makeEnvelope({
    data,
    meta
  });
}

export function buildInvalidVerificationPlanInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<VerificationPlan> {
  return makeEnvelope({
    data: {
      repo_root: input.repoRoot,
      status: "blocked",
      summary: "Verification plan input was invalid.",
      planned_commands: [],
      risks: [],
      next_actions: []
    },
    meta: {
      analysis_validity: "invalid",
      freshness: "unknown",
      scope: {
        repo_root: input.repoRoot,
        indexed_roots: [],
        skipped_roots: [],
        languages: []
      },
      capability_level: "unsupported",
      evidence_kinds: [],
      verification_status: "blocked",
      truncated: false
    },
    errors: [
      {
        code: "invalid_input",
        message: input.message,
        retryable: false
      }
    ]
  });
}

function sanitizeVerificationPlan(plan: PlanVerificationResult["plan"]): VerificationPlan {
  return verificationPlanSchema.parse({
    repo_root: plan.repo_root,
    status: plan.status,
    summary: plan.summary,
    planned_commands: plan.planned_commands.map(sanitizePlannedCommand),
    static_feedback: plan.static_feedback === undefined ? undefined : sanitizeStaticFeedback(plan.static_feedback),
    risks: plan.risks.map(sanitizeRisk),
    next_actions: plan.next_actions.map(sanitizeNextAction),
    task: plan.task
  });
}

function sanitizePlannedCommand(
  command: PlanVerificationResult["plan"]["planned_commands"][number]
) {
  return plannedValidationCommandSchema.parse({
    command: command.command,
    args: command.args,
    display: command.display,
    reason: command.reason,
    status: command.status,
    execution: command.execution
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
    message: input.message,
    suggested_action: input.suggested_action
  });
}

function sanitizeRisk(input: PlanVerificationResult["plan"]["risks"][number]) {
  return contextRiskSchema.parse({
    severity: input.severity,
    message: input.message,
    why_this_matters: input.why_this_matters
  });
}

function sanitizeNextAction(input: PlanVerificationResult["plan"]["next_actions"][number]) {
  return nextActionSchema.parse({
    tool: input.tool,
    args: input.args
  });
}
