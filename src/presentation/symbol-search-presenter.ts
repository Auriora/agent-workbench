import {
  makeEnvelope,
  type ResponseEnvelope,
  type SymbolSearchResult
} from "../contracts/index.js";
import type { SearchSymbolsResult } from "../application/use-cases/search-symbols.js";

export function buildSymbolSearchEnvelope(
  result: SearchSymbolsResult
): ResponseEnvelope<SymbolSearchResult> {
  return makeEnvelope({
    data: result.symbols,
    meta: result.meta
  });
}

export function buildInvalidSymbolSearchInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<SymbolSearchResult> {
  return makeEnvelope({
    data: {
      query: "",
      repo_root: input.repoRoot,
      snapshot_id: "",
      symbols: [],
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
