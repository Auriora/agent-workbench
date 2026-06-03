import { makeEnvelope, type ResponseEnvelope } from "../contracts/index.js";
import {
  type RuntimeStatus,
  type RuntimeStatusResult
} from "../application/use-cases/get-repo-status.js";

export type StatusPresentationPayload = {
  status: RuntimeStatus;
  meta: RuntimeStatusResult["meta"];
};

export function toStatusPresentationPayload(
  result: RuntimeStatusResult
): StatusPresentationPayload {
  return {
    status: result.status,
    meta: result.meta
  };
}

export function buildStatusEnvelope(
  result: RuntimeStatusResult
): ResponseEnvelope<RuntimeStatus> {
  const payload = toStatusPresentationPayload(result);
  return makeEnvelope({
    data: payload.status,
    meta: payload.meta
  });
}

export function buildInvalidStatusInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<RuntimeStatus> {
  return makeEnvelope({
    data: {
      repo_root: input.repoRoot,
      runtime_state: "invalid",
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
      truncated: false,
      caveats: []
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
