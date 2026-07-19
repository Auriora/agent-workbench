/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  IntegrationArtifactIdentity,
  IntegrationConnectionIdentity,
  IntegrationLauncherIdentity
} from "../../contracts/index.js";
import { AGENT_WORKBENCH_RUNTIME_VERSION } from "../../runtime/version.js";

export type McpClientApplicationIdentity = {
  name: string;
  version: string;
};

export function resolveIntegrationIdentity(input: {
  launcher?: IntegrationLauncherIdentity;
  client?: McpClientApplicationIdentity;
}): IntegrationConnectionIdentity {
  const provider = input.launcher?.provider ?? "unknown";
  const identities: IntegrationArtifactIdentity[] = [
    {
      artifact: "runtime",
      name: "@auriora/agent-workbench",
      version: AGENT_WORKBENCH_RUNTIME_VERSION,
      state: "observed",
      provenance: "package"
    },
    input.client === undefined
      ? unknownIdentity("mcp_client")
      : {
          artifact: "mcp_client",
          name: boundedValue(input.client.name, 200),
          version: boundedValue(input.client.version, 100),
          state: "observed",
          provenance: "initialize"
        },
    input.launcher?.plugin_name === undefined && input.launcher?.plugin_version === undefined
      ? unknownIdentity("provider_plugin")
      : {
          artifact: "provider_plugin",
          name: input.launcher.plugin_name,
          version: input.launcher.plugin_version,
          state: "observed",
          provenance: "manifest"
        },
    input.launcher?.cache_name === undefined && input.launcher?.cache_version === undefined
      ? unknownIdentity("client_cache")
      : {
          artifact: "client_cache",
          name: input.launcher.cache_name,
          version: input.launcher.cache_version,
          state: "observed",
          provenance: "cache"
        }
  ];

  return {
    provider_identity: {
      provider,
      state: input.launcher === undefined ? "unknown" : "configured",
      provenance: input.launcher === undefined ? "unknown" : "launcher"
    },
    identities
  };
}

function boundedValue(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

function unknownIdentity(
  artifact: IntegrationArtifactIdentity["artifact"]
): IntegrationArtifactIdentity {
  return {
    artifact,
    state: "unknown",
    provenance: "unknown"
  };
}
