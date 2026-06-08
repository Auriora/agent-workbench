import Database from "better-sqlite3";
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
  Freshness
} from "../../contracts/index.js";
import type {
  DocsIndexDocumentWrite,
  DocsIndexPort,
  DocsIndexSearchRequest,
  DocsIndexSearchResult,
  DocsIndexState,
  FileCatalogPort,
  GraphQueryPort,
  GraphWritePort,
  SnapshotPort
} from "../../ports/index.js";

export const SCHEMA_VERSION = 1;

type SnapshotRow = {
  id: number;
  repo_identity: string;
  config_identity: string;
  freshness: string;
  schema_version: number;
  created_at: string;
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
  rank_score: number;
};

export type GraphStoreOptions = {
  busyTimeoutMs?: number;
  enforceForeignKeys?: boolean;
};

export interface GraphStore extends GraphWritePort, GraphQueryPort, SnapshotPort, FileCatalogPort, DocsIndexPort {
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
    if (options.enforceForeignKeys !== false) {
      this.db.pragma("foreign_keys = ON");
    }
    migrate(this.db);
  }

  public close(): void {
    this.db.close();
  }

  public validateSchema(): boolean {
    return validateSchema(this.db);
  }

  public async getNode(input: { snapshot_id: string; node_id: string }): Promise<GraphNodeReadModel | null> {
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "getNode");
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
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "findNodesByName");
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
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "findNodesByQualifiedName");
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
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "searchNodes");
    if (snapshotId == null) {
      return [];
    }

    const maxRows = input.max_rows ?? 50;
    const query = input.query.trim().toLowerCase();
    if (query.length === 0) {
      return [];
    }

    const rows = this.db
      .prepare(
        `
        SELECT DISTINCT nodes.*, files.path as path
        FROM nodes
        INNER JOIN files ON files.id = nodes.file_id
        WHERE files.snapshot_id = @snapshotId
          AND (lower(nodes.name) LIKE @queryLike
            OR lower(coalesce(nodes.qualified_name, '')) LIKE @queryLike
            OR lower(coalesce(nodes.signature, '')) LIKE @queryLike
            OR lower(coalesce(nodes.docstring, '')) LIKE @queryLike)
        ORDER BY nodes.name ASC
        LIMIT @maxRows
      `
      )
      .all({
        snapshotId,
        queryLike: `%${query}%`,
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
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "getNodesInRange");
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
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "getOutgoingEdges");
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
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "getIncomingEdges");
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
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "getReferences");
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
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "getUnresolvedReferences");
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
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "traverse");
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
    const snapshotId = this.resolveSnapshotId(input.batch.snapshot_id, "replaceSnapshotExtraction");
    if (snapshotId == null) {
      throw new Error(`Unknown snapshot id: ${input.batch.snapshot_id}`);
    }

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
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "upsertFileIdentity");
    if (snapshotId == null) {
      return;
    }

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
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "insertEdges");
    if (snapshotId == null || input.edges.length === 0) {
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
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "clearFile");
    if (snapshotId == null) {
      return;
    }

    const fileRow = this.getFileRow(snapshotId, input.file_path);
    if (!fileRow) {
      return;
    }

    this.clearFileRecords({ snapshotId, filePath: input.file_path, fileId: fileRow.id });
  }

  public async clearSnapshot(input: { snapshot_id: string }): Promise<void> {
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "clearSnapshot");
    if (snapshotId == null) {
      return;
    }

    this.db.prepare("DELETE FROM snapshots WHERE id = @id").run({ id: snapshotId });
  }

  public async clearUnresolvedReferences(input: {
    snapshot_id: string;
    source_node_id: string;
  }): Promise<void> {
    this.db.prepare("DELETE FROM unresolved_refs WHERE source_node_id = @sourceNodeId").run({
      sourceNodeId: input.source_node_id
    });
  }

  public async getSnapshot(input: { repo_root: string; snapshot_id?: string }): Promise<SnapshotState | null> {
    if (input.snapshot_id) {
      const exactSnapshot = this.resolveSnapshotId(input.snapshot_id, "getSnapshot", { fallbackByRepo: false });
      const row = exactSnapshot
        ? (this.getSnapshotRowById(exactSnapshot) as SnapshotRow | undefined)
        : null;
      if (row) {
        return this.mapSnapshotRow(row);
      }

      const latestByRepo = this.getSnapshotByRepo(input.snapshot_id);
      return latestByRepo ? this.mapSnapshotRow(latestByRepo) : null;
    }

    const latest = this.getLatestSnapshotByRepo(input.repo_root);
    return latest ? this.mapSnapshotRow(latest) : null;
  }

  public async listSnapshots(input: { repo_root: string }): Promise<readonly SnapshotState[]> {
    const rows = this.db
      .prepare(
        `
        SELECT id, repo_identity, config_identity, freshness, schema_version, created_at
        FROM snapshots
        WHERE repo_identity = @repoRoot
        ORDER BY id ASC
      `
      )
      .all({ repoRoot: input.repo_root }) as SnapshotRow[];

    return rows.map((row) => this.mapSnapshotRow(row));
  }

  public async upsertSnapshot(input: { snapshot: SnapshotState }): Promise<void> {
    const requestedId = this.parseNumericId(input.snapshot.id);

    const existingById =
      requestedId === null
        ? null
        : (this.db
            .prepare("SELECT id FROM snapshots WHERE id = @id")
            .get({ id: requestedId }) as { id: number } | undefined);
    const existingByRepo = this.getLatestSnapshotByRepo(input.snapshot.repo_root);

    if (existingById) {
      this.db
        .prepare(`
          UPDATE snapshots
          SET repo_identity = @repoIdentity,
              config_identity = @configIdentity,
              freshness = @freshness,
              schema_version = @schemaVersion
          WHERE id = @id
        `)
        .run({
          id: existingById.id,
          repoIdentity: input.snapshot.repo_root,
          configIdentity: input.snapshot.config_identity,
          freshness: input.snapshot.freshness,
          schemaVersion: input.snapshot.schema_version
        });
      return;
    }

    if (existingByRepo && (requestedId === null || existingByRepo.id === requestedId)) {
      this.db
        .prepare(`
          UPDATE snapshots
          SET repo_identity = @repoIdentity,
              config_identity = @configIdentity,
              freshness = @freshness,
              schema_version = @schemaVersion
          WHERE id = @id
        `)
        .run({
          id: existingByRepo.id,
          repoIdentity: input.snapshot.repo_root,
          configIdentity: input.snapshot.config_identity,
          freshness: input.snapshot.freshness,
          schemaVersion: input.snapshot.schema_version
        });
      return;
    }

    const stmt =
      requestedId === null
        ? this.db.prepare(`
            INSERT INTO snapshots (repo_identity, config_identity, freshness, schema_version, created_at)
            VALUES (@repoIdentity, @configIdentity, @freshness, @schemaVersion, @createdAt)
          `)
        : this.db.prepare(`
            INSERT INTO snapshots (id, repo_identity, config_identity, freshness, schema_version, created_at)
            VALUES (@id, @repoIdentity, @configIdentity, @freshness, @schemaVersion, @createdAt)
          `);

    const params = {
      repoIdentity: input.snapshot.repo_root,
      configIdentity: input.snapshot.config_identity,
      freshness: input.snapshot.freshness,
      schemaVersion: input.snapshot.schema_version,
      createdAt: input.snapshot.created_at
    } as Record<string, string | number>;
    if (requestedId !== null) {
      params.id = requestedId;
    }

    stmt.run(params);
  }

  public async markSnapshotFreshness(input: {
    snapshot_id: string;
    freshness: SnapshotState["freshness"];
    owner_state?: SnapshotState["owner_state"];
    reason?: string;
  }): Promise<void> {
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "markSnapshotFreshness");
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
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "listFiles");
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

  public async getFile(input: { snapshot_id: string; path: string }): Promise<FileCatalogEntry | null> {
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "getFile");
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
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "upsertEntry");
    if (snapshotId == null) {
      return;
    }

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
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "removeEntry");
    if (snapshotId == null) {
      return;
    }

    this.db.prepare("DELETE FROM files WHERE snapshot_id = @snapshotId AND path = @path").run({
      snapshotId,
      path: input.path
    });
  }

  public async replaceSnapshotDocs(input: {
    snapshot_id: string;
    repo_root: string;
    documents: readonly DocsIndexDocumentWrite[];
  }): Promise<void> {
    const snapshotId = this.resolveSnapshotId(input.snapshot_id, "replaceSnapshotDocs");
    if (snapshotId == null) {
      throw new Error(`Unknown snapshot id: ${input.snapshot_id}`);
    }

    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM docs_fts WHERE rowid IN (SELECT id FROM docs_documents WHERE snapshot_id = @snapshotId)").run({
        snapshotId
      });
      this.db.prepare("DELETE FROM docs_documents WHERE snapshot_id = @snapshotId").run({ snapshotId });

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
        reason: "No graph snapshot is available, so docs FTS evidence is cold.",
        document_count: 0
      };
    }

    const snapshotId = this.resolveSnapshotId(snapshot.id, "getDocsIndexState", { fallbackByRepo: false });
    if (snapshotId == null) {
      return {
        repo_root: snapshot.repo_root,
        snapshot_id: snapshot.id,
        freshness: snapshot.freshness,
        status: "invalid",
        reason: "Snapshot id could not be resolved for docs FTS evidence.",
        document_count: 0
      };
    }

    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM docs_documents WHERE snapshot_id = @snapshotId")
      .get({ snapshotId }) as { count: number } | undefined;
    const documentCount = row?.count ?? 0;
    if (snapshot.freshness !== "fresh" && input.snapshot_id === undefined) {
      const usable = this.getLatestUsableDocsSnapshotByRepo(input.repo_root);
      if (usable !== undefined) {
        return {
          repo_root: usable.repo_identity,
          snapshot_id: String(usable.id),
          freshness: "fresh",
          status: "usable",
          document_count: usable.document_count
        };
      }
    }

    if (snapshot.freshness !== "fresh") {
      return {
        repo_root: snapshot.repo_root,
        snapshot_id: snapshot.id,
        freshness: snapshot.freshness,
        status: "stale",
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
        reason: "No Markdown documents were indexed into docs FTS for this snapshot.",
        document_count: 0
      };
    }
    return {
      repo_root: snapshot.repo_root,
      snapshot_id: snapshot.id,
      freshness: "fresh",
      status: "usable",
      document_count: documentCount
    };
  }

  public async search(input: DocsIndexSearchRequest): Promise<DocsIndexSearchResult> {
    const state = await this.getState({ repo_root: input.repo_root });
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
        result_count: 0
      };
    }

    const snapshotId = this.resolveSnapshotId(state.snapshot_id, "searchDocsIndex", { fallbackByRepo: false });
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
        result_count: 0
      };
    }

    const cursor = decodeDocsCursor(input.cursor);
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
        result_count: 0
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
        result_count: 0
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
          bm25(docs_fts, -7.0, -9.0, -6.0, -1.0) AS rank_score
        FROM docs_fts
        INNER JOIN docs_documents ON docs_documents.id = docs_fts.rowid
        WHERE docs_documents.snapshot_id = @snapshotId
          AND docs_fts MATCH @ftsQuery
        ORDER BY rank_score DESC, docs_documents.path ASC
        LIMIT @limit
        OFFSET @offset
      `
      )
      .all({
        snapshotId,
        ftsQuery,
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
            offset: offset + input.max_results
          })
        : undefined,
      result_count: hits.length
    };
  }

  private resolveSnapshotId(snapshotId: string, context: string, options: { fallbackByRepo?: boolean } = {}): number | null {
    const fallbackByRepo = options.fallbackByRepo !== false;
    const byId = this.parseNumericId(snapshotId);
    if (byId != null) {
      const row = this.getSnapshotRowById(byId);
      if (row) {
        return row.id;
      }
    }

    if (!fallbackByRepo) {
      return null;
    }

    const byRepo = this.getSnapshotByRepo(snapshotId);
    if (!byRepo) {
      return null;
    }

    if (process.env.NODE_ENV !== "production") {
      void context;
    }

    return byRepo.id;
  }

  private getSnapshotByRepo(repoRoot: string): SnapshotRow | undefined {
    return this.db
      .prepare(
        `
        SELECT id, repo_identity, config_identity, freshness, schema_version, created_at
        FROM snapshots
        WHERE repo_identity = @repoRoot
        ORDER BY id DESC
        LIMIT 1
      `
      )
      .get({ repoRoot }) as SnapshotRow | undefined;
  }

  private getLatestSnapshotByRepo(repoRoot: string): SnapshotRow | undefined {
    return this.getSnapshotByRepo(repoRoot);
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
               COUNT(docs_documents.path) AS document_count
        FROM snapshots
        JOIN docs_documents ON docs_documents.snapshot_id = snapshots.id
        WHERE snapshots.repo_identity = @repoRoot
          AND snapshots.freshness = 'fresh'
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
        SELECT id, repo_identity, config_identity, freshness, schema_version, created_at
        FROM snapshots
        WHERE id = @snapshotId
      `
      )
      .get({ snapshotId }) as SnapshotRow | undefined;
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
    const score =
      Math.max(0, Number(input.row.rank_score)) +
      docsPathCategoryBoost(input.row.path) +
      docsFieldBoost({
        path: input.row.path,
        title: input.row.title,
        headingsText: input.row.headings_text,
        selectedText: input.row.selected_text,
        query: normalizedQuery,
        terms
      });
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
      direct_read_caveat: "Docs search is routing evidence; use docs_read_section for precise claims."
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
  offset: number;
};

function buildDocsFtsQuery(query: string): string {
  return tokenizeDocsQuery(query)
    .map((term) => `"${term.replaceAll('"', '""')}"`)
    .join(" OR ");
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
      typeof parsed.offset === "number" &&
      Number.isInteger(parsed.offset) &&
      parsed.offset >= 0
    ) {
      return {
        snapshot_id: parsed.snapshot_id,
        query: parsed.query,
        offset: parsed.offset
      };
    }
  } catch {
    return undefined;
  }
  return undefined;
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
  return new SqliteGraphStoreAdapter(databasePath, options);
}

function migrate(db: Database.Database): void {
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
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    CREATE INDEX IF NOT EXISTS idx_nodes_lower_name ON nodes(lower_name);
    CREATE INDEX IF NOT EXISTS idx_nodes_qualified_name ON nodes(qualified_name);
    CREATE INDEX IF NOT EXISTS idx_nodes_file_range ON nodes(file_id, start_line, start_column);
    CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_node_id);
    CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_node_id);
    CREATE INDEX IF NOT EXISTS idx_files_snapshot_path ON files(snapshot_id, path);
    CREATE INDEX IF NOT EXISTS idx_docs_documents_snapshot_path ON docs_documents(snapshot_id, path);
    CREATE INDEX IF NOT EXISTS idx_docs_headings_document ON docs_headings(document_id, line);

    INSERT OR IGNORE INTO schema_migrations(version) VALUES (${SCHEMA_VERSION});
  `);
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
    "docs_fts"
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
