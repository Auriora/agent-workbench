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
  classifiedFailureEnvelope,
  classifyGraphQueryError,
  registerMcpToolWithEnvelope
} from "../../envelope.js";
import type { McpToolDeclaration } from "../index.js";

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
    registerMcpToolWithEnvelope({
      server,
      context,
      name: "symbol_search",
      description: "Search indexed graph symbols with bounded row and optional source-byte budgets.",
      rawShape: symbolSearchRawShape,
      schema: symbolSearchRequestSchema,
      invalidInputMessage: "Invalid symbol_search arguments.",
      getProvider: (registryContext) => registryContext.searchSymbols,
      buildFailureEnvelope: (input) => classifiedFailureEnvelope(
        buildInvalidSymbolSearchInputEnvelope({
          repoRoot: input.repoRoot,
          message: input.message
        }),
        input
      ),
      invoke: ({ provider, request }) => provider({ request }),
      present: buildSymbolSearchEnvelope,
      classifyError: classifyGraphQueryError
    });
  }
};
