import { makeEnvelope, type ResponseEnvelope } from "../contracts/index.js";
import {
  type RuntimeStatus,
  type RuntimeStatusResult
} from "../application/use-cases/get-repo-status.js";
import { invalidResponseMeta } from "../application/use-cases/response-metadata.js";

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
    meta: invalidResponseMeta({ repoRoot: input.repoRoot }),
    errors: [
      {
        code: "invalid_input",
        message: input.message,
        retryable: false
      }
    ]
  });
}
