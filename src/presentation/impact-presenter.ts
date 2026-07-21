/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  impactResultSchema,
  type ImpactResult,
  type ResponseEnvelope
} from "../contracts/index.js";
import type { ComputeImpactResult } from "../application/use-cases/compute-impact.js";
import {
  invalidResponseMeta,
  makeTrustedEnvelope,
  presentNextActions,
  type PresentationSessionContext
} from "../application/use-cases/response-metadata.js";
import { sanitizeSymbolReference } from "./redaction.js";

export function buildImpactEnvelope(
  result: ComputeImpactResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<ImpactResult> {
  return makeTrustedEnvelope({
    data: impactResultSchema.parse({
      ...result.impact,
      affected_symbols: result.impact.affected_symbols.map(sanitizeSymbolReference),
      next_actions: presentNextActions(result.impact.next_actions, context)
    }),
    meta: result.meta,
    trust_policy: { surface_kind: "graph_impact_routing" }
  });
}

export function buildInvalidImpactInputEnvelope(input: {
  repoRoot: string;
  message: string;
  unknownNodeId?: string;
  snapshotId?: string;
}): ResponseEnvelope<ImpactResult> {
  const unknownNode = input.unknownNodeId !== undefined;
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      snapshot_id: input.snapshotId ?? "",
      start_node_ids: unknownNode ? [input.unknownNodeId!] : [],
      affected_symbols: [],
      affected_files: [],
      edge_count: 0,
      reached_depth: 0,
      traversal_truncated: false,
      confidence: {
        level: "low",
        scope: "empty",
        reason: unknownNode
          ? "The requested impact start node was not present in the selected snapshot, so no graph evidence was computed."
          : "Impact request input was invalid, so no graph evidence was computed.",
        evidence_kinds: []
      },
      next_actions: unknownNode
        ? [{
            tool: "symbol_search",
            args: {
              query: impactRecoveryQuery(input.unknownNodeId!),
              exact: false,
              max_results: 20,
              ...(input.snapshotId === undefined ? {} : { snapshot_id: input.snapshotId })
            }
          }]
        : []
    },
    meta: invalidResponseMeta({ repoRoot: input.repoRoot }),
    trust_policy: { surface_kind: "graph_impact_routing" },
    errors: [{ code: "invalid_input", message: input.message, retryable: false }]
  });
}

function impactRecoveryQuery(nodeId: string): string {
  const canonicalParts = nodeId.split(":");
  if (canonicalParts.length >= 4) {
    return canonicalParts.slice(3).join(":");
  }
  return nodeId.split(/[\\/]/u).filter(Boolean).at(-1) ?? nodeId;
}
