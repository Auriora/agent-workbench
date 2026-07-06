/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { RepoScope, ResponseEnvelope } from "../contracts/index.js";
import type { GetRepoScopeResult } from "../application/use-cases/get-repo-scope.js";
import { invalidResponseMeta, makeTrustedEnvelope } from "../application/use-cases/response-metadata.js";

export function buildRepoScopeEnvelope(
  result: GetRepoScopeResult
): ResponseEnvelope<RepoScope> {
  return makeTrustedEnvelope({
    data: result.scope,
    meta: result.meta,
    trust_policy: { surface_kind: "repository_status" }
  });
}

export function buildInvalidRepoScopeInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<RepoScope> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      indexed_roots: [],
      skipped_roots: [],
      languages: [],
      file_counts: {},
      capability_counts: {
        semantic: 0,
        partial_semantic: 0,
        resource_backed: 0,
        unsupported: 0
      },
      generated_or_vendor_roots: []
    },
    meta: invalidResponseMeta({ repoRoot: input.repoRoot }),
    trust_policy: { surface_kind: "repository_status" },
    errors: [
      {
        code: "invalid_input",
        message: input.message,
        retryable: false
      }
    ]
  });
}

export function buildRepoScopeProviderFailureEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<RepoScope> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      indexed_roots: [],
      skipped_roots: [],
      languages: [],
      file_counts: {},
      capability_counts: {
        semantic: 0,
        partial_semantic: 0,
        resource_backed: 0,
        unsupported: 0
      },
      generated_or_vendor_roots: []
    },
    meta: invalidResponseMeta({
      repoRoot: input.repoRoot,
      analysis_validity: "invalid_due_to_environment"
    }),
    trust_policy: { surface_kind: "repository_status" },
    errors: [
      {
        code: "provider_unavailable",
        message: input.message,
        retryable: true
      }
    ]
  });
}
