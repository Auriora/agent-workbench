/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const DOCUMENTATION_CORPUS_POLICY_VERSION = "production-docs-v1" as const;

export type DocumentationCorpusExclusionReason = "embedded_fixture";

export type DocumentationCorpusDecision =
  | {
      relativePath: string;
      status: "eligible";
    }
  | {
      relativePath: string;
      status: "excluded";
      reason: DocumentationCorpusExclusionReason;
    };

export type DocumentationCorpusExclusionCount = {
  reason: DocumentationCorpusExclusionReason;
  count: number;
};

export type DocumentationCorpusDecisionPartition = {
  policy_version: typeof DOCUMENTATION_CORPUS_POLICY_VERSION;
  discovered_markdown_files: number;
  eligible_markdown_files: number;
  excluded_markdown_files: number;
  exclusions: readonly DocumentationCorpusExclusionCount[];
  decisions: readonly DocumentationCorpusDecision[];
  eligible_markdown_paths: readonly string[];
  excluded_markdown_paths: readonly string[];
};

const EMBEDDED_FIXTURE_REASON: DocumentationCorpusExclusionReason = "embedded_fixture";

function failWithInvalidPath(relativePath: string, reason: string): never {
  throw new Error(`Invalid documentation-corpus path '${relativePath}': ${reason}`);
}

function validateCanonicalRelativePosixPath(relativePath: string): void {
  if (relativePath.length === 0) {
    failWithInvalidPath(relativePath, "empty path is not allowed");
  }
  if (relativePath.startsWith("/") || relativePath.includes("\\") || /^[A-Za-z]:/.test(relativePath)) {
    failWithInvalidPath(relativePath, "absolute path is not allowed");
  }

  const segments = relativePath.split("/");
  for (const segment of segments) {
    if (segment.length === 0) {
      failWithInvalidPath(relativePath, "empty path segment is not allowed");
    }
    if (segment === "." || segment === "..") {
      failWithInvalidPath(relativePath, "dot segments are not allowed");
    }
  }
}

function isMarkdownPath(relativePath: string): boolean {
  return relativePath.toLowerCase().endsWith(".md");
}

function isEmbeddedFixtureMarkdown(relativePath: string): boolean {
  if (!isMarkdownPath(relativePath)) {
    return false;
  }

  const segments = relativePath.split("/");
  return (
    segments.length >= 4 &&
    segments[0] === "tests" &&
    segments[1] === "fixtures" &&
    segments[2] !== ""
  );
}

function deterministicStringSort(values: readonly string[]): string[] {
  return [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

export function classifyDocumentationCorpusPath(relativePath: string): DocumentationCorpusDecision {
  validateCanonicalRelativePosixPath(relativePath);

  if (isEmbeddedFixtureMarkdown(relativePath)) {
    return {
      relativePath,
      status: "excluded",
      reason: EMBEDDED_FIXTURE_REASON
    };
  }

  return {
    relativePath,
    status: "eligible"
  };
}

export function partitionDocumentationCorpusPaths(paths: readonly string[]): DocumentationCorpusDecisionPartition {
  const decisions = deterministicStringSort(paths).map((relativePath) => classifyDocumentationCorpusPath(relativePath));
  const eligibleMarkdownPaths = decisions
    .filter((decision): decision is Extract<DocumentationCorpusDecision, { status: "eligible" }> =>
      decision.status === "eligible" && isMarkdownPath(decision.relativePath)
    )
    .map(({ relativePath }) => relativePath);
  const excludedMarkdownPaths = decisions
    .filter((decision): decision is Extract<DocumentationCorpusDecision, { status: "excluded" }> =>
      decision.status === "excluded" && decision.reason === EMBEDDED_FIXTURE_REASON
    )
    .map(({ relativePath }) => relativePath);

  return {
    policy_version: DOCUMENTATION_CORPUS_POLICY_VERSION,
    discovered_markdown_files: eligibleMarkdownPaths.length + excludedMarkdownPaths.length,
    eligible_markdown_files: eligibleMarkdownPaths.length,
    excluded_markdown_files: excludedMarkdownPaths.length,
    exclusions: [
      {
        reason: EMBEDDED_FIXTURE_REASON,
        count: excludedMarkdownPaths.length
      }
    ],
    decisions,
    eligible_markdown_paths: eligibleMarkdownPaths,
    excluded_markdown_paths: excludedMarkdownPaths
  };
}
