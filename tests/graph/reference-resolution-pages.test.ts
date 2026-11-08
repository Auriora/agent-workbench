/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runRepositoryGraphBuildSlice } from "../../src/application/use-cases/index-repository-graph.js";
import { ExtractorRegistryAdapter, ResourceExtractorAdapter } from "../../src/infrastructure/extraction/index.js";
import { FileCatalogScannerAdapter, WorkspaceFileAdapter } from "../../src/infrastructure/filesystem/index.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/index.js";
import { PythonTreeSitterExtractorAdapter } from "../../src/infrastructure/tree-sitter/index.js";
import { SystemClockAdapter } from "../../src/infrastructure/time/index.js";
import type { GraphBuildCatalogCapturePort } from "../../src/ports/index.js";

describe("final reference resolution pages", () => {
  const roots: string[] = [];
  afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

  async function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-resolution-pages-"));
    roots.push(root);
    const repo = path.join(root, "repo");
    fs.mkdirSync(repo);
    const targets = Array.from({ length: 12 }, (_, index) => `target_${String(index).padStart(2, "0")}`);
    fs.writeFileSync(path.join(repo, "a.py"), `def caller():\n${[...targets, "shared", "missing"].map(name => `    ${name}()`).join("\n")}\n`);
    fs.writeFileSync(path.join(repo, "y.py"), `${[...targets, "shared"].map(name => `def ${name}():\n    return 1\n`).join("\n")}\n`);
    fs.writeFileSync(path.join(repo, "z.py"), "def shared():\n    return 2\n");
    const store = openGraphStore(path.join(root, "graph.sqlite"));
    const extractors = new ExtractorRegistryAdapter();
    extractors.register(new PythonTreeSitterExtractorAdapter());
    const directories = new Set<string>();
    const observe = () => ({ epoch: "resolution-page-epoch", sequence: 0, healthy: true, pending_events: 0, covered_directories: [...directories] });
    const common = {
      repo_root: repo, workspace: new WorkspaceFileAdapter({ repoRoot: repo }), extractors,
      resource_extractor: new ResourceExtractorAdapter(), graph: store, catalog: store, snapshots: store,
      build_progress: store, build_seed: store, build_read: store, build_coverage: store, build_resolution: store,
      manifest: {
        store,
        watcher: {
          start: async () => observe(),
          registerDirectory: async ({ path: directory }: { path: string }) => { directories.add(directory); return observe(); }
        },
        create_scanner: (capture: GraphBuildCatalogCapturePort) => new FileCatalogScannerAdapter({ capture }),
        inputs: [{ path: ".", kind: "directory" as const, device: "0", inode: "0", size_bytes: "0", mtime_ns: "0", ctime_ns: "0" }]
      },
      clock: new SystemClockAdapter(), schema_version: SCHEMA_VERSION,
      owner_id: "resolution-pages-owner", controller_generation: 19, invalidation_generation: 23,
      max_files: 100, max_extraction_files: 1, max_resolution_references: 1,
      snapshot_id: "19001"
    };
    try {
      for (let pass = 0; pass < 6; pass += 1) {
        await runRepositoryGraphBuildSlice(common);
        if ((await store.getGraphBuildProgress({ snapshot_id: common.snapshot_id }))?.phase === "resolving") break;
      }
      expect(await store.getGraphBuildProgress({ snapshot_id: common.snapshot_id })).toMatchObject({ phase: "resolving", scan_cursor: "resolve:0" });
      expect(store.db.prepare("SELECT id FROM unresolved_refs ORDER BY id").all()).toHaveLength(14);
      return { store, common, targets };
    } catch (error) { store.close(); throw error; }
  }

  it("advances exclusive numeric cursors through 9/10 while retaining ambiguous and missing references", async () => {
    const { store, common, targets } = await fixture();
    try {
      const cursors: string[] = [];
      for (let pass = 0; pass < 16; pass += 1) {
        const result = await runRepositoryGraphBuildSlice(common);
        if (result.outcome === "complete") break;
        expect(result.outcome).toBe("partial");
        if (result.outcome === "partial") {
          expect(result.continuation_cursor).toBeTypeOf("string");
          cursors.push(result.continuation_cursor!);
        }
      }
      expect(cursors).toEqual(Array.from({ length: 14 }, (_, index) => `resolve:${index + 1}`));
      expect(store.db.prepare(`SELECT nodes.name FROM edges INNER JOIN nodes ON nodes.id = edges.target_node_id ORDER BY nodes.name`).all())
        .toEqual(targets.map(name => ({ name })));
      expect(store.db.prepare("SELECT reference_name FROM unresolved_refs ORDER BY id").all()).toEqual([
        { reference_name: "shared" }, { reference_name: "missing" }
      ]);
      expect(await store.getGraphBuildProgress({ snapshot_id: common.snapshot_id })).toMatchObject({
        phase: "complete", status: "completed", counters: { edges: 12, unresolved_references: 2 }
      });
      const finished = state(store);
      await expect(runRepositoryGraphBuildSlice(common)).resolves.toMatchObject({ outcome: "complete" });
      expect(state(store)).toEqual(finished);
    } finally { store.close(); }
  });

  it("rolls back a whole resolution page and rejects stale generation writes", async () => {
    const { store, common } = await fixture();
    try {
      const before = state(store);
      store.db.exec(`CREATE TRIGGER reject_second_resolution BEFORE DELETE ON unresolved_refs WHEN OLD.id = 2 BEGIN SELECT RAISE(ABORT, 'second reference rejected'); END`);
      await expect(runRepositoryGraphBuildSlice({ ...common, max_resolution_references: 2 })).rejects.toThrow("second reference rejected");
      expect(state(store)).toEqual(before);
      store.db.exec("DROP TRIGGER reject_second_resolution");
      await expect(store.listBuildUnresolvedReferences({ ...common, invalidation_generation: 24, max_rows: 2 })).rejects.toThrow();
      await expect(store.applyBuildResolutionSlice({
        snapshot_id: common.snapshot_id, controller_generation: 20, invalidation_generation: common.invalidation_generation,
        provenance: "graph-build-final-resolution", resolved_references: []
      })).rejects.toThrow();
      expect(state(store)).toEqual(before);
      await expect(runRepositoryGraphBuildSlice({ ...common, max_resolution_references: 2 }))
        .resolves.toMatchObject({ outcome: "partial", continuation_cursor: "resolve:2" });
      expect(store.db.prepare("SELECT COUNT(*) AS count FROM edges").get()).toEqual({ count: 2 });
      expect(store.db.prepare("SELECT COUNT(*) AS count FROM unresolved_refs").get()).toEqual({ count: 12 });
    } finally { store.close(); }
  });

  it("resumes committed edges after interruption before cursor settlement without duplicating them", async () => {
    const { store, common } = await fixture();
    try {
      await expect(runRepositoryGraphBuildSlice({
        ...common, max_resolution_references: 2,
        build_progress: {
          getGraphBuildProgress: input => store.getGraphBuildProgress(input),
          transitionGraphBuildProgressStatus: input => store.transitionGraphBuildProgressStatus(input),
          upsertGraphBuildProgress: async () => { throw new Error("interrupted before cursor settlement"); }
        }
      })).rejects.toThrow("interrupted before cursor settlement");
      expect(await store.getGraphBuildProgress({ snapshot_id: common.snapshot_id })).toMatchObject({
        scan_cursor: "resolve:0", counters: { edges: 2, unresolved_references: 12 }
      });
      for (let pass = 0; pass < 9; pass += 1) {
        const result = await runRepositoryGraphBuildSlice({ ...common, max_resolution_references: 2 });
        if (result.outcome === "complete") break;
      }
      expect(await store.getGraphBuildProgress({ snapshot_id: common.snapshot_id })).toMatchObject({
        phase: "complete", counters: { edges: 12, unresolved_references: 2 }
      });
      expect(store.db.prepare("SELECT target_node_id, COUNT(*) AS count FROM edges GROUP BY target_node_id").all())
        .toHaveLength(12);
      expect(store.db.prepare("SELECT COUNT(*) AS count FROM edges").get()).toEqual({ count: 12 });
    } finally { store.close(); }
  });
});

function state(store: ReturnType<typeof openGraphStore>) {
  return {
    edges: store.db.prepare("SELECT * FROM edges ORDER BY id").all(),
    unresolved: store.db.prepare("SELECT * FROM unresolved_refs ORDER BY id").all(),
    progress: store.db.prepare("SELECT * FROM graph_build_progress ORDER BY snapshot_id").all()
  };
}
