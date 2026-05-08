import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllMcpSurfaces } from "./registries/index.js";

export function createAgentWorkbenchServer(repoRoot: string): McpServer {
  const server = new McpServer({
    name: "agent-workbench",
    version: "0.1.0"
  });

  registerAllMcpSurfaces(server, {
    repoRoot
  });

  return server;
}
