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
  DocsRankingCursorPayload,
  DocsRankingCountReceipt,
  IndexCoverage,
  RankedDocsSearchResult,
  RankedDocsSearchHit,
  RankedDocsSearchSelectionUnavailableResult,
  ResponseMetadata,
  SourceSection
} from "../../contracts/index.js";
import {
  DOCS_RANKING_CANDIDATE_LIMIT,
  DOCS_RANKING_CONTRACT_VERSION,
  DOCS_RANKING_POLICY_VERSION,
  DOCS_RANKING_SCHEMA_VERSION
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import type { SnapshotValidityReceipt } from "../../domain/models/runtime.js";
import {
  catalogSkipReason,
  normalizeDocumentationConcern,
  rankDocumentationCandidates,
  resolveDocumentationConcerns,
  type CatalogSkipReason
} from "../../domain/policies/index.js";
import type {
  DocumentationConcernIndexPort,
  DocsIndexPort,
  DocsRankingCandidateQueryPort,
  DocsRankingCursorCodecPort,
  FileCatalogScanPort,
  FileCatalogSkippedPath,
  RankedDocsUniverseIdentity,
  RankedDocsUniversePort,
  RankedDocsUniverseRecord,
  WorkspaceFilePort
} from "../../ports/index.js";
import { DocsRankingUnavailableError } from "../../ports/index.js";
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
import { readDocumentationRankingReadiness } from "./documentation-ranking-readiness.js";

const DOC_ROW_LIMIT = 15000;
const DIRECT_READ_CAVEAT = "Docs search is routing evidence; use docs_read_section for precise claims.";
const DOCS_CURSOR_KIND = "docs";
const RANKED_DOCS_UNIVERSE_TTL_MS = 15 * 60 * 1000;

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
  snapshot_validity?: SnapshotValidityReceipt;
  selected_snapshot_id?: string | null;
  default_repo_root: string;
}): Promise<DocsSearchUseCaseResult> {
  const repoRoot = path.resolve(input.request.repo_root ?? input.default_repo_root);
  if (input.selected_snapshot_id === null) {
    return {
      search: {
        repo_root: repoRoot,
        query: input.request.query,
        status: "blocked",
        hits: [],
        warnings: [{ reason: "missing", message: "No docs index snapshot is available." }],
        truncated: false,
        result_count: 0,
        result_count_basis: "page",
        next_actions: capNextActions([])
      },
      meta: docsSearchMeta({
        repoRoot,
        freshness: "unknown",
        status: "blocked",
        truncated: false,
        blocked: true
      })
    };
  }
  if (input.snapshot_validity !== undefined && input.snapshot_validity.state !== "valid") {
    const stale = input.snapshot_validity.state === "stale";
    const message = input.snapshot_validity.reason ?? "Snapshot path validity is incomplete.";
    return {
      search: {
        repo_root: repoRoot,
        query: input.request.query,
        status: "blocked",
        hits: [],
        warnings: [{ reason: "missing", message }],
        truncated: false,
        result_count: 0,
        result_count_basis: "page",
        next_actions: capNextActions([{
          tool: "read_resource",
          args: { uri: "repo:///status" },
          reason: "Refresh or revalidate the repository snapshot before docs search."
        }])
      },
      meta: docsSearchMeta({
        repoRoot,
        freshness: stale ? "stale" : "unknown",
        status: "blocked",
        truncated: false,
        blocked: true
      })
    };
  }
  const result = await input.docs_index.search({
    repo_root: repoRoot,
    snapshot_id: input.selected_snapshot_id ?? input.snapshot_validity?.snapshot_id,
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
      result_count_basis: result.result_count_basis ?? "page",
      docs_index_state: result.docs_index_state,
      indexed_docs_count: result.indexed_docs_count,
      docs_scan_truncated: result.docs_scan_truncated,
      coverage_note: result.coverage_note,
      next_actions: docsSearchNextActions({
        repoRoot: result.repo_root,
        filePath: hits[0]?.path,
        headingId: hits[0]?.heading_id,
        partial: result.docs_index_state === "partial" || result.freshness === "refreshing"
      })
    },
    meta: docsSearchMeta({
      repoRoot: result.repo_root,
      freshness: result.freshness,
      status: result.status === "blocked" ? "blocked" : hits.length > 0 ? "done" : "not_applicable",
      truncated: result.truncated,
      blocked: result.status === "blocked",
      docsIndexState: result.docs_index_state,
      indexedDocsCount: result.indexed_docs_count,
      docsScanTruncated: result.docs_scan_truncated,
      coverage: result.coverage,
      coverageNote: result.coverage_note
    })
  };
}

export async function searchRankedDocs(input: {
  request: DocsSearchRequest;
  selected_snapshot_id: string;
  docs_index: DocsIndexPort;
  documentation_concerns: DocumentationConcernIndexPort;
  ranking_candidates: DocsRankingCandidateQueryPort;
  ranking_cursor_codec: DocsRankingCursorCodecPort;
  ranked_universes: RankedDocsUniversePort;
  default_repo_root: string;
  now_iso8601: string;
  universe_id: string;
}): Promise<RankedDocsSearchResult> {
  const repoRoot = path.resolve(input.request.repo_root ?? input.default_repo_root);
  const normalizedQuery = normalizeDocumentationConcern(input.request.query);
  if (normalizedQuery.length === 0) {
    throw new TypeError("Ranked documentation query must contain at least one normalized token.");
  }
  const normalizedScopePath = normalizeRankedDocsScopePath(input.request.scope_path);
  const base = rankedResultBase({
    repoRoot,
    snapshotId: input.selected_snapshot_id,
    query: input.request.query,
    normalizedQuery,
    normalizedScopePath
  });

  if (input.request.cursor !== undefined) {
    const decoded = input.ranking_cursor_codec.decode(input.request.cursor);
    if (!decoded.ok) {
      return rankingUnavailable(
        base,
        decoded.code === "cursor_expired" ? "ranked_universe_expired" : "ranking_cursor_invalid"
      );
    }
    const expectedIdentity = rankedUniverseIdentity({
      snapshotId: input.selected_snapshot_id,
      normalizedQuery,
      normalizedScopePath
    });
    if (!cursorIdentityEquals(decoded.payload, expectedIdentity)) {
      return rankingUnavailable(base, "ranking_cursor_invalid");
    }
    let universe;
    try {
      universe = await input.ranked_universes.get({
        universe_id: decoded.payload.universe_id,
        snapshot_id: input.selected_snapshot_id
      });
    } catch (error) {
      if (error instanceof DocsRankingUnavailableError) {
        return rankingUnavailable(base, "ranked_universe_expired");
      }
      throw error;
    }
    if (universe === null) return rankingUnavailable(base, "ranked_universe_expired");
    if (!universeIdentityEquals(universe.identity, expectedIdentity)) {
      return rankingUnavailable(base, "ranking_cursor_invalid");
    }
    if (Date.parse(universe.expires_at) <= Date.parse(input.now_iso8601)) {
      await input.ranked_universes.delete({ universe_id: universe.universe_id });
      return rankingUnavailable(base, "ranked_universe_expired");
    }
    if (decoded.payload.next_position >= universe.hits.length) {
      return rankingUnavailable(base, "ranking_cursor_invalid");
    }
    return rankedPageResult({
      base,
      universe,
      position: decoded.payload.next_position,
      pageSize: input.request.max_results,
      cursorCodec: input.ranking_cursor_codec,
      includeSnippets: input.request.include_snippets,
      counts: { ...universe.counts, returned_page_documents_count: 0 }
    });
  }

  const readiness = await readDocumentationRankingReadiness({
    snapshot_id: input.selected_snapshot_id,
    documentation_concerns: input.documentation_concerns
  });
  if (readiness.blocked) {
    return rankingUnavailable(base, "ranking_unavailable");
  }

  try {
    const terms = await input.documentation_concerns.listDocumentationConcernTerms({
      snapshot_id: input.selected_snapshot_id
    });
    if (terms.snapshot_id !== input.selected_snapshot_id || terms.status !== "ready") {
      throw new DocsRankingUnavailableError(
        "Documentation ranking terms became unavailable after readiness was established."
      );
    }
    const termResolution = resolveDocumentationConcerns({
      query: input.request.query,
      terms: terms.rows,
      owners: []
    });
    const concernKeys = [...new Set(termResolution.matches.map(({ concern_key }) => concern_key))].sort();
    const owners = await input.documentation_concerns.listDocumentationConcernOwners({
      snapshot_id: input.selected_snapshot_id,
      concern_keys: concernKeys
    });
    if (owners.snapshot_id !== input.selected_snapshot_id || owners.status !== "ready") {
      throw new DocsRankingUnavailableError(
        "Documentation ranking owners became unavailable after readiness was established."
      );
    }
    const resolution = resolveDocumentationConcerns({
      query: input.request.query,
      terms: terms.rows,
      owners: owners.rows
    });
    const [fts, matchedOwners] = await Promise.all([
      input.ranking_candidates.findFtsCandidates({
        snapshot_id: input.selected_snapshot_id,
        normalized_query: normalizedQuery,
        ...(normalizedScopePath === undefined ? {} : { normalized_scope_path: normalizedScopePath }),
        max_rows: 501
      }),
      input.ranking_candidates.findMatchedOwnerCandidates({
        snapshot_id: input.selected_snapshot_id,
        concern_keys: concernKeys,
        normalized_query: normalizedQuery,
        ...(normalizedScopePath === undefined ? {} : { normalized_scope_path: normalizedScopePath }),
        max_rows: 501
      })
    ]);
    const ftsCount = fts.status === "exact" ? fts.candidates.length : undefined;
    const ownerCount = matchedOwners.status === "exact" ? matchedOwners.candidates.length : undefined;
    if (fts.status === "overflow" || matchedOwners.status === "overflow") {
      return rankedOverflowResult({
        base,
        docsIndex: input.docs_index,
        candidates: input.ranking_candidates,
        repoRoot,
        snapshotId: input.selected_snapshot_id,
        normalizedScopePath,
        ftsCount,
        ownerCount
      });
    }
    const union = new Map(fts.candidates.map((candidate) => [candidate.stable_document_id, candidate]));
    for (const candidate of matchedOwners.candidates) {
      if (!union.has(candidate.stable_document_id)) union.set(candidate.stable_document_id, candidate);
    }
    if (union.size > DOCS_RANKING_CANDIDATE_LIMIT) {
      return rankedOverflowResult({
        base,
        docsIndex: input.docs_index,
        candidates: input.ranking_candidates,
        repoRoot,
        snapshotId: input.selected_snapshot_id,
        normalizedScopePath,
        ftsCount,
        ownerCount
      });
    }
    const ranked = rankDocumentationCandidates({
      query: input.request.query,
      concern_resolution: resolution,
      candidates: [...union.values()].map((candidate) => {
        if (candidate.hit.authority === undefined || candidate.hit.currency_state === undefined) {
          throw new Error(`Ranking candidate ${candidate.stable_document_id} lacks authority or currency evidence.`);
        }
        return {
          stable_document_id: candidate.stable_document_id,
          hit: { ...candidate.hit, authority: candidate.hit.authority, currency_state: candidate.hit.currency_state },
          ...(candidate.lexical_score === undefined ? {} : { lexical_score: candidate.lexical_score }),
          title_heading_text: candidate.title_heading_text,
          body_text: candidate.body_text
        };
      })
    });
    const identity = rankedUniverseIdentity({
      snapshotId: input.selected_snapshot_id,
      normalizedQuery,
      normalizedScopePath
    });
    const expiresAt = new Date(Date.parse(input.now_iso8601) + RANKED_DOCS_UNIVERSE_TTL_MS).toISOString();
    const counts = await rankedCounts({
      docsIndex: input.docs_index,
      candidates: input.ranking_candidates,
      repoRoot,
      snapshotId: input.selected_snapshot_id,
      normalizedScopePath,
      ftsCount: fts.candidates.length,
      ownerCount: matchedOwners.candidates.length,
      unionCount: union.size
    });
    const { returned_page_documents_count: _returnedPageCount, ...storedCounts } = counts;
    const universe = {
      universe_id: input.universe_id,
      identity,
      hits: ranked,
      counts: storedCounts,
      created_at: input.now_iso8601,
      expires_at: expiresAt
    };
    await input.ranked_universes.purgeExpired({ now_iso8601: input.now_iso8601 });
    await input.ranked_universes.put({ universe });
    return rankedPageResult({
      base,
      universe,
      position: 0,
      pageSize: input.request.max_results,
      cursorCodec: input.ranking_cursor_codec,
      includeSnippets: input.request.include_snippets,
      counts
    });
  } catch (error) {
    throw error;
  }
}

export function rankedDocsSnapshotUnavailable(input: {
  request: DocsSearchRequest;
  default_repo_root: string;
  message: string;
}): RankedDocsSearchSelectionUnavailableResult {
  const repoRoot = path.resolve(input.request.repo_root ?? input.default_repo_root);
  const normalizedQuery = normalizeDocumentationConcern(input.request.query);
  if (normalizedQuery.length === 0) {
    throw new TypeError("Ranked documentation query must contain at least one normalized token.");
  }
  const normalizedScopePath = normalizeRankedDocsScopePath(input.request.scope_path);
  return {
    ranking_contract_version: DOCS_RANKING_CONTRACT_VERSION,
    repo_root: repoRoot,
    query: input.request.query,
    normalized_query: normalizedQuery,
    ...(normalizedScopePath === undefined ? {} : { normalized_scope_path: normalizedScopePath }),
    ranking_schema_version: DOCS_RANKING_SCHEMA_VERSION,
    ranking_policy_version: DOCS_RANKING_POLICY_VERSION,
    status: "blocked",
    trust_state: "blocked_snapshot_unavailable",
    blocker: "selected_snapshot_unavailable",
    hits: [],
    warnings: [{ reason: "missing", message: boundedRankedMessage(input.message) }],
    next_actions: capNextActions([{
      tool: "read_resource",
      args: { uri: "repo:///status" },
      reason: "Inspect snapshot validity and run the advertised coordinated refresh action before retrying docs_search."
    }]),
    truncated: false
  };
}

function boundedRankedMessage(message: string): string {
  return message.length <= 500 ? message : `${message.slice(0, 480)} [truncated]`;
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
  docsIndexState?: "complete" | "partial" | "refreshing" | "stale" | "blocked" | "unknown";
  indexedDocsCount?: number;
  docsScanTruncated?: boolean;
  coverage?: readonly IndexCoverage[];
  coverageNote?: string;
}): ResponseMetadata {
  const coverageState = input.docsIndexState ?? (input.blocked ? "blocked" : "unknown");
  return {
    analysis_validity: docsAnalysisValidity({
      coverageState,
      freshness: input.freshness,
      blocked: input.blocked
    }),
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
    },
    index_coverage: input.coverage === undefined || input.coverage.length === 0 ? [
      {
        evidence_class: "docs",
        state: coverageState,
        indexed_files: input.indexedDocsCount,
        scan_truncated: input.docsScanTruncated,
        indexed_roots: ["AGENTS.md", "README.md", "docs", "doc", "documentation"],
        reason: input.coverageNote
      }
    ] : [...input.coverage]
  };
}

function docsAnalysisValidity(input: {
  coverageState: "complete" | "partial" | "refreshing" | "stale" | "blocked" | "unknown";
  freshness: ResponseMetadata["freshness"];
  blocked: boolean;
}): ResponseMetadata["analysis_validity"] {
  if (input.blocked || input.coverageState === "blocked") {
    return "invalid";
  }
  if (
    input.coverageState === "complete" &&
    input.freshness !== "refreshing" &&
    input.freshness !== "stale" &&
    input.freshness !== "unknown" &&
    input.freshness !== "cold"
  ) {
    return "valid";
  }
  return "partial";
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

function docsSearchNextActions(input: {
  repoRoot: string;
  filePath?: string;
  headingId?: string;
  partial: boolean;
}) {
  return capNextActions([
    ...(input.partial
      ? [
          {
            tool: "read_resource",
            args: {
              repo_root: input.repoRoot,
              uri: "repo:///docs/map",
              max_docs: 50
            }
          }
        ]
      : []),
    ...docsNextActions(input.repoRoot, input.filePath, input.headingId)
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

type RankedResultBase = {
  ranking_contract_version: typeof DOCS_RANKING_CONTRACT_VERSION;
  repo_root: string;
  snapshot_id: string;
  query: string;
  normalized_query: string;
  normalized_scope_path?: string;
  ranking_schema_version: typeof DOCS_RANKING_SCHEMA_VERSION;
  ranking_policy_version: typeof DOCS_RANKING_POLICY_VERSION;
  warnings: DocsWarning[];
  next_actions: [];
};

function rankedResultBase(input: {
  repoRoot: string;
  snapshotId: string;
  query: string;
  normalizedQuery: string;
  normalizedScopePath?: string;
}): RankedResultBase {
  return {
    ranking_contract_version: DOCS_RANKING_CONTRACT_VERSION,
    repo_root: input.repoRoot,
    snapshot_id: input.snapshotId,
    query: input.query,
    normalized_query: input.normalizedQuery,
    ...(input.normalizedScopePath === undefined ? {} : { normalized_scope_path: input.normalizedScopePath }),
    ranking_schema_version: DOCS_RANKING_SCHEMA_VERSION,
    ranking_policy_version: DOCS_RANKING_POLICY_VERSION,
    warnings: [],
    next_actions: []
  };
}

function rankingUnavailable(
  base: RankedResultBase,
  blocker: "ranked_universe_expired" | "ranking_cursor_invalid" | "ranking_unavailable"
): RankedDocsSearchResult {
  const trustState = blocker === "ranked_universe_expired"
    ? "blocked_cursor_stale"
    : blocker === "ranking_cursor_invalid"
      ? "blocked_cursor_invalid"
      : "blocked_ranking_unavailable";
  return {
    ...base,
    status: "blocked",
    trust_state: trustState,
    blocker,
    hits: [],
    next_actions: capNextActions([blocker === "ranking_unavailable"
      ? {
          tool: "read_resource",
          args: { uri: "repo:///status" },
          reason: "Inspect ranked documentation index availability before retrying."
        }
      : {
          tool: "docs_search",
          args: {
            query: base.query,
            ...(base.normalized_scope_path === undefined ? {} : { scope_path: base.normalized_scope_path })
          },
          reason: "Restart the ranked search safely without the expired or invalid cursor."
        }]),
    truncated: false
  };
}

function rankedUniverseIdentity(input: {
  snapshotId: string;
  normalizedQuery: string;
  normalizedScopePath?: string;
}): RankedDocsUniverseIdentity {
  return {
    snapshot_id: input.snapshotId,
    normalized_query: input.normalizedQuery,
    ...(input.normalizedScopePath === undefined ? {} : { normalized_scope_path: input.normalizedScopePath }),
    retrieval_bound: DOCS_RANKING_CANDIDATE_LIMIT,
    ranking_schema_version: DOCS_RANKING_SCHEMA_VERSION,
    ranking_policy_version: DOCS_RANKING_POLICY_VERSION
  };
}

function universeIdentityEquals(
  left: RankedDocsUniverseIdentity,
  right: RankedDocsUniverseIdentity
): boolean {
  return left.snapshot_id === right.snapshot_id &&
    left.normalized_query === right.normalized_query &&
    left.normalized_scope_path === right.normalized_scope_path &&
    left.retrieval_bound === right.retrieval_bound &&
    left.ranking_schema_version === right.ranking_schema_version &&
    left.ranking_policy_version === right.ranking_policy_version;
}

function cursorIdentityEquals(
  payload: DocsRankingCursorPayload,
  identity: RankedDocsUniverseIdentity
): boolean {
  return payload.version === DOCS_RANKING_CONTRACT_VERSION && universeIdentityEquals(payload, identity);
}

async function rankedCounts(input: {
  docsIndex: DocsIndexPort;
  candidates: DocsRankingCandidateQueryPort;
  repoRoot: string;
  snapshotId: string;
  normalizedScopePath?: string;
  ftsCount: number;
  ownerCount: number;
  unionCount: number;
}): Promise<DocsRankingCountReceipt> {
  const [state, searchable] = await Promise.all([
    input.docsIndex.getState({ repo_root: input.repoRoot, snapshot_id: input.snapshotId }),
    input.candidates.countSearchableDocuments({
      snapshot_id: input.snapshotId,
      ...(input.normalizedScopePath === undefined ? {} : { normalized_scope_path: input.normalizedScopePath })
    })
  ]);
  const docsCoverage = state.coverage?.find(({ evidence_class }) => evidence_class === "docs");
  const indexed = docsCoverage?.indexed_files ?? state.document_count;
  const eligible = docsCoverage?.eligible_files_seen ?? indexed;
  return {
    ...searchable,
    fts_candidate_documents_count: input.ftsCount,
    matched_owner_candidate_documents_count: input.ownerCount,
    candidate_union_documents_count: input.unionCount,
    ranked_candidate_universe_count: input.unionCount,
    returned_page_documents_count: 0,
    priority_scan_eligible_markdown_files_count: eligible,
    priority_scan_indexed_markdown_files_count: indexed,
    priority_scan_skipped_markdown_files_count: Math.max(0, eligible - indexed),
    priority_scan_coverage_state: docsCoverage?.state ?? state.coverage_state ?? "unknown",
    priority_scan_truncated: docsCoverage?.scan_truncated ?? state.docs_scan_truncated ?? false,
    ...(docsCoverage?.reason === undefined && state.reason === undefined
      ? {}
      : { priority_scan_coverage_note: docsCoverage?.reason ?? state.reason }),
    searchable_filter_basis: "merged_graph_and_priority_markdown",
    scope_filter_basis: input.normalizedScopePath === undefined ? "repo_root" : "normalized_scope_path",
    query_filter_basis: {
      fts_candidate_documents_count: "normalized_fts_match_within_scope",
      matched_owner_candidate_documents_count: "exact_matched_concern_owners_within_scope",
      candidate_union_documents_count: "distinct_fts_and_exact_owner_union_within_scope",
      ranked_candidate_universe_count: "distinct_fts_and_exact_owner_union_within_scope"
    },
    page_filter_basis: "frozen_universe_position_and_requested_page_size",
    priority_scan_filter_basis: "configured_priority_roots"
  };
}

async function rankedOverflowResult(input: {
  base: RankedResultBase;
  docsIndex: DocsIndexPort;
  candidates: DocsRankingCandidateQueryPort;
  repoRoot: string;
  snapshotId: string;
  normalizedScopePath?: string;
  ftsCount?: number;
  ownerCount?: number;
}): Promise<RankedDocsSearchResult> {
  const [state, searchable] = await Promise.all([
    input.docsIndex.getState({ repo_root: input.repoRoot, snapshot_id: input.snapshotId }),
    input.candidates.countSearchableDocuments({
      snapshot_id: input.snapshotId,
      ...(input.normalizedScopePath === undefined ? {} : { normalized_scope_path: input.normalizedScopePath })
    })
  ]);
  const docsCoverage = state.coverage?.find(({ evidence_class }) => evidence_class === "docs");
  const indexed = docsCoverage?.indexed_files ?? state.document_count;
  const eligible = docsCoverage?.eligible_files_seen ?? indexed;
  return {
    ...input.base,
    status: "blocked",
    trust_state: "blocked_candidate_overflow",
    blocker: "candidate_universe_exceeds_limit",
    hits: [],
    counts: {
      ...searchable,
      ...(input.ftsCount === undefined
        ? { fts_candidate_count_lower_bound: 501 as const }
        : { fts_candidate_documents_count: input.ftsCount }),
      ...(input.ownerCount === undefined
        ? { matched_owner_candidate_count_lower_bound: 501 as const }
        : { matched_owner_candidate_documents_count: input.ownerCount }),
      candidate_union_count_lower_bound: 501,
      returned_page_documents_count: 0,
      priority_scan_eligible_markdown_files_count: eligible,
      priority_scan_indexed_markdown_files_count: indexed,
      priority_scan_skipped_markdown_files_count: Math.max(0, eligible - indexed),
      priority_scan_coverage_state: docsCoverage?.state ?? state.coverage_state ?? "unknown",
      priority_scan_truncated: docsCoverage?.scan_truncated ?? state.docs_scan_truncated ?? false,
      ...(docsCoverage?.reason === undefined && state.reason === undefined
        ? {}
        : { priority_scan_coverage_note: docsCoverage?.reason ?? state.reason }),
      searchable_filter_basis: "merged_graph_and_priority_markdown",
      scope_filter_basis: input.normalizedScopePath === undefined ? "repo_root" : "normalized_scope_path",
      query_filter_basis: {
        fts_candidate_documents_count: "normalized_fts_match_within_scope",
        matched_owner_candidate_documents_count: "exact_matched_concern_owners_within_scope",
        candidate_union_documents_count: "distinct_fts_and_exact_owner_union_within_scope",
        ranked_candidate_universe_count: "distinct_fts_and_exact_owner_union_within_scope"
      },
      page_filter_basis: "frozen_universe_position_and_requested_page_size",
      priority_scan_filter_basis: "configured_priority_roots"
    },
    result_count: 0,
    result_count_basis: "page",
    indexed_docs_count: searchable.searchable_snapshot_documents_count,
    docs_index_state: docsCoverage?.state ?? state.coverage_state ?? "unknown",
    docs_scan_truncated: docsCoverage?.scan_truncated ?? state.docs_scan_truncated ?? false,
    ...(docsCoverage?.reason === undefined && state.reason === undefined
      ? {}
      : { coverage_note: docsCoverage?.reason ?? state.reason }),
    next_actions: capNextActions([{
      tool: "docs_search",
      args: {
        query: input.base.query,
        scope_path: input.normalizedScopePath ?? "docs"
      },
      reason: "Retry within a narrower documentation scope; narrow the query further if the scoped union still exceeds 500."
    }]),
    truncated: false
  };
}

function rankedPageResult(input: {
  base: RankedResultBase;
  universe: RankedDocsUniverseRecord;
  position: number;
  pageSize: number;
  cursorCodec: DocsRankingCursorCodecPort;
  includeSnippets: boolean;
  counts: DocsRankingCountReceipt;
}): RankedDocsSearchResult {
  const hits = input.universe.hits
    .slice(input.position, input.position + input.pageSize)
    .map((hit) => input.includeSnippets ? hit : withoutSnippet(hit));
  const nextPosition = input.position + hits.length;
  const hasMore = nextPosition < input.universe.hits.length;
  return {
    ...input.base,
    status: input.universe.hits.length === 0 ? "not_applicable" : "done",
    trust_state: "complete_ranked_universe",
    universe_id: input.universe.universe_id,
    hits: [...hits],
    counts: { ...input.counts, returned_page_documents_count: hits.length },
    result_count: hits.length,
    result_count_basis: "page",
    indexed_docs_count: input.counts.searchable_snapshot_documents_count,
    docs_index_state: input.counts.priority_scan_coverage_state,
    docs_scan_truncated: input.counts.priority_scan_truncated,
    ...(input.counts.priority_scan_coverage_note === undefined
      ? {}
      : { coverage_note: input.counts.priority_scan_coverage_note }),
    ...(hasMore
      ? {
          cursor: input.cursorCodec.encode({
            version: DOCS_RANKING_CONTRACT_VERSION,
            universe_id: input.universe.universe_id,
            next_position: nextPosition,
            ...input.universe.identity
          })
        }
      : {}),
    truncated: hasMore
  };
}

function withoutSnippet(hit: RankedDocsSearchHit): RankedDocsSearchHit {
  const { snippet: _snippet, ...without } = hit;
  return without;
}

function normalizeRankedDocsScopePath(value: string | undefined): string | undefined {
  if (value === undefined || value === ".") return undefined;
  const normalized = value.replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/\/+$/u, "");
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    normalized.startsWith("../") ||
    normalized.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw new TypeError("scope_path must be a contained repo-relative path.");
  }
  return normalized;
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
