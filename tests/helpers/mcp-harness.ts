import type {
  McpRegistryContext,
  McpResourceDeclaration,
  McpToolDeclaration
} from "../../src/interface-adapters/mcp/registries/index.js";

export type RegisteredMcpContentResponse = {
  content: Array<{
    type: string;
    text: string;
  }>;
};

export type RegisteredMcpResourceResponse = {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text: string;
  }>;
};

export type RegisteredMcpTool = {
  name: string;
  description: string;
  handler: (args: unknown) => Promise<RegisteredMcpContentResponse>;
};

export type RegisteredMcpResource = {
  name: string;
  uri: string;
  handler: (request: unknown) => Promise<RegisteredMcpResourceResponse>;
  readCallback: (request: unknown) => Promise<RegisteredMcpResourceResponse>;
};

type ComposedMcpServer = {
  _registeredTools?: Record<string, RegisteredMcpTool>;
  _registeredResources?: Record<string, RegisteredMcpResource>;
};

export function registerMcpTool(
  tool: McpToolDeclaration,
  context: Partial<McpRegistryContext>,
  repoRoot = "/repo"
): RegisteredMcpTool {
  let registered: RegisteredMcpTool | undefined;
  const server = {
    tool(
      name: string,
      description: string,
      _shape: unknown,
      handler: RegisteredMcpTool["handler"]
    ) {
      registered = { name, description, handler };
    }
  };

  tool.register(server as never, { repoRoot, ...context });
  if (!registered) {
    throw new Error(`MCP tool ${tool.name} did not register.`);
  }
  return registered;
}

export function registerMcpResource(
  resource: McpResourceDeclaration,
  context: Partial<McpRegistryContext>,
  repoRoot = "/repo"
): RegisteredMcpResource {
  let registered: RegisteredMcpResource | undefined;
  const server = {
    resource(
      name: string,
      uri: string,
      readCallback: RegisteredMcpResource["readCallback"]
    ) {
      registered = { name, uri, handler: readCallback, readCallback };
    }
  };

  resource.register(server as never, { repoRoot, ...context });
  if (!registered) {
    throw new Error(`MCP resource ${resource.name} did not register.`);
  }
  return registered;
}

export function registeredToolNames(server: unknown): string[] {
  return Object.keys(asComposedMcpServer(server)._registeredTools ?? {}).sort();
}

export function registeredResourceUris(server: unknown): string[] {
  return Object.keys(asComposedMcpServer(server)._registeredResources ?? {}).sort();
}

export function getRegisteredTool(server: unknown, name: string): RegisteredMcpTool {
  const registered = asComposedMcpServer(server)._registeredTools?.[name];
  if (!registered) {
    throw new Error(`MCP tool ${name} was not registered.`);
  }
  return registered;
}

export function getRegisteredResource(server: unknown, uri: string): RegisteredMcpResource {
  const registered = asComposedMcpServer(server)._registeredResources?.[uri];
  if (!registered) {
    throw new Error(`MCP resource ${uri} was not registered.`);
  }
  return registered;
}

export function parseMcpTextContent<T>(response: RegisteredMcpContentResponse): T {
  return JSON.parse(response.content[0]?.text ?? "{}") as T;
}

export function parseMcpResourceText<T>(response: RegisteredMcpResourceResponse): T {
  return JSON.parse(response.contents[0]?.text ?? "{}") as T;
}

function asComposedMcpServer(server: unknown): ComposedMcpServer {
  return server as ComposedMcpServer;
}
