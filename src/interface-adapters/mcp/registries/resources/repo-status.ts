import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZodError } from "zod";
import { getColdRepoStatus } from "../../../../application/use-cases/get-repo-status.js";
import {
  buildInvalidStatusInputEnvelope,
  buildStatusEnvelope
} from "../../../../presentation/status-presenter.js";
import type { McpResourceDeclaration } from "../index.js";
import { parseRepoStatusArguments } from "../../arguments/repo-status.js";

export const repoStatusResource: McpResourceDeclaration = {
  kind: "resource",
  name: "status",
  uri: "repo:///status",
  register(server: McpServer, context) {
    server.resource("status", "repo:///status", async (request: unknown) => {
      let args;
      try {
        args = parseRepoStatusArguments(
          typeof request === "object" && request !== null ? request : undefined
        );
      } catch (error) {
        const message = error instanceof ZodError ? error.issues.map((issue) => issue.message).join("; ") : "Invalid status resource arguments.";
        const envelope = buildInvalidStatusInputEnvelope({
          repoRoot: context.repoRoot,
          message
        });
        return {
          contents: [
            {
              uri: "repo:///status",
              mimeType: "application/json",
              text: JSON.stringify(envelope, null, 2)
            }
          ]
        };
      }
      const repoRoot = args.repo_root ?? context.repoRoot;
      const result = await (context.getRepoStatus?.({ repo_root: repoRoot }) ?? getColdRepoStatus(repoRoot));
      const envelope = buildStatusEnvelope(result);

      return {
        contents: [
          {
            uri: "repo:///status",
            mimeType: "application/json",
            text: JSON.stringify(envelope, null, 2)
          }
        ]
      };
    });
  }
};
