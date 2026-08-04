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
import {
  sanitizePublicMcpFailureMessage,
  sanitizePublicMcpRuntimeErrors
} from "./redaction.js";

export function buildDiagnosticsForFilesEnvelope(
  result: DiagnoseChangedFilesResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<DiagnosticsForFilesResult> {
  return makeTrustedEnvelope({
    data: sanitizeDiagnosticsResult(result.diagnostics, context),
    meta: responseMetadataSchema.strip().parse(result.meta),
    trust_policy: { surface_kind: result.errors?.length ? "generic_error" : "diagnostics_static" },
    errors: sanitizePublicMcpRuntimeErrors(
      result.errors,
      "Diagnostics failed; inspect the error code and retry guidance."
    )
  });
}

export function buildInvalidDiagnosticsForFilesInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<DiagnosticsForFilesResult> {
  const message = sanitizePublicMcpFailureMessage(
    input.message,
    "Diagnostics input was invalid; inspect the request and retry."
  );
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
        message,
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

export function buildDiagnosticsForFilesProviderFailureEnvelope(input: {
  repoRoot: string;
  message: string;
  classification: "provider_unavailable" | "internal_error";
}): ResponseEnvelope<DiagnosticsForFilesResult> {
  const message = sanitizePublicMcpFailureMessage(
    input.message,
    "Diagnostics failed before completion; inspect the error code and retry guidance."
  );
  const summary = input.classification === "provider_unavailable"
    ? "Diagnostics are unavailable because the provider is not configured."
    : message;
  return makeTrustedEnvelope({
    data: {
      repo_root: input.repoRoot,
      status: "blocked",
      summary,
      checked_files: [],
      findings: [],
      provider_statuses: [],
      next_actions: []
    },
    meta: invalidResponseMeta({
      repoRoot: input.repoRoot,
      analysis_validity: "invalid_due_to_environment"
    }),
    trust_policy: { surface_kind: "diagnostics_static" },
    errors: [
      {
        code: input.classification,
        message,
        retryable: input.classification === "internal_error"
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
