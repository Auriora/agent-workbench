import { makeEnvelope, type ImpactResult, type ResponseEnvelope } from "../contracts/index.js";
import type { ComputeImpactResult } from "../application/use-cases/compute-impact.js";
import { invalidResponseMeta } from "./metadata.js";

export function buildImpactEnvelope(result: ComputeImpactResult): ResponseEnvelope<ImpactResult> {
  return makeEnvelope({
    data: result.impact,
    meta: result.meta
  });
}

export function buildInvalidImpactInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<ImpactResult> {
  return makeEnvelope({
    data: {
      repo_root: input.repoRoot,
      snapshot_id: "",
      start_node_ids: [],
      affected_symbols: [],
      affected_files: [],
      edge_count: 0,
      reached_depth: 0,
      traversal_truncated: false,
      confidence: {
        level: "low",
        scope: "empty",
        reason: "Impact request input was invalid, so no graph evidence was computed.",
        evidence_kinds: []
      },
      next_actions: []
    },
    meta: invalidResponseMeta({ repoRoot: input.repoRoot }),
    errors: [{ code: "invalid_input", message: input.message, retryable: false }]
  });
}
