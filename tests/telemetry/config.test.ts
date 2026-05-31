import { describe, expect, it } from "vitest";
import {
  createTelemetryAdapter,
  InMemoryTelemetryAdapter,
  telemetryConfigFromEnv
} from "../../src/infrastructure/telemetry/index.js";

describe("telemetry configuration", () => {
  it("is disabled by default", async () => {
    const config = telemetryConfigFromEnv({});
    const adapter = createTelemetryAdapter(config);

    expect(config).toEqual({
      enabled: false,
      destination: "none",
      serviceName: "agent-workbench",
      endpoint: undefined
    });
    adapter.record("test.event", { ok: true });
    expect(await adapter.flush()).toBeUndefined();
  });

  it("uses OTLP HTTP destination when enabled", () => {
    const config = telemetryConfigFromEnv({
      AGENT_WORKBENCH_OTEL_ENABLED: "true",
      AGENT_WORKBENCH_OTEL_DESTINATION: "otlp_http",
      AGENT_WORKBENCH_OTEL_ENDPOINT: "http://jaeger:4318/v1/traces",
      AGENT_WORKBENCH_OTEL_SERVICE_NAME: "agent-workbench-test"
    });

    expect(config).toEqual({
      enabled: true,
      destination: "otlp_http",
      endpoint: "http://jaeger:4318/v1/traces",
      serviceName: "agent-workbench-test"
    });
  });

  it("keeps exporter construction opt-in", () => {
    const adapter = createTelemetryAdapter({
      enabled: false,
      destination: "otlp_http",
      endpoint: "http://jaeger:4318/v1/traces",
      serviceName: "agent-workbench-test"
    });

    expect(adapter.constructor.name).toBe("NoopTelemetryAdapter");
  });

  it("supports an in-memory adapter for contract tests without durable usage records", () => {
    const adapter = new InMemoryTelemetryAdapter();

    adapter.record("mcp.tool.dispatch", {
      surface_name: "context_for_task",
      duration_ms: 3,
      row_limit: 10
    });
    adapter.recordError(new Error("boom"), {
      surface_name: "context_for_task"
    });

    expect(adapter.records).toEqual([
      expect.objectContaining({
        name: "mcp.tool.dispatch",
        properties: expect.objectContaining({
          surface_name: "context_for_task",
          duration_ms: 3,
          row_limit: 10
        })
      }),
      expect.objectContaining({
        name: "error",
        properties: expect.objectContaining({
          surface_name: "context_for_task",
          error_name: "Error",
          error_message: "boom"
        })
      })
    ]);
  });
});
