import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { repoStatusResource } from "./resources/repo-status.js";

export type McpRegistryContext = {
  repoRoot: string;
};

export type McpResourceDeclaration = {
  kind: "resource";
  name: string;
  uri: string;
  register: (server: McpServer, context: McpRegistryContext) => void;
};

export type McpToolDeclaration = {
  kind: "tool";
  name: string;
  register: (server: McpServer, context: McpRegistryContext) => void;
};

export type McpPromptDeclaration = {
  kind: "prompt";
  name: string;
  register: (server: McpServer, context: McpRegistryContext) => void;
};

export const mcpResources: McpResourceDeclaration[] = [repoStatusResource];

export const mcpTools: McpToolDeclaration[] = [];

export const mcpPrompts: McpPromptDeclaration[] = [];

export function registerAllMcpSurfaces(
  server: McpServer,
  context: McpRegistryContext
): void {
  for (const resource of mcpResources) {
    resource.register(server, context);
  }

  for (const tool of mcpTools) {
    tool.register(server, context);
  }

  for (const prompt of mcpPrompts) {
    prompt.register(server, context);
  }
}
