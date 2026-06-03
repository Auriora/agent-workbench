import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  findReferencesRequestSchema,
  type FindReferencesRequest
} from "../../../../contracts/index.js";
import {
  buildFindReferencesEnvelope,
  buildInvalidFindReferencesInputEnvelope
} from "../../../../presentation/find-references-presenter.js";
import {
  formatMcpArgumentError,
  parseMcpArguments
} from "../../arguments/index.js";
import type { McpToolDeclaration } from "../index.js";

const findReferencesRawShape = {
  node_id: z.string().optional().describe("Indexed graph node id to inspect."),
  symbol: z.string().optional().describe("Exact symbol name to resolve before finding references."),
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  snapshot_id: z.string().optional().describe("Optional snapshot id. Defaults to the latest snapshot for the repository."),
  max_depth: z.number().int().positive().max(5).default(1).describe("Maximum reference depth to inspect."),
  max_results: z.number().int().positive().max(100).default(50).describe("Maximum reference rows to return.")
};

export const findReferencesTool: McpToolDeclaration = {
  kind: "tool",
  name: "find_references",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded by max_depth and max_results.",
    description: "Find resolved and unresolved references for an indexed graph node or exact symbol.",
    parameters: [
      { name: "node_id", description: "Indexed graph node id to inspect.", required: false },
      { name: "symbol", description: "Exact symbol name to resolve before finding references.", required: false },
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "snapshot_id", description: "Optional snapshot id. Defaults to latest snapshot for the repository.", required: false },
      { name: "max_depth", description: "Maximum reference depth to inspect.", required: false },
      { name: "max_results", description: "Maximum reference rows to return.", required: false }
    ],
    returns: "ResponseEnvelope<FindReferencesResult>"
  },
  register(server: McpServer, context) {
    server.tool(
      "find_references",
      "Find resolved and unresolved references for an indexed graph node or exact symbol.",
      findReferencesRawShape,
      async (args: unknown) => {
        let request: FindReferencesRequest;
        try {
          request = parseMcpArguments(findReferencesRequestSchema, args);
        } catch (error) {
          const message = formatMcpArgumentError(error, "Invalid find_references arguments.");
          return textResponse(buildInvalidFindReferencesInputEnvelope({ repoRoot: context.repoRoot, message }));
        }

        if (context.findReferences === undefined) {
          return textResponse(buildInvalidFindReferencesInputEnvelope({
            repoRoot: context.repoRoot,
            message: "find_references provider is not configured."
          }));
        }

        return textResponse(buildFindReferencesEnvelope(await context.findReferences({ request })));
      }
    );
  }
};

function textResponse(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
  };
}
