import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZodError, z } from "zod";
import {
  symbolSearchRequestSchema,
  type SymbolSearchRequest
} from "../../../../contracts/index.js";
import {
  buildInvalidSymbolSearchInputEnvelope,
  buildSymbolSearchEnvelope
} from "../../../../presentation/symbol-search-presenter.js";
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
  register(server: McpServer, context) {
    server.tool(
      "symbol_search",
      "Search indexed graph symbols with bounded row and optional source-byte budgets.",
      symbolSearchRawShape,
      async (args: unknown) => {
        let request: SymbolSearchRequest;
        try {
          request = symbolSearchRequestSchema.parse(args);
        } catch (error) {
          const message = error instanceof ZodError ? error.issues.map((issue) => issue.message).join("; ") : "Invalid symbol_search arguments.";
          return textResponse(buildInvalidSymbolSearchInputEnvelope({ repoRoot: context.repoRoot, message }));
        }

        if (context.searchSymbols === undefined) {
          return textResponse(buildInvalidSymbolSearchInputEnvelope({
            repoRoot: context.repoRoot,
            message: "symbol_search provider is not configured."
          }));
        }

        return textResponse(buildSymbolSearchEnvelope(await context.searchSymbols({ request })));
      }
    );
  }
};

function textResponse(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
  };
}
