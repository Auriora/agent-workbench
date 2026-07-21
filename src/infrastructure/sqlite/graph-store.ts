/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import Database from "better-sqlite3";
import {
  GRAPH_STORE_IDENTITY_VERSION,
  seedVersionedGraphStore
} from "./graph-store-location.js";
import type {
  ExtractionBatch,
  FileCatalogEntry,
  FileIdentity,
  GraphEdgeReadModel,
  GraphNodeReadModel,
  GraphTraversalRequest,
  GraphTraversalResult,
  ResolvedReference,
  UnresolvedReferenceReadModel
} from "../../domain/models/index.js";
import type { SnapshotState } from "../../domain/models/runtime.js";
import type {
  DocsHeading,
  DocsSearchHit,
  Freshness,
  IndexCoverage
} from "../../contracts/index.js";
import {
  classifyMarkdownDocCurrency,
  extractMarkdownFrontmatterSignals
} from "../../domain/policies/index.js";
import type {
  DocsIndexDocumentWrite,
  DocsIndexPort,
  DocsIndexSearchRequest,
  DocsIndexSearchResult,
  DocsIndexState,
  FileCatalogPort,
  GraphMaintenancePort,
  GraphQueryPort,
  GraphWritePort,
  SnapshotPublicationPort,
  SnapshotPublicationRecord,
  SnapshotPublicationSelection,
  SnapshotOrphanReconciliationPort,
  RepositoryOwnershipLease,
  SnapshotOrphanReconciliationResult,
  SnapshotBuildPort,
  SnapshotPathInventoryPort,
  SnapshotPort
} from "../../ports/index.js";

export const SCHEMA_VERSION = GRAPH_STORE_IDENTITY_VERSION;

const SNAPSHOT_SELECT_COLUMNS = `
  SELECT id, repo_identity, config_identity, freshness, schema_version, created_at,
         publication_state, controller_generation, invalidation_generation, publication_updated_at
`;

type SnapshotRow = {
  id: number;
  repo_identity: string;
  config_identity: string;
  freshness: string;
  schema_version: number;
  created_at: string;
  publication_state: "building" | "published" | "superseded" | "failed";
  controller_generation: number;
  invalidation_generation: number;
  publication_updated_at: string;
};

type FileRow = {
  id: number;
  snapshot_id: number;
  path: string;
  language: string;
  content_hash: string;
  size_bytes: number;
  mtime_ms: number;
  indexed_at: string | null;
  node_count: number;
  indexing_error: string | null;
};

type NodeRow = {
  id: string;
  file_id: number;
  kind: string;
  name: string;
  lower_name: string;
  qualified_name: string | null;
  language: string;
  start_line: number;
  start_column: number;
  end_line: number;
  end_column: number;
  signature: string | null;
  docstring: string | null;
  metadata_json: string;
};

type NodeWithFileRow = NodeRow & {
  path: string;
};

type EdgeRow = {
  id: number;
  source_node_id: string;
  target_node_id: string | null;
  kind: string;
  start_line: number | null;
  start_column: number | null;
  end_line: number | null;
  end_column: number | null;
  provenance: string;
  confidence: number;
  metadata_json: string;
};

type UnresolvedRefRow = {
  id: number;
  source_node_id: string;
  reference_name: string;
  reference_kind: string;
  file_id: number;
  start_line: number;
  start_column: number;
  end_line: number;
  end_column: number;
  candidate_metadata_json: string;
  source_file_path: string;
};

type ReferenceRow = {
  id: number;
  source_node_id: string;
  target_node_id: string | null;
  provenance: string;
  confidence: number;
  target_file_path: string | null;
};

type DocsDocumentRow = {
  id: number;
  snapshot_id: number;
  path: string;
  title: string;
  content_hash: string;
  byte_count: number;
  indexed_at: string;
  selected_text_truncated: number;
};

type DocsSearchRow = {
  path: string;
  title: string;
  headings_text: string;
  selected_text: string;
  mtime_ms: number | null;
  rank_score: number;
};

type IndexCoverageRow = {
  evidence_class: "docs" | "graph";
  state: IndexCoverage["state"];
  indexed_files: number | null;
  eligible_files_seen: number | null;
  scan_truncated: number | null;
  indexed_roots_json: string | null;
  missing_priority_roots_json: string | null;
  reason: string | null;
};

export type GraphStoreOptions = {
  busyTimeoutMs?: number;
  enforceForeignKeys?: boolean;
};

export interface GraphStore
  extends GraphWritePort,
    GraphQueryPort,
    GraphMaintenancePort,
    SnapshotPort,
    SnapshotPublicationPort,
    SnapshotOrphanReconciliationPort,
    SnapshotBuildPort,
    FileCatalogPort,
    SnapshotPathInventoryPort,
    DocsIndexPort {
  db: Database.Database;
  close(): void;
  validateSchema(): boolean;
}

export class SqliteGraphStoreAdapter implements GraphStore {
  public readonly db: Database.Database;
  public readonly databasePath: string;

  constructor(databasePath: string, options: GraphStoreOptions = {}) {
    this.databasePath = databasePath;
    this.db = new Database(databasePath, {
      timeout: options.busyTimeoutMs ?? DEFAULT_SQLITE_BUSY_TIMEOUT_MS
    });
    try {
      assertCompatibleSchemaVersion(this.db);
      this.db.pragma("journal_mode = WAL");
      this.db.pragma("synchronous = NORMAL");
      if (options.enforceForeignKeys !== false) {
        this.db.pragma("foreign_keys = ON");
      }
      migrate(this.db);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  public close(): void {
    this.db.close();
  }

  public validateSchema(): boolean {
    return validateSchema(this.db);
  }

  public async getNode(input: { snapshot_id: string; node_id: string }): Promise<GraphNodeReadModel | null> {
    const snapshotId = this.resolvePublishedSnapshotId(input.snapshot_id);
    if (snapshotId == null) {
      return null;
    }

    const row = this.db
      .prepare(
        `
        SELECT nodes.*, files.path as path
        FROM nodes
        INNER JOIN files ON files.id = nodes.file_id
        WHERE files.snapshot_id = @snapshotId AND nodes.id = @nodeId
      `
      )
      .get({ snapshotId, nodeId: input.node_id }) as NodeWithFileRow | undefined;

    return row ? this.mapGraphNodeRow(row) : null;
  }

  public async findNodesByName(input: {
    snapshot_id: string;
    query: string;
    exact?: boolean;
    max_rows?: number;
  }): Promise<readonly GraphNodeReadModel[]> {
    const snapshotId = this.resolvePublishedSnapshotId(input.snapshot_id);
    if (snapshotId == null) {
      return [];
    }

    const maxRows = input.max_rows ?? 50;
    const query = input.query.trim().toLowerCase();
    if (query.length === 0) {
      return [];
    }

    const where = input.exact ? "nodes.lower_name = @query" : "nodes.lower_name LIKE @queryLike";
    const rows = this.db
      .prepare(
        `
        SELECT nodes.*, files.path as path
        FROM nodes
        INNER JOIN files ON files.id = nodes.file_id
        WHERE files.snapshot_id = @snapshotId AND ${where}
        ORDER BY nodes.name ASC
        LIMIT @maxRows
      `
      )
      .all({
        snapshotId,
        query: query,
        queryLike: `%${query}%`,
        maxRows
      }) as NodeWithFileRow[];

    return rows.map((row) => this.mapGraphNodeRow(row));
  }

  public async findNodesByQualifiedName(input: {
    snapshot_id: string;
    qualified_name: string;
    max_rows?: number;
  }): Promise<readonly GraphNodeReadModel[]> {
    const snapshotId = this.resolvePublishedSnapshotId(input.snapshot_id);
    if (snapshotId == null) {
      return [];
    }

    const rows = this.db
      .prepare(
        `
        SELECT nodes.*, files.path as path
        FROM nodes
        INNER JOIN files ON files.id = nodes.file_id
        WHERE files.snapshot_id = @snapshotId
          AND lower(coalesce(nodes.qualified_name, '')) = lower(@qualifiedName)
        ORDER BY nodes.name ASC
        LIMIT @maxRows
      `
      )
      .all({
        snapshotId,
        qualifiedName: input.qualified_name,
        maxRows: input.max_rows ?? 50
      }) as NodeWithFileRow[];

    return rows.map((row) => this.mapGraphNodeRow(row));
  }

  public async searchNodes(input: {
    snapshot_id: string;
    query: string;
    max_rows?: number;
  }): Promise<readonly GraphNodeReadModel[]> {
    const snapshotId = this.resolvePublishedSnapshotId(input.snapshot_id);
    if (snapshotId == null) {
      return [];
    }

    const maxRows = input.max_rows ?? 50;
    const query = input.query.trim().toLowerCase();
    if (query.length === 0) {
      return [];
    }
    const ftsQuery = buildNodeFtsQuery(query);
    if (ftsQuery.length === 0) {
      return [];
    }

    const rows = this.db
      .prepare(
        `
        SELECT DISTINCT nodes.*, files.path as path
        FROM node_fts
        INNER JOIN nodes ON nodes.id = node_fts.node_id
        INNER JOIN files ON files.id = nodes.file_id
        WHERE files.snapshot_id = @snapshotId
          AND node_fts MATCH @ftsQuery
        ORDER BY bm25(node_fts, -8.0, -7.0, -3.0, -2.0) DESC, nodes.name ASC
        LIMIT @maxRows
      `
      )
      .all({
        snapshotId,
        ftsQuery,
        maxRows
      }) as NodeWithFileRow[];

    return rows.map((row) => this.mapGraphNodeRow(row));
  }

  public async getNodesInRange(input: {
    snapshot_id: string;
    file_path: string;
    range: {
      start_line: number;
      start_column: number;
      end_line: number;
      end_column: number;
    };
  }): Promise<readonly GraphNodeReadModel[]> {
    const snapshotId = this.resolvePublishedSnapshotId(input.snapshot_id);
    if (snapshotId == null) {
      return [];
    }

    const rows = this.db
      .prepare(
        `
        SELECT nodes.*, files.path as path
        FROM nodes
        INNER JOIN files ON files.id = nodes.file_id
        WHERE files.snapshot_id = @snapshotId
          AND files.path = @filePath
          AND (
            (nodes.start_line > @startLine OR (nodes.start_line = @startLine AND nodes.start_column >= @startColumn))
            AND (nodes.end_line < @endLine OR (nodes.end_line = @endLine AND nodes.end_column <= @endColumn))
          )
        ORDER BY nodes.start_line ASC, nodes.start_column ASC
      `
      )
      .all({
        snapshotId,
        filePath: input.file_path,
        startLine: input.range.start_line,
        startColumn: input.range.start_column,
        endLine: input.range.end_line,
        endColumn: input.range.end_column
      }) as NodeWithFileRow[];

    return rows.map((row) => this.mapGraphNodeRow(row));
  }

  public async getOutgoingEdges(input: { snapshot_id: string; node_id: string; max_rows?: number }): Promise<
    readonly GraphEdgeReadModel[]
  > {
    const snapshotId = this.resolvePublishedSnapshotId(input.snapshot_id);
    if (snapshotId == null) {
      return [];
    }

    const rows = this.db
      .prepare(
        `
        SELECT edges.*
        FROM edges
        INNER JOIN nodes ON nodes.id = edges.source_node_id
        INNER JOIN files ON files.id = nodes.file_id
        WHERE files.snapshot_id = @snapshotId
          AND edges.source_node_id = @nodeId
        ORDER BY edges.id ASC
        LIMIT @maxRows
      `
      )
      .all({
        snapshotId,
        nodeId: input.node_id,
        maxRows: input.max_rows ?? 50
      }) as EdgeRow[];

    return rows.map((row) => this.mapGraphEdgeRow(row));
  }

  public async getIncomingEdges(input: { snapshot_id: string; node_id: string; max_rows?: number }): Promise<
    readonly GraphEdgeReadModel[]
  > {
    const snapshotId = this.resolvePublishedSnapshotId(input.snapshot_id);
    if (snapshotId == null) {
      return [];
    }

    const rows = this.db
      .prepare(
        `
        SELECT edges.*
        FROM edges
        INNER JOIN nodes ON nodes.id = edges.target_node_id
        INNER JOIN files ON files.id = nodes.file_id
        WHERE files.snapshot_id = @snapshotId
          AND edges.target_node_id = @nodeId
        ORDER BY edges.id ASC
        LIMIT @maxRows
      `
      )
      .all({
        snapshotId,
        nodeId: input.node_id,
        maxRows: input.max_rows ?? 50
      }) as EdgeRow[];

    return rows.map((row) => this.mapGraphEdgeRow(row));
  }

  public async getReferences(input: {
    snapshot_id: string;
    node_id: string;
    max_depth?: number;
    max_rows?: number;
  }): Promise<readonly ResolvedReference[]> {
    const snapshotId = this.resolvePublishedSnapshotId(input.snapshot_id);
    if (snapshotId == null) {
      return [];
    }

    const rows = this.db
      .prepare(
        `
        SELECT e.id,
               e.source_node_id,
               e.target_node_id,
               e.provenance,
               e.confidence,
               t.path AS target_file_path
        FROM edges e
        INNER JOIN nodes s ON s.id = e.source_node_id
        INNER JOIN files sf ON sf.id = s.file_id
        LEFT JOIN nodes t_node ON t_node.id = e.target_node_id
        LEFT JOIN files t ON t.id = t_node.file_id
        WHERE sf.snapshot_id = @snapshotId
          AND e.source_node_id = @nodeId
          AND e.target_node_id IS NOT NULL
        ORDER BY e.id ASC
        LIMIT @maxRows
      `
      )
      .all({
        snapshotId,
        nodeId: input.node_id,
        maxRows: input.max_rows ?? 50
      }) as ReferenceRow[];

    return rows
      .filter((row) => row.target_file_path !== null)
      .map((row) => ({
        source_node_id: row.source_node_id,
        target_node_id: row.target_node_id ?? "",
        target_file_path: row.target_file_path as string,
        edge_id: String(row.id),
        confidence: row.confidence,
        provenance: row.provenance
      }));
  }

  public async getUnresolvedReferences(input: {
    snapshot_id: string;
    file_path?: string;
    max_rows?: number;
  }): Promise<readonly UnresolvedReferenceReadModel[]> {
    const snapshotId = this.resolvePublishedSnapshotId(input.snapshot_id);
    if (snapshotId == null) {
      return [];
    }

    const rows = this.db
      .prepare(
        `
        SELECT ur.id,
               ur.source_node_id,
               ur.reference_name,
               ur.reference_kind,
               ur.start_line,
               ur.start_column,
               ur.end_line,
               ur.end_column,
               ur.candidate_metadata_json,
               f.path AS source_file_path
        FROM unresolved_refs ur
        INNER JOIN files f ON f.id = ur.file_id
        WHERE f.snapshot_id = @snapshotId
          AND (@filePath IS NULL OR f.path = @filePath)
        ORDER BY ur.id ASC
        LIMIT @maxRows
      `
      )
      .all({
        snapshotId,
        filePath: input.file_path ?? null,
        maxRows: input.max_rows ?? 50
      }) as UnresolvedRefRow[];

    return rows.map((row) => ({
      id: String(row.id),
      source_node_id: row.source_node_id,
      source_file_path: row.source_file_path,
      reference_name: row.reference_name,
      reference_kind: row.reference_kind,
      source_range: {
        start_line: row.start_line,
        start_column: row.start_column,
        end_line: row.end_line,
        end_column: row.end_column
      },
      candidate_metadata: parseMetadataJson(row.candidate_metadata_json)
    }));
  }

  public async traverse(input: {
    snapshot_id: string;
    request: GraphTraversalRequest;
  }): Promise<GraphTraversalResult> {
    const snapshotId = this.resolvePublishedSnapshotId(input.snapshot_id);
    if (snapshotId == null) {
      return {
        start_node_ids: input.request.start_node_ids,
        nodes: [],
        edges: [],
        reached_depth: 0,
        truncated: false
      };
    }

    const startNodeIds = Array.from(new Set(input.request.start_node_ids));
    const queue: Array<{ id: string; depth: number }> = startNodeIds.map((id) => ({
      id,
      depth: 0
    }));
    const seenNodes = new Set<string>();
    const seenEdges = new Set<string>();
    const resultNodes = new Map<string, GraphNodeReadModel>();
    const resultEdges: GraphEdgeReadModel[] = [];
    let reachedDepth = 0;
    let truncated = false;

    const maxNodes = input.request.max_nodes;
    const maxDepth = input.request.max_depth;

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }

      if (maxNodes > 0 && resultNodes.size >= maxNodes) {
        truncated = true;
        break;
      }

      if (seenNodes.has(current.id)) {
        continue;
      }
      seenNodes.add(current.id);

      const node = await this.getNode({ snapshot_id: input.snapshot_id, node_id: current.id });
      if (!node) {
        continue;
      }

      resultNodes.set(node.id, node);
      reachedDepth = Math.max(reachedDepth, current.depth);

      if (current.depth >= maxDepth) {
        continue;
      }

      const nextDepth = current.depth + 1;
      const outgoing = await this.getOutgoingEdges({
        snapshot_id: input.snapshot_id,
        node_id: current.id,
        max_rows: maxNodes ? Math.max(1, maxNodes - resultNodes.size) : undefined
      });
      const incoming =
        input.request.direction === "incoming" || input.request.direction === "both"
          ? await this.getIncomingEdges({
              snapshot_id: input.snapshot_id,
              node_id: current.id,
              max_rows: maxNodes ? Math.max(1, maxNodes - resultNodes.size) : undefined
            })
          : [];
      const relevantEdges =
        input.request.direction === "incoming"
          ? incoming
          : input.request.direction === "outgoing"
            ? outgoing
            : outgoing.concat(incoming);

      for (const edge of relevantEdges) {
        if (!seenEdges.has(edge.id)) {
          seenEdges.add(edge.id);
          resultEdges.push(edge);
        }

        const targetId =
          input.request.direction === "incoming" && edge.source_node_id === current.id
            ? edge.source_node_id
            : edge.target_node_id;
        if (!targetId || seenNodes.has(targetId)) {
          continue;
        }

        const nextNode = await this.getNode({
          snapshot_id: input.snapshot_id,
          node_id: targetId
        });
        if (nextNode) {
          queue.push({ id: nextNode.id, depth: nextDepth });
        }
      }
    }

    return {
      start_node_ids: input.request.start_node_ids,
      nodes: Array.from(resultNodes.values()),
      edges: resultEdges,
      reached_depth: reachedDepth,
      truncated
    };
  }

  public async replaceSnapshotExtraction(input: { batch: ExtractionBatch; replace: boolean }): Promise<void> {
    const snapshotId = this.requireBuildingSnapshotId(input.batch.snapshot_id);

    const tx = this.db.transaction(() => {
      const upsertFile = this.db.prepare(`
        INSERT INTO files (snapshot_id, path, language, content_hash, size_bytes, mtime_ms, indexed_at, indexing_error)
        VALUES (@snapshotId, @path, @language, @contentHash, @sizeBytes, @mtimeMs, @indexedAt, NULL)
        ON CONFLICT(snapshot_id, path) DO UPDATE SET
          language = excluded.language,
          content_hash = excluded.content_hash,
          size_bytes = excluded.size_bytes,
          mtime_ms = excluded.mtime_ms,
          indexed_at = excluded.indexed_at,
          indexing_error = NULL
      `);

      upsertFile.run({
        snapshotId,
        path: input.batch.source_path,
        language: input.batch.language,
        contentHash: input.batch.file_identity.content_hash,
        sizeBytes: input.batch.file_identity.size_bytes,
        mtimeMs: input.batch.file_identity.mtime_ms,
        indexedAt: input.batch.file_identity.indexed_at ?? null
      });

      const fileRow = this.db
        .prepare("SELECT id FROM files WHERE snapshot_id = @snapshotId AND path = @path")
        .get({
          snapshotId,
          path: input.batch.source_path
        }) as { id: number } | undefined;

      if (!fileRow) {
        throw new Error(`Failed to create file identity for ${input.batch.source_path}`);
      }

      const fileId = fileRow.id;

      if (input.replace) {
        this.clearFileRecords({ snapshotId, filePath: input.batch.source_path, fileId });
      }

      const upsertNode = this.db.prepare(`
        INSERT INTO nodes (
          id,
          file_id,
          kind,
          name,
          lower_name,
          qualified_name,
          language,
          start_line,
          start_column,
          end_line,
          end_column,
          signature,
          docstring,
          metadata_json
        ) VALUES (
          @id,
          @fileId,
          @kind,
          @name,
          @lowerName,
          @qualifiedName,
          @language,
          @startLine,
          @startColumn,
          @endLine,
          @endColumn,
          @signature,
          @docstring,
          @metadata
        )
        ON CONFLICT(id) DO UPDATE SET
          file_id = excluded.file_id,
          kind = excluded.kind,
          name = excluded.name,
          lower_name = excluded.lower_name,
          qualified_name = excluded.qualified_name,
          language = excluded.language,
          start_line = excluded.start_line,
          start_column = excluded.start_column,
          end_line = excluded.end_line,
          end_column = excluded.end_column,
          signature = excluded.signature,
          docstring = excluded.docstring,
          metadata_json = excluded.metadata_json
      `);

      const upsertNodeFts = this.db.prepare(`
        INSERT INTO node_fts (node_id, name, qualified_name, signature, docstring)
        VALUES (@nodeId, @name, @qualifiedName, @signature, @docstring)
      `);

      for (const node of input.batch.nodes) {
        upsertNode.run({
          id: node.id,
          fileId,
          kind: node.kind,
          name: node.name,
          lowerName: node.name.toLowerCase(),
          qualifiedName: node.qualified_name ?? null,
          language: node.language,
          startLine: node.source_range.start_line,
          startColumn: node.source_range.start_column,
          endLine: node.source_range.end_line,
          endColumn: node.source_range.end_column,
          signature: node.signature ?? null,
          docstring: node.docstring ?? null,
          metadata: JSON.stringify(node.metadata)
        });

        upsertNodeFts.run({
          nodeId: node.id,
          name: node.name,
          qualifiedName: node.qualified_name ?? null,
          signature: node.signature ?? null,
          docstring: node.docstring ?? null
        });
      }

      this.db.prepare("DELETE FROM node_fts WHERE node_id NOT IN (SELECT id FROM nodes)").run();

      const insertEdge = this.db.prepare(`
        INSERT INTO edges (
          source_node_id,
          target_node_id,
          kind,
          file_id,
          start_line,
          start_column,
          end_line,
          end_column,
          provenance,
          confidence,
          metadata_json
        ) VALUES (
          @sourceNodeId,
          @targetNodeId,
          @kind,
          @fileId,
          @startLine,
          @startColumn,
          @endLine,
          @endColumn,
          @provenance,
          @confidence,
          @metadata
        )
      `);

      for (const edge of input.batch.edges) {
        insertEdge.run({
          sourceNodeId: edge.source_node_id,
          targetNodeId: edge.target_node_id ?? null,
          kind: edge.kind,
          fileId,
          startLine: edge.source_range?.start_line ?? null,
          startColumn: edge.source_range?.start_column ?? null,
          endLine: edge.source_range?.end_line ?? null,
          endColumn: edge.source_range?.end_column ?? null,
          provenance: edge.provenance,
          confidence: edge.confidence,
          metadata: JSON.stringify(edge.metadata)
        });
      }

      const insertUnresolved = this.db.prepare(`
        INSERT INTO unresolved_refs (
          source_node_id,
          reference_name,
          reference_kind,
          file_id,
          start_line,
          start_column,
          end_line,
          end_column,
          candidate_metadata_json
        ) VALUES (
          @sourceNodeId,
          @referenceName,
          @referenceKind,
          @fileId,
          @startLine,
          @startColumn,
          @endLine,
          @endColumn,
          @candidateMetadata
        )
      `);

      for (const unresolved of input.batch.unresolved_references) {
        insertUnresolved.run({
          sourceNodeId: unresolved.source_node_id,
          referenceName: unresolved.reference_name,
          referenceKind: unresolved.reference_kind,
          fileId,
          startLine: unresolved.source_range.start_line,
          startColumn: unresolved.source_range.start_column,
          endLine: unresolved.source_range.end_line,
          endColumn: unresolved.source_range.end_column,
          candidateMetadata: JSON.stringify(unresolved.candidate_metadata)
        });
      }

      this.db
        .prepare("UPDATE files SET node_count = (SELECT COUNT(*) FROM nodes WHERE file_id = @fileId) WHERE id = @fileId")
        .run({ fileId });
    });

    tx();
  }

  public async upsertFileIdentity(input: { snapshot_id: string; file_identity: FileIdentity }): Promise<void> {
    const snapshotId = this.requireBuildingSnapshotId(input.snapshot_id);

    this.db
      .prepare(`
        INSERT INTO files (snapshot_id, path, language, content_hash, size_bytes, mtime_ms, indexed_at, indexing_error)
        VALUES (@snapshotId, @path, @language, @contentHash, @sizeBytes, @mtimeMs, @indexedAt, NULL)
        ON CONFLICT(snapshot_id, path) DO UPDATE SET
          language = excluded.language,
          content_hash = excluded.content_hash,
          size_bytes = excluded.size_bytes,
          mtime_ms = excluded.mtime_ms,
          indexed_at = excluded.indexed_at,
          indexing_error = NULL
      `)
      .run({
        snapshotId,
        path: input.file_identity.path,
        language: input.file_identity.language,
        contentHash: input.file_identity.content_hash,
        sizeBytes: input.file_identity.size_bytes,
        mtimeMs: input.file_identity.mtime_ms,
        indexedAt: input.file_identity.indexed_at ?? null
      });
  }

  public async insertEdges(input: {
    snapshot_id: string;
    file_path: string;
    edges: readonly GraphEdgeReadModel[];
  }): Promise<void> {
    const snapshotId = this.requireBuildingSnapshotId(input.snapshot_id);
    if (input.edges.length === 0) {
      return;
    }

    const fileRow = this.getFileRow(snapshotId, input.file_path);
    if (!fileRow) {
      throw new Error(`Unknown file for edge insertion: ${input.file_path}`);
    }

    const insertEdge = this.db.prepare(`
      INSERT INTO edges (
        source_node_id,
        target_node_id,
        kind,
        file_id,
        start_line,
        start_column,
        end_line,
        end_column,
        provenance,
        confidence,
        metadata_json
      ) VALUES (
        @sourceNodeId,
        @targetNodeId,
        @kind,
        @fileId,
        @startLine,
        @startColumn,
        @endLine,
        @endColumn,
        @provenance,
        @confidence,
        @metadata
      )
    `);

    const tx = this.db.transaction(() => {
      for (const edge of input.edges) {
        insertEdge.run({
          sourceNodeId: edge.source_node_id,
          targetNodeId: edge.target_node_id ?? null,
          kind: edge.kind,
          fileId: fileRow.id,
          startLine: edge.source_range?.start_line ?? null,
          startColumn: edge.source_range?.start_column ?? null,
          endLine: edge.source_range?.end_line ?? null,
          endColumn: edge.source_range?.end_column ?? null,
          provenance: edge.provenance,
          confidence: edge.confidence,
          metadata: JSON.stringify(edge.metadata)
        });
      }
    });

    tx();
  }

  public async clearFile(input: { snapshot_id: string; file_path: string }): Promise<void> {
    const snapshotId = this.requireBuildingSnapshotId(input.snapshot_id);

    const fileRow = this.getFileRow(snapshotId, input.file_path);
    if (!fileRow) {
      return;
    }

    this.clearFileRecords({ snapshotId, filePath: input.file_path, fileId: fileRow.id });
  }

  public async clearSnapshot(input: { snapshot_id: string }): Promise<void> {
    const snapshotId = this.requireBuildingSnapshotId(input.snapshot_id);

    this.clearSnapshotRecords({ snapshotId });
  }

  public async clearUnresolvedReferences(input: {
    snapshot_id: string;
    source_node_id: string;
  }): Promise<void> {
    const snapshotId = this.requireBuildingSnapshotId(input.snapshot_id);
    this.db.prepare(`
      DELETE FROM unresolved_refs
      WHERE source_node_id = @sourceNodeId
        AND file_id IN (SELECT id FROM files WHERE snapshot_id = @snapshotId)
    `).run({
      sourceNodeId: input.source_node_id,
      snapshotId
    });
  }

  public async getSnapshot(input: { repo_root: string; snapshot_id?: string }): Promise<SnapshotState | null> {
    if (input.snapshot_id) {
      const exactSnapshot = this.resolvePublishedSnapshotId(input.snapshot_id);
      const row = exactSnapshot !== null
        ? (this.getSnapshotRowById(exactSnapshot) as SnapshotRow | undefined)
        : null;
      if (row?.publication_state === "published") {
        return this.mapSnapshotRow(row);
      }
      return null;
    }

    const latest = this.getLatestSnapshotByRepo(input.repo_root);
    return latest ? this.mapSnapshotRow(latest) : null;
  }

  public async listSnapshots(input: { repo_root: string }): Promise<readonly SnapshotState[]> {
    const rows = this.db
      .prepare(
        `
        ${SNAPSHOT_SELECT_COLUMNS}
        FROM snapshots
        WHERE repo_identity = @repoRoot
          AND publication_state = 'published'
        ORDER BY id ASC
      `
      )
      .all({ repoRoot: input.repo_root }) as SnapshotRow[];

    return rows.map((row) => this.mapSnapshotRow(row));
  }

  public async upsertSnapshot(input: { snapshot: SnapshotState }): Promise<void> {
    const requestedId = this.parseNumericId(input.snapshot.id);
    if (requestedId === null || !Number.isSafeInteger(requestedId) || requestedId <= 0) {
      throw new TypeError(`Snapshot id must be a positive safe integer: ${input.snapshot.id}`);
    }
    if (input.snapshot.freshness === "refreshing") {
      throw new Error("Bootstrap snapshot seeding cannot create a controlled build.");
    }
    this.db.prepare(`
      INSERT INTO snapshots (
        id, repo_identity, config_identity, freshness, schema_version, created_at,
        publication_state, controller_generation, invalidation_generation, publication_updated_at
      ) VALUES (
        @id, @repoIdentity, @configIdentity, @freshness, @schemaVersion, @createdAt,
        'published', 0, 0, @createdAt
      )
    `).run({
      id: requestedId,
      repoIdentity: input.snapshot.repo_root,
      configIdentity: input.snapshot.config_identity,
      freshness: input.snapshot.freshness,
      schemaVersion: input.snapshot.schema_version,
      createdAt: input.snapshot.created_at
    });
  }

  public async createBuildSnapshot(input: {
    snapshot: SnapshotState;
    controller_generation: number;
    invalidation_generation: number;
    created_at: string;
  }): Promise<SnapshotPublicationRecord & { state: "building" }> {
    const snapshotId = this.parseNumericId(input.snapshot.id);
    if (snapshotId === null || !Number.isSafeInteger(snapshotId) || snapshotId <= 0) {
      throw new Error(`Snapshot id must be a positive safe integer: ${input.snapshot.id}`);
    }
    if (!Number.isSafeInteger(input.controller_generation) || input.controller_generation < 0) {
      throw new TypeError("controller_generation must be a non-negative safe integer.");
    }
    if (!Number.isSafeInteger(input.invalidation_generation) || input.invalidation_generation < 0) {
      throw new TypeError("invalidation_generation must be a non-negative safe integer.");
    }
    try {
      this.db.prepare(`
        INSERT INTO snapshots (
          id, repo_identity, config_identity, freshness, schema_version, created_at,
          publication_state, controller_generation, invalidation_generation, publication_updated_at
        ) VALUES (
          @snapshotId, @repoRoot, @configIdentity, @freshness, @schemaVersion, @createdAt,
          'building', @controllerGeneration, @invalidationGeneration, @createdAt
        )
      `).run({
        snapshotId,
        repoRoot: input.snapshot.repo_root,
        configIdentity: input.snapshot.config_identity,
        freshness: input.snapshot.freshness,
        schemaVersion: input.snapshot.schema_version,
        createdAt: input.created_at,
        controllerGeneration: input.controller_generation,
        invalidationGeneration: input.invalidation_generation
      });
    } catch (error) {
      if (this.getSnapshotRowById(snapshotId) !== undefined) {
        throw new Error(`Snapshot id already exists: ${input.snapshot.id}`, { cause: error });
      }
      throw error;
    }
    return {
      repo_root: input.snapshot.repo_root,
      snapshot_id: input.snapshot.id,
      controller_generation: input.controller_generation,
      invalidation_generation: input.invalidation_generation,
      state: "building",
      updated_at: input.created_at
    };
  }

  public async allocateBuildSnapshotId(input: {
    repo_root: string;
    minimum_id: string;
  }): Promise<string> {
    const minimumId = this.parseNumericId(input.minimum_id);
    if (minimumId === null || !Number.isSafeInteger(minimumId) || minimumId <= 0) {
      throw new TypeError("minimum_id must be a positive numeric SQLite snapshot id.");
    }
    const latest = this.db.prepare(`
      SELECT MAX(id) AS id
      FROM snapshots
      WHERE repo_identity = @repoRoot
    `).get({ repoRoot: input.repo_root }) as { id: number | null };
    const allocated = Math.max(minimumId, (latest.id ?? 0) + 1);
    if (!Number.isSafeInteger(allocated) || allocated <= 0) {
      throw new Error("No safe numeric snapshot id remains available.");
    }
    return String(allocated);
  }

  public async transitionBuild<TState extends "published" | "superseded" | "failed">(input: {
    repo_root: string;
    snapshot_id: string;
    controller_generation: number;
    invalidation_generation: number;
    from: "building";
    to: TState;
    updated_at: string;
  }): Promise<SnapshotPublicationRecord & { state: TState }> {
    const snapshotId = this.parseNumericId(input.snapshot_id);
    if (snapshotId === null) {
      throw new Error(`Unknown snapshot id: ${input.snapshot_id}`);
    }
    const transition = this.db.transaction(() => {
      const current = this.getSnapshotRowById(snapshotId);
      if (!current || current.repo_identity !== input.repo_root) {
        throw new Error(`Unknown snapshot id: ${input.snapshot_id}`);
      }
      if (current.publication_state !== input.from) {
        throw new Error(
          `Snapshot ${input.snapshot_id} cannot transition from ${current.publication_state} to ${input.to}.`
        );
      }
      if (
        current.controller_generation !== input.controller_generation ||
        current.invalidation_generation !== input.invalidation_generation
      ) {
        throw new Error(
          `Snapshot ${input.snapshot_id} publication generation does not match the active build.`
        );
      }
      this.db.prepare(`
        UPDATE snapshots
        SET publication_state = @state, publication_updated_at = @updatedAt
        WHERE id = @snapshotId
          AND publication_state = @fromState
          AND controller_generation = @controllerGeneration
          AND invalidation_generation = @invalidationGeneration
      `).run({
        snapshotId,
        state: input.to,
        fromState: input.from,
        controllerGeneration: input.controller_generation,
        invalidationGeneration: input.invalidation_generation,
        updatedAt: input.updated_at
      });
      return this.getSnapshotRowById(snapshotId)!;
    });
    return this.mapPublicationRecord(transition.immediate()) as SnapshotPublicationRecord & { state: TState };
  }

  public async reconcileOrphanedBuilds(input: {
    repo_root: string;
    current_owner: RepositoryOwnershipLease & { state: "active" };
    recovered_owners?: readonly (RepositoryOwnershipLease & { state: "dead" })[];
    updated_at: string;
  }): Promise<SnapshotOrphanReconciliationResult> {
    const reconcile = this.db.transaction(() => {
      const rows = this.db.prepare(`
        SELECT id, controller_generation
        FROM snapshots
        WHERE repo_identity = @repoRoot
          AND publication_state = 'building'
        ORDER BY id ASC
      `).all({ repoRoot: input.repo_root }) as Array<{
        id: number;
        controller_generation: number;
      }>;
      const snapshotIds = rows.map((row) => String(row.id));
      if (rows.length === 0) {
        return { outcome: "reconciled" as const, snapshot_ids: snapshotIds };
      }
      if (
        input.recovered_owners === undefined ||
        input.recovered_owners.length === 0 ||
        input.current_owner.repo_root !== input.repo_root ||
        input.recovered_owners.some((owner) =>
          owner.repo_root !== input.current_owner.repo_root ||
          owner.schema_version !== input.current_owner.schema_version
        ) ||
        rows.some((row) => !input.recovered_owners?.some(
          (owner) => owner.owner_generation === row.controller_generation
        ))
      ) {
        return {
          outcome: "blocked" as const,
          reason: "ownership_ambiguous" as const,
          snapshot_ids: snapshotIds
        };
      }
      const ownerGenerations = input.recovered_owners.map((owner) => owner.owner_generation);
      const placeholders = sqlPlaceholders(ownerGenerations.length);
      this.db.prepare(`
        UPDATE snapshots
        SET publication_state = 'failed', publication_updated_at = ?
        WHERE repo_identity = ?
          AND publication_state = 'building'
          AND controller_generation IN (${placeholders})
      `).run(input.updated_at, input.repo_root, ...ownerGenerations);
      return { outcome: "reconciled" as const, snapshot_ids: snapshotIds };
    });
    return reconcile.immediate();
  }

  public async getLatestPublished(input: {
    repo_root: string;
  }): Promise<Exclude<SnapshotPublicationSelection, { status: "blocked" }>> {
    const row = this.getLatestSnapshotByRepo(input.repo_root);
    if (!row) {
      return { status: "missing", reason: "no_published_snapshot" };
    }
    return {
      status: "selected",
      snapshot: this.mapSnapshotRow(row),
      publication: { ...this.mapPublicationRecord(row), state: "published" }
    };
  }

  public async readExplicit(input: {
    repo_root: string;
    snapshot_id: string;
  }): Promise<SnapshotPublicationSelection> {
    const snapshotId = this.parseNumericId(input.snapshot_id);
    const row = snapshotId === null ? undefined : this.getSnapshotRowById(snapshotId);
    if (!row || row.repo_identity !== input.repo_root) {
      return { status: "missing", snapshot_id: input.snapshot_id, reason: "snapshot_not_found" };
    }
    if (row.publication_state !== "published") {
      return {
        status: "blocked",
        snapshot_id: input.snapshot_id,
        publication_state: row.publication_state,
        reason: "snapshot_unpublished",
        message: "Snapshot is not published."
      };
    }
    return {
      status: "selected",
      snapshot: this.mapSnapshotRow(row),
      publication: { ...this.mapPublicationRecord(row), state: "published" }
    };
  }

  public async markSnapshotFreshness(input: {
    snapshot_id: string;
    freshness: SnapshotState["freshness"];
    owner_state?: SnapshotState["owner_state"];
    reason?: string;
  }): Promise<void> {
    const snapshotId = this.resolveExistingSnapshotId(input.snapshot_id);
    if (snapshotId == null) {
      return;
    }

    this.db
      .prepare("UPDATE snapshots SET freshness = @freshness WHERE id = @snapshotId")
      .run({ snapshotId, freshness: input.freshness });
  }

  public async listFiles(input: {
    snapshot_id: string;
    after_path?: string;
    max_rows?: number;
  }): Promise<readonly FileCatalogEntry[]> {
    const snapshotId = this.resolvePublishedSnapshotId(input.snapshot_id);
    if (snapshotId == null) {
      return [];
    }

    const rows = this.db
      .prepare(
        `
        SELECT id, snapshot_id, path, language, content_hash, size_bytes, mtime_ms, indexed_at, node_count, indexing_error
        FROM files
        WHERE snapshot_id = @snapshotId
          AND (@afterPath IS NULL OR path > @afterPath)
        ORDER BY path ASC
        LIMIT @maxRows
      `
      )
      .all({
        snapshotId,
        afterPath: input.after_path ?? null,
        maxRows: input.max_rows ?? 50
      }) as FileRow[];

    return rows.map((row) =>
      this.mapFileCatalogRow({
        path: row.path,
        file_identity: {
          path: row.path,
          language: row.language,
          content_hash: row.content_hash,
          size_bytes: row.size_bytes,
          mtime_ms: row.mtime_ms,
          indexed_at: row.indexed_at ?? undefined
        },
        indexed: row.indexed_at != null,
        skipped_reason: row.indexing_error ?? undefined
      })
    );
  }

  public async listIndexedPaths(input: {
    snapshot_id: string;
    max_rows: number;
  }): Promise<readonly string[]> {
    const snapshotId = this.resolvePublishedSnapshotId(input.snapshot_id);
    if (snapshotId == null) {
      return [];
    }
    const rows = this.db.prepare(`
      SELECT path FROM (
        SELECT path FROM files WHERE snapshot_id = @snapshotId
        UNION
        SELECT path FROM docs_documents WHERE snapshot_id = @snapshotId
      )
      ORDER BY path
      LIMIT @maxRows
    `).all({ snapshotId, maxRows: input.max_rows }) as Array<{ path: string }>;
    return rows.map((row) => row.path);
  }

  public async getFile(input: { snapshot_id: string; path: string }): Promise<FileCatalogEntry | null> {
    const snapshotId = this.resolvePublishedSnapshotId(input.snapshot_id);
    if (snapshotId == null) {
      return null;
    }

    const row = this.getFileRow(snapshotId, input.path);
    if (!row) {
      return null;
    }

    return {
      path: row.path,
      file_identity: {
        path: row.path,
        language: row.language,
        content_hash: row.content_hash,
        size_bytes: row.size_bytes,
        mtime_ms: row.mtime_ms,
        indexed_at: row.indexed_at ?? undefined
      },
      indexed: row.indexed_at != null,
      skipped_reason: row.indexing_error ?? undefined
    };
  }

  public async upsertEntry(input: { snapshot_id: string; entry: FileCatalogEntry }): Promise<void> {
    const snapshotId = this.requireBuildingSnapshotId(input.snapshot_id);

    this.db
      .prepare(`
        INSERT INTO files (snapshot_id, path, language, content_hash, size_bytes, mtime_ms, indexed_at, indexing_error)
        VALUES (@snapshotId, @path, @language, @contentHash, @sizeBytes, @mtimeMs, @indexedAt, @indexingError)
        ON CONFLICT(snapshot_id, path) DO UPDATE SET
          language = excluded.language,
          content_hash = excluded.content_hash,
          size_bytes = excluded.size_bytes,
          mtime_ms = excluded.mtime_ms,
          indexed_at = excluded.indexed_at,
          indexing_error = excluded.indexing_error
      `)
      .run({
        snapshotId,
        path: input.entry.path,
        language: input.entry.file_identity.language,
        contentHash: input.entry.file_identity.content_hash,
        sizeBytes: input.entry.file_identity.size_bytes,
        mtimeMs: input.entry.file_identity.mtime_ms,
        indexedAt: input.entry.indexed ? (input.entry.file_identity.indexed_at ?? null) : null,
        indexingError: input.entry.skipped_reason ?? null
      });
  }

  public async removeEntry(input: { snapshot_id: string; path: string }): Promise<void> {
    const snapshotId = this.requireBuildingSnapshotId(input.snapshot_id);

    const tx = this.db.transaction(() => {
      const fileRow = this.getFileRow(snapshotId, input.path);
      const docsRow = this.db.prepare(`
        SELECT COUNT(*) AS count
        FROM docs_documents
        WHERE snapshot_id = @snapshotId AND path = @path
      `).get({ snapshotId, path: input.path }) as { count: number };
      if (fileRow === null && docsRow.count === 0) {
        return;
      }
      this.db.prepare(`
        DELETE FROM docs_fts
        WHERE rowid IN (
          SELECT id FROM docs_documents
          WHERE snapshot_id = @snapshotId AND path = @path
        )
      `).run({ snapshotId, path: input.path });
      this.db.prepare(`
        DELETE FROM docs_headings
        WHERE document_id IN (
          SELECT id FROM docs_documents
          WHERE snapshot_id = @snapshotId AND path = @path
        )
      `).run({ snapshotId, path: input.path });
      this.db.prepare(
        "DELETE FROM docs_documents WHERE snapshot_id = @snapshotId AND path = @path"
      ).run({ snapshotId, path: input.path });
      if (fileRow) {
        this.clearFileRecords({ snapshotId, filePath: input.path, fileId: fileRow.id });
      }
      this.db.prepare("DELETE FROM files WHERE snapshot_id = @snapshotId AND path = @path").run({
        snapshotId,
        path: input.path
      });
      if (fileRow !== null) {
        this.db.prepare(`
        UPDATE snapshot_index_coverage
        SET state = 'stale',
            indexed_files = CASE
              WHEN indexed_files IS NULL THEN NULL
              WHEN indexed_files > 0 THEN indexed_files - 1
              ELSE 0
            END,
            reason = 'Indexed file removal invalidated snapshot coverage.'
        WHERE snapshot_id = @snapshotId AND evidence_class = 'graph'
      `).run({ snapshotId });
      }
      if (docsRow.count > 0) {
        this.db.prepare(`
          UPDATE snapshot_index_coverage
          SET state = 'stale',
              indexed_files = CASE
                WHEN indexed_files IS NULL THEN NULL
                WHEN indexed_files > 0 THEN indexed_files - 1
                ELSE 0
              END,
              reason = 'Indexed document removal invalidated snapshot coverage.'
          WHERE snapshot_id = @snapshotId AND evidence_class = 'docs'
        `).run({ snapshotId });
      }
      this.db.prepare(`
        UPDATE snapshots
        SET freshness = 'stale'
        WHERE id = @snapshotId
      `).run({ snapshotId });
    });
    tx();
  }

  public async pruneRepositorySnapshots(input: {
    repo_root: string;
    retain_latest_snapshots: number;
    retain_latest_fresh_snapshots: number;
    vacuum: boolean;
  }): Promise<{
    repo_root: string;
    deleted_snapshots: number;
    retained_snapshot_ids: readonly string[];
    optimized: boolean;
    vacuumed: boolean;
  }> {
    const retainLatestSnapshots = Math.max(1, input.retain_latest_snapshots);
    const retainLatestFreshSnapshots = Math.max(0, input.retain_latest_fresh_snapshots);
    const allSnapshots = this.db
      .prepare(
        `
        ${SNAPSHOT_SELECT_COLUMNS}
        FROM snapshots
        WHERE repo_identity = @repoRoot
        ORDER BY id DESC
      `
      )
      .all({ repoRoot: input.repo_root }) as SnapshotRow[];
    const snapshots = allSnapshots.filter((snapshot) => snapshot.publication_state === "published");

    const retained = new Set<number>();
    for (const snapshot of allSnapshots.filter((candidate) => candidate.publication_state === "building")) {
      retained.add(snapshot.id);
    }
    for (const snapshot of snapshots.slice(0, retainLatestSnapshots)) {
      retained.add(snapshot.id);
    }
    for (const snapshot of snapshots.filter((candidate) => candidate.freshness === "fresh").slice(0, retainLatestFreshSnapshots)) {
      retained.add(snapshot.id);
    }

    const deleteIds = allSnapshots.map((snapshot) => snapshot.id).filter((snapshotId) => !retained.has(snapshotId));
    if (deleteIds.length > 0) {
      const tx = this.db.transaction(() => {
        this.deleteSnapshotData(deleteIds);
      });
      tx();
    }

    const optimized = input.vacuum && deleteIds.length > 0;
    if (optimized) {
      this.optimizeStorage();
    }

    let vacuumed = false;
    if (input.vacuum && deleteIds.length > 0) {
      this.db.exec("VACUUM");
      vacuumed = true;
    }

    return {
      repo_root: input.repo_root,
      deleted_snapshots: deleteIds.length,
      retained_snapshot_ids: allSnapshots
        .map((snapshot) => snapshot.id)
        .filter((snapshotId) => retained.has(snapshotId))
        .map((snapshotId) => String(snapshotId)),
      optimized,
      vacuumed
    };
  }

  public async replaceSnapshotDocs(input: {
    snapshot_id: string;
    repo_root: string;
    documents: readonly DocsIndexDocumentWrite[];
    coverage?: readonly IndexCoverage[];
  }): Promise<void> {
    const snapshotId = this.requireBuildingSnapshotId(input.snapshot_id);

    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM docs_fts WHERE rowid IN (SELECT id FROM docs_documents WHERE snapshot_id = @snapshotId)").run({
        snapshotId
      });
      this.db.prepare("DELETE FROM docs_documents WHERE snapshot_id = @snapshotId").run({ snapshotId });
      if (input.coverage !== undefined) {
        this.db.prepare("DELETE FROM snapshot_index_coverage WHERE snapshot_id = @snapshotId").run({ snapshotId });
      }

      const insertDoc = this.db.prepare(`
        INSERT INTO docs_documents (
          snapshot_id,
          path,
          title,
          content_hash,
          byte_count,
          indexed_at,
          selected_text_truncated
        ) VALUES (
          @snapshotId,
          @path,
          @title,
          @contentHash,
          @byteCount,
          @indexedAt,
          @selectedTextTruncated
        )
      `);
      const insertHeading = this.db.prepare(`
        INSERT INTO docs_headings (
          document_id,
          heading_id,
          heading_text,
          depth,
          line
        ) VALUES (
          @documentId,
          @headingId,
          @headingText,
          @depth,
          @line
        )
      `);
      const insertFts = this.db.prepare(`
        INSERT INTO docs_fts (
          rowid,
          path,
          title,
          headings_text,
          selected_text
        ) VALUES (
          @rowid,
          @path,
          @title,
          @headingsText,
          @selectedText
        )
      `);
      const insertCoverage = this.db.prepare(`
        INSERT INTO snapshot_index_coverage (
          snapshot_id,
          evidence_class,
          state,
          indexed_files,
          eligible_files_seen,
          scan_truncated,
          indexed_roots_json,
          missing_priority_roots_json,
          reason
        ) VALUES (
          @snapshotId,
          @evidenceClass,
          @state,
          @indexedFiles,
          @eligibleFilesSeen,
          @scanTruncated,
          @indexedRootsJson,
          @missingPriorityRootsJson,
          @reason
        )
      `);

      for (const doc of input.documents) {
        const result = insertDoc.run({
          snapshotId,
          path: doc.path,
          title: doc.title,
          contentHash: doc.content_hash,
          byteCount: doc.byte_count,
          indexedAt: doc.indexed_at,
          selectedTextTruncated: doc.truncated ? 1 : 0
        });
        const documentId = Number(result.lastInsertRowid);
        for (const heading of doc.headings) {
          insertHeading.run({
            documentId,
            headingId: heading.id,
            headingText: heading.text,
            depth: heading.depth,
            line: heading.line
          });
        }
        insertFts.run({
          rowid: documentId,
          path: doc.path,
          title: doc.title,
          headingsText: doc.headings.map((heading) => heading.text).join("\n"),
          selectedText: doc.selected_text
        });
      }

      for (const item of input.coverage ?? []) {
        insertCoverage.run({
          snapshotId,
          evidenceClass: item.evidence_class,
          state: item.state,
          indexedFiles: item.indexed_files ?? null,
          eligibleFilesSeen: item.eligible_files_seen ?? null,
          scanTruncated: item.scan_truncated === undefined ? null : item.scan_truncated ? 1 : 0,
          indexedRootsJson: item.indexed_roots === undefined ? null : JSON.stringify(item.indexed_roots),
          missingPriorityRootsJson: item.missing_priority_roots === undefined ? null : JSON.stringify(item.missing_priority_roots),
          reason: item.reason ?? null
        });
      }
    });

    tx();
  }

  public async getState(input: { repo_root: string; snapshot_id?: string }): Promise<DocsIndexState> {
    const snapshot = await this.getSnapshot(input);
    if (snapshot === null) {
      return {
        repo_root: input.repo_root,
        freshness: "cold",
        status: "cold",
        coverage_state: "blocked",
        reason: "No graph snapshot is available, so docs FTS evidence is cold.",
        document_count: 0
      };
    }

    const snapshotId = this.resolvePublishedSnapshotId(snapshot.id);
    if (snapshotId == null) {
      return {
        repo_root: snapshot.repo_root,
        snapshot_id: snapshot.id,
        freshness: snapshot.freshness,
        status: "invalid",
        coverage_state: "blocked",
        reason: "Snapshot id could not be resolved for docs FTS evidence.",
        document_count: 0
      };
    }

    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM docs_documents WHERE snapshot_id = @snapshotId")
      .get({ snapshotId }) as { count: number } | undefined;
    const documentCount = row?.count ?? 0;
    const coverage = this.getSnapshotIndexCoverage(snapshotId);
    const docsCoverage = coverage.find((item) => item.evidence_class === "docs");
    const graphCoverage = coverage.find((item) => item.evidence_class === "graph");
    if (snapshot.freshness === "refreshing" && documentCount > 0) {
      return {
        repo_root: snapshot.repo_root,
        snapshot_id: snapshot.id,
        freshness: "refreshing",
        status: "usable",
        coverage_state: docsCoverage?.state ?? "partial",
        coverage,
        docs_scan_truncated: docsCoverage?.scan_truncated,
        reason: graphCoverage?.state === "partial" || graphCoverage?.state === "refreshing"
          ? "Docs FTS evidence is usable from a refreshing graph snapshot; graph coverage may still be partial."
          : docsCoverage?.reason ?? "Docs FTS evidence is usable from a refreshing graph snapshot; graph coverage may still be partial.",
        document_count: documentCount
      };
    }
    if (snapshot.freshness !== "fresh" && input.snapshot_id === undefined) {
      const usable = this.getLatestUsableDocsSnapshotByRepo(input.repo_root);
      if (usable !== undefined) {
        const usableCoverage = this.getSnapshotIndexCoverage(usable.id);
        const usableDocsCoverage = usableCoverage.find((item) => item.evidence_class === "docs");
        return {
          repo_root: usable.repo_identity,
          snapshot_id: String(usable.id),
          freshness: "fresh",
          status: "usable",
          coverage_state: usableDocsCoverage?.state ?? "complete",
          coverage: usableCoverage,
          docs_scan_truncated: usableDocsCoverage?.scan_truncated,
          document_count: usable.document_count,
          reason: usableDocsCoverage?.reason
        };
      }
    }

    if (snapshot.freshness !== "fresh") {
      return {
        repo_root: snapshot.repo_root,
        snapshot_id: snapshot.id,
        freshness: snapshot.freshness,
        status: "stale",
        coverage_state: docsCoverage?.state ?? "stale",
        coverage,
        docs_scan_truncated: docsCoverage?.scan_truncated,
        reason: `Docs FTS evidence depends on a ${snapshot.freshness} graph snapshot.`,
        document_count: documentCount
      };
    }
    if (documentCount === 0) {
      return {
        repo_root: snapshot.repo_root,
        snapshot_id: snapshot.id,
        freshness: "cold",
        status: "cold",
        coverage_state: "blocked",
        reason: "No Markdown documents were indexed into docs FTS for this snapshot.",
        document_count: 0
      };
    }
    return {
      repo_root: snapshot.repo_root,
      snapshot_id: snapshot.id,
      freshness: "fresh",
      status: "usable",
      coverage_state: docsCoverage?.state ?? "complete",
      coverage,
      docs_scan_truncated: docsCoverage?.scan_truncated,
      document_count: documentCount
    };
  }

  public async search(input: DocsIndexSearchRequest): Promise<DocsIndexSearchResult> {
    const state = await this.getState({ repo_root: input.repo_root, snapshot_id: input.snapshot_id });
    if (state.status !== "usable" || state.snapshot_id === undefined) {
      return {
        status: "blocked",
        repo_root: state.repo_root,
        snapshot_id: state.snapshot_id,
        freshness: state.freshness,
        reason: state.status === "usable" ? "invalid" : state.status,
        message: state.reason ?? "Docs FTS evidence is not usable.",
        hits: [],
        truncated: false,
        result_count: 0,
        result_count_basis: "page",
        docs_index_state: state.coverage_state,
        indexed_docs_count: state.document_count,
        docs_scan_truncated: state.docs_scan_truncated ?? false,
        coverage: state.coverage,
        coverage_note: state.reason
      };
    }

    const snapshotId = this.resolvePublishedSnapshotId(state.snapshot_id);
    if (snapshotId == null) {
      return {
        status: "blocked",
        repo_root: state.repo_root,
        snapshot_id: state.snapshot_id,
        freshness: state.freshness,
        reason: "invalid",
        message: "Snapshot id could not be resolved for docs FTS search.",
        hits: [],
        truncated: false,
        result_count: 0,
        result_count_basis: "page",
        docs_index_state: "blocked",
        indexed_docs_count: state.document_count,
        docs_scan_truncated: state.docs_scan_truncated ?? false,
        coverage: state.coverage,
        coverage_note: "Snapshot id could not be resolved for docs FTS search."
      };
    }

    const cursor = decodeDocsCursor(input.cursor);
    const scopePath = normalizeDocsScopePath(input.scope_path);
    if (cursor !== undefined && cursor.snapshot_id !== state.snapshot_id) {
      return {
        status: "blocked",
        repo_root: state.repo_root,
        snapshot_id: state.snapshot_id,
        freshness: state.freshness,
        reason: "stale",
        message: "Docs search cursor belongs to a different snapshot.",
        hits: [],
        truncated: false,
        result_count: 0,
        result_count_basis: "page",
        docs_index_state: state.coverage_state,
        indexed_docs_count: state.document_count,
        docs_scan_truncated: state.docs_scan_truncated ?? false,
        coverage: state.coverage,
        coverage_note: "Docs search cursor belongs to a different snapshot."
      };
    }
    if (cursor !== undefined && cursor.scope_path !== scopePath) {
      return {
        status: "blocked",
        repo_root: state.repo_root,
        snapshot_id: state.snapshot_id,
        freshness: state.freshness,
        reason: "stale",
        message: "Docs search cursor belongs to a different scope_path.",
        hits: [],
        truncated: false,
        result_count: 0,
        result_count_basis: "page",
        docs_index_state: state.coverage_state,
        indexed_docs_count: state.document_count,
        docs_scan_truncated: state.docs_scan_truncated ?? false,
        coverage: state.coverage,
        coverage_note: "Docs search cursor belongs to a different scope_path."
      };
    }

    const offset = cursor?.offset ?? 0;
    const ftsQuery = buildDocsFtsQuery(input.query);
    if (ftsQuery.length === 0) {
      return {
        status: "done",
        repo_root: state.repo_root,
        snapshot_id: state.snapshot_id,
        freshness: state.freshness,
        hits: [],
        truncated: false,
        result_count: 0,
        result_count_basis: "page",
        docs_index_state: state.coverage_state,
        indexed_docs_count: state.document_count,
        docs_scan_truncated: state.docs_scan_truncated ?? false,
        coverage: state.coverage,
        coverage_note: state.reason
      };
    }

    const candidateLimit = Math.max(input.max_results + 1, 500);
    const rows = this.db
      .prepare(
        `
        SELECT
          docs_documents.path,
          docs_documents.title,
          docs_fts.headings_text,
          docs_fts.selected_text,
          files.mtime_ms,
          bm25(docs_fts, -7.0, -9.0, -6.0, -1.0) AS rank_score
        FROM docs_fts
        INNER JOIN docs_documents ON docs_documents.id = docs_fts.rowid
        LEFT JOIN files ON files.snapshot_id = docs_documents.snapshot_id AND files.path = docs_documents.path
        WHERE docs_documents.snapshot_id = @snapshotId
          AND docs_fts MATCH @ftsQuery
          AND (@scopePath IS NULL OR docs_documents.path = @scopePath OR docs_documents.path LIKE @scopePrefix)
        ORDER BY rank_score DESC, docs_documents.path ASC
        LIMIT @limit
        OFFSET @offset
      `
      )
      .all({
        snapshotId,
        ftsQuery,
        scopePath: scopePath ?? null,
        scopePrefix: scopePath === undefined ? null : `${scopePath}/%`,
        limit: candidateLimit,
        offset
      }) as DocsSearchRow[];

    const rankedHits = rows
      .map((row) => this.mapDocsSearchRow({ row, query: input.query, includeSnippets: input.include_snippets }))
      .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));
    const hits = rankedHits.slice(0, input.max_results);
    const truncated = rows.length > input.max_results;

    return {
      status: "done",
      repo_root: state.repo_root,
      snapshot_id: state.snapshot_id,
      freshness: state.freshness,
      hits,
      truncated,
      cursor: truncated
        ? encodeDocsCursor({
            snapshot_id: state.snapshot_id,
            query: input.query,
            scope_path: scopePath,
            offset: offset + input.max_results
          })
        : undefined,
      result_count: hits.length,
      result_count_basis: "page",
      docs_index_state: state.coverage_state,
      indexed_docs_count: state.document_count,
      docs_scan_truncated: state.docs_scan_truncated ?? false,
      coverage: state.coverage,
      coverage_note: state.reason
    };
  }

  private resolvePublishedSnapshotId(snapshotId: string): number | null {
    const byId = this.parseNumericId(snapshotId);
    if (byId === null) {
      return null;
    }
    const row = this.getSnapshotRowById(byId);
    return row?.publication_state === "published" ? row.id : null;
  }

  private requireBuildingSnapshotId(snapshotId: string): number {
    const byId = this.parseNumericId(snapshotId);
    const row = byId === null ? undefined : this.getSnapshotRowById(byId);
    if (row?.publication_state !== "building") {
      throw new Error(`Snapshot ${snapshotId} is not building.`);
    }
    return row.id;
  }

  private resolveExistingSnapshotId(snapshotId: string): number | null {
    const byId = this.parseNumericId(snapshotId);
    return byId !== null && this.getSnapshotRowById(byId) !== undefined ? byId : null;
  }

  private getSnapshotByRepo(repoRoot: string): SnapshotRow | undefined {
    return this.db
      .prepare(
        `
        ${SNAPSHOT_SELECT_COLUMNS}
        FROM snapshots
        WHERE repo_identity = @repoRoot
          AND publication_state = 'published'
        ORDER BY id DESC
        LIMIT 1
      `
      )
      .get({ repoRoot }) as SnapshotRow | undefined;
  }

  private getLatestSnapshotByRepo(repoRoot: string): SnapshotRow | undefined {
    return (this.db
      .prepare(
        `
        ${SNAPSHOT_SELECT_COLUMNS}
        FROM snapshots
        WHERE repo_identity = @repoRoot
          AND publication_state = 'published'
        ORDER BY id DESC
        LIMIT 1
      `
      )
      .get({ repoRoot }) as SnapshotRow | undefined);
  }

  private getLatestUsableDocsSnapshotByRepo(repoRoot: string): (SnapshotRow & { document_count: number }) | undefined {
    return this.db
      .prepare(
        `
        SELECT snapshots.id,
               snapshots.repo_identity,
               snapshots.config_identity,
               snapshots.freshness,
               snapshots.schema_version,
               snapshots.created_at,
               snapshots.publication_state,
               snapshots.controller_generation,
               snapshots.invalidation_generation,
               snapshots.publication_updated_at,
               COUNT(docs_documents.path) AS document_count
        FROM snapshots
        JOIN docs_documents ON docs_documents.snapshot_id = snapshots.id
        WHERE snapshots.repo_identity = @repoRoot
          AND snapshots.freshness = 'fresh'
          AND snapshots.publication_state = 'published'
        GROUP BY snapshots.id
        HAVING document_count > 0
        ORDER BY snapshots.id DESC
        LIMIT 1
      `
      )
      .get({ repoRoot }) as (SnapshotRow & { document_count: number }) | undefined;
  }

  private getSnapshotRowById(snapshotId: number): SnapshotRow | undefined {
    return this.db
      .prepare(
        `
        ${SNAPSHOT_SELECT_COLUMNS}
        FROM snapshots
        WHERE id = @snapshotId
      `
      )
      .get({ snapshotId }) as SnapshotRow | undefined;
  }

  private getSnapshotIndexCoverage(snapshotId: number): IndexCoverage[] {
    const rows = this.db
      .prepare(
        `
        SELECT
          evidence_class,
          state,
          indexed_files,
          eligible_files_seen,
          scan_truncated,
          indexed_roots_json,
          missing_priority_roots_json,
          reason
        FROM snapshot_index_coverage
        WHERE snapshot_id = @snapshotId
        ORDER BY CASE evidence_class WHEN 'docs' THEN 0 ELSE 1 END, evidence_class ASC
      `
      )
      .all({ snapshotId }) as IndexCoverageRow[];

    return rows.map((row) => ({
      evidence_class: row.evidence_class,
      state: row.state,
      indexed_files: row.indexed_files ?? undefined,
      eligible_files_seen: row.eligible_files_seen ?? undefined,
      scan_truncated: row.scan_truncated === null ? undefined : row.scan_truncated === 1,
      indexed_roots: parseStringArrayJson(row.indexed_roots_json),
      missing_priority_roots: parseStringArrayJson(row.missing_priority_roots_json),
      reason: row.reason ?? undefined
    }));
  }

  private getFileRow(snapshotId: number, filePath: string): FileRow | null {
    const row = this.db
      .prepare(
        `
        SELECT id, snapshot_id, path, language, content_hash, size_bytes, mtime_ms, indexed_at, node_count, indexing_error
        FROM files
        WHERE snapshot_id = @snapshotId AND path = @path
      `
      )
      .get({
        snapshotId,
        path: filePath
      }) as FileRow | undefined;
    return row ?? null;
  }

  private clearFileRecords(input: { snapshotId: number; filePath: string; fileId: number }): void {
    this.db.prepare("DELETE FROM node_fts WHERE node_id IN (SELECT id FROM nodes WHERE file_id = @fileId)").run({
      fileId: input.fileId
    });

    this.db.prepare("DELETE FROM unresolved_refs WHERE source_node_id IN (SELECT id FROM nodes WHERE file_id = @fileId)").run({
      fileId: input.fileId
    });

    this.db
      .prepare(
        `
        DELETE FROM edges
        WHERE source_node_id IN (SELECT id FROM nodes WHERE file_id = @fileId)
           OR target_node_id IN (SELECT id FROM nodes WHERE file_id = @fileId)
      `
      )
      .run({ fileId: input.fileId });

    this.db.prepare("DELETE FROM nodes WHERE file_id = @fileId").run({
      fileId: input.fileId
    });
  }

  private clearSnapshotRecords(input: { snapshotId: number }): void {
    this.deleteSnapshotData([input.snapshotId]);
    this.rebuildNodeFts();
  }

  private deleteSnapshotData(snapshotIds: readonly number[]): void {
    if (snapshotIds.length === 0) {
      return;
    }
    const placeholders = sqlPlaceholders(snapshotIds.length);
    this.db
      .prepare(`DELETE FROM docs_fts WHERE rowid IN (SELECT id FROM docs_documents WHERE snapshot_id IN (${placeholders}))`)
      .run(...snapshotIds);
    this.db
      .prepare(`DELETE FROM docs_headings WHERE document_id IN (SELECT id FROM docs_documents WHERE snapshot_id IN (${placeholders}))`)
      .run(...snapshotIds);
    this.db.prepare(`DELETE FROM docs_documents WHERE snapshot_id IN (${placeholders})`).run(...snapshotIds);
    this.db.prepare(`DELETE FROM snapshot_index_coverage WHERE snapshot_id IN (${placeholders})`).run(...snapshotIds);
    this.db
      .prepare(`DELETE FROM edges WHERE file_id IN (SELECT id FROM files WHERE snapshot_id IN (${placeholders}))`)
      .run(...snapshotIds);
    this.db
      .prepare(`DELETE FROM unresolved_refs WHERE file_id IN (SELECT id FROM files WHERE snapshot_id IN (${placeholders}))`)
      .run(...snapshotIds);
    this.db
      .prepare(`DELETE FROM node_fts WHERE node_id IN (SELECT id FROM nodes WHERE file_id IN (SELECT id FROM files WHERE snapshot_id IN (${placeholders})))`)
      .run(...snapshotIds);
    this.db
      .prepare(`DELETE FROM nodes WHERE file_id IN (SELECT id FROM files WHERE snapshot_id IN (${placeholders}))`)
      .run(...snapshotIds);
    this.db.prepare(`DELETE FROM files WHERE snapshot_id IN (${placeholders})`).run(...snapshotIds);
    this.db.prepare(`DELETE FROM snapshots WHERE id IN (${placeholders})`).run(...snapshotIds);
  }

  private rebuildNodeFts(): void {
    this.db.prepare("DELETE FROM node_fts").run();
    this.db
      .prepare(
        `
        INSERT INTO node_fts (node_id, name, qualified_name, signature, docstring)
        SELECT id, name, qualified_name, signature, docstring
        FROM nodes
      `
      )
      .run();
  }

  private optimizeStorage(): void {
    this.db.prepare("INSERT INTO node_fts(node_fts) VALUES ('optimize')").run();
    this.db.prepare("INSERT INTO docs_fts(docs_fts) VALUES ('optimize')").run();
    this.db.pragma("optimize");
  }

  private mapGraphNodeRow(row: NodeWithFileRow): GraphNodeReadModel {
    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      qualified_name: row.qualified_name ?? undefined,
      file_path: row.path,
      language: row.language,
      source_range: {
        start_line: row.start_line,
        start_column: row.start_column,
        end_line: row.end_line,
        end_column: row.end_column
      },
      signature: row.signature ?? undefined,
      docstring: row.docstring ?? undefined,
      metadata: parseMetadataJson(row.metadata_json)
    };
  }

  private mapGraphEdgeRow(row: EdgeRow): GraphEdgeReadModel {
    return {
      id: String(row.id),
      source_node_id: row.source_node_id,
      target_node_id: row.target_node_id ?? undefined,
      kind: row.kind,
      source_range:
        row.start_line === null || row.start_column === null || row.end_line === null || row.end_column === null
          ? undefined
          : {
              start_line: row.start_line,
              start_column: row.start_column,
              end_line: row.end_line,
              end_column: row.end_column
            },
      provenance: row.provenance,
      confidence: row.confidence,
      metadata: parseMetadataJson(row.metadata_json)
    };
  }

  private mapSnapshotRow(row: SnapshotRow): SnapshotState {
    return {
      id: String(row.id),
      repo_root: row.repo_identity,
      workspace_root: row.repo_identity,
      repo_identity: row.repo_identity,
      config_identity: row.config_identity,
      schema_version: row.schema_version,
      freshness: row.freshness as SnapshotState["freshness"],
      owner_state: "observer",
      created_at: row.created_at,
      updated_at: row.created_at,
      reason: undefined
    };
  }

  private mapPublicationRecord(row: SnapshotRow): SnapshotPublicationRecord {
    return {
      repo_root: row.repo_identity,
      snapshot_id: String(row.id),
      controller_generation: row.controller_generation,
      invalidation_generation: row.invalidation_generation,
      state: row.publication_state,
      updated_at: row.publication_updated_at
    };
  }

  private mapFileCatalogRow(entry: FileCatalogEntry): FileCatalogEntry {
    return {
      path: entry.path,
      file_identity: {
        path: entry.file_identity.path,
        language: entry.file_identity.language,
        content_hash: entry.file_identity.content_hash,
        size_bytes: entry.file_identity.size_bytes,
        mtime_ms: entry.file_identity.mtime_ms,
        indexed_at: entry.file_identity.indexed_at
      },
      indexed: entry.indexed,
      skipped_reason: entry.skipped_reason
    };
  }

  private mapDocsSearchRow(input: {
    row: DocsSearchRow;
    query: string;
    includeSnippets: boolean;
  }): DocsSearchHit {
    const terms = tokenizeDocsQuery(input.query);
    const heading = bestHeadingMatch(input.row.headings_text, terms, input.query);
    const normalizedQuery = input.query.toLowerCase();
    const authority = classifyMarkdownDocCurrency({
      path: input.row.path,
      title: input.row.title,
      content: input.row.selected_text,
      frontmatter: extractMarkdownFrontmatterSignals(input.row.selected_text),
      modified_at: input.row.mtime_ms === null ? undefined : new Date(input.row.mtime_ms).toISOString()
    });
    const score = Math.max(0,
      Math.max(0, Number(input.row.rank_score)) +
      docsPathCategoryBoost(input.row.path) +
      authority.priority +
      authority.currency_priority +
      docsFieldBoost({
        path: input.row.path,
        title: input.row.title,
        headingsText: input.row.headings_text,
        selectedText: input.row.selected_text,
        query: normalizedQuery,
        terms
      })
    );
    return {
      path: input.row.path,
      title: input.row.title,
      heading_id: heading?.id,
      heading: heading?.text,
      snippet: input.includeSnippets
        ? snippetForDocsQuery(input.row.selected_text, heading?.text ?? firstDocsSnippetNeedle(input.query, terms))
        : undefined,
      score,
      evidence_kinds: ["docs", "fts"],
      direct_read_caveat: "Docs search is routing evidence; use docs_read_section for precise claims.",
      doc_status: authority.doc_status,
      authority: authority.authority,
      authority_caveat: authority.authority_caveat,
      currency_state: authority.currency_state,
      currency_caveats: authority.currency_caveats,
      canonical_owner: authority.canonical_owner,
      superseded_by: authority.superseded_by,
      last_reviewed: authority.last_reviewed,
      modified_at: authority.modified_at,
      git_first_seen: authority.git_first_seen,
      git_last_touched: authority.git_last_touched
    };
  }

  private parseNumericId(value: string): number | null {
    if (!/^-?\d+$/.test(value)) {
      return null;
    }
    const id = Number.parseInt(value, 10);
    return Number.isNaN(id) ? null : id;
  }
}

const DEFAULT_SQLITE_BUSY_TIMEOUT_MS = 15_000;

type DocsCursor = {
  snapshot_id: string;
  query: string;
  scope_path?: string;
  offset: number;
};

function buildDocsFtsQuery(query: string): string {
  return tokenizeDocsQuery(query)
    .map((term) => `"${term.replaceAll('"', '""')}"`)
    .join(" OR ");
}

function buildNodeFtsQuery(query: string): string {
  return tokenizeNodeQuery(query)
    .map((term) => `${term}*`)
    .join(" AND ");
}

function tokenizeNodeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9_]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length > 0)
    .slice(0, 12);
}

function tokenizeDocsQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9_/-]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length > 1)
    .slice(0, 12);
}

function bestHeadingMatch(headingsText: string, terms: readonly string[], query: string): DocsHeading | undefined {
  return headingsText
    .split(/\r?\n/u)
    .map((text, index) => ({
      id: slugifyDocsHeading(text),
      text,
      depth: 1,
      line: index + 1,
      score: scoreDocsText(text.toLowerCase(), query.toLowerCase(), terms)
    }))
    .filter((heading) => heading.text.trim().length > 0 && heading.score > 0)
    .sort((left, right) => right.score - left.score || left.line - right.line)[0];
}

function scoreDocsText(text: string, query: string, terms: readonly string[]): number {
  const phraseScore = text.includes(query) ? terms.length + 2 : 0;
  const termScore = terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
  return phraseScore + termScore;
}

function docsPathCategoryBoost(filePath: string): number {
  const lower = filePath.toLowerCase();
  let score = 0;
  if (lower === "readme.md") score += 1.5;
  if (lower.includes("/reference/") || lower.includes("/design/") || lower.includes("/spec")) score += 1.25;
  if (lower.includes("template") || lower.includes("/examples/")) score -= 2;
  if (lower.includes("/ai-agent/") || lower.includes("/agents/")) score -= 0.75;
  return score;
}

function docsFieldBoost(input: {
  path: string;
  title: string;
  headingsText: string;
  selectedText: string;
  query: string;
  terms: readonly string[];
}): number {
  const pathText = input.path.toLowerCase();
  const titleText = input.title.toLowerCase();
  const headingsText = input.headingsText.toLowerCase();
  const selectedText = input.selectedText.toLowerCase();
  return (
    scoreDocsText(titleText, input.query, input.terms) * 8 +
    scoreDocsText(pathText, input.query, input.terms) * 6 +
    scoreDocsText(headingsText, input.query, input.terms) * 5 +
    scoreDocsText(selectedText, input.query, input.terms)
  );
}

function snippetForDocsQuery(content: string, query: string): string {
  const lower = content.toLowerCase();
  const index = lower.indexOf(query.toLowerCase());
  if (index === -1) {
    return content.slice(0, 220).replace(/\s+/gu, " ").trim();
  }
  const start = Math.max(0, index - 70);
  const end = Math.min(content.length, index + query.length + 130);
  return content.slice(start, end).replace(/\s+/gu, " ").trim();
}

function firstDocsSnippetNeedle(query: string, terms: readonly string[]): string {
  return terms[0] ?? query;
}

function encodeDocsCursor(cursor: DocsCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeDocsCursor(value: string | undefined): DocsCursor | undefined {
  if (value === undefined) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<DocsCursor>;
    if (
      typeof parsed.snapshot_id === "string" &&
      typeof parsed.query === "string" &&
      (parsed.scope_path === undefined || typeof parsed.scope_path === "string") &&
      typeof parsed.offset === "number" &&
      Number.isInteger(parsed.offset) &&
      parsed.offset >= 0
    ) {
      return {
        snapshot_id: parsed.snapshot_id,
        query: parsed.query,
        scope_path: parsed.scope_path,
        offset: parsed.offset
      };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function normalizeDocsScopePath(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/\/+$/u, "");
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

function sqlPlaceholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

function slugifyDocsHeading(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gu, "")
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "");
  return slug.length === 0 ? "section" : slug;
}

export function openGraphStore(databasePath: string, options: GraphStoreOptions = {}): GraphStore {
  seedVersionedGraphStore(databasePath);
  return new SqliteGraphStoreAdapter(databasePath, options);
}

function migrate(db: Database.Database): void {
  const migration = db.transaction(() => {
    const existingSnapshotColumns = tableColumns(db, "snapshots");
    const needsPublicationMigration = existingSnapshotColumns.size > 0 && !existingSnapshotColumns.has("publication_state");
    db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY,
      repo_identity TEXT NOT NULL,
      config_identity TEXT NOT NULL,
      freshness TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      publication_state TEXT NOT NULL DEFAULT 'published',
      controller_generation INTEGER NOT NULL DEFAULT 0,
      invalidation_generation INTEGER NOT NULL DEFAULT 0,
      publication_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY,
      snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      language TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      mtime_ms INTEGER NOT NULL,
      indexed_at TEXT,
      node_count INTEGER NOT NULL DEFAULT 0,
      indexing_error TEXT,
      UNIQUE(snapshot_id, path)
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      lower_name TEXT NOT NULL,
      qualified_name TEXT,
      language TEXT NOT NULL,
      start_line INTEGER NOT NULL,
      start_column INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      end_column INTEGER NOT NULL,
      signature TEXT,
      docstring TEXT,
      visibility TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS edges (
      id INTEGER PRIMARY KEY,
      source_node_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
      target_node_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
      start_line INTEGER,
      start_column INTEGER,
      end_line INTEGER,
      end_column INTEGER,
      provenance TEXT NOT NULL,
      confidence REAL NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS unresolved_refs (
      id INTEGER PRIMARY KEY,
      source_node_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
      reference_name TEXT NOT NULL,
      reference_kind TEXT NOT NULL,
      file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      start_line INTEGER NOT NULL,
      start_column INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      end_column INTEGER NOT NULL,
      candidate_metadata_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS node_fts USING fts5(
      node_id UNINDEXED,
      name,
      qualified_name,
      signature,
      docstring
    );

    CREATE TABLE IF NOT EXISTS docs_documents (
      id INTEGER PRIMARY KEY,
      snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      title TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      byte_count INTEGER NOT NULL,
      indexed_at TEXT NOT NULL,
      selected_text_truncated INTEGER NOT NULL DEFAULT 0,
      UNIQUE(snapshot_id, path)
    );

    CREATE TABLE IF NOT EXISTS snapshot_index_coverage (
      id INTEGER PRIMARY KEY,
      snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
      evidence_class TEXT NOT NULL,
      state TEXT NOT NULL,
      indexed_files INTEGER,
      eligible_files_seen INTEGER,
      scan_truncated INTEGER,
      indexed_roots_json TEXT,
      missing_priority_roots_json TEXT,
      reason TEXT,
      UNIQUE(snapshot_id, evidence_class)
    );

    CREATE TABLE IF NOT EXISTS docs_headings (
      id INTEGER PRIMARY KEY,
      document_id INTEGER NOT NULL REFERENCES docs_documents(id) ON DELETE CASCADE,
      heading_id TEXT NOT NULL,
      heading_text TEXT NOT NULL,
      depth INTEGER NOT NULL,
      line INTEGER NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
      path,
      title,
      headings_text,
      selected_text
    );

    CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
    CREATE INDEX IF NOT EXISTS idx_snapshots_repo_id ON snapshots(repo_identity, id DESC);
    CREATE INDEX IF NOT EXISTS idx_snapshots_repo_freshness_id ON snapshots(repo_identity, freshness, id DESC);
    CREATE INDEX IF NOT EXISTS idx_nodes_lower_name ON nodes(lower_name);
    CREATE INDEX IF NOT EXISTS idx_nodes_qualified_name ON nodes(qualified_name);
    CREATE INDEX IF NOT EXISTS idx_nodes_file_range ON nodes(file_id, start_line, start_column);
    CREATE INDEX IF NOT EXISTS idx_nodes_file_id ON nodes(file_id);
    CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_node_id);
    CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_node_id);
    CREATE INDEX IF NOT EXISTS idx_edges_file_id ON edges(file_id);
    CREATE INDEX IF NOT EXISTS idx_unresolved_refs_file_id ON unresolved_refs(file_id);
    CREATE INDEX IF NOT EXISTS idx_unresolved_refs_source_node_id ON unresolved_refs(source_node_id);
    CREATE INDEX IF NOT EXISTS idx_files_snapshot_path ON files(snapshot_id, path);
    CREATE INDEX IF NOT EXISTS idx_docs_documents_snapshot_path ON docs_documents(snapshot_id, path);
    CREATE INDEX IF NOT EXISTS idx_docs_headings_document ON docs_headings(document_id, line);
    CREATE INDEX IF NOT EXISTS idx_snapshot_index_coverage_snapshot ON snapshot_index_coverage(snapshot_id);

    INSERT OR IGNORE INTO schema_migrations(version) VALUES (${SCHEMA_VERSION});
  `);
    const snapshotColumns = tableColumns(db, "snapshots");
    if (!snapshotColumns.has("publication_state")) {
      db.exec("ALTER TABLE snapshots ADD COLUMN publication_state TEXT NOT NULL DEFAULT 'published'");
    }
    if (!snapshotColumns.has("controller_generation")) {
      db.exec("ALTER TABLE snapshots ADD COLUMN controller_generation INTEGER NOT NULL DEFAULT 0");
    }
    if (!snapshotColumns.has("invalidation_generation")) {
      db.exec("ALTER TABLE snapshots ADD COLUMN invalidation_generation INTEGER NOT NULL DEFAULT 0");
    }
    if (!snapshotColumns.has("publication_updated_at")) {
      db.exec("ALTER TABLE snapshots ADD COLUMN publication_updated_at TEXT NOT NULL DEFAULT ''");
    }
    if (needsPublicationMigration) {
      db.exec(`
        UPDATE snapshots
        SET publication_state = CASE WHEN freshness = 'refreshing' THEN 'failed' ELSE 'published' END,
            publication_updated_at = created_at
      `);
    }
    db.prepare("INSERT OR IGNORE INTO schema_migrations(version) VALUES (?)").run(SCHEMA_VERSION);
  });
  migration.immediate();
}

function assertCompatibleSchemaVersion(db: Database.Database): void {
  const migrationsTable = db.prepare(`
    SELECT 1 AS present
    FROM sqlite_master
    WHERE type = 'table' AND name = 'schema_migrations'
  `).get() as { present: number } | undefined;
  if (!migrationsTable) {
    return;
  }
  const marker = db.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as {
    version: number | null;
  };
  if (marker.version !== null && marker.version > SCHEMA_VERSION) {
    throw new Error(
      `Graph store schema version ${marker.version} is newer than supported version ${SCHEMA_VERSION}.`
    );
  }
}

function tableColumns(db: Database.Database, table: string): Set<string> {
  const exists = db.prepare(`
    SELECT 1 AS present
    FROM sqlite_master
    WHERE type = 'table' AND name = ?
  `).get(table) as { present: number } | undefined;
  if (!exists) {
    return new Set();
  }
  return new Set((db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name));
}

function validateSchema(db: Database.Database): boolean {
  const expected = [
    "files",
    "nodes",
    "edges",
    "unresolved_refs",
    "snapshots",
    "node_fts",
    "docs_documents",
    "docs_headings",
    "docs_fts",
    "snapshot_index_coverage"
  ];
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'virtual table')")
    .all() as Array<{ name: string }>;
  const names = new Set(rows.map((row) => row.name));
  return expected.every((name) => names.has(name));
}

function parseMetadataJson(text: string): Record<string, unknown> {
  try {
    const value = JSON.parse(text) as Record<string, unknown>;
    if (typeof value === "object" && value !== null) {
      return value;
    }
  } catch {
    return {};
  }
  return {};
}

function parseStringArrayJson(text: string | null): string[] | undefined {
  if (text === null) {
    return undefined;
  }
  try {
    const value = JSON.parse(text) as unknown;
    return Array.isArray(value) && value.every((item) => typeof item === "string")
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
