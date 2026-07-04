/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  docsOverviewRequestSchema,
  type DocsOverviewRequest
} from "../../../../contracts/index.js";
import {
  buildDocsOverviewEnvelope,
  buildInvalidDocsOverviewInputEnvelope
} from "../../../../presentation/docs-presenter.js";
import {
  formatMcpArgumentError,
  parseMcpArguments
} from "../../arguments/index.js";
import { requestWithSessionDocsScope } from "../docs-session-scope.js";
import type { McpResourceDeclaration } from "../index.js";
import { resolveMcpRequestRepoRoot } from "../root-authority.js";

export const docsOverviewResource: McpResourceDeclaration = {
  kind: "resource",
  name: "docs-overview",
  uri: "repo:///docs/overview",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded by optional scope_path, max_docs, and max_headings_per_doc; scans Markdown docs without source mutation.",
    description: "Compact docs overview with important docs, headings, warnings, truncation, and direct-read caveats.",
    parameters: [
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "scope_path", description: "Optional repo-relative docs scope prefix, for example one docs/specs package.", required: false },
      { name: "max_docs", description: "Maximum important docs to return.", required: false },
      { name: "max_headings_per_doc", description: "Maximum headings to return per document.", required: false },
      { name: "cursor", description: "Opaque cursor returned by a previous truncated docs overview page.", required: false }
    ],
    returns: "ResponseEnvelope<DocsOverview>"
  },
  register(server: McpServer, context) {
    server.resource("docs-overview", "repo:///docs/overview", async (request: unknown) => {
      let parsedRequest: DocsOverviewRequest;
      try {
        parsedRequest = parseMcpArguments(
          docsOverviewRequestSchema,
          getDocsResourceArgumentInput(request)
        );
      } catch (error) {
        const envelope = buildInvalidDocsOverviewInputEnvelope({
          repoRoot: context.repoRoot,
          message: formatMcpArgumentError(error, "Invalid docs overview resource arguments.")
        });
        return docsResourceResponse("repo:///docs/overview", envelope);
      }

      const rootDecision = resolveMcpRequestRepoRoot(parsedRequest, context);
      if (!rootDecision.ok) {
        const envelope = buildInvalidDocsOverviewInputEnvelope({
          repoRoot: rootDecision.repoRoot,
          message: rootDecision.message
        });
        return docsResourceResponse("repo:///docs/overview", envelope);
      }

      if (context.getDocsOverview === undefined) {
        const envelope = buildInvalidDocsOverviewInputEnvelope({
          repoRoot: context.repoRoot,
          message: "repo:///docs/overview provider is not configured."
        });
        return docsResourceResponse("repo:///docs/overview", envelope);
      }

      const scopedRequest = requestWithSessionDocsScope(
        rootDecision.request,
        context.docsSessionScope
      );
      const result = await context.getDocsOverview({
        request: scopedRequest
      });
      return docsResourceResponse("repo:///docs/overview", buildDocsOverviewEnvelope(result));
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
