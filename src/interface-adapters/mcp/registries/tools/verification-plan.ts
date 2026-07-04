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
  classifiedFailureEnvelope,
  classifyVerificationPlanError,
  registerMcpToolWithEnvelope
} from "../../envelope.js";
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
    registerMcpToolWithEnvelope({
      server,
      context,
      name: "verification_plan",
      description: "Plan validation commands and quiet static feedback without executing commands.",
      rawShape: verificationPlanRawShape,
      schema: verificationPlanRequestSchema,
      invalidInputMessage: "Invalid verification_plan arguments.",
      getProvider: (registryContext) => registryContext.planVerification,
      buildFailureEnvelope: (input) => classifiedFailureEnvelope(
        buildInvalidVerificationPlanInputEnvelope({
          repoRoot: input.repoRoot,
          message: input.message
        }),
        input
      ),
      invoke: ({ provider, request }) => provider({ request }),
      present: buildVerificationPlanEnvelope,
      classifyError: classifyVerificationPlanError
    });
  }
};
