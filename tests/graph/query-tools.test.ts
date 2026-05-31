import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeImpact } from "../../src/application/use-cases/compute-impact.js";
import { findReferences } from "../../src/application/use-cases/find-references.js";
import { indexRepositoryGraph } from "../../src/application/use-cases/index-repository-graph.js";
import { searchSymbols } from "../../src/application/use-cases/search-symbols.js";
import type { ClockPort } from "../../src/ports/index.js";
import { ExtractorRegistryAdapter, ResourceExtractorAdapter } from "../../src/infrastructure/extraction/index.js";
import { FileCatalogScannerAdapter, WorkspaceFileAdapter } from "../../src/infrastructure/filesystem/index.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/index.js";
import { PythonTreeSitterExtractorAdapter } from "../../src/infrastructure/tree-sitter/index.js";

const clock: ClockPort = {
  now: () => new Date("2026-05-31T12:00:00.000Z"),
  nowIso8601: () => "2026-05-31T12:00:00.000Z",
  nowUnixMs: () => 201
};

describe("graph query use cases", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-query-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("searches symbols with stable budgets and optional source sections", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-basic-python", "201");
    try {
      const result = await searchSymbols({
        request: {
          query: "Runner",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: ["python"],
          max_results: 5,
          source_byte_limit: 40
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(result.symbols.symbols).toEqual([
        expect.objectContaining({
          name: "Runner",
          language: "python",
          capability_level: "partial_semantic",
          evidence_kinds: ["parser"],
          source_section: expect.objectContaining({
            path: "src/sample_pkg/service.py",
            byte_count: expect.any(Number),
            truncated: true
          })
        })
      ]);
      expect(result.meta.budget).toMatchObject({
        row_limit: 5,
        source_byte_limit: 40
      });
      expect(result.symbols.next_actions).toEqual([
        expect.objectContaining({
          tool: "find_references"
        })
      ]);
    } finally {
      fixture.store.close();
    }
  });

  it("finds resolved references and routes to impact", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-basic-python", "202");
    try {
      const run = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "202",
        qualified_name: "Runner.run"
      });
      const helper = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "202",
        qualified_name: "helper"
      });
      const result = await findReferences({
        request: {
          node_id: run[0]?.id,
          max_depth: 1,
          max_results: 10
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(result.references.references).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source_node_id: run[0]?.id,
            target_node_id: helper[0]?.id,
            status: "resolved"
          })
        ])
      );
      expect(result.references.next_actions).toEqual([
        expect.objectContaining({
          tool: "impact"
        })
      ]);
    } finally {
      fixture.store.close();
    }
  });

  it("keeps duplicate-name references ambiguous and bounded", async () => {
    const repoRoot = path.join(dir, "ambiguous-repo");
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "a.py"), "def helper() -> str:\n    return 'a'\n");
    fs.writeFileSync(path.join(repoRoot, "b.py"), "def helper() -> str:\n    return 'b'\n");
    fs.writeFileSync(path.join(repoRoot, "main.py"), "def run() -> str:\n    return helper()\n");
    const fixture = await indexedFixture(repoRoot, "203");
    try {
      const run = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "203",
        qualified_name: "run"
      });
      const result = await findReferences({
        request: {
          node_id: run[0]?.id,
          max_depth: 1,
          max_results: 1
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: repoRoot
      });

      expect(result.references.references).toEqual([
        expect.objectContaining({
          reference_name: "helper",
          status: "ambiguous"
        })
      ]);
      expect(result.meta.budget).toMatchObject({
        row_limit: 1,
        traversal_depth: 1
      });
    } finally {
      fixture.store.close();
    }
  });

  it("computes bounded impact without broad source scans", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-basic-python", "204");
    try {
      const run = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "204",
        qualified_name: "Runner.run"
      });
      const result = await computeImpact({
        request: {
          node_id: run[0]?.id ?? "",
          max_depth: 1,
          max_nodes: 2,
          direction: "outgoing"
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(result.impact.affected_symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ qualified_name: "Runner.run" }),
          expect.objectContaining({ qualified_name: "helper" })
        ])
      );
      expect(result.impact.affected_files).toEqual([
        expect.objectContaining({
          path: "src/sample_pkg/service.py"
        })
      ]);
      expect(result.meta.budget).toMatchObject({
        row_limit: 2,
        traversal_depth: 1
      });
    } finally {
      fixture.store.close();
    }
  });

  it("returns blocked metadata instead of scanning when no snapshot exists", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-basic-python");
    const store = openGraphStore(path.join(dir, "empty.sqlite"));
    try {
      const result = await searchSymbols({
        request: {
          query: "Runner",
          max_results: 5,
          source_byte_limit: 0,
          exact: false,
          languages: []
        },
        graph: store,
        snapshots: store,
        catalog: store,
        default_repo_root: repoRoot
      });

      expect(result.meta).toMatchObject({
        analysis_validity: "invalid",
        freshness: "cold",
        verification_status: "blocked"
      });
      expect(result.symbols.next_actions).toEqual([
        expect.objectContaining({
          tool: "prewarm_graph"
        })
      ]);
    } finally {
      store.close();
    }
  });

  async function indexedFixture(repoRootInput: string, snapshotId: string) {
    const repoRoot = path.resolve(repoRootInput);
    const store = openGraphStore(path.join(dir, `${snapshotId}.sqlite`));
    const registry = new ExtractorRegistryAdapter();
    registry.register(new PythonTreeSitterExtractorAdapter());
    const workspace = new WorkspaceFileAdapter({ repoRoot });
    await indexRepositoryGraph({
      repo_root: repoRoot,
      scanner: new FileCatalogScannerAdapter(),
      workspace,
      extractors: registry,
      resource_extractor: new ResourceExtractorAdapter(),
      graph: store,
      catalog: store,
      snapshots: store,
      clock,
      schema_version: SCHEMA_VERSION,
      snapshot_id: snapshotId
    });
    return { repoRoot, store, workspace };
  }
});
