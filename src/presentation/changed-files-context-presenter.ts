/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  changedFilesContextResultSchema,
  responseMetadataSchema,
  type ChangedFilesContextResult,
  type ResponseEnvelope
} from "../contracts/index.js";
import type { ChangedFilesContextUseCaseResult } from "../application/use-cases/get-changed-files-context.js";
import {
  invalidResponseMeta,
  makeTrustedEnvelope,
  presentNextActions
} from "../application/use-cases/response-metadata.js";
import { sanitizePublicMcpFailureMessage } from "./redaction.js";
import { buildDiagnosticsForFilesEnvelope } from "./diagnostics-presenter.js";
import { buildVerificationPlanEnvelope } from "./verification-plan-presenter.js";

export function buildChangedFilesContextEnvelope(
  result: ChangedFilesContextUseCaseResult
): ResponseEnvelope<ChangedFilesContextResult> {
  return makeTrustedEnvelope({
    data: changedFilesContextResultSchema.parse({
      ...result.context,
      next_actions: presentNextActions(result.context.next_actions),
      diagnostics: result.context.diagnostics.value === undefined
        ? result.context.diagnostics
        : {
            ...result.context.diagnostics,
            value: buildDiagnosticsForFilesEnvelope({
              diagnostics: result.context.diagnostics.value,
              meta: result.meta
            }).data
          },
      verification: result.context.verification.value === undefined
        ? result.context.verification
        : {
            ...result.context.verification,
            value: buildVerificationPlanEnvelope({
              plan: result.context.verification.value,
              meta: result.meta
            }).data
          }
    }),
    meta: responseMetadataSchema.strip().parse(result.meta),
    trust_policy: { surface_kind: "context_routing" },
    errors: result.errors?.map((error) => ({
      ...error,
      message: sanitizePublicMcpFailureMessage(error.message, "Changed-files context evidence was unavailable.")
    }))
  });
}

export function buildInvalidChangedFilesContextInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<ChangedFilesContextResult> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      state: "blocked",
      changes: {
        state: "blocked",
        staged: [],
        unstaged: [],
        untracked: [],
        changed_files: [],
        reason: "Changed-files context input was invalid."
      },
      repository_status: { state: "blocked", reason: "Input validation failed." },
      diagnostics: { state: "not_applicable" },
      verification: { state: "not_applicable" },
      next_actions: []
    },
    meta: invalidResponseMeta({ repoRoot: input.repoRoot }),
    trust_policy: { surface_kind: "context_routing" },
    errors: [{
      code: "invalid_input",
      message: sanitizePublicMcpFailureMessage(input.message, "Changed-files context input was invalid."),
      retryable: false
    }]
  });
}
