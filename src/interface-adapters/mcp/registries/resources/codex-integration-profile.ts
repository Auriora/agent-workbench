import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describeCodexIntegrationProfile } from "../../../../application/use-cases/describe-codex-integration-profile.js";
import { buildCodexIntegrationProfileEnvelope } from "../../../../presentation/integration-profile-presenter.js";
import type { McpResourceDeclaration } from "../index.js";

export const codexIntegrationProfileResource: McpResourceDeclaration = {
  kind: "resource",
  name: "codex-integration-profile",
  uri: "integration:///profiles/codex",
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
