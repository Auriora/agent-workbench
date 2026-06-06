import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  docsSearchRequestSchema,
  type DocsSearchRequest
} from "../../../../contracts/index.js";
import {
  buildDocsSearchEnvelope,
  buildInvalidDocsSearchInputEnvelope
} from "../../../../presentation/docs-presenter.js";
import {
  formatMcpArgumentError,
  parseMcpArguments
} from "../../arguments/index.js";
import type { McpToolDeclaration } from "../index.js";
import { withDefaultRepoRoot } from "../repo-root-default.js";

const docsSearchRawShape = {
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  query: z.string().min(1).describe("Documentation search query."),
  max_results: z.number().int().positive().max(50).default(10).describe("Maximum ranked docs hits to return."),
  include_snippets: z.boolean().default(true).describe("Whether to include bounded snippets when safe.")
};

export const docsSearchTool: McpToolDeclaration = {
  kind: "tool",
  name: "docs_search",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded by max_results and snippet limits; scans Markdown docs without source mutation.",
    description: "Search repository docs by path, title, heading, and bounded text snippets.",
    parameters: [
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "query", description: "Documentation search query.", required: true },
      { name: "max_results", description: "Maximum ranked docs hits to return.", required: false },
      { name: "include_snippets", description: "Whether to include bounded snippets when safe.", required: false }
    ],
    returns: "ResponseEnvelope<DocsSearchResult>"
  },
  register(server: McpServer, context) {
    server.tool(
      "docs_search",
      "Search repository docs by path, title, heading, and bounded text snippets.",
      docsSearchRawShape,
      async (args: unknown) => {
        let request: DocsSearchRequest;
        try {
          request = parseMcpArguments(docsSearchRequestSchema, args);
        } catch (error) {
          const envelope = buildInvalidDocsSearchInputEnvelope({
            repoRoot: context.repoRoot,
            query: readQuery(args),
            message: formatMcpArgumentError(error, "Invalid docs_search arguments.")
          });
          return textToolResponse(envelope);
        }

        if (context.searchDocs === undefined) {
          const envelope = buildInvalidDocsSearchInputEnvelope({
            repoRoot: context.repoRoot,
            query: request.query,
            message: "docs_search provider is not configured."
          });
          return textToolResponse(envelope);
        }

        const result = await context.searchDocs({
          request: withDefaultRepoRoot(request, context.repoRoot)
        });
        return textToolResponse(buildDocsSearchEnvelope(result));
      }
    );
  }
};

function readQuery(args: unknown): string | undefined {
  if (typeof args !== "object" || args === null) {
    return undefined;
  }
  const value = (args as { query?: unknown }).query;
  return typeof value === "string" ? value : undefined;
}

function textToolResponse(envelope: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(envelope, null, 2)
      }
    ]
  };
}
