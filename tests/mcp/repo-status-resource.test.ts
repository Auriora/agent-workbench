/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { repoStatusResource } from "../../src/interface-adapters/mcp/registries/resources/repo-status.js";
import type { GetRepoStatusResult } from "../../src/application/use-cases/get-repo-status.js";
import { createAgentWorkbenchServer } from "../../src/server.js";
import {
  getRegisteredResource,
  registerMcpResource
} from "../helpers/mcp-harness.js";

describe("repo status MCP resource", () => {
  it("uses the injected status provider for repo:///status", async () => {
    const result: GetRepoStatusResult = {
      status: {
        repo_root: "/fixture",
        runtime_state: "fresh",
        freshness: "fresh",
        indexed_roots: ["."],
        skipped_roots: [],
        adapter_coverage: [
          {
            domain: "language",
            name: "typescript",
            capability_level: "unsupported",
            evidence_kinds: [],
            paths: ["src/app.ts"],
            provenance: "file_identity",
            confidence: "high",
            metadata: {}
          }
        ]
      },
      meta: {
        analysis_validity: "valid",
        freshness: "fresh",
        scope: {
          repo_root: "/fixture",
          indexed_roots: ["."],
          skipped_roots: [],
          languages: ["typescript"]
        },
        capability_level: "unsupported",
        evidence_kinds: [],
        verification_status: "needed",
        truncated: false
      }
    };

    const registered = registerMcpResource(repoStatusResource, {
      repoRoot: "/repo",
      getRepoStatus: ({ repo_root }) => ({
        ...result,
        status: {
          ...result.status,
          repo_root
        }
      })
    });

    expect(registered).toMatchObject({
      name: "status",
      uri: "repo:///status"
    });

    const response = await registered.handler({});
    const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
      data: GetRepoStatusResult["status"];
    };

    expect(parsed.data.repo_root).toBe("/repo");
    expect(parsed.data.adapter_coverage).toEqual(result.status.adapter_coverage);
  });

  it("returns a structured invalid-input envelope before provider execution", async () => {
    let providerCalled = false;

    const registered = registerMcpResource(repoStatusResource, {
      repoRoot: "/repo",
      getRepoStatus: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const response = await registered.handler({ repo_root: 42 });
    const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string; retryable: boolean }>;
    };

    expect(providerCalled).toBe(false);
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

  it("returns structured provider-not-configured state without synthesizing status", async () => {
    const registered = registerMcpResource(repoStatusResource, {
      repoRoot: "/repo"
    });

    const response = await registered.handler({});
    const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
      data: { freshness: string; adapter_coverage: unknown[] };
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string; message: string; retryable: boolean }>;
    };

    expect(parsed.data.freshness).toBe("unknown");
    expect(parsed.data.adapter_coverage).toEqual([]);
    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid",
      verification_status: "blocked"
    });
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        code: "invalid_input",
        message: "repo:///status provider is not configured.",
        retryable: false
      })
    ]);
  });

  it("returns a structured environment failure envelope when the provider cannot read sqlite evidence", async () => {
    const registered = registerMcpResource(repoStatusResource, {
      repoRoot: "/repo",
      getRepoStatus: () => {
        throw new Error("database is locked");
      }
    });

    const response = await registered.handler({});
    const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
      data: { repo_root: string; runtime_state: string; reason?: string };
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string; message: string; retryable: boolean }>;
    };

    expect(parsed.data).toMatchObject({
      repo_root: "/repo",
      runtime_state: "invalid_due_to_environment"
    });
    expect(parsed.data.reason).toContain("database is locked");
    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid_due_to_environment",
      verification_status: "blocked"
    });
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        code: "provider_unavailable",
        message: expect.stringContaining("database is locked"),
        retryable: true
      })
    ]);
  });

  it("keeps default status bounded without scanned coverage when no snapshot exists", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-status-cold-"));
    try {
      fs.writeFileSync(path.join(repoRoot, "package.json"), "{\"name\":\"cold-fixture\"}\n");
      const server = createAgentWorkbenchServer(repoRoot, {
        startGraphWarmup: false
      });

      const response = await getRegisteredResource(server, "repo:///status").readCallback({});
      const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
        data: GetRepoStatusResult["status"];
        meta: GetRepoStatusResult["meta"];
      };

      expect(parsed.data.adapter_coverage).toEqual([]);
      expect(parsed.meta.scope.languages).toEqual([]);
      expect(parsed.meta.caveats).toBeUndefined();
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("preserves no-coverage status caveats in the MCP resource envelope", async () => {
    const registered = registerMcpResource(repoStatusResource, {
      repoRoot: "/repo",
      getRepoStatus: ({ repo_root }) => ({
        status: {
          repo_root,
          runtime_state: "partial",
          freshness: "unknown",
          indexed_roots: ["."],
          skipped_roots: [],
          adapter_coverage: []
        },
        meta: {
          analysis_validity: "partial",
          freshness: "unknown",
          scope: {
            repo_root,
            indexed_roots: ["."],
            skipped_roots: [],
            languages: []
          },
          capability_level: "unsupported",
          evidence_kinds: [],
          verification_status: "needed",
          truncated: false,
          caveats: [
            {
              kind: "no_adapter_coverage",
              severity: "warning",
              message: "No scanner-visible adapter coverage was observed.",
              evidence_kinds: []
            }
          ]
        }
      })
    });

    const response = await registered.handler({});
    const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
      meta: GetRepoStatusResult["meta"];
      errors: unknown[];
    };

    expect(parsed.errors).toEqual([]);
    expect(parsed.meta.caveats).toEqual([
      expect.objectContaining({
        kind: "no_adapter_coverage"
      })
    ]);
  });
});
