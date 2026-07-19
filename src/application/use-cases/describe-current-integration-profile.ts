/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  CurrentIntegrationProfile,
  IntegrationProviderIdentity
} from "../../contracts/index.js";
import { AGENT_WORKBENCH_RUNTIME_VERSION } from "../../runtime/version.js";

export type CurrentIntegrationBinding = CurrentIntegrationProfile["mcp_bindings"][number];

export function describeCurrentIntegrationProfile(input: {
  provider_identity: IntegrationProviderIdentity;
  mcp_bindings: readonly CurrentIntegrationBinding[];
}): CurrentIntegrationProfile {
  return {
    provider: input.provider_identity.provider,
    provider_identity: input.provider_identity,
    profile_name: profileName(input.provider_identity.provider),
    runtime_version: AGENT_WORKBENCH_RUNTIME_VERSION,
    mcp_server_id: "agent-workbench",
    mcp_bindings: [...input.mcp_bindings]
  };
}

function profileName(provider: IntegrationProviderIdentity["provider"]): string {
  switch (provider) {
    case "codex":
      return "Agent Workbench Codex Integration";
    case "claude_code":
      return "Agent Workbench Claude Code Integration";
    case "kiro":
      return "Agent Workbench Kiro Integration";
    default:
      return "Agent Workbench Integration (provider unknown)";
  }
}
