/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  integrationHealthSchema,
  type IntegrationHealth,
  type ResponseEnvelope
} from "../contracts/index.js";
import type { GetIntegrationHealthResult } from "../application/use-cases/get-integration-health.js";
import { invalidResponseMeta, makeTrustedEnvelope } from "../application/use-cases/response-metadata.js";

export function buildIntegrationHealthEnvelope(
  result: GetIntegrationHealthResult
): ResponseEnvelope<IntegrationHealth> {
  const parsed = integrationHealthSchema.safeParse(result.health);
  if (!parsed.success) {
    return buildIntegrationHealthProviderFailureEnvelope({
      repoRoot: result.health.repo_root,
      message: "Authoritative integration health is unavailable."
    });
  }
  return makeTrustedEnvelope({
    data: parsed.data,
    meta: result.meta,
    trust_policy: {
      surface_kind: result.errors?.length ? "generic_error" : "integration_health"
    },
    errors: result.errors
  });
}

export function buildInvalidIntegrationHealthInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<IntegrationHealth> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      runtime_version: "unknown",
      profile: "unknown",
      session: {
        discovery_state: "unknown",
        discovered_tools: [],
        discovered_resources: [],
        discovered_prompts: []
      },
      surfaces: [],
      counts: {
        available: 0,
        unavailable: 0,
        blocked: 0,
        hidden: 0,
        unknown: 0
      },
      next_actions: []
    },
    meta: invalidResponseMeta({ repoRoot: input.repoRoot }),
    trust_policy: { surface_kind: "generic_error" },
    errors: [
      {
        code: "invalid_input",
        message: input.message,
        retryable: false
      }
    ]
  });
}

export function buildIntegrationHealthProviderFailureEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<IntegrationHealth> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      runtime_version: "unknown",
      profile: "unknown",
      session: {
        discovery_state: "unknown",
        discovered_tools: [],
        discovered_resources: [],
        discovered_prompts: []
      },
      surfaces: [],
      counts: {
        available: 0,
        unavailable: 0,
        blocked: 0,
        hidden: 0,
        unknown: 0
      },
      next_actions: []
    },
    meta: invalidResponseMeta({
      repoRoot: input.repoRoot,
      analysis_validity: "invalid_due_to_environment"
    }),
    trust_policy: { surface_kind: "generic_error" },
    errors: [
      {
        code: "provider_unavailable",
        message: input.message,
        retryable: true
      }
    ]
  });
}
