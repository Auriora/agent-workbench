import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ApplyWorkspaceEditUseCaseResult } from "../../src/application/use-cases/apply-workspace-edit.js";
import { applyWorkspaceEdit } from "../../src/application/use-cases/apply-workspace-edit.js";
import type { PreviewWorkspaceEditUseCaseResult } from "../../src/application/use-cases/preview-workspace-edit.js";
import { previewWorkspaceEdit } from "../../src/application/use-cases/preview-workspace-edit.js";
import type {
  ApplyWorkspaceEditRequest,
  PreviewWorkspaceEditRequest
} from "../../src/contracts/index.js";
import { InMemoryEditPreviewStoreAdapter } from "../../src/infrastructure/edit-preview-store/index.js";
import {
  WorkspaceFileAdapter,
  WorkspaceSafetyAdapter
} from "../../src/infrastructure/filesystem/index.js";
import { applyWorkspaceEditTool } from "../../src/interface-adapters/mcp/registries/tools/apply-workspace-edit.js";
import { previewWorkspaceEditTool } from "../../src/interface-adapters/mcp/registries/tools/preview-workspace-edit.js";
import type { ClockPort } from "../../src/ports/index.js";
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

  it("parses preview defaults and schema types before provider execution", async () => {
    let parsedRequest: { expires_in_ms: number; edits: Array<{ path: string; replacement_text: string }> } | undefined;
    const registered = register(previewWorkspaceEditTool, {
      previewWorkspaceEdit: ({ request }: { request: PreviewWorkspaceEditRequest }) => {
        parsedRequest = request;
        return {
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
        };
      }
    });

    expect(registered.name).toBe("preview_workspace_edit");
    const response = await registered.handler({
      edits: [{ path: "src/app.py", replacement_text: "print('ok')\n" }]
    });

    expect(parsedRequest).toEqual({
      repo_root: "/repo",
      edits: [{ path: "src/app.py", replacement_text: "print('ok')\n" }],
      expires_in_ms: 600000
    });

    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: { preview: { preview_token: string; expires_at: string } };
    };
    expect(parsed.data.preview.preview_token).toBe("token-1");
  });

  it("returns structured invalid input before apply provider execution when raw input types are wrong", async () => {
    let providerCalled = false;
    const registered = register(applyWorkspaceEditTool, {
      applyWorkspaceEdit: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const response = await registered.handler({
      preview_token: 1 as unknown as string,
      edits: [{ path: "src/app.py", replacement_text: "print('ok')\n" }]
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
    expect(parsed.errors).toEqual([expect.objectContaining({ code: "invalid_input", retryable: false })]);
  });

  it("returns stable MCP envelopes for missing preview targets without filesystem details", async () => {
    const fixture = createEditFixture();
    try {
      const registered = register(previewWorkspaceEditTool, fixture.context);

      const response = await registered.handler({
        edits: [{ path: "src/missing.py", replacement_text: "print('ok')\n" }]
      });

      const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
        meta: { analysis_validity: string; verification_status: string };
        errors: Array<{ code: string; message: string }>;
      };

      expect(parsed.meta).toMatchObject({
        analysis_validity: "invalid",
        verification_status: "blocked"
      });
      expect(parsed.errors).toEqual([
        expect.objectContaining({
          code: "invalid_input",
          message: "Workspace edit target was not found: src/missing.py"
        })
      ]);
      expect(JSON.stringify(parsed.errors)).not.toContain("ENOENT");
      expect(JSON.stringify(parsed.errors)).not.toContain(fixture.repoRoot);
    } finally {
      fixture.dispose();
    }
  });

  it("omits full replacement text from preview next actions", async () => {
    const fixture = createEditFixture();
    try {
      const registered = register(previewWorkspaceEditTool, fixture.context);
      const response = await registered.handler({
        edits: [{ path: "src/service.py", replacement_text: "large replacement\n" }]
      });
      const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
        data: {
          preview: { preview_token: string };
          next_actions: Array<{ tool: string; args: Record<string, unknown> }>;
        };
      };

      expect(parsed.data.next_actions).toEqual([
        {
          tool: "apply_workspace_edit",
          args: {
            preview_token: parsed.data.preview.preview_token,
            paths: ["src/service.py"],
            requires_original_edits: true
          }
        }
      ]);
      expect(JSON.stringify(parsed.data.next_actions)).not.toContain("replacement_text");
      expect(JSON.stringify(parsed.data.next_actions)).not.toContain("large replacement");
    } finally {
      fixture.dispose();
    }
  });

  it("uses shared capability metadata for C++ preview targets", async () => {
    const fixture = createEditFixture();
    try {
      fs.mkdirSync(path.join(fixture.repoRoot, "src", "App"), { recursive: true });
      fs.writeFileSync(path.join(fixture.repoRoot, "src", "App", "DocumentObject.cpp"), "int value = 1;\n");
      const registered = register(previewWorkspaceEditTool, fixture.context);

      const response = await registered.handler({
        edits: [{ path: "src/App/DocumentObject.cpp", replacement_text: "int value = 2;\n" }]
      });
      const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
        data: {
          changed_files: Array<{
            path: string;
            language: string;
            capability_level: string;
            evidence_kinds: string[];
          }>;
        };
      };

      expect(parsed.data.changed_files).toEqual([
        expect.objectContaining({
          path: "src/App/DocumentObject.cpp",
          language: "cpp",
          capability_level: "resource_backed",
          evidence_kinds: ["heuristic"]
        })
      ]);
    } finally {
      fixture.dispose();
    }
  });

  it("returns stable MCP envelopes for expired, mismatched, and missing-target apply failures", async () => {
    const fixture = createEditFixture();
    try {
      const preview = register(previewWorkspaceEditTool, fixture.context);
      const apply = register(applyWorkspaceEditTool, fixture.context);

      const previewResponse = await preview.handler({
        edits: [{ path: "src/service.py", replacement_text: "new = 2\n" }],
        expires_in_ms: 1
      });
      const previewParsed = JSON.parse(previewResponse.content[0]?.text ?? "{}") as {
        data: { preview: { preview_token: string } };
      };

      const mismatchResponse = await apply.handler({
        preview_token: previewParsed.data.preview.preview_token,
        edits: [{ path: "src/other.py", replacement_text: "new = 2\n" }]
      });
      expect(firstErrorMessage(mismatchResponse)).toBe("Apply edits do not match the preview token.");

      const expiredPreviewResponse = await preview.handler({
        edits: [{ path: "src/service.py", replacement_text: "new = 3\n" }],
        expires_in_ms: 1
      });
      const expiredPreviewParsed = JSON.parse(expiredPreviewResponse.content[0]?.text ?? "{}") as {
        data: { preview: { preview_token: string } };
      };
      fixture.setNow("2026-05-31T12:00:01.000Z");
      const expiredResponse = await apply.handler({
        preview_token: expiredPreviewParsed.data.preview.preview_token,
        edits: [{ path: "src/service.py", replacement_text: "new = 3\n" }]
      });
      expect(firstErrorMessage(expiredResponse)).toBe("Preview token has expired.");

      fixture.setNow("2026-05-31T12:00:00.000Z");
      const stalePreviewResponse = await preview.handler({
        edits: [{ path: "src/service.py", replacement_text: "new = 4\n" }],
        expires_in_ms: 600_000
      });
      const stalePreviewParsed = JSON.parse(stalePreviewResponse.content[0]?.text ?? "{}") as {
        data: { preview: { preview_token: string } };
      };
      fs.rmSync(path.join(fixture.repoRoot, "src/service.py"));

      const missingTargetResponse = await apply.handler({
        preview_token: stalePreviewParsed.data.preview.preview_token,
        edits: [{ path: "src/service.py", replacement_text: "new = 4\n" }]
      });
      const missingTargetParsed = JSON.parse(missingTargetResponse.content[0]?.text ?? "{}") as {
        errors: Array<{ message: string }>;
      };

      expect(missingTargetParsed.errors[0]?.message).toBe(
        "Preview is stale because the target file is missing."
      );
      expect(JSON.stringify(missingTargetParsed.errors)).not.toContain("ENOENT");
      expect(JSON.stringify(missingTargetParsed.errors)).not.toContain(fixture.repoRoot);
    } finally {
      fixture.dispose();
    }
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
      "diagnostics_for_files",
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

function createEditFixture() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-mcp-edit-"));
  fs.mkdirSync(path.join(repoRoot, "src"));
  fs.writeFileSync(path.join(repoRoot, "src/service.py"), "old = 1\n");
  const workspace = new WorkspaceFileAdapter({ repoRoot });
  const safety = new WorkspaceSafetyAdapter({ repoRoot });
  const previews = new InMemoryEditPreviewStoreAdapter();
  let now = new Date("2026-05-31T12:00:00.000Z");
  const clock: ClockPort = {
    now: () => now,
    nowIso8601: () => now.toISOString(),
    nowUnixMs: () => now.getTime()
  };

  return {
    repoRoot,
    context: {
      repoRoot,
      previewWorkspaceEdit: ({ request }: { request: PreviewWorkspaceEditRequest }) =>
        previewWorkspaceEdit({
          request,
          workspace,
          safety,
          previews,
          clock,
          default_repo_root: repoRoot
        }),
      applyWorkspaceEdit: ({ request }: { request: ApplyWorkspaceEditRequest }) =>
        applyWorkspaceEdit({
          request,
          workspace,
          safety,
          previews,
          clock,
          default_repo_root: repoRoot
        })
    },
    setNow(value: string) {
      now = new Date(value);
    },
    dispose() {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  };
}

function firstErrorMessage(response: { content: Array<{ text: string }> }): string | undefined {
  const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
    errors: Array<{ message: string }>;
  };
  return parsed.errors[0]?.message;
}
