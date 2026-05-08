import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildColdStatus } from "../runtime/status.js";

export function createAgentWorkbenchServer(repoRoot: string): McpServer {
  const server = new McpServer({
    name: "agent-workbench",
    version: "0.1.0"
  });

  server.resource("status", "repo:///status", async () => ({
    contents: [
      {
        uri: "repo:///status",
        mimeType: "application/json",
        text: JSON.stringify(buildColdStatus(repoRoot), null, 2)
      }
    ]
  }));

  return server;
}
