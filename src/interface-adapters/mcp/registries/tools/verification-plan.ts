import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZodError, z } from "zod";
import {
  verificationPlanRequestSchema,
  type VerificationPlanRequest
} from "../../../../contracts/index.js";
import {
  buildInvalidVerificationPlanInputEnvelope,
  buildVerificationPlanEnvelope
} from "../../../../presentation/verification-plan-presenter.js";
import type { McpToolDeclaration } from "../index.js";

const verificationPlanRawShape = {
  task: z.string().optional().describe("Optional task description to associate with the validation plan."),
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  files: z.array(z.string()).default([]).describe("Repo-relative files that should guide validation planning."),
  changed_files: z.array(z.string()).default([]).describe("Repo-relative changed files for optional static feedback."),
  include_static_feedback: z.boolean().default(true).describe("Whether to include actionable static feedback when present."),
  max_commands: z.number().int().positive().max(20).default(10).describe("Maximum planned commands to return.")
};

export const verificationPlanTool: McpToolDeclaration = {
  kind: "tool",
  name: "verification_plan",
  register(server: McpServer, context) {
    server.tool(
      "verification_plan",
      "Plan validation commands and quiet static feedback without executing commands.",
      verificationPlanRawShape,
      async (args: unknown) => {
        let request: VerificationPlanRequest;
        try {
          request = verificationPlanRequestSchema.parse(args);
        } catch (error) {
          const message =
            error instanceof ZodError
              ? error.issues.map((issue) => issue.message).join("; ")
              : "Invalid verification_plan arguments.";
          const envelope = buildInvalidVerificationPlanInputEnvelope({
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

        if (context.planVerification === undefined) {
          const envelope = buildInvalidVerificationPlanInputEnvelope({
            repoRoot: context.repoRoot,
            message: "verification_plan provider is not configured."
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

        const result = await context.planVerification({ request });
        const envelope = buildVerificationPlanEnvelope(result);
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
