/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { docsMapRequestSchema } from "../../../../contracts/index.js";
import {
  buildDocsMapEnvelope,
  buildDocsMapProviderFailureEnvelope,
  buildInvalidDocsMapInputEnvelope
} from "../../../../presentation/docs-presenter.js";
import { requestWithSessionDocsScope } from "../docs-session-scope.js";
import type { McpResourceDeclaration } from "../index.js";
import { resolveMcpRequestRepoRoot } from "../root-authority.js";
import { providerFailureMessage } from "./provider-failure.js";

export const DOCS_MAP_RESOURCE_MAX_SERIALIZED_BYTES = 32_768;

export const docsMapResource: McpResourceDeclaration = {
  kind: "resource",
  name: "docs-map",
  uri: "repo:///docs/map",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded to a fixed JSON envelope no larger than 32768 UTF-8 bytes using safe defaults; use the docs_map tool for cursor or scope continuation.",
    description: "Static bounded documentation map for the current repo root and session docs_scope. Use docs_map when you need cursor paging, a narrower scope_path, or different sample sizes.",
    parameters: [],
    returns: "ResponseEnvelope<DocsMap>"
  },
  register(server: McpServer, context) {
    server.resource("docs-map", "repo:///docs/map", async () => {
      const rootDecision = resolveMcpRequestRepoRoot(docsMapRequestSchema.parse({}), context);
      if (!rootDecision.ok) {
        const envelope = buildInvalidDocsMapInputEnvelope({
          repoRoot: rootDecision.repoRoot,
          message: rootDecision.message
        });
        return docsResourceResponse("repo:///docs/map", envelope);
      }

      if (context.getDocsMap === undefined) {
        const envelope = buildDocsMapProviderFailureEnvelope({
          repoRoot: context.repoRoot,
          message: "repo:///docs/map provider is not configured."
        });
        return docsResourceResponse("repo:///docs/map", envelope);
      }

      const scopedRequest = requestWithSessionDocsScope(
        rootDecision.request,
        context.docsSessionScope
      );
      let envelope;
      try {
        const result = await context.getDocsMap({
          request: scopedRequest
        });
        envelope = buildDocsMapEnvelope(result);
      } catch (error) {
        envelope = buildDocsMapProviderFailureEnvelope({
          repoRoot: rootDecision.request.repo_root ?? context.repoRoot,
          message: providerFailureMessage("repo:///docs/map", error)
        });
      }
      return docsResourceResponse("repo:///docs/map", envelope);
    });
  }
};

function docsResourceResponse(uri: string, envelope: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(envelope)
      }
    ]
  };
}
