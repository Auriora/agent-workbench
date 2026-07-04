/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  docsSearchRequestSchema,
  type DocsSearchRequest
} from "../../../../contracts/index.js";
import {
  buildDocsSearchEnvelope,
  buildInvalidDocsSearchInputEnvelope
} from "../../../../presentation/docs-presenter.js";
import {
  formatMcpArgumentError,
  parseMcpArguments
} from "../../arguments/index.js";
import { requestWithSessionDocsScope } from "../docs-session-scope.js";
import type { McpToolDeclaration } from "../index.js";
import {
  mcpShapeForRootAuthority,
  resolveMcpRequestRepoRoot
} from "../root-authority.js";

const docsSearchRawShape = {
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  scope_path: z.string().min(1).optional().describe("Optional repo-relative docs scope prefix, such as docs/specs/032-per-repo-runtime-daemon-cache."),
  query: z.string().min(1).describe("Documentation search query."),
  max_results: z.number().int().positive().max(50).default(10).describe("Maximum ranked docs hits to return."),
  include_snippets: z.boolean().default(true).describe("Whether to include bounded snippets when safe."),
  cursor: z.string().optional().describe("Opaque cursor returned by a previous truncated docs search page.")
};

export const docsSearchTool: McpToolDeclaration = {
  kind: "tool",
  name: "docs_search",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded by optional scope_path, max_results, and snippet limits; scans Markdown docs without source mutation.",
    description: "Search repository docs by path, title, heading, and bounded text snippets.",
    parameters: [
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "scope_path", description: "Optional repo-relative docs scope prefix, for example one docs/specs package.", required: false },
      { name: "query", description: "Documentation search query.", required: true },
      { name: "max_results", description: "Maximum ranked docs hits to return.", required: false },
      { name: "include_snippets", description: "Whether to include bounded snippets when safe.", required: false },
      { name: "cursor", description: "Opaque cursor returned by a previous truncated docs search page.", required: false }
    ],
    returns: "ResponseEnvelope<DocsSearchResult>"
  },
  register(server: McpServer, context) {
    server.tool(
      "docs_search",
      "Search repository docs by path, title, heading, and bounded text snippets.",
      mcpShapeForRootAuthority(docsSearchRawShape, context),
      async (args: unknown) => {
        let request: DocsSearchRequest;
        try {
          request = parseMcpArguments(docsSearchRequestSchema, args);
        } catch (error) {
          const envelope = buildInvalidDocsSearchInputEnvelope({
            repoRoot: context.repoRoot,
            query: readQuery(args),
            message: formatMcpArgumentError(error, "Invalid docs_search arguments.")
          });
          return textToolResponse(envelope);
        }

        const rootDecision = resolveMcpRequestRepoRoot(request, context);
        if (!rootDecision.ok) {
          const envelope = buildInvalidDocsSearchInputEnvelope({
            repoRoot: rootDecision.repoRoot,
            query: request.query,
            message: rootDecision.message
          });
          return textToolResponse(envelope);
        }

        if (context.searchDocs === undefined) {
          const envelope = buildInvalidDocsSearchInputEnvelope({
            repoRoot: context.repoRoot,
            query: request.query,
            message: "docs_search provider is not configured."
          });
          return textToolResponse(envelope);
        }

        const scopedRequest = requestWithSessionDocsScope(
          rootDecision.request,
          context.docsSessionScope
        );
        const result = await context.searchDocs({
          request: scopedRequest
        });
        return textToolResponse(buildDocsSearchEnvelope(result));
      }
    );
  }
};

function readQuery(args: unknown): string | undefined {
  if (typeof args !== "object" || args === null) {
    return undefined;
  }
  const value = (args as { query?: unknown }).query;
  return typeof value === "string" ? value : undefined;
}

function textToolResponse(envelope: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(envelope, null, 2)
      }
    ]
  };
}
