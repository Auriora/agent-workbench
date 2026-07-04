/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import type {
  AdapterEvidence,
  DiagnosticFinding,
  DiagnosticsForFilesRequest,
  DiagnosticsForFilesResult,
  DiagnosticsProviderStatus,
  ResponseMetadata
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import { describeFileCapability } from "../../domain/policies/index.js";
import type {
  DiagnosticsProviderPort,
  FileCatalogScanPort
} from "../../ports/index.js";
import { getCatalogRepoStatus } from "./get-repo-status.js";

export type DiagnoseChangedFilesResult = {
  diagnostics: DiagnosticsForFilesResult;
  meta: ResponseMetadata;
};

export async function diagnoseChangedFiles(input: {
  request: DiagnosticsForFilesRequest;
  scanner: FileCatalogScanPort;
  providers: readonly DiagnosticsProviderPort[];
  default_repo_root: string;
}): Promise<DiagnoseChangedFilesResult> {
  const repoRoot = path.resolve(input.request.repo_root ?? input.default_repo_root);
  const requestedTargets = input.request.files.map(toDiagnosticsTarget);
  const requestedFiles = uniqueSorted(requestedTargets.map((target) => target.path));
  const safeRequestedFiles = uniqueSorted(
    requestedTargets.filter((target) => !target.unsafe).map((target) => target.path)
  );
  const unsafeFindings = requestedTargets
    .filter((target) => target.unsafe)
    .map((target): DiagnosticFinding => ({
      path: target.path,
      severity: "blocker",
      message: "Diagnostics target path was refused.",
      category: "unsupported",
      provider_id: "workspace",
      capability_level: "unsupported",
      evidence_kinds: [],
      blocking: true,
      fix_hint: "Use a repo-relative file path without traversal or shell metacharacters."
    }));
  const scanned = await input.scanner.scan({
    repo_root: repoRoot,
    indexed_roots: ["."],
    skipped_roots: [],
    max_files: 15000
  });
  const filesByPath = new Map(scanned.files.map((file) => [file.path, file]));
  const selectedFiles = safeRequestedFiles
    .map((filePath) => filesByPath.get(filePath))
    .filter((file): file is FileCatalogEntry => file !== undefined)
    .slice(0, input.request.max_files);

  const providerResults = await collectProviderResults({
    repoRoot: scanned.repo_root,
    files: selectedFiles,
    providers: input.providers
  });
  const missingFindings = requestedFiles
    .filter((filePath) => safeRequestedFiles.includes(filePath) && !filesByPath.has(filePath))
    .map((filePath): DiagnosticFinding => ({
      path: filePath,
      severity: "warning",
      message: "Requested diagnostics file was not found in the scanned repository.",
      category: "unsupported",
      provider_id: "workspace",
      capability_level: "unsupported",
      evidence_kinds: [],
      blocking: false,
      fix_hint: "Verify the repo-relative path before relying on diagnostics."
    }));
  const findings = [...providerResults.findings, ...missingFindings, ...unsafeFindings].sort(compareFindings);
  const blocked = findings.some((finding) => finding.blocking);
  const status = getCatalogRepoStatus({
    repo_root: scanned.repo_root,
    indexed_roots: scanned.indexed_roots,
    skipped_roots: scanned.skipped_roots,
    files: scanned.files,
    freshness: "unknown",
    truncated: scanned.truncated,
    row_limit: 15000
  });
  const diagnostics: DiagnosticsForFilesResult = {
    repo_root: scanned.repo_root,
    status: blocked ? "blocked" : findings.length > 0 ? "needed" : "not_applicable",
    summary: summarizeDiagnostics({ checkedFiles: requestedFiles, findings }),
    checked_files: requestedFiles,
    findings,
    provider_statuses: providerResults.statuses,
    next_actions: [
      {
        tool: "verification_plan",
        args: {
          repo_root: scanned.repo_root,
          changed_files: requestedFiles
        }
      }
    ]
  };

  return {
    diagnostics,
    meta: {
      ...status.meta,
      verification_status: diagnostics.status,
      truncated: scanned.truncated || requestedFiles.length > input.request.max_files,
      budget: {
        row_limit: 15000
      }
    }
  };
}

async function collectProviderResults(input: {
  repoRoot: string;
  files: readonly FileCatalogEntry[];
  providers: readonly DiagnosticsProviderPort[];
}): Promise<{
  statuses: DiagnosticsProviderStatus[];
  findings: DiagnosticFinding[];
}> {
  const statuses: DiagnosticsProviderStatus[] = [];
  const findings: DiagnosticFinding[] = [];
  for (const file of input.files) {
    const providers = input.providers.filter((provider) =>
      provider.supports({
        path: file.path,
        language: file.file_identity.language,
        capability_level: capabilityForFile(file).capability_level
      })
    );
    if (providers.length === 0) {
      statuses.push({
        provider_id: "diagnostics",
        path: file.path,
        status: "not_applicable",
        message: "No diagnostics provider is available for this file.",
        capability_level: capabilityForFile(file).capability_level,
        evidence_kinds: capabilityForFile(file).evidence_kinds
      });
      continue;
    }

    for (const provider of providers) {
      try {
        const result = await provider.diagnose({
          repo_root: input.repoRoot,
          file
        });
        statuses.push(...result.statuses.map((status) => sanitizeProviderStatus(status, file)));
        findings.push(...result.findings.map((finding) => sanitizeFinding(finding)));
      } catch {
        statuses.push({
          provider_id: provider.provider_id,
          path: file.path,
          status: "failed",
          capability_level: capabilityForFile(file).capability_level,
          evidence_kinds: capabilityForFile(file).evidence_kinds
        });
      }
    }
  }
  return {
    statuses: statuses.sort(compareProviderStatuses),
    findings
  };
}

function capabilityForFile(file: FileCatalogEntry): AdapterEvidence {
  return file.adapter_evidence ?? describeFileCapability({
    path: file.path,
    language: file.file_identity.language,
    indexed: file.indexed
  });
}

function sanitizeProviderStatus(
  status: DiagnosticsProviderStatus,
  file: FileCatalogEntry
): DiagnosticsProviderStatus {
  return {
    provider_id: status.provider_id,
    path: status.path === undefined ? file.path : normalizeRepoPath(status.path),
    status: status.status,
    message: status.message,
    capability_level: status.capability_level,
    evidence_kinds: [...status.evidence_kinds]
  };
}

function sanitizeFinding(finding: DiagnosticFinding): DiagnosticFinding {
  return {
    path: normalizeRepoPath(finding.path),
    range: finding.range,
    severity: finding.severity,
    message: finding.message,
    category: finding.category,
    provider_id: finding.provider_id,
    capability_level: finding.capability_level,
    evidence_kinds: [...finding.evidence_kinds],
    blocking: finding.blocking,
    fix_hint: finding.fix_hint
  };
}

function compareProviderStatuses(left: DiagnosticsProviderStatus, right: DiagnosticsProviderStatus): number {
  return `${left.path ?? ""}:${left.provider_id}`.localeCompare(`${right.path ?? ""}:${right.provider_id}`);
}

function compareFindings(left: DiagnosticFinding, right: DiagnosticFinding): number {
  const severity = severityRank(left.severity) - severityRank(right.severity);
  if (severity !== 0) return severity;
  return `${left.path}:${left.provider_id}:${left.message}`.localeCompare(
    `${right.path}:${right.provider_id}:${right.message}`
  );
}

function severityRank(severity: DiagnosticFinding["severity"]): number {
  return severity === "blocker" ? 0 : 1;
}

function summarizeDiagnostics(input: {
  checkedFiles: readonly string[];
  findings: readonly DiagnosticFinding[];
}): string {
  if (input.checkedFiles.length === 0) {
    return "No diagnostics files were supplied.";
  }
  if (input.findings.length === 0) {
    return "Diagnostics completed with no actionable findings.";
  }
  return `${input.findings.length} diagnostics finding(s) need attention across ${input.checkedFiles.length} checked file(s).`;
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function normalizeRepoPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function toDiagnosticsTarget(value: string): {
  path: string;
  unsafe: boolean;
} {
  const normalized = normalizeRepoPath(value);
  const unsafe =
    path.posix.isAbsolute(normalized) ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    /[\0;&|`$<>]/u.test(normalized);
  if (!unsafe) {
    return {
      path: normalized,
      unsafe: false
    };
  }
  const basename = normalized.slice(normalized.lastIndexOf("/") + 1);
  return {
    path: basename.length > 0 && basename !== ".." ? basename : "invalid-path",
    unsafe: true
  };
}
