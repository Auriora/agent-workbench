/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { BuildPostEditFeedbackResult } from "../application/use-cases/build-post-edit-feedback.js";
import {
  postEditFeedbackFindingSchema,
  postEditFeedbackResultSchema,
  responseMetadataSchema,
  type PostEditFeedbackResult,
  type ResponseEnvelope
} from "../contracts/index.js";
import { makeTrustedEnvelope } from "../application/use-cases/response-metadata.js";

export function buildPostEditFeedbackEnvelope(
  result: BuildPostEditFeedbackResult
): ResponseEnvelope<PostEditFeedbackResult> {
  return makeTrustedEnvelope({
    data: sanitizePostEditFeedback(result.feedback),
    meta: responseMetadataSchema.strip().parse(result.meta),
    trust_policy: { surface_kind: "diagnostics_static" }
  });
}

export function buildPostEditHookMessage(
  result: BuildPostEditFeedbackResult
): string | undefined {
  if (result.feedback.findings.length === 0) {
    return undefined;
  }
  return result.feedback.visible_message;
}

function sanitizePostEditFeedback(input: PostEditFeedbackResult): PostEditFeedbackResult {
  return postEditFeedbackResultSchema.parse({
    repo_root: input.repo_root,
    status: input.status,
    outcome: input.outcome,
    summary: input.summary,
    checked_files: input.checked_files,
    findings: input.findings.map((finding) => postEditFeedbackFindingSchema.parse(finding)),
    deferred_checks: input.deferred_checks,
    visible_message: input.visible_message,
    next_actions: input.next_actions
  });
}
