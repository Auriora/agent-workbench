/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  docsCurrentForTaskRequestSchema,
  type DocsCurrentForTaskRequest
} from "../../../../contracts/index.js";
import {
  buildDocsCurrentForTaskEnvelope,
  buildInvalidDocsCurrentForTaskInputEnvelope
} from "../../../../presentation/docs-presenter.js";
import {
  formatMcpArgumentError,
  parseMcpArguments
} from "../../arguments/index.js";
import { requestWithSessionDocsScope } from "../docs-session-scope.js";
import type { McpToolDeclaration } from "../index.js";
import {
  mcpShapeForRootAuthority,
  resolveMcpRequestRepoRoot
} from "../root-authority.js";

const docsCurrentForTaskRawShape = {
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  task: z.string().min(1).describe("Task to verify current documentation for."),
  files: z.array(z.string()).default([]).describe("Known repo-relative files or docs relevant to the task."),
  scope_path: z.string().min(1).optional().describe("Optional repo-relative docs scope prefix."),
  max_docs: z.number().int().positive().max(50).default(10).describe("Maximum docs per category to return.")
};

export const docsCurrentForTaskTool: McpToolDeclaration = {
  kind: "tool",
  name: "docs_current_for_task",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded by optional scope_path, max_docs, and local Markdown scan; does not mutate source or require Git history.",
    description: "Identify current, supporting, non-authoritative, and uncertain docs for a task.",
    parameters: [
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "task", description: "Task to verify current documentation for.", required: true },
      { name: "files", description: "Known repo-relative files or docs relevant to the task.", required: false },
      { name: "scope_path", description: "Optional repo-relative docs scope prefix.", required: false },
      { name: "max_docs", description: "Maximum docs per category to return.", required: false }
    ],
    returns: "ResponseEnvelope<DocsCurrentForTaskResult>"
  },
  register(server: McpServer, context) {
    server.tool(
      "docs_current_for_task",
      "Identify current, supporting, non-authoritative, and uncertain docs for a task.",
      mcpShapeForRootAuthority(docsCurrentForTaskRawShape, context),
      async (args: unknown) => {
        let request: DocsCurrentForTaskRequest;
        try {
          request = parseMcpArguments(docsCurrentForTaskRequestSchema, args);
        } catch (error) {
          const envelope = buildInvalidDocsCurrentForTaskInputEnvelope({
            repoRoot: context.repoRoot,
            task: readTask(args),
            message: formatMcpArgumentError(error, "Invalid docs_current_for_task arguments.")
          });
          return textToolResponse(envelope);
        }

        const rootDecision = resolveMcpRequestRepoRoot(request, context);
        if (!rootDecision.ok) {
          const envelope = buildInvalidDocsCurrentForTaskInputEnvelope({
            repoRoot: rootDecision.repoRoot,
            task: request.task,
            message: rootDecision.message
          });
          return textToolResponse(envelope);
        }

        if (context.getCurrentDocsForTask === undefined) {
          const envelope = buildInvalidDocsCurrentForTaskInputEnvelope({
            repoRoot: context.repoRoot,
            task: request.task,
            message: "docs_current_for_task provider is not configured."
          });
          return textToolResponse(envelope);
        }

        const scopedRequest = requestWithSessionDocsScope(
          rootDecision.request,
          context.docsSessionScope
        );
        const result = await context.getCurrentDocsForTask({
          request: scopedRequest
        });
        return textToolResponse(buildDocsCurrentForTaskEnvelope(result));
      }
    );
  }
};

function readTask(args: unknown): string | undefined {
  if (typeof args !== "object" || args === null) {
    return undefined;
  }
  const value = (args as { task?: unknown }).task;
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
