/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import type {
  DocsDocument,
  DocsHeading,
  DocsMap,
  DocsMapRequest,
  DocsOutlineRequest,
  DocsOutlineResult,
  DocsOverview,
  DocsOverviewRequest,
  DocsReadSectionRequest,
  DocsReadSectionResult,
  DocsSearchRequest,
  DocsSearchResult,
  DocsWarning,
  ResponseMetadata,
  SourceSection
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import {
  catalogSkipReason,
  type CatalogSkipReason
} from "../../domain/policies/index.js";
import type {
  DocsIndexPort,
  FileCatalogScanPort,
  FileCatalogSkippedPath,
  WorkspaceFilePort
} from "../../ports/index.js";
import {
  extractMarkdownDocLinks,
  markdownTitleFromPath,
  parseMarkdownHeadings
} from "./markdown-docs.js";
import { classifyMarkdownDoc } from "../../domain/policies/index.js";
import {
  classifyMarkdownEntryCurrency,
  loadDocumentationMapOwners,
  publicCurrency
} from "./document-currency-routing.js";
import { capNextActions } from "./response-metadata.js";
import { getCatalogRepoStatus } from "./get-repo-status.js";

const DOC_ROW_LIMIT = 15000;
const DIRECT_READ_CAVEAT = "Docs search is routing evidence; use docs_read_section for precise claims.";
const DOCS_CURSOR_KIND = "docs";

export type DocsOverviewUseCaseResult = {
  overview: DocsOverview;
  meta: ResponseMetadata;
};

export type DocsMapUseCaseResult = {
  map: DocsMap;
  meta: ResponseMetadata;
};

export type DocsSearchUseCaseResult = {
  search: DocsSearchResult;
  meta: ResponseMetadata;
};

export type DocsOutlineUseCaseResult = {
  outline: DocsOutlineResult;
  meta: ResponseMetadata;
};

export type DocsReadSectionUseCaseResult = {
  read: DocsReadSectionResult;
  meta: ResponseMetadata;
};

export async function getDocsOverview(input: {
  request: DocsOverviewRequest;
  scanner: FileCatalogScanPort;
  workspace: WorkspaceFilePort;
  default_repo_root: string;
}): Promise<DocsOverviewUseCaseResult> {
  const index = await loadDocsIndex({
    request: input.request,
    scanner: input.scanner,
    workspace: input.workspace,
    default_repo_root: input.default_repo_root,
    order: "importance"
  });
  const page = paginate(index.documents, {
    cursor: input.request.cursor,
    limit: input.request.max_docs,
    kind: DOCS_CURSOR_KIND
  });
  const docs = page.items
    .map((doc) => publicDocument(limitDocumentHeadings(doc, input.request.max_headings_per_doc)));

  return {
    overview: {
      repo_root: index.repoRoot,
      status: index.warnings.length > 0 ? "needed" : docs.length > 0 ? "done" : "not_applicable",
      summary: `Docs overview found ${docs.length} important doc(s) from ${index.documents.length} indexed Markdown doc(s).`,
      important_docs: docs,
      warnings: index.warnings,
      truncated: index.truncated || page.hasMore,
      cursor: page.nextCursor,
      result_count: index.totalDocuments,
      next_actions: docs.length > 0 ? docsNextActions(index.repoRoot, docs[0]?.path) : []
    },
    meta: docsMeta({ ...index, truncated: index.truncated || page.hasMore })
  };
}

export async function getDocsMap(input: {
  request: DocsMapRequest;
  scanner: FileCatalogScanPort;
  workspace: WorkspaceFilePort;
  default_repo_root: string;
}): Promise<DocsMapUseCaseResult> {
  const index = await loadDocsIndex({
    request: input.request,
    scanner: input.scanner,
    workspace: input.workspace,
    default_repo_root: input.default_repo_root,
    order: "path"
  });
  const page = paginate(index.documents, {
    cursor: input.request.cursor,
    limit: input.request.max_docs,
    kind: DOCS_CURSOR_KIND
  });
  const docs = page.items
    .map((doc) => publicDocument(limitDocumentHeadings(doc, input.request.max_headings_per_doc)));

  return {
    map: {
      repo_root: index.repoRoot,
      status: index.warnings.length > 0 ? "needed" : docs.length > 0 ? "done" : "not_applicable",
      docs,
      warnings: index.warnings,
      truncated: index.truncated || page.hasMore,
      cursor: page.nextCursor,
      result_count: index.totalDocuments,
      next_actions: docs.length > 0 ? docsNextActions(index.repoRoot, docs[0]?.path) : []
    },
    meta: docsMeta({ ...index, truncated: index.truncated || page.hasMore })
  };
}

export async function searchDocs(input: {
  request: DocsSearchRequest;
  docs_index: DocsIndexPort;
  default_repo_root: string;
}): Promise<DocsSearchUseCaseResult> {
  const repoRoot = path.resolve(input.request.repo_root ?? input.default_repo_root);
  const result = await input.docs_index.search({
    repo_root: repoRoot,
    scope_path: input.request.scope_path,
    query: input.request.query,
    max_results: input.request.max_results,
    include_snippets: input.request.include_snippets,
    cursor: input.request.cursor
  });
  const blockedWarning: DocsWarning[] = result.status === "blocked"
    ? [
        {
          reason: result.reason === "unavailable" ? "missing" : "missing",
          message: result.message
        }
      ]
    : [];
  const hits = [...result.hits];

  return {
    search: {
      repo_root: result.repo_root,
      query: input.request.query,
      status: result.status === "blocked" ? "blocked" : hits.length > 0 ? "done" : "not_applicable",
      hits,
      warnings: blockedWarning,
      truncated: result.truncated,
      cursor: result.cursor,
      result_count: result.result_count,
      next_actions: hits.length > 0 ? docsNextActions(result.repo_root, hits[0]?.path, hits[0]?.heading_id) : []
    },
    meta: docsSearchMeta({
      repoRoot: result.repo_root,
      freshness: result.freshness,
      status: result.status === "blocked" ? "blocked" : hits.length > 0 ? "done" : "not_applicable",
      truncated: result.truncated,
      blocked: result.status === "blocked"
    })
  };
}

export async function getDocsOutline(input: {
  request: DocsOutlineRequest;
  scanner: FileCatalogScanPort;
  workspace: WorkspaceFilePort;
  default_repo_root: string;
}): Promise<DocsOutlineUseCaseResult> {
  const repoRoot = path.resolve(input.request.repo_root ?? input.default_repo_root);
  const normalizedPath = normalizeRepoPath(input.request.path);
  const requested = await loadDirectMarkdownDoc({
    workspace: input.workspace,
    path: normalizedPath,
    maxHeadings: 100
  });
  const doc = requested.doc;
  const warnings = requested.warning === undefined ? [] : [requested.warning];

  return {
    outline: {
      repo_root: repoRoot,
      path: normalizedPath,
      status: requested.warning === undefined && doc !== undefined ? "done" : "blocked",
      title: doc?.title ?? markdownTitleFromPath(normalizedPath),
      headings: doc?.headings ?? [],
      warnings,
      next_actions: requested.warning === undefined && doc !== undefined
        ? docsNextActions(repoRoot, normalizedPath, doc.headings[0]?.id)
        : []
    },
    meta: directDocsMeta({
      repoRoot,
      warnings,
      status: requested.warning === undefined && doc !== undefined ? "done" : "needed",
      truncated: false
    })
  };
}

export async function readDocsSection(input: {
  request: DocsReadSectionRequest;
  scanner: FileCatalogScanPort;
  workspace: WorkspaceFilePort;
  default_repo_root: string;
}): Promise<DocsReadSectionUseCaseResult> {
  const repoRoot = path.resolve(input.request.repo_root ?? input.default_repo_root);
  const normalizedPath = normalizeRepoPath(input.request.path);
  const requested = await loadDirectMarkdownDoc({
    workspace: input.workspace,
    path: normalizedPath,
    maxHeadings: 100
  });
  const doc = requested.doc;
  const heading = doc?.headings.find((candidate) => candidate.id === input.request.heading_id);
  const section = doc !== undefined && heading !== undefined
    ? buildSourceSection({
        path: doc.path,
        content: doc.content,
        heading,
        headings: doc.headings,
        maxBytes: input.request.max_bytes
      })
    : undefined;
  const warnings = [
    ...(requested.warning === undefined ? [] : [requested.warning]),
    ...(requested.warning === undefined && doc !== undefined && heading === undefined
      ? [{
          path: normalizedPath,
          reason: "missing" as const,
          message: `Heading '${input.request.heading_id}' was not found in ${normalizedPath}.`
        }]
      : [])
  ];

  return {
    read: {
      repo_root: repoRoot,
      path: normalizedPath,
      heading_id: input.request.heading_id,
      status: section === undefined ? "blocked" : "done",
      heading,
      section,
      warnings,
      next_actions: []
    },
    meta: directDocsMeta({
      repoRoot,
      warnings,
      status: section === undefined ? "needed" : "done",
      truncated: section?.truncated ?? false
    })
  };
}

type LoadedDocsIndex = {
  repoRoot: string;
  documents: Array<DocsDocument & { content: string }>;
  warnings: DocsWarning[];
  skippedPaths: readonly FileCatalogSkippedPath[];
  truncated: boolean;
  scannedFiles: readonly FileCatalogEntry[];
  totalDocuments: number;
};

async function loadDocsIndex(input: {
  request: { repo_root?: string; scope_path?: string; max_docs: number; max_headings_per_doc: number; cursor?: string };
  scanner: FileCatalogScanPort;
  workspace: WorkspaceFilePort;
  default_repo_root: string;
  order: "importance" | "path";
}): Promise<LoadedDocsIndex> {
  const repoRoot = path.resolve(input.request.repo_root ?? input.default_repo_root);
  const scanned = await input.scanner.scan({
    repo_root: repoRoot,
    indexed_roots: ["."],
    skipped_roots: [],
    max_files: DOC_ROW_LIMIT
  });
  const markdownFiles = scanned.files
    .filter((file) => file.file_identity.language === "markdown")
    .filter((file) => isInDocsScope(file.path, input.request.scope_path))
    .sort((left, right) => left.path.localeCompare(right.path));
  const orderedMarkdownFiles = input.order === "importance"
    ? [...markdownFiles].sort((left, right) => docRank(right.path) - docRank(left.path) || left.path.localeCompare(right.path))
    : markdownFiles;
  const warnings = mapSkippedPaths(scanned.skipped_paths ?? []);
  const documents: Array<DocsDocument & { content: string }> = [];
  const owners = await loadDocumentationMapOwners({
    files: scanned.files,
    workspace: input.workspace
  });
  const cursorOffset = decodeCursor(input.request.cursor, DOCS_CURSOR_KIND);
  const readLimit = Math.min(
    orderedMarkdownFiles.length,
    Math.max(input.request.max_docs, 200) + cursorOffset + 1
  );
  for (const file of orderedMarkdownFiles.slice(0, readLimit)) {
    try {
      const content = await input.workspace.readText({ path: file.path });
      const headings = parseMarkdownHeadings(content);
      const title = headings[0]?.text ?? markdownTitleFromPath(file.path);
      const authority = classifyMarkdownEntryCurrency({
        path: file.path,
        title,
        content,
        mtime_ms: file.file_identity.mtime_ms,
        owners
      });
      documents.push({
        path: file.path,
        title,
        headings: headings.slice(0, Math.max(input.request.max_headings_per_doc, 100)),
        links: extractMarkdownDocLinks({ fromPath: file.path, content, docs: markdownFiles }),
        capability_level: "resource_backed",
        evidence_kinds: ["docs"],
        direct_read_caveat: DIRECT_READ_CAVEAT,
        ...publicAuthority(authority),
        ...publicCurrency(authority),
        content
      });
    } catch {
      warnings.push({
        path: file.path,
        reason: "permission_denied",
        message: `Documentation file ${file.path} could not be read.`
      });
    }
  }
  return {
    repoRoot: scanned.repo_root,
    documents: documents,
    warnings,
    skippedPaths: scanned.skipped_paths ?? [],
    truncated: scanned.truncated || orderedMarkdownFiles.length > readLimit,
    scannedFiles: scanned.files,
    totalDocuments: markdownFiles.length
  };
}

function buildSourceSection(input: {
  path: string;
  content: string;
  heading: DocsHeading;
  headings: readonly DocsHeading[];
  maxBytes: number;
}): SourceSection {
  const lines = input.content.split(/\r?\n/u);
  const nextHeading = input.headings.find(
    (heading) => heading.line > input.heading.line && heading.depth <= input.heading.depth
  );
  const startLine = input.heading.line;
  const endLine = nextHeading === undefined ? lines.length : nextHeading.line - 1;
  const text = lines.slice(startLine - 1, endLine).join("\n");
  const limited = Buffer.byteLength(text, "utf8") > input.maxBytes
    ? text.slice(0, input.maxBytes)
    : text;
  return {
    path: input.path,
    start_line: startLine,
    end_line: endLine,
    byte_count: Buffer.byteLength(limited, "utf8"),
    truncated: limited.length !== text.length,
    text: limited,
    caveat: "Section text is direct-read evidence from a repo-relative Markdown file."
  };
}

function docsMeta(index: LoadedDocsIndex): ResponseMetadata {
  const status = getCatalogRepoStatus({
    repo_root: index.repoRoot,
    indexed_roots: ["."],
    skipped_roots: [],
    files: index.scannedFiles,
    freshness: "unknown",
    truncated: index.truncated,
    row_limit: DOC_ROW_LIMIT
  });
  return {
    ...status.meta,
    capability_level: "resource_backed",
    evidence_kinds: ["docs"],
    verification_status: index.warnings.length > 0 ? "needed" : "done",
    truncated: index.truncated,
    budget: {
      row_limit: DOC_ROW_LIMIT
    }
  };
}

function docsSearchMeta(input: {
  repoRoot: string;
  freshness: ResponseMetadata["freshness"];
  status: ResponseMetadata["verification_status"];
  truncated: boolean;
  blocked: boolean;
}): ResponseMetadata {
  return {
    analysis_validity: "valid",
    freshness: input.freshness,
    scope: {
      repo_root: input.repoRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      languages: ["markdown"]
    },
    capability_level: input.blocked ? "unsupported" : "resource_backed",
    evidence_kinds: input.blocked ? [] : ["docs", "fts"],
    verification_status: input.status,
    truncated: input.truncated,
    budget: {
      row_limit: DOC_ROW_LIMIT
    }
  };
}

function docsNextActions(repoRoot: string, filePath?: string, headingId?: string) {
  if (filePath === undefined) return [];
  return capNextActions([
    {
      tool: "docs_outline",
      args: {
        repo_root: repoRoot,
        path: filePath
      }
    },
    ...(headingId === undefined
      ? []
      : [
          {
            tool: "docs_read_section",
            args: {
              repo_root: repoRoot,
              path: filePath,
              heading_id: headingId
            }
          }
        ])
  ]);
}

function mapSkippedPaths(skippedPaths: readonly FileCatalogSkippedPath[]): DocsWarning[] {
  const relevant = skippedPaths.filter((skipped) =>
    ["permission_denied", "missing", "generated_or_vendor", "workspace_escape"].includes(skipped.reason)
  );
  const directWarnings = relevant.filter((skipped) => skipped.reason !== "generated_or_vendor");
  const generatedWarnings = relevant.filter((skipped) => skipped.reason === "generated_or_vendor");
  const compactGenerated = generatedWarnings.length <= 5
    ? generatedWarnings
    : [
        {
          path: undefined,
          reason: "generated_or_vendor" as const,
          detail: `${generatedWarnings.length} generated, dependency, cache, build, or vendor path(s) were excluded from catalog evidence; sample: ${generatedWarnings[0]?.path ?? "unknown"}.`
        }
      ];
  return [...directWarnings, ...compactGenerated]
    .slice(0, 20)
    .map((skipped) => ({
      path: skipped.path,
      reason: skipped.reason,
      message: skipped.detail
    }));
}

async function loadRequestedDoc(input: {
  index: LoadedDocsIndex;
  workspace: WorkspaceFilePort;
  path: string;
  maxHeadings: number;
}): Promise<{
  doc?: DocsDocument & { content: string };
  warning?: DocsWarning;
}> {
  const warning = unsafePathWarning(input.path) ?? skippedPathWarning(input.path, input.index);
  if (warning !== undefined) {
    return { warning };
  }
  const existing = input.index.documents.find((doc) => doc.path === input.path);
  if (existing !== undefined) {
    return { doc: existing };
  }
  const entry = input.index.scannedFiles.find((file) =>
    file.path === input.path && file.file_identity.language === "markdown"
  );
  if (entry === undefined) {
    return {
      warning: {
        path: input.path,
        reason: "missing",
        message: `Documentation file ${input.path} was not found.`
      }
    };
  }
  const markdownFiles = input.index.scannedFiles.filter((file) => file.file_identity.language === "markdown");
  try {
    const content = await input.workspace.readText({ path: entry.path });
    const headings = parseMarkdownHeadings(content);
    const title = headings[0]?.text ?? markdownTitleFromPath(entry.path);
    const owners = await loadDocumentationMapOwners({
      files: input.index.scannedFiles,
      workspace: input.workspace
    });
    const authority = classifyMarkdownEntryCurrency({
      path: entry.path,
      title,
      content,
      mtime_ms: entry.file_identity.mtime_ms,
      owners
    });
    return {
      doc: {
        path: entry.path,
        title,
        headings: headings.slice(0, input.maxHeadings),
        links: extractMarkdownDocLinks({ fromPath: entry.path, content, docs: markdownFiles }),
        capability_level: "resource_backed",
        evidence_kinds: ["docs"],
        direct_read_caveat: DIRECT_READ_CAVEAT,
        ...publicAuthority(authority),
        ...publicCurrency(authority),
        content
      }
    };
  } catch {
    return {
      warning: {
        path: entry.path,
        reason: "permission_denied",
        message: `Documentation file ${entry.path} could not be read.`
      }
    };
  }
}

async function loadDirectMarkdownDoc(input: {
  workspace: WorkspaceFilePort;
  path: string;
  maxHeadings: number;
}): Promise<{
  doc?: DocsDocument & { content: string };
  warning?: DocsWarning;
}> {
  const warning = unsafePathWarning(input.path) ?? directSkipWarning(input.path);
  if (warning !== undefined) {
    return { warning };
  }

  const stat = await input.workspace.stat({ path: input.path });
  if (!stat.exists || !stat.is_file || !input.path.toLowerCase().endsWith(".md")) {
    return {
      warning: {
        path: input.path,
        reason: "missing",
        message: `Documentation file ${input.path} was not found.`
      }
    };
  }

  try {
    const content = await input.workspace.readText({ path: input.path });
    const headings = parseMarkdownHeadings(content);
    const title = headings[0]?.text ?? markdownTitleFromPath(input.path);
    const stat = await input.workspace.stat({ path: input.path });
    const authority = classifyMarkdownEntryCurrency({
      path: input.path,
      title,
      content,
      mtime_ms: stat.mtime_ms
    });
    return {
      doc: {
        path: input.path,
        title,
        headings: headings.slice(0, input.maxHeadings),
        links: [],
        capability_level: "resource_backed",
        evidence_kinds: ["docs"],
        direct_read_caveat: DIRECT_READ_CAVEAT,
        ...publicAuthority(authority),
        ...publicCurrency(authority),
        content
      }
    };
  } catch {
    return {
      warning: {
        path: input.path,
        reason: "permission_denied",
        message: `Documentation file ${input.path} could not be read.`
      }
    };
  }
}

function directSkipWarning(pathValue: string): DocsWarning | undefined {
  const reason = catalogSkipReason({
    relativePath: pathValue,
    isDirectory: false,
    skippedRoots: []
  });
  if (reason === null) {
    return undefined;
  }
  return {
    path: directSkipPath(pathValue, reason),
    reason,
    message: catalogWarningDetail(reason)
  };
}

function directSkipPath(pathValue: string, reason: CatalogSkipReason): string {
  if (reason !== "generated_or_vendor") {
    return pathValue;
  }
  const segments = pathValue.split("/");
  const matched = segments.find((segment) =>
    catalogSkipReason({
      relativePath: segment,
      isDirectory: true,
      skippedRoots: []
    }) === "generated_or_vendor"
  );
  return matched ?? pathValue;
}

function skippedPathWarning(pathValue: string, index: LoadedDocsIndex): DocsWarning | undefined {
  const skipped = index.skippedPaths.find((warning) =>
    warning.path === pathValue || pathValue.startsWith(`${warning.path}/`)
  );
  if (skipped === undefined) {
    return undefined;
  }
  return {
    path: skipped.path,
    reason: skipped.reason,
    message: skipped.detail
  };
}

function directDocsMeta(input: {
  repoRoot: string;
  warnings: readonly DocsWarning[];
  status: ResponseMetadata["verification_status"];
  truncated: boolean;
}): ResponseMetadata {
  return {
    analysis_validity: "valid",
    freshness: "unknown",
    scope: {
      repo_root: input.repoRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      languages: ["markdown"]
    },
    capability_level: "resource_backed",
    evidence_kinds: ["docs"],
    verification_status: input.warnings.length > 0 ? "needed" : input.status,
    truncated: input.truncated,
    budget: {
      row_limit: 1
    }
  };
}

function catalogWarningDetail(reason: CatalogSkipReason): string {
  switch (reason) {
    case "secret":
      return "Secret-bearing local environment file was excluded from catalog evidence.";
    case "generated_or_vendor":
      return "Generated, dependency, cache, build, or vendor path was excluded from catalog evidence.";
    case "configured_skip":
      return "Path matched caller-provided skipped roots.";
    case "hidden_path":
      return "Hidden local path is not allowlisted as repository-shape evidence.";
    case "gitignore":
      return "Path matched repository ignore rules.";
    case "nested_git_repository":
      return "Nested git checkout was excluded from catalog evidence.";
  }
}

function unsafePathWarning(pathValue: string): DocsWarning | undefined {
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
      message: "Documentation path was refused."
    };
  }
  return undefined;
}

function docRank(filePath: string): number {
  const lower = filePath.toLowerCase();
  let score = 0;
  if (lower === "readme.md") score += 100;
  if (lower.includes("guide")) score += 80;
  if (lower.includes("runbook") || lower.includes("operations")) score += 70;
  if (lower.includes("architecture") || lower.includes("design")) score += 65;
  if (lower.startsWith("docs/reference/")) score += 30;
  return score;
}

function paginate<T>(items: readonly T[], input: {
  cursor?: string;
  limit: number;
  kind: string;
}): {
  items: readonly T[];
  hasMore: boolean;
  nextCursor?: string;
} {
  const offset = decodeCursor(input.cursor, input.kind);
  const page = items.slice(offset, offset + input.limit);
  const hasMore = items.length > offset + input.limit;
  return {
    items: page,
    hasMore,
    nextCursor: hasMore ? encodeCursor({ kind: input.kind, offset: offset + page.length }) : undefined
  };
}

function encodeCursor(input: { kind: string; offset: number }): string {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined, kind: string): number {
  if (cursor === undefined) {
    return 0;
  }
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      kind?: unknown;
      offset?: unknown;
    };
    if (parsed.kind !== kind || typeof parsed.offset !== "number" || !Number.isInteger(parsed.offset) || parsed.offset < 0) {
      return 0;
    }
    return parsed.offset;
  } catch {
    return 0;
  }
}

function limitDocumentHeadings<T extends DocsDocument & { content?: string }>(
  doc: T,
  maxHeadings: number
): T {
  return {
    ...doc,
    headings: doc.headings.slice(0, maxHeadings)
  };
}

function publicDocument(doc: DocsDocument & { content?: string }): DocsDocument {
  return {
    path: doc.path,
    title: doc.title,
    headings: doc.headings,
    links: doc.links,
    capability_level: doc.capability_level,
    evidence_kinds: doc.evidence_kinds,
    direct_read_caveat: doc.direct_read_caveat,
    doc_status: doc.doc_status,
    authority: doc.authority,
    authority_caveat: doc.authority_caveat,
    currency_state: doc.currency_state,
    currency_caveats: doc.currency_caveats,
    canonical_owner: doc.canonical_owner,
    superseded_by: doc.superseded_by,
    last_reviewed: doc.last_reviewed,
    modified_at: doc.modified_at,
    git_first_seen: doc.git_first_seen,
    git_last_touched: doc.git_last_touched
  };
}

function publicAuthority(input: ReturnType<typeof classifyMarkdownDoc>) {
  return {
    doc_status: input.doc_status,
    authority: input.authority,
    authority_caveat: input.authority_caveat
  };
}

function normalizeRepoPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function isInDocsScope(filePath: string, scopePath: string | undefined): boolean {
  const normalizedScope = normalizeDocsScopePath(scopePath);
  if (normalizedScope === undefined) return true;
  return filePath === normalizedScope || filePath.startsWith(`${normalizedScope}/`);
}

function normalizeDocsScopePath(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = normalizeRepoPath(value).replace(/\/+$/u, "");
  if (
    normalized.length === 0 ||
    normalized === "." ||
    normalized.startsWith("/") ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    return undefined;
  }
  return normalized;
}
