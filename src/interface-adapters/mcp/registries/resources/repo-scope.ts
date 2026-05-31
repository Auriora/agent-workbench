import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZodError } from "zod";
import {
  buildInvalidRepoScopeInputEnvelope,
  buildRepoScopeEnvelope
} from "../../../../presentation/repo-scope-presenter.js";
import type { McpResourceDeclaration } from "../index.js";
import { parseRepoStatusArguments } from "../../arguments/repo-status.js";

export const repoScopeResource: McpResourceDeclaration = {
  kind: "resource",
  name: "scope",
  uri: "repo:///scope",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Scans bounded repository file catalog evidence; no source mutation.",
    description: "Indexed roots, skipped roots, language counts, capability counts, and generated/vendor scope.",
    parameters: [
      {
        name: "repo_root",
        description: "Optional repository root. Defaults to the MCP server repo root.",
        required: false
      }
    ],
    returns: "ResponseEnvelope<RepoScope>"
  },
  register(server: McpServer, context) {
    server.resource("scope", "repo:///scope", async (request: unknown) => {
      let args;
      try {
        args = parseRepoStatusArguments(getRepoResourceArgumentInput(request));
      } catch (error) {
        const message =
          error instanceof ZodError
            ? error.issues.map((issue) => issue.message).join("; ")
            : "Invalid scope resource arguments.";
        const envelope = buildInvalidRepoScopeInputEnvelope({
          repoRoot: context.repoRoot,
          message
        });
        return {
          contents: [
            {
              uri: "repo:///scope",
              mimeType: "application/json",
              text: JSON.stringify(envelope, null, 2)
            }
          ]
        };
      }

      if (context.getRepoScope === undefined) {
        const envelope = buildInvalidRepoScopeInputEnvelope({
          repoRoot: context.repoRoot,
          message: "repo:///scope provider is not configured."
        });
        return {
          contents: [
            {
              uri: "repo:///scope",
              mimeType: "application/json",
              text: JSON.stringify(envelope, null, 2)
            }
          ]
        };
      }

      const result = await context.getRepoScope({ repo_root: args.repo_root ?? context.repoRoot });
      const envelope = buildRepoScopeEnvelope(result);

      return {
        contents: [
          {
            uri: "repo:///scope",
            mimeType: "application/json",
            text: JSON.stringify(envelope, null, 2)
          }
        ]
      };
    });
  }
};

function getRepoResourceArgumentInput(request: unknown): unknown {
  if (typeof request !== "object" || request === null) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(request, "repo_root")) {
    return {
      repo_root: (request as { repo_root?: unknown }).repo_root
    };
  }

  return undefined;
}
