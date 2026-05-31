import { describe, expect, it } from "vitest";
import {
  createTelemetryAdapter,
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
});
