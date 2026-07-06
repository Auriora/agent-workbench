/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  sourceSectionSchema,
  symbolReferenceSchema,
  symbolSearchResultSchema,
  type ResponseEnvelope,
  type SymbolReference,
  type SymbolSearchResult
} from "../contracts/index.js";
import type { SearchSymbolsResult } from "../application/use-cases/search-symbols.js";
import {
  invalidResponseMeta,
  makeTrustedEnvelope,
  presentNextActions,
  type PresentationSessionContext
} from "../application/use-cases/response-metadata.js";
import { redactPresentationText } from "./redaction.js";

export function buildSymbolSearchEnvelope(
  result: SearchSymbolsResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<SymbolSearchResult> {
  return makeTrustedEnvelope({
    data: symbolSearchResultSchema.parse({
      ...result.symbols,
      symbols: result.symbols.symbols.map(sanitizeSymbolReference),
      next_actions: presentNextActions(result.symbols.next_actions, context)
    }),
    meta: result.meta,
    trust_policy: { surface_kind: "graph_symbol_routing" }
  });
}

export function buildInvalidSymbolSearchInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<SymbolSearchResult> {
  return makeTrustedEnvelope({
    data: {
      query: "",
      repo_root: input.repoRoot,
      snapshot_id: "",
      symbols: [],
      next_actions: []
    },
    meta: invalidMeta(input.repoRoot),
    trust_policy: { surface_kind: "graph_symbol_routing" },
    errors: [{ code: "invalid_input", message: input.message, retryable: false }]
  });
}

function invalidMeta(repoRoot: string) {
  return invalidResponseMeta({ repoRoot });
}

function sanitizeSymbolReference(input: SymbolReference): SymbolReference {
  return symbolReferenceSchema.parse({
    ...input,
    source_section: input.source_section === undefined
      ? undefined
      : sourceSectionSchema.parse({
          ...input.source_section,
          text: redactPresentationText(input.source_section.text, { context: "source" })
        })
  });
}
