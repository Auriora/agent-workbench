import { makeEnvelope, type RepoOverview, type ResponseEnvelope } from "../contracts/index.js";
import type { GetRepoOverviewResult } from "../application/use-cases/get-repo-overview.js";
import { invalidResponseMeta } from "./metadata.js";

export function buildRepoOverviewEnvelope(
  result: GetRepoOverviewResult
): ResponseEnvelope<RepoOverview> {
  return makeEnvelope({
    data: result.overview,
    meta: result.meta
  });
}

export function buildInvalidRepoOverviewInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<RepoOverview> {
  return makeEnvelope({
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
    errors: [
      {
        code: "invalid_input",
        message: input.message,
        retryable: false
      }
    ]
  });
}
