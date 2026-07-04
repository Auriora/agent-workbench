/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  verificationPlanRequestSchema,
  type VerificationPlanRequest
} from "../../../../contracts/index.js";
import {
  buildInvalidVerificationPlanInputEnvelope,
  buildVerificationPlanEnvelope
} from "../../../../presentation/verification-plan-presenter.js";
import {
  formatMcpArgumentError,
  parseMcpArguments
} from "../../arguments/index.js";
import type { McpToolDeclaration } from "../index.js";
import { withDefaultRepoRoot } from "../repo-root-default.js";

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
  metadata: {
    capability_class: "planning",
    mutation_class: "planning",
    budget_policy: "Bounded by max_commands; never executes validation commands.",
    description: "Plan validation commands and quiet static feedback without executing commands.",
    parameters: [
      { name: "task", description: "Optional task description for the validation plan.", required: false },
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "files", description: "Repo-relative files that should guide validation planning.", required: false },
      { name: "changed_files", description: "Repo-relative changed files for optional static feedback.", required: false },
      { name: "include_static_feedback", description: "Whether to include actionable static feedback when present.", required: false },
      { name: "max_commands", description: "Maximum planned commands to return.", required: false }
    ],
    returns: "ResponseEnvelope<VerificationPlan>"
  },
  register(server: McpServer, context) {
    server.tool(
      "verification_plan",
      "Plan validation commands and quiet static feedback without executing commands.",
      verificationPlanRawShape,
      async (args: unknown) => {
        let request: VerificationPlanRequest;
        try {
          request = parseMcpArguments(verificationPlanRequestSchema, args);
        } catch (error) {
          const message = formatMcpArgumentError(
            error,
            "Invalid verification_plan arguments."
          );
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

        let result;
        try {
          result = await context.planVerification({
            request: withDefaultRepoRoot(request, context.repoRoot)
          });
        } catch (error) {
          const envelope = buildInvalidVerificationPlanInputEnvelope({
            repoRoot: request.repo_root ?? context.repoRoot,
            message: `verification_plan provider failed before planning could complete: ${error instanceof Error ? error.message : String(error)}`
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
