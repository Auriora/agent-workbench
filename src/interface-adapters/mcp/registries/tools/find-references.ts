/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  findReferencesRequestSchema,
  type FindReferencesRequest
} from "../../../../contracts/index.js";
import {
  buildFindReferencesEnvelope,
  buildInvalidFindReferencesInputEnvelope
} from "../../../../presentation/find-references-presenter.js";
import {
  formatMcpArgumentError,
  parseMcpArguments
} from "../../arguments/index.js";
import type { McpToolDeclaration } from "../index.js";
import {
  mcpShapeForRootAuthority,
  resolveMcpRequestRepoRoot
} from "../root-authority.js";

const findReferencesRawShape = {
  node_id: z.string().optional().describe("Indexed graph node id from symbol_search, context_for_task, or a previous graph result."),
  symbol: z.string().optional().describe("Exact symbol name to resolve before finding references when node_id is not known."),
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  snapshot_id: z.string().optional().describe("Optional snapshot id. Defaults to the latest snapshot for the repository."),
  max_depth: z.number().int().positive().max(5).default(1).describe("Maximum reference depth to inspect; start with 1 for direct references."),
  max_results: z.number().int().positive().max(100).default(50).describe("Maximum reference rows to return on this page."),
  cursor: z.string().optional().describe("Opaque cursor returned by a previous truncated find_references page.")
};

const findReferencesDescription = "Use this after symbol_search or context_for_task provides a node_id, or when an exact symbol name is known. It returns bounded resolved and unresolved references with cursor pagination for truncated pages.";

export const findReferencesTool: McpToolDeclaration = {
  kind: "tool",
  name: "find_references",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded by max_depth and max_results.",
    description: findReferencesDescription,
    parameters: [
      { name: "node_id", description: "Indexed graph node id from symbol_search, context_for_task, or a previous graph result.", required: false },
      { name: "symbol", description: "Exact symbol name to resolve before finding references when node_id is not known.", required: false },
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "snapshot_id", description: "Optional snapshot id. Defaults to latest snapshot for the repository.", required: false },
      { name: "max_depth", description: "Maximum reference depth to inspect; start with 1 for direct references.", required: false },
      { name: "max_results", description: "Maximum reference rows to return on this page.", required: false },
      { name: "cursor", description: "Opaque cursor returned by a previous truncated find_references page.", required: false }
    ],
    returns: "ResponseEnvelope<FindReferencesResult>"
  },
  register(server: McpServer, context) {
    server.tool(
      "find_references",
      findReferencesDescription,
      mcpShapeForRootAuthority(findReferencesRawShape, context),
      async (args: unknown) => {
        let request: FindReferencesRequest;
        try {
          request = parseMcpArguments(findReferencesRequestSchema, args);
        } catch (error) {
          const message = formatMcpArgumentError(error, "Invalid find_references arguments.");
          return textResponse(buildInvalidFindReferencesInputEnvelope({ repoRoot: context.repoRoot, message }));
        }

        const rootDecision = resolveMcpRequestRepoRoot(request, context);
        if (!rootDecision.ok) {
          return textResponse(buildInvalidFindReferencesInputEnvelope({
            repoRoot: rootDecision.repoRoot,
            message: rootDecision.message
          }));
        }

        if (context.findReferences === undefined) {
          return textResponse(buildInvalidFindReferencesInputEnvelope({
            repoRoot: context.repoRoot,
            message: "find_references provider is not configured."
          }));
        }

        return textResponse(buildFindReferencesEnvelope(await context.findReferences({
          request: rootDecision.request
        })));
      }
    );
  }
};

function textResponse(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
  };
}
