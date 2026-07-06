/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  previewWorkspaceEditRequestSchema,
  type PreviewWorkspaceEditRequest
} from "../../../../contracts/index.js";
import {
  buildInvalidPreviewWorkspaceEditInputEnvelope,
  buildPreviewWorkspaceEditEnvelope
} from "../../../../presentation/workspace-edit-presenter.js";
import {
  classifiedFailureEnvelope,
  classifyWorkspaceEditError,
  registerMcpToolWithEnvelope
} from "../../envelope.js";
import type { McpToolDeclaration } from "../index.js";

const editFileShape = z.object({
  path: z.string().min(1).describe("Repo-relative file path to replace during preview and later apply."),
  replacement_text: z.string().describe("Full replacement file content; partial patches are not accepted by this tool.")
});

const previewWorkspaceEditRawShape = {
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  edits: z.array(editFileShape).min(1).max(20).describe("One to twenty full-file replacement edits to validate and stage as a preview."),
  expires_in_ms: z.number().int().positive().max(3_600_000).default(600_000).describe("Preview token TTL in milliseconds; defaults to ten minutes and cannot exceed one hour.")
};

const previewWorkspaceEditDescription = "Use this before apply_workspace_edit to validate bounded full-file replacements. It does not mutate files; keep the returned preview_token and pass identical replacement text to apply_workspace_edit.";

export const previewWorkspaceEditTool: McpToolDeclaration = {
  kind: "tool",
  name: "preview_workspace_edit",
  metadata: {
    capability_class: "workspace_write",
    mutation_class: "planning",
    budget_policy: "Bounded to 20 full-file replacement edits and token TTL <= 1 hour; preview does not mutate files.",
    description: previewWorkspaceEditDescription,
    parameters: [
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "edits", description: "One to twenty full-file replacement edits to validate and stage as a preview.", required: true },
      { name: "expires_in_ms", description: "Preview token TTL in milliseconds; defaults to ten minutes and cannot exceed one hour.", required: false }
    ],
    returns: "ResponseEnvelope<PreviewWorkspaceEditResult>"
  },
  register(server: McpServer, context) {
    registerMcpToolWithEnvelope({
      server,
      context,
      name: "preview_workspace_edit",
      description: previewWorkspaceEditDescription,
      rawShape: previewWorkspaceEditRawShape,
      schema: previewWorkspaceEditRequestSchema,
      invalidInputMessage: "Invalid preview_workspace_edit arguments.",
      getProvider: (registryContext) => registryContext.previewWorkspaceEdit,
      buildFailureEnvelope: (input) => classifiedFailureEnvelope(
        buildInvalidPreviewWorkspaceEditInputEnvelope({
          repoRoot: input.repoRoot,
          message: input.message
        }),
        input
      ),
      invoke: ({ provider, request }) => provider({ request }),
      present: buildPreviewWorkspaceEditEnvelope,
      classifyError: classifyWorkspaceEditError
    });
  }
};
