/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { repoStatusResource } from "../../src/interface-adapters/mcp/registries/resources/repo-status.js";
import {
  getSnapshotRepoStatus,
  getSnapshotMetadataRepoStatus,
  type GetRepoStatusResult
} from "../../src/application/use-cases/get-repo-status.js";
import {
  buildFileCatalogEntry,
  DOCUMENTATION_CORPUS_POLICY_VERSION
} from "../../src/domain/policies/index.js";
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
import type { SnapshotRepositoryComposition } from "../../src/domain/models/runtime.js";

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

  it("redacts and UTF-8 bounds documentation ranking reasons at the public resource", async () => {
    const rawReason = [
      `/home/example/${"a".repeat(600)}`,
      "BOUNDARY_MARKER",
      "../outside/secrets.txt",
      "C:\\Users\\example\\secret.txt",
      "token=secret-value",
      "🙂".repeat(200)
    ].join(" ");
    const result: GetRepoStatusResult = {
      status: {
        repo_root: "/repo",
        runtime_state: "fresh",
        freshness: "fresh",
        indexed_roots: ["."],
        skipped_roots: [],
        adapter_coverage: [],
        snapshot_id: "snapshot-1",
        documentation_ranking: {
          snapshot_id: "snapshot-1",
          state: "invalid",
          recovery: "source_repair",
          authority_map: "unknown",
          reason: rawReason
        }
      },
      meta: {
        analysis_validity: "invalid",
        freshness: "fresh",
        scope: { repo_root: "/repo", indexed_roots: ["."], skipped_roots: [], languages: [] },
        capability_level: "unsupported",
        evidence_kinds: ["docs"],
        verification_status: "blocked",
        truncated: false
      }
    };
    const registered = registerMcpResource(repoStatusResource, {
      repoRoot: "/repo",
      getRepoStatus: () => result
    });

    const response = await registered.handler({});
    const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
      data: { documentation_ranking: { reason: string } };
    };
    const reason = parsed.data.documentation_ranking.reason;
    expect(reason).toContain("[REDACTED_ABSOLUTE_PATH]");
    expect(reason).toContain("[REDACTED_WORKSPACE_ESCAPE]");
    expect(reason).toContain("token=[REDACTED]");
    expect(reason).toContain("BOUNDARY_MARKER");
    expect(reason).not.toMatch(/home\/example|outside\/secrets|C:\\Users|secret-value/u);
    expect(Buffer.byteLength(reason, "utf8")).toBeLessThanOrEqual(512);
    expect(reason).not.toContain("�");
    expect(result.status.documentation_ranking?.reason).toBe(rawReason);
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

  it("publishes bounded repository composition provenance on snapshot status", async () => {
    const repoRoot = "/tmp/agent-workbench-status-composition";
    const result = getSnapshotMetadataRepoStatus({
      repo_root: repoRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      snapshot: {
        ...testSnapshot("composition-status", repoRoot),
        repository_composition: repositoryCompositionFixture()
      },
      files: []
    });
    const registered = registerMcpResource(repoStatusResource, {
      repoRoot,
      getRepoStatus: () => result
    });

    const response = await registered.handler({});
    const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
      data: GetRepoStatusResult["status"];
      meta: GetRepoStatusResult["meta"];
    };

    expect(parsed.data.repository_composition).toMatchObject({
      composition_fingerprint: "composition:status",
      aggregate_claims: {
        worktree_cleanliness: "blocked",
        pinned_composition: "mismatch"
      },
      repositories: expect.arrayContaining([
        expect.objectContaining({
          repository_key: "submodule:engines/billing",
          parent_repository_key: "superproject",
          path_prefix: "engines/billing",
          state: "worktree_revision_mismatch",
          source_available: true,
          claim_blockers: [
            expect.objectContaining({
              kind: "git_metadata_unavailable",
              path_prefix: "engines/billing",
              blocked_claims: ["pinned_composition"]
            })
          ]
        })
      ]),
      limits: [
        {
          kind: "max_depth_exceeded",
          path_prefix: "engines/billing/vendor/deep",
          limit: 2
        }
      ]
    });
    expect(parsed.meta.repository_composition).toEqual(parsed.data.repository_composition);
    expect(JSON.stringify(parsed.data.repository_composition)).not.toContain(repoRoot);
    expect(JSON.stringify(parsed.data.repository_composition)).not.toContain("https://");
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

  it("keeps warmup progress visible until the selected snapshot catches the completed target", async () => {
    const result = await getSnapshotRepoStatus({
      repo_root: "/repo",
      snapshots: {
        async getSnapshot({ snapshot_id }) {
          if (snapshot_id === "snap-2") {
            return testSnapshot("snap-2", "/repo");
          }
          return testSnapshot("snap-1", "/repo");
        },
        async listSnapshots() {
          throw new Error("listSnapshots should not run");
        },
        async upsertSnapshot() {
          throw new Error("upsertSnapshot should not run");
        },
        async markSnapshotFreshness() {
          throw new Error("markSnapshotFreshness should not run");
        }
      },
      catalog: {
        async listFiles() {
          return [buildFileCatalogEntry({
            file_identity: {
              path: "src/app.ts",
              language: "typescript",
              content_hash: "sha256:status",
              size_bytes: 24,
              mtime_ms: 1
            }
          })];
        },
        async getFile() {
          throw new Error("getFile should not run");
        },
        async upsertEntry() {
          throw new Error("upsertEntry should not run");
        },
        async removeEntry() {
          throw new Error("removeEntry should not run");
        }
      },
      documentation_concerns: {
        async getDocumentationConcernIndexState() {
          return {
            status: "ready" as const,
            snapshot_id: "snap-1",
            state: "complete" as const
          };
        },
        async replaceSnapshotDocumentationConcerns() {
          throw new Error("replaceSnapshotDocumentationConcerns should not run");
        },
        async listDocumentationConcernTerms() {
          throw new Error("listDocumentationConcernTerms should not run");
        },
        async listDocumentationConcernOwners() {
          throw new Error("listDocumentationConcernOwners should not run");
        }
      },
      warmups: {
        async getState() {
          return {
            execution_id: "warm-1",
            repo_root: "/repo",
            snapshot_id: "snap-2",
            state: "complete" as const,
            owner_id: "controller:1",
            queued_jobs: 0,
            started_at: "2026-08-05T12:00:00.000Z",
            updated_at: "2026-08-05T12:00:01.000Z"
          };
        },
        async requestWarmup() {
          return "warm-1";
        },
        async markOwner() {},
        async completeWarmup() {}
      },
      refresh_triggers: {
        async startup() {
          throw new Error("unexpected startup refresh");
        },
        async staleFirstRead() {
          throw new Error("unexpected first-read refresh");
        },
        async watcherBatch() {
          throw new Error("unexpected watcher refresh");
        },
        async hasPendingGeneration() {
          return false;
        },
        getGenerationReceipt() {
          return { generation: 0 };
        }
      },
      selected_snapshot_id: "snap-1"
    });

    expect(result.status.snapshot_id).toBe("snap-1");
    expect(result.status.warmup_state).toBe("running");
    expect(result.status.runtime_state).toBe("refreshing");
    expect(result.status.freshness).toBe("refreshing");
    expect(result.meta.freshness).toBe("refreshing");
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
  }, 15_000);

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
        }),
        documentation_concern_state: "complete"
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
      expect(initial.data.freshness).toBe("unknown");
      expect(initial.data.snapshot_validity).toMatchObject({
        state: "degraded",
        reason: "Snapshot lacks a persisted repository composition receipt."
      });
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

  it("classifies Ruby source files as parser-backed partial semantic in public repo status", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-ruby-status-"));
    fs.cpSync(path.resolve("tests/fixtures/fixture-ruby-semantic-repo"), repoRoot, {
      recursive: true,
      filter: (source) => path.basename(source) !== ".cache" && path.basename(source) !== "node_modules"
    });
    const sharedConfigPath = path.join(repoRoot, "lib", "shared_config.rb");
    const routePath = path.join(repoRoot, "config", "routes.rb");
    const store = openGraphStore(graphStorePath(repoRoot));
    try {
      await store.createBuildSnapshot({
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
        controller_generation: 0,
        invalidation_generation: 0,
        created_at: "2026-07-05T12:00:00.000Z"
      });
      await store.upsertEntry({
        snapshot_id: "1000",
        entry: buildFileCatalogEntry({
          file_identity: {
            path: "lib/shared_config.rb",
            language: "ruby",
            content_hash: "sha256:test-ruby-shared-config",
            size_bytes: fs.statSync(sharedConfigPath).size,
            mtime_ms: fs.statSync(sharedConfigPath).mtimeMs,
            indexed_at: "2026-07-05T12:00:00.000Z"
          }
        })
      });
      await store.upsertEntry({
        snapshot_id: "1000",
        entry: buildFileCatalogEntry({
          file_identity: {
            path: "config/routes.rb",
            language: "ruby",
            content_hash: "sha256:test-ruby-routes",
            size_bytes: fs.statSync(routePath).size,
            mtime_ms: fs.statSync(routePath).mtimeMs,
            indexed_at: "2026-07-05T12:00:00.000Z"
          }
        })
      });
      await store.transitionBuild({
        repo_root: repoRoot,
        snapshot_id: "1000",
        controller_generation: 0,
        invalidation_generation: 0,
        from: "building",
        to: "published",
        updated_at: "2026-07-05T12:00:00.000Z"
      });
    } finally {
      store.close();
    }

    try {
      const server = createAgentWorkbenchServer(repoRoot, {
        startupRefreshDelayMs: 60_000
      });

      const response = await getRegisteredResource(server, "repo:///status").readCallback({});
      const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
        data: GetRepoStatusResult["status"];
      };

      const rubyEvidence = parsed.data.adapter_coverage.find(
        (entry) =>
          entry.domain === "language" &&
          entry.name === "ruby" &&
          entry.paths.some((value) => value.endsWith(".rb"))
      );
      const railsEvidence = parsed.data.adapter_coverage.find(
        (entry) => entry.domain === "framework" && entry.name === "rails"
      );

      expect(rubyEvidence).toMatchObject({
        domain: "language",
        name: "ruby",
        capability_level: "partial_semantic",
        evidence_kinds: ["parser"]
      });
      expect(rubyEvidence?.confidence).toBe("high");
      expect(rubyEvidence?.provenance).toBe("file_identity");
      expect(rubyEvidence?.paths.length).toBeGreaterThan(0);
      expect(rubyEvidence?.paths).not.toContain("config/routes.rb");
      expect(railsEvidence).toMatchObject({
        domain: "framework",
        name: "rails",
        capability_level: "resource_backed",
        evidence_kinds: ["heuristic"]
      });
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});

async function seedPublishedEntry(
  store: ReturnType<typeof openGraphStore>,
  input: {
    snapshot: Parameters<ReturnType<typeof openGraphStore>["createBuildSnapshot"]>[0]["snapshot"];
    snapshot_id: string;
    entry: Parameters<ReturnType<typeof openGraphStore>["upsertEntry"]>[0]["entry"];
    documentation_concern_state?: "complete" | "no_map";
  }
): Promise<void> {
  await store.createBuildSnapshot({
    snapshot: input.snapshot,
    controller_generation: 0,
    invalidation_generation: 0,
    created_at: input.snapshot.created_at
  });
  await store.upsertEntry({ snapshot_id: input.snapshot_id, entry: input.entry });
  await store.replaceSnapshotDocs({
    snapshot_id: input.snapshot_id,
    repo_root: input.snapshot.repo_root,
    documents: [],
    coverage: [{
      evidence_class: "docs",
      state: "complete",
      indexed_files: 0,
      eligible_files_seen: 0,
      admitted_files: 0,
      extracted_files: 0,
      scan_truncated: false,
      extraction_truncated: false,
      continuation_available: false,
      documentation_corpus_policy_version: DOCUMENTATION_CORPUS_POLICY_VERSION,
      policy_excluded_files: 0,
      policy_exclusions: []
    }]
  });
  await store.replaceSnapshotDocumentationConcerns({
    snapshot_id: input.snapshot_id,
    state: input.documentation_concern_state ?? "no_map",
    ...(input.documentation_concern_state === "complete"
      ? {
          source_path: "docs/reference/documentation-map.md",
          source_content_hash: "sha256:test-documentation-map"
        }
      : {}),
    concerns: [],
    terms: [],
    owners: []
  });
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

function repositoryCompositionFixture(): SnapshotRepositoryComposition {
  return {
    superproject_key: "superproject",
    repositories: [
      {
        repository_key: "superproject",
        path_prefix: ".",
        depth: 0,
        state: "superproject",
        pinned_revision_matches: "unknown",
        cleanliness: "clean",
        source_available: true,
        evidence_paths: [],
        claim_blockers: []
      },
      {
        repository_key: "submodule:engines/billing",
        parent_repository_key: "superproject",
        path_prefix: "engines/billing",
        depth: 1,
        state: "worktree_revision_mismatch",
        declaration_path: ".gitmodules",
        head_gitlink_oid: "a".repeat(40),
        index_gitlink_oid: "a".repeat(40),
        worktree_head_oid: "b".repeat(40),
        pinned_revision_matches: false,
        cleanliness: "dirty",
        source_available: true,
        evidence_paths: ["/tmp/agent-workbench-status-composition/.gitmodules", "https://example.invalid/repo"],
        claim_blockers: [
          {
            kind: "git_metadata_unavailable",
            path_prefix: "engines/billing",
            message: "Pinned composition differs from local source.",
            evidence_paths: ["/tmp/agent-workbench-status-composition/engines/billing/.git"],
            blocked_claims: ["pinned_composition"]
          }
        ]
      }
    ],
    aggregate_claims: {
      worktree_cleanliness: "blocked",
      pinned_composition: "mismatch"
    },
    skipped_or_blocked: [],
    source_complete: false,
    truncated: false,
    composition_fingerprint: "composition:status",
    limits: [
      {
        kind: "max_depth_exceeded",
        path_prefix: "engines/billing/vendor/deep",
        limit: 2,
        message: "Depth exceeded."
      }
    ]
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
