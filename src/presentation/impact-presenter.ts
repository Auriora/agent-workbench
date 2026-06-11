import {
  impactResultSchema,
  makeEnvelope,
  sourceSectionSchema,
  symbolReferenceSchema,
  type ImpactResult,
  type ResponseEnvelope,
  type SymbolReference
} from "../contracts/index.js";
import type { ComputeImpactResult } from "../application/use-cases/compute-impact.js";
import {
  invalidResponseMeta,
  presentNextActions,
  type PresentationSessionContext
} from "../application/use-cases/response-metadata.js";
import { redactPresentationText } from "./redaction.js";

export function buildImpactEnvelope(
  result: ComputeImpactResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<ImpactResult> {
  return makeEnvelope({
    data: impactResultSchema.parse({
      ...result.impact,
      affected_symbols: result.impact.affected_symbols.map(sanitizeSymbolReference),
      next_actions: presentNextActions(result.impact.next_actions, context)
    }),
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
