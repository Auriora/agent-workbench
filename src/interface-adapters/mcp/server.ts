/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TelemetryRecorderPort } from "../../ports/index.js";
import { instrumentMcpServer } from "./instrumentation.js";
import {
  registerAllMcpSurfaces,
  registeredIntegrationBindings
} from "./registries/index.js";
import type { McpRegistryContext } from "./registries/index.js";
import { createRootAuthorityPolicy } from "./registries/root-authority.js";
import { AGENT_WORKBENCH_RUNTIME_VERSION } from "../../runtime/version.js";
import { describeCurrentIntegrationProfile } from "../../application/use-cases/describe-current-integration-profile.js";
import { resolveIntegrationIdentity } from "../../application/use-cases/resolve-integration-identity.js";

export const AGENT_WORKBENCH_MCP_INSTRUCTIONS = [
  "Use Agent Workbench before broad repository inspection: read repo:///orientation, follow its detailed resource links only as needed, then call context_for_task for task routing.",
  "If Agent Workbench tool schemas are deferred or not visible in the current client, discover them first with tool_search for agent-workbench context_for_task verification_plan diagnostics_for_files docs_search.",
  "Use verification_plan before validation commands and prefer symbol_search, find_references, impact, and docs tools for targeted follow-up evidence."
].join(" ");

export function createAgentWorkbenchServer(
  repoRoot: string,
  context: Partial<Omit<McpRegistryContext, "repoRoot">> & { telemetry?: TelemetryRecorderPort } = {}
): McpServer {
  const absoluteRepoRoot = createRootAuthorityPolicy({
    launchRoot: repoRoot,
    debugRepoRootOverride: context.rootAuthorityPolicy?.debugRepoRootOverride
  }).launchRoot;
  const server = new McpServer({
    name: "agent-workbench",
    version: AGENT_WORKBENCH_RUNTIME_VERSION
  }, {
    instructions: AGENT_WORKBENCH_MCP_INSTRUCTIONS
  });

  const rootAuthorityPolicy = context.rootAuthorityPolicy ?? createRootAuthorityPolicy({
    launchRoot: absoluteRepoRoot
  });

  const getConnectionIdentity = () => resolveIntegrationIdentity({
    launcher: context.launcherIdentity,
    client: server.server.getClientVersion()
  });

  registerAllMcpSurfaces(instrumentMcpServer({ server, telemetry: context.telemetry }), {
    repoRoot: absoluteRepoRoot,
    rootAuthorityPolicy,
    getConnectionIdentity,
    describeCurrentIntegrationProfile: () => describeCurrentIntegrationProfile({
      provider_identity: getConnectionIdentity().provider_identity,
      mcp_bindings: registeredIntegrationBindings()
    }),
    ...context
  });

  return server;
}
