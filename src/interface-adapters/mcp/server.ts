import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TelemetryAdapter } from "../../infrastructure/telemetry/index.js";
import { instrumentMcpServer } from "./instrumentation.js";
import { registerAllMcpSurfaces } from "./registries/index.js";
import type { McpRegistryContext } from "./registries/index.js";

export function createAgentWorkbenchServer(
  repoRoot: string,
  context: Partial<Omit<McpRegistryContext, "repoRoot">> & { telemetry?: TelemetryAdapter } = {}
): McpServer {
  const server = new McpServer({
    name: "agent-workbench",
    version: "0.1.0"
  });

  registerAllMcpSurfaces(instrumentMcpServer({ server, telemetry: context.telemetry }), {
    repoRoot,
    ...context
  });

  return server;
}
