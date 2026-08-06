/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import { createHash } from "node:crypto";
import type {
  CheckMarkdownDocumentRequest,
  CheckMarkdownDocumentResult,
  CheckMarkdownSetRequest,
  CheckMarkdownSetResult,
  MarkdownQualityWarning,
  ResponseMetadata
} from "../../contracts/index.js";
import {
  checkMarkdownDocumentRequestSchema,
  checkMarkdownSetRequestSchema
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import type {
  FileCatalogScanPort,
  MarkdownParserPort,
  MarkdownStructureCheckPort,
  WorkspaceFilePort
} from "../../ports/index.js";
import { getCatalogRepoStatus } from "./get-repo-status.js";

const MARKDOWN_QUALITY_ROW_LIMIT = 15000;

export type CheckMarkdownDocumentUseCaseResult = {
  check: CheckMarkdownDocumentResult;
  meta: ResponseMetadata;
  document_truncated?: boolean;
};

export type CheckMarkdownSetUseCaseResult = {
  check: CheckMarkdownSetResult;
  meta: ResponseMetadata;
};

export async function checkMarkdownDocument(input: {
  request: CheckMarkdownDocumentRequest;
  scanner: FileCatalogScanPort;
  workspace: WorkspaceFilePort;
  parser: MarkdownParserPort;
  checker: MarkdownStructureCheckPort;
  default_repo_root: string;
}): Promise<CheckMarkdownDocumentUseCaseResult> {
  const request = checkMarkdownDocumentRequestSchema.parse(input.request);
  const repoRoot = path.resolve(request.repo_root ?? input.default_repo_root);
  const normalizedPath = normalizeRepoPath(request.path);
  const unsafe = unsafePathWarning(normalizedPath);
  if (unsafe !== undefined) {
    return blockedResult({ repoRoot, path: normalizedPath, warning: unsafe, scannedFiles: [] });
  }

  const scanned = await input.scanner.scan({
    repo_root: repoRoot,
    indexed_roots: ["."],
    skipped_roots: [],
    max_files: MARKDOWN_QUALITY_ROW_LIMIT
  });
  return checkMarkdownDocumentFromCatalog({
    request,
    normalizedPath,
    scanned,
    workspace: input.workspace,
    parser: input.parser,
    checker: input.checker
  });
}

async function checkMarkdownDocumentFromCatalog(input: {
  request: CheckMarkdownDocumentRequest;
  normalizedPath: string;
  scanned: Awaited<ReturnType<FileCatalogScanPort["scan"]>>;
  workspace: WorkspaceFilePort;
  parser: MarkdownParserPort;
  checker: MarkdownStructureCheckPort;
}): Promise<CheckMarkdownDocumentUseCaseResult> {
  const { request, normalizedPath, scanned } = input;
  const markdownFiles = scanned.files
    .filter((file) => file.file_identity.language === "markdown")
    .sort((left, right) => left.path.localeCompare(right.path));
  const skippedWarning = skippedPathWarning(normalizedPath, scanned.skipped_paths ?? []);
  if (skippedWarning !== undefined) {
    return skippedResult({
      repoRoot: scanned.repo_root,
      path: normalizedPath,
      warning: skippedWarning,
      truncated: scanned.truncated,
      scannedFiles: scanned.files
    });
  }

  const file = markdownFiles.find((candidate) => candidate.path === normalizedPath);
  if (file === undefined) {
    return blockedResult({
      repoRoot: scanned.repo_root,
      path: normalizedPath,
      warning: {
        path: normalizedPath,
        reason: "missing",
        message: `Markdown document ${normalizedPath} was not found.`
      },
      truncated: scanned.truncated,
      scannedFiles: scanned.files
    });
  }
  if (file.file_identity.size_bytes > request.max_file_bytes) {
    return skippedResult({
      repoRoot: scanned.repo_root,
      path: normalizedPath,
      warning: {
        path: normalizedPath,
        reason: "file_too_large",
        message: `Markdown document ${normalizedPath} exceeds the check budget.`
      },
      truncated: scanned.truncated,
      scannedFiles: scanned.files
    });
  }

  const content = await input.workspace.readText({ path: normalizedPath });
  const document = input.parser.parse({ path: normalizedPath, content });
  const checked = input.checker.check({
    document,
    repo_root: scanned.repo_root,
    existing_markdown_paths: new Set(markdownFiles.map((candidate) => candidate.path)),
    required_frontmatter: request.required_frontmatter,
    max_findings: request.max_findings,
    max_evidence_bytes: request.max_evidence_bytes
  });

  const warnings = mapSkippedWarnings(scanned.skipped_paths ?? []);
  const truncated = scanned.truncated || checked.truncated;
  return {
    check: {
      repo_root: scanned.repo_root,
      path: normalizedPath,
      status: "done",
      summary: checked.findings.length === 0
        ? `Markdown document ${normalizedPath} has no quality findings.`
        : `Markdown document ${normalizedPath} has ${checked.finding_count} quality finding(s).`,
      finding_count: checked.finding_count,
      findings: [...checked.findings],
      warnings,
      truncated,
      next_actions: []
    },
    meta: markdownQualityMeta({
      repoRoot: scanned.repo_root,
      scannedFiles: scanned.files,
      warnings,
      truncated,
      verificationStatus: checked.findings.length === 0 ? "done" : "needed",
      analysisValidity: truncated ? "partial" : "valid"
    }),
    document_truncated: checked.truncated
  };
}

export async function checkMarkdownSet(input: {
  request: CheckMarkdownSetRequest;
  scanner: FileCatalogScanPort;
  workspace: WorkspaceFilePort;
  parser: MarkdownParserPort;
  checker: MarkdownStructureCheckPort;
  default_repo_root: string;
}): Promise<CheckMarkdownSetUseCaseResult> {
  const request = checkMarkdownSetRequestSchema.parse(input.request);
  const repoRoot = path.resolve(request.repo_root ?? input.default_repo_root);
  const normalizedPaths = uniqueSorted(request.paths.map(normalizeRepoPath));
  const normalizedScope = request.scope_path === undefined ? undefined : normalizeRepoPath(request.scope_path);
  const unsafePath = [...normalizedPaths, ...(normalizedScope === undefined ? [] : [normalizedScope])]
    .map(unsafePathWarning)
    .find((warning) => warning !== undefined);
  if (unsafePath !== undefined) {
    return blockedSetResult({ repoRoot, warning: unsafePath, scannedFiles: [] });
  }
  if (normalizedPaths.length === 0 && normalizedScope === undefined) {
    return blockedSetResult({
      repoRoot,
      warning: {
        reason: "missing",
        message: "check_markdown_set requires explicit paths or a bounded scope_path."
      },
      scannedFiles: []
    });
  }

  const scanned = await input.scanner.scan({
    repo_root: repoRoot,
    indexed_roots: ["."],
    skipped_roots: [],
    max_files: MARKDOWN_QUALITY_ROW_LIMIT
  });
  const scopedMarkdownPaths = normalizedScope === undefined
    ? []
    : scanned.files
        .filter((file) => file.file_identity.language === "markdown")
        .map((file) => file.path)
        .filter((filePath) => filePath === normalizedScope || normalizedScope === "." || filePath.startsWith(`${normalizedScope}/`));
  const excludedActiveSpecPaths = request.exclude_active_specs
    ? scopedMarkdownPaths.filter(isActiveSpecDocument)
    : [];
  const markdownPaths = request.exclude_active_specs
    ? scopedMarkdownPaths.filter((filePath) => !isActiveSpecDocument(filePath))
    : scopedMarkdownPaths;
  const candidatePaths = uniqueSorted([
    ...normalizedPaths,
    ...markdownPaths
  ]);
  const candidateFingerprint = createHash("sha256")
    .update(JSON.stringify({
      paths: candidatePaths,
      scope_path: normalizedScope,
      explicit_paths: normalizedPaths,
      exclude_active_specs: request.exclude_active_specs
    }))
    .digest("hex");
  const cursor = decodeMarkdownAuditCursor(request.cursor);
  if (cursor === "invalid" || (cursor !== undefined && cursor.fingerprint !== candidateFingerprint)) {
    return blockedSetResult({
      repoRoot: scanned.repo_root,
      warning: {
        reason: "configured_skip",
        message: "Markdown audit cursor is invalid or no longer matches the selected document set."
      },
      scannedFiles: scanned.files
    });
  }
  const offset = cursor?.offset ?? 0;
  if (offset > candidatePaths.length || (offset === candidatePaths.length && candidatePaths.length > 0)) {
    return blockedSetResult({
      repoRoot: scanned.repo_root,
      warning: {
        reason: "configured_skip",
        message: "Markdown audit cursor offset is outside the selected document set."
      },
      scannedFiles: scanned.files
    });
  }
  const selectedPaths = candidatePaths.slice(offset, offset + request.max_documents);

  const checks = [];
  for (const filePath of selectedPaths) {
    checks.push(
      await checkMarkdownDocumentFromCatalog({
        request: {
          repo_root: scanned.repo_root,
          path: filePath,
          max_findings: request.max_findings,
          max_evidence_bytes: request.max_evidence_bytes,
          max_file_bytes: request.max_file_bytes,
          required_frontmatter: request.required_frontmatter
        },
        normalizedPath: filePath,
        scanned,
        workspace: input.workspace,
        parser: input.parser,
        checker: input.checker
      })
    );
  }

  const allReturnedFindings = checks.flatMap((result) => result.check.findings);
  const findingCount = checks.reduce((sum, result) => sum + result.check.finding_count, 0);
  const findings = allReturnedFindings.slice(0, request.max_findings);
  const warnings = checks.flatMap((result) => result.check.warnings);
  const checkedDocuments = checks
    .filter((result) => result.check.status === "done")
    .map((result) => result.check.path)
    .sort();
  const skippedDocuments = checks
    .filter((result) => result.check.status !== "done")
    .map((result) => result.check.path)
    .sort();
  const nextOffset = offset + selectedPaths.length;
  const hasMore = nextOffset < candidatePaths.length;
  const nextCursor = hasMore
    ? encodeMarkdownAuditCursor({ offset: nextOffset, fingerprint: candidateFingerprint })
    : undefined;
  const documentResults = checks.map((result) => ({
    path: result.check.path,
    status: result.check.status !== "done"
      ? "skipped" as const
      : result.document_truncated === true
        ? "budget_truncated" as const
        : result.check.findings.length > 0
          ? "checked_with_findings" as const
          : "checked_clean" as const,
    finding_count: result.check.findings.length
  }));
  const uncheckedPreview = candidatePaths
    .slice(nextOffset, nextOffset + request.max_documents)
    .map((pathValue) => ({ path: pathValue, status: "unchecked" as const, finding_count: 0 }));
  const budgetTruncatedCount = documentResults.filter((receipt) => receipt.status === "budget_truncated").length;
  const truncated =
    scanned.truncated ||
    budgetTruncatedCount > 0 ||
    findingCount > findings.length ||
    hasMore;
  const status = selectedPaths.length === 0
    ? "done"
    : hasMore
      ? "partial"
      : checkedDocuments.length === 0
        ? "skipped"
        : truncated
          ? "partial"
          : "done";
  const setCheck: CheckMarkdownSetResult = {
    repo_root: scanned.repo_root,
    status,
    summary: `Markdown set check examined ${checkedDocuments.length} document(s), skipped ${skippedDocuments.length}, and found ${findingCount} issue(s).`,
    checked_documents: checkedDocuments,
    skipped_documents: skippedDocuments,
    document_results: [...documentResults, ...uncheckedPreview],
    coverage: {
      total_documents: candidatePaths.length,
      offset,
      chunk_size: selectedPaths.length,
      checked_count: checkedDocuments.length,
      skipped_count: skippedDocuments.length,
      checked_clean_count: documentResults.filter((receipt) => receipt.status === "checked_clean").length,
      checked_with_findings_count: documentResults.filter((receipt) => receipt.status === "checked_with_findings").length,
      budget_truncated_count: budgetTruncatedCount,
      finding_count: findingCount,
      returned_finding_count: findings.length,
      unchecked_count: candidatePaths.length - nextOffset,
      excluded_active_spec_count: excludedActiveSpecPaths.length,
      complete: !hasMore
    },
    continuation: {
      ...(normalizedScope === undefined ? {} : { scope_path: normalizedScope }),
      offset,
      ...(nextCursor === undefined ? {} : { next_cursor: nextCursor }),
      has_more: hasMore,
      candidate_fingerprint: candidateFingerprint,
      exclude_active_specs: request.exclude_active_specs
    },
    findings,
    warnings,
    truncated,
    next_actions: nextCursor === undefined ? [] : [{
      tool: "check_markdown_set",
      args: {
        paths: normalizedPaths,
        ...(normalizedScope === undefined ? {} : { scope_path: normalizedScope }),
        cursor: nextCursor,
        exclude_active_specs: request.exclude_active_specs,
        max_documents: request.max_documents,
        max_findings: request.max_findings,
        max_evidence_bytes: request.max_evidence_bytes,
        max_file_bytes: request.max_file_bytes,
        required_frontmatter: request.required_frontmatter
      },
      reason: "Continue the same deterministic Markdown audit with the next bounded chunk.",
      expected_evidence: "The next document chunk with updated coverage and continuation state."
    }]
  };
  return {
    check: setCheck,
    meta: markdownQualityMeta({
      repoRoot: scanned.repo_root,
      scannedFiles: scanned.files,
      warnings,
      truncated,
      verificationStatus: status === "skipped"
          ? "not_applicable"
          : status === "partial"
            ? "needed"
            : findings.length === 0
            ? "done"
            : "needed",
      analysisValidity: status === "skipped" || status === "partial" || truncated
          ? "partial"
          : "valid"
    })
  };
}

function skippedResult(input: {
  repoRoot: string;
  path: string;
  warning: MarkdownQualityWarning;
  truncated?: boolean;
  scannedFiles: readonly FileCatalogEntry[];
}): CheckMarkdownDocumentUseCaseResult {
  return {
    check: {
      repo_root: input.repoRoot,
      path: input.path,
      status: "skipped",
      summary: `Markdown document ${input.path} was skipped: ${input.warning.message}`,
      finding_count: 0,
      findings: [],
      warnings: [input.warning],
      truncated: input.truncated ?? false,
      next_actions: []
    },
    meta: markdownQualityMeta({
      repoRoot: input.repoRoot,
      scannedFiles: input.scannedFiles,
      warnings: [input.warning],
      truncated: input.truncated ?? false,
      verificationStatus: "not_applicable",
      analysisValidity: "partial"
    }),
    document_truncated: false
  };
}

function blockedResult(input: {
  repoRoot: string;
  path: string;
  warning: MarkdownQualityWarning;
  truncated?: boolean;
  scannedFiles: readonly FileCatalogEntry[];
}): CheckMarkdownDocumentUseCaseResult {
  return {
    check: {
      repo_root: input.repoRoot,
      path: input.path,
      status: "blocked",
      summary: `Markdown document ${input.path} could not be checked: ${input.warning.message}`,
      finding_count: 0,
      findings: [],
      warnings: [input.warning],
      truncated: input.truncated ?? false,
      next_actions: []
    },
    meta: markdownQualityMeta({
      repoRoot: input.repoRoot,
      scannedFiles: input.scannedFiles,
      warnings: [input.warning],
      truncated: input.truncated ?? false,
      verificationStatus: "blocked",
      analysisValidity: "invalid"
    }),
    document_truncated: false
  };
}

function blockedSetResult(input: {
  repoRoot: string;
  warning: MarkdownQualityWarning;
  truncated?: boolean;
  scannedFiles: readonly FileCatalogEntry[];
}): CheckMarkdownSetUseCaseResult {
  return {
    check: {
      repo_root: input.repoRoot,
      status: "blocked",
      summary: `Markdown set could not be checked: ${input.warning.message}`,
      checked_documents: [],
      skipped_documents: [],
      document_results: [],
      coverage: {
        total_documents: 0,
        offset: 0,
        chunk_size: 0,
        checked_count: 0,
        skipped_count: 0,
        checked_clean_count: 0,
        checked_with_findings_count: 0,
        budget_truncated_count: 0,
        finding_count: 0,
        returned_finding_count: 0,
        unchecked_count: 0,
        excluded_active_spec_count: 0,
        complete: false
      },
      continuation: {
        offset: 0,
        has_more: false,
        candidate_fingerprint: "",
        exclude_active_specs: false
      },
      findings: [],
      warnings: [input.warning],
      truncated: input.truncated ?? false,
      next_actions: []
    },
    meta: markdownQualityMeta({
      repoRoot: input.repoRoot,
      scannedFiles: input.scannedFiles,
      warnings: [input.warning],
      truncated: input.truncated ?? false,
      verificationStatus: "blocked",
      analysisValidity: "invalid"
    })
  };
}

type MarkdownAuditCursor = { offset: number; fingerprint: string };

function encodeMarkdownAuditCursor(cursor: MarkdownAuditCursor): string {
  return Buffer.from(JSON.stringify({ version: 1, ...cursor }), "utf8").toString("base64url");
}

function decodeMarkdownAuditCursor(value: string | undefined): MarkdownAuditCursor | "invalid" | undefined {
  if (value === undefined) return undefined;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      typeof decoded !== "object" || decoded === null ||
      (decoded as { version?: unknown }).version !== 1 ||
      !Number.isInteger((decoded as { offset?: unknown }).offset) ||
      Number((decoded as { offset?: unknown }).offset) < 0 ||
      typeof (decoded as { fingerprint?: unknown }).fingerprint !== "string"
    ) return "invalid";
    return {
      offset: Number((decoded as { offset: number }).offset),
      fingerprint: (decoded as { fingerprint: string }).fingerprint
    };
  } catch {
    return "invalid";
  }
}

function isActiveSpecDocument(pathValue: string): boolean {
  return /^docs\/specs\/[^/]+\//.test(pathValue);
}

function markdownQualityMeta(input: {
  repoRoot: string;
  scannedFiles: readonly FileCatalogEntry[];
  warnings: readonly MarkdownQualityWarning[];
  truncated: boolean;
  verificationStatus: ResponseMetadata["verification_status"];
  analysisValidity: ResponseMetadata["analysis_validity"];
}): ResponseMetadata {
  const status = getCatalogRepoStatus({
    repo_root: input.repoRoot,
    indexed_roots: ["."],
    skipped_roots: [],
    files: input.scannedFiles,
    freshness: "unknown",
    truncated: input.truncated,
    row_limit: MARKDOWN_QUALITY_ROW_LIMIT
  });
  return {
    ...status.meta,
    analysis_validity: input.analysisValidity,
    capability_level: "resource_backed",
    evidence_kinds: input.analysisValidity === "invalid" ? [] : ["docs", "direct_read"],
    verification_status: input.verificationStatus,
    truncated: input.truncated,
    budget: {
      row_limit: MARKDOWN_QUALITY_ROW_LIMIT
    }
  };
}

function skippedPathWarning(
  pathValue: string,
  skippedPaths: readonly { path: string; reason: MarkdownQualityWarning["reason"]; detail: string }[]
): MarkdownQualityWarning | undefined {
  const skipped = skippedPaths.find((candidate) =>
    candidate.path === pathValue || pathValue.startsWith(`${candidate.path}/`)
  );
  if (skipped === undefined) return undefined;
  return {
    path: skipped.path,
    reason: skipped.reason,
    message: skipped.detail
  };
}

function mapSkippedWarnings(
  skippedPaths: readonly { path: string; reason: MarkdownQualityWarning["reason"]; detail: string }[]
): MarkdownQualityWarning[] {
  return skippedPaths
    .filter((skipped) => skipped.reason !== "generated_or_vendor")
    .slice(0, 10)
    .map((skipped) => ({
      path: skipped.path,
      reason: skipped.reason,
      message: skipped.detail
    }));
}

function unsafePathWarning(pathValue: string): MarkdownQualityWarning | undefined {
  if (
    path.posix.isAbsolute(pathValue) ||
    pathValue === ".." ||
    pathValue.startsWith("../") ||
    pathValue.includes("/../") ||
    /[\0;&|`$<>]/u.test(pathValue)
  ) {
    return {
      path: pathValue,
      reason: "workspace_escape",
      message: "Markdown document path was refused."
    };
  }
  return undefined;
}

function normalizeRepoPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}
