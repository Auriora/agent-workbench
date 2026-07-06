/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  docsOutlineRequestSchema,
  type DocsOutlineRequest
} from "../../../../contracts/index.js";
import {
  buildDocsOutlineEnvelope,
  buildInvalidDocsOutlineInputEnvelope
} from "../../../../presentation/docs-presenter.js";
import {
  formatMcpArgumentError,
  parseMcpArguments
} from "../../arguments/index.js";
import type { McpToolDeclaration } from "../index.js";
import {
  mcpShapeForRootAuthority,
  resolveMcpRequestRepoRoot
} from "../root-authority.js";

const docsOutlineRawShape = {
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  path: z.string().min(1).describe("Repo-relative Markdown document path returned by docs_search or known from the task.")
};

const docsOutlineDescription = "Use this after choosing a Markdown document, usually from docs_search, to get stable heading_id values before docs_read_section. It returns a bounded heading outline only, not full document text.";

export const docsOutlineTool: McpToolDeclaration = {
  kind: "tool",
  name: "docs_outline",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded heading outline for one Markdown document; reads no generated/vendor paths.",
    description: docsOutlineDescription,
    parameters: [
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "path", description: "Repo-relative Markdown document path returned by docs_search or known from the task.", required: true }
    ],
    returns: "ResponseEnvelope<DocsOutlineResult>"
  },
  register(server: McpServer, context) {
    server.tool(
      "docs_outline",
      docsOutlineDescription,
      mcpShapeForRootAuthority(docsOutlineRawShape, context),
      async (args: unknown) => {
        let request: DocsOutlineRequest;
        try {
          request = parseMcpArguments(docsOutlineRequestSchema, args);
        } catch (error) {
          const envelope = buildInvalidDocsOutlineInputEnvelope({
            repoRoot: context.repoRoot,
            path: readPath(args),
            message: formatMcpArgumentError(error, "Invalid docs_outline arguments.")
          });
          return textToolResponse(envelope);
        }

        const rootDecision = resolveMcpRequestRepoRoot(request, context);
        if (!rootDecision.ok) {
          const envelope = buildInvalidDocsOutlineInputEnvelope({
            repoRoot: rootDecision.repoRoot,
            path: request.path,
            message: rootDecision.message
          });
          return textToolResponse(envelope);
        }

        if (context.getDocsOutline === undefined) {
          const envelope = buildInvalidDocsOutlineInputEnvelope({
            repoRoot: context.repoRoot,
            path: request.path,
            message: "docs_outline provider is not configured."
          });
          return textToolResponse(envelope);
        }

        const result = await context.getDocsOutline({
          request: rootDecision.request
        });
        return textToolResponse(buildDocsOutlineEnvelope(result));
      }
    );
  }
};

function readPath(args: unknown): string | undefined {
  if (typeof args !== "object" || args === null) {
    return undefined;
  }
  const value = (args as { path?: unknown }).path;
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
