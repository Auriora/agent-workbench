import { describe, expect, it } from "vitest";
import type { PlanVerificationResult } from "../../src/application/use-cases/plan-verification.js";
import { planVerification } from "../../src/application/use-cases/plan-verification.js";
import { FileCatalogScannerAdapter } from "../../src/infrastructure/filesystem/index.js";
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
      default_repo_root: "."
    });

    expect(result.plan.status).toBe("planned");
    expect(result.plan.static_feedback).toBeUndefined();
    expect(result.plan.planned_commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          display: "pnpm typecheck",
          execution: "not_executed"
        }),
        expect.objectContaining({
          display: "pnpm test",
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
      default_repo_root: "."
    });

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
  });
});
