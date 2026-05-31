import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZodError, z } from "zod";
import {
  findReferencesRequestSchema,
  type FindReferencesRequest
} from "../../../../contracts/index.js";
import {
  buildFindReferencesEnvelope,
  buildInvalidFindReferencesInputEnvelope
} from "../../../../presentation/find-references-presenter.js";
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
  register(server: McpServer, context) {
    server.tool(
      "find_references",
      "Find resolved and unresolved references for an indexed graph node or exact symbol.",
      findReferencesRawShape,
      async (args: unknown) => {
        let request: FindReferencesRequest;
        try {
          request = findReferencesRequestSchema.parse(args);
        } catch (error) {
          const message = error instanceof ZodError ? error.issues.map((issue) => issue.message).join("; ") : "Invalid find_references arguments.";
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
