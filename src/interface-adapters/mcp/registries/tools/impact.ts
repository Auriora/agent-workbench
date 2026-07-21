/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { impactRequestSchema } from "../../../../contracts/index.js";
import {
  buildImpactEnvelope,
  buildInvalidImpactInputEnvelope
} from "../../../../presentation/impact-presenter.js";
import {
  classifiedFailureEnvelope,
  classifyGraphQueryError,
  registerMcpToolWithEnvelope
} from "../../envelope.js";
import type { McpToolDeclaration } from "../index.js";

const impactRawShape = {
  node_id: z.string().describe("Indexed graph node id from symbol_search, context_for_task, or find_references to start traversal from."),
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  snapshot_id: z.string().optional().describe("Optional snapshot id. Defaults to the latest snapshot for the repository."),
  max_depth: z.number().int().positive().max(5).default(2).describe("Maximum traversal depth for bounded impact analysis."),
  max_nodes: z.number().int().positive().max(200).default(50).describe("Maximum graph nodes to return before truncating the impact result."),
  direction: z.enum(["incoming", "outgoing", "both"]).default("both").describe("Traversal direction: incoming callers, outgoing dependencies, or both.")
};

const impactDescription = "Use this after selecting a graph node_id to estimate affected symbols and files before edits. It performs bounded indexed graph traversal, does not scan source broadly, and does not mutate files.";

export const impactTool: McpToolDeclaration = {
  kind: "tool",
  name: "impact",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded by max_depth and max_nodes.",
    description: impactDescription,
    parameters: [
      { name: "node_id", description: "Indexed graph node id from symbol_search, context_for_task, or find_references.", required: true },
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "snapshot_id", description: "Optional snapshot id. Defaults to latest snapshot for the repository.", required: false },
      { name: "max_depth", description: "Maximum traversal depth for bounded impact analysis.", required: false },
      { name: "max_nodes", description: "Maximum graph nodes to return before truncating the impact result.", required: false },
      { name: "direction", description: "Traversal direction: incoming callers, outgoing dependencies, or both.", required: false }
    ],
    returns: "ResponseEnvelope<ImpactResult>"
  },
  register(server: McpServer, context) {
    registerMcpToolWithEnvelope({
      server,
      context,
      name: "impact",
      description: impactDescription,
      rawShape: impactRawShape,
      schema: impactRequestSchema,
      invalidInputMessage: "Invalid impact arguments.",
      getProvider: (registryContext) => registryContext.computeImpact,
      buildFailureEnvelope: (input) => {
        const missingNode = impactMissingNode(input.cause);
        return classifiedFailureEnvelope(buildInvalidImpactInputEnvelope({
          repoRoot: input.repoRoot,
          message: input.message,
          unknownNodeId: input.causeCode === "impact_start_node_not_found"
            ? missingNode?.nodeId ?? input.request?.node_id
            : undefined,
          snapshotId: input.causeCode === "impact_start_node_not_found"
            ? missingNode?.snapshotId ?? input.request?.snapshot_id
            : undefined
        }), input);
      },
      invoke: ({ provider, request }) => provider({ request }),
      present: buildImpactEnvelope,
      classifyError: classifyGraphQueryError
    });
  }
};

function impactMissingNode(error: unknown): { nodeId: string; snapshotId: string } | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { code?: unknown; nodeId?: unknown; snapshotId?: unknown };
  return candidate.code === "impact_start_node_not_found" &&
    typeof candidate.nodeId === "string" && typeof candidate.snapshotId === "string"
    ? { nodeId: candidate.nodeId, snapshotId: candidate.snapshotId }
    : undefined;
}
