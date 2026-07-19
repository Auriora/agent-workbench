/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type {
  IntegrationHealth,
  IntegrationHealthRequest,
  ResponseMetadata
} from "../../src/contracts/index.js";
import type { GetIntegrationHealthResult } from "../../src/application/use-cases/get-integration-health.js";
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
        startGraphWarmup: false
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
});

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
