import { makeEnvelope, type RepoScope, type ResponseEnvelope } from "../contracts/index.js";
import type { GetRepoScopeResult } from "../application/use-cases/get-repo-scope.js";
import { invalidResponseMeta } from "../application/use-cases/response-metadata.js";

export function buildRepoScopeEnvelope(
  result: GetRepoScopeResult
): ResponseEnvelope<RepoScope> {
  return makeEnvelope({
    data: result.scope,
    meta: result.meta
  });
}

export function buildInvalidRepoScopeInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<RepoScope> {
  return makeEnvelope({
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
    errors: [
      {
        code: "invalid_input",
        message: input.message,
        retryable: false
      }
    ]
  });
}
