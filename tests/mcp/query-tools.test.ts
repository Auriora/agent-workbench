/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type {
  SymbolSearchRequest
} from "../../src/contracts/index.js";
import type { ComputeImpactResult } from "../../src/application/use-cases/compute-impact.js";
import type { FindReferencesUseCaseResult } from "../../src/application/use-cases/find-references.js";
import type { SearchSymbolsResult } from "../../src/application/use-cases/search-symbols.js";
import { findReferencesTool } from "../../src/interface-adapters/mcp/registries/tools/find-references.js";
import { impactTool } from "../../src/interface-adapters/mcp/registries/tools/impact.js";
import { symbolSearchTool } from "../../src/interface-adapters/mcp/registries/tools/symbol-search.js";
import { createRootAuthorityPolicy } from "../../src/interface-adapters/mcp/registries/root-authority.js";
import { createAgentWorkbenchServer } from "../../src/server.js";
import {
  registerMcpTool as registerTool,
  registeredToolNames
} from "../helpers/mcp-harness.js";

describe("graph query MCP tools", () => {
  it("uses the injected symbol_search provider", async () => {
    const registered = registerTool(symbolSearchTool, {
      searchSymbols: ({ request }: { request: SymbolSearchRequest }) => ({
        symbols: {
          query: request.query,
          repo_root: "/fixture",
          snapshot_id: "1",
          symbols: [],
          next_actions: []
        },
        meta: meta()
      })
    });

    expect(registered).toMatchObject({
      name: "symbol_search",
      description: "Search indexed graph symbols with bounded row and optional source-byte budgets."
    });
    const response = await registered.handler({ query: "Runner" });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: SearchSymbolsResult["symbols"];
    };
    expect(parsed.data.query).toBe("Runner");
  });

  it("redacts unsafe tokens in symbol source sections while preserving route snippets", async () => {
    const registered = registerTool(symbolSearchTool, {
      searchSymbols: ({ request }: { request: SymbolSearchRequest }) => ({
        symbols: {
          query: request.query,
          repo_root: "/fixture",
          snapshot_id: "1",
          symbols: [
            {
              node_id: "node-1",
              kind: "function",
              name: "handler",
              qualified_name: "orders.handler",
              path: "src/routes/orders.py",
              language: "python",
              source_range: {
                start_line: 1,
                start_column: 0,
                end_line: 3,
                end_column: 1
              },
              capability_level: "partial_semantic",
              evidence_kinds: ["parser"],
              source_section: {
                path: "src/routes/orders.py",
                start_line: 1,
                end_line: 3,
                byte_count: 120,
                truncated: false,
                text: "route = '/api/orders'\nkey = 'TOKEN=abc123'\npath = '/home/example/.ssh/id_rsa'"
              }
            }
          ],
          next_actions: []
        },
        meta: meta()
      })
    });

    const response = await registered.handler({ query: "handler", source_byte_limit: 200 });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: SearchSymbolsResult["symbols"];
    };
    const text = parsed.data.symbols[0]?.source_section?.text ?? "";

    expect(text).toContain("/api/orders");
    expect(text).toContain("TOKEN=[REDACTED]");
    expect(text).toContain("[REDACTED_ABSOLUTE_PATH]");
    expect(text).not.toContain("/home/example");
  });

  it("uses the injected find_references provider", async () => {
    const registered = registerTool(findReferencesTool, {
      findReferences: () => ({
        references: {
          repo_root: "/fixture",
          snapshot_id: "1",
          references: [
            {
              source_node_id: "a",
              target_node_id: "b",
              target_file_path: "src/service.py",
              reference_kind: "call",
              confidence: 0.8,
              evidence_kinds: ["parser"],
              provenance: "unit",
              status: "resolved"
            }
          ],
          next_actions: []
        },
        meta: meta()
      })
    });

    expect(registered.name).toBe("find_references");
    const response = await registered.handler({ symbol: "Runner" });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: FindReferencesUseCaseResult["references"];
    };
    expect(parsed.data.references[0]).toMatchObject({ status: "resolved" });
  });

  it("uses the injected impact provider", async () => {
    const registered = registerTool(impactTool, {
      computeImpact: () => ({
        impact: {
          repo_root: "/fixture",
          snapshot_id: "1",
          start_node_ids: ["a"],
          affected_symbols: [],
          affected_files: [],
          edge_count: 0,
          reached_depth: 0,
          traversal_truncated: false,
          confidence: {
            level: "low",
            scope: "empty",
            reason: "fixture",
            evidence_kinds: []
          },
          next_actions: []
        },
        meta: meta()
      })
    });

    expect(registered.name).toBe("impact");
    const response = await registered.handler({ node_id: "a" });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: ComputeImpactResult["impact"];
    };
    expect(parsed.data.start_node_ids).toEqual(["a"]);
  });

  it("returns structured invalid input before provider execution", async () => {
    let providerCalled = false;
    const registered = registerTool(symbolSearchTool, {
      searchSymbols: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const response = await registered.handler({ query: "" });
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

  it("parses symbol_search defaults and schema types before provider execution", async () => {
    let parsedRequest: SymbolSearchRequest | undefined;
    const registered = registerTool(symbolSearchTool, {
      searchSymbols: ({ request }) => {
        parsedRequest = request;
        return {
          symbols: {
            query: request.query,
            repo_root: request.repo_root ?? "/fixture",
            snapshot_id: request.snapshot_id ?? "snapshot-1",
            symbols: [],
            next_actions: []
          },
          meta: meta()
        };
      }
    });

    expect(registered.name).toBe("symbol_search");
    const response = await registered.handler({ query: "Runner" });

    expect(parsedRequest).toMatchObject({
      query: "Runner",
      repo_root: "/repo",
      exact: false,
      languages: [],
      max_results: 20,
      source_byte_limit: 0
    });
    expect(parsedRequest?.snapshot_id).toBeUndefined();

    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: SearchSymbolsResult["symbols"];
    };
    expect(parsed.data.query).toBe("Runner");
  });

  it("blocks explicit repo_root overrides for graph query tools in normal mode", async () => {
    let parsedRequest: SymbolSearchRequest | undefined;
    const registered = registerTool(symbolSearchTool, {
      searchSymbols: ({ request }) => {
        parsedRequest = request;
        return {
          symbols: {
            query: request.query,
            repo_root: request.repo_root ?? "missing-default",
            snapshot_id: "snapshot-1",
            symbols: [],
            next_actions: []
          },
          meta: meta()
        };
      }
    });

    const response = await registered.handler({
      query: "Runner",
      repo_root: "/other/repo"
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      errors: Array<{ code: string; message: string }>;
    };

    expect(parsedRequest).toBeUndefined();
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        code: "invalid_input",
        message: expect.stringContaining("repo_root override is blocked")
      })
    ]);
  });

  it("allows explicit repo_root overrides for graph query tools in debug mode", async () => {
    let parsedRequest: SymbolSearchRequest | undefined;
    const registered = registerTool(symbolSearchTool, {
      rootAuthorityPolicy: createRootAuthorityPolicy({
        launchRoot: "/repo",
        debugRepoRootOverride: true
      }),
      searchSymbols: ({ request }) => {
        parsedRequest = request;
        return {
          symbols: {
            query: request.query,
            repo_root: request.repo_root ?? "missing-default",
            snapshot_id: "snapshot-1",
            symbols: [],
            next_actions: []
          },
          meta: meta()
        };
      }
    });

    await registered.handler({
      query: "Runner",
      repo_root: "/other/repo"
    });

    expect(parsedRequest?.repo_root).toBe("/other/repo");
  });

  it("returns structured invalid input for find_references before provider execution", async () => {
    let providerCalled = false;
    const registered = registerTool(findReferencesTool, {
      findReferences: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const response = await registered.handler({ node_id: 42 } as unknown as { node_id: unknown });
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

  it("returns structured invalid input for impact before provider execution", async () => {
    let providerCalled = false;
    const registered = registerTool(impactTool, {
      computeImpact: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const response = await registered.handler({ node_id: "", max_depth: "2" } as unknown as { node_id: unknown });
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
      "docs_current_for_task",
      "docs_outline",
      "docs_read_section",
      "docs_scope",
      "docs_search",
      "find_references",
      "impact",
      "preview_workspace_edit",
      "symbol_search",
      "verification_plan"
    ]);
  });
});

function meta() {
  return {
    analysis_validity: "valid" as const,
    freshness: "fresh" as const,
    scope: {
      repo_root: "/fixture",
      indexed_roots: ["."],
      skipped_roots: [],
      languages: ["python"]
    },
    capability_level: "partial_semantic" as const,
    evidence_kinds: ["parser" as const],
    verification_status: "needed" as const,
    truncated: false
  };
}
