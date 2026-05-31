import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZodError } from "zod";
import {
  buildInvalidRepoOverviewInputEnvelope,
  buildRepoOverviewEnvelope
} from "../../../../presentation/repo-overview-presenter.js";
import type { McpResourceDeclaration } from "../index.js";
import { parseRepoStatusArguments } from "../../arguments/repo-status.js";

export const repoOverviewResource: McpResourceDeclaration = {
  kind: "resource",
  name: "overview",
  uri: "repo:///overview",
  register(server: McpServer, context) {
    server.resource("overview", "repo:///overview", async (request: unknown) => {
      let args;
      try {
        args = parseRepoStatusArguments(getRepoResourceArgumentInput(request));
      } catch (error) {
        const message =
          error instanceof ZodError
            ? error.issues.map((issue) => issue.message).join("; ")
            : "Invalid overview resource arguments.";
        const envelope = buildInvalidRepoOverviewInputEnvelope({
          repoRoot: context.repoRoot,
          message
        });
        return {
          contents: [
            {
              uri: "repo:///overview",
              mimeType: "application/json",
              text: JSON.stringify(envelope, null, 2)
            }
          ]
        };
      }

      if (context.getRepoOverview === undefined) {
        const envelope = buildInvalidRepoOverviewInputEnvelope({
          repoRoot: context.repoRoot,
          message: "repo:///overview provider is not configured."
        });
        return {
          contents: [
            {
              uri: "repo:///overview",
              mimeType: "application/json",
              text: JSON.stringify(envelope, null, 2)
            }
          ]
        };
      }

      const result = await context.getRepoOverview({
        repo_root: args.repo_root ?? context.repoRoot
      });
      const envelope = buildRepoOverviewEnvelope(result);

      return {
        contents: [
          {
            uri: "repo:///overview",
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
