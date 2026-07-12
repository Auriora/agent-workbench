/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { createAgentWorkbenchServer } from "../../src/interface-adapters/mcp/server.js";
import {
  getRegisteredResource,
  getRegisteredTool
} from "../helpers/mcp-harness.js";

describe("MCP malformed input handling", () => {
  it.each([
    ["context_for_task", { task: "" }],
    ["diagnostics_for_files", { max_files: 100 }],
    ["symbol_search", { query: "" }],
    ["find_references", {}],
    ["impact", { node_id: "node-1", direction: "sideways" }],
    ["preview_workspace_edit", { edits: [] }],
    ["apply_workspace_edit", { preview_token: "", edits: [] }],
    ["verification_plan", { max_commands: 100 }]
  ])("blocks malformed tool input before provider execution for %s", async (toolName, args) => {
    const server = createAgentWorkbenchServer("/repo", providerContextThatThrows());

    const response = await getRegisteredTool(server, toolName).handler(args);
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string; retryable: boolean }>;
    };

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

  it.each([
    ["repo:///orientation", { repo_root: 42 }],
    ["repo:///status", { repo_root: 42 }],
    ["repo:///scope", { repo_root: 42 }],
    ["repo:///overview", { repo_root: 42 }]
  ])("blocks malformed resource input before provider execution for %s", async (uri, args) => {
    const server = createAgentWorkbenchServer("/repo", providerContextThatThrows());

    const response = await getRegisteredResource(server, uri).readCallback(args);
    const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string; retryable: boolean }>;
    };

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
});

function providerContextThatThrows() {
  const fail = () => {
    throw new Error("provider should not run for malformed input");
  };
  return {
    getRepoOrientation: fail,
    getRepoStatus: fail,
    getRepoScope: fail,
    getRepoOverview: fail,
    getTaskContext: fail,
    diagnoseChangedFiles: fail,
    searchSymbols: fail,
    findReferences: fail,
    computeImpact: fail,
    previewWorkspaceEdit: fail,
    applyWorkspaceEdit: fail,
    planVerification: fail
  };
}
