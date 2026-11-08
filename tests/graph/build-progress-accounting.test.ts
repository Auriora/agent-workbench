/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { runRepositoryGraphBuildSlice } from "../../src/application/use-cases/index-repository-graph.js";
import { createProductionExtractorRegistry, ResourceExtractorAdapter } from "../../src/infrastructure/extraction/index.js";
import { FileCatalogScannerAdapter, WorkspaceFileAdapter } from "../../src/infrastructure/filesystem/index.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/index.js";
import { SystemClockAdapter } from "../../src/infrastructure/time/index.js";
import type { GraphBuildCatalogCapturePort } from "../../src/ports/index.js";

it("keeps unversioned unique totals unknown, refuses continuation and rebuilds distinct counts in a new generation", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-progress-accounting-"));
  const repo = path.join(root, "repo");
  fs.mkdirSync(repo);
  fs.writeFileSync(path.join(repo, "single.py"), "def single():\n    return 1\n");
  const store = openGraphStore(path.join(root, "graph.sqlite"));
  let scans = 0;
  const now = "2026-11-08T00:00:00.000Z";
  try {
    await store.createBuildSnapshot({ controller_generation: 17, invalidation_generation: 23, created_at: now, snapshot: { id: "901", repo_root: repo, workspace_root: repo,
      repo_identity: repo, config_identity: "default", schema_version: SCHEMA_VERSION,
      freshness: "fresh", owner_state: "owner", created_at: now, updated_at: now } });
    await store.upsertGraphBuildProgress({ progress: {
      snapshot_id: "901", owner_id: "legacy-owner", phase: "extracting", status: "active",
      scan_cursor: "old.py", max_files: 1, generation_source_hash: "legacy-visits",
      controller_generation: 17, invalidation_generation: 23, updated_at: now,
      counters: { eligible_files: 999, scanned_files: 999, admitted_files: 999, extracted_files: 999,
        unsupported_files: 0, resource_backed_files: 0, nodes: 999, edges: 999, unresolved_references: 999 }
    } });
    await store.transitionBuild({ repo_root: repo, snapshot_id: "901", controller_generation: 17, invalidation_generation: 23, from: "building", to: "published", updated_at: now });
    const before = await store.getGraphBuildProgress({ snapshot_id: "901" });
    expect(before?.counters_version).toBeUndefined();
    expect(before?.manifest_id).toBeUndefined();
    const common = {
      repo_root: repo, workspace: new WorkspaceFileAdapter({ repoRoot: repo }),
      extractors: createProductionExtractorRegistry(), resource_extractor: new ResourceExtractorAdapter(),
      graph: store, catalog: store, snapshots: store, build_progress: store, build_seed: store,
      build_read: store, build_coverage: store, build_resolution: store,
      clock: new SystemClockAdapter(), schema_version: SCHEMA_VERSION, max_files: 1,
      owner_id: "legacy-owner", controller_generation: 17, invalidation_generation: 23,
      manifest: {
        store,
        watcher: {
          start: async () => ({ epoch: "accounting-epoch", sequence: 0, healthy: true, pending_events: 0, covered_directories: ["."] }),
          registerDirectory: async () => ({ epoch: "accounting-epoch", sequence: 0, healthy: true, pending_events: 0, covered_directories: ["."] })
        },
        create_scanner: (capture: GraphBuildCatalogCapturePort) => { scans += 1; return new FileCatalogScannerAdapter({ capture }); },
        inputs: []
      }
    };
    await expect(runRepositoryGraphBuildSlice({ ...common, snapshot_id: "901" })).rejects.toThrow("not bound to a sealed inventory manifest");
    expect(scans).toBe(0);
    expect(await store.getGraphBuildProgress({ snapshot_id: "901" })).toEqual(before);
    await runRepositoryGraphBuildSlice({ ...common, snapshot_id: "902", controller_generation: 18, invalidation_generation: 24 });
    expect(scans).toBe(1);
    expect(await store.getGraphBuildProgress({ snapshot_id: "902" })).toMatchObject({
      counters_version: 2, manifest_id: expect.any(String),
      counters: { eligible_files: 1, scanned_files: 1, admitted_files: 1, extracted_files: 1, nodes: 2, edges: 0, unresolved_references: 0 }
    });
    expect(await store.getGraphBuildProgress({ snapshot_id: "901" })).toEqual(before);
  } finally { store.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
