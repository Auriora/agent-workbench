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
  task: z.string().optional().describe("Task or change summary to associate with the validation plan."),
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  files: z.array(z.string()).default([]).describe("Repo-relative files that should guide test, typecheck, lint, or docs validation planning."),
  changed_files: z.array(z.string()).default([]).describe("Repo-relative files already changed; used for optional quiet static feedback."),
  include_static_feedback: z.boolean().default(true).describe("When true, include actionable static feedback from configured providers when present."),
  max_commands: z.number().int().positive().max(20).default(10).describe("Maximum validation commands to plan; commands are suggested only and are not executed.")
};

const verificationPlanDescription = "Use this before running validation commands or after edits. Provide the task and relevant files; it plans bounded typecheck, test, lint, docs, or smoke commands and optional static feedback, but never executes commands.";

export const verificationPlanTool: McpToolDeclaration = {
  kind: "tool",
  name: "verification_plan",
  metadata: {
    capability_class: "planning",
    mutation_class: "planning",
    budget_policy: "Bounded by max_commands; never executes validation commands.",
    description: verificationPlanDescription,
    parameters: [
      { name: "task", description: "Task or change summary to associate with the validation plan.", required: false },
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "files", description: "Repo-relative files that should guide validation planning.", required: false },
      { name: "changed_files", description: "Repo-relative files already changed for optional static feedback.", required: false },
      { name: "include_static_feedback", description: "When true, include actionable static feedback when present.", required: false },
      { name: "max_commands", description: "Maximum validation commands to plan without executing them.", required: false }
    ],
    returns: "ResponseEnvelope<VerificationPlan>"
  },
  register(server: McpServer, context) {
    registerMcpToolWithEnvelope({
      server,
      context,
      name: "verification_plan",
      description: verificationPlanDescription,
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
