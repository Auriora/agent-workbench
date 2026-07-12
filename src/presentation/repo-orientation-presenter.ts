/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { OrientationReceipt, ResponseEnvelope } from "../contracts/index.js";
import type { GetRepoOrientationResult } from "../application/use-cases/get-repo-orientation.js";
import { invalidResponseMeta, makeTrustedEnvelope } from "../application/use-cases/response-metadata.js";

export function buildRepoOrientationEnvelope(
  result: GetRepoOrientationResult
): ResponseEnvelope<OrientationReceipt> {
  return makeTrustedEnvelope({
    data: result.orientation,
    meta: result.meta,
    trust_policy: { surface_kind: "repository_status" }
  });
}

export function buildInvalidRepoOrientationInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<OrientationReceipt> {
  return makeOrientationFailureEnvelope({
    repoRoot: input.repoRoot,
    message: input.message,
    code: "invalid_input",
    retryable: false,
    validity: "invalid"
  });
}

export function buildRepoOrientationProviderFailureEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<OrientationReceipt> {
  return makeOrientationFailureEnvelope({
    repoRoot: input.repoRoot,
    message: input.message,
    code: "provider_unavailable",
    retryable: true,
    validity: "invalid_due_to_environment"
  });
}

function makeOrientationFailureEnvelope(input: {
  repoRoot: string;
  message: string;
  code: "invalid_input" | "provider_unavailable";
  retryable: boolean;
  validity: "invalid" | "invalid_due_to_environment";
}): ResponseEnvelope<OrientationReceipt> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      freshness: "unknown",
      trust_summary: {
        analysis_validity: input.validity,
        capability_level: "unsupported",
        orientation_reusable: false
      },
      material_blockers: [input.message],
      detail_resources: ["repo:///status", "repo:///scope", "repo:///overview"],
      refresh_required: true,
      refresh_when: [
        "repository_root_changes",
        "scope_or_ignore_rules_change",
        "runtime_identity_changes",
        "policy_changes",
        "index_becomes_invalid"
      ],
      ordinary_content_edit_requires_refresh: false
    },
    meta: invalidResponseMeta({
      repoRoot: input.repoRoot,
      analysis_validity: input.validity
    }),
    trust_policy: { surface_kind: "repository_status" },
    errors: [{
      code: input.code,
      message: input.message,
      retryable: input.retryable
    }]
  });
}
