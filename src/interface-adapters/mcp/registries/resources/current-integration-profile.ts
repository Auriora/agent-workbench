/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildCurrentIntegrationProfileEnvelope } from "../../../../presentation/integration-profile-presenter.js";
import type { McpResourceDeclaration } from "../index.js";

export const currentIntegrationProfileResource: McpResourceDeclaration = {
  kind: "resource",
  name: "current-integration-profile",
  uri: "integration:///profiles/current",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded connection identity and registered MCP metadata only.",
    description: "Effective Agent Workbench provider profile for this MCP connection.",
    parameters: [],
    returns: "ResponseEnvelope<CurrentIntegrationProfile>"
  },
  register(server: McpServer, context) {
    server.resource("current-integration-profile", "integration:///profiles/current", async () => {
      if (context.describeCurrentIntegrationProfile === undefined) {
        throw new Error("Current integration profile provider is not configured.");
      }
      const envelope = buildCurrentIntegrationProfileEnvelope(
        context.describeCurrentIntegrationProfile()
      );
      return {
        contents: [{
          uri: "integration:///profiles/current",
          mimeType: "application/json",
          text: JSON.stringify(envelope, null, 2)
        }]
      };
    });
  }
};
