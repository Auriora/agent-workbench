import Database from "better-sqlite3";

export const SCHEMA_VERSION = 1;

export type GraphStore = {
  db: Database.Database;
  close(): void;
  validateSchema(): boolean;
};

export function openGraphStore(databasePath: string): GraphStore {
  const db = new Database(databasePath);
  db.pragma("foreign_keys = ON");
  migrate(db);

  return {
    db,
    close: () => db.close(),
    validateSchema: () => validateSchema(db)
  };
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

    CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
    CREATE INDEX IF NOT EXISTS idx_nodes_lower_name ON nodes(lower_name);
    CREATE INDEX IF NOT EXISTS idx_nodes_qualified_name ON nodes(qualified_name);
    CREATE INDEX IF NOT EXISTS idx_nodes_file_range ON nodes(file_id, start_line, start_column);
    CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_node_id);
    CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_node_id);

    INSERT OR IGNORE INTO schema_migrations(version) VALUES (${SCHEMA_VERSION});
  `);
}

function validateSchema(db: Database.Database): boolean {
  const expected = ["files", "nodes", "edges", "unresolved_refs", "snapshots", "node_fts"];
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'virtual table')")
    .all() as Array<{ name: string }>;
  const names = new Set(rows.map((row) => row.name));
  return expected.every((name) => names.has(name));
}
