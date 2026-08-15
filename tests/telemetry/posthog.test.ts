/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { gunzipSync } from "node:zlib";
import { PostHog } from "posthog-node";
import { describe, expect, it, vi } from "vitest";
import { AGENT_WORKBENCH_RUNTIME_VERSION } from "../../src/runtime/version.js";
import {
  CompositeTelemetryAdapter,
  createRuntimeTelemetryAdapter,
  InMemoryTelemetryAdapter
} from "../../src/infrastructure/telemetry/index.js";
import type { TelemetryRecorderPort } from "../../src/ports/index.js";
import {
  createPostHogTelemetryAdapter,
  DISTRIBUTION_DEFAULT_POSTHOG_ANALYTICS_CONFIG,
  POSTHOG_EU_INGESTION_HOST,
  postHogAnalyticsConfigFromEnv,
  sanitizePostHogEvent,
  type PostHogCaptureClient,
  type PostHogDistributionDefaults
} from "../../src/infrastructure/telemetry/posthog.js";

function createFakeClient(overrides: Partial<PostHogCaptureClient> = {}): {
  client: PostHogCaptureClient;
  captures: Array<Record<string, unknown>>;
  capturedExceptions: Array<{
    error: unknown;
    distinctId: string | undefined;
    additionalProperties: Record<string, unknown> | undefined;
  }>;
  shutdownCalls: number;
} {
  const captures: Array<Record<string, unknown>> = [];
  const capturedExceptions: Array<{
    error: unknown;
    distinctId: string | undefined;
    additionalProperties: Record<string, unknown> | undefined;
  }> = [];
  let shutdownCalls = 0;
  const client: PostHogCaptureClient = {
    capture(message) {
      captures.push(message as unknown as Record<string, unknown>);
    },
    captureException(error, distinctId, additionalProperties) {
      capturedExceptions.push({
        error,
        distinctId,
        additionalProperties
      });
    },
    async flush() {
      return undefined;
    },
    async shutdown() {
      shutdownCalls += 1;
    },
    on() {
      return undefined;
    },
    ...overrides
  };
  return {
    client,
    captures,
    capturedExceptions,
    get shutdownCalls() {
      return shutdownCalls;
    }
  };
}

describe("PostHog telemetry", () => {
  it("keeps analytics disabled by default and when credentials exist without explicit consent", () => {
    const disabledConfig = postHogAnalyticsConfigFromEnv({});
    const credentialsOnlyConfig = postHogAnalyticsConfigFromEnv({
      AGENT_WORKBENCH_POSTHOG_PROJECT_TOKEN: "phc_test_token",
      AGENT_WORKBENCH_POSTHOG_HOST: POSTHOG_EU_INGESTION_HOST
    });

    expect(disabledConfig).toEqual({
      enabled: false,
      status: "disabled"
    });
    expect(credentialsOnlyConfig).toEqual({
      enabled: false,
      status: "disabled"
    });
    expect(createPostHogTelemetryAdapter(disabledConfig)).toBeUndefined();
    expect(createPostHogTelemetryAdapter(credentialsOnlyConfig)).toBeUndefined();
  });

  it("keeps the raw TypeScript distribution default disabled until build replacement populates it", () => {
    expect(DISTRIBUTION_DEFAULT_POSTHOG_ANALYTICS_CONFIG).toEqual({ enabled: false });
    expect(postHogAnalyticsConfigFromEnv({})).toEqual({
      enabled: false,
      status: "disabled"
    });
  });

  it("accepts only the explicit EU analytics configuration", () => {
    const readyConfig = postHogAnalyticsConfigFromEnv({
      AGENT_WORKBENCH_ANALYTICS_ENABLED: "true",
      AGENT_WORKBENCH_POSTHOG_PROJECT_TOKEN: "phc_test_token",
      AGENT_WORKBENCH_POSTHOG_HOST: POSTHOG_EU_INGESTION_HOST
    });
    const invalidHostConfig = postHogAnalyticsConfigFromEnv({
      AGENT_WORKBENCH_ANALYTICS_ENABLED: "1",
      AGENT_WORKBENCH_POSTHOG_PROJECT_TOKEN: "phc_test_token",
      AGENT_WORKBENCH_POSTHOG_HOST: "https://us.i.posthog.com"
    });

    expect(readyConfig).toEqual({
      enabled: true,
      status: "ready",
      projectToken: "phc_test_token",
      host: POSTHOG_EU_INGESTION_HOST
    });
    expect(invalidHostConfig).toEqual({
      enabled: false,
      status: "invalid_host"
    });
    expect(createPostHogTelemetryAdapter(invalidHostConfig)).toBeUndefined();
  });

  it("uses configured distribution defaults when present and respects explicit runtime disablement", () => {
    const distributionDefaults: PostHogDistributionDefaults = {
      enabled: true,
      projectToken: "phc_distribution_token",
      host: POSTHOG_EU_INGESTION_HOST
    };

    expect(postHogAnalyticsConfigFromEnv({}, distributionDefaults)).toEqual({
      enabled: true,
      status: "ready",
      projectToken: "phc_distribution_token",
      host: POSTHOG_EU_INGESTION_HOST
    });
    expect(postHogAnalyticsConfigFromEnv({
      AGENT_WORKBENCH_ANALYTICS_ENABLED: "false"
    }, distributionDefaults)).toEqual({
      enabled: false,
      status: "disabled"
    });
    expect(postHogAnalyticsConfigFromEnv({
      AGENT_WORKBENCH_ANALYTICS_ENABLED: "0"
    }, distributionDefaults)).toEqual({
      enabled: false,
      status: "disabled"
    });
  });

  it("merges runtime consent with env overrides and rejects invalid hosts without falling back", () => {
    const distributionDefaults: PostHogDistributionDefaults = {
      enabled: true,
      projectToken: "phc_distribution_token",
      host: POSTHOG_EU_INGESTION_HOST
    };

    expect(postHogAnalyticsConfigFromEnv({
      AGENT_WORKBENCH_ANALYTICS_ENABLED: "true"
    }, distributionDefaults)).toEqual({
      enabled: true,
      status: "ready",
      projectToken: "phc_distribution_token",
      host: POSTHOG_EU_INGESTION_HOST
    });
    expect(postHogAnalyticsConfigFromEnv({
      AGENT_WORKBENCH_ANALYTICS_ENABLED: "1",
      AGENT_WORKBENCH_POSTHOG_PROJECT_TOKEN: "phc_env_token"
    }, distributionDefaults)).toEqual({
      enabled: true,
      status: "ready",
      projectToken: "phc_env_token",
      host: POSTHOG_EU_INGESTION_HOST
    });
    expect(postHogAnalyticsConfigFromEnv({
      AGENT_WORKBENCH_ANALYTICS_ENABLED: "1",
      AGENT_WORKBENCH_POSTHOG_HOST: "https://us.i.posthog.com"
    }, distributionDefaults)).toEqual({
      enabled: false,
      status: "invalid_host"
    });
  });

  it("sanitizes event names and properties to the allowlist only", () => {
    const sanitized = sanitizePostHogEvent("mcp.tool.dispatch", {
      surface_kind: "tool",
      surface_name: "context_for_task",
      analysis_validity: "valid",
      verification_status: "verified",
      runtime_state: "warm",
      cache_state: "miss",
      status: "ok",
      post_edit_outcome: "deferred",
      boundary_name: "docs_rank",
      error_category: "type_error",
      outcome: "ok",
      truncated: true,
      markdown_audit_complete: false,
      markdown_audit_heading_count: 3,
      "markdown_audit_secret-repo-name": 1,
      error_count: 4.9,
      warning_count: 1,
      invalid_input_count: 2,
      degraded_mode_count: 0,
      quiet_feedback_suppression_count: 5,
      post_edit_deferred_check_count: 6,
      post_edit_deferred_reason_count: 7,
      row_limit: 10,
      traversal_depth: 2,
      source_byte_limit: 512,
      duration_ms: 320,
      repo_root: "/home/user/repo",
      uri: "file:///tmp/secret.md",
      path: "/tmp/secret.md",
      task: "find all the internal docs",
      query: "sensitive query",
      prompt: "sensitive prompt",
      source: "secret source",
      command: "cat ~/.ssh/id_rsa",
      env: "AWS_SECRET_ACCESS_KEY=value",
      token: "super_secret",
      nested: { prompt: "nope" },
      list: ["nope"],
      surface_slug: "not_allowlisted",
      boundary_kind: "not_for_tool_events",
      oversized: "x".repeat(500)
    });

    expect(sanitized).toEqual({
      event: "mcp.tool.dispatch",
      properties: {
        surface_kind: "tool",
        surface_name: "context_for_task",
        analysis_validity: "valid",
        verification_status: "verified",
        runtime_state: "warm",
        cache_state: "miss",
        status: "ok",
        post_edit_outcome: "deferred",
        boundary_name: "docs_rank",
        error_category: "type_error",
        outcome: "ok",
        truncated: true,
        markdown_audit_complete: false,
        error_count: 4,
        warning_count: 1,
        invalid_input_count: 2,
        degraded_mode_count: 0,
        quiet_feedback_suppression_count: 5,
        post_edit_deferred_check_count: 6,
        post_edit_deferred_reason_count: 7,
        row_limit: 10,
        traversal_depth: 2,
        source_byte_limit: 512,
        duration_bucket: "250_999ms",
        runtime_version: AGENT_WORKBENCH_RUNTIME_VERSION
      }
    });
    expect(sanitizePostHogEvent("docs.ranking.result", { outcome: "ok" })).toBeUndefined();
  });

  it("exposes token-free local configuration evidence for misconfiguration", () => {
    const runtime = createRuntimeTelemetryAdapter({
      env: {
        AGENT_WORKBENCH_ANALYTICS_ENABLED: "true"
      }
    });

    expect(runtime.configuration).toEqual({
      posthog: { status: "missing_configuration" },
      posthog_logs: { status: "disabled" }
    });
    expect(JSON.stringify(runtime.configuration)).not.toContain("token");
  });

  it("constructs personless captures and defensively filters SDK send payloads", () => {
    let capturedOptions:
      | {
          projectToken: string;
          options: Record<string, unknown>;
        }
      | undefined;
    const fake = createFakeClient();
    const adapter = createPostHogTelemetryAdapter(
      {
        enabled: true,
        status: "ready",
        projectToken: "phc_test_token",
        host: POSTHOG_EU_INGESTION_HOST
      },
      {
        runtimeId: "runtime-ephemeral-id",
        clientFactory(projectToken, options) {
          capturedOptions = {
            projectToken,
            options: options as unknown as Record<string, unknown>
          };
          return fake.client;
        }
      }
    );

    adapter?.record("mcp.resource.dispatch", {
      surface_kind: "resource",
      surface_name: "documentation_map",
      outcome: "ok",
      duration_ms: 8
    });

    expect(fake.captures).toEqual([{
      distinctId: "runtime-ephemeral-id",
      event: "mcp.resource.dispatch",
      properties: {
        surface_kind: "resource",
        surface_name: "documentation_map",
        outcome: "ok",
        duration_bucket: "lt_10ms",
        runtime_version: AGENT_WORKBENCH_RUNTIME_VERSION,
        $process_person_profile: false
      },
      disableGeoip: true,
      sendFeatureFlags: false
    }]);
    expect(capturedOptions?.projectToken).toBe("phc_test_token");
    expect(capturedOptions?.options.host).toBe(POSTHOG_EU_INGESTION_HOST);
    expect(capturedOptions?.options.enableExceptionAutocapture).toBe(false);
    expect(capturedOptions?.options.personProfiles).toBe("never");

    const beforeSend = capturedOptions?.options.before_send as
      | ((message: Record<string, unknown>) => unknown)
      | undefined;
    expect(typeof beforeSend).toBe("function");
    expect(
      beforeSend?.({
        distinctId: "user@example.com",
        event: "mcp.resource.dispatch",
        properties: {
          surface_kind: "resource",
          surface_name: "documentation_map",
          runtime_version: AGENT_WORKBENCH_RUNTIME_VERSION,
          duration_bucket: "lt_10ms",
          error_category: "type_error",
          repo_root: "/tmp/repo",
          prompt: "secret prompt",
          nested: { secret: true },
          "markdown_audit_private-repo": 1,
          $process_person_profile: true
        },
        disableGeoip: false,
        sendFeatureFlags: true
      })
    ).toEqual({
      distinctId: "runtime-ephemeral-id",
      event: "mcp.resource.dispatch",
      properties: {
        $process_person_profile: false,
        surface_kind: "resource",
        surface_name: "documentation_map",
        runtime_version: AGENT_WORKBENCH_RUNTIME_VERSION,
        duration_bucket: "lt_10ms",
        error_category: "type_error"
      },
      disableGeoip: true,
      sendFeatureFlags: false
    });
    expect(
      beforeSend?.({
        distinctId: "runtime-ephemeral-id",
        event: "posthog_exception_autocapture",
        properties: {
          $process_person_profile: true,
          stack: "/tmp/private.ts"
        }
      })
    ).toBeNull();
    expect(
      beforeSend?.({
        distinctId: "runtime-ephemeral-id",
        event: "$exception",
        properties: {
          error_category: "type_error"
        }
      })
    ).toBeNull();
  });

  it("routes recordError through synthetic captureException input with no sensitive error data", () => {
    const fake = createFakeClient();
    const adapter = createPostHogTelemetryAdapter(
      {
        enabled: true,
        status: "ready",
        projectToken: "phc_test_token",
        host: POSTHOG_EU_INGESTION_HOST
      },
      {
        runtimeId: "runtime-ephemeral-id",
        clientFactory: () => fake.client
      }
    );
    const first = new TypeError("file:///tmp/secret.txt exploded");
    first.stack = "TypeError: exploded\n at /tmp/secret.txt:1:1";
    const second = new TypeError("C:\\\\Users\\\\private\\\\doc.md exploded differently");
    second.stack = "TypeError: exploded differently\n at C:\\\\Users\\\\private\\\\doc.md:9:9";

    adapter?.recordError(first, {
      surface_kind: "tool",
      surface_name: "context_for_task",
      outcome: "failed",
      duration_ms: 1_200,
      repo_root: "/tmp/repo-one"
    });
    adapter?.recordError(second, {
      surface_kind: "tool",
      surface_name: "context_for_task",
      outcome: "failed",
      duration_ms: 1_200,
      repo_root: "/tmp/repo-two"
    });

    expect(fake.capturedExceptions).toHaveLength(2);
    expect(fake.capturedExceptions[0].distinctId).toBe("runtime-ephemeral-id");
    expect(fake.capturedExceptions[1].distinctId).toBe("runtime-ephemeral-id");
    expect(fake.capturedExceptions[0].additionalProperties).toEqual(fake.capturedExceptions[1].additionalProperties);
    expect(fake.capturedExceptions[0].additionalProperties).toEqual({
      surface_kind: "tool",
      surface_name: "context_for_task",
      outcome: "error",
      error_category: "type_error",
      duration_bucket: "1_4s",
      runtime_version: AGENT_WORKBENCH_RUNTIME_VERSION,
      $exception_fingerprint: ["type_error"],
      $exception_level: "error",
      $process_person_profile: false
    });

    const firstError = fake.capturedExceptions[0].error as Error;
    const secondError = fake.capturedExceptions[1].error as Error;
    expect(firstError).toBeInstanceOf(Error);
    expect(secondError).toBeInstanceOf(Error);
    expect(firstError).toEqual(secondError);
    expect(firstError.name).toBe("type_error");
    expect(firstError.message).toBe("agent_workbench_runtime_error");
    expect(firstError.stack).toBeUndefined();
    expect(secondError.stack).toBeUndefined();
  });

  it("rebuilds an allowlisted exception after the SDK removes its private origin marker", () => {
    let capturedOptions:
      | {
          projectToken: string;
          options: Record<string, unknown>;
        }
      | undefined;
    const fake = createFakeClient();
    createPostHogTelemetryAdapter(
      {
        enabled: true,
        status: "ready",
        projectToken: "phc_test_token",
        host: POSTHOG_EU_INGESTION_HOST
      },
      {
        runtimeId: "runtime-ephemeral-id",
        clientFactory(projectToken, options) {
          capturedOptions = {
            projectToken,
            options: options as unknown as Record<string, unknown>
          };
          return fake.client;
        }
      }
    );

    const beforeSend = capturedOptions?.options.before_send as
      | ((message: Record<string, unknown>) => unknown)
      | undefined;

    expect(
      beforeSend?.({
        distinctId: "private-user-id",
        event: "$exception",
        properties: {
          $exception_list: [{
            type: "TypeError",
            value: "file:///tmp/secret.txt exploded",
            mechanism: {
              handled: true,
              synthetic: false
            },
            stacktrace: {
              frames: [{
                filename: "/tmp/secret.txt",
                function: "secret"
              }]
            }
          }],
          $exception_fingerprint: ["type_error"],
          $exception_level: "error",
          error_category: "arbitrary_slug_that_must_not_override",
          surface_kind: "tool",
          surface_name: "context_for_task",
          outcome: "error",
          duration_bucket: "1_4s",
          runtime_version: AGENT_WORKBENCH_RUNTIME_VERSION,
          $process_person_profile: true,
          $feature_flag_called: true,
          repo_root: "/tmp/repo",
          stack: "/tmp/private.ts"
        }
      })
    ).toEqual({
      distinctId: "runtime-ephemeral-id",
      event: "$exception",
      properties: {
        $process_person_profile: false,
        $exception_list: [{
          type: "type_error",
          value: "agent_workbench_runtime_error"
        }],
        $exception_fingerprint: ["type_error"],
        $exception_level: "error",
        error_category: "type_error",
        surface_kind: "tool",
        surface_name: "context_for_task",
        outcome: "error",
        duration_bucket: "1_4s",
        runtime_version: AGENT_WORKBENCH_RUNTIME_VERSION
      },
      disableGeoip: true,
      sendFeatureFlags: false
    });
    expect(
      beforeSend?.({
        distinctId: "runtime-ephemeral-id",
        event: "$exception",
        properties: {
          $exception_fingerprint: ["../bad"],
          error_category: "type_error"
        }
      })
    ).toBeNull();
    expect(
      beforeSend?.({
        distinctId: "runtime-ephemeral-id",
        event: "$exception",
        properties: {
          $exception_fingerprint: ["private_but_slug_shaped_value"],
          error_category: "type_error"
        }
      })
    ).toBeNull();
    expect(fake.captures).toEqual([]);
  });

  it("delivers a sanitized exception through the installed PostHog SDK", async () => {
    const batches: unknown[] = [];
    const adapter = createPostHogTelemetryAdapter(
      {
        enabled: true,
        status: "ready",
        projectToken: "phc_test_token",
        host: POSTHOG_EU_INGESTION_HOST
      },
      {
        runtimeId: "runtime-ephemeral-id",
        shutdownTimeoutMs: 5_000,
        clientFactory(projectToken, options) {
          return new PostHog(projectToken, {
            ...options,
            host: "http://posthog.invalid",
            flushAt: 1,
            flushInterval: 0,
            async fetch(_url, request) {
              if (!(request.body instanceof Blob)) {
                throw new Error("Expected the PostHog SDK to send a compressed Blob");
              }
              const compressed = Buffer.from(await request.body.arrayBuffer());
              batches.push(JSON.parse(gunzipSync(compressed).toString("utf8")));
              return {
                status: 200,
                async text() { return ""; },
                async json() { return {}; }
              };
            }
          });
        }
      }
    );
    const rawError = new TypeError("PRIVATE_CANARY file:///tmp/secret.txt exploded");
    rawError.stack = "TypeError: PRIVATE_CANARY\n at /tmp/secret.txt:1:1";

    adapter?.recordError(rawError, {
      surface_kind: "tool",
      surface_name: "context_for_task",
      repo_root: "/tmp/private-repository"
    });
    await adapter?.shutdown();

    expect(batches).toHaveLength(1);
    expect(batches[0]).toMatchObject({
      batch: [{
        distinct_id: "runtime-ephemeral-id",
        event: "$exception",
        properties: {
          $process_person_profile: false,
          $exception_list: [{
            type: "type_error",
            value: "agent_workbench_runtime_error"
          }],
          $exception_fingerprint: ["type_error"],
          $exception_level: "error",
          error_category: "type_error",
          surface_kind: "tool",
          surface_name: "context_for_task",
          outcome: "error",
          runtime_version: AGENT_WORKBENCH_RUNTIME_VERSION,
          $geoip_disable: true
        }
      }]
    });
    const serialized = JSON.stringify(batches);
    expect(serialized).not.toContain("PRIVATE_CANARY");
    expect(serialized).not.toContain("secret.txt");
    expect(serialized).not.toContain("private-repository");
  });

  it("contains captureException, flush, and shutdown failures and shuts down only once", async () => {
    const captureFailureClient = createFakeClient({
      captureException() {
        throw new Error("capture exception failed");
      }
    });
    const captureFailureAdapter = createPostHogTelemetryAdapter(
      {
        enabled: true,
        status: "ready",
        projectToken: "phc_test_token",
        host: POSTHOG_EU_INGESTION_HOST
      },
      {
        runtimeId: "runtime-ephemeral-id",
        clientFactory: () => captureFailureClient.client
      }
    );

    expect(() =>
      captureFailureAdapter?.recordError(new Error("sensitive"), {
        surface_kind: "tool",
        surface_name: "context_for_task"
      })
    ).not.toThrow();
  });

  it("contains capture, flush, and shutdown failures and shuts down only once", async () => {
    const captureFailureClient = createFakeClient({
      capture() {
        throw new Error("capture failed");
      }
    });
    const captureFailureAdapter = createPostHogTelemetryAdapter(
      {
        enabled: true,
        status: "ready",
        projectToken: "phc_test_token",
        host: POSTHOG_EU_INGESTION_HOST
      },
      {
        runtimeId: "runtime-ephemeral-id",
        clientFactory: () => captureFailureClient.client
      }
    );

    expect(() =>
      captureFailureAdapter?.record("mcp.tool.dispatch", {
        surface_kind: "tool",
        surface_name: "context_for_task",
        outcome: "ok"
      })
    ).not.toThrow();

    const asyncFailureClient = createFakeClient({
      async flush() {
        throw new Error("flush failed");
      },
      async shutdown() {
        throw new Error("shutdown failed");
      }
    });
    const asyncFailureAdapter = createPostHogTelemetryAdapter(
      {
        enabled: true,
        status: "ready",
        projectToken: "phc_test_token",
        host: POSTHOG_EU_INGESTION_HOST
      },
      {
        runtimeId: "runtime-ephemeral-id",
        clientFactory: () => asyncFailureClient.client
      }
    );

    await expect(asyncFailureAdapter?.flush()).resolves.toBeUndefined();
    await expect(asyncFailureAdapter?.shutdown()).resolves.toBeUndefined();

    const idempotentClient = createFakeClient();
    const idempotentAdapter = createPostHogTelemetryAdapter(
      {
        enabled: true,
        status: "ready",
        projectToken: "phc_test_token",
        host: POSTHOG_EU_INGESTION_HOST
      },
      {
        runtimeId: "runtime-ephemeral-id",
        clientFactory: () => idempotentClient.client
      }
    );

    await Promise.all([idempotentAdapter?.shutdown(), idempotentAdapter?.shutdown()]);

    expect(idempotentClient.shutdownCalls).toBe(1);
  });

  it("isolates each destination in the composite adapter", async () => {
    const memory = new InMemoryTelemetryAdapter();
    const throwing: TelemetryRecorderPort = {
      record() { throw new Error("record failed"); },
      recordError() { throw new Error("recordError failed"); },
      flush() { throw new Error("flush failed"); },
      shutdown() { throw new Error("shutdown failed"); }
    };
    const composite = new CompositeTelemetryAdapter([throwing, memory]);

    expect(() => composite.record("mcp.tool.dispatch", { outcome: "ok" })).not.toThrow();
    expect(() => composite.recordError(new Error("private"), { outcome: "error" })).not.toThrow();
    await expect(composite.flush()).resolves.toBeUndefined();
    await expect(composite.shutdown()).resolves.toBeUndefined();
    expect(memory.records.map((record) => record.name)).toEqual(["mcp.tool.dispatch", "error"]);
  });

});
