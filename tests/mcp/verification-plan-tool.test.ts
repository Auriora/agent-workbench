import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { PlanVerificationResult } from "../../src/application/use-cases/plan-verification.js";
import { planVerification } from "../../src/application/use-cases/plan-verification.js";
import {
  FileCatalogScannerAdapter,
  WorkspaceFileAdapter
} from "../../src/infrastructure/filesystem/index.js";
import { verificationPlanTool } from "../../src/interface-adapters/mcp/registries/tools/verification-plan.js";
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
          display: "python3 -m pytest",
          execution: "not_executed"
        }),
        expect.objectContaining({
          display: "planned docs/config syntax review",
          execution: "not_executed"
        })
      ])
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

    verificationPlanTool.register(server as never, {
      repoRoot: "/repo",
      planVerification: () => fixtureResult
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

  it("is registered by the composed server", () => {
    const server = createAgentWorkbenchServer("tests/fixtures/fixture-mixed-language-platform") as unknown as {
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
});
