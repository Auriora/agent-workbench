/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describeCodexIntegrationProfile } from "../../../../application/use-cases/describe-codex-integration-profile.js";
import { buildCodexIntegrationProfileEnvelope } from "../../../../presentation/integration-profile-presenter.js";
import type { McpResourceDeclaration } from "../index.js";

export const codexIntegrationProfileResource: McpResourceDeclaration = {
  kind: "resource",
  name: "codex-integration-profile",
  uri: "integration:///profiles/codex",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded static integration profile metadata; no repository scan.",
    description: "Codex feature, plugin, skill, hook, and update-path profile.",
    parameters: [],
    returns: "ResponseEnvelope<CodexIntegrationProfile>"
  },
  register(server: McpServer, context) {
    server.resource("codex-integration-profile", "integration:///profiles/codex", async () => {
      const profile = context.describeCodexIntegrationProfile?.() ?? describeCodexIntegrationProfile();
      const envelope = buildCodexIntegrationProfileEnvelope(profile);

      return {
        contents: [
          {
            uri: "integration:///profiles/codex",
            mimeType: "application/json",
            text: JSON.stringify(envelope, null, 2)
          }
        ]
      };
    });
  }
};
