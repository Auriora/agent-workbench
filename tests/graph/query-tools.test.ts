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
import {
  CppDeclarationExtractorAdapter,
  GoDeclarationExtractorAdapter,
  PythonTreeSitterExtractorAdapter
} from "../../src/infrastructure/tree-sitter/index.js";

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
      expect(result.meta.scope.languages).toContain("python");
      expect(result.symbols.next_actions).toEqual([
        expect.objectContaining({
          tool: "find_references"
        })
      ]);
    } finally {
      fixture.store.close();
    }
  });

  it("includes returned symbol languages in metadata even when catalog budget is narrower", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-basic-python", "209");
    try {
      const result = await searchSymbols({
        request: {
          query: "Runner",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: [],
          max_results: 1,
          source_byte_limit: 0
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
          language: "python"
        })
      ]);
      expect(result.meta.scope.languages).toContain("python");
    } finally {
      fixture.store.close();
    }
  });

  it("searches SAM logical IDs and Lambda handler strings as resource-backed routing symbols", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-sam-lambda-repo", "219");
    try {
      const logicalId = await searchSymbols({
        request: {
          query: "OrdersFunction",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: [],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });
      const handler = await searchSymbols({
        request: {
          query: "src/orders/app.handler",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: [],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(logicalId.symbols.symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "lambda_function",
            name: "OrdersFunction",
            path: "infra/sam/orders/template.yaml",
            capability_level: "resource_backed",
            evidence_kinds: expect.arrayContaining(["config", "infra_parser"])
          })
        ])
      );
      expect(handler.symbols.symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "lambda_handler_binding",
            name: "src/orders/app.handler",
            path: "infra/sam/orders/template.yaml",
            capability_level: "resource_backed"
          })
        ])
      );
    } finally {
      fixture.store.close();
    }
  });

  it("treats Lambda handler string suffix queries as exact resource-backed matches", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-sam-lambda-repo", "220");
    try {
      const result = await searchSymbols({
        request: {
          query: "app.handler",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: [],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(result.symbols.symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "lambda_handler_binding",
            name: "src/orders/app.handler",
            capability_level: "resource_backed"
          }),
          expect.objectContaining({
            kind: "lambda_handler_file",
            path: "src/orders/app.py",
            capability_level: "resource_backed"
          })
        ])
      );
      expect(result.symbols.next_actions).toEqual([
        expect.objectContaining({
          tool: "find_references"
        })
      ]);
    } finally {
      fixture.store.close();
    }
  });

  it("routes SAM handler bindings to resolved handler files with low-confidence impact", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-sam-lambda-repo", "222");
    try {
      const symbols = await searchSymbols({
        request: {
          query: "src/orders/app.handler",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: [],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });
      const nodeId = symbols.symbols.symbols.find((symbol) => symbol.kind === "lambda_handler_binding")?.node_id ?? "";
      const impact = await computeImpact({
        request: {
          node_id: nodeId,
          max_depth: 1,
          max_nodes: 10,
          direction: "outgoing"
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });
      const unresolved = await fixture.store.getUnresolvedReferences({
        snapshot_id: "222",
        file_path: "infra/sam/orders/template.yaml"
      });

      expect(impact.impact.edge_count).toBeGreaterThan(0);
      expect(impact.impact.affected_symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "lambda_handler_file",
            path: "src/orders/app.py",
            capability_level: "resource_backed"
          })
        ])
      );
      expect(impact.impact.affected_files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "infra/sam/orders/template.yaml"
          }),
          expect.objectContaining({
            path: "src/orders/app.py"
          })
        ])
      );
      expect(impact.impact.confidence).toEqual(
        expect.objectContaining({
          level: "low",
          scope: "graph",
          evidence_kinds: expect.arrayContaining(["config", "infra_parser"])
        })
      );
      expect(unresolved).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reference_kind: "lambda_handler_file",
            reference_name: "src/missing/app.py",
            candidate_metadata: expect.objectContaining({
              resolution: "unresolved",
              confidence: "low"
            })
          })
        ])
      );
    } finally {
      fixture.store.close();
    }
  });

  it("groups generic Lambda handler results by logical ID, template, and handler file evidence", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-sam-lambda-heavy-repo", "223");
    try {
      const result = await searchSymbols({
        request: {
          query: "app.handler",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: [],
          max_results: 10,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(result.symbols.symbols.map((symbol) => ({
        kind: symbol.kind,
        name: symbol.name,
        signature: symbol.signature,
        path: symbol.path
      }))).toEqual([
        {
          kind: "lambda_handler_binding",
          name: "src/billing/webhook/app.handler",
          signature: "BillingWebhookFunction -> src/billing/webhook/app.handler (template infra/sam/billing/template.yaml, handler file src/billing/webhook/app.py)",
          path: "infra/sam/billing/template.yaml"
        },
        {
          kind: "lambda_handler_file",
          name: "src/billing/webhook/app.py",
          signature: "BillingWebhookFunction -> src/billing/webhook/app.py#handler (template infra/sam/billing/template.yaml)",
          path: "src/billing/webhook/app.py"
        },
        {
          kind: "lambda_handler_binding",
          name: "src/orders/cancel/app.handler",
          signature: "OrdersCancelFunction -> src/orders/cancel/app.handler (template infra/sam/orders/template.yaml, handler file src/orders/cancel/app.py)",
          path: "infra/sam/orders/template.yaml"
        },
        {
          kind: "lambda_handler_file",
          name: "src/orders/cancel/app.py",
          signature: "OrdersCancelFunction -> src/orders/cancel/app.py#handler (template infra/sam/orders/template.yaml)",
          path: "src/orders/cancel/app.py"
        },
        {
          kind: "lambda_handler_binding",
          name: "src/orders/create/app.handler",
          signature: "OrdersCreateFunction -> src/orders/create/app.handler (template infra/sam/orders/template.yaml, handler file src/orders/create/app.py)",
          path: "infra/sam/orders/template.yaml"
        },
        {
          kind: "lambda_handler_file",
          name: "src/orders/create/app.py",
          signature: "OrdersCreateFunction -> src/orders/create/app.py#handler (template infra/sam/orders/template.yaml)",
          path: "src/orders/create/app.py"
        }
      ]);
      expect(result.symbols.symbols.every((symbol) => symbol.capability_level === "resource_backed")).toBe(true);
    } finally {
      fixture.store.close();
    }
  });

  it("falls back when exact matches exist only outside the requested languages", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-sam-lambda-repo", "221");
    try {
      const result = await searchSymbols({
        request: {
          query: "OrdersTable",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: ["python"],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(result.symbols.symbols).toEqual([]);
      expect(result.symbols.next_actions).toEqual([
        expect.objectContaining({
          tool: "context_for_task",
          args: expect.objectContaining({
            symbols: ["OrdersTable"]
          })
        })
      ]);
    } finally {
      fixture.store.close();
    }
  });

  it("resolves exact qualified symbol queries before fuzzy fallback", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-basic-python", "205");
    try {
      const result = await searchSymbols({
        request: {
          query: "Runner.run",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: ["python"],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(result.symbols.symbols).toEqual([
        expect.objectContaining({
          name: "run",
          qualified_name: "Runner.run",
          language: "python"
        })
      ]);
    } finally {
      fixture.store.close();
    }
  });

  it("routes exact symbol misses to context instead of reference follow-up", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-basic-python", "208");
    try {
      const result = await searchSymbols({
        request: {
          query: "ConfigValidationService",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: ["python"],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(result.symbols.symbols).toEqual([]);
      expect(result.symbols.next_actions).toEqual([
        expect.objectContaining({
          tool: "context_for_task",
          args: expect.objectContaining({
            symbols: ["ConfigValidationService"],
            task: expect.stringContaining("Exact symbol 'ConfigValidationService' was not found")
          })
        })
      ]);
      expect(result.symbols.next_actions).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tool: "find_references"
          })
        ])
      );
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

  it("surfaces cross-file incoming parser references within the budget", async () => {
    const repoRoot = path.join(dir, "cross-file-repo");
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "lib.py"), "def helper() -> str:\n    return 'ok'\n");
    fs.writeFileSync(path.join(repoRoot, "main.py"), "def run() -> str:\n    return helper()\n");
    const fixture = await indexedFixture(repoRoot, "206");
    try {
      const helper = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "206",
        qualified_name: "helper"
      });
      const result = await findReferences({
        request: {
          node_id: helper[0]?.id,
          max_depth: 1,
          max_results: 5
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: repoRoot
      });

      expect(result.references.references).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source_file_path: "main.py",
            target_file_path: "lib.py",
            reference_name: "helper",
            status: "resolved",
            evidence_kinds: ["parser"]
          })
        ])
      );
    } finally {
      fixture.store.close();
    }
  });

  it("labels bounded lexical references as low-confidence fallback evidence", async () => {
    const repoRoot = path.join(dir, "lexical-repo");
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "target.py"), "def target() -> str:\n    return 'ok'\n");
    fs.writeFileSync(path.join(repoRoot, "notes.md"), "Call target from the runtime adapter later.\n");
    const fixture = await indexedFixture(repoRoot, "207");
    try {
      const target = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "207",
        qualified_name: "target"
      });
      const result = await findReferences({
        request: {
          node_id: target[0]?.id,
          max_depth: 1,
          max_results: 5
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: repoRoot
      });

      expect(result.references.references).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source_file_path: "notes.md",
            reference_name: "target",
            reference_kind: "lexical",
            confidence: 0.2,
            evidence_kinds: ["text_fallback", "heuristic"],
            provenance: "bounded_lexical_identifier_scan",
            status: "unresolved"
          })
        ])
      );
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
      expect(result.impact.confidence).toMatchObject({
        level: "low",
        scope: "local_only"
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
      expect(result.symbols.next_actions).toEqual([]);
    } finally {
      store.close();
    }
  });

  it("returns Go routing symbols while impact remains low confidence without edges", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-go-service-repo", "209", {
      registerGo: true,
      registerPython: false
    });
    try {
      const symbols = await searchSymbols({
        request: {
          query: "NewResponseCache",
          max_results: 5,
          source_byte_limit: 0,
          exact: true,
          languages: ["go"]
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(symbols.symbols.symbols).toEqual([
        expect.objectContaining({
          name: "NewResponseCache",
          language: "go",
          capability_level: "resource_backed",
          evidence_kinds: ["heuristic"]
        })
      ]);

      const nodeId = symbols.symbols.symbols[0]?.node_id ?? "";
      const impact = await computeImpact({
        request: {
          node_id: nodeId,
          max_depth: 2,
          max_nodes: 10,
          direction: "both"
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(impact.impact.confidence).toEqual(
        expect.objectContaining({
          level: "low",
          scope: "empty"
        })
      );
      expect(impact.impact.edge_count).toBe(0);
    } finally {
      fixture.store.close();
    }
  });

  it("returns C++ routing symbols while impact remains low confidence without edges", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-cmake-cpp-repo", "210", {
      registerCpp: true,
      registerPython: true
    });
    try {
      const symbols = await searchSymbols({
        request: {
          query: "mustExecute",
          max_results: 5,
          source_byte_limit: 0,
          exact: true,
          languages: ["cpp"]
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(symbols.symbols.symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "mustExecute",
            language: "cpp",
            capability_level: "resource_backed",
            evidence_kinds: ["heuristic"]
          })
        ])
      );

      const nodeId = symbols.symbols.symbols[0]?.node_id ?? "";
      const impact = await computeImpact({
        request: {
          node_id: nodeId,
          max_depth: 2,
          max_nodes: 10,
          direction: "both"
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(impact.impact.confidence).toEqual(
        expect.objectContaining({
          level: "low",
          scope: "empty"
        })
      );
      expect(impact.impact.edge_count).toBe(0);
    } finally {
      fixture.store.close();
    }
  });

  async function indexedFixture(
    repoRootInput: string,
    snapshotId: string,
    options: { registerPython?: boolean; registerGo?: boolean; registerCpp?: boolean } = {}
  ) {
    const repoRoot = path.resolve(repoRootInput);
    const store = openGraphStore(path.join(dir, `${snapshotId}.sqlite`));
    const registry = new ExtractorRegistryAdapter();
    if (options.registerPython ?? true) {
      registry.register(new PythonTreeSitterExtractorAdapter());
    }
    if (options.registerGo ?? false) {
      registry.register(new GoDeclarationExtractorAdapter());
    }
    if (options.registerCpp ?? false) {
      registry.register(new CppDeclarationExtractorAdapter({ language: "cpp" }));
    }
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
