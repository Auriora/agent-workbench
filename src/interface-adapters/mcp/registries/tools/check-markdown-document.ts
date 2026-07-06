/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  checkMarkdownDocumentRequestSchema,
  type CheckMarkdownDocumentRequest
} from "../../../../contracts/index.js";
import {
  buildCheckMarkdownDocumentEnvelope,
  buildInvalidCheckMarkdownDocumentInputEnvelope
} from "../../../../presentation/markdown-quality-presenter.js";
import {
  formatMcpArgumentError,
  parseMcpArguments
} from "../../arguments/index.js";
import type { McpToolDeclaration } from "../index.js";
import {
  mcpShapeForRootAuthority,
  resolveMcpRequestRepoRoot
} from "../root-authority.js";

const checkMarkdownDocumentRawShape = {
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  path: z.string().min(1).describe("Repo-relative Markdown document path to check before commit or docs promotion."),
  max_findings: z.number().int().positive().max(200).default(50).describe("Maximum document quality findings to return."),
  max_evidence_bytes: z.number().int().positive().max(2000).default(240).describe("Maximum evidence bytes per finding; evidence is truncated when longer."),
  max_file_bytes: z.number().int().positive().max(1_000_000).default(200_000).describe("Maximum document size to check before returning a bounded failure."),
  required_frontmatter: z.array(z.string().min(1)).default([
    "title",
    "doc_type",
    "status",
    "owner",
    "last_reviewed"
  ]).describe("Required frontmatter fields for this check; pass an empty array only for documents that intentionally omit frontmatter.")
};

const checkMarkdownDocumentDescription = "Use this before committing or promoting one Markdown document. It checks parser-aware structure, frontmatter, links, lists, and tables, returning bounded evidence without changing the file.";

export const checkMarkdownDocumentTool: McpToolDeclaration = {
  kind: "tool",
  name: "check_markdown_document",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded by one repo-relative Markdown document, max_file_bytes, max_findings, and evidence byte limits.",
    description: checkMarkdownDocumentDescription,
    parameters: [
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "path", description: "Repo-relative Markdown document path to check before commit or docs promotion.", required: true },
      { name: "max_findings", description: "Maximum document quality findings to return.", required: false },
      { name: "max_evidence_bytes", description: "Maximum evidence bytes per finding; evidence is truncated when longer.", required: false },
      { name: "max_file_bytes", description: "Maximum document size to check before returning a bounded failure.", required: false },
      { name: "required_frontmatter", description: "Required frontmatter fields; pass an empty array only when intentionally omitted.", required: false }
    ],
    returns: "ResponseEnvelope<CheckMarkdownDocumentResult>"
  },
  register(server: McpServer, context) {
    server.tool(
      "check_markdown_document",
      checkMarkdownDocumentDescription,
      mcpShapeForRootAuthority(checkMarkdownDocumentRawShape, context),
      async (args: unknown) => {
        let request: CheckMarkdownDocumentRequest;
        try {
          request = parseMcpArguments(checkMarkdownDocumentRequestSchema, args);
        } catch (error) {
          const envelope = buildInvalidCheckMarkdownDocumentInputEnvelope({
            repoRoot: context.repoRoot,
            path: readPath(args),
            message: formatMcpArgumentError(error, "Invalid check_markdown_document arguments.")
          });
          return textToolResponse(envelope);
        }

        const rootDecision = resolveMcpRequestRepoRoot(request, context);
        if (!rootDecision.ok) {
          const envelope = buildInvalidCheckMarkdownDocumentInputEnvelope({
            repoRoot: rootDecision.repoRoot,
            path: request.path,
            message: rootDecision.message
          });
          return textToolResponse(envelope);
        }

        if (context.checkMarkdownDocument === undefined) {
          const envelope = buildInvalidCheckMarkdownDocumentInputEnvelope({
            repoRoot: context.repoRoot,
            path: request.path,
            message: "check_markdown_document provider is not configured."
          });
          return textToolResponse(envelope);
        }

        const result = await context.checkMarkdownDocument({
          request: rootDecision.request
        });
        return textToolResponse(buildCheckMarkdownDocumentEnvelope(result));
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
