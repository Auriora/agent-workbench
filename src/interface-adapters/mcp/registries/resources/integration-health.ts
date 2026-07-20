/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { integrationHealthRequestSchema } from "../../../../contracts/index.js";
import {
  buildIntegrationHealthEnvelope,
  buildIntegrationHealthProviderFailureEnvelope,
  buildInvalidIntegrationHealthInputEnvelope
} from "../../../../presentation/integration-health-presenter.js";
import type { McpResourceDeclaration } from "../index.js";
import {
  resolveMcpRequestRepoRoot
} from "../root-authority.js";

export const integrationHealthResource: McpResourceDeclaration = {
  kind: "resource",
  name: "integration-health",
  uri: "integration:///health/agent-workbench",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded registry/profile/session metadata; no tool execution and no source mutation.",
    description: "Compact Agent Workbench MCP integration health with configured, registered, discovered, and callable states.",
    parameters: [],
    returns: "ResponseEnvelope<IntegrationHealth>"
  },
  register(server: McpServer, context) {
    server.resource("integration-health", "integration:///health/agent-workbench", async () => {
      const rootDecision = resolveMcpRequestRepoRoot(integrationHealthRequestSchema.parse({}), context);
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
          request: rootDecision.request,
          connection_identity: context.getConnectionIdentity?.()
        });
        envelope = buildIntegrationHealthEnvelope(result);
      } catch {
        envelope = buildIntegrationHealthProviderFailureEnvelope({
          repoRoot: rootDecision.request.repo_root ?? context.repoRoot,
          message: "Authoritative integration health is unavailable."
        });
      }
      return integrationHealthResourceResponse(envelope);
    });
  }
};

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
