import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZodError, z } from "zod";
import {
  taskContextRequestSchema,
  type TaskContextRequest
} from "../../../../contracts/index.js";
import {
  buildInvalidTaskContextInputEnvelope,
  buildTaskContextEnvelope
} from "../../../../presentation/task-context-presenter.js";
import type { McpToolDeclaration } from "../index.js";

const contextForTaskRawShape = {
  task: z.string().min(1).describe("The implementation, review, or planning task to gather context for."),
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  files: z.array(z.string()).default([]).describe("Known repo-relative files relevant to the task."),
  symbols: z.array(z.string()).default([]).describe("Known symbols or identifiers relevant to the task."),
  max_files: z.number().int().positive().max(50).default(10).describe("Maximum related file candidates to return."),
  max_docs: z.number().int().positive().max(20).default(5).describe("Maximum governing documentation files to return.")
};

export const contextForTaskTool: McpToolDeclaration = {
  kind: "tool",
  name: "context_for_task",
  register(server: McpServer, context) {
    server.tool(
      "context_for_task",
      "Gather compact task context from local repository evidence before editing.",
      contextForTaskRawShape,
      async (args: unknown) => {
        let request: TaskContextRequest;
        try {
          request = taskContextRequestSchema.parse(args);
        } catch (error) {
          const message =
            error instanceof ZodError
              ? error.issues.map((issue) => issue.message).join("; ")
              : "Invalid context_for_task arguments.";
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

        const result = await context.getTaskContext({ request });
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
