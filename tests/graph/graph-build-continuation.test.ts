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

describe("durable repository graph completion", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it("publishes a truthful deadline-yielded seed, resumes one target, and resolves references across chunks", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-graph-continuation-repo-"));
    const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-graph-continuation-state-"));
    roots.push(repoRoot, stateRoot);
    fs.writeFileSync(path.join(repoRoot, "AGENTS.md"), "# Instructions\n");
    fs.writeFileSync(path.join(repoRoot, "README.md"), "# Fixture\n");
    fs.writeFileSync(path.join(repoRoot, "a.py"), "def run():\n    return helper()\n");
    fs.writeFileSync(path.join(repoRoot, "z.py"), "def helper():\n    return 'ok'\n");

    const store = openGraphStore(path.join(stateRoot, "graph.sqlite"));
    const scanner = new FileCatalogScannerAdapter();
    const workspace = new WorkspaceFileAdapter({ repoRoot });
    const extractors = new ExtractorRegistryAdapter();
    extractors.register(new PythonTreeSitterExtractorAdapter());
    const resourceExtractor = new ResourceExtractorAdapter();
    const clock = new SystemClockAdapter();
    const common = {
      repo_root: repoRoot,
      scanner,
      workspace,
      extractors,
      resource_extractor: resourceExtractor,
      graph: store,
      catalog: store,
      docs_index: store,
      documentation_concerns: store,
      snapshots: store,
      build_progress: store,
      build_seed: store,
      build_read: store,
      build_coverage: store,
      build_resolution: store,
      clock,
      schema_version: SCHEMA_VERSION,
      controller_generation: 7,
      invalidation_generation: 11,
      owner_id: "continuation-owner-7",
      max_files: 100,
      max_resolution_references: 1,
      should_yield_extraction: () => true
    } as const;

    try {
      const seedId = await store.allocateBuildSnapshotId({ repo_root: repoRoot, minimum_id: "7001" });
      const seed = await runRepositoryGraphBuildSlice({ ...common, snapshot_id: seedId });
      expect(seed).toMatchObject({
        outcome: "partial",
        partial_kind: "publish_seed",
        continuation_cursor: "AGENTS.md"
      });
      await store.transitionBuild({
        repo_root: repoRoot,
        snapshot_id: seedId,
        controller_generation: 7,
        invalidation_generation: 11,
        from: "building",
        to: "published",
        updated_at: clock.nowIso8601()
      });
      await expect(store.getFile({ snapshot_id: seedId, path: "AGENTS.md" })).resolves.toMatchObject({ indexed: true });
      expect(store.db.prepare(`
        SELECT state, continuation_available, continuation_cursor, reason
        FROM snapshot_index_coverage
        WHERE snapshot_id = ? AND evidence_class = 'graph'
      `).get(Number(seedId))).toMatchObject({
        state: "partial",
        continuation_available: 1,
        continuation_cursor: "AGENTS.md",
        reason: expect.stringContaining("yielded before the worker deadline")
      });

      const completionId = await store.allocateBuildSnapshotId({ repo_root: repoRoot, minimum_id: "7002" });
      await expect(runRepositoryGraphBuildSlice({
        ...common,
        snapshot_id: completionId,
        owner_id: "different-owner"
      })).rejects.toThrow("owner does not match");
      const second = await runRepositoryGraphBuildSlice({ ...common, snapshot_id: completionId });
      expect(second).toMatchObject({
        outcome: "partial",
        partial_kind: "continue_build",
        coverage: [expect.objectContaining({
          scan_truncated: false,
          extraction_truncated: true
        })]
      });
      const third = await runRepositoryGraphBuildSlice({ ...common, snapshot_id: completionId });
      expect(third).toMatchObject({
        outcome: "partial",
        partial_kind: "continue_build",
        coverage: [expect.objectContaining({
          scan_truncated: false,
          extraction_truncated: true
        })]
      });
      const fourth = await runRepositoryGraphBuildSlice({ ...common, snapshot_id: completionId });
      expect(fourth).toMatchObject({
        outcome: "partial",
        partial_kind: "continue_build",
        continuation_cursor: "resolve:0",
        coverage: [expect.objectContaining({
          scan_truncated: false,
          extraction_truncated: false,
          reason: expect.stringContaining("durable resolution cursor")
        })]
      });
      const fifth = await runRepositoryGraphBuildSlice({ ...common, snapshot_id: completionId });
      expect(fifth).toMatchObject({
        outcome: "partial",
        partial_kind: "continue_build",
        continuation_cursor: expect.stringMatching(/^resolve:\d+$/u),
        coverage: [expect.objectContaining({
          scan_truncated: false,
          extraction_truncated: false,
          reason: expect.stringContaining("durable resolution cursor")
        })]
      });
      const sixth = await runRepositoryGraphBuildSlice({ ...common, snapshot_id: completionId });
      expect(sixth).toMatchObject({ outcome: "complete" });

      await expect(store.getFile({ snapshot_id: completionId, path: "z.py" })).resolves.toBeNull();
      await store.transitionBuild({
        repo_root: repoRoot,
        snapshot_id: completionId,
        controller_generation: 7,
        invalidation_generation: 11,
        from: "building",
        to: "published",
        updated_at: clock.nowIso8601()
      });
      const run = await store.findNodesByQualifiedName({ snapshot_id: completionId, qualified_name: "run" });
      const helper = await store.findNodesByQualifiedName({ snapshot_id: completionId, qualified_name: "helper" });
      expect(run).toHaveLength(1);
      expect(helper).toHaveLength(1);
      await expect(store.getReferences({ snapshot_id: completionId, node_id: run[0]?.id ?? "" })).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target_node_id: helper[0]?.id,
            provenance: "graph-build-final-resolution"
          })
        ])
      );
      expect(store.db.prepare(`
        SELECT state, continuation_available, continuation_cursor
        FROM snapshot_index_coverage
        WHERE snapshot_id = ? AND evidence_class = 'graph'
      `).get(Number(completionId))).toMatchObject({
        state: "complete",
        continuation_available: 0,
        continuation_cursor: null
      });
    } finally {
      store.close();
    }
  });

  it("preserves Rails route discovery metadata for later engine chunks", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-graph-continuation-rails-"));
    const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-graph-continuation-rails-state-"));
    roots.push(repoRoot, stateRoot);
    fs.mkdirSync(path.join(repoRoot, "config"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "engines", "commerce", "config", "routes"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "Gemfile"), "source 'https://rubygems.org'\n");
    fs.writeFileSync(path.join(repoRoot, "config", "application.rb"), "module Demo\n  class Application < Rails::Application\n  end\nend\n");
    fs.writeFileSync(path.join(repoRoot, "config", "routes.rb"), "Rails.application.routes.draw do\nend\n");
    fs.writeFileSync(path.join(repoRoot, "engines", "commerce", "config", "routes.rb"), "Commerce::Engine.routes.draw do\nend\n");
    fs.writeFileSync(path.join(repoRoot, "engines", "commerce", "config", "routes", "admin.rb"), "Commerce::Engine.routes.draw do\nend\n");
    fs.writeFileSync(path.join(repoRoot, "z-last.rb"), "class ZLast; end\n");

    const store = openGraphStore(path.join(stateRoot, "graph.sqlite"));
    const scanner = new FileCatalogScannerAdapter();
    const workspace = new WorkspaceFileAdapter({ repoRoot });
    const extractors = new ExtractorRegistryAdapter();
    const resourceExtractor = new ResourceExtractorAdapter();
    const clock = new SystemClockAdapter();
    const common = {
      repo_root: repoRoot,
      scanner,
      workspace,
      extractors,
      resource_extractor: resourceExtractor,
      graph: store,
      catalog: store,
      docs_index: store,
      documentation_concerns: store,
      snapshots: store,
      build_progress: store,
      build_seed: store,
      build_read: store,
      build_coverage: store,
      build_resolution: store,
      clock,
      schema_version: SCHEMA_VERSION,
      controller_generation: 9,
      invalidation_generation: 13,
      owner_id: "continuation-owner-rails",
      max_files: 3
    } as const;

    try {
      const seedId = await store.allocateBuildSnapshotId({ repo_root: repoRoot, minimum_id: "7101" });
      const seed = await runRepositoryGraphBuildSlice({ ...common, snapshot_id: seedId });
      expect(seed).toMatchObject({
        outcome: "partial",
        partial_kind: "publish_seed",
        continuation_cursor: "config/routes.rb"
      });
      await store.transitionBuild({
        repo_root: repoRoot,
        snapshot_id: seedId,
        controller_generation: 9,
        invalidation_generation: 13,
        from: "building",
        to: "published",
        updated_at: clock.nowIso8601()
      });

      const completionId = await store.allocateBuildSnapshotId({ repo_root: repoRoot, minimum_id: "7102" });
      let result = await runRepositoryGraphBuildSlice({ ...common, snapshot_id: completionId });
      while (result.outcome !== "complete") {
        result = await runRepositoryGraphBuildSlice({ ...common, snapshot_id: completionId });
      }
      await store.transitionBuild({
        repo_root: repoRoot,
        snapshot_id: completionId,
        controller_generation: 9,
        invalidation_generation: 13,
        from: "building",
        to: "published",
        updated_at: clock.nowIso8601()
      });

      const routeNode = await store.findNodesByQualifiedName({
        snapshot_id: completionId,
        qualified_name: "engines/commerce/config/routes/admin.rb"
      });
      expect(routeNode).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            metadata: expect.objectContaining({
              rails_discovery: expect.objectContaining({
                rails_is_route_file: true,
                rails_project_roots: expect.arrayContaining(["engines/commerce"])
              })
            })
          })
        ])
      );
    } finally {
      store.close();
    }
  });
});
