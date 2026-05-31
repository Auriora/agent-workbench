import { describe, expect, it } from "vitest";
import type { ApplyWorkspaceEditUseCaseResult } from "../../src/application/use-cases/apply-workspace-edit.js";
import type { PreviewWorkspaceEditUseCaseResult } from "../../src/application/use-cases/preview-workspace-edit.js";
import { applyWorkspaceEditTool } from "../../src/interface-adapters/mcp/registries/tools/apply-workspace-edit.js";
import { previewWorkspaceEditTool } from "../../src/interface-adapters/mcp/registries/tools/preview-workspace-edit.js";
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

describe("workspace edit MCP tools", () => {
  it("uses the injected preview provider", async () => {
    const registered = register(previewWorkspaceEditTool, {
      previewWorkspaceEdit: (): PreviewWorkspaceEditUseCaseResult => ({
        preview: {
          repo_root: "/fixture",
          preview: {
            preview_token: "token-1",
            created_at: "2026-05-31T12:00:00.000Z",
            expires_at: "2026-05-31T12:10:00.000Z",
            files: [],
            operation: "bounded_text_edit",
            mutation_class: "workspace_write"
          },
          changed_files: [],
          next_actions: []
        },
        meta: meta("planned")
      })
    });

    expect(registered.name).toBe("preview_workspace_edit");
    const response = await registered.handler({
      edits: [{ path: "src/app.py", replacement_text: "print('ok')\n" }]
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: { preview: { preview_token: string } };
    };
    expect(parsed.data.preview.preview_token).toBe("token-1");
  });

  it("uses the injected apply provider", async () => {
    const registered = register(applyWorkspaceEditTool, {
      applyWorkspaceEdit: (): ApplyWorkspaceEditUseCaseResult => ({
        result: {
          repo_root: "/fixture",
          preview_token: "token-1",
          applied_files: [],
          status: "applied",
          next_actions: []
        },
        meta: meta("done")
      })
    });

    expect(registered.name).toBe("apply_workspace_edit");
    const response = await registered.handler({
      preview_token: "token-1",
      edits: [{ path: "src/app.py", replacement_text: "print('ok')\n" }]
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: { status: string };
    };
    expect(parsed.data.status).toBe("applied");
  });

  it("returns structured blocked envelopes for invalid input and provider failures", async () => {
    const invalid = register(previewWorkspaceEditTool, {});
    const invalidResponse = await invalid.handler({ edits: [] });
    const invalidParsed = JSON.parse(invalidResponse.content[0]?.text ?? "{}") as {
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string }>;
    };
    expect(invalidParsed.meta).toMatchObject({
      analysis_validity: "invalid",
      verification_status: "blocked"
    });
    expect(invalidParsed.errors).toEqual([expect.objectContaining({ code: "invalid_input" })]);

    const failing = register(applyWorkspaceEditTool, {
      applyWorkspaceEdit: () => {
        throw new Error("Preview is stale because the current file hash changed.");
      }
    });
    const failedResponse = await failing.handler({
      preview_token: "token-1",
      edits: [{ path: "src/app.py", replacement_text: "print('ok')\n" }]
    });
    const failedParsed = JSON.parse(failedResponse.content[0]?.text ?? "{}") as {
      errors: Array<{ message: string }>;
    };
    expect(failedParsed.errors[0]?.message).toBe("Preview is stale because the current file hash changed.");
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

function register(tool: { register: (server: never, context: never) => void }, context: Record<string, unknown>): RegisteredTool {
  let registered: RegisteredTool | undefined;
  const server = {
    tool(name: string, description: string, _shape: unknown, handler: RegisteredTool["handler"]) {
      registered = { name, description, handler };
    }
  };
  tool.register(server as never, { repoRoot: "/repo", ...context } as never);
  if (!registered) {
    throw new Error("tool did not register");
  }
  return registered;
}

function meta(verificationStatus: "planned" | "done") {
  return {
    analysis_validity: "valid" as const,
    freshness: "unknown" as const,
    scope: { repo_root: "/fixture", indexed_roots: ["."], skipped_roots: [], languages: [] },
    capability_level: "unsupported" as const,
    evidence_kinds: ["direct_read" as const],
    verification_status: verificationStatus,
    truncated: false
  };
}
