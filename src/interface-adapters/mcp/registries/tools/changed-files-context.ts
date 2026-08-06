/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  changedFilesContextRequestSchema,
  type ChangedFilesContextRequest
} from "../../../../contracts/index.js";
import {
  buildChangedFilesContextEnvelope,
  buildInvalidChangedFilesContextInputEnvelope
} from "../../../../presentation/changed-files-context-presenter.js";
import {
  classifiedFailureEnvelope,
  registerMcpToolWithEnvelope
} from "../../envelope.js";
import type { McpToolDeclaration } from "../index.js";

const changedFilesContextRawShape = {
  task: z.string().max(2_000).optional().describe("Optional task summary for validation planning."),
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server launch root."),
  files: z.array(z.string()).max(50).default([]).describe("Optional repo-relative files to merge with Git-discovered changes."),
  lifecycle_context: z.object({
    source: z.string().min(1).max(100).optional(),
    state: z.enum(["provided", "unavailable", "unknown"]),
    summary: z.string().min(1).max(2_000)
  }).strict().optional().describe("Caller-supplied observational lifecycle context; never mutates lifecycle state."),
  max_files: z.number().int().positive().max(50).default(20).describe("Maximum changed files retained in the packet."),
  max_commands: z.number().int().positive().max(20).default(10).describe("Maximum commands planned but never executed.")
};

const description = "Use this as the first read-only post-edit or pre-handoff Workbench action. It discovers bounded Git changes and joins repository status, diagnostics, and validation planning without executing commands or mutating lifecycle state.";

export const changedFilesContextTool: McpToolDeclaration = {
  kind: "tool",
  name: "changed_files_context",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded by max_files, max_commands, Git command limits, and existing provider budgets; never executes planned commands.",
    description,
    parameters: [
      { name: "task", description: "Optional task summary for validation planning.", required: false },
      { name: "repo_root", description: "Optional repository root; launch-root authority applies.", required: false },
      { name: "files", description: "Optional repo-relative files merged with Git-discovered changes.", required: false },
      { name: "lifecycle_context", description: "Optional caller-supplied observational lifecycle context.", required: false },
      { name: "max_files", description: "Maximum changed files returned.", required: false },
      { name: "max_commands", description: "Maximum validation commands planned, never executed.", required: false }
    ],
    returns: "ResponseEnvelope<ChangedFilesContextResult>"
  },
  register(server: McpServer, context) {
    registerMcpToolWithEnvelope({
      server,
      context,
      name: "changed_files_context",
      description,
      rawShape: changedFilesContextRawShape,
      schema: changedFilesContextRequestSchema,
      invalidInputMessage: "Invalid changed_files_context arguments.",
      getProvider: (registryContext) => registryContext.getChangedFilesContext,
      buildFailureEnvelope: (input) => classifiedFailureEnvelope(
        buildInvalidChangedFilesContextInputEnvelope({ repoRoot: input.repoRoot, message: input.message }),
        input
      ),
      invoke: ({ provider, request }) => provider({ request }),
      present: buildChangedFilesContextEnvelope
    });
  }
};
