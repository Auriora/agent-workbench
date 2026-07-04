/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  symbolSearchRequestSchema,
  type SymbolSearchRequest
} from "../../../../contracts/index.js";
import {
  buildInvalidSymbolSearchInputEnvelope,
  buildSymbolSearchEnvelope
} from "../../../../presentation/symbol-search-presenter.js";
import {
  formatMcpArgumentError,
  parseMcpArguments
} from "../../arguments/index.js";
import type { McpToolDeclaration } from "../index.js";
import { withDefaultRepoRoot } from "../repo-root-default.js";

const symbolSearchRawShape = {
  query: z.string().min(1).describe("Symbol name or text to search for in the indexed graph."),
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  snapshot_id: z.string().optional().describe("Optional snapshot id. Defaults to the latest snapshot for the repository."),
  exact: z.boolean().default(false).describe("When true, match exact symbol names only."),
  languages: z.array(z.string()).default([]).describe("Optional language filters, for example python."),
  max_results: z.number().int().positive().max(100).default(20).describe("Maximum symbol rows to return."),
  source_byte_limit: z.number().int().nonnegative().max(2000).default(0).describe("Maximum source bytes per symbol; zero omits source text.")
};

export const symbolSearchTool: McpToolDeclaration = {
  kind: "tool",
  name: "symbol_search",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded by max_results and source_byte_limit.",
    description: "Search indexed graph symbols with bounded row and optional source-byte budgets.",
    parameters: [
      { name: "query", description: "Symbol name or text to search for in the indexed graph.", required: true },
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "snapshot_id", description: "Optional snapshot id. Defaults to latest snapshot for the repository.", required: false },
      { name: "exact", description: "When true, match exact symbol names only.", required: false },
      { name: "languages", description: "Optional language filters.", required: false },
      { name: "max_results", description: "Maximum symbol rows to return.", required: false },
      { name: "source_byte_limit", description: "Maximum source bytes per symbol; zero omits source text.", required: false }
    ],
    returns: "ResponseEnvelope<SymbolSearchResult>"
  },
  register(server: McpServer, context) {
    server.tool(
      "symbol_search",
      "Search indexed graph symbols with bounded row and optional source-byte budgets.",
      symbolSearchRawShape,
      async (args: unknown) => {
        let request: SymbolSearchRequest;
        try {
          request = parseMcpArguments(symbolSearchRequestSchema, args);
        } catch (error) {
          const message = formatMcpArgumentError(error, "Invalid symbol_search arguments.");
          return textResponse(buildInvalidSymbolSearchInputEnvelope({ repoRoot: context.repoRoot, message }));
        }

        if (context.searchSymbols === undefined) {
          return textResponse(buildInvalidSymbolSearchInputEnvelope({
            repoRoot: context.repoRoot,
            message: "symbol_search provider is not configured."
          }));
        }

        return textResponse(buildSymbolSearchEnvelope(await context.searchSymbols({
          request: withDefaultRepoRoot(request, context.repoRoot)
        })));
      }
    );
  }
};

function textResponse(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
  };
}
