/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  taskContextRequestSchema,
  type TaskContextRequest
} from "../../../../contracts/index.js";
import {
  buildInvalidTaskContextInputEnvelope,
  buildTaskContextEnvelope
} from "../../../../presentation/task-context-presenter.js";
import {
  classifiedFailureEnvelope,
  registerMcpToolWithEnvelope
} from "../../envelope.js";
import type { McpToolDeclaration } from "../index.js";

const contextForTaskRawShape = {
  task: z.string().min(1).describe("Describe the implementation, review, debugging, or planning task that needs repository context."),
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  files: z.array(z.string()).default([]).describe("Known repo-relative files to seed routing; omit when the task starts from only a description."),
  symbols: z.array(z.string()).default([]).describe("Known symbols, types, functions, commands, or identifiers to seed graph and docs routing."),
  lifecycle_context: taskContextRequestSchema.shape.lifecycle_context.describe(
    "Optional caller-supplied spec-lifecycle-manager context to consume before broad repository search."
  ),
  max_files: z.number().int().positive().max(50).default(10).describe("Maximum related file candidates to return before doing broader local file reads."),
  max_docs: z.number().int().positive().max(20).default(5).describe("Maximum governing documentation files to return for the task.")
};

const contextForTaskDescription = "Use this before broad file reads, edits, or code review. Provide the task plus any known files or symbols; it returns bounded routing evidence, likely files, governing docs, risks, and suggested next Agent Workbench calls without mutating files.";

export const contextForTaskTool: McpToolDeclaration = {
  kind: "tool",
  name: "context_for_task",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded by max_files and max_docs; scans local file catalog only.",
    description: contextForTaskDescription,
    parameters: [
      { name: "task", description: "Implementation, review, debugging, or planning task that needs repository context.", required: true },
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "files", description: "Known repo-relative files to seed routing when available.", required: false },
      { name: "symbols", description: "Known symbols, types, functions, commands, or identifiers to seed routing.", required: false },
      { name: "lifecycle_context", description: "Optional caller-supplied spec-lifecycle-manager context.", required: false },
      { name: "max_files", description: "Maximum related file candidates to return before broader local file reads.", required: false },
      { name: "max_docs", description: "Maximum governing documentation files to return for the task.", required: false }
    ],
    returns: "ResponseEnvelope<TaskContext>"
  },
  register(server: McpServer, context) {
    registerMcpToolWithEnvelope({
      server,
      context,
      name: "context_for_task",
      description: contextForTaskDescription,
      rawShape: contextForTaskRawShape,
      schema: taskContextRequestSchema,
      invalidInputMessage: "Invalid context_for_task arguments.",
      getProvider: (registryContext) => registryContext.getTaskContext,
      buildFailureEnvelope: (input) => classifiedFailureEnvelope(
        buildInvalidTaskContextInputEnvelope({
          repoRoot: input.repoRoot,
          message: input.message
        }),
        input
      ),
      invoke: ({ provider, request }) => provider({ request }),
      present: buildTaskContextEnvelope
    });
  }
};
