import {
  findReferencesResultSchema,
  makeEnvelope,
  type FindReferencesResult,
  type ResponseEnvelope
} from "../contracts/index.js";
import type { FindReferencesUseCaseResult } from "../application/use-cases/find-references.js";
import {
  invalidResponseMeta,
  presentNextActions,
  type PresentationSessionContext
} from "../application/use-cases/response-metadata.js";

export function buildFindReferencesEnvelope(
  result: FindReferencesUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<FindReferencesResult> {
  return makeEnvelope({
    data: findReferencesResultSchema.parse({
      ...result.references,
      next_actions: presentNextActions(result.references.next_actions, context)
    }),
    meta: result.meta
  });
}

export function buildInvalidFindReferencesInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<FindReferencesResult> {
  return makeEnvelope({
    data: {
      repo_root: input.repoRoot,
      snapshot_id: "",
      references: [],
      next_actions: []
    },
    meta: invalidMeta(input.repoRoot),
    errors: [{ code: "invalid_input", message: input.message, retryable: false }]
  });
}

function invalidMeta(repoRoot: string) {
  return invalidResponseMeta({ repoRoot });
}
