/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TelemetryRecorderPort } from "../../ports/index.js";
import { instrumentMcpServer } from "./instrumentation.js";
import { registerAllMcpSurfaces } from "./registries/index.js";
import type { McpRegistryContext } from "./registries/index.js";
import { createRootAuthorityPolicy } from "./registries/root-authority.js";

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
    version: "0.1.0"
  });

  const rootAuthorityPolicy = context.rootAuthorityPolicy ?? createRootAuthorityPolicy({
    launchRoot: absoluteRepoRoot
  });

  registerAllMcpSurfaces(instrumentMcpServer({ server, telemetry: context.telemetry }), {
    repoRoot: absoluteRepoRoot,
    rootAuthorityPolicy,
    ...context
  });

  return server;
}
