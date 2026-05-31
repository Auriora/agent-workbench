import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TelemetryAdapter } from "../../infrastructure/telemetry/index.js";

type ToolHandler = (args: unknown) => Promise<unknown> | unknown;
type ResourceHandler = (request: unknown) => Promise<unknown> | unknown;
type ServerRegistrationTarget = Record<PropertyKey, unknown> & {
  tool: (
    name: string,
    description: string,
    shape: unknown,
    handler: ToolHandler
  ) => unknown;
  resource: (name: string, uri: string, handler: ResourceHandler) => unknown;
};

export function instrumentMcpServer(input: {
  server: McpServer;
  telemetry?: TelemetryAdapter;
}): McpServer {
  if (input.telemetry === undefined) {
    return input.server;
  }

  const telemetry = input.telemetry;
  return new Proxy(input.server as unknown as ServerRegistrationTarget, {
    get(target, property, receiver) {
      if (property === "tool") {
        return (name: string, description: string, shape: unknown, handler: ToolHandler) =>
          target.tool(
            name,
            description,
            shape,
            instrumentHandler({
              telemetry,
              eventName: "mcp.tool.dispatch",
              surfaceKind: "tool",
              surfaceName: name,
              handler
            })
          );
      }

      if (property === "resource") {
        return (name: string, uri: string, handler: ResourceHandler) =>
          target.resource(
            name,
            uri,
            instrumentHandler({
              telemetry,
              eventName: "mcp.resource.dispatch",
              surfaceKind: "resource",
              surfaceName: name,
              uri,
              handler
            })
          );
      }

      return Reflect.get(target, property, receiver);
    }
  }) as unknown as McpServer;
}

function instrumentHandler(input: {
  telemetry: TelemetryAdapter;
  eventName: string;
  surfaceKind: "tool" | "resource";
  surfaceName: string;
  uri?: string;
  handler: ToolHandler | ResourceHandler;
}) {
  return async (args: unknown) => {
    const startedAt = Date.now();
    try {
      const response = await input.handler(args);
      const envelope = extractResponseEnvelope(response);
      input.telemetry.record(input.eventName, {
        surface_kind: input.surfaceKind,
        surface_name: input.surfaceName,
        ...(input.uri === undefined ? {} : { uri: input.uri }),
        outcome: envelope.errors.length > 0 ? "blocked" : "ok",
        analysis_validity: envelope.meta?.analysis_validity,
        verification_status: envelope.meta?.verification_status,
        error_count: envelope.errors.length,
        warning_count: envelope.warnings.length,
        truncated: envelope.meta?.truncated,
        row_limit: envelope.meta?.budget?.row_limit,
        traversal_depth: envelope.meta?.budget?.traversal_depth,
        source_byte_limit: envelope.meta?.budget?.source_byte_limit,
        duration_ms: Date.now() - startedAt
      });
      return response;
    } catch (error) {
      input.telemetry.recordError(error, {
        surface_kind: input.surfaceKind,
        surface_name: input.surfaceName,
        ...(input.uri === undefined ? {} : { uri: input.uri }),
        duration_ms: Date.now() - startedAt
      });
      throw error;
    }
  };
}

function extractResponseEnvelope(response: unknown): {
  meta?: {
    analysis_validity?: unknown;
    verification_status?: unknown;
    truncated?: unknown;
    budget?: {
      row_limit?: unknown;
      traversal_depth?: unknown;
      source_byte_limit?: unknown;
    };
  };
  errors: unknown[];
  warnings: unknown[];
} {
  const text = extractResponseText(response);
  if (text === undefined) {
    return { errors: [], warnings: [] };
  }
  try {
    const parsed = JSON.parse(text) as {
      meta?: unknown;
      errors?: unknown;
      warnings?: unknown;
    };
    const meta = typeof parsed.meta === "object" && parsed.meta !== null ? parsed.meta : undefined;
    return {
      meta: meta as ReturnType<typeof extractResponseEnvelope>["meta"],
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : []
    };
  } catch (_error) {
    return { errors: [], warnings: [] };
  }
}

function extractResponseText(response: unknown): string | undefined {
  if (typeof response !== "object" || response === null) {
    return undefined;
  }

  const maybeToolResponse = response as {
    content?: Array<{ text?: unknown }>;
    contents?: Array<{ text?: unknown }>;
  };
  const text = maybeToolResponse.content?.[0]?.text ?? maybeToolResponse.contents?.[0]?.text;
  return typeof text === "string" ? text : undefined;
}
