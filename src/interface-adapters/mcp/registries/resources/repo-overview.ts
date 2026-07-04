/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  buildInvalidRepoOverviewInputEnvelope,
  buildRepoOverviewProviderFailureEnvelope,
  buildRepoOverviewEnvelope
} from "../../../../presentation/repo-overview-presenter.js";
import type { McpResourceDeclaration } from "../index.js";
import { formatMcpArgumentError } from "../../arguments/index.js";
import { parseRepoStatusArguments } from "../../arguments/repo-status.js";

export const repoOverviewResource: McpResourceDeclaration = {
  kind: "resource",
  name: "overview",
  uri: "repo:///overview",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Scans bounded repository file catalog and docs evidence; no source mutation.",
    description: "Compact repository overview with platforms, key files, docs, validation hints, and first-call guidance.",
    parameters: [
      {
        name: "repo_root",
        description: "Optional repository root. Defaults to the MCP server repo root.",
        required: false
      }
    ],
    returns: "ResponseEnvelope<RepoOverview>"
  },
  register(server: McpServer, context) {
    server.resource("overview", "repo:///overview", async (request: unknown) => {
      let args;
      try {
        args = parseRepoStatusArguments(getRepoResourceArgumentInput(request));
      } catch (error) {
        const message = formatMcpArgumentError(
          error,
          "Invalid overview resource arguments."
        );
        const envelope = buildInvalidRepoOverviewInputEnvelope({
          repoRoot: context.repoRoot,
          message
        });
        return {
          contents: [
            {
              uri: "repo:///overview",
              mimeType: "application/json",
              text: JSON.stringify(envelope, null, 2)
            }
          ]
        };
      }

      if (context.getRepoOverview === undefined) {
        const envelope = buildInvalidRepoOverviewInputEnvelope({
          repoRoot: context.repoRoot,
          message: "repo:///overview provider is not configured."
        });
        return {
          contents: [
            {
              uri: "repo:///overview",
              mimeType: "application/json",
              text: JSON.stringify(envelope, null, 2)
            }
          ]
        };
      }

      const repoRoot = args.repo_root ?? context.repoRoot;
      let envelope;
      try {
        const result = await context.getRepoOverview({
          repo_root: repoRoot
        });
        envelope = buildRepoOverviewEnvelope(result);
      } catch (error) {
        envelope = buildRepoOverviewProviderFailureEnvelope({
          repoRoot,
          message: providerFailureMessage("repo:///overview", error)
        });
      }

      return {
        contents: [
          {
            uri: "repo:///overview",
            mimeType: "application/json",
            text: JSON.stringify(envelope, null, 2)
          }
        ]
      };
    });
  }
};

function getRepoResourceArgumentInput(request: unknown): unknown {
  if (typeof request !== "object" || request === null) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(request, "repo_root")) {
    return {
      repo_root: (request as { repo_root?: unknown }).repo_root
    };
  }

  return undefined;
}

function providerFailureMessage(resourceUri: string, error: unknown): string {
  const reason = error instanceof Error ? error.message : String(error);
  return `${resourceUri} provider could not read required runtime evidence: ${reason}`;
}
