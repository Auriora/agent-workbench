/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  integrationHealthRequestSchema,
  type IntegrationHealthRequest
} from "../../../../contracts/index.js";
import {
  buildIntegrationHealthEnvelope,
  buildIntegrationHealthProviderFailureEnvelope,
  buildInvalidIntegrationHealthInputEnvelope
} from "../../../../presentation/integration-health-presenter.js";
import {
  formatMcpArgumentError,
  parseMcpArguments
} from "../../arguments/index.js";
import type { McpResourceDeclaration } from "../index.js";
import {
  resolveMcpRequestRepoRoot
} from "../root-authority.js";
import { providerFailureMessage } from "./provider-failure.js";

export const integrationHealthResource: McpResourceDeclaration = {
  kind: "resource",
  name: "integration-health",
  uri: "integration:///health/agent-workbench",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded registry/profile/session metadata; no tool execution and no source mutation.",
    description: "Compact Agent Workbench MCP integration health with configured, registered, discovered, and callable states.",
    parameters: [
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "client", description: "Optional client name that supplied discovery evidence.", required: false },
      { name: "discovery_state", description: "Whether caller discovery evidence was provided or is unknown.", required: false },
      { name: "discovered_tools", description: "Tool names discovered by the active client session.", required: false },
      { name: "discovered_resources", description: "Resource URIs discovered by the active client session.", required: false },
      { name: "discovered_prompts", description: "Prompt names discovered by the active client session.", required: false }
    ],
    returns: "ResponseEnvelope<IntegrationHealth>"
  },
  register(server: McpServer, context) {
    server.resource("integration-health", "integration:///health/agent-workbench", async (request: unknown) => {
      let parsedRequest: IntegrationHealthRequest;
      try {
        parsedRequest = parseMcpArguments(
          integrationHealthRequestSchema,
          getIntegrationHealthArgumentInput(request)
        );
      } catch (error) {
        const envelope = buildInvalidIntegrationHealthInputEnvelope({
          repoRoot: context.repoRoot,
          message: formatMcpArgumentError(error, "Invalid integration health resource arguments.")
        });
        return integrationHealthResourceResponse(envelope);
      }

      const rootDecision = resolveMcpRequestRepoRoot(parsedRequest, context);
      if (!rootDecision.ok) {
        const envelope = buildInvalidIntegrationHealthInputEnvelope({
          repoRoot: rootDecision.repoRoot,
          message: rootDecision.message
        });
        return integrationHealthResourceResponse(envelope);
      }

      if (context.getIntegrationHealth === undefined) {
        const envelope = buildIntegrationHealthProviderFailureEnvelope({
          repoRoot: context.repoRoot,
          message: "integration:///health/agent-workbench provider is not configured."
        });
        return integrationHealthResourceResponse(envelope);
      }

      let envelope;
      try {
        const result = await context.getIntegrationHealth({
          request: rootDecision.request
        });
        envelope = buildIntegrationHealthEnvelope(result);
      } catch (error) {
        envelope = buildIntegrationHealthProviderFailureEnvelope({
          repoRoot: rootDecision.request.repo_root ?? context.repoRoot,
          message: providerFailureMessage("integration:///health/agent-workbench", error)
        });
      }
      return integrationHealthResourceResponse(envelope);
    });
  }
};

function getIntegrationHealthArgumentInput(request: unknown): unknown {
  if (typeof request !== "object" || request === null) {
    return undefined;
  }

  const input = request as Record<string, unknown>;
  return {
    repo_root: input.repo_root,
    client: input.client,
    discovery_state: input.discovery_state,
    discovered_tools: input.discovered_tools,
    discovered_resources: input.discovered_resources,
    discovered_prompts: input.discovered_prompts
  };
}

function integrationHealthResourceResponse(envelope: unknown) {
  return {
    contents: [
      {
        uri: "integration:///health/agent-workbench",
        mimeType: "application/json",
        text: JSON.stringify(envelope, null, 2)
      }
    ]
  };
}
