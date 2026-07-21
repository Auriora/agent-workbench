/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { repoStatusResource } from "../../src/interface-adapters/mcp/registries/resources/repo-status.js";
import type { GetRepoStatusResult } from "../../src/application/use-cases/get-repo-status.js";
import { buildFileCatalogEntry } from "../../src/domain/policies/index.js";
import { InMemoryRuntimeOperationsAdapter } from "../../src/infrastructure/runtime/index.js";
import { FileRepositoryOwnershipAdapter } from "../../src/infrastructure/runtime/repository-ownership.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/index.js";
import { GRAPH_STORE_FILE_NAME } from "../../src/infrastructure/sqlite/graph-store-location.js";
import {
  createAgentWorkbenchServer,
  repositoryOwnershipPath
} from "../../src/server.js";
import {
  getRegisteredResource,
  getRegisteredTool,
  parseMcpResourceText,
  parseMcpTextContent,
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
      verification_status: "blocked",
      trust: {
        safe_to_use_for: expect.arrayContaining(["runtime_availability"]),
        not_safe_to_use_for: expect.arrayContaining(["task_completion_claim"])
      }
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
    expect(parsed.data.reason).toContain("graph store is temporarily unavailable");
    expect(parsed.data.reason).not.toMatch(/database is locked/i);
    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid_due_to_environment",
      verification_status: "blocked",
      trust: {
        not_safe_to_use_for: expect.arrayContaining(["task_completion_claim"]),
        must_verify_by: expect.arrayContaining(["resolve_blocked_environment"])
      }
    });
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        code: "provider_unavailable",
        message: expect.stringContaining("graph store is temporarily unavailable"),
        retryable: true
      })
    ]);
    expect(JSON.stringify(parsed.errors)).not.toMatch(/database is locked/i);
  });

  it("keeps default status bounded without scanned coverage when no snapshot exists", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-status-cold-"));
    try {
      fs.writeFileSync(path.join(repoRoot, "package.json"), "{\"name\":\"cold-fixture\"}\n");
      const server = createAgentWorkbenchServer(repoRoot, {
        startupRefreshDelayMs: 60_000
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

  it("makes first-read surfaces agree when a persisted snapshot path was deleted before startup", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-status-deleted-path-"));
    const sourceDir = path.join(repoRoot, "src");
    const sourcePath = path.join(sourceDir, "app.ts");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(sourcePath, "export const app = true;\n");

    const store = openGraphStore(graphStorePath(repoRoot));
    try {
      await seedPublishedEntry(store, {
        snapshot: {
          id: "1000",
          repo_root: repoRoot,
          workspace_root: repoRoot,
          repo_identity: repoRoot,
          config_identity: "default",
          schema_version: SCHEMA_VERSION,
          freshness: "fresh",
          owner_state: "owner",
          created_at: "2026-07-05T12:00:00.000Z",
          updated_at: "2026-07-05T12:00:00.000Z"
        },
        snapshot_id: "1000",
        entry: buildFileCatalogEntry({
          file_identity: {
            path: "src/app.ts",
            language: "typescript",
            content_hash: "sha256:before",
            size_bytes: fs.statSync(sourcePath).size,
            mtime_ms: fs.statSync(sourcePath).mtimeMs,
            indexed_at: "2026-07-05T12:00:00.000Z"
          }
        })
      });
    } finally {
      store.close();
    }

    fs.rmSync(sourcePath);

    try {
      const server = createAgentWorkbenchServer(repoRoot, {
        startupRefreshDelayMs: 60_000
      });
      const status = parseMcpResourceText<{
        data: GetRepoStatusResult["status"];
        meta: GetRepoStatusResult["meta"];
      }>(await getRegisteredResource(server, "repo:///status").readCallback({}));
      const orientation = parseMcpResourceText<{
        data: {
          snapshot_id?: string;
          freshness: string;
          refresh_required: boolean;
          trust_summary: { orientation_reusable: boolean };
          material_blockers: string[];
        };
      }>(await getRegisteredResource(server, "repo:///orientation").readCallback({}));
      const context = parseMcpTextContent<{
        meta: GetRepoStatusResult["meta"];
      }>(await getRegisteredTool(server, "context_for_task").handler({
        task: "Inspect the deleted app path",
        files: ["src/app.ts"],
        max_files: 5,
        max_docs: 2
      }));

      expect.soft(status.data.snapshot_id).toBe("1000");
      expect.soft(status.data.freshness).not.toBe("fresh");
      expect.soft(status.meta.freshness).not.toBe("fresh");
      expect.soft(orientation.data.snapshot_id).toBe("1000");
      expect.soft(orientation.data.freshness).toBe(status.meta.freshness);
      expect.soft(orientation.data.refresh_required).toBe(true);
      expect.soft(orientation.data.trust_summary.orientation_reusable).toBe(false);
      expect.soft(orientation.data.material_blockers.join("\n")).toMatch(/missing|deleted|path/i);
      expect.soft(context.meta.freshness).toBe(status.meta.freshness);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("pins status and orientation presentation to the snapshot selected for validity", async () => {
    for (const uri of ["repo:///status", "repo:///orientation"] as const) {
      const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-status-snapshot-pin-"));
      const sourcePath = path.join(repoRoot, "app.ts");
      fs.writeFileSync(sourcePath, "export const app = true;\n");
      const databasePath = graphStorePath(repoRoot);
      const store = openGraphStore(databasePath);
      try {
        await seedPublishedEntry(store, {
          snapshot: testSnapshot("1000", repoRoot),
          snapshot_id: "1000",
          entry: buildFileCatalogEntry({
            file_identity: {
              path: "app.ts",
              language: "typescript",
              content_hash: "sha256:before",
              size_bytes: fs.statSync(sourcePath).size,
              mtime_ms: fs.statSync(sourcePath).mtimeMs
            }
          })
        });
      } finally {
        store.close();
      }
      fs.rmSync(sourcePath);

      const originalRequestWarmup = InMemoryRuntimeOperationsAdapter.prototype.requestWarmup;
      const warmupSpy = vi
        .spyOn(InMemoryRuntimeOperationsAdapter.prototype, "requestWarmup")
        .mockImplementation(async function (this: InMemoryRuntimeOperationsAdapter, input) {
          const executionId = await originalRequestWarmup.call(this, input);
          const concurrent = openGraphStore(databasePath);
          try {
            await concurrent.upsertSnapshot({ snapshot: testSnapshot("2000", repoRoot) });
          } finally {
            concurrent.close();
          }
          return executionId;
        });

      try {
        const server = createAgentWorkbenchServer(repoRoot, { startupRefreshDelayMs: 60_000 });
        const result = parseMcpResourceText<{
          data: { snapshot_id?: string; snapshot_validity?: { snapshot_id: string } };
        }>(await getRegisteredResource(server, uri).readCallback({}));

        expect(result.data.snapshot_id).toBe("1000");
        if (uri === "repo:///status") {
          expect(result.data.snapshot_validity?.snapshot_id).toBe("1000");
        }
      } finally {
        warmupSpy.mockRestore();
        fs.rmSync(repoRoot, { recursive: true, force: true });
      }
    }
  });

  it("executes one background refresh after first-read deletion detection", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-status-refresh-deletion-"));
    const sourceDir = path.join(repoRoot, "src");
    const sourcePath = path.join(sourceDir, "app.ts");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(sourcePath, "export const app = true;\n");
    const store = openGraphStore(graphStorePath(repoRoot));
    try {
      await seedPublishedEntry(store, {
        snapshot: {
          id: "1000",
          repo_root: repoRoot,
          workspace_root: repoRoot,
          repo_identity: repoRoot,
          config_identity: "default",
          schema_version: SCHEMA_VERSION,
          freshness: "fresh",
          owner_state: "owner",
          created_at: "2026-07-05T12:00:00.000Z",
          updated_at: "2026-07-05T12:00:00.000Z"
        },
        snapshot_id: "1000",
        entry: buildFileCatalogEntry({
          file_identity: {
            path: "src/app.ts",
            language: "typescript",
            content_hash: "sha256:before",
            size_bytes: fs.statSync(sourcePath).size,
            mtime_ms: fs.statSync(sourcePath).mtimeMs
          }
        })
      });
    } finally {
      store.close();
    }
    fs.rmSync(sourcePath);

    try {
      const server = createAgentWorkbenchServer(repoRoot, {
        startupRefreshDelayMs: 60_000,
        startupWarmupMaxFiles: 100
      });
      const readStatus = async () => parseMcpResourceText<{
        data: GetRepoStatusResult["status"];
        meta: GetRepoStatusResult["meta"];
      }>(await getRegisteredResource(server, "repo:///status").readCallback({}));
      const initial = await readStatus();
      expect(initial.data.freshness).toBe("stale");

      const refreshed = await waitForReplacementSnapshot(readStatus, "1000");
      expect(refreshed.data.snapshot_id).not.toBe("1000");
      expect(refreshed.data.freshness).toBe("fresh");
      expect(refreshed.data.snapshot_validity).toMatchObject({ state: "valid", complete: true });
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("preserves structured active-owner refusal through the public status surface", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-status-owner-observer-"));
    const sourceDir = path.join(repoRoot, "src");
    const sourcePath = path.join(sourceDir, "app.ts");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(sourcePath, "export const app = true;\n");
    const store = openGraphStore(graphStorePath(repoRoot));
    try {
      await seedPublishedEntry(store, {
        snapshot: {
          id: "1000",
          repo_root: repoRoot,
          workspace_root: repoRoot,
          repo_identity: repoRoot,
          config_identity: "default",
          schema_version: SCHEMA_VERSION,
          freshness: "fresh",
          owner_state: "owner",
          created_at: "2026-07-05T12:00:00.000Z",
          updated_at: "2026-07-05T12:00:00.000Z"
        },
        snapshot_id: "1000",
        entry: buildFileCatalogEntry({
          file_identity: {
            path: "src/app.ts",
            language: "typescript",
            content_hash: "sha256:before",
            size_bytes: fs.statSync(sourcePath).size,
            mtime_ms: fs.statSync(sourcePath).mtimeMs
          }
        })
      });
    } finally {
      store.close();
    }
    fs.rmSync(sourcePath);

    const ownership = new FileRepositoryOwnershipAdapter(
      repositoryOwnershipPath(graphStorePath(repoRoot))
    );
    const external = await ownership.acquire({
      repo_root: repoRoot,
      runtime_identity: `external:${SCHEMA_VERSION}`,
      schema_version: SCHEMA_VERSION,
      owner_id: "external-daemon",
      owner_pid: process.pid,
      owner_generation: 41,
      heartbeat_at: "2026-07-20T10:00:00.000Z"
    });
    expect(external.outcome).toBe("acquired");
    if (external.outcome !== "acquired") throw new Error("Expected external ownership acquisition.");
    const server = createAgentWorkbenchServer(repoRoot, { startupRefreshDelayMs: 60_000 });

    try {
      const parsed = parseMcpResourceText<{
        data: GetRepoStatusResult["status"];
        meta: GetRepoStatusResult["meta"];
      }>(await getRegisteredResource(server, "repo:///status").readCallback({}));

      expect(parsed.data.watcher_freshness).toMatchObject({
        status: "degraded",
        reason: "Repository refresh owner is active.",
        refresh_admission: {
          outcome: "blocked",
          reason: "owner_active",
          owner: {
            owner_id: "external-daemon",
            owner_generation: 41,
            state: "active"
          }
        }
      });
      expect(parsed.meta.verification_status).toBe("blocked");
    } finally {
      await server.close();
      await ownership.release({ lease: external.lease });
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("feeds live watcher events into repo status freshness when watcher mode is enabled", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-status-watch-"));
    const sourceDir = path.join(repoRoot, "src");
    const sourcePath = path.join(sourceDir, "app.ts");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(sourcePath, "export const app = true;\n");

    const store = openGraphStore(graphStorePath(repoRoot));
    try {
      await seedPublishedEntry(store, {
        snapshot: {
          id: "1001",
          repo_root: repoRoot,
          workspace_root: repoRoot,
          repo_identity: repoRoot,
          config_identity: "default",
          schema_version: SCHEMA_VERSION,
          freshness: "fresh",
          owner_state: "owner",
          created_at: "2026-07-05T12:00:00.000Z",
          updated_at: "2026-07-05T12:00:00.000Z"
        },
        snapshot_id: "1001",
        entry: buildFileCatalogEntry({
          file_identity: {
            path: "src/app.ts",
            language: "typescript",
            content_hash: "sha256:before",
            size_bytes: fs.statSync(sourcePath).size,
            mtime_ms: fs.statSync(sourcePath).mtimeMs,
            indexed_at: "2026-07-05T12:00:00.000Z"
          }
        })
      });
    } finally {
      store.close();
    }

    try {
      const server = createAgentWorkbenchServer(repoRoot, {
        startupRefreshDelayMs: 60_000,
        workspaceWatcher: {
          enabled: true,
          debounce_ms: 0,
          event_budget: 10
        }
      });

      const initialResponse = await getRegisteredResource(server, "repo:///status").readCallback({});
      const initial = JSON.parse(initialResponse.contents[0]?.text ?? "{}") as {
        data: GetRepoStatusResult["status"];
      };
      expect(initial.data.freshness).toBe("fresh");
      expect(initial.data.watcher_freshness).toMatchObject({
        status: "fresh",
        queue_state: "drained"
      });

      fs.writeFileSync(sourcePath, "export const app = false;\n");

      const parsed = await waitForWatcherFreshness(repoRoot, async () => {
        const response = await getRegisteredResource(server, "repo:///status").readCallback({});
        return JSON.parse(response.contents[0]?.text ?? "{}") as {
          data: GetRepoStatusResult["status"];
          meta: GetRepoStatusResult["meta"];
        };
      });

      expect(parsed.data.freshness).toBe("refreshing");
      expect(parsed.data.watcher_freshness).toMatchObject({
        status: "refreshing",
        queue_state: "pending",
        scope_status: "synchronized",
        ignore_rules_status: "synchronized"
      });
      expect(parsed.meta.caveats).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: "watcher_refreshing"
        })
      ]));

      const verifyStore = openGraphStore(graphStorePath(repoRoot));
      try {
        await expect(verifyStore.getSnapshot({ repo_root: repoRoot })).resolves.toMatchObject({
          freshness: "stale"
        });
      } finally {
        verifyStore.close();
      }
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

  it("exposes stale watcher freshness and caveats in the MCP resource envelope", async () => {
    const registered = registerMcpResource(repoStatusResource, {
      repoRoot: "/repo",
      getRepoStatus: ({ repo_root }) => ({
        status: {
          repo_root,
          runtime_state: "stale",
          freshness: "stale",
          indexed_roots: ["."],
          skipped_roots: [],
          adapter_coverage: [],
          watcher_freshness: {
            status: "stale",
            queue_state: "overflowed",
            scope_status: "synchronized",
            ignore_rules_status: "synchronized",
            reason: "Workspace watcher overflow requires bounded rescan."
          }
        },
        meta: {
          analysis_validity: "valid",
          freshness: "stale",
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
              kind: "stale_watcher_snapshot",
              severity: "blocker",
              message: "Workspace watcher overflow requires bounded rescan.",
              evidence_kinds: []
            }
          ]
        }
      })
    });

    const response = await registered.handler({});
    const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
      data: GetRepoStatusResult["status"];
      meta: GetRepoStatusResult["meta"];
      errors: unknown[];
    };

    expect(parsed.errors).toEqual([]);
    expect(parsed.data.watcher_freshness).toEqual({
      status: "stale",
      queue_state: "overflowed",
      scope_status: "synchronized",
      ignore_rules_status: "synchronized",
      reason: "Workspace watcher overflow requires bounded rescan."
    });
    expect(parsed.data.freshness).toBe("stale");
    expect(parsed.meta.freshness).toBe("stale");
    expect(parsed.meta.caveats).toEqual([
      expect.objectContaining({
        kind: "stale_watcher_snapshot"
      })
    ]);
  });
});

async function seedPublishedEntry(
  store: ReturnType<typeof openGraphStore>,
  input: {
    snapshot: Parameters<ReturnType<typeof openGraphStore>["createBuildSnapshot"]>[0]["snapshot"];
    snapshot_id: string;
    entry: Parameters<ReturnType<typeof openGraphStore>["upsertEntry"]>[0]["entry"];
  }
): Promise<void> {
  await store.createBuildSnapshot({
    snapshot: input.snapshot,
    controller_generation: 0,
    invalidation_generation: 0,
    created_at: input.snapshot.created_at
  });
  await store.upsertEntry({ snapshot_id: input.snapshot_id, entry: input.entry });
  await store.transitionBuild({
    repo_root: input.snapshot.repo_root,
    snapshot_id: input.snapshot_id,
    controller_generation: 0,
    invalidation_generation: 0,
    from: "building",
    to: "published",
    updated_at: input.snapshot.updated_at
  });
}

function graphStorePath(repoRoot: string): string {
  const cacheDir = path.join(repoRoot, ".cache", "agent-workbench");
  fs.mkdirSync(cacheDir, { recursive: true });
  return path.join(cacheDir, GRAPH_STORE_FILE_NAME);
}

function testSnapshot(id: string, repoRoot: string) {
  return {
    id,
    repo_root: repoRoot,
    workspace_root: repoRoot,
    repo_identity: repoRoot,
    config_identity: "default",
    schema_version: SCHEMA_VERSION,
    freshness: "fresh" as const,
    owner_state: "owner" as const,
    created_at: "2026-07-19T12:00:00.000Z",
    updated_at: "2026-07-19T12:00:00.000Z"
  };
}

async function waitForWatcherFreshness(
  repoRoot: string,
  readStatus: () => Promise<{
    data: GetRepoStatusResult["status"];
    meta: GetRepoStatusResult["meta"];
  }>
): Promise<{
  data: GetRepoStatusResult["status"];
  meta: GetRepoStatusResult["meta"];
}> {
  const deadline = Date.now() + 3_000;
  let last = await readStatus();
  while (Date.now() < deadline) {
    if (last.data.watcher_freshness?.status === "refreshing") {
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
    last = await readStatus();
  }
  throw new Error(
    `Timed out waiting for watcher freshness in ${repoRoot}; last status was ${JSON.stringify(last.data.watcher_freshness)}`
  );
}

async function waitForReplacementSnapshot(
  readStatus: () => Promise<{
    data: GetRepoStatusResult["status"];
    meta: GetRepoStatusResult["meta"];
  }>,
  previousSnapshotId: string
) {
  const deadline = Date.now() + 10_000;
  let last = await readStatus();
  while (Date.now() < deadline) {
    if (last.data.snapshot_id !== previousSnapshotId && last.data.freshness === "fresh") {
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    last = await readStatus();
  }
  throw new Error(`Timed out waiting for replacement snapshot; last status was ${JSON.stringify(last.data)}`);
}
