import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  indexRepositoryGraph,
  warmupRepositoryGraph
} from "../../src/application/use-cases/index-repository-graph.js";
import type { ClockPort, ExtractorPort, FileCatalogScanPort, WorkspaceFilePort } from "../../src/ports/index.js";
import type { ExtractionRequest } from "../../src/domain/models/index.js";
import { buildFileCatalogEntry } from "../../src/domain/policies/index.js";
import { ExtractorRegistryAdapter, ResourceExtractorAdapter } from "../../src/infrastructure/extraction/index.js";
import { FileCatalogScannerAdapter, WorkspaceFileAdapter } from "../../src/infrastructure/filesystem/index.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/index.js";
import {
  CppDeclarationExtractorAdapter,
  GoDeclarationExtractorAdapter,
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
  });

  it("keeps unsupported non-Python files out of semantic extraction", async () => {
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

  it("indexes Go declarations as routing evidence without semantic edges", async () => {
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
        scanned_files: 4,
        extracted_files: 4,
        resource_backed_files: 2,
        unsupported_files: 0,
        edge_count: 0,
        unresolved_reference_count: 0
      });

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
            capability_level: "resource_backed",
            evidence_kinds: ["heuristic"],
            semantic_scope: "declarations_only"
          })
        })
      ]);

      const loadConfig = await store.findNodesByName({
        snapshot_id: "109",
        query: "LoadConfig",
        exact: true
      });
      expect(loadConfig).toEqual([
        expect.objectContaining({
          kind: "method",
          name: "LoadConfig",
          qualified_name: "graph.ResponseCache.LoadConfig"
        })
      ]);

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
        scanned_files: 7,
        extracted_files: 7,
        unsupported_files: 0
      });

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
            sources: ["DocumentObject.cpp"]
          })
        })
      ]);
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

  it("records failed warm-up state when parser work fails without returning partial graph evidence", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-basic-python");
    const store = openGraphStore(path.join(dir, "warmup-failed.sqlite"));
    const runtime = new InMemoryRuntimeOperationsAdapter({ clock });
    const registry = new ExtractorRegistryAdapter();
    registry.register(new FailingPythonExtractor("parser timeout while extracting symbols"));

    try {
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
        id: "502",
        freshness: "cold"
      });
      await expect(runtime.get({ namespace: "warmup", key: `graph:${repoRoot}` })).resolves.toBeNull();
    } finally {
      store.close();
    }
  });
});

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
