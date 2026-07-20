/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type {
  IntegrationHealth,
  IntegrationHealthRequest,
  ResponseMetadata,
  SnapshotRefreshDiagnosticsReceipt
} from "../../src/contracts/index.js";
import {
  getIntegrationHealth,
  type GetIntegrationHealthResult
} from "../../src/application/use-cases/get-integration-health.js";
import { integrationHealthResource } from "../../src/interface-adapters/mcp/registries/resources/integration-health.js";
import { integrationHealthTool } from "../../src/interface-adapters/mcp/registries/tools/integration-health.js";
import { createAgentWorkbenchServer } from "../../src/server.js";
import {
  getRegisteredResource,
  parseMcpTextContent,
  registerMcpResource,
  registerMcpTool
} from "../helpers/mcp-harness.js";

describe("integration health MCP resource", () => {
  it("keeps static health free of caller-supplied pseudo-arguments", async () => {
    let parsedRequest: IntegrationHealthRequest | undefined;

    const registered = registerMcpResource(integrationHealthResource, {
      repoRoot: "/repo",
      getIntegrationHealth: ({ request }) => {
        parsedRequest = request;
        return healthResult(request.repo_root ?? "/missing", request);
      }
    });

    expect(registered).toMatchObject({
      name: "integration-health",
      uri: "integration:///health/agent-workbench"
    });
    expect(integrationHealthResource.metadata.parameters).toEqual([]);

    const response = await registered.handler({
      uri: "integration:///health/agent-workbench",
      client: "untrusted-resource-argument",
      discovery_state: "provided",
      discovered_tools: ["context_for_task"],
      discovered_resources: ["repo:///status"]
    });
    const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
      data: IntegrationHealth;
    };

    expect(parsedRequest).toMatchObject({
      repo_root: "/repo",
      discovery_state: "unknown",
      discovered_tools: [],
      discovered_resources: [],
      discovered_prompts: []
    });
    expect(parsedRequest).not.toHaveProperty("client");
    expect(parsed.data.repo_root).toBe("/repo");
    expect(parsed.data.surfaces[0]).toMatchObject({
      name: "context_for_task",
      status: "unknown",
      callable: "unknown"
    });
  });

  it("returns structured provider-not-configured state", async () => {
    const registered = registerMcpResource(integrationHealthResource, {
      repoRoot: "/repo"
    });

    const response = await registered.handler({});
    const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
      data: { profile: string; surfaces: unknown[] };
      errors: Array<{ code: string; message: string; retryable: boolean }>;
    };

    expect(parsed.data).toMatchObject({
      profile: "unknown",
      surfaces: []
    });
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        code: "provider_unavailable",
        message: "integration:///health/agent-workbench provider is not configured.",
        retryable: true
      })
    ]);
  });

  it("is exposed by the composed server and defaults discovery to unknown", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-health-"));
    try {
      const server = createAgentWorkbenchServer(repoRoot, {
        startupRefreshDelayMs: 60_000
      });

      const response = await getRegisteredResource(
        server,
        "integration:///health/agent-workbench"
      ).readCallback({});
      const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
        data: IntegrationHealth;
      };

      expect(parsed.data.repo_root).toBe(repoRoot);
      expect(parsed.data.root_policy).toEqual({
        authority: "launch_root",
        debug_repo_root_override: false
      });
      expect(parsed.data).toMatchObject({
        profile: "unknown",
        provider: "unknown",
        provider_identity: {
          provider: "unknown",
          state: "unknown",
          provenance: "unknown"
        }
      });
      expect(parsed.data.identities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ artifact: "runtime", provenance: "package" }),
          expect.objectContaining({ artifact: "mcp_client", state: "unknown" }),
          expect.objectContaining({ artifact: "provider_plugin", state: "unknown" }),
          expect.objectContaining({ artifact: "client_cache", state: "unknown" })
        ])
      );
      expect(parsed.data.session.discovery_state).toBe("unknown");
      expect(parsed.data.counts.unknown).toBeGreaterThan(0);
      expect(parsed.data.surfaces).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "integration-health",
            kind: "resource",
            status: "unknown",
            callable: "unknown"
          }),
          expect.objectContaining({
            name: "context_for_task",
            kind: "tool",
            status: "unknown",
            callable: "unknown"
          })
        ])
      );
      expect(parsed.data.next_actions).toEqual([]);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("awaits exactly one authoritative diagnostics receipt before responding", async () => {
    const deferred = controlledDeferred<SnapshotRefreshDiagnosticsReceipt>();
    let calls = 0;
    const registered = registerMcpResource(integrationHealthResource, {
      repoRoot: "/repo",
      getIntegrationHealth: ({ request }) => getIntegrationHealth({
        request,
        default_repo_root: "/repo",
        runtime_version: "0.5.2",
        profile: "codex",
        surfaces: [],
        daemon: {
          pid: 1234,
          socket_path: "/tmp/agent-workbench.sock",
          repo_root: "/repo",
          connected_clients: 1,
          diagnostics: {
            getDiagnostics: async () => {
              calls += 1;
              return await deferred.promise;
            }
          }
        }
      })
    });
    let settled = false;
    const responsePromise = registered.handler({}).then((response) => {
      settled = true;
      return response;
    });
    await Promise.resolve();
    expect(calls).toBe(1);
    expect(settled).toBe(false);

    deferred.resolve(idleDiagnostics());
    const parsed = JSON.parse((await responsePromise).contents[0]?.text ?? "{}") as {
      data: { daemon?: Record<string, unknown> };
    };
    expect(parsed.data.daemon).toMatchObject({
      controller_generation: 7,
      diagnostic_revision: 11,
      worker_invocations: 0,
      warmup_state: "idle",
      graph_freshness: "cold",
      activity_lease_held: false,
      worker_termination_state: "not_required"
    });
    expect(calls).toBe(1);
  });

  it("degrades safely when authoritative diagnostics reject", async () => {
    const sentinel = "/private/workspace/index.sqlite API_TOKEN=secret SELECT * FROM snapshots\n    at worker";
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const registered = registerMcpResource(integrationHealthResource, {
      repoRoot: "/repo",
      getIntegrationHealth: ({ request }) => getIntegrationHealth({
        request,
        default_repo_root: "/repo",
        runtime_version: "0.5.2",
        profile: "codex",
        surfaces: [],
        daemon: {
          pid: 1234,
          socket_path: "/tmp/agent-workbench.sock",
          repo_root: "/repo",
          connected_clients: 1,
          diagnostics: { getDiagnostics: async () => { throw new Error(sentinel); } }
        }
      })
    });
    const response = await registered.handler({});
    const stdoutCalls = stdout.mock.calls.length;
    const stderrCalls = stderr.mock.calls.length;
    stdout.mockRestore();
    stderr.mockRestore();
    const text = response.contents[0]?.text ?? "{}";
    const parsed = JSON.parse(text) as {
      data: { daemon?: unknown };
      meta: ResponseMetadata;
      errors: Array<{ code: string; message: string }>;
    };

    expect(text).not.toContain(sentinel);
    expect(JSON.stringify(parsed.meta)).not.toContain(sentinel);
    expect(stdoutCalls).toBe(0);
    expect(stderrCalls).toBe(0);
    expect(parsed.data.daemon).toBeUndefined();
    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid_due_to_environment",
      freshness: "unknown",
      verification_status: "blocked"
    });
    expect(parsed.meta.trust?.safe_to_use_for).not.toContain("runtime_availability");
    expect(parsed.meta.trust?.must_verify_by).toEqual(expect.arrayContaining([
      "refresh_runtime_snapshot",
      "resolve_blocked_environment"
    ]));
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        code: "provider_unavailable",
        message: "Authoritative refresh diagnostics are unavailable."
      })
    ]);
  });

  it("degrades safely when authoritative diagnostics return an illegal state pair", async () => {
    const registered = registerMcpResource(integrationHealthResource, {
      repoRoot: "/repo",
      getIntegrationHealth: ({ request }) => getIntegrationHealth({
        request,
        default_repo_root: "/repo",
        runtime_version: "0.5.2",
        profile: "codex",
        surfaces: [],
        daemon: {
          pid: 1234,
          socket_path: "/tmp/agent-workbench.sock",
          repo_root: "/repo",
          connected_clients: 1,
          diagnostics: {
            getDiagnostics: async () => ({
              ...idleDiagnostics(),
              graph_freshness: "fresh"
            })
          }
        }
      })
    });
    const parsed = JSON.parse((await registered.handler({})).contents[0]?.text ?? "{}") as {
      data: { daemon?: unknown };
      meta: ResponseMetadata;
      errors: Array<{ code: string; message: string }>;
    };
    expect(parsed.data.daemon).toBeUndefined();
    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid_due_to_environment",
      verification_status: "blocked"
    });
    expect(parsed.errors[0]).toEqual(expect.objectContaining({
      code: "provider_unavailable",
      message: "Authoritative refresh diagnostics are unavailable."
    }));
  });

  it("reports startup refresh over a fresh visible snapshot as authoritative refreshing health", async () => {
    const registered = registerMcpResource(integrationHealthResource, {
      repoRoot: "/repo",
      getIntegrationHealth: ({ request }) => getIntegrationHealth({
        request,
        default_repo_root: "/repo",
        runtime_version: "0.5.2",
        profile: "codex",
        surfaces: [],
        daemon: {
          pid: 1234,
          socket_path: "/tmp/agent-workbench.sock",
          repo_root: "/repo",
          connected_clients: 1,
          diagnostics: {
            getDiagnostics: async () => ({
              repo_identity: "/repo",
              controller_generation: 7,
              diagnostic_revision: 12,
              worker_invocations: 1,
              execution_id: "exec-startup",
              started_generation: 1,
              requested_generation: 1,
              target_snapshot_id: "snap-target",
              visible_snapshot_id: "snap-prior",
              execution_state: "running",
              publication_state: "building",
              graph_freshness: "fresh",
              activity_lease_held: true,
              worker_termination_state: "not_required"
            })
          }
        }
      })
    });

    const parsed = JSON.parse((await registered.handler({})).contents[0]?.text ?? "{}") as {
      data: { daemon?: { warmup_state?: string; graph_freshness?: string } };
      meta: ResponseMetadata;
      errors?: unknown[];
    };
    expect(parsed.data.daemon).toMatchObject({
      warmup_state: "running",
      graph_freshness: "fresh"
    });
    expect(parsed.meta).toMatchObject({ freshness: "refreshing", verification_status: "blocked" });
    expect(parsed.errors).toEqual([]);
  });

  it("reports a failed startup refresh as authoritative non-fresh health", async () => {
    const registered = registerMcpResource(integrationHealthResource, {
      repoRoot: "/repo",
      getIntegrationHealth: ({ request }) => getIntegrationHealth({
        request,
        default_repo_root: "/repo",
        runtime_version: "0.5.2",
        profile: "codex",
        surfaces: [],
        daemon: {
          pid: 1234,
          socket_path: "/tmp/agent-workbench.sock",
          repo_root: "/repo",
          connected_clients: 1,
          diagnostics: {
            getDiagnostics: async () => ({
              repo_identity: "/repo",
              controller_generation: 7,
              diagnostic_revision: 13,
              worker_invocations: 1,
              execution_id: "exec-startup",
              started_generation: 1,
              requested_generation: 1,
              target_snapshot_id: "snap-target",
              visible_snapshot_id: "snap-prior",
              execution_state: "failed",
              publication_state: "failed",
              graph_freshness: "stale",
              activity_lease_held: false,
              worker_termination_state: "confirmed",
              last_failure: {
                code: "worker_error",
                category: "worker",
                message: "Refresh worker failed.",
                execution_id: "exec-startup",
                target_snapshot_id: "snap-target",
                occurred_at: "2026-07-20T10:00:00.000Z"
              }
            })
          }
        }
      })
    });

    const parsed = JSON.parse((await registered.handler({})).contents[0]?.text ?? "{}") as {
      data: { daemon?: { warmup_state?: string; graph_freshness?: string; last_failure?: unknown } };
      meta: ResponseMetadata;
      errors: unknown[];
    };
    expect(parsed.data.daemon).toMatchObject({
      warmup_state: "failed",
      graph_freshness: "stale",
      last_failure: { code: "worker_error", message: "Refresh worker failed." }
    });
    expect(parsed.meta).toMatchObject({ freshness: "stale", verification_status: "blocked" });
    expect(parsed.errors).toEqual([]);
  });
});

describe("integration_health MCP tool", () => {
  it("validates caller evidence and passes connection identity to the shared health use case", async () => {
    const connectionIdentity = {
      provider_identity: {
        provider: "claude_code" as const,
        state: "configured" as const,
        provenance: "launcher" as const
      },
      identities: [
        {
          artifact: "runtime" as const,
          name: "@auriora/agent-workbench",
          version: "0.1.0",
          state: "observed" as const,
          provenance: "package" as const
        }
      ]
    };
    let captured: Parameters<NonNullable<Parameters<typeof registerMcpTool>[1]["getIntegrationHealth"]>>[0] | undefined;
    const registered = registerMcpTool(integrationHealthTool, {
      repoRoot: "/repo",
      getConnectionIdentity: () => connectionIdentity,
      getIntegrationHealth: (input) => {
        captured = input;
        return healthResult(input.request.repo_root ?? "/missing", input.request);
      }
    });

    const response = await registered.handler({
      client: "claude-code",
      discovery_state: "provided",
      discovered_tools: ["context_for_task"],
      discovered_resources: [],
      discovered_prompts: []
    });
    const parsed = parseMcpTextContent<{ data: IntegrationHealth }>(response);

    expect(captured).toMatchObject({
      request: {
        repo_root: "/repo",
        client: "claude-code",
        discovery_state: "provided",
        discovered_tools: ["context_for_task"]
      },
      connection_identity: connectionIdentity
    });
    expect(parsed.data.surfaces[0]).toMatchObject({
      name: "context_for_task",
      caller_discovery: "discovered",
      callable: "callable"
    });
  });

  it("publishes and enforces the canonical discovery-input bounds", async () => {
    let providerCalled = false;
    const registered = registerMcpTool(integrationHealthTool, {
      repoRoot: "/repo",
      getIntegrationHealth: ({ request }) => {
        providerCalled = true;
        return healthResult("/repo", request);
      }
    });
    const inputSchema = registered.inputSchema as Record<string, { safeParse(value: unknown): { success: boolean } }>;

    expect(inputSchema.client?.safeParse("x".repeat(201)).success).toBe(false);
    expect(inputSchema.discovered_tools?.safeParse(Array.from({ length: 201 }, () => "tool")).success).toBe(false);

    const response = await registered.handler({
      discovery_state: "provided",
      discovered_tools: ["x".repeat(301)]
    });
    const parsed = parseMcpTextContent<{ errors: Array<{ code: string; retryable: boolean }> }>(response);

    expect(providerCalled).toBe(false);
    expect(parsed.errors).toEqual([
      expect.objectContaining({ code: "invalid_input", retryable: false })
    ]);
  });

  it("redacts unexpected provider failures from the tool envelope", async () => {
    const sentinel = "/private/workspace/index.sqlite API_TOKEN=secret SELECT * FROM snapshots";
    const registered = registerMcpTool(integrationHealthTool, {
      repoRoot: "/repo",
      getIntegrationHealth: async () => { throw new Error(sentinel); }
    });
    const response = await registered.handler({ discovery_state: "unknown" });
    const text = response.content[0]?.text ?? "{}";
    const parsed = JSON.parse(text) as {
      meta: ResponseMetadata;
      errors: Array<{ code: string; message: string }>;
    };
    expect(text).not.toContain(sentinel);
    expect(parsed.meta.trust?.safe_to_use_for).not.toContain("runtime_availability");
    expect(parsed.errors[0]).toMatchObject({
      code: "internal_error",
      message: "Authoritative integration health is unavailable."
    });
  });
});

function idleDiagnostics(): SnapshotRefreshDiagnosticsReceipt {
  return {
    repo_identity: "/repo",
    controller_generation: 7,
    diagnostic_revision: 11,
    worker_invocations: 0,
    execution_state: "idle",
    graph_freshness: "cold",
    activity_lease_held: false,
    worker_termination_state: "not_required"
  };
}

function controlledDeferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => { resolve = promiseResolve; });
  return { promise, resolve };
}

function healthResult(
  repoRoot: string,
  request: IntegrationHealthRequest
): GetIntegrationHealthResult {
  const {
    client,
    discovery_state,
    discovered_tools,
    discovered_resources,
    discovered_prompts
  } = request;
  const contextDiscovered = discovery_state === "provided"
    && discovered_tools.includes("context_for_task");
  return {
    health: {
      repo_root: repoRoot,
      runtime_version: "0.1.0",
      profile: "codex",
      provider: "codex",
      provider_identity: {
        provider: "codex",
        state: "configured",
        provenance: "launcher"
      },
      identities: [
        {
          artifact: "runtime",
          name: "@auriora/agent-workbench",
          version: "0.1.0",
          state: "observed",
          provenance: "package"
        },
        {
          artifact: "mcp_client",
          name: client,
          state: client === undefined ? "unknown" : "observed",
          provenance: client === undefined ? "unknown" : "initialize"
        },
        {
          artifact: "provider_plugin",
          state: "unknown",
          provenance: "unknown"
        },
        {
          artifact: "client_cache",
          state: "unknown",
          provenance: "unknown"
        }
      ],
      session: {
        client,
        discovery_state,
        discovered_tools,
        discovered_resources,
        discovered_prompts
      },
      surfaces: [
        {
          name: "context_for_task",
          kind: "tool",
          configured: true,
          registered: true,
          advertised: true,
          caller_discovery: contextDiscovered ? "discovered" : "unknown",
          callable: contextDiscovered ? "callable" : "unknown",
          status: contextDiscovered ? "available" : "unknown",
          reason: contextDiscovered
            ? "The active client session discovered this registered MCP surface."
            : "Caller-discovered MCP surface evidence was not provided.",
          evidence_kinds: ["config"],
          capability_class: "read_only"
        }
      ],
      counts: {
        available: contextDiscovered ? 1 : 0,
        unavailable: 0,
        blocked: 0,
        hidden: 0,
        unknown: contextDiscovered ? 0 : 1
      },
      next_actions: contextDiscovered
        ? [
            {
              tool: "context_for_task",
              args: { task: "Use integration health" }
            }
          ]
        : []
    },
    meta: meta(repoRoot)
  };
}

function meta(repoRoot: string): ResponseMetadata {
  return {
    analysis_validity: "valid",
    freshness: "fresh",
    scope: {
      repo_root: repoRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      languages: []
    },
    capability_level: "resource_backed",
    evidence_kinds: ["config"],
    verification_status: "done",
    truncated: false
  };
}
