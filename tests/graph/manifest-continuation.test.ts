/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { indexRepositoryGraph, runRepositoryGraphBuildSlice } from "../../src/application/use-cases/index-repository-graph.js";
import { ExtractorRegistryAdapter, ResourceExtractorAdapter } from "../../src/infrastructure/extraction/index.js";
import { FileCatalogScannerAdapter, WorkspaceFileAdapter } from "../../src/infrastructure/filesystem/index.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/index.js";
import { PythonTreeSitterExtractorAdapter } from "../../src/infrastructure/tree-sitter/index.js";
import { SystemClockAdapter } from "../../src/infrastructure/time/index.js";
import type { GraphBuildCatalogCapturePort } from "../../src/ports/index.js";

function harness() {
  let epoch = "manifest-epoch-a";
  let scans = 0;
  const directories = new Set<string>();
  const observe = () => ({ epoch, sequence: 0, healthy: true, pending_events: 0, covered_directories: [...directories] });
  return {
    manifest: {
      watcher: {
        start: async () => observe(),
        registerDirectory: async ({ path: directory }: { path: string; repository_key?: string }) => {
          directories.add(directory);
          return observe();
        }
      },
      create_scanner: (capture: GraphBuildCatalogCapturePort) => {
        scans += 1;
        return new FileCatalogScannerAdapter({ capture });
      },
      inputs: [{ path: ".", kind: "directory" as const, device: "0", inode: "0", size_bytes: "0", mtime_ns: "0", ctime_ns: "0" }]
    },
    scans: () => scans,
    changeEpoch: () => { epoch = "manifest-epoch-b"; }
  };
}

describe("sealed graph build inventory", () => {
  const roots: string[] = [];
  afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

  it("performs one broad discovery and reuses its frozen docs/Rails ordering", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-manifest-repo-"));
    const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-manifest-state-"));
    roots.push(repoRoot, stateRoot);
    fs.mkdirSync(path.join(repoRoot, "config"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "engines/shop/config/routes"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "docs/reference"), { recursive: true });
    for (const [name, content] of Object.entries({
      "AGENTS.md": "# Instructions\n", "README.md": "# Read me\n", "Gemfile": "source 'https://rubygems.org'\n",
      "config/application.rb": "class Application < Rails::Application; end\n",
      "config/routes.rb": "Rails.application.routes.draw do\nend\n",
      "engines/shop/config/routes/admin.rb": "Shop::Engine.routes.draw do\nend\n",
      "docs/reference/documentation-map.md": "| Concern | Canonical owner | Intent terms |\n| --- | --- | --- |\n| Runtime | [Runtime owner](runtime.md) | runtime contract |\n",
      "docs/reference/runtime.md": "# Runtime owner\nThe runtime contract is owned here.\n"
    })) fs.writeFileSync(path.join(repoRoot, name), content);
    const store = openGraphStore(path.join(stateRoot, "graph.sqlite"));
    const extractors = new ExtractorRegistryAdapter();
    extractors.register(new PythonTreeSitterExtractorAdapter());
    const watch = harness();
    const progressEvents: Array<{ phase: string; completed: number }> = [];
    try {
      const snapshotId = await store.allocateBuildSnapshotId({ repo_root: repoRoot, minimum_id: "8101" });
      const common = {
        repo_root: repoRoot, workspace: new WorkspaceFileAdapter({ repoRoot }), extractors,
        resource_extractor: new ResourceExtractorAdapter(), graph: store, catalog: store, docs_index: store,
        documentation_concerns: store, snapshots: store,
        build_progress: store, build_seed: store, build_read: store, build_coverage: store, build_resolution: store,
        manifest: { store, ...watch.manifest }, clock: new SystemClockAdapter(), schema_version: SCHEMA_VERSION,
        owner_id: "manifest-owner", controller_generation: 21, invalidation_generation: 34, max_files: 1,
        should_yield_extraction: () => true,
        report_build_progress: (phase: string, completed: number) => { progressEvents.push({ phase, completed }); }
      } as const;
      await runRepositoryGraphBuildSlice({ ...common, snapshot_id: snapshotId });
      expect(progressEvents).toEqual(expect.arrayContaining([
        expect.objectContaining({ phase: "extraction", completed: 1 }),
        expect.objectContaining({ phase: "graph_write", completed: 1 })
      ]));
      const manifest = await store.getGraphBuildManifest({ snapshot_id: snapshotId });
      expect(manifest?.files.slice(0, 5).map((file) => file.entry.path)).toEqual([
        "AGENTS.md", "README.md", "Gemfile", "config/application.rb", "config/routes.rb"
      ]);
      expect(manifest?.files.filter((file) => file.docs_eligible).map((file) => file.entry.path)).toEqual([
        "AGENTS.md", "README.md", "docs/reference/documentation-map.md", "docs/reference/runtime.md"
      ]);
      expect(manifest?.shape.route_file_paths).toEqual(expect.arrayContaining(["config/routes.rb", "engines/shop/config/routes/admin.rb"]));
      expect((await store.getGraphBuildProgress({ snapshot_id: snapshotId }))?.ordinal_cursor).toBe(1);
      const docsAfterSeed = store.db.prepare("SELECT COUNT(*) AS count FROM docs_documents WHERE snapshot_id = ?")
        .get(Number(snapshotId)) as { count: number };
      expect(docsAfterSeed.count).toBe(4);
      await runRepositoryGraphBuildSlice({ ...common, snapshot_id: snapshotId });
      expect(watch.scans()).toBe(1);
      expect(store.db.prepare("SELECT COUNT(*) AS count FROM docs_documents WHERE snapshot_id = ?")
        .get(Number(snapshotId))).toEqual(docsAfterSeed);
      await store.transitionBuild({
        repo_root: repoRoot, snapshot_id: snapshotId, controller_generation: 21, invalidation_generation: 34,
        from: "building", to: "published", updated_at: common.clock.nowIso8601()
      });
      await expect(store.search({ repo_root: repoRoot, snapshot_id: snapshotId, query: "runtime contract", max_results: 10, include_snippets: true }))
        .resolves.toMatchObject({ status: "done", hits: expect.arrayContaining([expect.objectContaining({ path: "docs/reference/runtime.md" })]) });
      await expect(store.listDocumentationConcernOwners({ snapshot_id: snapshotId, max_rows: 10 }))
        .resolves.toMatchObject({ status: "ready", rows: expect.arrayContaining([expect.objectContaining({ mapped_owner_path: "docs/reference/runtime.md" })]) });
    } finally { store.close(); }
  });

  it("invalidates the owned sealed manifest on watcher epoch drift", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-manifest-epoch-repo-"));
    const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-manifest-epoch-state-"));
    roots.push(repoRoot, stateRoot);
    fs.writeFileSync(path.join(repoRoot, "a.py"), "def caller():\n  return callee()\n");
    fs.writeFileSync(path.join(repoRoot, "b.py"), "def callee():\n  return 2\n");
    const store = openGraphStore(path.join(stateRoot, "graph.sqlite"));
    const extractors = new ExtractorRegistryAdapter();
    extractors.register(new PythonTreeSitterExtractorAdapter());
    const watch = harness();
    try {
      const snapshotId = await store.allocateBuildSnapshotId({ repo_root: repoRoot, minimum_id: "8201" });
      const common = {
        repo_root: repoRoot, workspace: new WorkspaceFileAdapter({ repoRoot }), extractors,
        resource_extractor: new ResourceExtractorAdapter(), graph: store, catalog: store, snapshots: store,
        build_progress: store, build_seed: store, build_read: store, build_coverage: store, build_resolution: store,
        manifest: { store, ...watch.manifest }, clock: new SystemClockAdapter(), schema_version: SCHEMA_VERSION,
        owner_id: "epoch-owner", controller_generation: 22, invalidation_generation: 35, max_files: 10,
        priority_paths: ["b.py", "a.py"]
      } as const;
      await runRepositoryGraphBuildSlice({ ...common, snapshot_id: snapshotId });
      expect(store.db.prepare(`
        SELECT target.name AS target_name
        FROM edges
        INNER JOIN nodes AS source ON source.id = edges.source_node_id
        INNER JOIN nodes AS target ON target.id = edges.target_node_id
        WHERE source.name = 'caller'
      `).get()).toEqual({ target_name: "callee" });
      const manifestId = (await store.getGraphBuildProgress({ snapshot_id: snapshotId }))?.manifest_id;
      watch.changeEpoch();
      await expect(runRepositoryGraphBuildSlice({ ...common, snapshot_id: snapshotId })).rejects.toThrow("manifest");
      await expect(store.getGraphBuildManifest({ manifest_id: manifestId! })).resolves.toMatchObject({ state: "invalid" });
      expect(watch.scans()).toBe(1);
    } finally { store.close(); }
  });

  it("rejects a manifest build when an existing snapshot has a newer schema", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-manifest-schema-repo-"));
    const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-manifest-schema-state-"));
    roots.push(repoRoot, stateRoot);
    fs.writeFileSync(path.join(repoRoot, "a.py"), "def a():\n  return 1\n");
    const store = openGraphStore(path.join(stateRoot, "graph.sqlite"));
    const registry = new ExtractorRegistryAdapter();
    registry.register(new PythonTreeSitterExtractorAdapter());
    try {
      await store.upsertSnapshot({ snapshot: {
        id: "8299", repo_root: repoRoot, workspace_root: repoRoot, repo_identity: repoRoot,
        config_identity: "default", schema_version: SCHEMA_VERSION + 1, freshness: "fresh", owner_state: "owner",
        created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z"
      } });
      await expect(runRepositoryGraphBuildSlice({
        repo_root: repoRoot, workspace: new WorkspaceFileAdapter({ repoRoot }), extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(), graph: store, catalog: store, snapshots: store,
        build_progress: store, build_seed: store, build_read: store, build_coverage: store, build_resolution: store,
        manifest: { store, ...harness().manifest }, clock: new SystemClockAdapter(), schema_version: SCHEMA_VERSION,
        snapshot_id: "8300", owner_id: "schema-owner", controller_generation: 23, invalidation_generation: 36, max_files: 1
      })).rejects.toThrow("schema version does not match");
    } finally { store.close(); }
  });

  it("preserves Lambda handler routing for both manifest orders, including a published seed clone", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-manifest-lambda-repo-"));
    const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-manifest-lambda-state-"));
    roots.push(repoRoot, stateRoot);
    fs.mkdirSync(path.join(repoRoot, "src/orders"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "template.yaml"), [
      "AWSTemplateFormatVersion: '2010-09-09'", "Transform: AWS::Serverless-2016-10-31", "Resources:",
      "  OrdersFunction:", "    Type: AWS::Serverless::Function", "    Properties:", "      Handler: src/orders/app.handler"
    ].join("\n"));
    fs.writeFileSync(path.join(repoRoot, "src/orders/app.py"), "def handler(event, context):\n  return {'statusCode': 200}\n");
    const store = openGraphStore(path.join(stateRoot, "graph.sqlite"));
    const baselineStore = openGraphStore(path.join(stateRoot, "baseline.sqlite"));
    const registry = new ExtractorRegistryAdapter();
    registry.register(new PythonTreeSitterExtractorAdapter());
    const clock = new SystemClockAdapter();
    const makeCommon = (priority_paths: readonly string[], owner_id: string, generation: number) => ({
      repo_root: repoRoot, workspace: new WorkspaceFileAdapter({ repoRoot }), extractors: registry,
      resource_extractor: new ResourceExtractorAdapter(), graph: store, catalog: store, snapshots: store,
      build_progress: store, build_seed: store, build_read: store, build_coverage: store, build_resolution: store,
      manifest: { store, ...harness().manifest }, clock, schema_version: SCHEMA_VERSION, owner_id,
      controller_generation: generation, invalidation_generation: generation + 100, max_files: 1, priority_paths
    } as const);
    const complete = async (common: ReturnType<typeof makeCommon>, snapshot_id: string) => {
      let result = await runRepositoryGraphBuildSlice({ ...common, snapshot_id });
      while (result.outcome !== "complete") result = await runRepositoryGraphBuildSlice({ ...common, snapshot_id });
    };
    const assertRouting = (snapshotId: string) => {
      const row = store.db.prepare(`
        SELECT source.kind AS source_kind, target.kind AS target_kind, edges.kind AS edge_kind
        FROM edges
        INNER JOIN nodes AS source ON source.id = edges.source_node_id
        INNER JOIN nodes AS target ON target.id = edges.target_node_id
        INNER JOIN files AS source_file ON source_file.id = source.file_id
        WHERE source.kind = 'lambda_handler_binding' AND target.kind = 'lambda_handler_file' AND source_file.snapshot_id = ?
      `).get(Number(snapshotId)) as { source_kind: string; target_kind: string; edge_kind: string } | undefined;
      expect(row).toEqual({ source_kind: "lambda_handler_binding", target_kind: "lambda_handler_file", edge_kind: "routes_to_handler_file" });
      expect(store.db.prepare(`
        SELECT COUNT(*) AS count FROM nodes
        INNER JOIN files ON files.id = nodes.file_id
        WHERE files.snapshot_id = ? AND nodes.kind = 'lambda_handler_file'
      `).get(Number(snapshotId))).toEqual({ count: 1 });
    };
    const normalizedRouting = (targetStore: typeof store, snapshotId: string) => ({
      nodes: targetStore.db.prepare(`
        SELECT nodes.kind, nodes.name, nodes.qualified_name, files.path, nodes.language,
               nodes.start_line, nodes.start_column, nodes.end_line, nodes.end_column,
               nodes.signature, nodes.metadata_json
        FROM nodes INNER JOIN files ON files.id = nodes.file_id
        WHERE files.snapshot_id = ? AND nodes.kind = 'lambda_handler_file'
        ORDER BY nodes.qualified_name
      `).all(Number(snapshotId)),
      edges: targetStore.db.prepare(`
        SELECT edges.kind, edges.provenance, edges.confidence, edges.metadata_json,
               source.kind AS source_kind, source.name AS source_name, source.qualified_name AS source_qualified_name,
               target.kind AS target_kind, target.name AS target_name, target.qualified_name AS target_qualified_name
        FROM edges
        INNER JOIN nodes AS source ON source.id = edges.source_node_id
        INNER JOIN nodes AS target ON target.id = edges.target_node_id
        INNER JOIN files AS source_file ON source_file.id = source.file_id
        WHERE source_file.snapshot_id = ? AND source.kind = 'lambda_handler_binding' AND target.kind = 'lambda_handler_file'
        ORDER BY edges.kind, source.qualified_name, target.qualified_name
      `).all(Number(snapshotId))
    });
    try {
      await indexRepositoryGraph({
        repo_root: repoRoot, scanner: new FileCatalogScannerAdapter(), workspace: new WorkspaceFileAdapter({ repoRoot }),
        extractors: registry, resource_extractor: new ResourceExtractorAdapter(), graph: baselineStore, catalog: baselineStore,
        snapshots: baselineStore, clock, schema_version: SCHEMA_VERSION, snapshot_id: "8500"
      });
      const baseline = normalizedRouting(baselineStore, "8500");
      const seed = await store.allocateBuildSnapshotId({ repo_root: repoRoot, minimum_id: "8301" });
      const sourceFirst = makeCommon(["template.yaml", "src/orders/app.py"], "lambda-seed-owner", 31);
      await runRepositoryGraphBuildSlice({ ...sourceFirst, snapshot_id: seed });
      await store.transitionBuild({ repo_root: repoRoot, snapshot_id: seed, controller_generation: 31, invalidation_generation: 131,
        from: "building", to: "published", updated_at: clock.nowIso8601() });
      const cloned = await store.allocateBuildSnapshotId({ repo_root: repoRoot, minimum_id: "8302" });
      await complete(sourceFirst, cloned);
      await store.transitionBuild({ repo_root: repoRoot, snapshot_id: cloned, controller_generation: 31, invalidation_generation: 131,
        from: "building", to: "published", updated_at: clock.nowIso8601() });
      assertRouting(cloned);
      expect(normalizedRouting(store, cloned)).toEqual(baseline);

      const targetFirst = await store.allocateBuildSnapshotId({ repo_root: repoRoot, minimum_id: "8401" });
      const targetFirstCommon = makeCommon(["src/orders/app.py", "template.yaml"], "lambda-target-owner", 32);
      await complete(targetFirstCommon, targetFirst);
      await store.transitionBuild({ repo_root: repoRoot, snapshot_id: targetFirst, controller_generation: 32, invalidation_generation: 132,
        from: "building", to: "published", updated_at: clock.nowIso8601() });
      assertRouting(targetFirst);
      expect(normalizedRouting(store, targetFirst)).toEqual(baseline);
    } finally { store.close(); baselineStore.close(); }
  });
});
