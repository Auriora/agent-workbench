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
  formatMcpArgumentError,
  parseMcpArguments
} from "../../arguments/index.js";
import type { McpToolDeclaration } from "../index.js";
import { withDefaultRepoRoot } from "../repo-root-default.js";

const contextForTaskRawShape = {
  task: z.string().min(1).describe("The implementation, review, or planning task to gather context for."),
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  files: z.array(z.string()).default([]).describe("Known repo-relative files relevant to the task."),
  symbols: z.array(z.string()).default([]).describe("Known symbols or identifiers relevant to the task."),
  lifecycle_context: taskContextRequestSchema.shape.lifecycle_context.describe(
    "Optional caller-supplied spec-lifecycle-manager context to consume before broad repository search."
  ),
  max_files: z.number().int().positive().max(50).default(10).describe("Maximum related file candidates to return."),
  max_docs: z.number().int().positive().max(20).default(5).describe("Maximum governing documentation files to return.")
};

export const contextForTaskTool: McpToolDeclaration = {
  kind: "tool",
  name: "context_for_task",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded by max_files and max_docs; scans local file catalog only.",
    description: "Gather compact task context from local repository evidence before editing.",
    parameters: [
      { name: "task", description: "Implementation, review, or planning task to gather context for.", required: true },
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "files", description: "Known repo-relative files relevant to the task.", required: false },
      { name: "symbols", description: "Known symbols or identifiers relevant to the task.", required: false },
      { name: "lifecycle_context", description: "Optional caller-supplied spec-lifecycle-manager context.", required: false },
      { name: "max_files", description: "Maximum related file candidates to return.", required: false },
      { name: "max_docs", description: "Maximum governing documentation files to return.", required: false }
    ],
    returns: "ResponseEnvelope<TaskContext>"
  },
  register(server: McpServer, context) {
    server.tool(
      "context_for_task",
      "Gather compact task context from local repository evidence before editing.",
      contextForTaskRawShape,
      async (args: unknown) => {
        let request: TaskContextRequest;
        try {
          request = parseMcpArguments(taskContextRequestSchema, args);
        } catch (error) {
          const message = formatMcpArgumentError(
            error,
            "Invalid context_for_task arguments."
          );
          const envelope = buildInvalidTaskContextInputEnvelope({
            repoRoot: context.repoRoot,
            message
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(envelope, null, 2)
              }
            ]
          };
        }

        if (context.getTaskContext === undefined) {
          const envelope = buildInvalidTaskContextInputEnvelope({
            repoRoot: context.repoRoot,
            message: "context_for_task provider is not configured."
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(envelope, null, 2)
              }
            ]
          };
        }

        const result = await context.getTaskContext({
          request: withDefaultRepoRoot(request, context.repoRoot)
        });
        const envelope = buildTaskContextEnvelope(result);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(envelope, null, 2)
            }
          ]
        };
      }
    );
  }
};
