/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildRepositoryGraph,
  indexRepositoryGraph,
  warmupRepositoryGraph
} from "../../src/application/use-cases/index-repository-graph.js";
import type { IndexRepositoryGraphResult } from "../../src/application/use-cases/index-repository-graph.js";
import type { ClockPort, ExtractorPort, FileCatalogScanPort, WorkspaceFilePort } from "../../src/ports/index.js";
import type { ExtractionRequest } from "../../src/domain/models/index.js";
import { buildFileCatalogEntry } from "../../src/domain/policies/index.js";
import { ExtractorRegistryAdapter, ResourceExtractorAdapter } from "../../src/infrastructure/extraction/index.js";
import { FileCatalogScannerAdapter, WorkspaceFileAdapter } from "../../src/infrastructure/filesystem/index.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/index.js";
import {
  CppDeclarationExtractorAdapter,
  GoDeclarationExtractorAdapter,
  JavaScriptTypeScriptTreeSitterExtractorAdapter,
  PythonTreeSitterExtractorAdapter
} from "../../src/infrastructure/tree-sitter/index.js";
import { InMemoryRuntimeOperationsAdapter } from "../../src/infrastructure/runtime/index.js";

const clock: ClockPort = {
  now: () => new Date("2026-05-31T12:00:00.000Z"),
  nowIso8601: () => "2026-05-31T12:00:00.000Z",
  nowUnixMs: () => 101
};

describe("repository graph extraction pipeline", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-extract-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("indexes Python symbols and resource-backed files into queryable SQLite evidence", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-basic-python");
    const store = openGraphStore(path.join(dir, "index.sqlite"));
    const registry = new ExtractorRegistryAdapter();
    registry.register(new PythonTreeSitterExtractorAdapter());

    try {
      const result = await indexRepositoryGraph({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(),
        graph: store,
        catalog: store,
        snapshots: store,
        clock,
        schema_version: SCHEMA_VERSION,
        snapshot_id: "101"
      });

      expect(result).toMatchObject({
        snapshot_id: "101",
        scanned_files: 4,
        extracted_files: 4,
        resource_backed_files: 1,
        unsupported_files: 0,
        truncated: false
      });
      expect(result.node_count).toBeGreaterThanOrEqual(8);
      expect(result.edge_count).toBeGreaterThan(0);

      const snapshot = await store.getSnapshot({ repo_root: repoRoot });
      expect(snapshot).toMatchObject({
        id: "101",
        freshness: "fresh",
        schema_version: SCHEMA_VERSION
      });
      await expect(store.readExplicit({ repo_root: repoRoot, snapshot_id: "101" })).resolves.toMatchObject({
        status: "selected",
        publication: { state: "published" }
      });

      const runner = await store.findNodesByName({
        snapshot_id: "101",
        query: "Runner",
        exact: true
      });
      expect(runner).toEqual([
        expect.objectContaining({
          kind: "class",
          name: "Runner",
          qualified_name: "Runner",
          language: "python",
          metadata: expect.objectContaining({
            parser: "tree-sitter-python"
          })
        })
      ]);

      const helper = await store.findNodesByQualifiedName({
        snapshot_id: "101",
        qualified_name: "helper"
      });
      expect(helper).toEqual([
        expect.objectContaining({
          kind: "function",
          signature: "def helper() -> str:"
        })
      ]);
      const run = await store.findNodesByQualifiedName({
        snapshot_id: "101",
        qualified_name: "Runner.run"
      });
      expect(run).toHaveLength(1);

      const packageResource = await store.findNodesByQualifiedName({
        snapshot_id: "101",
        qualified_name: "pyproject.toml"
      });
      expect(packageResource).toEqual([
        expect.objectContaining({
          kind: "resource",
          language: "toml",
          metadata: expect.objectContaining({
            domain: "package_manager",
            capability_level: "resource_backed"
          })
        })
      ]);

      const references = await store.getReferences({
        snapshot_id: "101",
        node_id: run[0]?.id ?? ""
      });
      expect(references).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target_node_id: helper[0]?.id,
            provenance: "tree-sitter-reference-resolution"
          })
        ])
      );
    } finally {
      store.close();
    }
  });

  it("records oversized files as skipped without reading them during extraction", async () => {
    const repoRoot = fs.mkdtempSync(path.join(dir, "large-file-repo-"));
    fs.writeFileSync(path.join(repoRoot, "README.md"), "x".repeat(2_000_001));
    const store = openGraphStore(path.join(dir, "large-file.sqlite"));
    const registry = new ExtractorRegistryAdapter();
    const workspace = new WorkspaceFileAdapter({ repoRoot });
    const guardedWorkspace: WorkspaceFilePort = {
      readText(input) {
        if (input.path === "README.md") {
          throw new Error("oversized file should not be read");
        }
        return workspace.readText(input);
      },
      readBinary: (input) => workspace.readBinary(input),
      writeText: (input) => workspace.writeText(input),
      writeBinary: (input) => workspace.writeBinary(input),
      stat: (input) => workspace.stat(input),
      deletePath: (input) => workspace.deletePath(input),
      ensureDirectory: (input) => workspace.ensureDirectory(input)
    };

    try {
      const result = await indexRepositoryGraph({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter(),
        workspace: guardedWorkspace,
        extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(),
        graph: store,
        catalog: store,
        snapshots: store,
        clock,
        schema_version: SCHEMA_VERSION,
        snapshot_id: "102"
      });

      expect(result).toMatchObject({
        scanned_files: 1,
        extracted_files: 0,
        resource_backed_files: 0,
        unsupported_files: 1
      });
      await expect(store.getFile({ snapshot_id: "102", path: "README.md" })).resolves.toEqual(
        expect.objectContaining({
          indexed: false,
          skipped_reason: "file_too_large_for_text_extraction"
        })
      );
    } finally {
      store.close();
    }
  });

  it("indexes docs beyond the bounded symbol extraction window", async () => {
    const repoRoot = path.join(dir, "docs-beyond-extraction");
    fs.mkdirSync(path.join(repoRoot, "docs"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "a.py"), "def first() -> str:\n    return 'first'\n");
    fs.writeFileSync(path.join(repoRoot, "docs", "late.md"), "# Late Doc\n\nneedle-for-docs-search\n");
    const store = openGraphStore(path.join(dir, "docs-beyond-extraction.sqlite"));
    const registry = new ExtractorRegistryAdapter();
    registry.register(new PythonTreeSitterExtractorAdapter());

    try {
      await indexRepositoryGraph({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(),
        graph: store,
        catalog: store,
        docs_index: store,
        snapshots: store,
        clock,
        schema_version: SCHEMA_VERSION,
        snapshot_id: "102",
        max_files: 10,
        max_extraction_files: 1
      });

      const docsState = await store.getState({ repo_root: repoRoot });
      const docsSearch = await store.search({
        repo_root: repoRoot,
        query: "needle-for-docs-search",
        max_results: 5,
        include_snippets: false
      });

      expect(docsState).toMatchObject({
        status: "usable",
        document_count: 1
      });
      expect(docsSearch.status).toBe("done");
      if (docsSearch.status === "done") {
        expect(docsSearch.hits.map((hit) => hit.path)).toEqual(["docs/late.md"]);
      }
    } finally {
      store.close();
    }
  });

  it("indexes docs when startup graph scan truncates before the docs root", async () => {
    const repoRoot = path.join(dir, "docs-after-startup-cap");
    fs.mkdirSync(path.join(repoRoot, "src"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "docs", "data-flow", "processed"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "AGENTS.md"), "# Agent Instructions\n\nfront-door-agent-needle\n");
    fs.writeFileSync(path.join(repoRoot, "README.md"), "# Project Readme\n\nfront-door-readme-needle\n");
    for (let index = 0; index < 5; index += 1) {
      fs.writeFileSync(
        path.join(repoRoot, "src", `file_${index}.py`),
        `def file_${index}() -> str:\n    return "file_${index}"\n`
      );
    }
    fs.writeFileSync(
      path.join(repoRoot, "docs", "data-flow", "processed", "analytics-serving-boundary.md"),
      [
        "# Analytics Serving Boundary",
        "",
        "unique-docs-first-warmup-needle",
        ""
      ].join("\n")
    );
    const store = openGraphStore(path.join(dir, "docs-after-startup-cap.sqlite"));
    const registry = new ExtractorRegistryAdapter();
    registry.register(new PythonTreeSitterExtractorAdapter());

    try {
      const result = await indexRepositoryGraph({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(),
        graph: store,
        catalog: store,
        docs_index: store,
        snapshots: store,
        clock,
        schema_version: SCHEMA_VERSION,
        snapshot_id: "103",
        max_files: 3
      });

      const snapshot = await store.getSnapshot({ repo_root: repoRoot });
      const files = await store.listFiles({ snapshot_id: "103", max_rows: 20 });
      const docsState = await store.getState({ repo_root: repoRoot });
      const docsSearch = await store.search({
        repo_root: repoRoot,
        query: "unique-docs-first-warmup-needle",
        max_results: 5,
        include_snippets: false
      });
      const agentDocsSearch = await store.search({
        repo_root: repoRoot,
        query: "front-door-agent-needle",
        max_results: 5,
        include_snippets: false
      });
      const readmeDocsSearch = await store.search({
        repo_root: repoRoot,
        query: "front-door-readme-needle",
        max_results: 5,
        include_snippets: false
      });

      expect(result).toMatchObject({
        scanned_files: 3,
        truncated: true,
        coverage: [
          expect.objectContaining({
            evidence_class: "docs",
            state: "complete",
            indexed_files: 3,
            scan_truncated: false
          }),
          expect.objectContaining({
            evidence_class: "graph",
            state: "partial",
            indexed_files: 3,
            scan_truncated: true
          })
        ]
      });
      expect(snapshot).toMatchObject({
        id: "103",
        freshness: "fresh"
      });
      await expect(store.readExplicit({ repo_root: repoRoot, snapshot_id: "103" })).resolves.toMatchObject({
        status: "selected",
        publication: { state: "published" }
      });
      expect(files.map((file) => file.path)).not.toContain("docs/data-flow/processed/analytics-serving-boundary.md");
      expect(docsState).toMatchObject({
        status: "usable",
        freshness: "fresh",
        coverage_state: "complete",
        document_count: 3
      });
      expect(docsState.reason).toBeUndefined();
      expect(docsState.coverage).toEqual([
        expect.objectContaining({
          evidence_class: "docs",
          state: "complete"
        }),
        expect.objectContaining({
          evidence_class: "graph",
          state: "partial"
        })
      ]);
      expect(docsSearch).toMatchObject({
        status: "done",
        freshness: "fresh",
        docs_index_state: "complete",
        indexed_docs_count: 3,
        coverage: [
          expect.objectContaining({
            evidence_class: "docs",
            state: "complete",
            scan_truncated: false
          }),
          expect.objectContaining({
            evidence_class: "graph",
            state: "partial",
            scan_truncated: true
          })
        ],
        result_count_basis: "page",
        hits: [
          expect.objectContaining({
            path: "docs/data-flow/processed/analytics-serving-boundary.md"
          })
        ],
        result_count: 1
      });
      expect(docsSearch.coverage_note).toBeUndefined();
      expect(agentDocsSearch).toMatchObject({
        status: "done",
        hits: [expect.objectContaining({ path: "AGENTS.md" })]
      });
      expect(readmeDocsSearch).toMatchObject({
        status: "done",
        hits: [expect.objectContaining({ path: "README.md" })]
      });
    } finally {
      store.close();
    }
  });

  it("yields to the event loop while indexing large repositories", async () => {
    const repoRoot = path.join(dir, "yield-repo");
    const store = openGraphStore(path.join(dir, "yield.sqlite"));
    const registry = new ExtractorRegistryAdapter();
    let yielded = false;
    registry.register(new YieldProbeExtractor(() => yielded));
    setImmediate(() => {
      yielded = true;
    });

    try {
      await indexRepositoryGraph({
        repo_root: repoRoot,
        scanner: fakeScanner(60),
        workspace: fakeWorkspace(),
        extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(),
        graph: store,
        catalog: store,
        snapshots: store,
        clock,
        schema_version: SCHEMA_VERSION,
        snapshot_id: "103"
      });

      expect(yielded).toBe(true);
    } finally {
      store.close();
    }
  }, 15_000);

  it("keeps non-Python files without a registered extractor out of semantic extraction", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-mixed-language-platform");
    const store = openGraphStore(path.join(dir, "mixed.sqlite"));
    const registry = new ExtractorRegistryAdapter();
    registry.register(new PythonTreeSitterExtractorAdapter());

    try {
      const result = await indexRepositoryGraph({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(),
        graph: store,
        catalog: store,
        snapshots: store,
        clock,
        schema_version: SCHEMA_VERSION,
        snapshot_id: "102"
      });

      expect(result).toMatchObject({
        scanned_files: 5,
        extracted_files: 4,
        resource_backed_files: 3,
        unsupported_files: 1
      });

      const files = await store.listFiles({ snapshot_id: "102", max_rows: 20 });
      expect(files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "src/app.ts",
            indexed: false,
            file_identity: expect.objectContaining({
              language: "typescript"
            })
          }),
          expect.objectContaining({
            path: "src/service.py",
            indexed: true,
            file_identity: expect.objectContaining({
              language: "python"
            })
          })
        ])
      );

      const typeScriptNodes = await store.searchNodes({
        snapshot_id: "102",
        query: "app",
        max_rows: 20
      });
      expect(typeScriptNodes.filter((node) => node.language === "typescript")).toEqual([]);

      const pythonNodes = await store.findNodesByName({
        snapshot_id: "102",
        query: "service",
        exact: false
      });
      expect(pythonNodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            language: "python",
            metadata: expect.objectContaining({
              parser: "tree-sitter-python"
            })
          })
        ])
      );
    } finally {
      store.close();
    }
  });

  it("indexes JavaScript and TypeScript declarations, imports, and exports as parser-backed evidence", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-js-ts-monorepo");
    const store = openGraphStore(path.join(dir, "js-ts.sqlite"));
    const registry = new ExtractorRegistryAdapter();
    registry.register(new JavaScriptTypeScriptTreeSitterExtractorAdapter({ language: "javascript" }));
    registry.register(new JavaScriptTypeScriptTreeSitterExtractorAdapter({ language: "typescript" }));

    try {
      const result = await indexRepositoryGraph({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(),
        graph: store,
        catalog: store,
        snapshots: store,
        clock,
        schema_version: SCHEMA_VERSION,
        snapshot_id: "112"
      });

      expect(result).toMatchObject({
        unsupported_files: 0
      });
      expect(result.node_count).toBeGreaterThan(20);
      expect(result.edge_count).toBeGreaterThan(0);
      expect(result.unresolved_reference_count).toBeGreaterThan(0);

      const login = await store.findNodesByName({
        snapshot_id: "112",
        query: "Login",
        exact: true
      });
      expect(login).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "function",
            language: "typescript",
            qualified_name: "apps.web.src.Login.Login",
            metadata: expect.objectContaining({
              capability_level: "partial_semantic",
              evidence_kinds: ["parser"],
              parser: "tree-sitter-js-ts"
            })
          })
        ])
      );

      const controller = await store.findNodesByName({
        snapshot_id: "112",
        query: "AuthController",
        exact: true
      });
      expect(controller).toEqual([
        expect.objectContaining({
          kind: "class",
          qualified_name: "services.api.src.auth-controller.AuthController"
        })
      ]);

      const route = await store.findNodesByName({
        snapshot_id: "112",
        query: "authRoute",
        exact: true
      });
      expect(route).toEqual([
        expect.objectContaining({
          kind: "constant",
          file_path: "services/api/src/routes/auth-route.ts"
        })
      ]);

      const loginForm = await store.findNodesByName({
        snapshot_id: "112",
        query: "LoginForm",
        exact: true
      });
      expect(loginForm).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "function",
            file_path: "apps/web/src/components/LoginForm.tsx"
          })
        ])
      );
      const loginModule = login.find((node) => node.kind === "module");
      expect(loginModule).toBeDefined();
      const loginReferences = await store.getReferences({
        snapshot_id: "112",
        node_id: loginModule?.id ?? ""
      });
      expect(loginReferences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target_file_path: "services/api/src/auth-controller.ts",
            provenance: "tree-sitter-js-ts-import"
          })
        ])
      );

      const unresolved = await store.getUnresolvedReferences({
        snapshot_id: "112",
        file_path: "apps/web/src/Login.tsx",
        max_rows: 20
      });
      expect(unresolved).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reference_name: "LoginForm",
            reference_kind: "js_ts_import",
            candidate_metadata: expect.objectContaining({
              resolution: "ambiguous",
              module_specifier: "./components/LoginForm"
            })
          })
        ])
      );
    } finally {
      store.close();
    }
  });

  it("indexes Go declarations and references as parser-backed evidence", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-go-service-repo");
    const store = openGraphStore(path.join(dir, "go.sqlite"));
    const registry = new ExtractorRegistryAdapter();
    registry.register(new GoDeclarationExtractorAdapter());

    try {
      const result = await indexRepositoryGraph({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(),
        graph: store,
        catalog: store,
        snapshots: store,
        clock,
        schema_version: SCHEMA_VERSION,
        snapshot_id: "109"
      });

      expect(result).toMatchObject({
        scanned_files: 9,
        extracted_files: 9,
        resource_backed_files: 3,
        unsupported_files: 0
      });
      expect(result.edge_count).toBeGreaterThan(0);
      expect(result.unresolved_reference_count).toBeGreaterThan(0);

      const responseCache = await store.findNodesByName({
        snapshot_id: "109",
        query: "ResponseCache",
        exact: true
      });
      expect(responseCache).toEqual([
        expect.objectContaining({
          kind: "type",
          name: "ResponseCache",
          qualified_name: "graph.ResponseCache",
          language: "go",
          metadata: expect.objectContaining({
            capability_level: "partial_semantic",
            evidence_kinds: ["parser"],
            parser: "tree-sitter-go"
          })
        })
      ]);

      const loadConfig = await store.findNodesByName({
        snapshot_id: "109",
        query: "LoadConfig",
        exact: true
      });
      expect(loadConfig).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "method",
            name: "LoadConfig",
            qualified_name: "graph.ResponseCache.LoadConfig"
          })
        ])
      );

      const main = await store.findNodesByName({
        snapshot_id: "109",
        query: "main",
        exact: true
      });
      expect(main).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "function",
            name: "main",
            qualified_name: "main.main"
          })
        ])
      );
      const mainFunction = main.find((node) => node.kind === "function");
      const mainReferences = await store.getReferences({
        snapshot_id: "109",
        node_id: mainFunction?.id ?? ""
      });
      expect(mainReferences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source_node_id: mainFunction?.id,
            target_file_path: "internal/graph/response_cache.go",
            provenance: "tree-sitter-go",
            target_node_id: "109:internal/graph/response_cache.go:function:graph.LoadConfig"
          })
        ])
      );
    } finally {
      store.close();
    }
  });

  it("indexes C++ declarations, Python stubs, and CMake targets as routing evidence", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-cmake-cpp-repo");
    const store = openGraphStore(path.join(dir, "cpp.sqlite"));
    const registry = new ExtractorRegistryAdapter();
    registry.register(new CppDeclarationExtractorAdapter({ language: "cpp" }));
    registry.register(new PythonTreeSitterExtractorAdapter());

    try {
      const result = await indexRepositoryGraph({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(),
        graph: store,
        catalog: store,
        snapshots: store,
        clock,
        schema_version: SCHEMA_VERSION,
        snapshot_id: "110"
      });

      expect(result).toMatchObject({
        scanned_files: 8,
        extracted_files: 8,
        unsupported_files: 0
      });
      expect(result.edge_count).toBeGreaterThan(0);
      expect(result.unresolved_reference_count).toBeGreaterThan(0);

      const documentObject = await store.findNodesByName({
        snapshot_id: "110",
        query: "DocumentObject",
        exact: true
      });
      expect(documentObject).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "class",
            name: "DocumentObject",
            language: "cpp",
            metadata: expect.objectContaining({
              capability_level: "resource_backed",
              evidence_kinds: ["heuristic"],
              semantic_scope: "declarations_only"
            })
          }),
          expect.objectContaining({
            kind: "class",
            name: "DocumentObject",
            language: "python",
            metadata: expect.objectContaining({
              parser: "tree-sitter-python"
            })
          })
        ])
      );

      const mustExecute = await store.findNodesByName({
        snapshot_id: "110",
        query: "mustExecute",
        exact: true
      });
      expect(mustExecute).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "method",
            qualified_name: "DocumentObject.mustExecute",
            language: "cpp"
          })
        ])
      );

      const include = await store.findNodesByName({
        snapshot_id: "110",
        query: "DocumentObject.h",
        exact: true
      });
      expect(include).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "include",
            language: "cpp"
          })
        ])
      );

      const runExecution = await store.findNodesByName({
        snapshot_id: "110",
        query: "runExecution",
        exact: true
      });
      expect(runExecution).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "function",
            qualified_name: "src.App.ExecutionController.runExecution",
            language: "cpp"
          })
        ])
      );
      const runExecutionEdges = await store.getOutgoingEdges({
        snapshot_id: "110",
        node_id: runExecution[0]?.id ?? "",
        max_rows: 5
      });
      expect(runExecutionEdges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "cpp_local_call",
            provenance: "cpp-local-call-heuristic",
            confidence: 0.4,
            metadata: expect.objectContaining({
              reference_name: "shouldRecompute",
              semantic_scope: "same_file_call_name_routing"
            })
          })
        ])
      );

      const unresolved = await store.getUnresolvedReferences({
        snapshot_id: "110",
        file_path: "src/App/DocumentObject.cpp",
        max_rows: 5
      });
      expect(unresolved).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reference_name: "DocumentObject",
            reference_kind: "cpp_include",
            candidate_metadata: expect.objectContaining({
              provenance: "cpp-include-heuristic",
              confidence: 0.35,
              resolution: "ambiguous"
            })
          })
        ])
      );

      const appTarget = await store.findNodesByName({
        snapshot_id: "110",
        query: "App",
        exact: true
      });
      expect(appTarget).toEqual([
        expect.objectContaining({
          kind: "cmake_library",
          qualified_name: "src/App/CMakeLists.txt:App",
          metadata: expect.objectContaining({
            provenance: "cmake_target_scan",
            sources: ["DocumentObject.cpp", "ExecutionController.cpp"]
          })
        })
      ]);
    } finally {
      store.close();
    }
  });

  it("indexes SAM and CloudFormation intrinsic references as resource-backed edges", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-sam-intrinsic-repo");
    const store = openGraphStore(path.join(dir, "sam-intrinsic.sqlite"));
    const registry = new ExtractorRegistryAdapter();
    registry.register(new PythonTreeSitterExtractorAdapter());

    try {
      const result = await indexRepositoryGraph({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(),
        graph: store,
        catalog: store,
        snapshots: store,
        clock,
        schema_version: SCHEMA_VERSION,
        snapshot_id: "112"
      });

      expect(result).toMatchObject({
        snapshot_id: "112",
        scanned_files: 7,
        extracted_files: 7,
        resource_backed_files: 3,
        unsupported_files: 0,
        truncated: false
      });
      expect(result.edge_count).toBeGreaterThanOrEqual(13);
      expect(result.unresolved_reference_count).toBeGreaterThanOrEqual(4);

      const ordersFunction = await store.findNodesByName({
        snapshot_id: "112",
        query: "OrdersFunction",
        exact: true
      });
      expect(ordersFunction).toEqual([
        expect.objectContaining({
          kind: "lambda_function",
          file_path: "infra/orders/template.yaml",
          metadata: expect.objectContaining({
            provenance: "cloudformation_resource_scan",
            handler: "src/orders/app.handler"
          })
        })
      ]);
      const ordersFunctionEdges = await store.getOutgoingEdges({
        snapshot_id: "112",
        node_id: ordersFunction[0]?.id ?? "",
        max_rows: 20
      });
      expect(ordersFunctionEdges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "cloudformation_depends_on",
            confidence: 0.85,
            provenance: "cloudformation_intrinsic_scan",
            metadata: expect.objectContaining({
              intrinsic: "DependsOn",
              reference_name: "OrdersTable",
              expression_path: "Resources.OrdersFunction.DependsOn"
            })
          }),
          expect.objectContaining({
            kind: "cloudformation_ref",
            confidence: 0.75,
            metadata: expect.objectContaining({
              intrinsic: "Ref",
              reference_name: "OrdersQueue"
            })
          }),
          expect.objectContaining({
            kind: "cloudformation_getatt",
            confidence: 0.75,
            metadata: expect.objectContaining({
              intrinsic: "Fn::GetAtt",
              reference_name: "OrdersTable"
            })
          })
        ])
      );

      const ordersQueue = await store.findNodesByName({
        snapshot_id: "112",
        query: "OrdersQueue",
        exact: true
      });
      expect(ordersQueue).toEqual([
        expect.objectContaining({
          metadata: expect.objectContaining({
            unsupported_intrinsics: ["Fn::If"]
          })
        })
      ]);

      const ordersSubnetProbe = await store.findNodesByName({
        snapshot_id: "112",
        query: "OrdersSubnetProbe",
        exact: true
      });
      expect(ordersSubnetProbe).toEqual([
        expect.objectContaining({
          metadata: expect.objectContaining({
            unsupported_intrinsics: ["GetAZs"]
          })
        })
      ]);

      const topicPolicy = await store.findNodesByName({
        snapshot_id: "112",
        query: "SharedTopicPolicy",
        exact: true
      });
      expect(topicPolicy).toEqual([
        expect.objectContaining({
          kind: "cloudformation_resource",
          file_path: "infra/shared/template.json"
        })
      ]);
      const topicPolicyEdges = await store.getOutgoingEdges({
        snapshot_id: "112",
        node_id: topicPolicy[0]?.id ?? "",
        max_rows: 10
      });
      expect(topicPolicyEdges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "cloudformation_depends_on",
            metadata: expect.objectContaining({
              reference_name: "SharedOrdersTopic"
            })
          }),
          expect.objectContaining({
            kind: "cloudformation_getatt",
            metadata: expect.objectContaining({
              expression_path: "Resources.SharedTopicPolicy.Properties.PolicyDocument.Statement.0.Resource.Fn::GetAtt"
            })
          })
        ])
      );

      const unresolved = await store.getUnresolvedReferences({
        snapshot_id: "112",
        file_path: "infra/orders/template.yaml",
        max_rows: 20
      });
      expect(unresolved).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reference_name: "SharedOrdersTopicArn",
            reference_kind: "cloudformation_import_value",
            candidate_metadata: expect.objectContaining({
              semantic_scope: "external_stack_reference",
              intrinsic: "Fn::ImportValue",
              resolution: "unresolved"
            })
          }),
          expect.objectContaining({
            reference_name: "StageName",
            candidate_metadata: expect.objectContaining({
              target_kind: "external_or_parameter"
            })
          })
        ])
      );
      expect(JSON.stringify([...ordersFunctionEdges, ...topicPolicyEdges, ...unresolved])).not.toContain("orders/token");
      expect(JSON.stringify([...ordersFunctionEdges, ...topicPolicyEdges, ...unresolved])).not.toContain("secretsmanager");
    } finally {
      store.close();
    }
  });

  it("indexes .NET solution and project metadata as resource-backed routing evidence", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-dotnet-web-repo");
    const store = openGraphStore(path.join(dir, "dotnet.sqlite"));
    const registry = new ExtractorRegistryAdapter();

    try {
      const result = await indexRepositoryGraph({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(),
        graph: store,
        catalog: store,
        snapshots: store,
        clock,
        schema_version: SCHEMA_VERSION,
        snapshot_id: "111"
      });

      expect(result).toMatchObject({
        resource_backed_files: expect.any(Number),
        unsupported_files: 0,
        truncated: false
      });

      const solutionProjects = await store.findNodesByName({
        snapshot_id: "111",
        query: "WebApi",
        exact: true
      });
      expect(solutionProjects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "dotnet_solution_project",
            qualified_name: "ModenaFixture.sln:WebApi",
            metadata: expect.objectContaining({
              provenance: "dotnet_solution_scan",
              project_path: "src/WebApi/WebApi.csproj"
            })
          })
        ])
      );

      const webApiProject = await store.findNodesByQualifiedName({
        snapshot_id: "111",
        qualified_name: "src/WebApi/WebApi.csproj"
      });
      expect(webApiProject).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "dotnet_project",
            metadata: expect.objectContaining({
              sdk: "Microsoft.NET.Sdk.Web",
              target_frameworks: ["net8.0"],
              output_type: "Exe",
              package_references: ["Microsoft.AspNetCore.OpenApi"],
              is_test_project: false,
              semantic_scope: "project_metadata_only"
            })
          })
        ])
      );

      const testProject = await store.findNodesByQualifiedName({
        snapshot_id: "111",
        qualified_name: "tests/WebApi.Tests/WebApi.Tests.csproj"
      });
      expect(testProject).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "dotnet_project",
            metadata: expect.objectContaining({
              is_test_project: true,
              package_references: ["xunit"],
              project_references: ["../../src/WebApi/WebApi.csproj"]
            })
          })
        ])
      );
    } finally {
      store.close();
    }
  });

  it("keeps duplicate-name references unresolved with ambiguity metadata", async () => {
    const repoRoot = path.join(dir, "ambiguous-repo");
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "a.py"), "def helper() -> str:\n    return 'a'\n");
    fs.writeFileSync(path.join(repoRoot, "b.py"), "def helper() -> str:\n    return 'b'\n");
    fs.writeFileSync(path.join(repoRoot, "main.py"), "def run() -> str:\n    return helper()\n");
    const store = openGraphStore(path.join(dir, "ambiguous.sqlite"));
    const registry = new ExtractorRegistryAdapter();
    registry.register(new PythonTreeSitterExtractorAdapter());

    try {
      const result = await indexRepositoryGraph({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(),
        graph: store,
        catalog: store,
        snapshots: store,
        clock,
        schema_version: SCHEMA_VERSION,
        snapshot_id: "103"
      });

      expect(result.unresolved_reference_count).toBe(1);
      const unresolved = await store.getUnresolvedReferences({
        snapshot_id: "103",
        file_path: "main.py"
      });
      expect(unresolved).toEqual([
        expect.objectContaining({
          reference_name: "helper",
          reference_kind: "call",
          candidate_metadata: expect.objectContaining({
            candidate_count: 2,
            resolution: "ambiguous"
          })
        })
      ]);
    } finally {
      store.close();
    }
  });

  it("marks parser/indexing outputs stale when snapshot, config, or file hash no longer matches", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-basic-python");
    const store = openGraphStore(path.join(dir, "index-guard.sqlite"));
    const runtimeGuard = new InMemoryRuntimeOperationsAdapter({ clock });
    const scanner = new FileCatalogScannerAdapter();
    const workspace = new WorkspaceFileAdapter({ repoRoot });
    const registry = new ExtractorRegistryAdapter();
    registry.register(new PythonTreeSitterExtractorAdapter());

    try {
      const result = await indexRepositoryGraph({
        repo_root: repoRoot,
        scanner,
        workspace,
        extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(),
        graph: store,
        catalog: store,
        snapshots: store,
        clock,
        schema_version: SCHEMA_VERSION,
        snapshot_id: "401",
        config_identity: "default"
      });

      const files = await store.listFiles({ snapshot_id: result.snapshot_id });
      const primary = files.find((file) => file.path.endsWith("sample_pkg/service.py"));
      expect(primary).not.toBeUndefined();
      const servicePath = primary?.path;

      await runtimeGuard.set({
        namespace: "parser-index",
        key: `fixture:${result.snapshot_id}`,
        value: {
          snapshot_id: result.snapshot_id,
          nodes: result.node_count
        },
        depends_on_snapshot_id: result.snapshot_id,
        depends_on_config_identity: "default",
        depends_on_file_hashes: files.map((file) => ({
          path: file.path,
          content_hash: file.file_identity.content_hash
        }))
      });

      await expect(
        runtimeGuard.get({
          namespace: "parser-index",
          key: `fixture:${result.snapshot_id}`,
          depends_on_snapshot_id: result.snapshot_id,
          depends_on_config_identity: "default",
          depends_on_file_hashes: files.map((file) => ({
            path: file.path,
            content_hash: file.file_identity.content_hash
          }))
        })
      ).resolves.toEqual({
        snapshot_id: result.snapshot_id,
        nodes: result.node_count
      });

      await expect(
        runtimeGuard.get({
          namespace: "parser-index",
          key: `fixture:${result.snapshot_id}`,
          depends_on_snapshot_id: "402",
          depends_on_config_identity: "default",
          depends_on_file_hashes: files.map((file) => ({
            path: file.path,
            content_hash: file.file_identity.content_hash
          }))
        })
      ).resolves.toBeNull();

      await expect(
        runtimeGuard.get({
          namespace: "parser-index",
          key: `fixture:${result.snapshot_id}`,
          depends_on_snapshot_id: result.snapshot_id,
          depends_on_config_identity: "legacy",
          depends_on_file_hashes: files.map((file) => ({
            path: file.path,
            content_hash: file.file_identity.content_hash
          }))
        })
      ).resolves.toBeNull();

      const staleHashes = files.map((file) =>
        file.path === servicePath
          ? { path: file.path, content_hash: "stat:0000:0000" }
          : { path: file.path, content_hash: file.file_identity.content_hash }
      );
      await expect(
        runtimeGuard.get({
          namespace: "parser-index",
          key: `fixture:${result.snapshot_id}`,
          depends_on_snapshot_id: result.snapshot_id,
          depends_on_config_identity: "default",
          depends_on_file_hashes: staleHashes
        })
      ).resolves.toBeNull();
    } finally {
      store.close();
    }
  });

  it("orchestrates warm-up through scan, extraction, cache publication, and fresh snapshot publication", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-basic-python");
    const store = openGraphStore(path.join(dir, "warmup.sqlite"));
    const runtime = new InMemoryRuntimeOperationsAdapter({ clock });
    const registry = new ExtractorRegistryAdapter();
    registry.register(new PythonTreeSitterExtractorAdapter());

    try {
      const result = await warmupRepositoryGraph({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(),
        graph: store,
        catalog: store,
        snapshots: store,
        warmups: runtime,
        cache: runtime,
        clock,
        schema_version: SCHEMA_VERSION,
        owner_id: "owner-1",
        snapshot_id: "501",
        config_identity: "default"
      });

      expect(result).toMatchObject({
        snapshot_id: "501",
        execution_id: "warmup-1",
        warmup_state: "complete",
        scanned_files: 4,
        extracted_files: 4
      });
      await expect(runtime.getState({ repo_root: repoRoot })).resolves.toMatchObject({
        execution_id: "warmup-1",
        state: "complete",
        owner_id: "owner-1"
      });
      await expect(store.getSnapshot({ repo_root: repoRoot })).resolves.toMatchObject({
        id: "501",
        freshness: "fresh"
      });
      await expect(
        runtime.get({
          namespace: "warmup",
          key: `graph:${repoRoot}`,
          depends_on_snapshot_id: "501",
          depends_on_config_identity: "default"
        })
      ).resolves.toMatchObject({
        snapshot_id: "501",
        node_count: result.node_count
      });
    } finally {
      store.close();
    }
  });

  it("keeps publication invisible at every production write barrier", async () => {
    const repoRoot = createPublicationBarrierRepository(path.join(dir, "publication-barriers"));
    const databasePath = path.join(dir, "publication-barriers.sqlite");
    const writer = openGraphStore(databasePath);
    const observer = openGraphStore(databasePath);
    const prior = publicationTestSnapshot(repoRoot, "600");
    const barriers: string[] = [];
    const seen = new Set<string>();

    const assertInvisible = async (barrier: string): Promise<void> => {
      if (seen.has(barrier)) return;
      seen.add(barrier);
      barriers.push(barrier);
      await expect(observer.getSnapshot({ repo_root: repoRoot })).resolves.toMatchObject({ id: prior.id });
      await expect(observer.readExplicit({ repo_root: repoRoot, snapshot_id: "601" })).resolves.toMatchObject({
        status: "blocked",
        publication_state: "building"
      });
      if (barrier === "catalog") {
        expect(snapshotRowCount(observer, "files", 601)).toBeGreaterThan(0);
      }
      if (barrier === "docs" || barrier === "before-publication") {
        expect(snapshotRowCount(observer, "docs_documents", 601)).toBe(1);
        expect(snapshotChildRowCount(observer, "docs_headings", "docs_documents", 601)).toBeGreaterThan(0);
        expect(snapshotFtsRowCount(observer, "docs_fts", 601)).toBe(1);
        expect(snapshotRowCount(observer, "snapshot_index_coverage", 601)).toBe(2);
      }
      if (barrier === "graph" || barrier === "before-publication") {
        expect(snapshotRowCount(observer, "files", 601)).toBeGreaterThan(0);
        expect(snapshotChildRowCount(observer, "nodes", "files", 601)).toBeGreaterThan(0);
        expect(snapshotChildRowCount(observer, "unresolved_refs", "files", 601)).toBeGreaterThan(0);
      }
    };
    const instrumented = decorateGraphStore(writer, {
      before: async (method, args) => {
        if (method === "transitionBuild" && (args[0] as { to?: string }).to === "published") {
          await assertInvisible("before-publication");
        }
      },
      after: async (method, args) => {
        if (method === "createBuildSnapshot") await assertInvisible("build");
        if (method === "upsertEntry") await assertInvisible("catalog");
        if (method === "replaceSnapshotDocs") await assertInvisible("docs");
        if (
          method === "replaceSnapshotExtraction" &&
          (args[0] as { batch?: { source_path?: string } }).batch?.source_path === "app.py"
        ) {
          await assertInvisible("graph");
        }
      }
    });

    try {
      await writer.upsertSnapshot({ snapshot: prior });
      await indexRepositoryGraph({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        extractors: pythonRegistry(),
        resource_extractor: new ResourceExtractorAdapter(),
        graph: instrumented,
        catalog: instrumented,
        docs_index: instrumented,
        snapshots: instrumented,
        clock,
        schema_version: SCHEMA_VERSION,
        snapshot_id: "601"
      });

      expect(barriers).toEqual(["build", "catalog", "docs", "graph", "before-publication"]);
      await expect(observer.getSnapshot({ repo_root: repoRoot })).resolves.toMatchObject({ id: "601" });
    } finally {
      observer.close();
      writer.close();
    }
  });

  it("completes a build without taking publication authority from the refresh controller", async () => {
    const repoRoot = createPublicationBarrierRepository(path.join(dir, "build-only-repository"));
    const databasePath = path.join(dir, "build-only.sqlite");
    const writer = openGraphStore(databasePath);
    const reader = openGraphStore(databasePath);
    const prior = publicationTestSnapshot(repoRoot, "605");

    try {
      await writer.upsertSnapshot({ snapshot: prior });
      const result = await buildRepositoryGraph({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        extractors: pythonRegistry(),
        resource_extractor: new ResourceExtractorAdapter(),
        graph: writer,
        catalog: writer,
        docs_index: writer,
        snapshots: writer,
        clock,
        schema_version: SCHEMA_VERSION,
        snapshot_id: "606",
        controller_generation: 4,
        invalidation_generation: 9
      });

      expect(result).toMatchObject({ snapshot_id: "606", repo_root: repoRoot });
      await expect(reader.getSnapshot({ repo_root: repoRoot })).resolves.toMatchObject({ id: prior.id });
      await expect(reader.readExplicit({ repo_root: repoRoot, snapshot_id: "606" })).resolves.toMatchObject({
        status: "blocked",
        publication_state: "building"
      });
      expect(reader.db.prepare(`
        SELECT freshness, publication_state, controller_generation, invalidation_generation
        FROM snapshots WHERE id = 606
      `).get()).toEqual({
        freshness: "fresh",
        publication_state: "building",
        controller_generation: 4,
        invalidation_generation: 9
      });
      expect(snapshotRowCount(reader, "files", 606)).toBeGreaterThan(0);
      expect(snapshotChildRowCount(reader, "nodes", "files", 606)).toBeGreaterThan(0);
      expect(snapshotRowCount(reader, "docs_documents", 606)).toBeGreaterThan(0);
      expect(snapshotRowCount(reader, "snapshot_index_coverage", 606)).toBe(2);
    } finally {
      reader.close();
      writer.close();
    }

    const reopened = openGraphStore(databasePath);
    try {
      await expect(reopened.getSnapshot({ repo_root: repoRoot })).resolves.toMatchObject({ id: prior.id });
      await expect(reopened.readExplicit({ repo_root: repoRoot, snapshot_id: "606" })).resolves.toMatchObject({
        status: "blocked",
        publication_state: "building"
      });
      await reopened.transitionBuild({
        repo_root: repoRoot,
        snapshot_id: "606",
        from: "building",
        to: "published",
        controller_generation: 4,
        invalidation_generation: 9,
        updated_at: "2026-05-31T12:01:00.000Z"
      });
      await expect(reopened.getSnapshot({ repo_root: repoRoot })).resolves.toMatchObject({ id: "606" });
    } finally {
      reopened.close();
    }
  });

  it("production startup worker returns a completed build without publishing it", async () => {
    const repoRoot = createPublicationBarrierRepository(path.join(dir, "production-worker-repository"));
    const databasePath = path.join(dir, "production-worker.sqlite");
    const prior = publicationTestSnapshot(repoRoot, "607");
    const setup = openGraphStore(databasePath);
    await setup.upsertSnapshot({ snapshot: prior });
    setup.close();

    const result = await runStartupGraphWorker({
      repoRoot,
      databasePath,
      snapshotId: "608",
      configIdentity: "default",
      maxFiles: 100,
      retainLatestSnapshots: 2,
      retainLatestFreshSnapshots: 2,
      vacuum: false,
      controllerGeneration: 8,
      invalidationGeneration: 13
    });
    expect(result).toMatchObject({ snapshot_id: "608", repo_root: repoRoot });

    const reopened = openGraphStore(databasePath);
    try {
      await expect(reopened.getSnapshot({ repo_root: repoRoot })).resolves.toMatchObject({ id: prior.id });
      await expect(reopened.readExplicit({ repo_root: repoRoot, snapshot_id: "608" })).resolves.toMatchObject({
        status: "blocked",
        publication_state: "building"
      });
      expect(reopened.db.prepare(`
        SELECT freshness, publication_state, controller_generation, invalidation_generation
        FROM snapshots WHERE id = 608
      `).get()).toEqual({
        freshness: "fresh",
        publication_state: "building",
        controller_generation: 8,
        invalidation_generation: 13
      });
      expect(snapshotRowCount(reopened, "files", 608)).toBeGreaterThan(0);
      expect(snapshotChildRowCount(reopened, "nodes", "files", 608)).toBeGreaterThan(0);
      await expect(reopened.transitionBuild({
        repo_root: repoRoot,
        snapshot_id: "608",
        from: "building",
        to: "published",
        controller_generation: 8,
        invalidation_generation: 12,
        updated_at: "2026-05-31T12:02:00.000Z"
      })).rejects.toThrow("publication generation does not match");
      await reopened.transitionBuild({
        repo_root: repoRoot,
        snapshot_id: "608",
        from: "building",
        to: "published",
        controller_generation: 8,
        invalidation_generation: 13,
        updated_at: "2026-05-31T12:02:00.000Z"
      });
      await expect(reopened.getSnapshot({ repo_root: repoRoot })).resolves.toMatchObject({ id: "608" });
    } finally {
      reopened.close();
    }
  });

  it("leaves a controlled failed build terminally untouched for controller disposition", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-basic-python");
    const store = openGraphStore(path.join(dir, "controlled-build-failure.sqlite"));
    const prior = publicationTestSnapshot(repoRoot, "609");
    const registry = new ExtractorRegistryAdapter();
    registry.register(new FailingPythonExtractor("controlled parser failure"));
    try {
      await store.upsertSnapshot({ snapshot: prior });
      await expect(buildRepositoryGraph({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(),
        graph: store,
        catalog: store,
        snapshots: store,
        clock,
        schema_version: SCHEMA_VERSION,
        snapshot_id: "610",
        controller_generation: 6,
        invalidation_generation: 10
      })).rejects.toThrow("controlled parser failure");

      await expect(store.getSnapshot({ repo_root: repoRoot })).resolves.toMatchObject({ id: prior.id });
      await expect(store.readExplicit({ repo_root: repoRoot, snapshot_id: "610" })).resolves.toMatchObject({
        status: "blocked",
        publication_state: "building"
      });
    } finally {
      store.close();
    }
  });

  it("keeps the prior publication selected when interrupted at every production write barrier", async () => {
    const repoRoot = createPublicationBarrierRepository(path.join(dir, "publication-interruptions"));
    const interruptionCases = ["build", "catalog", "docs", "graph", "before-publication"] as const;

    for (const [index, interruption] of interruptionCases.entries()) {
      const snapshotId = String(620 + index);
      const databasePath = path.join(dir, `publication-interruption-${interruption}.sqlite`);
      const writer = openGraphStore(databasePath);
      const observer = openGraphStore(databasePath);
      const prior = publicationTestSnapshot(repoRoot, "610");
      let interrupted = false;
      const instrumented = decorateGraphStore(writer, {
        before: async (method, args) => {
          if (
            !interrupted &&
            interruption === "before-publication" &&
            method === "transitionBuild" &&
            (args[0] as { to?: string }).to === "published"
          ) {
            interrupted = true;
            throw new Error(`interrupted at ${interruption}`);
          }
        },
        after: async (method, args) => {
          const graphTarget = method === "replaceSnapshotExtraction" &&
            (args[0] as { batch?: { source_path?: string } }).batch?.source_path === "app.py";
          const matches =
            (interruption === "build" && method === "createBuildSnapshot") ||
            (interruption === "catalog" && method === "upsertEntry") ||
            (interruption === "docs" && method === "replaceSnapshotDocs") ||
            (interruption === "graph" && graphTarget);
          if (!interrupted && matches) {
            interrupted = true;
            throw new Error(`interrupted at ${interruption}`);
          }
        }
      });

      try {
        await writer.upsertSnapshot({ snapshot: prior });
        await expect(indexRepositoryGraph({
          repo_root: repoRoot,
          scanner: new FileCatalogScannerAdapter(),
          workspace: new WorkspaceFileAdapter({ repoRoot }),
          extractors: pythonRegistry(),
          resource_extractor: new ResourceExtractorAdapter(),
          graph: instrumented,
          catalog: instrumented,
          docs_index: instrumented,
          snapshots: instrumented,
          clock,
          schema_version: SCHEMA_VERSION,
          snapshot_id: snapshotId
        })).rejects.toThrow(`interrupted at ${interruption}`);
        await expect(observer.getSnapshot({ repo_root: repoRoot })).resolves.toMatchObject({ id: prior.id });
        await expect(observer.readExplicit({ repo_root: repoRoot, snapshot_id: snapshotId })).resolves.toMatchObject({
          status: "blocked",
          publication_state: "failed"
        });
      } finally {
        observer.close();
        writer.close();
      }

      const reopened = openGraphStore(databasePath);
      try {
        await expect(reopened.getSnapshot({ repo_root: repoRoot })).resolves.toMatchObject({ id: prior.id });
        await expect(reopened.readExplicit({ repo_root: repoRoot, snapshot_id: snapshotId })).resolves.toMatchObject({
          status: "blocked",
          publication_state: "failed"
        });
        if (interruption === "catalog") {
          expect(snapshotRowCount(reopened, "files", Number(snapshotId))).toBeGreaterThan(0);
        }
        if (interruption === "docs" || interruption === "before-publication") {
          expect(snapshotRowCount(reopened, "docs_documents", Number(snapshotId))).toBe(1);
          expect(snapshotChildRowCount(reopened, "docs_headings", "docs_documents", Number(snapshotId))).toBeGreaterThan(0);
          expect(snapshotFtsRowCount(reopened, "docs_fts", Number(snapshotId))).toBe(1);
          expect(snapshotRowCount(reopened, "snapshot_index_coverage", Number(snapshotId))).toBe(2);
        }
        if (interruption === "graph" || interruption === "before-publication") {
          expect(snapshotRowCount(reopened, "files", Number(snapshotId))).toBeGreaterThan(0);
          expect(snapshotChildRowCount(reopened, "nodes", "files", Number(snapshotId))).toBeGreaterThan(0);
          expect(snapshotChildRowCount(reopened, "unresolved_refs", "files", Number(snapshotId))).toBeGreaterThan(0);
        }
      } finally {
        reopened.close();
      }
    }
  });

  it("preserves indexing and publication-cleanup failures together", async () => {
    const repoRoot = createPublicationBarrierRepository(path.join(dir, "publication-cleanup-failure"));
    const databasePath = path.join(dir, "publication-cleanup-failure.sqlite");
    const writer = openGraphStore(databasePath);
    const prior = publicationTestSnapshot(repoRoot, "650");
    const instrumented = decorateGraphStore(writer, {
      after: async (method) => {
        if (method === "createBuildSnapshot") {
          throw new Error("induced indexing failure");
        }
      },
      before: async (method, args) => {
        if (method === "transitionBuild" && (args[0] as { to?: string }).to === "failed") {
          throw new Error("induced publication cleanup failure");
        }
      }
    });

    try {
      await writer.upsertSnapshot({ snapshot: prior });
      let failure: unknown;
      try {
        await indexRepositoryGraph({
          repo_root: repoRoot,
          scanner: new FileCatalogScannerAdapter(),
          workspace: new WorkspaceFileAdapter({ repoRoot }),
          extractors: pythonRegistry(),
          resource_extractor: new ResourceExtractorAdapter(),
          graph: instrumented,
          catalog: instrumented,
          docs_index: instrumented,
          snapshots: instrumented,
          clock,
          schema_version: SCHEMA_VERSION,
          snapshot_id: "651"
        });
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(AggregateError);
      expect((failure as AggregateError).message).toBe(
        "Graph indexing failed and publication cleanup also failed."
      );
      expect((failure as AggregateError).errors).toEqual([
        expect.objectContaining({ message: "induced indexing failure" }),
        expect.objectContaining({ message: "induced publication cleanup failure" })
      ]);
      expect((failure as AggregateError & { cause?: unknown }).cause).toEqual(
        expect.objectContaining({ message: "induced indexing failure" })
      );
      await expect(writer.getSnapshot({ repo_root: repoRoot })).resolves.toMatchObject({ id: prior.id });
      await expect(writer.readExplicit({ repo_root: repoRoot, snapshot_id: "651" })).resolves.toMatchObject({
        status: "blocked",
        publication_state: "building"
      });
    } finally {
      writer.close();
    }

    const reopened = openGraphStore(databasePath);
    try {
      await expect(reopened.getSnapshot({ repo_root: repoRoot })).resolves.toMatchObject({ id: prior.id });
      await expect(reopened.readExplicit({ repo_root: repoRoot, snapshot_id: "651" })).resolves.toMatchObject({
        status: "blocked",
        publication_state: "building"
      });
    } finally {
      reopened.close();
    }
  });

  it("uses one resolved snapshot id for standalone failure cleanup when the clock advances", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-basic-python");
    const store = openGraphStore(path.join(dir, "standalone-clock-cleanup.sqlite"));
    const prior = publicationTestSnapshot(repoRoot, "670");
    const registry = new ExtractorRegistryAdapter();
    registry.register(new FailingPythonExtractor("clock-advancing parser failure"));
    let clockReads = 0;
    const advancingClock: ClockPort = {
      ...clock,
      nowUnixMs: () => 671 + clockReads++
    };
    try {
      await store.upsertSnapshot({ snapshot: prior });
      await expect(indexRepositoryGraph({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(),
        graph: store,
        catalog: store,
        snapshots: store,
        clock: advancingClock,
        schema_version: SCHEMA_VERSION
      })).rejects.toThrow("clock-advancing parser failure");

      expect(clockReads).toBe(1);
      await expect(store.readExplicit({ repo_root: repoRoot, snapshot_id: "671" })).resolves.toMatchObject({
        status: "blocked",
        publication_state: "failed"
      });
      await expect(store.readExplicit({ repo_root: repoRoot, snapshot_id: "672" })).resolves.toMatchObject({
        status: "missing"
      });
      await expect(store.getSnapshot({ repo_root: repoRoot })).resolves.toMatchObject({ id: prior.id });
    } finally {
      store.close();
    }
  });

  it("keeps the prior publication visible to another connection until extraction completes", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-basic-python");
    const databasePath = path.join(dir, "atomic-publication.sqlite");
    const writer = openGraphStore(databasePath);
    const reader = openGraphStore(databasePath);
    const delegate = new PythonTreeSitterExtractorAdapter();
    let observedDuringExtraction: string | undefined;
    const registry = new ExtractorRegistryAdapter();
    registry.register({
      language: delegate.language,
      supports: (input) => delegate.supports(input),
      extract: async (input) => {
        observedDuringExtraction ??= (await reader.getSnapshot({ repo_root: repoRoot }))?.id;
        return delegate.extract(input);
      }
    });

    try {
      await writer.upsertSnapshot({
        snapshot: {
          id: "500",
          repo_root: repoRoot,
          workspace_root: repoRoot,
          repo_identity: repoRoot,
          config_identity: "default",
          schema_version: SCHEMA_VERSION,
          freshness: "fresh",
          owner_state: "owner",
          created_at: "2026-05-31T11:00:00.000Z",
          updated_at: "2026-05-31T11:00:00.000Z"
        }
      });

      await indexRepositoryGraph({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(),
        graph: writer,
        catalog: writer,
        snapshots: writer,
        clock,
        schema_version: SCHEMA_VERSION,
        snapshot_id: "501"
      });

      expect(observedDuringExtraction).toBe("500");
      await expect(reader.getSnapshot({ repo_root: repoRoot })).resolves.toMatchObject({ id: "501" });
    } finally {
      reader.close();
      writer.close();
    }
  });

  it("records failed warm-up state when parser work fails without returning partial graph evidence", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-basic-python");
    const store = openGraphStore(path.join(dir, "warmup-failed.sqlite"));
    const runtime = new InMemoryRuntimeOperationsAdapter({ clock });
    const registry = new ExtractorRegistryAdapter();
    registry.register(new FailingPythonExtractor("parser timeout while extracting symbols"));

    try {
      await store.upsertSnapshot({
        snapshot: {
          id: "500",
          repo_root: repoRoot,
          workspace_root: repoRoot,
          repo_identity: repoRoot,
          config_identity: "default",
          schema_version: SCHEMA_VERSION,
          freshness: "fresh",
          owner_state: "owner",
          created_at: "2026-05-31T11:00:00.000Z",
          updated_at: "2026-05-31T11:00:00.000Z"
        }
      });
      await expect(
        warmupRepositoryGraph({
          repo_root: repoRoot,
          scanner: new FileCatalogScannerAdapter(),
          workspace: new WorkspaceFileAdapter({ repoRoot }),
          extractors: registry,
          resource_extractor: new ResourceExtractorAdapter(),
          graph: store,
          catalog: store,
          snapshots: store,
          warmups: runtime,
          cache: runtime,
          clock,
          schema_version: SCHEMA_VERSION,
          owner_id: "owner-1",
          snapshot_id: "502",
          config_identity: "default"
        })
      ).rejects.toThrow("parser timeout while extracting symbols");

      await expect(runtime.getState({ repo_root: repoRoot })).resolves.toMatchObject({
        execution_id: "warmup-1",
        state: "failed",
        reason: "parser timeout while extracting symbols"
      });
      await expect(store.getSnapshot({ repo_root: repoRoot })).resolves.toMatchObject({
        id: "500",
        freshness: "fresh"
      });
      await expect(store.readExplicit({ repo_root: repoRoot, snapshot_id: "502" })).resolves.toMatchObject({
        status: "blocked",
        publication_state: "failed"
      });
      await expect(runtime.get({ namespace: "warmup", key: `graph:${repoRoot}` })).resolves.toBeNull();
    } finally {
      store.close();
    }
  });
});

type TestGraphStore = ReturnType<typeof openGraphStore>;
type StoreHook = (method: string, args: readonly unknown[]) => Promise<void>;

function decorateGraphStore(
  store: TestGraphStore,
  hooks: { before?: StoreHook; after?: StoreHook }
): TestGraphStore {
  return new Proxy(store, {
    get(target, property) {
      const value = Reflect.get(target, property, target) as unknown;
      if (typeof value !== "function") return value;
      const method = String(property);
      if (hooks.before === undefined && hooks.after === undefined) return value.bind(target);
      return async (...args: unknown[]) => {
        await hooks.before?.(method, args);
        const result = await value.apply(target, args);
        await hooks.after?.(method, args);
        return result;
      };
    }
  }) as TestGraphStore;
}

function createPublicationBarrierRepository(repoRoot: string): string {
  fs.mkdirSync(repoRoot, { recursive: true });
  fs.writeFileSync(path.join(repoRoot, "app.py"), "def run():\n    missing_dependency()\n");
  fs.writeFileSync(path.join(repoRoot, "unsupported.java"), "class Unsupported {}\n");
  fs.writeFileSync(path.join(repoRoot, "README.md"), "# Barrier repository\n\nPublication barrier evidence.\n");
  return repoRoot;
}

function pythonRegistry(): ExtractorRegistryAdapter {
  const registry = new ExtractorRegistryAdapter();
  registry.register(new PythonTreeSitterExtractorAdapter());
  return registry;
}

function publicationTestSnapshot(repoRoot: string, id: string) {
  return {
    id,
    repo_root: repoRoot,
    workspace_root: repoRoot,
    repo_identity: repoRoot,
    config_identity: "default",
    schema_version: SCHEMA_VERSION,
    freshness: "fresh" as const,
    owner_state: "owner" as const,
    created_at: "2026-05-31T11:00:00.000Z",
    updated_at: "2026-05-31T11:00:00.000Z"
  };
}

function snapshotRowCount(store: TestGraphStore, table: string, snapshotId: number): number {
  const row = store.db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE snapshot_id = ?`).get(snapshotId) as {
    count: number;
  };
  return row.count;
}

function snapshotChildRowCount(
  store: TestGraphStore,
  childTable: "docs_headings" | "nodes" | "unresolved_refs",
  parentTable: "docs_documents" | "files",
  snapshotId: number
): number {
  const childKey = childTable === "docs_headings" ? "document_id" : "file_id";
  const row = store.db.prepare(`
    SELECT COUNT(*) AS count
    FROM ${childTable}
    JOIN ${parentTable} ON ${parentTable}.id = ${childTable}.${childKey}
    WHERE ${parentTable}.snapshot_id = ?
  `).get(snapshotId) as { count: number };
  return row.count;
}

function snapshotFtsRowCount(store: TestGraphStore, table: "docs_fts", snapshotId: number): number {
  const row = store.db.prepare(`
    SELECT COUNT(*) AS count
    FROM ${table}
    JOIN docs_documents ON docs_documents.id = ${table}.rowid
    WHERE docs_documents.snapshot_id = ?
  `).get(snapshotId) as { count: number };
  return row.count;
}

function runStartupGraphWorker(workerData: Record<string, unknown>): Promise<IndexRepositoryGraphResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../../src/infrastructure/workers/startup-graph-warmup-worker-entrypoint.mjs", import.meta.url),
      { workerData }
    );
    let settled = false;
    worker.once("message", (message: unknown) => {
      settled = true;
      if (
        typeof message === "object" && message !== null &&
        (message as { type?: unknown }).type === "complete"
      ) {
        resolve((message as { result: IndexRepositoryGraphResult }).result);
        return;
      }
      reject(new Error("Startup graph worker returned an invalid result."));
    });
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (!settled && code !== 0) reject(new Error(`Startup graph worker exited with code ${code}.`));
    });
  });
}

class FailingPythonExtractor implements ExtractorPort {
  public readonly language = "python";

  public constructor(private readonly message: string) {}

  public supports(input: { language: string; path: string }): boolean {
    return input.language === "python" && input.path.endsWith(".py");
  }

  public async extract(): Promise<never> {
    throw new Error(this.message);
  }
}

class YieldProbeExtractor implements ExtractorPort {
  public readonly language = "python";

  public constructor(private readonly hasYielded: () => boolean) {}

  public supports(input: { language: string; path: string }): boolean {
    return input.language === "python" && input.path.endsWith(".py");
  }

  public async extract(input: ExtractionRequest) {
    if (input.path === "src/file-30.py") {
      expect(this.hasYielded()).toBe(true);
    }
    return {
      snapshot_id: input.snapshot_id,
      source_path: input.path,
      extractor_id: "yield-probe",
      language: input.language,
      file_identity: {
        path: input.path,
        language: input.language,
        content_hash: `content:${input.path}`,
        size_bytes: input.content.length,
        mtime_ms: 0
      },
      nodes: [
        {
          id: `${input.snapshot_id}:${input.path}:module`,
          kind: "module",
          name: input.path,
          qualified_name: input.path,
          file_path: input.path,
          language: input.language,
          source_range: {
            start_line: 1,
            start_column: 0,
            end_line: 1,
            end_column: input.content.length
          },
          metadata: {}
        }
      ],
      edges: [],
      unresolved_references: [],
      diagnostics_hints: [],
      test_hints: [],
      extracted_at: "2026-05-31T12:00:00.000Z"
    };
  }
}

function fakeScanner(fileCount: number): FileCatalogScanPort {
  return {
    async scan(input) {
      return {
        repo_root: input.repo_root,
        indexed_roots: input.indexed_roots,
        skipped_roots: input.skipped_roots,
        truncated: false,
        files: Array.from({ length: fileCount }, (_, index) =>
          buildFileCatalogEntry({
            file_identity: {
              path: `src/file-${index}.py`,
              language: "python",
              content_hash: `stat:${index}`,
              size_bytes: 10,
              mtime_ms: index
            }
          })
        )
      };
    }
  };
}

function fakeWorkspace(): WorkspaceFilePort {
  return {
    async readText(input) {
      return `# ${input.path}\n`;
    },
    async readBinary() {
      return new Uint8Array();
    },
    async writeText() {},
    async writeBinary() {},
    async stat() {
      return {
        exists: true,
        is_file: true,
        size_bytes: 10,
        mtime_ms: 0
      };
    },
    async deletePath() {},
    async ensureDirectory() {}
  };
}
