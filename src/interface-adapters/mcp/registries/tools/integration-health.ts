/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { integrationHealthRequestSchema } from "../../../../contracts/index.js";
import {
  buildIntegrationHealthEnvelope,
  buildIntegrationHealthProviderFailureEnvelope,
  buildInvalidIntegrationHealthInputEnvelope
} from "../../../../presentation/integration-health-presenter.js";
import {
  classifiedFailureEnvelope,
  registerMcpToolWithEnvelope
} from "../../envelope.js";
import type { McpToolDeclaration } from "../index.js";

const rawShape = {
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  client: z.string().max(200).optional().describe("Client label associated with the supplied discovery evidence."),
  discovery_state: z.enum(["provided", "unknown"]).default("unknown"),
  discovered_tools: z.array(z.string().max(300)).max(200).default([]),
  discovered_resources: z.array(z.string().max(500)).max(200).default([]),
  discovered_prompts: z.array(z.string().max(300)).max(200).default([])
};

export const integrationHealthTool: McpToolDeclaration = {
  kind: "tool",
  name: "integration_health",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded caller-supplied discovery lists and registered MCP metadata only.",
    description: "Use this to inspect integration health with optional caller-observed MCP discovery evidence; it reads registered and connection evidence and does not mutate files.",
    parameters: [
      { name: "repo_root", description: "Optional repository root.", required: false },
      { name: "client", description: "Client label for supplied discovery evidence.", required: false },
      { name: "discovery_state", description: "Whether caller discovery evidence is supplied.", required: false },
      { name: "discovered_tools", description: "Caller-discovered MCP tool names.", required: false },
      { name: "discovered_resources", description: "Caller-discovered MCP resource URIs.", required: false },
      { name: "discovered_prompts", description: "Caller-discovered MCP prompt names.", required: false }
    ],
    returns: "ResponseEnvelope<IntegrationHealth>"
  },
  register(server: McpServer, context) {
    registerMcpToolWithEnvelope({
      server,
      context,
      name: "integration_health",
      description: "Report integration health with validated caller discovery evidence.",
      rawShape,
      schema: integrationHealthRequestSchema,
      invalidInputMessage: "Invalid integration_health arguments.",
      getProvider: (registryContext) => registryContext.getIntegrationHealth,
      buildFailureEnvelope: (input) => {
        if (input.classification === "invalid_input") {
          return classifiedFailureEnvelope(
            buildInvalidIntegrationHealthInputEnvelope({
              repoRoot: input.repoRoot,
              message: input.message
            }),
            input
          );
        }
        const message = "Authoritative integration health is unavailable.";
        return classifiedFailureEnvelope(
          buildIntegrationHealthProviderFailureEnvelope({
            repoRoot: input.repoRoot,
            message
          }),
          { ...input, message }
        );
      },
      invoke: ({ provider, request, context: registryContext }) => provider({
        request,
        connection_identity: registryContext.getConnectionIdentity?.()
      }),
      present: buildIntegrationHealthEnvelope
    });
  }
};
