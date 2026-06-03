import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { impactRequestSchema, type ImpactRequest } from "../../../../contracts/index.js";
import {
  buildImpactEnvelope,
  buildInvalidImpactInputEnvelope
} from "../../../../presentation/impact-presenter.js";
import {
  formatMcpArgumentError,
  parseMcpArguments
} from "../../arguments/index.js";
import type { McpToolDeclaration } from "../index.js";

const impactRawShape = {
  node_id: z.string().describe("Indexed graph node id to start bounded impact traversal from."),
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  snapshot_id: z.string().optional().describe("Optional snapshot id. Defaults to the latest snapshot for the repository."),
  max_depth: z.number().int().positive().max(5).default(2).describe("Maximum traversal depth."),
  max_nodes: z.number().int().positive().max(200).default(50).describe("Maximum graph nodes to return."),
  direction: z.enum(["incoming", "outgoing", "both"]).default("both").describe("Traversal direction.")
};

export const impactTool: McpToolDeclaration = {
  kind: "tool",
  name: "impact",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded by max_depth and max_nodes.",
    description: "Compute bounded graph impact for an indexed symbol without broad source scans.",
    parameters: [
      { name: "node_id", description: "Indexed graph node id to start bounded traversal from.", required: true },
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "snapshot_id", description: "Optional snapshot id. Defaults to latest snapshot for the repository.", required: false },
      { name: "max_depth", description: "Maximum traversal depth.", required: false },
      { name: "max_nodes", description: "Maximum graph nodes to return.", required: false },
      { name: "direction", description: "Traversal direction.", required: false }
    ],
    returns: "ResponseEnvelope<ImpactResult>"
  },
  register(server: McpServer, context) {
    server.tool(
      "impact",
      "Compute bounded graph impact for an indexed symbol without broad source scans.",
      impactRawShape,
      async (args: unknown) => {
        let request: ImpactRequest;
        try {
          request = parseMcpArguments(impactRequestSchema, args);
        } catch (error) {
          const message = formatMcpArgumentError(error, "Invalid impact arguments.");
          return textResponse(buildInvalidImpactInputEnvelope({ repoRoot: context.repoRoot, message }));
        }

        if (context.computeImpact === undefined) {
          return textResponse(buildInvalidImpactInputEnvelope({
            repoRoot: context.repoRoot,
            message: "impact provider is not configured."
          }));
        }

        return textResponse(buildImpactEnvelope(await context.computeImpact({ request })));
      }
    );
  }
};

function textResponse(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
  };
}
