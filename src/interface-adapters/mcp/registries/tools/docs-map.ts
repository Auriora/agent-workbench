/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  docsMapRequestSchema,
  type DocsMapRequest
} from "../../../../contracts/index.js";
import {
  buildDocsMapEnvelope,
  buildInvalidDocsMapInputEnvelope
} from "../../../../presentation/docs-presenter.js";
import {
  classifiedFailureEnvelope,
  registerMcpToolWithEnvelope
} from "../../envelope.js";
import { requestWithSessionDocsScope } from "../docs-session-scope.js";
import type { McpToolDeclaration } from "../index.js";

const docsMapRawShape = {
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  scope_path: z.string().min(1).optional().describe("Optional repo-relative docs scope prefix; overrides any docs_scope session value."),
  max_docs: z.number().int().positive().max(200).default(50).describe("Maximum compact docs-map entries to attempt on this page before envelope packing."),
  max_headings_per_doc: z.number().int().positive().max(50).default(20).describe("Maximum heading samples to attempt per docs-map entry before envelope packing."),
  cursor: z.string().optional().describe("Opaque cursor returned by a previous truncated docs_map page.")
};

const docsMapDescription = "Use this to page or narrow the bounded documentation map when repo:///docs/map truncates. It returns compact routing entries with exact repo-relative paths, authority and currency routing, truthful warning totals, and an opaque cursor to the first unreturned document.";

export const docsMapTool: McpToolDeclaration = {
  kind: "tool",
  name: "docs_map",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded to a JSON envelope no larger than 32768 UTF-8 bytes; packs complete docs-map entries and warning samples, then continues with an opaque cursor.",
    description: docsMapDescription,
    parameters: [
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "scope_path", description: "Optional repo-relative docs scope prefix; overrides any docs_scope session value.", required: false },
      { name: "max_docs", description: "Maximum compact docs-map entries to attempt on this page before envelope packing.", required: false },
      { name: "max_headings_per_doc", description: "Maximum heading samples to attempt per docs-map entry before envelope packing.", required: false },
      { name: "cursor", description: "Opaque cursor returned by a previous truncated docs_map page.", required: false }
    ],
    returns: "ResponseEnvelope<DocsMap>"
  },
  register(server: McpServer, context) {
    registerMcpToolWithEnvelope({
      server,
      context,
      name: "docs_map",
      description: docsMapDescription,
      rawShape: docsMapRawShape,
      schema: docsMapRequestSchema,
      invalidInputMessage: "Invalid docs_map arguments.",
      getProvider: (registryContext) => registryContext.getDocsMap,
      buildFailureEnvelope: (input) => classifiedFailureEnvelope(
        buildInvalidDocsMapInputEnvelope({
          repoRoot: input.repoRoot,
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
      present: buildDocsMapEnvelope,
      classifyError: (error) => (
        error instanceof Error && "code" in error && error.code === "invalid_cursor"
          ? "invalid_input"
          : "internal_error"
      )
    });
  }
};
