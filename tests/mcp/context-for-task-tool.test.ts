import { describe, expect, it } from "vitest";
import type { GetTaskContextResult } from "../../src/application/use-cases/get-task-context.js";
import { getTaskContext } from "../../src/application/use-cases/get-task-context.js";
import { FileCatalogScannerAdapter } from "../../src/infrastructure/filesystem/index.js";
import { contextForTaskTool } from "../../src/interface-adapters/mcp/registries/tools/context-for-task.js";
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
        governing_docs: [],
        validation_hints: [],
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

    contextForTaskTool.register(server as never, {
      repoRoot: "/repo",
      getTaskContext: ({ request }) => ({
        ...fixtureResult,
        context: {
          ...fixtureResult.context,
          task: request.task
        }
      })
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

  it("is registered by the composed server", () => {
    const server = createAgentWorkbenchServer("tests/fixtures/fixture-mixed-language-platform") as unknown as {
      _registeredTools: Record<string, unknown>;
    };

    expect(Object.keys(server._registeredTools)).toContain("context_for_task");
  });
});
