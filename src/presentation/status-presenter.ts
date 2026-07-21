/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  DOCUMENTATION_RANKING_REASON_MAX_BYTES,
  documentationRankingReceiptSchema,
  type ResponseEnvelope
} from "../contracts/index.js";
import {
  type RuntimeStatus,
  type RuntimeStatusResult
} from "../application/use-cases/get-repo-status.js";
import { invalidResponseMeta, makeTrustedEnvelope } from "../application/use-cases/response-metadata.js";
import { redactAndBoundPresentationText } from "./redaction.js";

export type StatusPresentationPayload = {
  status: RuntimeStatus;
  meta: RuntimeStatusResult["meta"];
};

export function toStatusPresentationPayload(
  result: RuntimeStatusResult
): StatusPresentationPayload {
  const documentationRanking = result.status.documentation_ranking;
  return {
    status: documentationRanking === undefined
      ? result.status
      : {
          ...result.status,
          documentation_ranking: documentationRankingReceiptSchema.parse({
            ...documentationRanking,
            reason: documentationRanking.reason === undefined
              ? undefined
              : redactAndBoundPresentationText(documentationRanking.reason, {
                  context: "message",
                  max_utf8_bytes: DOCUMENTATION_RANKING_REASON_MAX_BYTES
                })
          })
        },
    meta: result.meta
  };
}

export function buildStatusEnvelope(
  result: RuntimeStatusResult
): ResponseEnvelope<RuntimeStatus> {
  const payload = toStatusPresentationPayload(result);
  return makeTrustedEnvelope({
    data: payload.status,
    meta: payload.meta,
    trust_policy: { surface_kind: "repository_status" }
  });
}

export function buildInvalidStatusInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<RuntimeStatus> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      runtime_state: "invalid",
      freshness: "unknown",
      indexed_roots: [],
      skipped_roots: [],
      adapter_coverage: []
    },
    meta: invalidResponseMeta({ repoRoot: input.repoRoot }),
    trust_policy: { surface_kind: "repository_status" },
    errors: [
      {
        code: "invalid_input",
        message: input.message,
        retryable: false
      }
    ]
  });
}

export function buildStatusProviderFailureEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<RuntimeStatus> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      runtime_state: "invalid_due_to_environment",
      freshness: "unknown",
      indexed_roots: [],
      skipped_roots: [],
      adapter_coverage: [],
      reason: input.message
    },
    meta: invalidResponseMeta({
      repoRoot: input.repoRoot,
      analysis_validity: "invalid_due_to_environment"
    }),
    trust_policy: { surface_kind: "repository_status" },
    errors: [
      {
        code: "provider_unavailable",
        message: input.message,
        retryable: true
      }
    ]
  });
}
