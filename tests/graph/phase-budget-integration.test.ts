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
import { RefreshPassBudget } from "../../src/infrastructure/workers/refresh-pass-budget.js";
import type { GraphBuildCatalogCapturePort } from "../../src/ports/index.js";

describe("manifest phase budget integration", () => {
  const roots: string[] = [];
  afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

  function makeFixture(options: { preparation_ms?: number; extraction_ms?: number }) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-phase-budget-")); roots.push(root);
    const repo = path.join(root, "repo"); fs.mkdirSync(repo);
    fs.writeFileSync(path.join(repo, "a.py"), "def a():\n    return 1\n");
    fs.writeFileSync(path.join(repo, "b.py"), "def b():\n    return 2\n");
    const store = openGraphStore(path.join(root, "graph.sqlite"));
    let now = 0, scans = 0;
    const parser = new PythonTreeSitterExtractorAdapter();
    const extractors = new ExtractorRegistryAdapter();
    extractors.register({ language: parser.language, supports: input => parser.supports(input),
      async extract(input) { const result = await parser.extract(input); now += options.extraction_ms ?? 0; return result; } });
    const directories = new Set<string>();
    const observation = () => ({ epoch: "phase-budget-epoch", sequence: 0, healthy: true, pending_events: 0, covered_directories: [...directories] });
    const common = {
      repo_root: repo, workspace: new WorkspaceFileAdapter({ repoRoot: repo }), extractors,
      resource_extractor: new ResourceExtractorAdapter(), graph: store, catalog: store, snapshots: store,
      build_progress: store, build_seed: store, build_read: store, build_coverage: store, build_resolution: store,
      clock: { now: () => new Date(now), nowIso8601: () => new Date(now).toISOString(), nowUnixMs: () => now },
      schema_version: SCHEMA_VERSION, snapshot_id: "19002", owner_id: "phase-budget-owner",
      controller_generation: 31, invalidation_generation: 41, max_files: 100,
      manifest: {
        store, watcher: { start: async () => observation(), registerDirectory: async ({ path: directory }: { path: string }) => { directories.add(directory); return observation(); } },
        create_scanner: (capture: GraphBuildCatalogCapturePort) => {
          const scanner = new FileCatalogScannerAdapter({ capture });
          return { async scan(input: Parameters<typeof scanner.scan>[0]) { scans += 1; const result = await scanner.scan(input); now += options.preparation_ms ?? 0; return result; } };
        },
        inputs: [{ path: ".", kind: "directory" as const, device: "0", inode: "0", size_bytes: "0", mtime_ns: "0", ctime_ns: "0" }]
      }
    };
    const nextPass = () => {
      const budget = new RefreshPassBudget({ deadline_at: new Date(now + 60_000).toISOString(), timeout_ms: 60_000, now: () => now });
      return { ...common, observe_build_phase: (phase: Parameters<typeof budget.enter>[0]) => budget.enter(phase),
        check_build_budget: () => budget.check(), should_yield_extraction: () => budget.shouldYieldExtraction() };
    };
    return { store, common, nextPass, scans: () => scans };
  }

  it("invalidates over-budget preparation before sealing or publishing any inventory", async () => {
    const fixture = makeFixture({ preparation_ms: 4_000 });
    try {
      await expect(runRepositoryGraphBuildSlice(fixture.nextPass())).rejects.toThrow("preparation_allowance_exhausted");
      expect(fixture.store.db.prepare("SELECT state, sealed_at FROM graph_build_manifests").all()).toEqual([{ state: "invalid", sealed_at: null }]);
      expect(fixture.store.db.prepare("SELECT COUNT(*) AS count FROM graph_build_progress").get()).toEqual({ count: 0 });
      expect(fixture.store.db.prepare("SELECT COUNT(*) AS count FROM files").get()).toEqual({ count: 0 });
      expect(fixture.store.db.prepare("SELECT publication_state, freshness FROM snapshots").all()).toEqual([{ publication_state: "building", freshness: "refreshing" }]);
    } finally { fixture.store.close(); }
  });

  it("settles a whole file just past its soft target, then yields with distinct resumed counters", async () => {
    const fixture = makeFixture({ preparation_ms: 3_000, extraction_ms: 4_001 });
    try {
      await expect(runRepositoryGraphBuildSlice(fixture.nextPass())).resolves.toMatchObject({ outcome: "partial", continuation_cursor: "b.py" });
      expect(await fixture.store.getGraphBuildProgress({ snapshot_id: fixture.common.snapshot_id })).toMatchObject({
        counters_version: 2, ordinal_cursor: 1, counters: { eligible_files: 2, scanned_files: 2, admitted_files: 1, extracted_files: 1 }
      });
      await expect(runRepositoryGraphBuildSlice(fixture.nextPass())).resolves.toMatchObject({ outcome: "partial", continuation_cursor: "resolve:0" });
      await expect(runRepositoryGraphBuildSlice(fixture.nextPass())).resolves.toMatchObject({ outcome: "complete" });
      expect(fixture.scans()).toBe(1);
      expect(await fixture.store.getGraphBuildProgress({ snapshot_id: fixture.common.snapshot_id })).toMatchObject({
        status: "completed", phase: "complete", counters_version: 2,
        counters: { eligible_files: 2, scanned_files: 2, admitted_files: 2, extracted_files: 2 }
      });
      expect(fixture.store.db.prepare("SELECT COUNT(*) AS count FROM files").get()).toEqual({ count: 2 });
    } finally { fixture.store.close(); }
  });

  it("rejects a completed native parse that used the required reserve before graph writes", async () => {
    const fixture = makeFixture({ extraction_ms: 11_000 });
    try {
      await expect(runRepositoryGraphBuildSlice(fixture.nextPass())).rejects.toThrow("required_settlement_reserve_unavailable");
      expect(fixture.store.db.prepare("SELECT COUNT(*) AS count FROM files").get()).toEqual({ count: 0 });
      expect(fixture.store.db.prepare("SELECT COUNT(*) AS count FROM nodes").get()).toEqual({ count: 0 });
      expect(await fixture.store.getGraphBuildProgress({ snapshot_id: fixture.common.snapshot_id })).toMatchObject({
        phase: "extracting", ordinal_cursor: 0, counters: { admitted_files: 0, extracted_files: 0 }
      });
    } finally { fixture.store.close(); }
  });

});
