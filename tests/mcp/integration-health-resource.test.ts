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
import { createAgentWorkbenchServer } from "../../src/server.js";
import {
  getRegisteredResource,
  registerMcpResource
} from "../helpers/mcp-harness.js";

describe("integration health MCP resource", () => {
  it("uses the injected health provider with parsed session evidence", async () => {
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

    const response = await registered.handler({
      client: "codex",
      discovery_state: "provided",
      discovered_tools: ["context_for_task"],
      discovered_resources: ["repo:///status"]
    });
    const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
      data: IntegrationHealth;
    };

    expect(parsedRequest).toMatchObject({
      repo_root: "/repo",
      client: "codex",
      discovery_state: "provided",
      discovered_tools: ["context_for_task"],
      discovered_resources: ["repo:///status"],
      discovered_prompts: []
    });
    expect(parsed.data.repo_root).toBe("/repo");
    expect(parsed.data.surfaces[0]).toMatchObject({
      name: "context_for_task",
      status: "available",
      callable: "callable"
    });
  });

  it("returns structured invalid input before provider execution", async () => {
    let providerCalled = false;

    const registered = registerMcpResource(integrationHealthResource, {
      repoRoot: "/repo",
      getIntegrationHealth: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const response = await registered.handler({ discovered_tools: "context_for_task" });
    const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
      data: { surfaces: unknown[] };
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string; retryable: boolean }>;
    };

    expect(providerCalled).toBe(false);
    expect(parsed.data.surfaces).toEqual([]);
    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid",
      verification_status: "blocked"
    });
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        code: "invalid_input",
        retryable: false
      })
    ]);
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
        code: "invalid_input",
        message: "integration:///health/agent-workbench provider is not configured.",
        retryable: false
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
  return {
    health: {
      repo_root: repoRoot,
      runtime_version: "0.1.0",
      profile: "codex",
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
          caller_discovery: "discovered",
          callable: "callable",
          status: "available",
          reason: "The active client session discovered this registered MCP surface.",
          evidence_kinds: ["config"],
          capability_class: "read_only"
        }
      ],
      counts: {
        available: 1,
        unavailable: 0,
        blocked: 0,
        hidden: 0,
        unknown: 0
      },
      next_actions: [
        {
          tool: "context_for_task",
          args: { task: "Use integration health" }
        }
      ]
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
