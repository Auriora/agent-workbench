/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  findReferencesResultSchema,
  responseMetadataSchema,
  type FindReferencesResult,
  type ReferenceCoverageReceipt,
  type ResponseEnvelope
} from "../contracts/index.js";
import type { FindReferencesUseCaseResult } from "../application/use-cases/find-references.js";
import {
  invalidResponseMeta,
  makeTrustedEnvelope,
  presentNextActions,
  type PresentationSessionContext
} from "../application/use-cases/response-metadata.js";
import { sanitizeSymbolReference } from "./redaction.js";

export function buildFindReferencesEnvelope(
  result: FindReferencesUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<FindReferencesResult> {
  const references = findReferencesResultSchema.parse({
    ...result.references,
    target: result.references.target === undefined
      ? undefined
      : sanitizeSymbolReference(result.references.target),
    next_actions: presentNextActions(result.references.next_actions, context)
  });
  return makeTrustedEnvelope({
    data: references,
    meta: presentReferenceMetadata(references, result.meta),
    trust_policy: { surface_kind: "graph_reference_routing" },
    errors: result.errors
  });
}

function presentReferenceMetadata(
  result: FindReferencesResult,
  meta: FindReferencesUseCaseResult["meta"]
): FindReferencesUseCaseResult["meta"] {
  if (result.coverage_status === "legacy_unverified") {
    return meta;
  }

  const coverage = result.coverage;
  const blocked = isBlockedReferenceCoverage(result.references.length, coverage);
  return responseMetadataSchema.parse({
    ...meta,
    analysis_validity: coverage.state === "complete"
      ? "valid"
      : meta.analysis_validity === "invalid" || meta.analysis_validity === "invalid_due_to_environment"
        ? meta.analysis_validity
        : "partial",
    verification_status: blocked ? "blocked" : meta.verification_status,
    truncated: coverage.state === "partial",
    scope: {
      ...meta.scope,
      languages: [...coverage.languages_inspected]
    },
    reference_coverage: coverage
  });
}

function isBlockedReferenceCoverage(
  referenceCount: number,
  coverage: ReferenceCoverageReceipt
): boolean {
  return coverage.state === "partial" &&
    coverage.continuation_kind === undefined &&
    referenceCount === 0 &&
    coverage.unresolved_searchable_candidates.sequence.length > 0;
}

export function buildInvalidFindReferencesInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<FindReferencesResult> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      snapshot_id: "",
      coverage_status: "legacy_unverified",
      references: [],
      next_actions: []
    },
    meta: invalidMeta(input.repoRoot),
    trust_policy: { surface_kind: "graph_reference_routing" },
    errors: [{ code: "invalid_input", message: input.message, retryable: false }]
  });
}

function invalidMeta(repoRoot: string) {
  return invalidResponseMeta({ repoRoot });
}
