import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  applyWorkspaceEditRequestSchema,
  type ApplyWorkspaceEditRequest
} from "../../../../contracts/index.js";
import {
  buildApplyWorkspaceEditEnvelope,
  buildInvalidApplyWorkspaceEditInputEnvelope
} from "../../../../presentation/workspace-edit-presenter.js";
import {
  formatMcpArgumentError,
  parseMcpArguments
} from "../../arguments/index.js";
import type { McpToolDeclaration } from "../index.js";

const editFileShape = z.object({
  path: z.string().min(1).describe("Repo-relative file path from the preview."),
  replacement_text: z.string().describe("Full replacement file content matching the preview hash.")
});

const applyWorkspaceEditRawShape = {
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  preview_token: z.string().min(1).describe("Preview token returned by preview_workspace_edit."),
  edits: z.array(editFileShape).min(1).max(20).describe("Bounded full-file replacement edits matching the preview.")
};

export const applyWorkspaceEditTool: McpToolDeclaration = {
  kind: "tool",
  name: "apply_workspace_edit",
  metadata: {
    capability_class: "workspace_write",
    mutation_class: "workspace_write",
    budget_policy: "Bounded to 20 full-file replacement edits and requires a matching preview token.",
    description: "Apply a previously previewed bounded workspace edit after hash and safety checks.",
    parameters: [
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "preview_token", description: "Preview token returned by preview_workspace_edit.", required: true },
      { name: "edits", description: "Bounded full-file replacement edits matching the preview.", required: true }
    ],
    returns: "ResponseEnvelope<ApplyWorkspaceEditResult>"
  },
  register(server: McpServer, context) {
    server.tool(
      "apply_workspace_edit",
      "Apply a previously previewed bounded workspace edit after hash and safety checks.",
      applyWorkspaceEditRawShape,
      async (args: unknown) => {
        let request: ApplyWorkspaceEditRequest;
        try {
          request = parseMcpArguments(applyWorkspaceEditRequestSchema, args);
        } catch (error) {
          const message = formatMcpArgumentError(error, "Invalid apply_workspace_edit arguments.");
          return textResponse(buildInvalidApplyWorkspaceEditInputEnvelope({ repoRoot: context.repoRoot, message }));
        }

        if (context.applyWorkspaceEdit === undefined) {
          return textResponse(buildInvalidApplyWorkspaceEditInputEnvelope({
            repoRoot: context.repoRoot,
            message: "apply_workspace_edit provider is not configured."
          }));
        }

        try {
          return textResponse(buildApplyWorkspaceEditEnvelope(await context.applyWorkspaceEdit({ request })));
        } catch (error) {
          return textResponse(buildInvalidApplyWorkspaceEditInputEnvelope({
            repoRoot: context.repoRoot,
            message: error instanceof Error ? error.message : "apply_workspace_edit failed."
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
