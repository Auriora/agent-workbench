import { describe, expect, it } from "vitest";
import type {
  SymbolSearchRequest
} from "../../src/contracts/index.js";
import type { ComputeImpactResult } from "../../src/application/use-cases/compute-impact.js";
import type { FindReferencesUseCaseResult } from "../../src/application/use-cases/find-references.js";
import type { SearchSymbolsResult } from "../../src/application/use-cases/search-symbols.js";
import type { McpRegistryContext, McpToolDeclaration } from "../../src/interface-adapters/mcp/registries/index.js";
import { findReferencesTool } from "../../src/interface-adapters/mcp/registries/tools/find-references.js";
import { impactTool } from "../../src/interface-adapters/mcp/registries/tools/impact.js";
import { symbolSearchTool } from "../../src/interface-adapters/mcp/registries/tools/symbol-search.js";
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

  it("preserves explicit repo_root overrides for graph query tools", async () => {
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
    }) as unknown as {
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

function registerTool(
  tool: McpToolDeclaration,
  context: Partial<McpRegistryContext>
): RegisteredTool {
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
  tool.register(server as never, { repoRoot: "/repo", ...context });
  if (!registered) {
    throw new Error("tool did not register");
  }
  return registered;
}

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
