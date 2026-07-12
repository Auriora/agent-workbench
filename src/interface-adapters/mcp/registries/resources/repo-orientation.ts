/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  buildInvalidRepoOrientationInputEnvelope,
  buildRepoOrientationEnvelope,
  buildRepoOrientationProviderFailureEnvelope
} from "../../../../presentation/repo-orientation-presenter.js";
import type { McpResourceDeclaration } from "../index.js";
import { formatMcpArgumentError } from "../../arguments/index.js";
import { parseRepoStatusArguments } from "../../arguments/repo-status.js";
import { resolveMcpRequestRepoRoot } from "../root-authority.js";
import { providerFailureMessage } from "./provider-failure.js";

export const repoOrientationResource: McpResourceDeclaration = {
  kind: "resource",
  name: "orientation",
  uri: "repo:///orientation",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Uses bounded status evidence and returns no file inventory or source content.",
    description: "Compact snapshot, freshness, trust, blocker, reuse, and detailed-resource orientation receipt.",
    parameters: [{
      name: "repo_root",
      description: "Optional repository root. Defaults to the MCP server repo root.",
      required: false
    }],
    returns: "ResponseEnvelope<OrientationReceipt>"
  },
  register(server: McpServer, context) {
    server.resource("orientation", "repo:///orientation", async (request: unknown) => {
      let args;
      try {
        args = parseRepoStatusArguments(getRepoResourceArgumentInput(request));
      } catch (error) {
        return orientationContent(buildInvalidRepoOrientationInputEnvelope({
          repoRoot: context.repoRoot,
          message: formatMcpArgumentError(error, "Invalid orientation resource arguments.")
        }));
      }

      const rootDecision = resolveMcpRequestRepoRoot(args, context);
      if (!rootDecision.ok) {
        return orientationContent(buildInvalidRepoOrientationInputEnvelope({
          repoRoot: rootDecision.repoRoot,
          message: rootDecision.message
        }));
      }
      if (context.getRepoOrientation === undefined) {
        return orientationContent(buildInvalidRepoOrientationInputEnvelope({
          repoRoot: context.repoRoot,
          message: "repo:///orientation provider is not configured."
        }));
      }

      const repoRoot = rootDecision.request.repo_root;
      try {
        return orientationContent(buildRepoOrientationEnvelope(
          await context.getRepoOrientation({ repo_root: repoRoot })
        ));
      } catch (error) {
        return orientationContent(buildRepoOrientationProviderFailureEnvelope({
          repoRoot,
          message: providerFailureMessage("repo:///orientation", error)
        }));
      }
    });
  }
};

function orientationContent(envelope: unknown) {
  return {
    contents: [{
      uri: "repo:///orientation",
      mimeType: "application/json",
      text: JSON.stringify(envelope, null, 2)
    }]
  };
}

function getRepoResourceArgumentInput(request: unknown): unknown {
  if (typeof request !== "object" || request === null) return undefined;
  if (Object.prototype.hasOwnProperty.call(request, "repo_root")) {
    return { repo_root: (request as { repo_root?: unknown }).repo_root };
  }
  return undefined;
}
