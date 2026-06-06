import {
  integrationHealthSchema,
  makeEnvelope,
  type IntegrationHealth,
  type ResponseEnvelope
} from "../contracts/index.js";
import type { GetIntegrationHealthResult } from "../application/use-cases/get-integration-health.js";
import { invalidResponseMeta } from "./metadata.js";

export function buildIntegrationHealthEnvelope(
  result: GetIntegrationHealthResult
): ResponseEnvelope<IntegrationHealth> {
  return makeEnvelope({
    data: integrationHealthSchema.parse(result.health),
    meta: result.meta
  });
}

export function buildInvalidIntegrationHealthInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<IntegrationHealth> {
  return makeEnvelope({
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
    errors: [
      {
        code: "invalid_input",
        message: input.message,
        retryable: false
      }
    ]
  });
}
