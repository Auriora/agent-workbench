import { makeEnvelope, type ResponseEnvelope, type VerificationPlan } from "../contracts/index.js";
import type { PlanVerificationResult } from "../application/use-cases/plan-verification.js";

export function buildVerificationPlanEnvelope(
  result: PlanVerificationResult
): ResponseEnvelope<VerificationPlan> {
  return makeEnvelope({
    data: result.plan,
    meta: result.meta
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
