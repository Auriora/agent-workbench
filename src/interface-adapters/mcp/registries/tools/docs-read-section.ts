/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  docsReadSectionRequestSchema,
  type DocsReadSectionRequest
} from "../../../../contracts/index.js";
import {
  buildDocsReadSectionEnvelope,
  buildInvalidDocsReadSectionInputEnvelope
} from "../../../../presentation/docs-presenter.js";
import {
  formatMcpArgumentError,
  parseMcpArguments
} from "../../arguments/index.js";
import type { McpToolDeclaration } from "../index.js";
import { withDefaultRepoRoot } from "../repo-root-default.js";

const docsReadSectionRawShape = {
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  path: z.string().min(1).describe("Repo-relative Markdown document path."),
  heading_id: z.string().min(1).describe("Stable heading identifier returned by docs_outline."),
  max_bytes: z.number().int().positive().max(12000).default(4000).describe("Maximum section bytes to return.")
};

export const docsReadSectionTool: McpToolDeclaration = {
  kind: "tool",
  name: "docs_read_section",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded by max_bytes for one Markdown section; reads no generated/vendor paths.",
    description: "Read one bounded Markdown section by repo-relative path and stable heading identifier.",
    parameters: [
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "path", description: "Repo-relative Markdown document path.", required: true },
      { name: "heading_id", description: "Stable heading identifier returned by docs_outline.", required: true },
      { name: "max_bytes", description: "Maximum section bytes to return.", required: false }
    ],
    returns: "ResponseEnvelope<DocsReadSectionResult>"
  },
  register(server: McpServer, context) {
    server.tool(
      "docs_read_section",
      "Read one bounded Markdown section by repo-relative path and stable heading identifier.",
      docsReadSectionRawShape,
      async (args: unknown) => {
        let request: DocsReadSectionRequest;
        try {
          request = parseMcpArguments(docsReadSectionRequestSchema, args);
        } catch (error) {
          const envelope = buildInvalidDocsReadSectionInputEnvelope({
            repoRoot: context.repoRoot,
            path: readString(args, "path"),
            headingId: readString(args, "heading_id"),
            message: formatMcpArgumentError(error, "Invalid docs_read_section arguments.")
          });
          return textToolResponse(envelope);
        }

        if (context.readDocsSection === undefined) {
          const envelope = buildInvalidDocsReadSectionInputEnvelope({
            repoRoot: context.repoRoot,
            path: request.path,
            headingId: request.heading_id,
            message: "docs_read_section provider is not configured."
          });
          return textToolResponse(envelope);
        }

        const result = await context.readDocsSection({
          request: withDefaultRepoRoot(request, context.repoRoot)
        });
        return textToolResponse(buildDocsReadSectionEnvelope(result));
      }
    );
  }
};

function readString(args: unknown, key: "path" | "heading_id"): string | undefined {
  if (typeof args !== "object" || args === null) {
    return undefined;
  }
  const value = (args as Record<string, unknown>)[key];
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
