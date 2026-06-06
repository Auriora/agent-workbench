import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  docsOutlineRequestSchema,
  type DocsOutlineRequest
} from "../../../../contracts/index.js";
import {
  buildDocsOutlineEnvelope,
  buildInvalidDocsOutlineInputEnvelope
} from "../../../../presentation/docs-presenter.js";
import {
  formatMcpArgumentError,
  parseMcpArguments
} from "../../arguments/index.js";
import type { McpToolDeclaration } from "../index.js";
import { withDefaultRepoRoot } from "../repo-root-default.js";

const docsOutlineRawShape = {
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  path: z.string().min(1).describe("Repo-relative Markdown document path.")
};

export const docsOutlineTool: McpToolDeclaration = {
  kind: "tool",
  name: "docs_outline",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded heading outline for one Markdown document; reads no generated/vendor paths.",
    description: "Read a bounded heading outline for one repo-relative Markdown document.",
    parameters: [
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "path", description: "Repo-relative Markdown document path.", required: true }
    ],
    returns: "ResponseEnvelope<DocsOutlineResult>"
  },
  register(server: McpServer, context) {
    server.tool(
      "docs_outline",
      "Read a bounded heading outline for one repo-relative Markdown document.",
      docsOutlineRawShape,
      async (args: unknown) => {
        let request: DocsOutlineRequest;
        try {
          request = parseMcpArguments(docsOutlineRequestSchema, args);
        } catch (error) {
          const envelope = buildInvalidDocsOutlineInputEnvelope({
            repoRoot: context.repoRoot,
            path: readPath(args),
            message: formatMcpArgumentError(error, "Invalid docs_outline arguments.")
          });
          return textToolResponse(envelope);
        }

        if (context.getDocsOutline === undefined) {
          const envelope = buildInvalidDocsOutlineInputEnvelope({
            repoRoot: context.repoRoot,
            path: request.path,
            message: "docs_outline provider is not configured."
          });
          return textToolResponse(envelope);
        }

        const result = await context.getDocsOutline({
          request: withDefaultRepoRoot(request, context.repoRoot)
        });
        return textToolResponse(buildDocsOutlineEnvelope(result));
      }
    );
  }
};

function readPath(args: unknown): string | undefined {
  if (typeof args !== "object" || args === null) {
    return undefined;
  }
  const value = (args as { path?: unknown }).path;
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
