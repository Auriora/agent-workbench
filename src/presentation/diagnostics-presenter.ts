/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { DiagnoseChangedFilesResult } from "../application/use-cases/diagnose-changed-files.js";
import {
  diagnosticFindingSchema,
  diagnosticsForFilesResultSchema,
  diagnosticsProviderStatusSchema,
  responseMetadataSchema,
  type DiagnosticsForFilesResult,
  type ResponseEnvelope
} from "../contracts/index.js";
import {
  invalidResponseMeta,
  makeTrustedEnvelope,
  presentNextActions,
  type PresentationSessionContext
} from "../application/use-cases/response-metadata.js";

export function buildDiagnosticsForFilesEnvelope(
  result: DiagnoseChangedFilesResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<DiagnosticsForFilesResult> {
  return makeTrustedEnvelope({
    data: sanitizeDiagnosticsResult(result.diagnostics, context),
    meta: responseMetadataSchema.strip().parse(result.meta),
    trust_policy: { surface_kind: "diagnostics_static" }
  });
}

export function buildInvalidDiagnosticsForFilesInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<DiagnosticsForFilesResult> {
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      status: "blocked",
      summary: "Diagnostics input was invalid.",
      checked_files: [],
      findings: [],
      provider_statuses: [],
      next_actions: [
        {
          tool: "verification_plan",
          args: {
            repo_root: input.repoRoot,
            changed_files: []
          }
        }
      ]
    },
    meta: invalidResponseMeta({ repoRoot: input.repoRoot }),
    trust_policy: { surface_kind: "diagnostics_static" },
    errors: [
      {
        code: "invalid_input",
        message: input.message,
        retryable: false,
        next_action: {
          tool: "verification_plan",
          args: {
            repo_root: input.repoRoot,
            changed_files: []
          }
        }
      }
    ]
  });
}

function sanitizeDiagnosticsResult(
  input: DiagnosticsForFilesResult,
  context: PresentationSessionContext
): DiagnosticsForFilesResult {
  return diagnosticsForFilesResultSchema.parse({
    repo_root: input.repo_root,
    status: input.status,
    summary: input.summary,
    checked_files: input.checked_files,
    findings: input.findings.map((finding) => diagnosticFindingSchema.parse(finding)),
    provider_statuses: input.provider_statuses.map((status) =>
      diagnosticsProviderStatusSchema.parse(status)
    ),
    next_actions: presentNextActions(input.next_actions, context)
  });
}
