import path from "node:path";
import type {
  DocsDocument,
  DocsHeading,
  DocsLink,
  DocsMap,
  DocsMapRequest,
  DocsOutlineRequest,
  DocsOutlineResult,
  DocsOverview,
  DocsOverviewRequest,
  DocsReadSectionRequest,
  DocsReadSectionResult,
  DocsSearchHit,
  DocsSearchRequest,
  DocsSearchResult,
  DocsWarning,
  ResponseMetadata,
  SourceSection
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import type {
  FileCatalogScanPort,
  FileCatalogSkippedPath,
  WorkspaceFilePort
} from "../../ports/index.js";
import { capNextActions } from "../../presentation/metadata.js";
import { getCatalogRepoStatus } from "./get-repo-status.js";

const DOC_ROW_LIMIT = 2000;
const DIRECT_READ_CAVEAT = "Docs search is routing evidence; use docs_read_section for precise claims.";

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
    default_repo_root: input.default_repo_root
  });
  const docs = rankImportantDocs(index.documents)
    .slice(0, input.request.max_docs)
    .map((doc) => publicDocument(limitDocumentHeadings(doc, input.request.max_headings_per_doc)));

  return {
    overview: {
      repo_root: index.repoRoot,
      status: index.warnings.length > 0 ? "needed" : docs.length > 0 ? "done" : "not_applicable",
      summary: `Docs overview found ${docs.length} important doc(s) from ${index.documents.length} indexed Markdown doc(s).`,
      important_docs: docs,
      warnings: index.warnings,
      truncated: index.truncated || index.documents.length > input.request.max_docs,
      next_actions: docs.length > 0 ? docsNextActions(index.repoRoot, docs[0]?.path) : []
    },
    meta: docsMeta(index)
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
    default_repo_root: input.default_repo_root
  });
  const docs = index.documents
    .slice(0, input.request.max_docs)
    .map((doc) => publicDocument(limitDocumentHeadings(doc, input.request.max_headings_per_doc)));

  return {
    map: {
      repo_root: index.repoRoot,
      status: index.warnings.length > 0 ? "needed" : docs.length > 0 ? "done" : "not_applicable",
      docs,
      warnings: index.warnings,
      truncated: index.truncated || index.documents.length > input.request.max_docs,
      next_actions: docs.length > 0 ? docsNextActions(index.repoRoot, docs[0]?.path) : []
    },
    meta: docsMeta(index)
  };
}

export async function searchDocs(input: {
  request: DocsSearchRequest;
  scanner: FileCatalogScanPort;
  workspace: WorkspaceFilePort;
  default_repo_root: string;
}): Promise<DocsSearchUseCaseResult> {
  const index = await loadDocsIndex({
    request: { repo_root: input.request.repo_root, max_docs: 200, max_headings_per_doc: 50 },
    scanner: input.scanner,
    workspace: input.workspace,
    default_repo_root: input.default_repo_root
  });
  const query = input.request.query.toLowerCase();
  const hits = index.documents
    .flatMap((doc) => searchDocument({ doc, query, includeSnippets: input.request.include_snippets }))
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
    .slice(0, input.request.max_results);

  return {
    search: {
      repo_root: index.repoRoot,
      query: input.request.query,
      status: index.warnings.length > 0 ? "needed" : hits.length > 0 ? "done" : "not_applicable",
      hits,
      warnings: index.warnings,
      truncated: index.truncated || hits.length >= input.request.max_results,
      next_actions: hits.length > 0 ? docsNextActions(index.repoRoot, hits[0]?.path, hits[0]?.heading_id) : []
    },
    meta: docsMeta(index)
  };
}

export async function getDocsOutline(input: {
  request: DocsOutlineRequest;
  scanner: FileCatalogScanPort;
  workspace: WorkspaceFilePort;
  default_repo_root: string;
}): Promise<DocsOutlineUseCaseResult> {
  const index = await loadDocsIndex({
    request: { repo_root: input.request.repo_root, max_docs: 200, max_headings_per_doc: 100 },
    scanner: input.scanner,
    workspace: input.workspace,
    default_repo_root: input.default_repo_root
  });
  const normalizedPath = normalizeRepoPath(input.request.path);
  const warning = unsafePathWarning(normalizedPath) ?? missingOrSkippedWarning(normalizedPath, index);
  const doc = warning === undefined ? index.documents.find((candidate) => candidate.path === normalizedPath) : undefined;
  const warnings = [...index.warnings, ...(warning === undefined ? [] : [warning])];

  return {
    outline: {
      repo_root: index.repoRoot,
      path: normalizedPath,
      status: warning === undefined && doc !== undefined ? "done" : "blocked",
      title: doc?.title ?? titleFromPath(normalizedPath),
      headings: doc?.headings ?? [],
      warnings,
      next_actions: warning === undefined && doc !== undefined
        ? docsNextActions(index.repoRoot, normalizedPath, doc.headings[0]?.id)
        : []
    },
    meta: docsMeta({ ...index, warnings })
  };
}

export async function readDocsSection(input: {
  request: DocsReadSectionRequest;
  scanner: FileCatalogScanPort;
  workspace: WorkspaceFilePort;
  default_repo_root: string;
}): Promise<DocsReadSectionUseCaseResult> {
  const index = await loadDocsIndex({
    request: { repo_root: input.request.repo_root, max_docs: 200, max_headings_per_doc: 100 },
    scanner: input.scanner,
    workspace: input.workspace,
    default_repo_root: input.default_repo_root
  });
  const normalizedPath = normalizeRepoPath(input.request.path);
  const warning = unsafePathWarning(normalizedPath) ?? missingOrSkippedWarning(normalizedPath, index);
  const doc = warning === undefined ? index.documents.find((candidate) => candidate.path === normalizedPath) : undefined;
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
    ...index.warnings,
    ...(warning === undefined ? [] : [warning]),
    ...(warning === undefined && doc !== undefined && heading === undefined
      ? [{
          path: normalizedPath,
          reason: "missing" as const,
          message: `Heading '${input.request.heading_id}' was not found in ${normalizedPath}.`
        }]
      : [])
  ];

  return {
    read: {
      repo_root: index.repoRoot,
      path: normalizedPath,
      heading_id: input.request.heading_id,
      status: section === undefined ? "blocked" : "done",
      heading,
      section,
      warnings,
      next_actions: []
    },
    meta: docsMeta({ ...index, warnings })
  };
}

type LoadedDocsIndex = {
  repoRoot: string;
  documents: Array<DocsDocument & { content: string }>;
  warnings: DocsWarning[];
  truncated: boolean;
  scannedFiles: readonly FileCatalogEntry[];
};

async function loadDocsIndex(input: {
  request: { repo_root?: string; max_docs: number; max_headings_per_doc: number };
  scanner: FileCatalogScanPort;
  workspace: WorkspaceFilePort;
  default_repo_root: string;
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
    .sort((left, right) => left.path.localeCompare(right.path));
  const warnings = mapSkippedPaths(scanned.skipped_paths ?? []);
  const documents: Array<DocsDocument & { content: string }> = [];
  for (const file of markdownFiles.slice(0, Math.max(input.request.max_docs, 200))) {
    try {
      const content = await input.workspace.readText({ path: file.path });
      const headings = parseHeadings(content);
      documents.push({
        path: file.path,
        title: headings[0]?.text ?? titleFromPath(file.path),
        headings: headings.slice(0, Math.max(input.request.max_headings_per_doc, 100)),
        links: extractLinks({ fromPath: file.path, content, docs: markdownFiles }),
        capability_level: "resource_backed",
        evidence_kinds: ["docs"],
        direct_read_caveat: DIRECT_READ_CAVEAT,
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
    documents: documents.sort((left, right) => left.path.localeCompare(right.path)),
    warnings,
    truncated: scanned.truncated || markdownFiles.length > Math.max(input.request.max_docs, 200),
    scannedFiles: scanned.files
  };
}

function parseHeadings(content: string): DocsHeading[] {
  const slugCounts = new Map<string, number>();
  return content
    .split(/\r?\n/u)
    .map((line, index) => ({ line, index }))
    .map(({ line, index }) => {
      const match = /^(#{1,6})\s+(.+)$/u.exec(line);
      if (match === null) return undefined;
      const text = match[2] ?? "";
      const slug = slugify(text);
      const count = slugCounts.get(slug) ?? 0;
      slugCounts.set(slug, count + 1);
      return {
        id: count === 0 ? slug : `${slug}-${count + 1}`,
        text,
        depth: match[1]?.length ?? 1,
        line: index + 1
      };
    })
    .filter((heading): heading is DocsHeading => heading !== undefined);
}

function extractLinks(input: {
  fromPath: string;
  content: string;
  docs: readonly FileCatalogEntry[];
}): DocsLink[] {
  const docPaths = new Set(input.docs.map((file) => file.path));
  const links: DocsLink[] = [];
  const pattern = /(?<!!)\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu;
  for (const match of input.content.matchAll(pattern)) {
    const label = match[1];
    const target = match[2];
    if (label === undefined || target === undefined || /^(?:https?:|mailto:|#)/u.test(target)) {
      continue;
    }
    const resolvedPath = path
      .normalize(path.join(path.dirname(input.fromPath), target.split("#", 1)[0] ?? ""))
      .replaceAll("\\", "/");
    links.push({
      label,
      target,
      resolved_path: resolvedPath,
      exists: docPaths.has(resolvedPath)
    });
  }
  return links.sort((left, right) => left.target.localeCompare(right.target));
}

function searchDocument(input: {
  doc: DocsDocument & { content: string };
  query: string;
  includeSnippets: boolean;
}): DocsSearchHit[] {
  const hits: DocsSearchHit[] = [];
  const pathMatch = input.doc.path.toLowerCase().includes(input.query);
  const titleMatch = input.doc.title.toLowerCase().includes(input.query);
  if (pathMatch || titleMatch || input.doc.content.toLowerCase().includes(input.query)) {
    hits.push({
      path: input.doc.path,
      title: input.doc.title,
      snippet: input.includeSnippets ? snippetForQuery(input.doc.content, input.query) : undefined,
      score: (titleMatch ? 50 : 0) + (pathMatch ? 20 : 0) + 5,
      evidence_kinds: ["docs"],
      direct_read_caveat: DIRECT_READ_CAVEAT
    });
  }
  for (const heading of input.doc.headings) {
    if (heading.text.toLowerCase().includes(input.query)) {
      hits.push({
        path: input.doc.path,
        title: input.doc.title,
        heading_id: heading.id,
        heading: heading.text,
        snippet: input.includeSnippets ? snippetForQuery(input.doc.content, heading.text.toLowerCase()) : undefined,
        score: 40 - heading.depth,
        evidence_kinds: ["docs"],
        direct_read_caveat: DIRECT_READ_CAVEAT
      });
    }
  }
  return hits;
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
  return skippedPaths
    .filter((skipped) => ["permission_denied", "missing", "generated_or_vendor", "workspace_escape"].includes(skipped.reason))
    .slice(0, 50)
    .map((skipped) => ({
      path: skipped.path,
      reason: skipped.reason,
      message: skipped.detail
    }));
}

function missingOrSkippedWarning(pathValue: string, index: LoadedDocsIndex): DocsWarning | undefined {
  const skipped = index.warnings.find((warning) =>
    warning.path === pathValue || (warning.path !== undefined && pathValue.startsWith(`${warning.path}/`))
  );
  if (skipped !== undefined) {
    return skipped;
  }
  if (index.documents.some((doc) => doc.path === pathValue)) {
    return undefined;
  }
  return {
    path: pathValue,
    reason: "missing",
    message: `Documentation file ${pathValue} was not found.`
  };
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

function rankImportantDocs(documents: readonly (DocsDocument & { content: string })[]) {
  return [...documents].sort((left, right) => docRank(right.path) - docRank(left.path) || left.path.localeCompare(right.path));
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
    direct_read_caveat: doc.direct_read_caveat
  };
}

function titleFromPath(value: string): string {
  return path.basename(value, path.extname(value)).replace(/[-_]+/gu, " ");
}

function normalizeRepoPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gu, "")
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "");
  return slug.length === 0 ? "section" : slug;
}

function snippetForQuery(content: string, query: string): string {
  const lower = content.toLowerCase();
  const index = lower.indexOf(query);
  if (index === -1) {
    return content.slice(0, 160).replace(/\s+/gu, " ").trim();
  }
  const start = Math.max(0, index - 60);
  const end = Math.min(content.length, index + query.length + 100);
  return content.slice(start, end).replace(/\s+/gu, " ").trim();
}
