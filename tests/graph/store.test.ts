/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExtractionBatch } from "../../src/domain/models/index.js";
import type { SnapshotState } from "../../src/domain/models/runtime.js";
import type {
  SnapshotPublicationPort,
  SnapshotPublicationSelection,
} from "../../src/ports/index.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/graph-store.js";

describe("graph store", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-db-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("creates and validates the MVP schema", () => {
    const store = openGraphStore(path.join(dir, "index.sqlite"));
    try {
      expect(store.validateSchema()).toBe(true);
      const migration = store.db
        .prepare("SELECT version FROM schema_migrations WHERE version = ?")
        .get(SCHEMA_VERSION);
      expect(migration).toEqual({ version: SCHEMA_VERSION });
    } finally {
      store.close();
    }
  });

  it.fails("persists publication state independently from snapshot freshness", () => {
    const store = openGraphStore(path.join(dir, "publication-state.sqlite"));
    try {
      const snapshotColumns = store.db
        .prepare("PRAGMA table_info(snapshots)")
        .all() as Array<{ name: string }>;

      expect(snapshotColumns.map((column) => column.name)).toContain("publication_state");
    } finally {
      store.close();
    }
  });

  it.fails("classifies legacy snapshots transactionally during publication migration", async () => {
    const databasePath = path.join(dir, "publication-migration.sqlite");
    const legacy = new Database(databasePath);
    try {
      legacy.exec(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE snapshots (
          id INTEGER PRIMARY KEY,
          repo_identity TEXT NOT NULL,
          config_identity TEXT NOT NULL,
          freshness TEXT NOT NULL,
          schema_version INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO schema_migrations(version) VALUES (1);
      `);
      const insertLegacySnapshot = legacy.prepare(`
        INSERT INTO snapshots(
          id, repo_identity, config_identity, freshness, schema_version, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const [id, freshness] of [
        ["70", "fresh"],
        ["71", "stale"],
        ["72", "cold"],
        ["73", "refreshing"]
      ] as const) {
        insertLegacySnapshot.run(
          Number(id),
          "/tmp/repo",
          "default",
          freshness,
          1,
          `2026-05-08T00:00:0${Number(id) - 70}.000Z`
        );
      }
      expect(legacy.prepare("SELECT COUNT(*) AS count FROM snapshots").get()).toEqual({ count: 4 });
      expect(legacy.prepare("PRAGMA table_info(snapshots)").all()).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "publication_state" })])
      );
    } finally {
      legacy.close();
    }

    const migrated = openGraphStore(databasePath);
    try {
      expect(migrated.validateSchema()).toBe(true);
      const columns = migrated.db.prepare("PRAGMA table_info(snapshots)").all() as Array<{
        name: string;
      }>;
      const rows = columns.some((column) => column.name === "publication_state")
        ? migrated.db.prepare(`
            SELECT id, publication_state FROM snapshots ORDER BY id
          `).all()
        : (migrated.db.prepare(`
            SELECT id FROM snapshots ORDER BY id
          `).all() as Array<{ id: number }>).map((row) => ({
            ...row,
            publication_state: undefined
          }));

      // Opening and preserving all four legacy rows are setup guards. Only
      // this final classification assertion fails before the migration exists.
      expect(rows).toEqual([
        { id: 70, publication_state: "published" },
        { id: 71, publication_state: "published" },
        { id: 72, publication_state: "published" },
        { id: 73, publication_state: "failed" }
      ]);
    } finally {
      migrated.close();
    }
  });

  it.fails("keeps the prior snapshot visible while a replacement is unpublished", async () => {
    const store = openGraphStore(path.join(dir, "publication-visibility.sqlite"));
    const prior = {
      ...snapshotState("80"),
      freshness: "stale" as const
    };
    const replacement = {
      ...snapshotState("81"),
      freshness: "refreshing" as const
    };

    try {
      await store.upsertSnapshot({ snapshot: prior });
      await store.upsertSnapshot({ snapshot: replacement });

      // The pre-Spec-041 store selects the newest non-fresh row. The future
      // publication boundary must keep the prior published row visible.
      await expect(store.getSnapshot({ repo_root: prior.repo_root })).resolves.toMatchObject({
        id: prior.id
      });
    } finally {
      store.close();
    }
  });

  it.fails("returns discriminated explicit-id results for every publication state", async () => {
    const store = openGraphStore(path.join(dir, "explicit-unpublished.sqlite"));

    try {
      ensureSqliteColumn(store.db, "snapshots", "publication_state", "TEXT");
      for (const [id, publicationState] of [
        ["82", "building"],
        ["83", "superseded"],
        ["84", "failed"],
        ["85", "published"]
      ] as const) {
        await store.upsertSnapshot({
          snapshot: {
            ...snapshotState(id),
            freshness: publicationState === "published" ? "fresh" : "refreshing"
          }
        });
        store.db.prepare(`
          UPDATE snapshots SET publication_state = ? WHERE id = ?
        `).run(publicationState, Number(id));
      }
      expect(store.db.prepare(`
        SELECT id, publication_state FROM snapshots ORDER BY id
      `).all()).toEqual([
        { id: 82, publication_state: "building" },
        { id: 83, publication_state: "superseded" },
        { id: 84, publication_state: "failed" },
        { id: 85, publication_state: "published" }
      ]);

      const publicationPort = store as unknown as SnapshotPublicationPort;
      expect(typeof publicationPort.readExplicit).toBe("function");
      const results = await Promise.all(["82", "83", "84", "85"].map((snapshotId) =>
        publicationPort.readExplicit({ repo_root: "/tmp/repo", snapshot_id: snapshotId })
      ));
      expect(results[3]).toMatchObject({
        status: "selected",
        snapshot: { id: "85" },
        publication: { snapshot_id: "85", state: "published" }
      });

      // Setup and the published control pass. The legacy adapter then fails
      // this final discriminated-result assertion because it selects all
      // existing rows irrespective of publication state.
      const expectedBlockedResults = [
        {
          status: "blocked",
          snapshot_id: "82",
          publication_state: "building",
          reason: "snapshot_unpublished",
          message: "Snapshot is not published."
        },
        {
          status: "blocked",
          snapshot_id: "83",
          publication_state: "superseded",
          reason: "snapshot_unpublished",
          message: "Snapshot is not published."
        },
        {
          status: "blocked",
          snapshot_id: "84",
          publication_state: "failed",
          reason: "snapshot_unpublished",
          message: "Snapshot is not published."
        }
      ] satisfies SnapshotPublicationSelection[];
      expect(results.slice(0, 3)).toEqual(expectedBlockedResults);
    } finally {
      store.close();
    }
  });

  it.fails("reconciles a positively orphaned building snapshot as failed on reopen", async () => {
    const databasePath = path.join(dir, "orphaned-building.sqlite");
    const store = openGraphStore(databasePath);
    try {
      await store.upsertSnapshot({ snapshot: snapshotState("83") });
      ensureSqliteColumn(store.db, "snapshots", "publication_state", "TEXT");
      ensureSqliteColumn(store.db, "snapshots", "owner_id", "TEXT");
      ensureSqliteColumn(store.db, "snapshots", "owner_pid", "INTEGER");
      ensureSqliteColumn(store.db, "snapshots", "owner_generation", "INTEGER");
      ensureSqliteColumn(store.db, "snapshots", "heartbeat_at", "TEXT");
      store.db.prepare(`
        UPDATE snapshots
        SET publication_state = 'building',
            owner_id = 'dead-owner',
            owner_pid = 999999999,
            owner_generation = 4,
            heartbeat_at = '2026-07-18T00:00:00.000Z'
        WHERE id = ?
      `).run(83);
      expect(store.db.prepare(`
        SELECT publication_state, owner_id, owner_pid
        FROM snapshots
        WHERE id = ?
      `).get(83)).toEqual({
        publication_state: "building",
        owner_id: "dead-owner",
        owner_pid: 999999999
      });
    } finally {
      store.close();
    }

    const reopened = openGraphStore(databasePath);
    try {
      expect(reopened.validateSchema()).toBe(true);
      const orphan = reopened.db.prepare(`
        SELECT publication_state
        FROM snapshots
        WHERE id = ?
      `).get(83) as { publication_state: string };
      expect(orphan.publication_state).toBe("failed");
      await expect(reopened.getSnapshot({
        repo_root: "/tmp/repo",
        snapshot_id: "83"
      })).resolves.toBeNull();
    } finally {
      reopened.close();
    }
  });

  it.fails("refuses a database marked with a newer schema version", () => {
    const databasePath = path.join(dir, "future-schema.sqlite");
    const store = openGraphStore(databasePath);
    const futureVersion = SCHEMA_VERSION + 1;
    try {
      store.db.prepare(`
        INSERT INTO schema_migrations(version) VALUES (?)
      `).run(futureVersion);
      expect(store.db.prepare(`
        SELECT version FROM schema_migrations WHERE version = ?
      `).get(futureVersion)).toEqual({ version: futureVersion });
    } finally {
      store.close();
    }

    let refusal: unknown;
    try {
      const reopened = openGraphStore(databasePath);
      reopened.close();
    } catch (error) {
      refusal = error;
    }

    // The database and future marker setup pass. Only this exact compatibility
    // refusal is expected to fail until the schema-version gate exists.
    expect(refusal).toEqual(
      new Error(
        `Graph store schema version ${futureVersion} is newer than supported version ${SCHEMA_VERSION}.`
      )
    );
  });

  it("opens the graph database in WAL mode for concurrent readers and refresh writers", () => {
    const store = openGraphStore(path.join(dir, "wal.sqlite"));
    try {
      expect(store.db.pragma("journal_mode", { simple: true })).toBe("wal");
      expect(store.db.pragma("synchronous", { simple: true })).toBe(1);
    } finally {
      store.close();
    }
  });

  it("waits for startup schema work when another process holds the sqlite write lock", async () => {
    const databasePath = path.join(dir, "locked-startup.sqlite");
    const lock = await holdExclusiveSqliteLock(databasePath, 250);
    const startedAt = Date.now();

    try {
      const store = openGraphStore(databasePath, { busyTimeoutMs: 2_000 });
      try {
        expect(store.validateSchema()).toBe(true);
        expect(Date.now() - startedAt).toBeGreaterThanOrEqual(200);
      } finally {
        store.close();
      }
    } finally {
      await lock.done;
    }
  });

  it("supports snapshot upsert and lookup by repo", async () => {
    const store = openGraphStore(path.join(dir, "index.sqlite"));
    const snapshot: SnapshotState = {
      id: "42",
      repo_root: "/tmp/repo",
      workspace_root: "/tmp/repo",
      repo_identity: "/tmp/repo",
      config_identity: "default",
      schema_version: SCHEMA_VERSION,
      freshness: "fresh",
      owner_state: "owner",
      created_at: "2026-05-08T00:00:00.000Z",
      updated_at: "2026-05-08T00:00:00.000Z"
    };

    try {
      await store.upsertSnapshot({ snapshot });
      const listed = await store.listSnapshots({ repo_root: snapshot.repo_root });
      expect(listed).toHaveLength(1);
      expect(listed[0]).toMatchObject({
        id: snapshot.id,
        repo_root: snapshot.repo_root,
        config_identity: snapshot.config_identity,
        freshness: snapshot.freshness,
        schema_version: snapshot.schema_version
      });

      const fetched = await store.getSnapshot({ repo_root: snapshot.repo_root });
      expect(fetched).toMatchObject({
        id: snapshot.id,
        repo_root: snapshot.repo_root,
        config_identity: snapshot.config_identity,
        freshness: snapshot.freshness
      });
    } finally {
      store.close();
    }
  });

  it("preserves a new numeric snapshot id when refreshing an existing repo", async () => {
    const store = openGraphStore(path.join(dir, "index.sqlite"));
    const first = snapshotState("42");
    const refresh: SnapshotState = {
      ...snapshotState("1780653277649"),
      repo_root: first.repo_root,
      workspace_root: first.workspace_root,
      repo_identity: first.repo_identity,
      freshness: "refreshing"
    };

    try {
      await store.upsertSnapshot({ snapshot: first });
      await store.upsertSnapshot({ snapshot: refresh });

      await expect(
        store.replaceSnapshotExtraction({
          batch: extractionBatch({
            snapshot_id: refresh.id,
            source_path: "src/service.py",
            node_id: "node-refresh",
            name: "RefreshedSymbol"
          }),
          replace: true
        })
      ).resolves.toBeUndefined();

      await expect(
        store.findNodesByName({
          snapshot_id: refresh.id,
          query: "RefreshedSymbol",
          exact: true
        })
      ).resolves.toEqual([
        expect.objectContaining({
          id: "node-refresh"
        })
      ]);
    } finally {
      store.close();
    }
  });

  it("uses the latest fresh snapshot when newer failed warmup snapshots exist", async () => {
    const store = openGraphStore(path.join(dir, "index.sqlite"));
    const fresh = snapshotState("100");
    const cold = {
      ...snapshotState("101"),
      freshness: "cold" as const,
      reason: "database is locked"
    };
    const refreshing = {
      ...snapshotState("102"),
      freshness: "refreshing" as const
    };

    try {
      await store.upsertSnapshot({ snapshot: fresh });
      await store.upsertSnapshot({ snapshot: cold });
      await store.upsertSnapshot({ snapshot: refreshing });

      await expect(store.getSnapshot({ repo_root: fresh.repo_root })).resolves.toMatchObject({
        id: fresh.id,
        freshness: "fresh"
      });
      await expect(
        store.getSnapshot({
          repo_root: fresh.repo_root,
          snapshot_id: cold.id
        })
      ).resolves.toMatchObject({
        id: cold.id,
        freshness: "cold"
      });
    } finally {
      store.close();
    }
  });

  it("falls back to the latest non-fresh snapshot when no fresh snapshot exists", async () => {
    const store = openGraphStore(path.join(dir, "index.sqlite"));
    const cold = {
      ...snapshotState("201"),
      freshness: "cold" as const
    };
    const refreshing = {
      ...snapshotState("202"),
      freshness: "refreshing" as const
    };

    try {
      await store.upsertSnapshot({ snapshot: cold });
      await store.upsertSnapshot({ snapshot: refreshing });

      await expect(store.getSnapshot({ repo_root: cold.repo_root })).resolves.toMatchObject({
        id: refreshing.id,
        freshness: "refreshing"
      });
    } finally {
      store.close();
    }
  });

  it("supports file catalog upsert/list/get/remove", async () => {
    const store = openGraphStore(path.join(dir, "index.sqlite"));
    const snapshot: SnapshotState = {
      id: "43",
      repo_root: "/tmp/repo",
      workspace_root: "/tmp/repo",
      repo_identity: "/tmp/repo",
      config_identity: "default",
      schema_version: SCHEMA_VERSION,
      freshness: "fresh",
      owner_state: "owner",
      created_at: "2026-05-08T00:00:00.000Z",
      updated_at: "2026-05-08T00:00:00.000Z"
    };

    try {
      await store.upsertSnapshot({ snapshot });
      await store.upsertEntry({
        snapshot_id: snapshot.id,
        entry: {
          path: "/tmp/repo/__init__.py",
          file_identity: {
            path: "/tmp/repo/__init__.py",
            language: "python",
            content_hash: "c1",
            size_bytes: 10,
            mtime_ms: 1000,
            indexed_at: "2026-05-08T00:00:00.000Z"
          },
          indexed: true
        }
      });

      await store.upsertEntry({
        snapshot_id: snapshot.id,
        entry: {
          path: "/tmp/repo/a.py",
          file_identity: {
            path: "/tmp/repo/a.py",
            language: "python",
            content_hash: "c2",
            size_bytes: 20,
            mtime_ms: 1001
          },
          indexed: false,
          skipped_reason: "test"
        }
      });

      const listed = await store.listFiles({ snapshot_id: snapshot.id });
      expect(listed.map((entry) => entry.path)).toEqual(["/tmp/repo/__init__.py", "/tmp/repo/a.py"]);
      expect(listed[0]).toMatchObject({
        path: "/tmp/repo/__init__.py",
        file_identity: {
          indexed_at: "2026-05-08T00:00:00.000Z",
          content_hash: "c1"
        },
        indexed: true
      });

      const byPath = await store.getFile({ snapshot_id: snapshot.id, path: "/tmp/repo/a.py" });
      expect(byPath).toMatchObject({
        path: "/tmp/repo/a.py",
        indexed: false,
        file_identity: { content_hash: "c2" }
      });

      await store.removeEntry({ snapshot_id: snapshot.id, path: "/tmp/repo/a.py" });
      const removed = await store.getFile({ snapshot_id: snapshot.id, path: "/tmp/repo/a.py" });
      expect(removed).toBeNull();

      const remaining = await store.listFiles({ snapshot_id: snapshot.id, after_path: "/tmp/repo/__init__.py" });
      expect(remaining).toHaveLength(0);
    } finally {
      store.close();
    }
  });

  it("supports node write and name-based query", async () => {
    const store = openGraphStore(path.join(dir, "index.sqlite"));

    const snapshot: SnapshotState = {
      id: "44",
      repo_root: "/tmp/repo",
      workspace_root: "/tmp/repo",
      repo_identity: "/tmp/repo",
      config_identity: "default",
      schema_version: SCHEMA_VERSION,
      freshness: "fresh",
      owner_state: "owner",
      created_at: "2026-05-08T00:00:00.000Z",
      updated_at: "2026-05-08T00:00:00.000Z"
    };

    const batch: ExtractionBatch = {
      snapshot_id: snapshot.id,
      source_path: "/tmp/repo/main.py",
      extractor_id: "unit",
      language: "python",
      file_identity: {
        path: "/tmp/repo/main.py",
        language: "python",
        content_hash: "abc123",
        size_bytes: 120,
        mtime_ms: 1234
      },
      nodes: [
        {
          id: "node-1",
          kind: "function",
          name: "MyFunction",
          qualified_name: "MyFunction",
          file_path: "/tmp/repo/main.py",
          language: "python",
          source_range: { start_line: 1, start_column: 0, end_line: 3, end_column: 8 },
          metadata: { type: "symbol" }
        }
      ],
      edges: [],
      unresolved_references: [],
      diagnostics_hints: [],
      test_hints: [],
      extracted_at: "2026-05-08T00:00:00.000Z"
    };

    try {
      await store.upsertSnapshot({ snapshot });
      await store.replaceSnapshotExtraction({ batch, replace: true });

      const exact = await store.findNodesByName({ snapshot_id: snapshot.id, query: "MyFunction", exact: true });
      expect(exact).toHaveLength(1);
      expect(exact[0]).toMatchObject({
        id: "node-1",
        name: "MyFunction",
        file_path: "/tmp/repo/main.py"
      });

      const fuzzy = await store.findNodesByName({ snapshot_id: snapshot.id, query: "MyFun", exact: false });
      expect(fuzzy).toHaveLength(1);

      const byId = await store.getNode({ snapshot_id: snapshot.id, node_id: "node-1" });
      expect(byId).toMatchObject({
        name: "MyFunction",
        source_range: { start_line: 1, start_column: 0 }
      });

      const exactByQualified = await store.findNodesByQualifiedName({
        snapshot_id: snapshot.id,
        qualified_name: "MyFunction"
      });
      expect(exactByQualified).toHaveLength(1);
    } finally {
      store.close();
    }
  });

  it("uses B-tree exact lookup and FTS fuzzy lookup plans for symbols", () => {
    const store = openGraphStore(path.join(dir, "symbol-query-plan.sqlite"));

    try {
      const exactPlan = store.db
        .prepare(
          `
          EXPLAIN QUERY PLAN
          SELECT nodes.*, files.path as path
          FROM nodes
          INNER JOIN files ON files.id = nodes.file_id
          WHERE files.snapshot_id = @snapshotId AND nodes.lower_name = @query
          ORDER BY nodes.name ASC
          LIMIT @maxRows
        `
        )
        .all({ snapshotId: 1, query: "runner", maxRows: 20 }) as Array<{ detail: string }>;
      const fuzzyPlan = store.db
        .prepare(
          `
          EXPLAIN QUERY PLAN
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
        .all({ snapshotId: 1, ftsQuery: "run*", maxRows: 20 }) as Array<{ detail: string }>;

      expect(exactPlan.map((row) => row.detail).join("\n")).toContain("idx_nodes_lower_name");
      expect(fuzzyPlan.map((row) => row.detail).join("\n")).toContain("node_fts");
    } finally {
      store.close();
    }
  });

  it("replaces stale file graph evidence and refreshes search rows", async () => {
    const store = openGraphStore(path.join(dir, "replace.sqlite"));
    const snapshot = snapshotState("45");

    try {
      await store.upsertSnapshot({ snapshot });
      await store.replaceSnapshotExtraction({
        batch: extractionBatch({
          snapshot_id: snapshot.id,
          source_path: "src/service.py",
          node_id: "old-node",
          name: "OldName"
        }),
        replace: true
      });
      expect(await store.findNodesByName({ snapshot_id: snapshot.id, query: "OldName", exact: true })).toHaveLength(1);

      await store.replaceSnapshotExtraction({
        batch: extractionBatch({
          snapshot_id: snapshot.id,
          source_path: "src/service.py",
          node_id: "new-node",
          name: "NewName"
        }),
        replace: true
      });

      expect(await store.findNodesByName({ snapshot_id: snapshot.id, query: "OldName", exact: true })).toEqual([]);
      expect(await store.searchNodes({ snapshot_id: snapshot.id, query: "OldName" })).toEqual([]);
      expect(await store.findNodesByName({ snapshot_id: snapshot.id, query: "NewName", exact: true })).toEqual([
        expect.objectContaining({
          id: "new-node",
          name: "NewName"
        })
      ]);
    } finally {
      store.close();
    }
  });

  it("cleans deleted and renamed file evidence through graph ports", async () => {
    const store = openGraphStore(path.join(dir, "cleanup.sqlite"));
    const snapshot = snapshotState("46");

    try {
      await store.upsertSnapshot({ snapshot });
      await store.replaceSnapshotExtraction({
        batch: extractionBatch({
          snapshot_id: snapshot.id,
          source_path: "src/old.py",
          node_id: "old-path-node",
          name: "MovedSymbol"
        }),
        replace: true
      });

      await store.clearFile({ snapshot_id: snapshot.id, file_path: "src/old.py" });
      expect(await store.findNodesByName({ snapshot_id: snapshot.id, query: "MovedSymbol", exact: true })).toEqual([]);
      expect(countRows(store.db, "node_fts")).toBe(0);

      await store.replaceSnapshotExtraction({
        batch: extractionBatch({
          snapshot_id: snapshot.id,
          source_path: "src/new.py",
          node_id: "new-path-node",
          name: "MovedSymbol"
        }),
        replace: true
      });

      expect(await store.findNodesByName({ snapshot_id: snapshot.id, query: "MovedSymbol", exact: true })).toEqual([
        expect.objectContaining({
          id: "new-path-node",
          file_path: "src/new.py"
        })
      ]);
    } finally {
      store.close();
    }
  });

  it("atomically prunes graph, docs, FTS, and coverage evidence when file catalog entries are removed", async () => {
    const store = openGraphStore(path.join(dir, "remove-entry-cleanup.sqlite"));
    const snapshot = snapshotState("461");

    try {
      await store.upsertSnapshot({ snapshot });
      await store.replaceSnapshotExtraction({
        batch: extractionBatch({
          snapshot_id: snapshot.id,
          source_path: "docs/delete_me.md",
          node_id: "delete-me-node",
          name: "DeleteMe"
        }),
        replace: true
      });
      await store.replaceSnapshotDocs({
        snapshot_id: snapshot.id,
        repo_root: snapshot.repo_root,
        documents: [
          {
            path: "docs/delete_me.md",
            title: "Delete me",
            headings: [{ id: "delete-me", text: "Delete me", depth: 1, line: 1 }],
            selected_text: "Unique obsolete documentation token",
            content_hash: "docs-delete-hash",
            byte_count: 36,
            indexed_at: "2026-05-08T00:00:00.000Z",
            truncated: false
          }
        ],
        coverage: [
          {
            evidence_class: "docs",
            state: "complete",
            indexed_files: 1,
            eligible_files_seen: 1,
            scan_truncated: false,
            indexed_roots: ["docs"]
          },
          {
            evidence_class: "graph",
            state: "complete",
            indexed_files: 1,
            eligible_files_seen: 1,
            scan_truncated: false,
            indexed_roots: ["."]
          }
        ]
      });
      expect(countRows(store.db, "node_fts")).toBe(1);
      expect(countRows(store.db, "docs_documents")).toBe(1);
      expect(countRows(store.db, "docs_headings")).toBe(1);
      expect(countRows(store.db, "docs_fts")).toBe(1);

      await store.removeEntry({ snapshot_id: snapshot.id, path: "docs/delete_me.md" });

      expect(await store.getFile({ snapshot_id: snapshot.id, path: "docs/delete_me.md" })).toBeNull();
      expect(await store.findNodesByName({ snapshot_id: snapshot.id, query: "DeleteMe", exact: true })).toEqual([]);
      expect(countRows(store.db, "node_fts")).toBe(0);
      expect(countRows(store.db, "docs_documents")).toBe(0);
      expect(countRows(store.db, "docs_headings")).toBe(0);
      expect(countRows(store.db, "docs_fts")).toBe(0);
      const docsSearch = await store.search({
        repo_root: snapshot.repo_root,
        query: "obsolete",
        max_results: 10,
        include_snippets: false
      });
      expect(docsSearch.hits).toEqual([]);
      expect(docsSearch.indexed_docs_count).toBe(0);
      const coverageRows = store.db.prepare(`
        SELECT evidence_class, state, indexed_files
        FROM snapshot_index_coverage
        WHERE snapshot_id = ?
        ORDER BY evidence_class
      `).all(Number(snapshot.id));
      expect(coverageRows).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ state: "complete", indexed_files: 1 })
        ])
      );
      await store.removeEntry({ snapshot_id: snapshot.id, path: "docs/delete_me.md" });
      const repeatedCoverageRows = store.db.prepare(`
        SELECT evidence_class, state, indexed_files
        FROM snapshot_index_coverage
        WHERE snapshot_id = ?
        ORDER BY evidence_class
      `).all(Number(snapshot.id));
      expect(repeatedCoverageRows).toEqual(coverageRows);
    } finally {
      store.close();
    }
  });

  it("cleans FTS rows when snapshots are cleared", async () => {
    const store = openGraphStore(path.join(dir, "snapshot-cleanup.sqlite"));
    const snapshot = snapshotState("462");

    try {
      await store.upsertSnapshot({ snapshot });
      await store.replaceSnapshotExtraction({
        batch: extractionBatch({
          snapshot_id: snapshot.id,
          source_path: "src/service.py",
          node_id: "snapshot-node",
          name: "SnapshotSymbol"
        }),
        replace: true
      });
      await store.replaceSnapshotDocs({
        snapshot_id: snapshot.id,
        repo_root: snapshot.repo_root,
        documents: [
          {
            path: "docs/design.md",
            title: "Design",
            headings: [{ id: "design", text: "Design", depth: 1, line: 1 }],
            selected_text: "Design details",
            content_hash: "docs-hash",
            byte_count: 14,
            indexed_at: "2026-05-08T00:00:00.000Z",
            truncated: false
          }
        ]
      });
      expect(countRows(store.db, "node_fts")).toBe(1);
      expect(countRows(store.db, "docs_fts")).toBe(1);

      await store.clearSnapshot({ snapshot_id: snapshot.id });

      expect(await store.getSnapshot({ repo_root: snapshot.repo_root, snapshot_id: snapshot.id })).toBeNull();
      expect(countRows(store.db, "node_fts")).toBe(0);
      expect(countRows(store.db, "docs_fts")).toBe(0);
    } finally {
      store.close();
    }
  });

  it("prunes old repository snapshots and optimizes storage", async () => {
    const store = openGraphStore(path.join(dir, "snapshot-prune.sqlite"));

    try {
      for (let index = 1; index <= 6; index += 1) {
        const snapshot = {
          ...snapshotState(String(4600 + index)),
          freshness: index === 5 ? "refreshing" as const : "fresh" as const,
          created_at: `2026-05-08T00:00:0${index}.000Z`,
          updated_at: `2026-05-08T00:00:0${index}.000Z`
        };
        await store.upsertSnapshot({ snapshot });
        await store.replaceSnapshotExtraction({
          batch: extractionBatch({
            snapshot_id: snapshot.id,
            source_path: `src/file_${index}.py`,
            node_id: `node-${index}`,
            name: `Symbol${index}`
          }),
          replace: true
        });
        await store.replaceSnapshotDocs({
          snapshot_id: snapshot.id,
          repo_root: snapshot.repo_root,
          documents: [
            {
              path: `docs/doc_${index}.md`,
              title: `Doc ${index}`,
              headings: [{ id: `doc-${index}`, text: `Doc ${index}`, depth: 1, line: 1 }],
              selected_text: `Doc ${index}`,
              content_hash: `doc-hash-${index}`,
              byte_count: 10,
              indexed_at: "2026-05-08T00:00:00.000Z",
              truncated: false
            }
          ]
        });
      }

      const result = await store.pruneRepositorySnapshots({
        repo_root: "/tmp/repo",
        retain_latest_snapshots: 2,
        retain_latest_fresh_snapshots: 2,
        vacuum: true
      });

      expect(result).toEqual({
        repo_root: "/tmp/repo",
        deleted_snapshots: 3,
        retained_snapshot_ids: ["4606", "4605", "4604"],
        optimized: true,
        vacuumed: true
      });
      expect((await store.listSnapshots({ repo_root: "/tmp/repo" })).map((snapshot) => snapshot.id)).toEqual([
        "4604",
        "4605",
        "4606"
      ]);
      expect(countRows(store.db, "node_fts")).toBe(3);
      expect(countRows(store.db, "docs_fts")).toBe(3);
    } finally {
      store.close();
    }
  });

  it("applies graph read budgets and keeps failed edge transactions atomic", async () => {
    const store = openGraphStore(path.join(dir, "budget.sqlite"));
    const snapshot = snapshotState("47");

    try {
      await store.upsertSnapshot({ snapshot });
      for (let index = 0; index < 5; index += 1) {
        await store.replaceSnapshotExtraction({
          batch: extractionBatch({
            snapshot_id: snapshot.id,
            source_path: `src/file_${index}.py`,
            node_id: `node-${index}`,
            name: `Shared${index}`
          }),
          replace: true
        });
      }

      expect(await store.searchNodes({ snapshot_id: snapshot.id, query: "Shared", max_rows: 2 })).toHaveLength(2);
      await expect(
        store.insertEdges({
          snapshot_id: snapshot.id,
          file_path: "src/missing.py",
          edges: [
            {
              id: "bad-edge",
              source_node_id: "node-0",
              target_node_id: "node-1",
              kind: "call",
              provenance: "unit",
              confidence: 1,
              metadata: {}
            }
          ]
        })
      ).rejects.toThrow("Unknown file for edge insertion");
      expect(await store.getReferences({ snapshot_id: snapshot.id, node_id: "node-0" })).toEqual([]);
    } finally {
      store.close();
    }
  });
});

function snapshotState(id: string): SnapshotState {
  return {
    id,
    repo_root: "/tmp/repo",
    workspace_root: "/tmp/repo",
    repo_identity: "/tmp/repo",
    config_identity: "default",
    schema_version: SCHEMA_VERSION,
    freshness: "fresh",
    owner_state: "owner",
    created_at: "2026-05-08T00:00:00.000Z",
    updated_at: "2026-05-08T00:00:00.000Z"
  };
}

function extractionBatch(input: {
  snapshot_id: string;
  source_path: string;
  node_id: string;
  name: string;
}): ExtractionBatch {
  return {
    snapshot_id: input.snapshot_id,
    source_path: input.source_path,
    extractor_id: "unit",
    language: "python",
    file_identity: {
      path: input.source_path,
      language: "python",
      content_hash: `hash:${input.node_id}`,
      size_bytes: 120,
      mtime_ms: 1234
    },
    nodes: [
      {
        id: input.node_id,
        kind: "function",
        name: input.name,
        qualified_name: input.name,
        file_path: input.source_path,
        language: "python",
        source_range: { start_line: 1, start_column: 0, end_line: 3, end_column: 8 },
        metadata: { type: "symbol" }
      }
    ],
    edges: [],
    unresolved_references: [],
    diagnostics_hints: [],
    test_hints: [],
    extracted_at: "2026-05-08T00:00:00.000Z"
  };
}

function countRows(db: import("better-sqlite3").Database, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count;
}

function ensureSqliteColumn(
  db: import("better-sqlite3").Database,
  table: string,
  column: string,
  declaration: string
): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((candidate) => candidate.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${declaration}`);
  }
}

async function holdExclusiveSqliteLock(
  databasePath: string,
  holdMs: number
): Promise<{ done: Promise<void> }> {
  const worker = new Worker(
    `
      const { parentPort, workerData } = require("node:worker_threads");
      const Database = require("better-sqlite3");
      const db = new Database(workerData.databasePath, { timeout: 5000 });
      db.exec("CREATE TABLE IF NOT EXISTS lock_probe(id INTEGER); BEGIN EXCLUSIVE; INSERT INTO lock_probe(id) VALUES (1);");
      parentPort.postMessage({ state: "locked" });
      setTimeout(() => {
        db.exec("COMMIT");
        db.close();
        parentPort.postMessage({ state: "released" });
      }, workerData.holdMs);
    `,
    {
      eval: true,
      workerData: {
        databasePath,
        holdMs
      }
    }
  );
  const done = new Promise<void>((resolve, reject) => {
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`SQLite lock worker exited with code ${code}`));
    });
  });

  await new Promise<void>((resolve, reject) => {
    worker.on("message", (message: { state?: string }) => {
      if (message.state === "locked") {
        resolve();
      }
    });
    worker.once("error", reject);
  });

  return { done };
}
