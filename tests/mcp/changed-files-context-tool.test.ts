/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type { ChangedFilesContextUseCaseResult } from "../../src/application/use-cases/get-changed-files-context.js";
import { changedFilesContextTool } from "../../src/interface-adapters/mcp/registries/tools/changed-files-context.js";
import { registerMcpTool } from "../helpers/mcp-harness.js";

describe("changed_files_context MCP tool", () => {
  it("defaults to launch-root authority and presents the injected packet", async () => {
    let repoRoot: string | undefined;
    const registered = registerMcpTool(changedFilesContextTool, {
      getChangedFilesContext: ({ request }: { request: { repo_root?: string } }) => {
        repoRoot = request.repo_root;
        const result = noChangesResult();
        result.context.next_actions = [{
          tool: "verification_plan",
          args: { repo_root: "/repo", changed_files: ["src/a.ts"] }
        }];
        return result;
      }
    });

    const response = await registered.handler({});
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as { data: { state: string; next_actions: Array<{ args: Record<string, unknown> }> }; meta: { trust: { safe_to_use_for: string[] } } };
    expect(repoRoot).toBe("/repo");
    expect(parsed.data.state).toBe("no_changes");
    expect(parsed.meta.trust.safe_to_use_for).toContain("navigation");
    expect(parsed.data.next_actions[0]?.args).toEqual({ changed_files: ["src/a.ts"] });
  });

  it("blocks invalid bounds before invoking the provider", async () => {
    let called = false;
    const registered = registerMcpTool(changedFilesContextTool, {
      getChangedFilesContext: () => { called = true; return noChangesResult(); }
    });
    const response = await registered.handler({ max_files: 51 });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as { data: { state: string }; errors: Array<{ code: string }> };
    expect(called).toBe(false);
    expect(parsed.data.state).toBe("blocked");
    expect(parsed.errors[0]?.code).toBe("invalid_input");

    const unsafeResponse = await registered.handler({ files: ["../outside"] });
    const unsafeParsed = JSON.parse(unsafeResponse.content[0]?.text ?? "{}") as { errors: Array<{ code: string }> };
    expect(unsafeParsed.errors[0]?.code).toBe("invalid_input");
  });

  it("returns a structured unavailable envelope when the provider is absent", async () => {
    const response = await registerMcpTool(changedFilesContextTool, {}).handler({});
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as { data: { state: string }; errors: Array<{ code: string }> };
    expect(parsed.data.state).toBe("blocked");
    expect(parsed.errors[0]?.code).toBe("provider_unavailable");
  });
});

function noChangesResult(): ChangedFilesContextUseCaseResult {
  return {
    context: {
      repo_root: "/repo",
      state: "no_changes",
      changes: { state: "available", cleanliness: "clean", staged: [], unstaged: [], untracked: [], changed_files: [] },
      repository_status: { state: "available", value: { runtime_state: "fresh", freshness: "fresh" } },
      diagnostics: { state: "not_applicable" },
      verification: { state: "not_applicable" },
      next_actions: []
    },
    meta: {
      analysis_validity: "valid",
      freshness: "fresh",
      scope: { repo_root: "/repo", indexed_roots: ["."], skipped_roots: [], languages: [] },
      capability_level: "resource_backed",
      evidence_kinds: ["config"],
      verification_status: "not_applicable",
      truncated: false
    }
  };
}
