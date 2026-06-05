import type { DiagnoseChangedFilesResult } from "../application/use-cases/diagnose-changed-files.js";
import {
  diagnosticFindingSchema,
  diagnosticsForFilesResultSchema,
  diagnosticsProviderStatusSchema,
  makeEnvelope,
  responseMetadataSchema,
  type DiagnosticsForFilesResult,
  type ResponseEnvelope
} from "../contracts/index.js";
import { invalidResponseMeta } from "./metadata.js";

export function buildDiagnosticsForFilesEnvelope(
  result: DiagnoseChangedFilesResult
): ResponseEnvelope<DiagnosticsForFilesResult> {
  return makeEnvelope({
    data: sanitizeDiagnosticsResult(result.diagnostics),
    meta: responseMetadataSchema.strip().parse(result.meta)
  });
}

export function buildInvalidDiagnosticsForFilesInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<DiagnosticsForFilesResult> {
  return makeEnvelope({
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

function sanitizeDiagnosticsResult(input: DiagnosticsForFilesResult): DiagnosticsForFilesResult {
  return diagnosticsForFilesResultSchema.parse({
    repo_root: input.repo_root,
    status: input.status,
    summary: input.summary,
    checked_files: input.checked_files,
    findings: input.findings.map((finding) => diagnosticFindingSchema.parse(finding)),
    provider_statuses: input.provider_statuses.map((status) =>
      diagnosticsProviderStatusSchema.parse(status)
    ),
    next_actions: input.next_actions
  });
}
