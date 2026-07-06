/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  checkMarkdownSetRequestSchema,
  type CheckMarkdownSetRequest
} from "../../../../contracts/index.js";
import {
  buildCheckMarkdownSetEnvelope,
  buildInvalidCheckMarkdownSetInputEnvelope
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

const requiredFrontmatterDefault = [
  "title",
  "doc_type",
  "status",
  "owner",
  "last_reviewed"
] as const;

const checkMarkdownSetRawShape = {
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  paths: z.array(z.string().min(1)).default([]).describe("Explicit repo-relative Markdown document paths to check; use this for a known edited set."),
  scope_path: z.string().min(1).optional().describe("Optional bounded repo-relative scope prefix, such as docs or docs/specs, used when paths is empty or incomplete."),
  max_documents: z.number().int().positive().max(100).default(20).describe("Maximum Markdown documents to check from explicit paths or scope_path."),
  max_findings: z.number().int().positive().max(500).default(100).describe("Maximum aggregate findings to return across checked documents."),
  max_evidence_bytes: z.number().int().positive().max(2000).default(240).describe("Maximum evidence bytes per finding; evidence is truncated when longer."),
  max_file_bytes: z.number().int().positive().max(1_000_000).default(200_000).describe("Maximum document size to check before returning a bounded file-level failure."),
  required_frontmatter: z.array(z.string().min(1)).default([...requiredFrontmatterDefault]).describe("Required frontmatter fields for each checked document; pass an empty array only when intentionally omitted.")
};

const checkMarkdownSetDescription = "Use this before docs-wide commits, spec closure, or documentation promotion to check explicit Markdown files or a bounded docs scope. Keep paths or scope_path narrow; it returns aggregate bounded findings without mutation.";

export const checkMarkdownSetTool: McpToolDeclaration = {
  kind: "tool",
  name: "check_markdown_set",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded by explicit paths or scope_path plus max_documents, max_findings, file-size, and evidence limits.",
    description: checkMarkdownSetDescription,
    parameters: [
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "paths", description: "Explicit repo-relative Markdown document paths to check when the edited set is known.", required: false },
      { name: "scope_path", description: "Optional bounded repo-relative scope prefix used when paths is empty or incomplete.", required: false },
      { name: "max_documents", description: "Maximum Markdown documents to check from explicit paths or scope_path.", required: false },
      { name: "max_findings", description: "Maximum aggregate findings to return across checked documents.", required: false },
      { name: "max_evidence_bytes", description: "Maximum evidence bytes per finding; evidence is truncated when longer.", required: false },
      { name: "max_file_bytes", description: "Maximum document size to check before returning a bounded file-level failure.", required: false },
      { name: "required_frontmatter", description: "Required frontmatter fields; pass an empty array only when intentionally omitted.", required: false }
    ],
    returns: "ResponseEnvelope<CheckMarkdownSetResult>"
  },
  register(server: McpServer, context) {
    server.tool(
      "check_markdown_set",
      checkMarkdownSetDescription,
      mcpShapeForRootAuthority(checkMarkdownSetRawShape, context),
      async (args: unknown) => {
        let request: CheckMarkdownSetRequest;
        try {
          request = parseMcpArguments(checkMarkdownSetRequestSchema, args);
        } catch (error) {
          const envelope = buildInvalidCheckMarkdownSetInputEnvelope({
            repoRoot: context.repoRoot,
            message: formatMcpArgumentError(error, "Invalid check_markdown_set arguments.")
          });
          return textToolResponse(envelope);
        }

        const rootDecision = resolveMcpRequestRepoRoot(request, context);
        if (!rootDecision.ok) {
          const envelope = buildInvalidCheckMarkdownSetInputEnvelope({
            repoRoot: rootDecision.repoRoot,
            message: rootDecision.message
          });
          return textToolResponse(envelope);
        }

        if (context.checkMarkdownSet === undefined) {
          const envelope = buildInvalidCheckMarkdownSetInputEnvelope({
            repoRoot: context.repoRoot,
            message: "check_markdown_set provider is not configured."
          });
          return textToolResponse(envelope);
        }

        const result = await context.checkMarkdownSet({
          request: rootDecision.request
        });
        return textToolResponse(buildCheckMarkdownSetEnvelope(result));
      }
    );
  }
};

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
