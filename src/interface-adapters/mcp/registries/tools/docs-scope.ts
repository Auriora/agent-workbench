/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeEnvelope, type ResponseEnvelope, type ResponseMetadata } from "../../../../contracts/index.js";
import {
  normalizeDocsSessionScopePath,
  type DocsSessionScopeState
} from "../docs-session-scope.js";
import type { McpToolDeclaration } from "../index.js";

const docsScopeRawShape = {
  action: z.enum(["set", "clear", "show"]).default("show").describe("Whether to set, clear, or show the session docs scope."),
  scope_path: z.string().min(1).optional().describe("Repo-relative docs scope prefix to set, such as docs/specs/032-example.")
};

type DocsScopeResponse = {
  status: "set" | "cleared" | "unchanged";
  scope_path?: string;
  message: string;
};

export const docsScopeTool: McpToolDeclaration = {
  kind: "tool",
  name: "docs_scope",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded in-memory MCP session state only; no repository scan and no source mutation.",
    description: "Set, clear, or show the default docs scope_path for this MCP server session.",
    parameters: [
      { name: "action", description: "set, clear, or show the session docs scope.", required: false },
      { name: "scope_path", description: "Repo-relative docs scope prefix required when action is set.", required: false }
    ],
    returns: "ResponseEnvelope<DocsScopeResult>"
  },
  register(server: McpServer, context) {
    server.tool(
      "docs_scope",
      "Set, clear, or show the default docs scope_path for this MCP server session.",
      docsScopeRawShape,
      async (args: unknown) => textResponse(envelopeForDocsScope(context.repoRoot, applyDocsScopeArgs(args, context.docsSessionScope)))
    );
  }
};

function applyDocsScopeArgs(args: unknown, state: DocsSessionScopeState = {}): DocsScopeResponse {
  const parsed = z.object(docsScopeRawShape).strict().safeParse(args ?? {});
  if (!parsed.success) {
    return {
      status: "unchanged",
      scope_path: state.scope_path,
      message: `Invalid docs_scope arguments: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`
    };
  }

  if (parsed.data.action === "show") {
    return {
      status: "unchanged",
      scope_path: state.scope_path,
      message: state.scope_path === undefined
        ? "No session docs scope_path is set."
        : `Session docs scope_path is ${state.scope_path}.`
    };
  }

  if (parsed.data.action === "clear") {
    delete state.scope_path;
    return {
      status: "cleared",
      message: "Session docs scope_path cleared."
    };
  }

  const scopePath = normalizeDocsSessionScopePath(parsed.data.scope_path);
  if (scopePath === undefined) {
    return {
      status: "unchanged",
      scope_path: state.scope_path,
      message: "action=set requires a safe repo-relative scope_path."
    };
  }
  state.scope_path = scopePath;
  return {
    status: "set",
    scope_path: scopePath,
    message: `Session docs scope_path set to ${scopePath}.`
  };
}

function envelopeForDocsScope(repoRoot: string, data: DocsScopeResponse): ResponseEnvelope<DocsScopeResponse> {
  return makeEnvelope({
    data,
    meta: docsScopeMeta(repoRoot, data.status)
  });
}

function docsScopeMeta(repoRoot: string, status: DocsScopeResponse["status"]): ResponseMetadata {
  return {
    analysis_validity: "valid",
    freshness: "unknown",
    scope: {
      repo_root: repoRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      languages: ["markdown"]
    },
    capability_level: "resource_backed",
    evidence_kinds: ["config"],
    verification_status: status === "unchanged" ? "done" : "needed",
    truncated: false
  };
}

function textResponse(envelope: ResponseEnvelope<DocsScopeResponse>) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(envelope, null, 2)
      }
    ]
  };
}
