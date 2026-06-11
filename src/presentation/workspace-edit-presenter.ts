import {
  makeEnvelope,
  type ApplyWorkspaceEditResult,
  type PreviewWorkspaceEditResult,
  type ResponseEnvelope
} from "../contracts/index.js";
import type { ApplyWorkspaceEditUseCaseResult } from "../application/use-cases/apply-workspace-edit.js";
import type { PreviewWorkspaceEditUseCaseResult } from "../application/use-cases/preview-workspace-edit.js";
import {
  invalidResponseMeta,
  presentNextActions,
  type PresentationSessionContext
} from "../application/use-cases/response-metadata.js";

export function buildPreviewWorkspaceEditEnvelope(
  result: PreviewWorkspaceEditUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<PreviewWorkspaceEditResult> {
  return makeEnvelope({
    data: {
      ...result.preview,
      next_actions: presentNextActions(result.preview.next_actions, context)
    },
    meta: result.meta
  });
}

export function buildApplyWorkspaceEditEnvelope(
  result: ApplyWorkspaceEditUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<ApplyWorkspaceEditResult> {
  return makeEnvelope({
    data: {
      ...result.result,
      next_actions: presentNextActions(result.result.next_actions, context)
    },
    meta: result.meta
  });
}

export function buildInvalidPreviewWorkspaceEditInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<PreviewWorkspaceEditResult> {
  return makeEnvelope({
    data: {
      repo_root: input.repoRoot,
      preview: {
        preview_token: "",
        created_at: "",
        expires_at: "",
        files: [],
        operation: "bounded_text_edit",
        mutation_class: "workspace_write"
      },
      changed_files: [],
      next_actions: []
    },
    meta: invalidMeta(input.repoRoot),
    errors: [{ code: "invalid_input", message: input.message, retryable: false }]
  });
}

export function buildInvalidApplyWorkspaceEditInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<ApplyWorkspaceEditResult> {
  return makeEnvelope({
    data: {
      repo_root: input.repoRoot,
      preview_token: "",
      applied_files: [],
      status: "blocked",
      next_actions: []
    },
    meta: invalidMeta(input.repoRoot),
    errors: [{ code: "invalid_input", message: input.message, retryable: false }]
  });
}

function invalidMeta(repoRoot: string) {
  return invalidResponseMeta({ repoRoot });
}
