/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { LogRecord, Logger } from "@opentelemetry/api-logs";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { InMemoryLogRecordExporter, LoggerProvider, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { describe, expect, it } from "vitest";
import { AGENT_WORKBENCH_RUNTIME_VERSION } from "../../src/runtime/version.js";
import { createRuntimeTelemetryAdapter, telemetryConfigFromEnv } from "../../src/infrastructure/telemetry/index.js";
import {
  createPostHogLogsTelemetryAdapter,
  POSTHOG_EU_LOGS_ENDPOINT,
  postHogLogsConfigFromEnv,
  type PostHogLogProvider
} from "../../src/infrastructure/telemetry/posthog-logs.js";
import { POSTHOG_EU_INGESTION_HOST, type PostHogAnalyticsConfig } from "../../src/infrastructure/telemetry/posthog.js";

const READY_ANALYTICS: PostHogAnalyticsConfig = {
  enabled: true,
  status: "ready",
  projectToken: "phc_test_token",
  host: POSTHOG_EU_INGESTION_HOST
};

function createFakeProvider(overrides: Partial<PostHogLogProvider> = {}): {
  provider: PostHogLogProvider;
  records: LogRecord[];
  flushCalls: number;
  shutdownCalls: number;
} {
  const records: LogRecord[] = [];
  let flushCalls = 0;
  let shutdownCalls = 0;
  const logger: Logger = {
    emit(record) { records.push(record); },
    enabled() { return true; }
  };
  const provider: PostHogLogProvider = {
    getLogger() { return logger; },
    async forceFlush() { flushCalls += 1; },
    async shutdown() { shutdownCalls += 1; },
    ...overrides
  };
  return {
    provider,
    records,
    get flushCalls() { return flushCalls; },
    get shutdownCalls() { return shutdownCalls; }
  };
}

describe("PostHog operational logs", () => {
  it("requires a separate logs opt-in and respects the analytics opt-out", () => {
    expect(postHogLogsConfigFromEnv({}, READY_ANALYTICS)).toEqual({
      enabled: false,
      status: "disabled",
      serviceName: "agent-workbench"
    });
    expect(postHogLogsConfigFromEnv({
      AGENT_WORKBENCH_POSTHOG_LOGS_ENABLED: "true"
    }, READY_ANALYTICS)).toEqual({
      enabled: true,
      status: "ready",
      projectToken: "phc_test_token",
      endpoint: POSTHOG_EU_LOGS_ENDPOINT,
      serviceName: "agent-workbench"
    });
    expect(postHogLogsConfigFromEnv({
      AGENT_WORKBENCH_POSTHOG_LOGS_ENABLED: "true",
      AGENT_WORKBENCH_ANALYTICS_ENABLED: "false"
    }, READY_ANALYTICS)).toEqual({
      enabled: false,
      status: "disabled",
      serviceName: "agent-workbench"
    });
    expect(postHogLogsConfigFromEnv({
      AGENT_WORKBENCH_POSTHOG_LOGS_ENABLED: "1"
    }, { enabled: false, status: "missing_configuration" })).toEqual({
      enabled: false,
      status: "missing_configuration",
      serviceName: "agent-workbench"
    });
  });

  it("emits only fixed actionable summaries with allowlisted scalar attributes", () => {
    const fake = createFakeProvider();
    const adapter = createPostHogLogsTelemetryAdapter(
      postHogLogsConfigFromEnv({ AGENT_WORKBENCH_POSTHOG_LOGS_ENABLED: "true" }, READY_ANALYTICS),
      { providerFactory: () => fake.provider }
    );

    adapter?.record("mcp.tool.dispatch", {
      surface_kind: "tool",
      surface_name: "context_for_task",
      outcome: "blocked",
      error_count: 2,
      duration_ms: 275,
      repo_root: "/private/repository",
      prompt: "PRIVATE_CANARY",
      nested: { token: "secret" }
    });
    adapter?.record("runtime.boundary", {
      boundary_kind: "worker",
      boundary_name: "parser_worker",
      outcome: "failed",
      source: "PRIVATE_CANARY"
    });
    adapter?.record("mcp.resource.dispatch", { outcome: "ok" });
    adapter?.record("unknown.event", { outcome: "failed" });

    expect(fake.records).toHaveLength(2);
    expect(fake.records[0]).toEqual({
      eventName: "agent_workbench.mcp_tool_attention",
      body: "agent_workbench.mcp_tool_attention",
      severityNumber: SeverityNumber.WARN,
      severityText: "WARN",
      attributes: {
        surface_kind: "tool",
        surface_name: "context_for_task",
        outcome: "blocked",
        error_count: 2,
        duration_bucket: "250_999ms",
        runtime_version: AGENT_WORKBENCH_RUNTIME_VERSION
      }
    });
    expect(fake.records[1]).toEqual({
      eventName: "agent_workbench.runtime_boundary_attention",
      body: "agent_workbench.runtime_boundary_attention",
      severityNumber: SeverityNumber.ERROR,
      severityText: "ERROR",
      attributes: {
        boundary_kind: "worker",
        boundary_name: "parser_worker",
        outcome: "failed",
        runtime_version: AGENT_WORKBENCH_RUNTIME_VERSION
      }
    });
    expect(JSON.stringify(fake.records)).not.toContain("PRIVATE_CANARY");
    expect(JSON.stringify(fake.records)).not.toContain("private/repository");
  });

  it("keeps exception capture solely in Error Tracking", () => {
    const fake = createFakeProvider();
    const adapter = createPostHogLogsTelemetryAdapter(
      postHogLogsConfigFromEnv({ AGENT_WORKBENCH_POSTHOG_LOGS_ENABLED: "true" }, READY_ANALYTICS),
      { providerFactory: () => fake.provider }
    );

    adapter?.recordError(new Error("PRIVATE_CANARY /private/file.ts"), {
      outcome: "error",
      surface_name: "context_for_task"
    });

    expect(fake.records).toEqual([]);
  });

  it("passes only configuration to the provider factory and contains lifecycle failures", async () => {
    let factoryInput: Record<string, unknown> | undefined;
    let flushAttempts = 0;
    let shutdownAttempts = 0;
    const fake = createFakeProvider({
      async forceFlush() { flushAttempts += 1; throw new Error("flush failed"); },
      async shutdown() { shutdownAttempts += 1; throw new Error("shutdown failed"); }
    });
    const adapter = createPostHogLogsTelemetryAdapter(
      postHogLogsConfigFromEnv({ AGENT_WORKBENCH_POSTHOG_LOGS_ENABLED: "true" }, READY_ANALYTICS),
      {
        providerFactory(input) {
          factoryInput = input;
          return fake.provider;
        }
      }
    );

    expect(factoryInput).toEqual({
      projectToken: "phc_test_token",
      endpoint: POSTHOG_EU_LOGS_ENDPOINT,
      serviceName: "agent-workbench"
    });
    await expect(adapter?.flush()).resolves.toBeUndefined();
    await expect(adapter?.shutdown()).resolves.toBeUndefined();
    await expect(adapter?.shutdown()).resolves.toBeUndefined();
    expect(flushAttempts).toBe(1);
    expect(shutdownAttempts).toBe(1);
  });

  it("composes independently from disabled OTEL traces", async () => {
    const fake = createFakeProvider();
    let providerCalls = 0;
    const runtime = createRuntimeTelemetryAdapter({
      env: { AGENT_WORKBENCH_POSTHOG_LOGS_ENABLED: "true" },
      postHogConfig: READY_ANALYTICS,
      postHogRuntimeId: "runtime-test",
      postHogClientFactory: () => ({
        capture() {},
        captureException() {},
        async flush() {},
        async shutdown() {}
      }),
      postHogLogProviderFactory: () => {
        providerCalls += 1;
        return fake.provider;
      }
    });

    expect(telemetryConfigFromEnv({ AGENT_WORKBENCH_POSTHOG_LOGS_ENABLED: "true" })).toEqual({
      enabled: false,
      destination: "none",
      serviceName: "agent-workbench"
    });
    expect(runtime.configuration.posthog_logs.status).toBe("ready");
    expect(providerCalls).toBe(1);
    runtime.record("mcp.resource.dispatch", { outcome: "blocked", surface_name: "workspace_status" });
    expect(fake.records).toHaveLength(1);
    await runtime.shutdown();
  });

  it("runs emitted records through a real OpenTelemetry logs provider without network access", async () => {
    const exporter = new InMemoryLogRecordExporter();
    const provider = new LoggerProvider({
      processors: [new SimpleLogRecordProcessor(exporter)]
    });
    const adapter = createPostHogLogsTelemetryAdapter(
      postHogLogsConfigFromEnv({ AGENT_WORKBENCH_POSTHOG_LOGS_ENABLED: "true" }, READY_ANALYTICS),
      { providerFactory: () => provider }
    );

    adapter?.record("runtime.boundary", {
      boundary_kind: "degraded_state",
      boundary_name: "snapshot_refresh",
      outcome: "degraded",
      error_message: "PRIVATE_CANARY"
    });
    await adapter?.flush();

    const records = exporter.getFinishedLogRecords();
    expect(records).toHaveLength(1);
    expect(records[0].body).toBe("agent_workbench.runtime_boundary_attention");
    expect(records[0].severityText).toBe("WARN");
    expect(records[0].attributes).toEqual({
      boundary_kind: "degraded_state",
      boundary_name: "snapshot_refresh",
      outcome: "degraded",
      runtime_version: AGENT_WORKBENCH_RUNTIME_VERSION
    });
    expect(JSON.stringify(records[0])).not.toContain("PRIVATE_CANARY");
    await adapter?.shutdown();
  });
});
