import {
  makeEnvelope,
  type ResponseEnvelope,
  type SymbolSearchResult
} from "../contracts/index.js";
import type { SearchSymbolsResult } from "../application/use-cases/search-symbols.js";
import { invalidResponseMeta } from "./metadata.js";

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
  return invalidResponseMeta({ repoRoot });
}
