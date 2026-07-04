/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type {
  ResponseEnvelope,
  ResponseMetadata,
  RuntimeError
} from "../../src/contracts/index.js";
import { applyWorkspaceEditTool } from "../../src/interface-adapters/mcp/registries/tools/apply-workspace-edit.js";
import { contextForTaskTool } from "../../src/interface-adapters/mcp/registries/tools/context-for-task.js";
import { docsSearchTool } from "../../src/interface-adapters/mcp/registries/tools/docs-search.js";
import { previewWorkspaceEditTool } from "../../src/interface-adapters/mcp/registries/tools/preview-workspace-edit.js";
import { symbolSearchTool } from "../../src/interface-adapters/mcp/registries/tools/symbol-search.js";
import { verificationPlanTool } from "../../src/interface-adapters/mcp/registries/tools/verification-plan.js";
import {
  parseMcpTextContent,
  registerMcpTool
} from "../helpers/mcp-harness.js";

describe("MCP error envelope consistency", () => {
  it("returns invalid-input envelopes before provider execution", async () => {
    let providerCalled = false;
    const tool = registerMcpTool(contextForTaskTool, {
      getTaskContext: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const parsed = parseMcpTextContent<ResponseEnvelope<unknown>>(
      await tool.handler({ task: "" })
    );

    expect(providerCalled).toBe(false);
    expectError(parsed, {
      code: "invalid_input",
      analysis_validity: "invalid",
      verification_status: "blocked",
      retryable: false
    });
  });

  it("returns provider-unavailable envelopes when representative providers are missing", async () => {
    const cases = [
      { tool: contextForTaskTool, args: { task: "Gather context" } },
      { tool: docsSearchTool, args: { query: "runtime" } },
      { tool: symbolSearchTool, args: { query: "Runner" } },
      {
        tool: previewWorkspaceEditTool,
        args: { edits: [{ path: "src/app.ts", replacement_text: "export {};\n" }] }
      },
      {
        tool: applyWorkspaceEditTool,
        args: {
          preview_token: "token-1",
          edits: [{ path: "src/app.ts", replacement_text: "export {};\n" }]
        }
      },
      { tool: verificationPlanTool, args: { files: ["src/app.ts"] } }
    ];

    for (const item of cases) {
      const registered = registerMcpTool(item.tool, {});
      const parsed = parseMcpTextContent<ResponseEnvelope<unknown>>(
        await registered.handler(item.args)
      );

      expectError(parsed, {
        code: "provider_unavailable",
        analysis_validity: "invalid_due_to_environment",
        verification_status: "blocked",
        retryable: false
      });
      expect(parsed.errors[0]?.message).toBe(`${item.tool.name} provider is not configured.`);
    }
  });

  it("keeps stale preview failures distinct from invalid input", async () => {
    const registered = registerMcpTool(applyWorkspaceEditTool, {
      applyWorkspaceEdit: () => {
        throw new Error("Preview is stale because the current file hash changed.");
      }
    });

    const parsed = parseMcpTextContent<ResponseEnvelope<unknown>>(
      await registered.handler({
        preview_token: "token-1",
        edits: [{ path: "src/app.ts", replacement_text: "export {};\n" }]
      })
    );

    expectError(parsed, {
      code: "stale_state",
      analysis_validity: "valid",
      freshness: "stale",
      verification_status: "blocked",
      retryable: false
    });
  });

  it("keeps workspace safety refusals distinct from provider failures", async () => {
    const registered = registerMcpTool(previewWorkspaceEditTool, {
      previewWorkspaceEdit: () => {
        throw new Error("Secret-like files are refused by workspace edit preview.");
      }
    });

    const parsed = parseMcpTextContent<ResponseEnvelope<unknown>>(
      await registered.handler({
        edits: [{ path: ".env", replacement_text: "TOKEN=abc\n" }]
      })
    );

    expectError(parsed, {
      code: "workspace_safety_blocked",
      analysis_validity: "invalid",
      verification_status: "blocked",
      retryable: false
    });
  });

  it("classifies graph-backed runtime failures as environment unavailable", async () => {
    const registered = registerMcpTool(symbolSearchTool, {
      searchSymbols: () => {
        throw new Error("SQLite database is locked while reading graph snapshot.");
      }
    });

    const parsed = parseMcpTextContent<ResponseEnvelope<unknown>>(
      await registered.handler({ query: "Runner" })
    );

    expectError(parsed, {
      code: "environment_unavailable",
      analysis_validity: "invalid_due_to_environment",
      verification_status: "blocked",
      retryable: true
    });
  });

  it("classifies unexpected provider failures as internal errors", async () => {
    const registered = registerMcpTool(verificationPlanTool, {
      planVerification: () => {
        throw new Error("Unexpected validation planner crash.");
      }
    });

    const parsed = parseMcpTextContent<ResponseEnvelope<unknown>>(
      await registered.handler({ files: ["src/app.ts"] })
    );

    expectError(parsed, {
      code: "internal_error",
      analysis_validity: "invalid_due_to_environment",
      verification_status: "blocked",
      retryable: true
    });
  });
});

function expectError(
  envelope: ResponseEnvelope<unknown>,
  expected: {
    code: string;
    analysis_validity: ResponseMetadata["analysis_validity"];
    freshness?: ResponseMetadata["freshness"];
    verification_status: ResponseMetadata["verification_status"];
    retryable: RuntimeError["retryable"];
  }
): void {
  expect(envelope.errors).toEqual([
    expect.objectContaining({
      code: expected.code,
      retryable: expected.retryable
    })
  ]);
  expect(envelope.meta).toMatchObject({
    analysis_validity: expected.analysis_validity,
    verification_status: expected.verification_status,
    ...(expected.freshness === undefined ? {} : { freshness: expected.freshness })
  });
}
