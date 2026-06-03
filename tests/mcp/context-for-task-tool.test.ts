import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { GetTaskContextResult } from "../../src/application/use-cases/get-task-context.js";
import { getTaskContext } from "../../src/application/use-cases/get-task-context.js";
import { indexRepositoryGraph } from "../../src/application/use-cases/index-repository-graph.js";
import { ExtractorRegistryAdapter, ResourceExtractorAdapter } from "../../src/infrastructure/extraction/index.js";
import {
  DEFAULT_SKIPPED_ROOTS,
  FileCatalogScannerAdapter
} from "../../src/infrastructure/filesystem/index.js";
import { WorkspaceFileAdapter } from "../../src/infrastructure/filesystem/workspace-file.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/index.js";
import { PythonTreeSitterExtractorAdapter } from "../../src/infrastructure/tree-sitter/index.js";
import { contextForTaskTool } from "../../src/interface-adapters/mcp/registries/tools/context-for-task.js";
import { taskContextSchema } from "../../src/contracts/index.js";
import type { ClockPort, FileCatalogScanPort } from "../../src/ports/index.js";
import { createAgentWorkbenchServer } from "../../src/server.js";

type RegisteredTool = {
  name: string;
  description: string;
  handler: (args: unknown) => Promise<{
    content: Array<{
      type: string;
      text: string;
    }>;
  }>;
};

describe("context_for_task use case", () => {
  const clock: ClockPort = {
    now: () => new Date("2026-05-31T12:00:00.000Z"),
    nowIso8601: () => "2026-05-31T12:00:00.000Z",
    nowUnixMs: () => 201
  };

  it("builds bounded context from explicit files, docs, and validation evidence", async () => {
    const result = await getTaskContext({
      request: {
        task: "Update package validation for mixed language platform",
        repo_root: "tests/fixtures/fixture-mixed-language-platform",
        files: ["package.json", "src/service.py", "missing.py"],
        symbols: [],
        max_files: 5,
        max_docs: 5
      },
      scanner: new FileCatalogScannerAdapter(),
      default_repo_root: "."
    });

    expect(result.context.requested_files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "package.json",
          exists: true,
          capability_level: "resource_backed"
        }),
        expect.objectContaining({
          path: "src/service.py",
          exists: true,
          capability_level: "partial_semantic"
        }),
        expect.objectContaining({
          path: "missing.py",
          exists: false
        })
      ])
    );
    expect(result.context.validation_hints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: "pnpm typecheck",
          status: "needed"
        }),
        expect.objectContaining({
          command: "pnpm test",
          status: "needed"
        })
      ])
    );
    expect(result.context.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "warning",
          message: "Some requested files were not found in the scanned repository."
        })
      ])
    );
    expect(result.meta.analysis_validity).toBe("valid");
  });

  it("keeps non-Python language files as explicit routing evidence", async () => {
    const result = await getTaskContext({
      request: {
        task: "Update TypeScript app entrypoint",
        repo_root: "tests/fixtures/fixture-mixed-language-platform",
        files: ["src/app.ts"],
        symbols: [],
        max_files: 5,
        max_docs: 5
      },
      scanner: new FileCatalogScannerAdapter(),
      default_repo_root: "."
    });

    expect(result.context.requested_files).toEqual([
      expect.objectContaining({
        path: "src/app.ts",
        language: "typescript",
        exists: true,
        capability_level: "unsupported",
        evidence_kinds: []
      })
    ]);
    expect(result.meta.scope.languages).toEqual(
      expect.arrayContaining(["python", "typescript", "json"])
    );
  });

  it("resolves explicit requested files directly when the catalog scan is truncated", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-context-truncated-"));
    fs.writeFileSync(
      path.join(repoRoot, "package.json"),
      JSON.stringify({ scripts: { test: "vitest run" } }, null, 2)
    );
    fs.writeFileSync(path.join(repoRoot, "README.md"), "# Fixture\n");
    const scanner: FileCatalogScanPort = {
      async scan(input) {
        return {
          repo_root: input.repo_root,
          indexed_roots: input.indexed_roots,
          skipped_roots: [...DEFAULT_SKIPPED_ROOTS].sort(),
          files: [],
          truncated: true
        };
      }
    };

    try {
      const result = await getTaskContext({
        request: {
          task: "Update package validation docs",
          repo_root: repoRoot,
          files: ["package.json", "README.md"],
          symbols: [],
          max_files: 5,
          max_docs: 5
        },
        scanner,
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: repoRoot
      });

      expect(result.context.requested_files).toEqual([
        expect.objectContaining({
          path: "package.json",
          exists: true,
          capability_level: "resource_backed"
        }),
        expect.objectContaining({
          path: "README.md",
          exists: true,
          capability_level: "resource_backed"
        })
      ]);
      expect(result.context.validation_hints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ command: "pnpm typecheck" }),
          expect.objectContaining({ command: "pnpm test" })
        ])
      );
      expect(result.context.risks).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "Some requested files were not found in the scanned repository."
          })
        ])
      );
      expect(result.meta.truncated).toBe(true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("routes symbol-oriented work to graph query tools through next actions", async () => {
    const result = await getTaskContext({
      request: {
        task: "Change Runner behavior",
        repo_root: "tests/fixtures/fixture-basic-python",
        files: ["src/sample_pkg/service.py"],
        symbols: ["Runner"],
        max_files: 5,
        max_docs: 5
      },
      scanner: new FileCatalogScannerAdapter(),
      default_repo_root: "."
    });

    expect(result.context.next_actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tool: "symbol_search",
          args: expect.objectContaining({
            query: "Runner"
          })
        }),
        expect.objectContaining({
          tool: "find_references",
          args: expect.objectContaining({
            symbol: "Runner"
          })
        }),
        expect.objectContaining({
          tool: "verification_plan"
        })
      ])
    );
  });

  it("ranks symbols from graph evidence and reports context completeness caveats", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-context-"));
    const repoRoot = path.resolve("tests/fixtures/fixture-basic-python");
    const store = openGraphStore(path.join(tempDir, "graph.sqlite"));
    const registry = new ExtractorRegistryAdapter();
    registry.register(new PythonTreeSitterExtractorAdapter());
    const scanner = new FileCatalogScannerAdapter();
    const workspace = new WorkspaceFileAdapter({ repoRoot });
    try {
      await indexRepositoryGraph({
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
        snapshot_id: "2021"
      });

      const result = await getTaskContext({
        request: {
          task: "Change Runner behavior",
          repo_root: repoRoot,
          files: ["src/sample_pkg/service.py"],
          symbols: ["Runner"],
          max_files: 5,
          max_docs: 5
        },
        scanner,
        graph: store,
        snapshots: store,
        catalog: store,
        workspace,
        default_repo_root: repoRoot
      });

      expect(result.context.ranked_symbols[0]).toEqual(
        expect.objectContaining({
          rank: 1,
          symbol: expect.objectContaining({
            name: "Runner",
            path: "src/sample_pkg/service.py",
            capability_level: "partial_semantic",
            evidence_kinds: ["parser"]
          })
        })
      );
      expect(result.context.skipped_work).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: "ranked_symbols" })])
      );
      expect(result.context.completeness).toMatchObject({
        complete_enough: true,
        markers: expect.arrayContaining(["source_candidates_ranked", "symbols_ranked"])
      });
      expect(result.context.completeness.caveats).toEqual(
        expect.arrayContaining([
          "Related files and governing docs are routing evidence; directly read source before editing."
        ])
      );
      expect(result.context.next_actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tool: "find_references",
            args: expect.objectContaining({
              node_id: expect.any(String),
              symbol: "Runner"
            })
          })
        ])
      );
    } finally {
      store.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("routes docs/config and test planning without predecessor backend names", async () => {
    const result = await getTaskContext({
      request: {
        task: "Update architecture docs and package validation",
        repo_root: "tests/fixtures/fixture-markdown-config",
        files: ["README.md", "package.json"],
        symbols: [],
        max_files: 5,
        max_docs: 5
      },
      scanner: new FileCatalogScannerAdapter(),
      default_repo_root: "."
    });

    expect(result.context.governing_docs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "README.md",
          evidence_kinds: ["docs"]
        }),
        expect.objectContaining({
          path: "docs/architecture.md",
          evidence_kinds: ["docs"]
        })
      ])
    );
    expect(result.context.validation_hints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: "pnpm typecheck" }),
        expect.objectContaining({ command: "pnpm test" })
      ])
    );
    expect(JSON.stringify(result.context)).not.toContain("python-agent-ide");
    expect(JSON.stringify(result.context)).not.toContain("agent-ide");
  });
});

describe("context_for_task MCP tool", () => {
  it("uses the injected task-context provider", async () => {
    let registered: RegisteredTool | undefined;
    const server = {
      tool(
        name: string,
        description: string,
        _shape: unknown,
        handler: RegisteredTool["handler"]
      ) {
        registered = { name, description, handler };
      }
    };
    const fixtureResult: GetTaskContextResult = {
      context: {
        task: "Implement context",
        repo_root: "/fixture",
        summary: "Injected context.",
        requested_files: [],
        related_files: [],
        ranked_symbols: [],
        governing_docs: [],
        validation_hints: [],
        skipped_work: [],
        completeness: {
          complete_enough: true,
          markers: ["injected"],
          caveats: []
        },
        risks: [],
        next_actions: []
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
        capability_level: "resource_backed",
        evidence_kinds: ["config"],
        verification_status: "needed",
        truncated: false
      }
    };

    let parsedRepoRoot: string | undefined;
    contextForTaskTool.register(server as never, {
      repoRoot: "/repo",
      getTaskContext: ({ request }) => {
        parsedRepoRoot = request.repo_root;
        return {
          ...fixtureResult,
          context: {
            ...fixtureResult.context,
            task: request.task
          }
        };
      }
    });

    expect(registered).toMatchObject({
      name: "context_for_task",
      description: "Gather compact task context from local repository evidence before editing."
    });

    const response = await registered?.handler({
      task: "Implement context"
    });
    const parsed = JSON.parse(response?.content[0]?.text ?? "{}") as {
      data: { task: string; summary: string };
    };

    expect(parsed.data).toMatchObject({
      task: "Implement context",
      summary: "Injected context."
    });
    expect(parsedRepoRoot).toBe("/repo");
  });

  it("returns a structured invalid-input envelope before provider execution", async () => {
    let registered: RegisteredTool | undefined;
    let providerCalled = false;
    const server = {
      tool(
        name: string,
        description: string,
        _shape: unknown,
        handler: RegisteredTool["handler"]
      ) {
        registered = { name, description, handler };
      }
    };

    contextForTaskTool.register(server as never, {
      repoRoot: "/repo",
      getTaskContext: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const response = await registered?.handler({
      task: "",
      max_files: 500
    });
    const parsed = JSON.parse(response?.content[0]?.text ?? "{}") as {
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string; retryable: boolean }>;
    };

    expect(providerCalled).toBe(false);
    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid",
      verification_status: "blocked"
    });
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        code: "invalid_input",
        retryable: false
      })
    ]);
  });

  it("does not emit backend-only parser/diagnostic fields in the MCP context envelope", async () => {
    let registered: RegisteredTool | undefined;
    const server = {
      tool(
        name: string,
        description: string,
        _shape: unknown,
        handler: RegisteredTool["handler"]
      ) {
        registered = { name, description, handler };
      }
    };

    contextForTaskTool.register(server as never, {
      repoRoot: "/repo",
      getTaskContext: () =>
        ({
          context: {
            task: "Inspect parser-backed task",
            repo_root: "/repo",
            summary: "Context with raw backend payloads.",
            requested_files: [
              {
                path: "src/service.py",
                language: "python",
                exists: true,
                capability_level: "partial_semantic",
                evidence_kinds: ["parser"],
                reason: "Requested file with parser evidence.",
                __raw_parser_payload: {
                  backend: "python_tree_sitter",
                  node_ids: ["node-a", "node-b"]
                }
              }
            ],
            related_files: [],
            ranked_symbols: [
              {
                rank: 1,
                score: 1,
                symbol: {
                  node_id: "symbol-1",
                  kind: "class",
                  name: "Runner",
                  qualified_name: "sample.Runner",
                  path: "src/service.py",
                  language: "python",
                  source_range: {
                    start_line: 1,
                    start_column: 0,
                    end_line: 20,
                    end_column: 1
                  },
                  capability_level: "partial_semantic",
                  evidence_kinds: ["parser"],
                  source_section: {
                    path: "src/service.py",
                    start_line: 1,
                    end_line: 20,
                    byte_count: 200,
                    truncated: false,
                    text: "class Runner:\n    pass",
                    __raw_diagnostic_record: {
                      origin: "lsp",
                      code: "PY123"
                    }
                  }
                } as unknown as Record<string, unknown>,
                reason: "Backend parser ranked symbol."
              }
            ],
            governing_docs: [],
            validation_hints: [],
            skipped_work: [],
            completeness: {
              complete_enough: true,
              markers: ["backend_ranked"],
              caveats: []
            },
            risks: [],
            next_actions: [
              {
                tool: "verification_plan",
                args: {
                  files: ["src/service.py"]
                }
              }
            ],
            __backend_worker_trace: {
              worker: "context-parser-worker",
              pid: 1234
            }
          },
          meta: {
            analysis_validity: "valid",
            freshness: "fresh",
            scope: {
              repo_root: "/repo",
              indexed_roots: ["."],
              skipped_roots: [],
              languages: ["python"]
            },
            capability_level: "partial_semantic",
            evidence_kinds: ["parser"],
            verification_status: "needed",
            truncated: false,
            __test_discovery_payload: {
              runner: "pytest",
              raw: { status: "ok" }
            }
          },
        }) as unknown as GetTaskContextResult
    });

    const response = await registered?.handler({
      task: "Inspect parser-backed task"
    });
    const parsed = JSON.parse(response?.content[0]?.text ?? "{}") as {
      data: unknown;
      meta: { analysis_validity: string };
      contract_version: string;
    };

    expect(parsed.contract_version).toBe("0.1");
    expect(taskContextSchema.parse(parsed.data as never)).toMatchObject({
      task: "Inspect parser-backed task"
    });
    expect(parsed.meta).toMatchObject({ analysis_validity: "valid" });
    expect(JSON.stringify(parsed)).not.toContain("__raw_parser_payload");
    expect(JSON.stringify(parsed)).not.toContain("__raw_diagnostic_record");
    expect(JSON.stringify(parsed)).not.toContain("__backend_worker_trace");
    expect(JSON.stringify(parsed)).not.toContain("__test_discovery_payload");
    expect(JSON.stringify(parsed)).not.toContain("python_tree_sitter");
  });

  it("is registered by the composed server", () => {
    const server = createAgentWorkbenchServer("tests/fixtures/fixture-mixed-language-platform", {
      startGraphWarmup: false
    }) as unknown as {
      _registeredTools: Record<string, unknown>;
    };

    expect(Object.keys(server._registeredTools)).toContain("context_for_task");
  });
});
