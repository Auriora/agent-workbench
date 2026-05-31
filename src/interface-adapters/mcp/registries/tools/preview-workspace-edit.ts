import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZodError, z } from "zod";
import {
  previewWorkspaceEditRequestSchema,
  type PreviewWorkspaceEditRequest
} from "../../../../contracts/index.js";
import {
  buildInvalidPreviewWorkspaceEditInputEnvelope,
  buildPreviewWorkspaceEditEnvelope
} from "../../../../presentation/workspace-edit-presenter.js";
import type { McpToolDeclaration } from "../index.js";

const editFileShape = z.object({
  path: z.string().min(1).describe("Repo-relative file path to replace."),
  replacement_text: z.string().describe("Full replacement file content.")
});

const previewWorkspaceEditRawShape = {
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  edits: z.array(editFileShape).min(1).max(20).describe("Bounded full-file replacement edits to preview."),
  expires_in_ms: z.number().int().positive().max(3_600_000).default(600_000).describe("Preview token TTL in milliseconds.")
};

export const previewWorkspaceEditTool: McpToolDeclaration = {
  kind: "tool",
  name: "preview_workspace_edit",
  metadata: {
    capability_class: "workspace_write",
    mutation_class: "planning",
    budget_policy: "Bounded to 20 full-file replacement edits and token TTL <= 1 hour; preview does not mutate files.",
    description: "Preview bounded workspace edits and return a token without mutating files.",
    parameters: [
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "edits", description: "Bounded full-file replacement edits to preview.", required: true },
      { name: "expires_in_ms", description: "Preview token TTL in milliseconds.", required: false }
    ],
    returns: "ResponseEnvelope<PreviewWorkspaceEditResult>"
  },
  register(server: McpServer, context) {
    server.tool(
      "preview_workspace_edit",
      "Preview bounded workspace edits and return a token without mutating files.",
      previewWorkspaceEditRawShape,
      async (args: unknown) => {
        let request: PreviewWorkspaceEditRequest;
        try {
          request = previewWorkspaceEditRequestSchema.parse(args);
        } catch (error) {
          const message = error instanceof ZodError ? error.issues.map((issue) => issue.message).join("; ") : "Invalid preview_workspace_edit arguments.";
          return textResponse(buildInvalidPreviewWorkspaceEditInputEnvelope({ repoRoot: context.repoRoot, message }));
        }

        if (context.previewWorkspaceEdit === undefined) {
          return textResponse(buildInvalidPreviewWorkspaceEditInputEnvelope({
            repoRoot: context.repoRoot,
            message: "preview_workspace_edit provider is not configured."
          }));
        }

        try {
          return textResponse(buildPreviewWorkspaceEditEnvelope(await context.previewWorkspaceEdit({ request })));
        } catch (error) {
          return textResponse(buildInvalidPreviewWorkspaceEditInputEnvelope({
            repoRoot: context.repoRoot,
            message: error instanceof Error ? error.message : "preview_workspace_edit failed."
          }));
        }
      }
    );
  }
};

function textResponse(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
  };
}
