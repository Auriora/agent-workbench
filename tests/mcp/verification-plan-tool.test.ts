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
import {
  getRegisteredTool,
  registerMcpTool,
  registeredToolNames
} from "../helpers/mcp-harness.js";

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

  it("plans bounded Markdown quality checks for docs-only repositories when no files are selected", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-validation-docs-only-"));
    try {
      fs.mkdirSync(path.join(repoRoot, "docs", "specs", "001-example"), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, "README.md"), "# Fixture\n");
      fs.writeFileSync(path.join(repoRoot, "docs", "specs", "001-example", "tasks.md"), "# Tasks\n");

      const result = await planVerification({
        request: {
          repo_root: repoRoot,
          files: [],
          changed_files: [],
          include_static_feedback: true,
          max_commands: 10
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: "."
      });

      expect(result.plan.status).toBe("planned");
      expect(result.plan.planned_commands).toEqual([
        expect.objectContaining({
          command: "check_markdown_set",
          args: ["--scope-path", "docs"],
          display: "check_markdown_set --scope-path docs",
          reason: expect.stringContaining("Repository Markdown documents are present")
        })
      ]);
      expect(result.plan.static_feedback).toBeUndefined();
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
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
    expect(result.plan.summary).toContain("Blocker: Some requested validation files were not found in the scanned repository.");
    expect(result.plan.summary).toContain("Next action: Call symbol_search.");
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

  it("plans MCP server smoke checks from package scripts and transport evidence without executing them", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-validation-mcp-stdio-"));
    try {
      fs.mkdirSync(path.join(repoRoot, "src", "mcp"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "docs"), { recursive: true });
      fs.writeFileSync(
        path.join(repoRoot, "package.json"),
        JSON.stringify(
          {
            scripts: {
              "mcp:smoke": "node scripts/mcp-smoke.mjs",
              "mcp:stdio": "tsx src/mcp/stdio-server.ts"
            }
          },
          null,
          2
        )
      );
      fs.writeFileSync(path.join(repoRoot, "src", "mcp", "stdio-server.ts"), "export function start() {}\n");
      fs.writeFileSync(path.join(repoRoot, "src", "mcp", "tools.ts"), "export const tools = [];\n");
      fs.writeFileSync(path.join(repoRoot, "docs", "mcp-stdio-transport.md"), "# MCP stdio transport\n");

      const result = await planVerification({
        request: {
          task: "Plan MCP initialize tools/list call-tool smoke checks",
          repo_root: repoRoot,
          files: ["src/mcp/stdio-server.ts"],
          changed_files: [],
          include_static_feedback: true,
          max_commands: 10
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: "."
      });

      expect(result.plan.status).toBe("planned");
      expect(result.plan.planned_commands).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            display: "pnpm run mcp:smoke",
            execution: "not_executed"
          }),
          expect.objectContaining({
            display: "pnpm run mcp:stdio",
            execution: "not_executed"
          }),
          expect.objectContaining({
            display: "planned MCP initialize/tools-list/call-tool smoke review",
            reason: expect.stringContaining("Transport evidence: stdio")
          })
        ])
      );
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("plans manual MCP smoke guidance for HTTP/SSE, streamable HTTP, and ambiguous evidence", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-validation-mcp-http-"));
    try {
      fs.mkdirSync(path.join(repoRoot, "src", "mcp"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "docs"), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, "src", "mcp", "sse-server.ts"), "export function serveSse() {}\n");
      fs.writeFileSync(path.join(repoRoot, "src", "mcp", "streamable-http-server.ts"), "export function serveHttp() {}\n");
      fs.writeFileSync(path.join(repoRoot, "docs", "mcp-inspector.md"), "# MCP inspector\n");

      const result = await planVerification({
        request: {
          task: "Plan MCP streamable HTTP and SSE initialize tools/list validation",
          repo_root: repoRoot,
          files: [],
          changed_files: [],
          include_static_feedback: true,
          max_commands: 10
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: "."
      });

      expect(result.plan.status).toBe("planned");
      expect(result.plan.planned_commands).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            display: "planned MCP initialize/tools-list/call-tool smoke review",
            reason: expect.stringContaining("HTTP/SSE")
          })
        ])
      );
      expect(
        result.plan.planned_commands.find((command) => command.display === "planned MCP initialize/tools-list/call-tool smoke review")?.reason
      ).toContain("streamable HTTP");
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("blocks generic MCP host smoke checks when repo policy requires Docker validation", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-validation-mcp-docker-"));
    try {
      fs.mkdirSync(path.join(repoRoot, "src", "mcp"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, ".agent-workbench"), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, "Dockerfile"), "FROM node:24\n");
      fs.writeFileSync(path.join(repoRoot, "src", "mcp", "server.ts"), "export function start() {}\n");
      fs.writeFileSync(
        path.join(repoRoot, ".agent-workbench", "validation-policy.json"),
        JSON.stringify({ validation: { environment: "docker", host_commands: "blocked" } }, null, 2)
      );

      const result = await planVerification({
        request: {
          task: "Plan MCP Docker validation",
          repo_root: repoRoot,
          files: ["src/mcp/server.ts"],
          changed_files: [],
          include_static_feedback: true,
          max_commands: 10
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: "."
      });

      expect(result.plan.status).toBe("blocked");
      expect(result.plan.planned_commands).toEqual([]);
      expect(result.plan.risks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: "blocker",
            message: expect.stringContaining("Repository guidance requires Docker-based validation")
          })
        ])
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

  it("uses workspace, lockfile, and tsconfig evidence for package-local JS/TS validation", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-js-ts-monorepo");
    const webResult = await planVerification({
      request: {
        repo_root: repoRoot,
        files: ["apps/web/src/Login.tsx"],
        changed_files: ["apps/web/src/Login.tsx"],
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
        files: ["services/api/src/auth-controller.ts"],
        changed_files: ["services/api/src/auth-controller.ts"],
        include_static_feedback: true,
        max_commands: 10
      },
      scanner: new FileCatalogScannerAdapter(),
      workspace: new WorkspaceFileAdapter({ repoRoot }),
      default_repo_root: "."
    });

    expect(webResult.plan.status).toBe("planned");
    expect(webResult.plan.planned_commands.map((command) => command.display)).toEqual([
      "pnpm --dir apps/web run typecheck",
      "pnpm --dir apps/web run test",
      "pnpm --dir apps/web run test:client",
      "pnpm run lint",
      "pnpm run test:e2e"
    ]);
    expect(webResult.plan.planned_commands[0]?.reason).toContain("tsconfig evidence: apps/web/tsconfig.json");
    expect(webResult.plan.planned_commands[0]?.reason).toContain("workspace evidence: pnpm-lock.yaml, pnpm-workspace.yaml");
    expect(apiResult.plan.status).toBe("planned");
    expect(apiResult.plan.planned_commands.map((command) => command.display)).toEqual([
      "pnpm --dir services/api run lint",
      "pnpm --dir services/api run test:api",
      "pnpm run lint",
      "pnpm run test:e2e"
    ]);
    expect(apiResult.plan.planned_commands[0]?.reason).toContain("tsconfig evidence: services/api/tsconfig.json");
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
      "make test"
    ]);
    expect(result.plan.planned_commands.map((command) => command.display)).not.toContain("go test ./...");
    expect(result.plan.planned_commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: expect.stringContaining(".github/workflows/go.yml")
        })
      ])
    );
    expect(result.plan.skipped_paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ".gocache",
          reason: "generated_or_vendor"
        })
      ])
    );
  });

  it("uses Go CI command evidence instead of generic host go test", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-validation-go-ci-"));
    try {
      fs.mkdirSync(path.join(repoRoot, ".github", "workflows"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "internal", "service"), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, "go.mod"), "module example.com/ci-go\n");
      fs.writeFileSync(
        path.join(repoRoot, ".github", "workflows", "go.yml"),
        ["name: go", "jobs:", "  test:", "    steps:", "      - run: docker compose run --rm app go test ./..."].join("\n")
      );
      fs.writeFileSync(path.join(repoRoot, "internal", "service", "service.go"), "package service\n");

      const result = await planVerification({
        request: {
          repo_root: repoRoot,
          files: ["internal/service/service.go"],
          changed_files: ["internal/service/service.go"],
          include_static_feedback: true,
          max_commands: 10
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: "."
      });

      expect(result.plan.status).toBe("planned");
      expect(result.plan.planned_commands.map((command) => command.display)).toEqual([
        "docker compose run --rm app go test ./..."
      ]);
      expect(result.plan.planned_commands[0]?.reason).toContain(".github/workflows/go.yml");
      expect(result.plan.planned_commands.map((command) => command.display)).not.toContain("go test ./...");
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
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
      expect(result.plan.summary).toContain("Blocker: Repository guidance requires Docker-based validation");
      expect(result.plan.summary).toContain("Next action: Repo-local validation guidance takes precedence");
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

  it("uses repo-local validation policy commands instead of generic host commands", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-validation-policy-"));
    try {
      fs.mkdirSync(path.join(repoRoot, ".agent-workbench"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(repoRoot, ".agent-workbench", "validation-policy.json"),
        JSON.stringify(
          {
            validation: {
              environment: "docker",
              host_commands: "blocked",
              commands: [
                {
                  command: "docker",
                  args: ["compose", "run", "--rm", "app", "pnpm", "test"],
                  reason: "Project validation must run inside the app service container."
                }
              ]
            }
          },
          null,
          2
        )
      );
      fs.writeFileSync(path.join(repoRoot, "compose.yaml"), "services:\n  app:\n    image: node:24\n");
      fs.writeFileSync(
        path.join(repoRoot, "package.json"),
        JSON.stringify({ scripts: { typecheck: "tsc --noEmit", test: "vitest run" } })
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
      expect(result.plan.planned_commands.map((command) => command.display)).toEqual([
        "docker compose run --rm app pnpm test"
      ]);
      expect(result.plan.planned_commands[0]).toEqual(
        expect.objectContaining({
          reason: expect.stringContaining(".agent-workbench/validation-policy.json")
        })
      );
      expect(result.plan.risks.map((risk) => risk.severity)).not.toContain("blocker");
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("treats Docker Compose and devcontainer files as advisory evidence without blocking host commands", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-validation-environment-"));
    try {
      fs.mkdirSync(path.join(repoRoot, ".devcontainer"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(repoRoot, ".devcontainer", "devcontainer.json"),
        JSON.stringify({
          name: "fixture",
          dockerComposeFile: "../compose.yaml",
          features: {
            "ghcr.io/devcontainers/features/node:1": {}
          },
          customizations: {
            vscode: {}
          }
        })
      );
      fs.writeFileSync(path.join(repoRoot, "compose.yaml"), "services:\n  app:\n    image: node:24\n");
      fs.writeFileSync(
        path.join(repoRoot, "package.json"),
        JSON.stringify({ scripts: { typecheck: "tsc --noEmit", test: "vitest run" } })
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
      expect(result.plan.planned_commands.map((command) => command.display)).toEqual([
        "pnpm run typecheck",
        "pnpm run test"
      ]);
      expect(result.plan.risks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: "warning",
            message: expect.stringContaining("compose.yaml is validation-environment evidence")
          }),
          expect.objectContaining({
            severity: "warning",
            message: expect.stringContaining(".devcontainer/devcontainer.json is validation-environment evidence")
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
      "cmake -S . -B build",
      "cmake --build build --target App",
      "ctest --test-dir build"
    ]);
    expect(result.plan.planned_commands[0]).toEqual(
      expect.objectContaining({
        command: "cmake",
        args: ["-S", ".", "-B", "build"],
        reason: expect.stringContaining("src/App/CMakeLists.txt")
      })
    );
    expect(result.plan.planned_commands[1]).toEqual(
      expect.objectContaining({
        command: "cmake",
        args: ["--build", "build", "--target", "App"],
        reason: expect.stringContaining("DocumentObject.cpp")
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

  it("does not plan unrelated .NET test projects for selected project files", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-dotnet-web-repo");
    const result = await planVerification({
      request: {
        repo_root: repoRoot,
        files: ["src/WebApp/Pages/Index.razor"],
        changed_files: ["src/WebApp/Pages/Index.razor"],
        include_static_feedback: true,
        max_commands: 10
      },
      scanner: new FileCatalogScannerAdapter(),
      workspace: new WorkspaceFileAdapter({ repoRoot }),
      default_repo_root: "."
    });

    expect(result.plan.status).toBe("planned");
    expect(result.plan.planned_commands.map((command) => command.display)).toEqual([
      "dotnet build src/WebApp/WebApp.csproj",
      "dotnet build ModenaFixture.sln"
    ]);
  });

  it("blocks generic host .NET commands when repo policy requires container validation", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-validation-dotnet-policy-"));
    try {
      fs.mkdirSync(path.join(repoRoot, ".agent-workbench"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "src", "Service"), { recursive: true });
      fs.writeFileSync(
        path.join(repoRoot, ".agent-workbench", "validation-policy.json"),
        JSON.stringify({
          validation: {
            environment: "docker",
            host_commands: "blocked"
          }
        })
      );
      fs.writeFileSync(path.join(repoRoot, "Service.sln"), "Microsoft Visual Studio Solution File, Format Version 12.00\n");
      fs.writeFileSync(path.join(repoRoot, "src", "Service", "Service.csproj"), "<Project Sdk=\"Microsoft.NET.Sdk\" />\n");
      fs.writeFileSync(path.join(repoRoot, "src", "Service", "Worker.cs"), "namespace Service;\n");

      const result = await planVerification({
        request: {
          repo_root: repoRoot,
          files: ["src/Service/Worker.cs"],
          changed_files: ["src/Service/Worker.cs"],
          include_static_feedback: true,
          max_commands: 10
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: "."
      });

      expect(result.plan.status).toBe("blocked");
      expect(result.plan.planned_commands.map((command) => command.command)).not.toContain("dotnet");
      expect(result.plan.risks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: "blocker",
            message: expect.stringContaining("generic host .NET commands were not planned")
          })
        ])
      );
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("plans SAM and CloudFormation validation from template and infra test evidence", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-sam-lambda-repo");
    const result = await planVerification({
      request: {
        repo_root: repoRoot,
        files: ["infra/sam/orders/template.yaml", "src/orders/app.py"],
        changed_files: ["infra/sam/orders/template.yaml"],
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
      "cfn-lint infra/sam/orders/template.yaml",
      "sam validate --template-file infra/sam/orders/template.yaml",
      "python3 -m pytest tests/infra/test_orders_template.py",
      "python3 -m pytest tests/orders/test_app.py",
      "python3 -m pytest",
      "planned docs/config syntax review"
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

  it("prefers explicitly selected SAM templates before broader repository templates", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-sam-lambda-heavy-repo");
    const result = await planVerification({
      request: {
        repo_root: repoRoot,
        files: ["infra/sam/orders/template.yaml"],
        changed_files: ["infra/sam/orders/template.yaml"],
        include_static_feedback: true,
        max_commands: 4
      },
      scanner: new FileCatalogScannerAdapter(),
      workspace: new WorkspaceFileAdapter({ repoRoot }),
      default_repo_root: "."
    });

    expect(result.plan.status).toBe("planned");
    expect(result.plan.planned_commands.slice(0, 2).map((command) => command.display)).toEqual([
      "cfn-lint infra/sam/orders/template.yaml",
      "sam validate --template-file infra/sam/orders/template.yaml"
    ]);
  });

  it("plans repo-approved SAM and CloudFormation commands before generic template checks", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-validation-sam-policy-"));
    try {
      fs.mkdirSync(path.join(repoRoot, ".agent-workbench"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "infra", "sam", "orders"), { recursive: true });
      fs.writeFileSync(
        path.join(repoRoot, ".agent-workbench", "validation-policy.json"),
        JSON.stringify({
          validation: {
            environment: "host",
            host_commands: "allowed",
            commands: [
              {
                command: "cfn-lint",
                args: ["infra/sam/orders/template.yaml"],
                reason: "Repository-approved template lint."
              }
            ]
          }
        })
      );
      fs.writeFileSync(
        path.join(repoRoot, "infra", "sam", "orders", "template.yaml"),
        "AWSTemplateFormatVersion: '2010-09-09'\nTransform: AWS::Serverless-2016-10-31\nResources:\n  OrdersFunction:\n    Type: AWS::Serverless::Function\n    Properties:\n      Handler: src/orders/app.handler\n"
      );

      const result = await planVerification({
        request: {
          repo_root: repoRoot,
          files: ["infra/sam/orders/template.yaml"],
          changed_files: ["infra/sam/orders/template.yaml"],
          include_static_feedback: true,
          max_commands: 5
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: "."
      });

      expect(result.plan.status).toBe("planned");
      expect(result.plan.planned_commands[0]).toEqual(
        expect.objectContaining({
          display: "cfn-lint infra/sam/orders/template.yaml",
          reason: expect.stringContaining(".agent-workbench/validation-policy.json"),
          execution: "not_executed"
        })
      );
      expect(result.plan.planned_commands.map((command) => command.display)).toEqual(
        expect.arrayContaining([
          "cfn-lint infra/sam/orders/template.yaml",
          "sam validate --template-file infra/sam/orders/template.yaml"
        ])
      );
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("plans repo-approved intrinsic SAM and CloudFormation commands before generic checks", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-sam-intrinsic-repo");
    const result = await planVerification({
      request: {
        repo_root: repoRoot,
        files: ["infra/orders/template.yaml", "infra/shared/template.json"],
        changed_files: ["infra/orders/template.yaml"],
        include_static_feedback: true,
        max_commands: 6
      },
      scanner: new FileCatalogScannerAdapter(),
      workspace: new WorkspaceFileAdapter({ repoRoot }),
      default_repo_root: "."
    });

    expect(result.plan.status).toBe("planned");
    expect(result.plan.static_feedback).toBeUndefined();
    expect(result.plan.planned_commands.slice(0, 2)).toEqual([
      expect.objectContaining({
        display: "sam validate --template-file infra/orders/template.yaml",
        reason: expect.stringContaining(".agent-workbench/validation-policy.json"),
        execution: "not_executed"
      }),
      expect.objectContaining({
        display: "cfn-lint infra/shared/template.json",
        reason: expect.stringContaining(".agent-workbench/validation-policy.json"),
        execution: "not_executed"
      })
    ]);
    expect(result.plan.planned_commands.map((command) => command.display)).toEqual(
      expect.arrayContaining([
        "sam validate --template-file infra/orders/template.yaml",
        "cfn-lint infra/shared/template.json",
        "cfn-lint infra/orders/template.yaml"
      ])
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
    const registered = registerMcpTool(verificationPlanTool, {
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

    const response = await registered.handler({
      files: ["src/app.ts"]
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: { summary: string };
    };

    expect(parsed.data.summary).toBe("Injected plan.");
    expect(parsedRepoRoot).toBe("/repo");
  });

  it("returns a structured invalid-input envelope before provider execution", async () => {
    let providerCalled = false;

    const registered = registerMcpTool(verificationPlanTool, {
      repoRoot: "/repo",
      planVerification: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const response = await registered.handler({
      max_commands: 100
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

  it("returns a structured blocked envelope when provider filesystem discovery fails", async () => {
    const registered = registerMcpTool(verificationPlanTool, {
      repoRoot: "/repo",
      planVerification: () => {
        throw new Error("ENOENT: no such file or directory, scandir '/repo/docs/missing'");
      }
    });

    const response = await registered.handler({
      changed_files: ["docs/missing/note.md"]
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string; message: string; retryable: boolean }>;
    };

    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid",
      verification_status: "blocked"
    });
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        code: "invalid_input",
        message: expect.stringContaining("ENOENT"),
        retryable: false
      })
    ]);
  });

  it("strips validation, test-discovery, and worker fields from the MCP verification envelope", async () => {
    const registered = registerMcpTool(verificationPlanTool, {
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

    const response = await registered.handler({
      files: ["src/app.ts"]
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
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
    });

    expect(registeredToolNames(server)).toEqual([
      "apply_workspace_edit",
      "check_markdown_document",
      "check_markdown_set",
      "context_for_task",
      "diagnostics_for_files",
      "docs_outline",
      "docs_read_section",
      "docs_search",
      "find_references",
      "impact",
      "preview_workspace_edit",
      "symbol_search",
      "verification_plan"
    ]);
    expect(registeredToolNames(server)).not.toContain("static_feedback");
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
      });

      const response = await getRegisteredTool(server, "verification_plan").handler({
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
