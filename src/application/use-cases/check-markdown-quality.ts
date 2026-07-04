/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
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
        : `Markdown document ${normalizedPath} has ${checked.findings.length} quality finding(s).`,
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
    })
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
  const markdownPaths = normalizedScope === undefined
    ? []
    : scanned.files
        .filter((file) => file.file_identity.language === "markdown")
        .map((file) => file.path)
        .filter((filePath) => filePath === normalizedScope || normalizedScope === "." || filePath.startsWith(`${normalizedScope}/`));
  const selectedPaths = uniqueSorted([
    ...normalizedPaths,
    ...markdownPaths.slice(0, request.max_documents)
  ]).slice(0, request.max_documents);

  const checks = [];
  for (const filePath of selectedPaths) {
    checks.push(
      await checkMarkdownDocument({
        request: {
          repo_root: scanned.repo_root,
          path: filePath,
          max_findings: request.max_findings,
          max_evidence_bytes: request.max_evidence_bytes,
          max_file_bytes: request.max_file_bytes,
          required_frontmatter: request.required_frontmatter
        },
        scanner: input.scanner,
        workspace: input.workspace,
        parser: input.parser,
        checker: input.checker,
        default_repo_root: scanned.repo_root
      })
    );
  }

  const findings = checks.flatMap((result) => result.check.findings).slice(0, request.max_findings);
  const warnings = checks.flatMap((result) => result.check.warnings);
  const checkedDocuments = checks
    .filter((result) => result.check.status === "done")
    .map((result) => result.check.path)
    .sort();
  const skippedDocuments = checks
    .filter((result) => result.check.status !== "done")
    .map((result) => result.check.path)
    .sort();
  const truncated =
    scanned.truncated ||
    checks.some((result) => result.check.truncated) ||
    findings.length < checks.flatMap((result) => result.check.findings).length ||
    markdownPaths.length > request.max_documents;
  const status = selectedPaths.length === 0
    ? "blocked"
    : checkedDocuments.length === 0
      ? "skipped"
      : "done";
  const setCheck: CheckMarkdownSetResult = {
    repo_root: scanned.repo_root,
    status,
    summary: `Markdown set check examined ${checkedDocuments.length} document(s), skipped ${skippedDocuments.length}, and found ${findings.length} issue(s).`,
    checked_documents: checkedDocuments,
    skipped_documents: skippedDocuments,
    findings,
    warnings,
    truncated,
    next_actions: []
  };
  return {
    check: setCheck,
    meta: markdownQualityMeta({
      repoRoot: scanned.repo_root,
      scannedFiles: scanned.files,
      warnings,
      truncated,
      verificationStatus: status === "blocked" ? "blocked" : findings.length === 0 ? "done" : "needed",
      analysisValidity: status === "blocked" ? "invalid" : truncated ? "partial" : "valid"
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
    })
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
