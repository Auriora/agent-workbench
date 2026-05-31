import {
  makeEnvelope,
  type FindReferencesResult,
  type ResponseEnvelope
} from "../contracts/index.js";
import type { FindReferencesUseCaseResult } from "../application/use-cases/find-references.js";

export function buildFindReferencesEnvelope(
  result: FindReferencesUseCaseResult
): ResponseEnvelope<FindReferencesResult> {
  return makeEnvelope({
    data: result.references,
    meta: result.meta
  });
}

export function buildInvalidFindReferencesInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<FindReferencesResult> {
  return makeEnvelope({
    data: {
      repo_root: input.repoRoot,
      snapshot_id: "",
      references: [],
      next_actions: []
    },
    meta: invalidMeta(input.repoRoot),
    errors: [{ code: "invalid_input", message: input.message, retryable: false }]
  });
}

function invalidMeta(repoRoot: string) {
  return {
    analysis_validity: "invalid" as const,
    freshness: "unknown" as const,
    scope: { repo_root: repoRoot, indexed_roots: [], skipped_roots: [], languages: [] },
    capability_level: "unsupported" as const,
    evidence_kinds: [],
    verification_status: "blocked" as const,
    truncated: false
  };
}
