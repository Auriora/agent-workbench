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
  return makeTrustedEnvelope({
    data: integrationHealthSchema.parse(result.health),
    meta: result.meta,
    trust_policy: { surface_kind: "integration_health" }
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
    trust_policy: { surface_kind: "integration_health" },
    errors: [
      {
        code: "invalid_input",
        message: input.message,
        retryable: false
      }
    ]
  });
}
