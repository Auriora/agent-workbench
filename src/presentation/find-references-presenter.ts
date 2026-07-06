/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  findReferencesResultSchema,
  type FindReferencesResult,
  type ResponseEnvelope
} from "../contracts/index.js";
import type { FindReferencesUseCaseResult } from "../application/use-cases/find-references.js";
import {
  invalidResponseMeta,
  makeTrustedEnvelope,
  presentNextActions,
  type PresentationSessionContext
} from "../application/use-cases/response-metadata.js";

export function buildFindReferencesEnvelope(
  result: FindReferencesUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<FindReferencesResult> {
  return makeTrustedEnvelope({
    data: findReferencesResultSchema.parse({
      ...result.references,
      next_actions: presentNextActions(result.references.next_actions, context)
    }),
    meta: result.meta,
    trust_policy: { surface_kind: "graph_reference_routing" }
  });
}

export function buildInvalidFindReferencesInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<FindReferencesResult> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      snapshot_id: "",
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
