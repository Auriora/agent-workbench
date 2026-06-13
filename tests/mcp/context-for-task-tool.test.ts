import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { GetTaskContextResult } from "../../src/application/use-cases/get-task-context.js";
import { getTaskContext } from "../../src/application/use-cases/get-task-context.js";
import { indexRepositoryGraph } from "../../src/application/use-cases/index-repository-graph.js";
import { DEFAULT_SKIPPED_ROOTS } from "../../src/domain/policies/index.js";
import { ExtractorRegistryAdapter, ResourceExtractorAdapter } from "../../src/infrastructure/extraction/index.js";
import { FileCatalogScannerAdapter } from "../../src/infrastructure/filesystem/index.js";
import { WorkspaceFileAdapter } from "../../src/infrastructure/filesystem/workspace-file.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/index.js";
import { PythonTreeSitterExtractorAdapter } from "../../src/infrastructure/tree-sitter/index.js";
import { contextForTaskTool } from "../../src/interface-adapters/mcp/registries/tools/context-for-task.js";
import { taskContextSchema } from "../../src/contracts/index.js";
import type { ClockPort, FileCatalogScanPort } from "../../src/ports/index.js";
import { createAgentWorkbenchServer } from "../../src/server.js";
import {
  registerMcpTool,
  registeredToolNames
} from "../helpers/mcp-harness.js";

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
        capability_level: "partial_semantic",
        evidence_kinds: ["parser"]
      })
    ]);
    expect(result.meta.scope.languages).toEqual(
      expect.arrayContaining(["python", "typescript", "json"])
    );
  });

  it("summarizes skipped path evidence in bounded task context", async () => {
    const result = await getTaskContext({
      request: {
        task: "Update Go response cache",
        repo_root: "tests/fixtures/fixture-go-service-repo",
        files: ["internal/graph/response_cache.go"],
        symbols: [],
        max_files: 5,
        max_docs: 5
      },
      scanner: new FileCatalogScannerAdapter(),
      default_repo_root: "."
    });

    expect(result.context.skipped_work).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "skipped_paths",
          reason: expect.stringContaining("generated_or_vendor")
        })
      ])
    );
  });

  it("explains JavaScript and TypeScript package, tsconfig, and service routing evidence", async () => {
    const result = await getTaskContext({
      request: {
        task: "Update TypeScript web login package validation",
        repo_root: "tests/fixtures/fixture-js-ts-monorepo",
        files: ["apps/web/src/Login.tsx"],
        symbols: [],
        max_files: 12,
        max_docs: 5
      },
      scanner: new FileCatalogScannerAdapter(),
      default_repo_root: "."
    });

    expect(result.context.related_files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "apps/web/package.json",
          reason: "Package-local JavaScript/TypeScript configuration associated with an explicitly supplied source file."
        }),
        expect.objectContaining({
          path: "apps/web/tsconfig.json",
          reason: "Package-local JavaScript/TypeScript configuration associated with an explicitly supplied source file."
        }),
        expect.objectContaining({
          path: "pnpm-workspace.yaml",
          reason: "Workspace-level JavaScript/TypeScript configuration associated with an explicitly supplied source file."
        })
      ])
    );
  });

  it("ranks common web auth implementation paths ahead of unrelated token matches", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-context-web-"));
    try {
      fs.mkdirSync(path.join(repoRoot, "api", "server", "controllers"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "api", "server", "services"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "client", "src", "components"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "e2e", "setup"), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }, null, 2));
      fs.writeFileSync(path.join(repoRoot, "api", "server", "controllers", "AuthController.js"), "module.exports = {};\n");
      fs.writeFileSync(path.join(repoRoot, "api", "server", "services", "AuthService.js"), "module.exports = {};\n");
      fs.writeFileSync(path.join(repoRoot, "api", "server", "services", "MCP.js"), "module.exports = {};\n");
      fs.writeFileSync(path.join(repoRoot, "client", "src", "components", "Login.tsx"), "export function Login() { return null; }\n");
      fs.writeFileSync(path.join(repoRoot, "e2e", "setup", "authenticate.ts"), "export async function authenticate() {}\n");

      const result = await getTaskContext({
        request: {
          task: "Update login authentication flow",
          repo_root: repoRoot,
          files: [],
          symbols: [],
          max_files: 4,
          max_docs: 2
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: repoRoot
      });

      expect(result.context.related_files.map((file) => file.path)).toEqual([
        "client/src/components/Login.tsx",
        "api/server/controllers/AuthController.js",
        "api/server/services/AuthService.js",
        "e2e/setup/authenticate.ts"
      ]);
      expect(result.context.related_files.map((file) => file.reason)).toEqual(
        expect.arrayContaining([
          expect.stringContaining("component convention"),
          expect.stringContaining("controller convention"),
          expect.stringContaining("service convention")
        ])
      );
      expect(result.context.related_files.map((file) => file.path)).not.toContain("api/server/services/MCP.js");
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
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

  it("directly resolves allowlisted hidden config but refuses secret env files", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-context-hidden-"));
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
      fs.writeFileSync(path.join(repoRoot, ".env.example"), "TOKEN=\n");
      fs.writeFileSync(path.join(repoRoot, ".env"), "TOKEN=secret\n");

      const result = await getTaskContext({
        request: {
          task: "Review environment template",
          repo_root: repoRoot,
          files: [".env.example", ".env"],
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
          path: ".env.example",
          exists: true,
          language: "config"
        }),
        expect.objectContaining({
          path: ".env",
          exists: false
        })
      ]);
      expect(result.context.risks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "Some requested files were not found in the scanned repository."
          })
        ])
      );
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("ranks .NET project, controller, Razor, and EF routing anchors", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-dotnet-web-repo");
    const result = await getTaskContext({
      request: {
        task: "Update dotnet API controller and Blazor Razor page with Entity Framework context",
        repo_root: repoRoot,
        files: [],
        symbols: [],
        max_files: 8,
        max_docs: 2
      },
      scanner: new FileCatalogScannerAdapter(),
      workspace: new WorkspaceFileAdapter({ repoRoot }),
      default_repo_root: repoRoot
    });

    expect(result.context.related_files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        "ModenaFixture.sln",
        "src/WebApi/WebApi.csproj",
        "src/WebApi/Controllers/OrdersController.cs",
        "src/WebApi/Data/AppDbContext.cs",
        "src/WebApp/Pages/Index.razor"
      ])
    );
    expect(result.context.related_files.map((file) => file.reason)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(".NET solution"),
        expect.stringContaining("ASP.NET controller"),
        expect.stringContaining("Razor/Blazor"),
        expect.stringContaining("Entity Framework")
      ])
    );
  });

  it("ranks SAM template, Lambda handler, and infra test routing anchors", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-sam-lambda-repo");
    const result = await getTaskContext({
      request: {
        task: "Update SAM Lambda handler schedule event template validation",
        repo_root: repoRoot,
        files: [],
        symbols: [],
        max_files: 5,
        max_docs: 2
      },
      scanner: new FileCatalogScannerAdapter(),
      workspace: new WorkspaceFileAdapter({ repoRoot }),
      default_repo_root: repoRoot
    });

    expect(result.context.related_files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        "infra/sam/orders/template.yaml",
        "src/orders/app.py",
        "tests/infra/test_orders_template.py"
      ])
    );
    expect(result.context.related_files.map((file) => file.reason)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("SAM/CloudFormation template"),
        expect.stringContaining("Lambda handler"),
        expect.stringContaining("infrastructure test")
      ])
    );
  });

  it("routes explicit SAM templates to handler and infrastructure test files", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-sam-lambda-repo");
    const result = await getTaskContext({
      request: {
        task: "Review selected infrastructure template",
        repo_root: repoRoot,
        files: ["infra/sam/orders/template.yaml"],
        symbols: [],
        max_files: 4,
        max_docs: 2
      },
      scanner: new FileCatalogScannerAdapter(),
      workspace: new WorkspaceFileAdapter({ repoRoot }),
      default_repo_root: repoRoot
    });

    expect(result.context.requested_files).toEqual([
      expect.objectContaining({
        path: "infra/sam/orders/template.yaml",
        capability_level: "resource_backed"
      })
    ]);
    expect(result.context.related_files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        "src/orders/app.py",
        "tests/infra/test_orders_template.py"
      ])
    );
    expect(result.context.related_files.map((file) => file.reason)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("explicitly supplied SAM/CloudFormation template")
      ])
    );
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

  it("downranks third-party and fixture path matches for broad implementation tasks", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-context-ranking-"));
    try {
      fs.mkdirSync(path.join(repoRoot, "src", "App"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "src", "3rdParty", "Library"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "tests", "fixtures"), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, "src", "App", "DocumentObject.cpp"), "int DocumentObject = 1;\n");
      fs.writeFileSync(path.join(repoRoot, "src", "App", "DocumentObject.h"), "class DocumentObject {};\n");
      fs.writeFileSync(path.join(repoRoot, "src", "3rdParty", "Library", "DocumentObject.cpp"), "int third_party = 1;\n");
      fs.writeFileSync(path.join(repoRoot, "tests", "fixtures", "DocumentObject.txt"), "fixture\n");

      const result = await getTaskContext({
        request: {
          task: "Update DocumentObject recompute behavior",
          repo_root: repoRoot,
          files: [],
          symbols: [],
          max_files: 4,
          max_docs: 5
        },
        scanner: new FileCatalogScannerAdapter(),
        default_repo_root: repoRoot
      });

      expect(result.context.related_files.map((file) => file.path).slice(0, 2)).toEqual([
        "src/App/DocumentObject.cpp",
        "src/App/DocumentObject.h"
      ]);
      expect(result.context.related_files.map((file) => file.path)).not.toContain("src/3rdParty/Library/DocumentObject.cpp");
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
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

  it("surfaces grouped Lambda handler symbols and nearby files for Lambda-heavy tasks", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-lambda-context-"));
    const repoRoot = path.resolve("tests/fixtures/fixture-sam-lambda-heavy-repo");
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
        snapshot_id: "2022"
      });

      const result = await getTaskContext({
        request: {
          task: "Update Lambda app.handler routing for orders and billing templates",
          repo_root: repoRoot,
          files: [],
          symbols: ["app.handler"],
          max_files: 8,
          max_docs: 2
        },
        scanner,
        graph: store,
        snapshots: store,
        catalog: store,
        workspace,
        default_repo_root: repoRoot
      });

      expect(result.context.related_files.map((file) => file.path)).toEqual(
        expect.arrayContaining([
          "infra/sam/orders/template.yaml",
          "infra/sam/billing/template.yaml",
          "src/orders/create/app.py",
          "tests/orders/test_create_app.py"
        ])
      );
      expect(result.context.ranked_symbols.map((candidate) => ({
        name: candidate.symbol.name,
        kind: candidate.symbol.kind,
        signature: candidate.symbol.signature
      })).slice(0, 4)).toEqual([
        {
          name: "src/billing/webhook/app.handler",
          kind: "lambda_handler_binding",
          signature: "BillingWebhookFunction -> src/billing/webhook/app.handler (template infra/sam/billing/template.yaml, handler file src/billing/webhook/app.py, events Api:Api)"
        },
        {
          name: "src/billing/webhook/app.py",
          kind: "lambda_handler_file",
          signature: "BillingWebhookFunction -> src/billing/webhook/app.py#handler (template infra/sam/billing/template.yaml, events Api:Api)"
        },
        {
          name: "src/orders/cancel/app.handler",
          kind: "lambda_handler_binding",
          signature: "OrdersCancelFunction -> src/orders/cancel/app.handler (template infra/sam/orders/template.yaml, handler file src/orders/cancel/app.py, events Api:Api)"
        },
        {
          name: "src/orders/cancel/app.py",
          kind: "lambda_handler_file",
          signature: "OrdersCancelFunction -> src/orders/cancel/app.py#handler (template infra/sam/orders/template.yaml, events Api:Api)"
        }
      ]);
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

  it("adds non-authoritative local routing evidence for active spec task prompts", async () => {
    const repoRoot = createSpecFixtureRepo({
      status: "active",
      includeRequirements: true,
      includeTasks: true,
      includeTraceability: true
    });
    try {
      const result = await getTaskContext({
        request: {
          task: "Complete Spec 021 T003",
          repo_root: repoRoot,
          files: [],
          symbols: [],
          max_files: 12,
          max_docs: 5
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: repoRoot
      });

      expect(result.context.lifecycle_evidence).toEqual([
        expect.objectContaining({
          source: "agent-workbench-local-reader",
          kind: "local_spec_routing",
          status: "non_authoritative",
          summary: expect.stringContaining("active spec package")
        })
      ]);
      expect(result.context.requested_files.map((file) => file.path)).toEqual(
        expect.arrayContaining([
          "docs/specs/021-example/requirements.md",
          "docs/specs/021-example/tasks.md",
          "src/application/use-cases/get-task-context.ts"
        ])
      );
      expect(result.context.lifecycle_evidence?.[0]?.next_actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tool: "spec-lifecycle-manager.task_context",
            args: expect.objectContaining({
              spec_path: "docs/specs/021-example",
              task_id: "T003"
            })
          })
        ])
      );
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("labels archived specs as historical delivery records without lifecycle status changes", async () => {
    const repoRoot = createSpecFixtureRepo({
      status: "archived",
      includeRequirements: true,
      includeTasks: true,
      includeTraceability: false
    });
    try {
      const result = await getTaskContext({
        request: {
          task: "Review docs/specs/021-example T003",
          repo_root: repoRoot,
          files: [],
          symbols: [],
          max_files: 8,
          max_docs: 5
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: repoRoot
      });

      expect(result.context.lifecycle_evidence?.[0]).toEqual(
        expect.objectContaining({
          status: "non_authoritative",
          summary: expect.stringContaining("historical delivery record")
        })
      );
      expect(result.context.lifecycle_evidence?.[0]?.summary).toContain("Use spec-lifecycle-manager");
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("reports malformed spec packages as missing evidence instead of inventing traceability", async () => {
    const repoRoot = createSpecFixtureRepo({
      status: "active",
      includeRequirements: false,
      includeTasks: true,
      includeTraceability: false
    });
    try {
      const result = await getTaskContext({
        request: {
          task: "Complete docs/specs/021-example T003",
          repo_root: repoRoot,
          files: [],
          symbols: [],
          max_files: 8,
          max_docs: 5
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: repoRoot
      });

      expect(result.context.lifecycle_evidence?.[0]).toEqual(
        expect.objectContaining({
          summary: expect.stringContaining("malformed spec package")
        })
      );
      expect(result.context.lifecycle_evidence?.[0]?.summary).toContain("missing artifacts: 2");
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("consumes caller-supplied lifecycle context before broad repo search", async () => {
    const result = await getTaskContext({
      request: {
        task: "Complete Spec 021 T004",
        repo_root: "tests/fixtures/fixture-mixed-language-platform",
        files: [],
        symbols: [],
        lifecycle_context: {
          source: "spec-lifecycle-manager",
          state: "callable",
          spec_path: "docs/specs/021-example",
          task_id: "T004",
          outputs: [
            {
              kind: "task_context",
              status: "provided",
              summary: "Authoritative task context points at get-task-context.",
              files: ["src/application/use-cases/get-task-context.ts"],
              validation_hints: [
                {
                  command: "pnpm test -- tests/mcp/context-for-task-tool.test.ts",
                  reason: "Lifecycle validation plan for T004.",
                  status: "planned"
                }
              ],
              next_actions: [
                {
                  tool: "verification_plan",
                  args: { files: ["src/application/use-cases/get-task-context.ts"] }
                }
              ]
            }
          ]
        },
        max_files: 8,
        max_docs: 5
      },
      scanner: new FileCatalogScannerAdapter(),
      default_repo_root: "."
    });

    expect(result.context.lifecycle_evidence).toEqual([
      expect.objectContaining({
        source: "spec-lifecycle-manager",
        kind: "task_context",
        status: "provided",
        validation_hints: [
          expect.objectContaining({
            status: "planned"
          })
        ]
      }),
      expect.objectContaining({
        source: "agent-workbench-local-reader",
        status: "unknown"
      })
    ]);
    expect(result.context.next_actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tool: "verification_plan"
        })
      ])
    );
    expect(result.context.next_actions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tool: "spec-lifecycle-manager.task_context" })
      ])
    );
  });

  it("routes MCP server prompts to entrypoints, tool registries, protocol docs, and transport evidence", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-context-mcp-server-"));
    try {
      fs.mkdirSync(path.join(repoRoot, "src", "mcp"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "docs"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "generated"), { recursive: true });
      fs.writeFileSync(
        path.join(repoRoot, "package.json"),
        JSON.stringify({ scripts: { "mcp:http": "tsx src/mcp/http-server.ts" } }, null, 2)
      );
      fs.writeFileSync(path.join(repoRoot, "src", "mcp", "http-server.ts"), "export function serve() {}\n");
      fs.writeFileSync(path.join(repoRoot, "src", "mcp", "tools.ts"), "export const tools = [];\n");
      fs.writeFileSync(path.join(repoRoot, "docs", "mcp-sse-transport.md"), "# MCP SSE transport\n");
      fs.writeFileSync(path.join(repoRoot, "generated", "mcp-server.ts"), "generated noise\n");

      const result = await getTaskContext({
        request: {
          task: "Update MCP server HTTP/SSE tools/list smoke support",
          repo_root: repoRoot,
          files: [],
          symbols: [],
          max_files: 6,
          max_docs: 5
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: repoRoot
      });

      expect(result.context.related_files.map((file) => file.path)).toEqual(
        expect.arrayContaining([
          "src/mcp/http-server.ts",
          "src/mcp/tools.ts",
          "docs/mcp-sse-transport.md"
        ])
      );
      expect(result.context.related_files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "src/mcp/http-server.ts",
            reason: "MCP server entrypoint evidence."
          }),
          expect.objectContaining({
            path: "src/mcp/tools.ts",
            reason: "MCP tool registry evidence."
          })
        ])
      );
      expect(result.context.related_files.map((file) => file.path)).not.toContain("generated/mcp-server.ts");
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("boosts local build files and nearby tests for explicit CMake C++ files", async () => {
    const result = await getTaskContext({
      request: {
        task: "Update DocumentObject recompute behavior",
        repo_root: "tests/fixtures/fixture-cmake-cpp-repo",
        files: ["src/App/DocumentObject.cpp", "src/App/DocumentObject.h"],
        symbols: [],
        max_files: 5,
        max_docs: 5
      },
      scanner: new FileCatalogScannerAdapter(),
      default_repo_root: "."
    });

    expect(result.context.related_files.map((file) => file.path).slice(0, 3)).toEqual([
      "src/App/CMakeLists.txt",
      "src/App/DocumentObjectTest.cpp",
      "src/App/DocumentObject.pyi"
    ]);
    expect(result.context.related_files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "src/App/CMakeLists.txt",
          reason: "Local build file adjacent to an explicitly supplied source file."
        }),
        expect.objectContaining({
          path: "src/App/DocumentObjectTest.cpp",
          reason: "Nearby test file associated with an explicitly supplied source file."
        })
      ])
    );
    expect(result.context.related_files.map((file) => file.path)).not.toContain("package.json");
  });

  it("ranks first-party C++ source, tests, and CMake evidence for broad CMake prompts", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-cmake-cpp-repo");
    const result = await getTaskContext({
      request: {
        task: "Update DocumentObject recompute execution behavior in the C++ CMake app",
        repo_root: repoRoot,
        files: [],
        symbols: [],
        max_files: 6,
        max_docs: 5
      },
      scanner: new FileCatalogScannerAdapter(),
      default_repo_root: "."
    });

    const paths = result.context.related_files.map((file) => file.path);
    expect(paths.slice(0, 5)).toEqual([
      "src/App/DocumentObjectTest.cpp",
      "src/App/DocumentObject.cpp",
      "src/App/DocumentObject.h",
      "src/App/CMakeLists.txt",
      "src/App/ExecutionController.cpp"
    ]);
    expect(result.context.related_files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "src/App/DocumentObjectTest.cpp",
          reason: "Matched first-party C/C++ test routing evidence."
        }),
        expect.objectContaining({
          path: "src/App/CMakeLists.txt",
          reason: "Matched CMake build metadata for C/C++ routing."
        }),
        expect.objectContaining({
          path: "src/App/ExecutionController.cpp",
          reason: "Matched first-party C/C++ source routing evidence."
        })
      ])
    );
    expect(paths).not.toContain("third_party/noise/DocumentObject.cpp");
    expect(paths).not.toContain("vendor/noise/DocumentObject.cpp");
    expect(result.context.skipped_work).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "skipped_paths",
          reason: expect.stringContaining("generated_or_vendor")
        })
      ])
    );
  });
});

function createSpecFixtureRepo(input: {
  status: "active" | "archived";
  includeRequirements: boolean;
  includeTasks: boolean;
  includeTraceability: boolean;
}): string {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-spec-routing-"));
  const specPath = path.join(repoRoot, "docs", "specs", "021-example");
  fs.mkdirSync(specPath, { recursive: true });
  fs.mkdirSync(path.join(repoRoot, "src", "application", "use-cases"), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, "src", "application", "use-cases", "get-task-context.ts"),
    "export const routed = true;\n"
  );
  if (input.includeRequirements) {
    fs.writeFileSync(
      path.join(specPath, "requirements.md"),
      `---\ntitle: Fixture requirements\ndoc_type: spec\nartifact_type: requirements\nstatus: ${input.status}\nowner: platform\nlast_reviewed: 2026-06-13\n---\n\n# Requirements\n\nSpec fixture.\n`
    );
  }
  fs.writeFileSync(
    path.join(specPath, "design.md"),
    "---\ntitle: Fixture design\ndoc_type: spec\nartifact_type: design\nstatus: active\nowner: platform\nlast_reviewed: 2026-06-13\n---\n\n# Design\n\nRoutes to `src/application/use-cases/get-task-context.ts`.\n"
  );
  if (input.includeTasks) {
    fs.writeFileSync(
      path.join(specPath, "tasks.md"),
      "---\ntitle: Fixture tasks\ndoc_type: spec\nartifact_type: tasks\nstatus: active\nowner: platform\nlast_reviewed: 2026-06-13\n---\n\n# Tasks\n\n- [ ] T003 Implement fixture routing.\n  - Files: `src/application/use-cases/get-task-context.ts`\n  - Evidence: Pending.\n"
    );
  }
  if (input.includeTraceability) {
    fs.writeFileSync(
      path.join(specPath, "traceability.md"),
      "---\ntitle: Fixture traceability\ndoc_type: spec\nartifact_type: traceability\nstatus: active\nowner: platform\nlast_reviewed: 2026-06-13\n---\n\n# Traceability\n\n| Task ID | Files |\n| --- | --- |\n| T003 | `src/application/use-cases/get-task-context.ts` |\n"
    );
  }
  fs.writeFileSync(
    path.join(specPath, "verification.md"),
    "---\ntitle: Fixture verification\ndoc_type: spec\nartifact_type: verification\nstatus: active\nowner: platform\nlast_reviewed: 2026-06-13\n---\n\n# Verification\n\n- `pnpm test`\n"
  );
  return repoRoot;
}

describe("context_for_task MCP tool", () => {
  it("uses the injected task-context provider", async () => {
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
    const registered = registerMcpTool(contextForTaskTool, {
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

    const response = await registered.handler({
      task: "Implement context"
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: { task: string; summary: string };
    };

    expect(parsed.data).toMatchObject({
      task: "Implement context",
      summary: "Injected context."
    });
    expect(parsedRepoRoot).toBe("/repo");
  });

  it("returns a structured invalid-input envelope before provider execution", async () => {
    let providerCalled = false;

    const registered = registerMcpTool(contextForTaskTool, {
      repoRoot: "/repo",
      getTaskContext: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const response = await registered.handler({
      task: "",
      max_files: 500
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
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
    const registered = registerMcpTool(contextForTaskTool, {
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
                    text: "class Runner:\n    route = '/api/orders'\n    token = 'TOKEN=abc123'\n    path = '/home/example/.ssh/id_rsa'",
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

    const response = await registered.handler({
      task: "Inspect parser-backed task"
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: unknown;
      meta: { analysis_validity: string };
      contract_version: string;
    };

    expect(parsed.contract_version).toBe("0.1");
    expect(taskContextSchema.parse(parsed.data as never)).toMatchObject({
      task: "Inspect parser-backed task"
    });
    expect(parsed.meta).toMatchObject({ analysis_validity: "valid" });
    expect(JSON.stringify(parsed)).toContain("/api/orders");
    expect(JSON.stringify(parsed)).toContain("TOKEN=[REDACTED]");
    expect(JSON.stringify(parsed)).toContain("[REDACTED_ABSOLUTE_PATH]");
    expect(JSON.stringify(parsed)).not.toContain("/home/example");
    expect(JSON.stringify(parsed)).not.toContain("__raw_parser_payload");
    expect(JSON.stringify(parsed)).not.toContain("__raw_diagnostic_record");
    expect(JSON.stringify(parsed)).not.toContain("__backend_worker_trace");
    expect(JSON.stringify(parsed)).not.toContain("__test_discovery_payload");
    expect(JSON.stringify(parsed)).not.toContain("python_tree_sitter");
  });

  it("is registered by the composed server", () => {
    const server = createAgentWorkbenchServer("tests/fixtures/fixture-mixed-language-platform", {
      startGraphWarmup: false
    });

    expect(registeredToolNames(server)).toContain("context_for_task");
  });
});
