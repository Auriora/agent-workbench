/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

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
  classifiedFailureEnvelope,
  classifyWorkspaceEditError,
  registerMcpToolWithEnvelope
} from "../../envelope.js";
import type { McpToolDeclaration } from "../index.js";

const editFileShape = z.object({
  path: z.string().min(1).describe("Repo-relative file path from the matching preview_workspace_edit response."),
  replacement_text: z.string().describe("Full replacement file content exactly matching the preview hash.")
});

const applyWorkspaceEditRawShape = {
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  preview_token: z.string().min(1).describe("Unexpired preview token returned by preview_workspace_edit for these exact edits."),
  edits: z.array(editFileShape).min(1).max(20).describe("One to twenty full-file replacement edits matching the preview paths and hashes.")
};

const applyWorkspaceEditDescription = "Use only after preview_workspace_edit. Provide the preview_token and identical full-file replacements; it mutates files only when the token, paths, hashes, and workspace-safety checks still match.";

export const applyWorkspaceEditTool: McpToolDeclaration = {
  kind: "tool",
  name: "apply_workspace_edit",
  metadata: {
    capability_class: "workspace_write",
    mutation_class: "workspace_write",
    budget_policy: "Bounded to 20 full-file replacement edits and requires a matching preview token.",
    description: applyWorkspaceEditDescription,
    parameters: [
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "preview_token", description: "Unexpired preview token returned by preview_workspace_edit for these exact edits.", required: true },
      { name: "edits", description: "One to twenty full-file replacement edits matching the preview paths and hashes.", required: true }
    ],
    returns: "ResponseEnvelope<ApplyWorkspaceEditResult>"
  },
  register(server: McpServer, context) {
    registerMcpToolWithEnvelope({
      server,
      context,
      name: "apply_workspace_edit",
      description: applyWorkspaceEditDescription,
      rawShape: applyWorkspaceEditRawShape,
      schema: applyWorkspaceEditRequestSchema,
      invalidInputMessage: "Invalid apply_workspace_edit arguments.",
      getProvider: (registryContext) => registryContext.applyWorkspaceEdit,
      buildFailureEnvelope: (input) => classifiedFailureEnvelope(
        buildInvalidApplyWorkspaceEditInputEnvelope({
          repoRoot: input.repoRoot,
          message: input.message
        }),
        input
      ),
      invoke: ({ provider, request }) => provider({ request }),
      present: buildApplyWorkspaceEditEnvelope,
      classifyError: classifyWorkspaceEditError
    });
  }
};
