import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { PlanVerificationResult } from "../../src/application/use-cases/plan-verification.js";
import { planVerification } from "../../src/application/use-cases/plan-verification.js";
import { DEFAULT_SKIPPED_ROOTS } from "../../src/domain/policies/index.js";
import {
  FileCatalogScannerAdapter,
  WorkspaceFileAdapter
} from "../../src/infrastructure/filesystem/index.js";
import type { FileCatalogScanPort } from "../../src/ports/index.js";
import { verificationPlanTool } from "../../src/interface-adapters/mcp/registries/tools/verification-plan.js";
import { verificationPlanSchema } from "../../src/contracts/index.js";
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

describe("verification_plan use case", () => {
  it("plans TypeScript validation without executing commands and keeps clean static feedback silent", async () => {
    const result = await planVerification({
      request: {
        repo_root: "tests/fixtures/fixture-mixed-language-platform",
        files: ["src/app.ts"],
        changed_files: ["src/app.ts"],
        include_static_feedback: true,
        max_commands: 10
      },
      scanner: new FileCatalogScannerAdapter(),
      workspace: new WorkspaceFileAdapter({
        repoRoot: path.resolve("tests/fixtures/fixture-mixed-language-platform")
      }),
      default_repo_root: "."
    });

    expect(result.plan.status).toBe("planned");
    expect(result.plan.static_feedback).toBeUndefined();
    expect(result.plan.planned_commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          display: "pnpm run typecheck",
          execution: "not_executed"
        }),
        expect.objectContaining({
          display: "pnpm run test",
          execution: "not_executed"
        })
      ])
    );
  });

  it("plans Python and docs/config validation from mixed file evidence", async () => {
    const result = await planVerification({
      request: {
        repo_root: "tests/fixtures/fixture-basic-python",
        files: ["src/sample_pkg/service.py", "pyproject.toml"],
        changed_files: ["missing.py"],
        include_static_feedback: true,
        max_commands: 10
      },
      scanner: new FileCatalogScannerAdapter(),
      workspace: new WorkspaceFileAdapter({
        repoRoot: path.resolve("tests/fixtures/fixture-basic-python")
      }),
      default_repo_root: "."
    });

    expect(result.plan.status).toBe("blocked");
    expect(result.plan.planned_commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          display: "python3 -m pytest tests/test_service.py",
          execution: "not_executed"
        }),
        expect.objectContaining({
          display: "python3 -m pytest",
          execution: "not_executed"
        }),
        expect.objectContaining({
          display: "planned docs/config syntax review",
          execution: "not_executed"
        })
      ])
    );
    expect(result.plan.planned_commands.map((command) => command.display)).toContain("python3 -m pytest tests/test_service.py");
    expect(result.plan.planned_commands.map((command) => command.display).indexOf("python3 -m pytest tests/test_service.py")).toBeLessThan(
      result.plan.planned_commands.map((command) => command.display).indexOf("python3 -m pytest")
    );
    expect(result.plan.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "blocker",
          message: "Some requested validation files were not found in the scanned repository."
        })
      ])
    );
    expect(result.plan.static_feedback).toEqual(
      expect.objectContaining({
        status: "actionable",
        findings: [
          expect.objectContaining({
            path: "missing.py",
            severity: "warning"
          })
        ]
      })
    );
    expect(result.plan.next_actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tool: "symbol_search",
          args: expect.objectContaining({
            query: "service"
          })
        })
      ])
    );
  });

  it("plans configured typecheck, lint, format-check, and test scripts without executing them", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-validation-"));
    try {
      fs.mkdirSync(path.join(repoRoot, "src"));
      fs.writeFileSync(
        path.join(repoRoot, "package.json"),
        JSON.stringify(
          {
            scripts: {
              typecheck: "tsc --noEmit",
              lint: "eslint .",
              "format:check": "prettier --check .",
              test: "vitest run"
            }
          },
          null,
          2
        )
      );
      fs.writeFileSync(path.join(repoRoot, "src", "app.ts"), "export const value = 1;\n");

      const result = await planVerification({
        request: {
          repo_root: repoRoot,
          files: ["src/app.ts"],
          changed_files: ["src/app.ts"],
          include_static_feedback: true,
          max_commands: 10
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: "."
      });

      expect(result.plan.status).toBe("planned");
      expect(result.plan.static_feedback).toBeUndefined();
      expect(result.plan.planned_commands.map((command) => command.display)).toEqual([
        "pnpm run typecheck",
        "pnpm run lint",
        "pnpm run format:check",
        "pnpm run test"
      ]);
      expect(result.plan.planned_commands).toEqual(
        result.plan.planned_commands.map(() =>
          expect.objectContaining({
            status: "planned",
            execution: "not_executed"
          })
        )
      );
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("plans package-local JavaScript and TypeScript scripts for selected monorepo files", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-validation-js-monorepo-"));
    try {
      fs.mkdirSync(path.join(repoRoot, "client", "src"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "api", "server"), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, "package-lock.json"), "{}\n");
      fs.writeFileSync(
        path.join(repoRoot, "package.json"),
        JSON.stringify(
          {
            scripts: {
              lint: "eslint .",
              "test:e2e": "playwright test"
            },
            workspaces: ["client", "api"]
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(repoRoot, "client", "package.json"),
        JSON.stringify(
          {
            scripts: {
              typecheck: "tsc --noEmit",
              test: "vitest run"
            }
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(repoRoot, "api", "package.json"),
        JSON.stringify(
          {
            scripts: {
              lint: "eslint server",
              "test:api": "node --test"
            }
          },
          null,
          2
        )
      );
      fs.writeFileSync(path.join(repoRoot, "client", "src", "Login.tsx"), "export function Login() { return null; }\n");
      fs.writeFileSync(path.join(repoRoot, "api", "server", "AuthController.js"), "module.exports = {};\n");

      const clientResult = await planVerification({
        request: {
          repo_root: repoRoot,
          files: ["client/src/Login.tsx"],
          changed_files: ["client/src/Login.tsx"],
          include_static_feedback: true,
          max_commands: 10
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: "."
      });
      const apiResult = await planVerification({
        request: {
          repo_root: repoRoot,
          files: ["api/server/AuthController.js"],
          changed_files: ["api/server/AuthController.js"],
          include_static_feedback: true,
          max_commands: 10
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: "."
      });

      expect(clientResult.plan.status).toBe("planned");
      expect(clientResult.plan.planned_commands.map((command) => command.display)).toEqual([
        "npm --prefix client run typecheck",
        "npm --prefix client run test",
        "npm run lint",
        "npm run test:e2e"
      ]);
      expect(clientResult.plan.planned_commands[0]?.reason).toContain("client/package.json");
      expect(apiResult.plan.status).toBe("planned");
      expect(apiResult.plan.planned_commands.map((command) => command.display)).toEqual([
        "npm --prefix api run lint",
        "npm --prefix api run test:api",
        "npm run lint",
        "npm run test:e2e"
      ]);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("plans validation from directly requested config when the catalog scan is truncated", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-validation-truncated-"));
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
      fs.writeFileSync(
        path.join(repoRoot, "package.json"),
        JSON.stringify(
          {
            scripts: {
              typecheck: "tsc --noEmit",
              test: "vitest run"
            }
          },
          null,
          2
        )
      );

      const result = await planVerification({
        request: {
          repo_root: repoRoot,
          files: ["package.json"],
          changed_files: ["package.json"],
          include_static_feedback: true,
          max_commands: 10
        },
        scanner,
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: "."
      });

      expect(result.meta.truncated).toBe(true);
      expect(result.plan.status).toBe("planned");
      expect(result.plan.static_feedback).toBeUndefined();
      expect(result.plan.planned_commands.map((command) => command.display)).toEqual([
        "pnpm run typecheck",
        "pnpm run test",
        "planned docs/config syntax review"
      ]);
      expect(result.plan.risks).toEqual([
        expect.objectContaining({
          severity: "warning",
          message: "Validation discovery is low confidence for at least one repository area."
        })
      ]);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("blocks explicit secret env files while allowing env templates as direct config evidence", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-validation-hidden-"));
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

      const result = await planVerification({
        request: {
          repo_root: repoRoot,
          files: [".env.example", ".env"],
          changed_files: [".env.example", ".env"],
          include_static_feedback: true,
          max_commands: 10
        },
        scanner,
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: "."
      });

      expect(result.plan.status).toBe("blocked");
      expect(result.plan.planned_commands.map((command) => command.display)).toContain("planned docs/config syntax review");
      expect(result.plan.static_feedback).toEqual(
        expect.objectContaining({
          status: "actionable",
          findings: [
            expect.objectContaining({
              path: ".env",
              severity: "warning"
            })
          ]
        })
      );
      expect(result.plan.risks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: "blocker",
            message: "Some requested validation files were not found in the scanned repository."
          })
        ])
      );
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("plans Go project-shape validation from go.mod and Makefile evidence", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-go-service-repo");
    const result = await planVerification({
      request: {
        repo_root: repoRoot,
        files: ["internal/graph/response_cache.go"],
        changed_files: ["internal/graph/response_cache.go"],
        include_static_feedback: true,
        max_commands: 10
      },
      scanner: new FileCatalogScannerAdapter(),
      workspace: new WorkspaceFileAdapter({ repoRoot }),
      default_repo_root: "."
    });

    expect(result.plan.status).toBe("planned");
    expect(result.plan.static_feedback).toBeUndefined();
    expect(result.plan.planned_commands.map((command) => command.display)).toEqual([
      "make test",
      "go test ./..."
    ]);
    expect(result.plan.planned_commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: expect.stringContaining("Go")
        })
      ])
    );
  });

  it("blocks host Go commands when repo guidance requires Docker validation", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-validation-go-docker-"));
    try {
      fs.mkdirSync(path.join(repoRoot, "internal", "graph"), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, "go.mod"), "module example.com/docker-go\n");
      fs.writeFileSync(path.join(repoRoot, "Makefile"), "test:\n\tgo test ./...\n");
      fs.writeFileSync(
        path.join(repoRoot, "AGENTS.md"),
        [
          "# Repository Guidelines",
          "",
          "Testing protocol: always use Docker for validation.",
          "Never run `go test` directly on the host."
        ].join("\n")
      );
      fs.writeFileSync(path.join(repoRoot, "internal", "graph", "response_cache.go"), "package graph\n");

      const result = await planVerification({
        request: {
          repo_root: repoRoot,
          files: ["internal/graph/response_cache.go"],
          changed_files: ["internal/graph/response_cache.go"],
          include_static_feedback: true,
          max_commands: 10
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: "."
      });

      expect(result.plan.status).toBe("blocked");
      expect(result.plan.static_feedback).toBeUndefined();
      expect(result.plan.planned_commands.map((command) => command.display)).not.toEqual(
        expect.arrayContaining(["make test", "go test ./..."])
      );
      expect(result.plan.risks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: "blocker",
            message: expect.stringContaining("Docker-based validation")
          })
        ])
      );
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("prioritizes CMake validation over incidental package scripts for C++ files", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-cmake-cpp-repo");
    const result = await planVerification({
      request: {
        repo_root: repoRoot,
        files: ["src/App/DocumentObject.cpp", "src/App/DocumentObject.h"],
        changed_files: ["src/App/DocumentObject.cpp"],
        include_static_feedback: true,
        max_commands: 10
      },
      scanner: new FileCatalogScannerAdapter(),
      workspace: new WorkspaceFileAdapter({ repoRoot }),
      default_repo_root: "."
    });

    expect(result.plan.status).toBe("planned");
    expect(result.plan.static_feedback).toBeUndefined();
    expect(result.plan.planned_commands.map((command) => command.display)).toEqual([
      "planned CMake build/test review"
    ]);
    expect(result.plan.planned_commands[0]).toEqual(
      expect.objectContaining({
        command: "manual_review",
        args: ["cmake-build-test"],
        reason: expect.stringContaining("src/App/CMakeLists.txt")
      })
    );
    expect(result.plan.planned_commands.map((command) => command.display)).not.toContain("pnpm run typecheck");
    expect(result.plan.planned_commands.map((command) => command.display)).not.toContain("pnpm run test");
  });

  it("plans .NET project, solution, and test validation from resource-backed evidence", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-dotnet-web-repo");
    const result = await planVerification({
      request: {
        repo_root: repoRoot,
        files: ["src/WebApi/Controllers/OrdersController.cs"],
        changed_files: ["src/WebApi/Controllers/OrdersController.cs"],
        include_static_feedback: true,
        max_commands: 10
      },
      scanner: new FileCatalogScannerAdapter(),
      workspace: new WorkspaceFileAdapter({ repoRoot }),
      default_repo_root: "."
    });

    expect(result.plan.status).toBe("planned");
    expect(result.plan.static_feedback).toBeUndefined();
    expect(result.plan.planned_commands.map((command) => command.display)).toEqual([
      "dotnet build src/WebApi/WebApi.csproj",
      "dotnet build ModenaFixture.sln",
      "dotnet test tests/WebApi.Tests/WebApi.Tests.csproj"
    ]);
    expect(result.plan.planned_commands).toEqual(
      result.plan.planned_commands.map(() =>
        expect.objectContaining({
          status: "planned",
          execution: "not_executed"
        })
      )
    );
  });

  it("blocks unsafe, too-broad, and low-confidence validation targets with quiet feedback", async () => {
    const files = Array.from({ length: 51 }, (_, index) => `src/file-${index}.ts`);
    const result = await planVerification({
      request: {
        repo_root: "tests/fixtures/fixture-mixed-language-platform",
        files: [...files, "src/app.ts;rm -rf /"],
        changed_files: ["src/app.ts"],
        include_static_feedback: true,
        max_commands: 10
      },
      scanner: new FileCatalogScannerAdapter(),
      workspace: new WorkspaceFileAdapter({
        repoRoot: path.resolve("tests/fixtures/fixture-mixed-language-platform")
      }),
      default_repo_root: "."
    });

    expect(result.plan.status).toBe("blocked");
    expect(result.plan.static_feedback).toBeUndefined();
    expect(result.plan.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "blocker",
          message: "Unsafe validation target paths were refused."
        }),
        expect.objectContaining({
          severity: "blocker",
          message: "Too many validation target files were requested."
        }),
        expect.objectContaining({
          severity: "warning",
          message: "Validation discovery is low confidence for at least one repository area."
        })
      ])
    );
    expect(JSON.stringify(result.plan)).not.toMatch(/ruff|pyright|raw diagnostic|backend/iu);
  });

  it("blocks malformed validation configuration without exposing parser output", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-validation-"));
    try {
      fs.mkdirSync(path.join(repoRoot, "src"));
      fs.writeFileSync(path.join(repoRoot, "package.json"), "{");
      fs.writeFileSync(path.join(repoRoot, "src", "app.ts"), "export const value = 1;\n");

      const result = await planVerification({
        request: {
          repo_root: repoRoot,
          files: ["src/app.ts"],
          changed_files: ["src/app.ts"],
          include_static_feedback: true,
          max_commands: 10
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: "."
      });

      expect(result.plan.status).toBe("blocked");
      expect(result.plan.static_feedback).toBeUndefined();
      expect(result.plan.risks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: "warning",
            message: "Validation discovery is low confidence for at least one repository area."
          })
        ])
      );
      expect(JSON.stringify(result.plan)).not.toMatch(/SyntaxError|JSON|Unexpected/);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});

describe("verification_plan MCP tool", () => {
  it("uses the injected verification provider", async () => {
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
    const fixtureResult: PlanVerificationResult = {
      plan: {
        repo_root: "/fixture",
        status: "planned",
        summary: "Injected plan.",
        planned_commands: [],
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
        verification_status: "planned",
        truncated: false
      }
    };

    let parsedRepoRoot: string | undefined;
    verificationPlanTool.register(server as never, {
      repoRoot: "/repo",
      planVerification: ({ request }) => {
        parsedRepoRoot = request.repo_root;
        return fixtureResult;
      }
    });

    expect(registered).toMatchObject({
      name: "verification_plan",
      description: "Plan validation commands and quiet static feedback without executing commands."
    });

    const response = await registered?.handler({
      files: ["src/app.ts"]
    });
    const parsed = JSON.parse(response?.content[0]?.text ?? "{}") as {
      data: { summary: string };
    };

    expect(parsed.data.summary).toBe("Injected plan.");
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

    verificationPlanTool.register(server as never, {
      repoRoot: "/repo",
      planVerification: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const response = await registered?.handler({
      max_commands: 100
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

  it("strips validation, test-discovery, and worker fields from the MCP verification envelope", async () => {
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

    verificationPlanTool.register(server as never, {
      repoRoot: "/repo",
      planVerification: () =>
        ({
          plan: {
            repo_root: "/repo",
            status: "planned",
            summary: "Plan with backend-only diagnostics.",
            planned_commands: [
              {
                command: "pnpm",
                args: ["run", "test"],
                display: "pnpm run test",
                reason: "backend-discovery result",
                status: "planned",
                execution: "not_executed",
                __validation_discovery: {
                  runner: "pytest",
                  raw: {
                    worker: "discovery-worker",
                    traces: ["ok"]
                  }
                }
              },
              {
                command: "python3",
                args: ["-m", "pytest"],
                display: "python3 -m pytest",
                reason: "python discovery result",
                status: "planned",
                execution: "not_executed",
                __worker_trace: {
                  id: "worker-1",
                  pid: 901
                }
              }
            ],
            risks: [
              {
                severity: "warning",
                message: "Validation discovery confidence is low from fixture.",
                why_this_matters: "Worker output is missing stable source diagnostics."
              },
              {
                severity: "warning",
                message: "Legacy raw diagnostic payload seen during discovery.",
                why_this_matters: "The MCP response should hide worker details."
              }
            ],
            next_actions: [
              {
                tool: "symbol_search",
                args: {
                  query: "test",
                  repo_root: "/repo"
                }
              }
            ],
            __backend_payload: {
              tool: "worker",
              diag: {
                backend_name: "pytest",
                raw_message: "exit=1"
              }
            }
          },
          meta: {
            analysis_validity: "valid",
            freshness: "fresh",
            scope: {
              repo_root: "/repo",
              indexed_roots: ["."],
              skipped_roots: [],
              languages: ["python", "typescript"]
            },
            capability_level: "partial_semantic",
            evidence_kinds: ["parser", "config"],
            verification_status: "planned",
            truncated: false,
            __diagnostic_worker_artifacts: {
              source: "pytest-worker",
              raw: [{ code: "W001", message: "x" }]
            }
          }
        }) as unknown as PlanVerificationResult
    });

    const response = await registered?.handler({
      files: ["src/app.ts"]
    });
    const parsed = JSON.parse(response?.content[0]?.text ?? "{}") as {
      data: unknown;
      contract_version: string;
    };

    expect(parsed.contract_version).toBe("0.1");
    expect(verificationPlanSchema.parse(parsed.data as never)).toMatchObject({
      status: "planned"
    });
    expect(JSON.stringify(parsed)).not.toContain("__validation_discovery");
    expect(JSON.stringify(parsed)).not.toContain("__backend_payload");
    expect(JSON.stringify(parsed)).not.toContain("__diagnostic_worker_artifacts");
    expect(JSON.stringify(parsed)).not.toContain("__worker_trace");
  });

  it("is registered by the composed server", () => {
    const server = createAgentWorkbenchServer("tests/fixtures/fixture-mixed-language-platform", {
      startGraphWarmup: false
    }) as unknown as {
      _registeredTools: Record<string, unknown>;
    };

    expect(Object.keys(server._registeredTools).sort()).toEqual([
      "apply_workspace_edit",
      "context_for_task",
      "find_references",
      "impact",
      "preview_workspace_edit",
      "symbol_search",
      "verification_plan"
    ]);
    expect(Object.keys(server._registeredTools)).not.toContain("static_feedback");
  });

  it("binds composed-server validation workspaces to the request repo_root", async () => {
    const defaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-server-default-"));
    const targetRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-server-target-"));
    try {
      fs.writeFileSync(
        path.join(targetRoot, "package.json"),
        JSON.stringify({ scripts: { test: "vitest run" } }, null, 2)
      );
      const server = createAgentWorkbenchServer(defaultRoot, {
        startGraphWarmup: false
      }) as unknown as {
        _registeredTools: Record<
          string,
          {
            handler: (args: unknown) => Promise<{
              content: Array<{ text: string }>;
            }>;
          }
        >;
      };

      const response = await server._registeredTools.verification_plan.handler({
        repo_root: targetRoot,
        files: ["package.json"],
        changed_files: ["package.json"],
        include_static_feedback: true
      });
      const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
        data: {
          status: string;
          static_feedback?: unknown;
          planned_commands: Array<{ display: string }>;
        };
      };

      expect(parsed.data.status).toBe("planned");
      expect(parsed.data.static_feedback).toBeUndefined();
      expect(parsed.data.planned_commands).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            display: "pnpm run test"
          })
        ])
      );
    } finally {
      fs.rmSync(defaultRoot, { recursive: true, force: true });
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });
});
