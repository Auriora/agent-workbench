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
      const invalidInputCount = envelope.errors.filter((error) => isInvalidInputError(error)).length;
      const degradedModeCount = isDegradedMode(
        envelope.meta?.analysis_validity,
        envelope.runtime_state
      )
        ? 1
        : 0;

      input.telemetry.record(input.eventName, {
        surface_kind: input.surfaceKind,
        surface_name: input.surfaceName,
        ...(input.uri === undefined ? {} : { uri: input.uri }),
        outcome: envelope.errors.length > 0 ? "blocked" : "ok",
        analysis_validity: envelope.meta?.analysis_validity,
        verification_status: envelope.meta?.verification_status,
        error_count: envelope.errors.length,
        warning_count: envelope.warnings.length,
        invalid_input_count: invalidInputCount,
        degraded_mode_count: degradedModeCount,
        runtime_state: envelope.runtime_state,
        cache_state: envelope.cache_state,
        quiet_feedback_suppression_count: countQuietFeedbackSuppressions(envelope.warnings),
        repo_root: envelope.repo_root,
        status: envelope.status,
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
        invalid_input_count: 0,
        degraded_mode_count: 0,
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
  runtime_state?: unknown;
  cache_state?: unknown;
  repo_root?: unknown;
  status?: unknown;
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
      data?: unknown;
    };
    const meta = typeof parsed.meta === "object" && parsed.meta !== null ? parsed.meta : undefined;
    const data = typeof parsed.data === "object" && parsed.data !== null ? parsed.data : undefined;
    const cacheState =
      data !== undefined && data !== null && typeof data === "object" && "cache_state" in data
        ? (data as { cache_state?: unknown }).cache_state
        : undefined;
    const runtimeState =
      data !== undefined && data !== null && typeof data === "object" && "runtime_state" in data
        ? (data as { runtime_state?: unknown }).runtime_state
        : undefined;
    const repoRoot =
      data !== undefined && data !== null && typeof data === "object" && "repo_root" in data
        ? (data as { repo_root?: unknown }).repo_root
        : undefined;
    const status =
      data !== undefined && data !== null && typeof data === "object" && "status" in data
        ? (data as { status?: unknown }).status
        : undefined;

    return {
      meta: meta as ReturnType<typeof extractResponseEnvelope>["meta"],
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      cache_state: cacheState,
      runtime_state: runtimeState,
      repo_root: repoRoot ?? extractNestedDataValue(data, "repo_root"),
      status: status ?? extractNestedDataValue(data, "status")
    };
  } catch (_error) {
    return { errors: [], warnings: [] };
  }
}

function extractNestedDataValue(data: unknown, key: "repo_root" | "status"): unknown {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }
  for (const value of Object.values(data)) {
    if (typeof value === "object" && value !== null && key in value) {
      return (value as Record<string, unknown>)[key];
    }
  }
  return undefined;
}

function isInvalidInputError(error: unknown): boolean {
  return Boolean(
    typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "invalid_input"
  );
}

function isDegradedMode(
  analysisValidity: unknown,
  runtimeState: unknown
): boolean {
  return (
    analysisValidity === "partial" ||
    analysisValidity === "invalid" ||
    analysisValidity === "invalid_due_to_environment" ||
    runtimeState === "partial" ||
    runtimeState === "invalid" ||
    runtimeState === "invalid_due_to_environment"
  );
}

function countQuietFeedbackSuppressions(warnings: unknown[]): number {
  return warnings.filter((warning) => {
    return (
      typeof warning === "object" && warning !== null &&
      ((warning as { code?: unknown }).code === "quiet_feedback_suppressed" ||
        (warning as { code?: unknown }).code === "quiet_feedback")
    );
  }).length;
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
