/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { RepoOverview, ResponseEnvelope } from "../contracts/index.js";
import type { GetRepoOverviewResult } from "../application/use-cases/get-repo-overview.js";
import { invalidResponseMeta, makeTrustedEnvelope } from "../application/use-cases/response-metadata.js";

export function buildRepoOverviewEnvelope(
  result: GetRepoOverviewResult
): ResponseEnvelope<RepoOverview> {
  return makeTrustedEnvelope({
    data: result.overview,
    meta: result.meta,
    trust_policy: { surface_kind: "repository_status" }
  });
}

export function buildInvalidRepoOverviewInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<RepoOverview> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      summary: "Repository overview is unavailable because the request is invalid.",
      languages: [],
      platforms: [],
      key_files: [],
      key_docs: [],
      validation_hints: [],
      recommended_first_calls: []
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

export function buildRepoOverviewProviderFailureEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<RepoOverview> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      summary: "Repository overview is unavailable because required runtime evidence could not be read.",
      languages: [],
      platforms: [],
      key_files: [],
      key_docs: [],
      validation_hints: [],
      recommended_first_calls: []
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
