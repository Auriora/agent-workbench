import { makeEnvelope, type ImpactResult, type ResponseEnvelope } from "../contracts/index.js";
import type { ComputeImpactResult } from "../application/use-cases/compute-impact.js";

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
      next_actions: []
    },
    meta: {
      analysis_validity: "invalid",
      freshness: "unknown",
      scope: { repo_root: input.repoRoot, indexed_roots: [], skipped_roots: [], languages: [] },
      capability_level: "unsupported",
      evidence_kinds: [],
      verification_status: "blocked",
      truncated: false
    },
    errors: [{ code: "invalid_input", message: input.message, retryable: false }]
  });
}
