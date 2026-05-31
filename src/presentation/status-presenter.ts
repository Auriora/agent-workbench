import { makeEnvelope, type ResponseEnvelope } from "../contracts/index.js";
import {
  type RuntimeStatus,
  type RuntimeStatusResult
} from "../application/use-cases/get-repo-status.js";

export type ColdStatusPresentationPayload = {
  status: RuntimeStatus;
  meta: RuntimeStatusResult["meta"];
};

export function toColdStatusPresentationPayload(
  result: RuntimeStatusResult
): ColdStatusPresentationPayload {
  return {
    status: result.status,
    meta: result.meta
  };
}

export function buildColdStatusEnvelope(
  result: RuntimeStatusResult
): ResponseEnvelope<RuntimeStatus> {
  const payload = toColdStatusPresentationPayload(result);
  return makeEnvelope({
    data: payload.status,
    meta: payload.meta
  });
}

export const buildStatusEnvelope = buildColdStatusEnvelope;

export function buildInvalidStatusInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<RuntimeStatus> {
  return makeEnvelope({
    data: {
      repo_root: input.repoRoot,
      freshness: "unknown",
      indexed_roots: [],
      skipped_roots: [],
      adapter_coverage: []
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
