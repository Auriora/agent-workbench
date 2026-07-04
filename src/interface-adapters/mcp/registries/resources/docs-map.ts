/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  docsMapRequestSchema,
  type DocsMapRequest
} from "../../../../contracts/index.js";
import {
  buildDocsMapEnvelope,
  buildInvalidDocsMapInputEnvelope
} from "../../../../presentation/docs-presenter.js";
import {
  formatMcpArgumentError,
  parseMcpArguments
} from "../../arguments/index.js";
import { requestWithSessionDocsScope } from "../docs-session-scope.js";
import type { McpResourceDeclaration } from "../index.js";
import { withDefaultRepoRoot } from "../repo-root-default.js";

export const docsMapResource: McpResourceDeclaration = {
  kind: "resource",
  name: "docs-map",
  uri: "repo:///docs/map",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded by optional scope_path, max_docs, and max_headings_per_doc; scans Markdown docs without source mutation.",
    description: "Bounded repository documentation map with paths, headings, warnings, truncation, and direct-read caveats.",
    parameters: [
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "scope_path", description: "Optional repo-relative docs scope prefix, for example one docs/specs package.", required: false },
      { name: "max_docs", description: "Maximum docs to return.", required: false },
      { name: "max_headings_per_doc", description: "Maximum headings to return per document.", required: false },
      { name: "cursor", description: "Opaque cursor returned by a previous truncated docs map page.", required: false }
    ],
    returns: "ResponseEnvelope<DocsMap>"
  },
  register(server: McpServer, context) {
    server.resource("docs-map", "repo:///docs/map", async (request: unknown) => {
      let parsedRequest: DocsMapRequest;
      try {
        parsedRequest = parseMcpArguments(
          docsMapRequestSchema,
          getDocsResourceArgumentInput(request)
        );
      } catch (error) {
        const envelope = buildInvalidDocsMapInputEnvelope({
          repoRoot: context.repoRoot,
          message: formatMcpArgumentError(error, "Invalid docs map resource arguments.")
        });
        return docsResourceResponse("repo:///docs/map", envelope);
      }

      if (context.getDocsMap === undefined) {
        const envelope = buildInvalidDocsMapInputEnvelope({
          repoRoot: context.repoRoot,
          message: "repo:///docs/map provider is not configured."
        });
        return docsResourceResponse("repo:///docs/map", envelope);
      }

      const scopedRequest = requestWithSessionDocsScope(
        withDefaultRepoRoot(parsedRequest, context.repoRoot),
        context.docsSessionScope
      );
      const result = await context.getDocsMap({
        request: scopedRequest
      });
      return docsResourceResponse("repo:///docs/map", buildDocsMapEnvelope(result));
    });
  }
};

function getDocsResourceArgumentInput(request: unknown): unknown {
  if (typeof request !== "object" || request === null) {
    return undefined;
  }

  const input = request as Record<string, unknown>;
  return {
    repo_root: input.repo_root,
    scope_path: input.scope_path,
    max_docs: input.max_docs,
    max_headings_per_doc: input.max_headings_per_doc,
    cursor: input.cursor
  };
}

function docsResourceResponse(uri: string, envelope: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(envelope, null, 2)
      }
    ]
  };
}
