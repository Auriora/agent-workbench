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
  classifiedFailureEnvelope,
  registerMcpToolWithEnvelope
} from "../../envelope.js";
import { requestWithSessionDocsScope } from "../docs-session-scope.js";
import type { McpToolDeclaration } from "../index.js";

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
    registerMcpToolWithEnvelope({
      server,
      context,
      name: "docs_search",
      description: "Search repository docs by path, title, heading, and bounded text snippets.",
      rawShape: docsSearchRawShape,
      schema: docsSearchRequestSchema,
      invalidInputMessage: "Invalid docs_search arguments.",
      getProvider: (registryContext) => registryContext.searchDocs,
      buildFailureEnvelope: (input) => classifiedFailureEnvelope(
        buildInvalidDocsSearchInputEnvelope({
          repoRoot: input.repoRoot,
          query: input.request?.query ?? readQuery(input.args),
          message: input.message
        }),
        input
      ),
      invoke: ({ provider, request, context: registryContext }) => provider({
        request: requestWithSessionDocsScope(
          request,
          registryContext.docsSessionScope
        )
      }),
      present: buildDocsSearchEnvelope
    });
  }
};

function readQuery(args: unknown): string | undefined {
  if (typeof args !== "object" || args === null) {
    return undefined;
  }
  const value = (args as { query?: unknown }).query;
  return typeof value === "string" ? value : undefined;
}
