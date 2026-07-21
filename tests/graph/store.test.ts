/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractionBatch } from "../../src/domain/models/index.js";
import type { SnapshotState } from "../../src/domain/models/runtime.js";
import type {
  RepositoryOwnershipLease,
  SnapshotPublicationPort,
  SnapshotPublicationSelection,
} from "../../src/ports/index.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/graph-store.js";
import {
  GRAPH_STORE_FILE_NAME,
  LEGACY_GRAPH_STORE_BACKUP_FILE_NAME,
  graphStorePath,
  retireLegacyGraphStore
} from "../../src/infrastructure/sqlite/graph-store-location.js";
import { LegacyV052GraphStoreFixture } from "../fixtures/legacy-v0.5.2-graph-store.js";

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

  it("persists publication state independently from snapshot freshness", () => {
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

  it("classifies legacy snapshots transactionally during publication migration", async () => {
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
            SELECT id, freshness, schema_version, publication_state FROM snapshots ORDER BY id
          `).all()
        : (migrated.db.prepare(`
            SELECT id FROM snapshots ORDER BY id
          `).all() as Array<{ id: number }>).map((row) => ({
            ...row,
            freshness: undefined,
            schema_version: undefined,
            publication_state: undefined
          }));

      // Opening and preserving all four legacy rows are setup guards. Only
      // this final classification assertion fails before the migration exists.
      expect(rows).toEqual([
        { id: 70, freshness: "fresh", schema_version: 1, publication_state: "published" },
        { id: 71, freshness: "stale", schema_version: 1, publication_state: "published" },
        { id: 72, freshness: "cold", schema_version: 1, publication_state: "published" },
        { id: 73, freshness: "refreshing", schema_version: 1, publication_state: "failed" }
      ]);
      expect(migrated.db.prepare("SELECT MAX(version) AS version FROM schema_migrations").get()).toEqual({
        version: SCHEMA_VERSION
      });
    } finally {
      migrated.close();
    }
  });

  it("isolates the migrated publication store from the v0.5.2 store identity", () => {
    const repoRoot = path.join(dir, "repo");
    const cacheDirectory = path.join(repoRoot, ".cache", "agent-workbench");
    const legacyPath = path.join(cacheDirectory, "graph.sqlite");
    fs.mkdirSync(cacheDirectory, { recursive: true });
    const legacySetup = new Database(legacyPath);
    legacySetup.exec(`
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
      INSERT INTO snapshots(id, repo_identity, config_identity, freshness, schema_version, created_at)
      VALUES (91, '${repoRoot.replaceAll("'", "''")}', 'default', 'fresh', 1, '2026-07-20T00:00:00.000Z');
    `);
    legacySetup.close();

    const versionedPath = graphStorePath(repoRoot);
    expect(path.basename(versionedPath)).toBe(GRAPH_STORE_FILE_NAME);
    expect(versionedPath).not.toBe(legacyPath);
    const migrated = openGraphStore(versionedPath);
    try {
      expect(migrated.db.prepare(`
        SELECT id, freshness, publication_state FROM snapshots WHERE id = 91
      `).get()).toEqual({ id: 91, freshness: "fresh", publication_state: "published" });
      expect(migrated.db.prepare("SELECT MAX(version) AS version FROM schema_migrations").get())
        .toEqual({ version: SCHEMA_VERSION });
    } finally {
      migrated.close();
    }

    expect(fs.statSync(legacyPath).isFile()).toBe(true);
    expect(fs.existsSync(path.join(cacheDirectory, LEGACY_GRAPH_STORE_BACKUP_FILE_NAME))).toBe(false);
    retireLegacyGraphStore(versionedPath);
    expect(fs.statSync(legacyPath).isFile()).toBe(true);
    expect(() => new LegacyV052GraphStoreFixture(repoRoot)).toThrow();

    const rollbackPath = path.join(cacheDirectory, LEGACY_GRAPH_STORE_BACKUP_FILE_NAME);
    const rollbackStore = new Database(rollbackPath);
    try {
      expect(rollbackStore.prepare("SELECT MAX(version) AS version FROM schema_migrations").get())
        .toEqual({ version: 1 });
      expect((rollbackStore.prepare("PRAGMA table_info(snapshots)").all() as Array<{ name: string }>)
        .map((column) => column.name)).not.toContain("publication_state");
      expect(rollbackStore.prepare("SELECT id, freshness FROM snapshots WHERE id = 91").get())
        .toEqual({ id: 91, freshness: "fresh" });
    } finally {
      rollbackStore.close();
    }

    const reopened = openGraphStore(versionedPath);
    try {
      expect(reopened.db.prepare(`
        SELECT id, freshness, publication_state FROM snapshots WHERE id = 91
      `).get()).toEqual({ id: 91, freshness: "fresh", publication_state: "published" });
    } finally {
      reopened.close();
    }

  });

  it("resumes atomic legacy blocker publication from the durable-backup barrier", () => {
    const repoRoot = path.join(dir, "retirement-barrier-repo");
    const cacheDirectory = path.join(repoRoot, ".cache", "agent-workbench");
    const legacyPath = path.join(cacheDirectory, "graph.sqlite");
    fs.mkdirSync(cacheDirectory, { recursive: true });
    const legacy = new Database(legacyPath);
    legacy.exec("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY); INSERT INTO schema_migrations VALUES (1);");
    legacy.close();
    const versionedPath = graphStorePath(repoRoot);
    openGraphStore(versionedPath).close();

    const backupPath = path.join(cacheDirectory, LEGACY_GRAPH_STORE_BACKUP_FILE_NAME);
    fs.copyFileSync(legacyPath, backupPath);
    retireLegacyGraphStore(versionedPath);
    expect(() => new LegacyV052GraphStoreFixture(repoRoot)).toThrow();
    const blocker = fs.readFileSync(legacyPath);
    const backup = fs.readFileSync(backupPath);

    retireLegacyGraphStore(versionedPath);
    expect(fs.readFileSync(legacyPath)).toEqual(blocker);
    expect(fs.readFileSync(backupPath)).toEqual(backup);
    expect(fs.readdirSync(cacheDirectory).filter((entry) => entry.includes(".block-") || entry.includes(".seed-")))
      .toEqual([]);
  });

  it("cleans the temporary blocker when durable blocker publication fails", () => {
    const repoRoot = path.join(dir, "retirement-blocker-failure-repo");
    const cacheDirectory = path.join(repoRoot, ".cache", "agent-workbench");
    const legacyPath = path.join(cacheDirectory, "graph.sqlite");
    fs.mkdirSync(cacheDirectory, { recursive: true });
    const legacy = new Database(legacyPath);
    legacy.exec("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY); INSERT INTO schema_migrations VALUES (1);");
    legacy.close();
    const versionedPath = graphStorePath(repoRoot);
    openGraphStore(versionedPath).close();
    const originalFsync = fs.fsyncSync;
    let fsyncCalls = 0;
    const fsync = vi.spyOn(fs, "fsyncSync").mockImplementation((descriptor) => {
      fsyncCalls += 1;
      if (fsyncCalls === 2) throw new Error("injected blocker fsync failure");
      return originalFsync(descriptor);
    });
    try {
      expect(() => retireLegacyGraphStore(versionedPath)).toThrow("injected blocker fsync failure");
    } finally {
      fsync.mockRestore();
    }
    expect(fs.readdirSync(cacheDirectory).filter((entry) => entry.includes(".block-"))).toEqual([]);
    const stillLegacy = new LegacyV052GraphStoreFixture(repoRoot);
    stillLegacy.close();
    expect(fs.existsSync(path.join(cacheDirectory, LEGACY_GRAPH_STORE_BACKUP_FILE_NAME))).toBe(true);
  });

  it("blocks retirement when a crash artifact conflicts with the canonical v1 store", () => {
    const repoRoot = path.join(dir, "retirement-conflict-repo");
    const cacheDirectory = path.join(repoRoot, ".cache", "agent-workbench");
    const legacyPath = path.join(cacheDirectory, "graph.sqlite");
    fs.mkdirSync(cacheDirectory, { recursive: true });
    const legacy = new Database(legacyPath);
    legacy.exec("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY); INSERT INTO schema_migrations VALUES (1);");
    legacy.close();
    const versionedPath = graphStorePath(repoRoot);
    openGraphStore(versionedPath).close();
    fs.writeFileSync(path.join(cacheDirectory, LEGACY_GRAPH_STORE_BACKUP_FILE_NAME), "conflict");

    expect(() => retireLegacyGraphStore(versionedPath)).toThrow("conflicting rollback artifact");
    const stillLegacy = new LegacyV052GraphStoreFixture(repoRoot);
    stillLegacy.close();
  });

  it("blocks retirement when rollback comparison encounters an early short read", () => {
    const repoRoot = path.join(dir, "retirement-short-read-repo");
    const cacheDirectory = path.join(repoRoot, ".cache", "agent-workbench");
    const legacyPath = path.join(cacheDirectory, "graph.sqlite");
    fs.mkdirSync(cacheDirectory, { recursive: true });
    const legacy = new Database(legacyPath);
    legacy.exec("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY); INSERT INTO schema_migrations VALUES (1);");
    legacy.close();
    const versionedPath = graphStorePath(repoRoot);
    openGraphStore(versionedPath).close();
    fs.copyFileSync(legacyPath, path.join(cacheDirectory, LEGACY_GRAPH_STORE_BACKUP_FILE_NAME));

    const read = vi.spyOn(fs, "readSync").mockImplementationOnce(() => 0);
    try {
      expect(() => retireLegacyGraphStore(versionedPath)).toThrow("conflicting rollback artifact");
    } finally {
      read.mockRestore();
    }
    const stillLegacy = new LegacyV052GraphStoreFixture(repoRoot);
    stillLegacy.close();
  });

  it("removes a failed versioned-store seed artifact", () => {
    const repoRoot = path.join(dir, "invalid-legacy-repo");
    const cacheDirectory = path.join(repoRoot, ".cache", "agent-workbench");
    fs.mkdirSync(cacheDirectory, { recursive: true });
    fs.writeFileSync(path.join(cacheDirectory, "graph.sqlite"), "not a sqlite database");

    expect(() => openGraphStore(graphStorePath(repoRoot))).toThrow();
    expect(fs.readdirSync(cacheDirectory).filter((entry) => entry.includes(".seed-"))).toEqual([]);
    expect(fs.existsSync(path.join(cacheDirectory, GRAPH_STORE_FILE_NAME))).toBe(false);
  });

  it("rolls back a failed publication migration, closes startup resources, and reopens cleanly", () => {
    const databasePath = path.join(dir, "publication-migration-rollback.sqlite");
    const legacy = new Database(databasePath);
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
      INSERT INTO snapshots(id, repo_identity, config_identity, freshness, schema_version, created_at)
      VALUES (74, '/tmp/repo', 'default', 'fresh', 1, '2026-05-08T00:00:00.000Z');
      CREATE TRIGGER reject_publication_classification
      BEFORE UPDATE OF publication_state ON snapshots
      BEGIN
        SELECT RAISE(ABORT, 'induced publication migration failure');
      END;
    `);
    legacy.close();

    expect(() => openGraphStore(databasePath)).toThrow("induced publication migration failure");
    expect(fs.existsSync(`${databasePath}-wal`)).toBe(false);

    const unchanged = new Database(databasePath);
    try {
      expect(unchanged.prepare("SELECT version FROM schema_migrations ORDER BY version").all()).toEqual([
        { version: 1 }
      ]);
      expect((unchanged.prepare("PRAGMA table_info(snapshots)").all() as Array<{ name: string }>).map((row) => row.name))
        .not.toContain("publication_state");
      expect(unchanged.prepare(`
        SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'files'
      `).get()).toBeUndefined();
      expect(unchanged.prepare(`
        SELECT id, freshness, schema_version FROM snapshots ORDER BY id
      `).all()).toEqual([{ id: 74, freshness: "fresh", schema_version: 1 }]);
      unchanged.exec("DROP TRIGGER reject_publication_classification");
    } finally {
      unchanged.close();
    }

    const reopened = openGraphStore(databasePath);
    try {
      expect(reopened.validateSchema()).toBe(true);
      expect(reopened.db.prepare("SELECT MAX(version) AS version FROM schema_migrations").get()).toEqual({
        version: SCHEMA_VERSION
      });
      expect(reopened.db.prepare(`
        SELECT id, freshness, schema_version, publication_state FROM snapshots
      `).get()).toEqual({
        id: 74,
        freshness: "fresh",
        schema_version: 1,
        publication_state: "published"
      });
    } finally {
      reopened.close();
    }
  });

  it("keeps the prior snapshot visible while a replacement is unpublished", async () => {
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
      await createBuildingSnapshot(store, replacement);

      // The pre-Spec-041 store selects the newest non-fresh row. The future
      // publication boundary must keep the prior published row visible.
      await expect(store.getSnapshot({ repo_root: prior.repo_root })).resolves.toMatchObject({
        id: prior.id
      });
    } finally {
      store.close();
    }
  });

  it("advances visibility only after publication across another connection and reopen", async () => {
    const databasePath = path.join(dir, "publication-reader.sqlite");
    const writer = openGraphStore(databasePath);
    const reader = openGraphStore(databasePath);
    const prior = snapshotState("180");
    const replacement = { ...snapshotState("181"), freshness: "refreshing" as const };

    try {
      await writer.upsertSnapshot({ snapshot: prior });
      await writer.createBuildSnapshot({
        snapshot: replacement,
        controller_generation: 2,
        invalidation_generation: 7,
        created_at: replacement.created_at
      });
      await writer.replaceSnapshotExtraction({
        batch: extractionBatch({
          snapshot_id: replacement.id,
          source_path: "src/replacement.py",
          node_id: "replacement-node",
          name: "Replacement"
        }),
        replace: true
      });

      await expect(reader.getLatestPublished({ repo_root: prior.repo_root })).resolves.toMatchObject({
        status: "selected",
        snapshot: { id: prior.id }
      });
      await expect(reader.readExplicit({
        repo_root: prior.repo_root,
        snapshot_id: replacement.id
      })).resolves.toMatchObject({
        status: "blocked",
        publication_state: "building"
      });

      await writer.transitionBuild({
        repo_root: replacement.repo_root,
        snapshot_id: replacement.id,
        from: "building",
        to: "published",
        controller_generation: 2,
        invalidation_generation: 7,
        updated_at: "2026-05-08T00:01:00.000Z"
      });
      await expect(reader.getLatestPublished({ repo_root: prior.repo_root })).resolves.toMatchObject({
        status: "selected",
        snapshot: { id: replacement.id },
        publication: { controller_generation: 2, invalidation_generation: 7 }
      });
    } finally {
      reader.close();
      writer.close();
    }

    const reopened = openGraphStore(databasePath);
    try {
      await expect(reopened.getLatestPublished({ repo_root: prior.repo_root })).resolves.toMatchObject({
        status: "selected",
        snapshot: { id: replacement.id }
      });
    } finally {
      reopened.close();
    }
  });

  it("keeps the prior publication selected when replacement builds fail or are superseded", async () => {
    const store = openGraphStore(path.join(dir, "publication-terminal-builds.sqlite"));
    const prior = snapshotState("190");
    try {
      await store.upsertSnapshot({ snapshot: prior });
      for (const [id, terminal] of [["191", "failed"], ["192", "superseded"]] as const) {
        const build = { ...snapshotState(id), freshness: "refreshing" as const };
        await store.createBuildSnapshot({
          snapshot: build,
          controller_generation: 3,
          invalidation_generation: Number(id),
          created_at: build.created_at
        });
        await store.transitionBuild({
          repo_root: build.repo_root,
          snapshot_id: id,
          from: "building",
          to: terminal,
          controller_generation: 3,
          invalidation_generation: Number(id),
          updated_at: "2026-05-08T00:02:00.000Z"
        });
        await expect(store.getLatestPublished({ repo_root: prior.repo_root })).resolves.toMatchObject({
          status: "selected",
          snapshot: { id: prior.id }
        });
      }
    } finally {
      store.close();
    }
  });

  it("returns discriminated explicit-id results for every publication state", async () => {
    const store = openGraphStore(path.join(dir, "explicit-unpublished.sqlite"));

    try {
      ensureSqliteColumn(store.db, "snapshots", "publication_state", "TEXT");
      for (const [id, publicationState] of [
        ["82", "building"],
        ["83", "superseded"],
        ["84", "failed"],
        ["85", "published"]
      ] as const) {
        const stateSnapshot = {
          ...snapshotState(id),
          freshness: publicationState === "published" ? "fresh" as const : "refreshing" as const
        };
        if (publicationState === "published") {
          await store.upsertSnapshot({ snapshot: stateSnapshot });
        } else {
          await createBuildingSnapshot(store, stateSnapshot);
        }
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

  it("blocks every graph, catalog, docs, FTS, and coverage read for unpublished explicit ids", async () => {
    const store = openGraphStore(path.join(dir, "unpublished-read-boundary.sqlite"));
    const prior = snapshotState("860");
    const unpublished = [
      ["861", "building"],
      ["862", "failed"],
      ["863", "superseded"]
    ] as const;

    try {
      await createBuildingSnapshot(store, { ...prior, freshness: "refreshing" });
      await store.replaceSnapshotExtraction({
        batch: extractionBatch({
          snapshot_id: prior.id,
          source_path: "src/prior.py",
          node_id: "prior-node",
          name: "PriorSymbol"
        }),
        replace: true
      });
      await publishBuildingSnapshot(store, prior.id);

      for (const [snapshotId, terminalState] of unpublished) {
        await createBuildingSnapshot(store, {
          ...snapshotState(snapshotId),
          freshness: "refreshing"
        });
        const sourcePath = `src/unpublished_${snapshotId}.py`;
        const nodeId = `unpublished-node-${snapshotId}`;
        await store.replaceSnapshotExtraction({
          batch: {
            ...extractionBatch({
              snapshot_id: snapshotId,
              source_path: sourcePath,
              node_id: nodeId,
              name: "HiddenSymbol"
            }),
            unresolved_references: [{
              id: `unresolved-${snapshotId}`,
              source_node_id: nodeId,
              source_file_path: sourcePath,
              reference_name: "MissingDependency",
              reference_kind: "call",
              source_range: { start_line: 2, start_column: 2, end_line: 2, end_column: 19 },
              candidate_metadata: {}
            }]
          },
          replace: true
        });
        await store.insertEdges({
          snapshot_id: snapshotId,
          file_path: sourcePath,
          edges: [{
            id: `edge-${snapshotId}`,
            source_node_id: nodeId,
            target_node_id: nodeId,
            kind: "call",
            provenance: "unit",
            confidence: 1,
            metadata: {}
          }]
        });
        await store.replaceSnapshotDocs({
          snapshot_id: snapshotId,
          repo_root: prior.repo_root,
          documents: [{
            path: `docs/hidden_${snapshotId}.md`,
            title: "Hidden document",
            headings: [{ id: "hidden", text: "Hidden", depth: 1, line: 1 }],
            selected_text: "unpublished-fts-needle",
            content_hash: `docs-${snapshotId}`,
            byte_count: 30,
            indexed_at: "2026-05-08T00:00:00.000Z",
            truncated: false
          }],
          coverage: [{
            evidence_class: "docs",
            state: "complete",
            indexed_files: 1,
            eligible_files_seen: 1,
            scan_truncated: false
          }, {
            evidence_class: "graph",
            state: "partial",
            indexed_files: 1,
            eligible_files_seen: 2,
            scan_truncated: true
          }]
        });
        if (terminalState !== "building") {
          await store.transitionBuild({
            repo_root: prior.repo_root,
            snapshot_id: snapshotId,
            from: "building",
            to: terminalState,
            controller_generation: 0,
            invalidation_generation: 0,
            updated_at: "2026-05-08T00:01:00.000Z"
          });
        }

        await expect(store.getNode({ snapshot_id: snapshotId, node_id: nodeId })).resolves.toBeNull();
        await expect(store.findNodesByName({ snapshot_id: snapshotId, query: "HiddenSymbol" })).resolves.toEqual([]);
        await expect(store.findNodesByQualifiedName({ snapshot_id: snapshotId, qualified_name: "HiddenSymbol" })).resolves.toEqual([]);
        await expect(store.searchNodes({ snapshot_id: snapshotId, query: "HiddenSymbol" })).resolves.toEqual([]);
        await expect(store.getNodesInRange({
          snapshot_id: snapshotId,
          file_path: sourcePath,
          range: { start_line: 1, start_column: 0, end_line: 4, end_column: 0 }
        })).resolves.toEqual([]);
        await expect(store.getOutgoingEdges({ snapshot_id: snapshotId, node_id: nodeId })).resolves.toEqual([]);
        await expect(store.getIncomingEdges({ snapshot_id: snapshotId, node_id: nodeId })).resolves.toEqual([]);
        await expect(store.getReferences({ snapshot_id: snapshotId, node_id: nodeId })).resolves.toEqual([]);
        await expect(store.getUnresolvedReferences({ snapshot_id: snapshotId })).resolves.toEqual([]);
        await expect(store.traverse({
          snapshot_id: snapshotId,
          request: { start_node_ids: [nodeId], direction: "outgoing", max_depth: 2, max_nodes: 20 }
        })).resolves.toMatchObject({ nodes: [], edges: [] });
        await expect(store.listFiles({ snapshot_id: snapshotId })).resolves.toEqual([]);
        await expect(store.listIndexedPaths({ snapshot_id: snapshotId, max_rows: 20 })).resolves.toEqual([]);
        await expect(store.getFile({ snapshot_id: snapshotId, path: sourcePath })).resolves.toBeNull();
        await expect(store.getState({ repo_root: prior.repo_root, snapshot_id: snapshotId })).resolves.toMatchObject({
          status: "cold",
          coverage_state: "blocked",
          document_count: 0
        });
        await expect(store.search({
          repo_root: prior.repo_root,
          snapshot_id: snapshotId,
          query: "unpublished-fts-needle",
          max_results: 10,
          include_snippets: false
        })).resolves.toMatchObject({ status: "blocked", hits: [], coverage: undefined });

        expect(store.db.prepare("SELECT COUNT(*) AS count FROM files WHERE snapshot_id = ?").get(Number(snapshotId)))
          .toEqual({ count: 1 });
        expect(store.db.prepare("SELECT COUNT(*) AS count FROM docs_documents WHERE snapshot_id = ?").get(Number(snapshotId)))
          .toEqual({ count: 1 });
        expect(store.db.prepare("SELECT COUNT(*) AS count FROM snapshot_index_coverage WHERE snapshot_id = ?").get(Number(snapshotId)))
          .toEqual({ count: 2 });
      }

      await expect(store.getSnapshot({ repo_root: prior.repo_root })).resolves.toMatchObject({ id: prior.id });
      await expect(store.findNodesByName({ snapshot_id: prior.id, query: "PriorSymbol", exact: true })).resolves.toHaveLength(1);
    } finally {
      store.close();
    }
  });

  it("refuses every evidence mutation after a snapshot reaches a terminal publication state", async () => {
    const store = openGraphStore(path.join(dir, "terminal-evidence-immutability.sqlite"));

    try {
      for (const [snapshotId, terminalState] of [
        ["870", "published"],
        ["871", "failed"],
        ["872", "superseded"]
      ] as const) {
        const sourcePath = `src/terminal_${snapshotId}.py`;
        const nodeId = `terminal-node-${snapshotId}`;
        await createBuildingSnapshot(store, {
          ...snapshotState(snapshotId),
          freshness: "refreshing"
        });
        await store.replaceSnapshotExtraction({
          batch: {
            ...extractionBatch({
              snapshot_id: snapshotId,
              source_path: sourcePath,
              node_id: nodeId,
              name: `TerminalSymbol${snapshotId}`
            }),
            edges: [{
              id: `terminal-edge-${snapshotId}`,
              source_node_id: nodeId,
              target_node_id: nodeId,
              kind: "call",
              provenance: "unit",
              confidence: 1,
              metadata: {}
            }],
            unresolved_references: [{
              id: `terminal-unresolved-${snapshotId}`,
              source_node_id: nodeId,
              source_file_path: sourcePath,
              reference_name: "MissingTerminalDependency",
              reference_kind: "call",
              source_range: { start_line: 2, start_column: 2, end_line: 2, end_column: 27 },
              candidate_metadata: {}
            }]
          },
          replace: true
        });
        await store.replaceSnapshotDocs({
          snapshot_id: snapshotId,
          repo_root: "/tmp/repo",
          documents: [{
            path: `docs/terminal_${snapshotId}.md`,
            title: `Terminal ${snapshotId}`,
            headings: [{ id: "terminal", text: "Terminal", depth: 1, line: 1 }],
            selected_text: `terminal immutable evidence ${snapshotId}`,
            content_hash: `terminal-docs-${snapshotId}`,
            byte_count: 32,
            indexed_at: "2026-05-08T00:00:00.000Z",
            truncated: false
          }],
          coverage: [{
            evidence_class: "docs",
            state: "complete",
            indexed_files: 1,
            eligible_files_seen: 1,
            scan_truncated: false
          }, {
            evidence_class: "graph",
            state: "complete",
            indexed_files: 1,
            eligible_files_seen: 1,
            scan_truncated: false
          }]
        });
        await store.transitionBuild({
          repo_root: "/tmp/repo",
          snapshot_id: snapshotId,
          from: "building",
          to: terminalState,
          controller_generation: 0,
          invalidation_generation: 0,
          updated_at: "2026-05-08T00:01:00.000Z"
        });

        const before = snapshotEvidenceRows(store.db, Number(snapshotId));
        const expectedError = `Snapshot ${snapshotId} is not building.`;
        const mutations = [
          () => store.replaceSnapshotExtraction({
            batch: extractionBatch({
              snapshot_id: snapshotId,
              source_path: sourcePath,
              node_id: `replacement-${nodeId}`,
              name: "ReplacementTerminalSymbol"
            }),
            replace: true
          }),
          () => store.upsertFileIdentity({
            snapshot_id: snapshotId,
            file_identity: {
              path: sourcePath,
              language: "python",
              content_hash: "mutated-content",
              size_bytes: 999,
              mtime_ms: 999
            }
          }),
          () => store.insertEdges({
            snapshot_id: snapshotId,
            file_path: sourcePath,
            edges: [{
              id: `mutating-edge-${snapshotId}`,
              source_node_id: nodeId,
              target_node_id: nodeId,
              kind: "call",
              provenance: "unit",
              confidence: 1,
              metadata: { mutation: true }
            }]
          }),
          () => store.clearFile({ snapshot_id: snapshotId, file_path: sourcePath }),
          () => store.clearSnapshot({ snapshot_id: snapshotId }),
          () => store.clearUnresolvedReferences({ snapshot_id: snapshotId, source_node_id: nodeId }),
          () => store.upsertEntry({
            snapshot_id: snapshotId,
            entry: {
              path: `src/new_${snapshotId}.py`,
              file_identity: {
                path: `src/new_${snapshotId}.py`,
                language: "python",
                content_hash: "new-content",
                size_bytes: 1,
                mtime_ms: 1
              },
              indexed: false,
              skipped_reason: "mutation"
            }
          }),
          () => store.removeEntry({ snapshot_id: snapshotId, path: sourcePath }),
          () => store.replaceSnapshotDocs({
            snapshot_id: snapshotId,
            repo_root: "/tmp/repo",
            documents: [],
            coverage: []
          })
        ];

        for (const mutate of mutations) {
          await expect(mutate()).rejects.toThrow(expectedError);
        }
        expect(snapshotEvidenceRows(store.db, Number(snapshotId))).toEqual(before);
      }
    } finally {
      store.close();
    }
  });

  it("reconciles a positively orphaned building snapshot as failed on reopen", async () => {
    const databasePath = path.join(dir, "orphaned-building.sqlite");
    const store = openGraphStore(databasePath);
    try {
      await store.upsertSnapshot({ snapshot: snapshotState("82") });
      await store.createBuildSnapshot({
        snapshot: snapshotState("83"),
        controller_generation: 4,
        invalidation_generation: 7,
        created_at: "2026-07-18T00:00:00.000Z"
      });
      expect(store.db.prepare(`
        SELECT publication_state, controller_generation
        FROM snapshots
        WHERE id = ?
      `).get(83)).toEqual({
        publication_state: "building",
        controller_generation: 4
      });
    } finally {
      store.close();
    }

    const reopened = openGraphStore(databasePath);
    try {
      expect(reopened.validateSchema()).toBe(true);
      await expect(reopened.reconcileOrphanedBuilds({
        repo_root: "/tmp/repo",
        current_owner: activeOwnerLease(5),
        recovered_owners: [deadOwnerLease(4)],
        updated_at: "2026-07-20T00:00:00.000Z"
      })).resolves.toEqual({ outcome: "reconciled", snapshot_ids: ["83"] });
      const orphan = reopened.db.prepare(`
        SELECT publication_state, publication_updated_at
        FROM snapshots
        WHERE id = ?
      `).get(83);
      expect(orphan).toEqual({
        publication_state: "failed",
        publication_updated_at: "2026-07-20T00:00:00.000Z"
      });
      await expect(reopened.getSnapshot({
        repo_root: "/tmp/repo",
        snapshot_id: "83"
      })).resolves.toBeNull();
      await expect(reopened.getLatestPublished({ repo_root: "/tmp/repo" })).resolves.toMatchObject({
        status: "selected",
        snapshot: { id: "82" }
      });
    } finally {
      reopened.close();
    }
  });

  it("reconciles a positively orphaned build across a runtime upgrade with the same schema", async () => {
    const store = openGraphStore(path.join(dir, "runtime-upgrade-orphan.sqlite"));
    try {
      await store.createBuildSnapshot({
        snapshot: snapshotState("89"),
        controller_generation: 8,
        invalidation_generation: 1,
        created_at: "2026-07-18T00:00:00.000Z"
      });

      await expect(store.reconcileOrphanedBuilds({
        repo_root: "/tmp/repo",
        current_owner: activeOwnerLease(10),
        recovered_owners: [{ ...deadOwnerLease(8), runtime_identity: "prior-runtime:2" }],
        updated_at: "2026-07-20T00:00:00.000Z"
      })).resolves.toEqual({ outcome: "reconciled", snapshot_ids: ["89"] });
      expect(store.db.prepare(`
        SELECT publication_state, publication_updated_at
        FROM snapshots
        WHERE id = 89
      `).get()).toEqual({
        publication_state: "failed",
        publication_updated_at: "2026-07-20T00:00:00.000Z"
      });
    } finally {
      store.close();
    }
  });

  it("blocks orphan cleanup without exact positive dead-owner evidence", async () => {
    const store = openGraphStore(path.join(dir, "ambiguous-orphan.sqlite"));
    try {
      await store.createBuildSnapshot({
        snapshot: snapshotState("91"),
        controller_generation: 8,
        invalidation_generation: 1,
        created_at: "2026-07-18T00:00:00.000Z"
      });

      await expect(store.reconcileOrphanedBuilds({
        repo_root: "/tmp/repo",
        current_owner: activeOwnerLease(10),
        updated_at: "2026-07-20T00:00:00.000Z"
      })).resolves.toEqual({
        outcome: "blocked",
        reason: "ownership_ambiguous",
        snapshot_ids: ["91"]
      });
      await expect(store.reconcileOrphanedBuilds({
        repo_root: "/tmp/repo",
        current_owner: activeOwnerLease(10),
        recovered_owners: [{ ...deadOwnerLease(8), schema_version: SCHEMA_VERSION + 1 }],
        updated_at: "2026-07-20T00:00:00.000Z"
      })).resolves.toMatchObject({ outcome: "blocked", reason: "ownership_ambiguous" });
      await expect(store.reconcileOrphanedBuilds({
        repo_root: "/tmp/repo",
        current_owner: activeOwnerLease(10),
        recovered_owners: [deadOwnerLease(9)],
        updated_at: "2026-07-20T00:00:00.000Z"
      })).resolves.toEqual({
        outcome: "blocked",
        reason: "ownership_ambiguous",
        snapshot_ids: ["91"]
      });
      expect(store.db.prepare(`
        SELECT publication_state, publication_updated_at
        FROM snapshots
        WHERE id = 91
      `).get()).toEqual({
        publication_state: "building",
        publication_updated_at: "2026-07-18T00:00:00.000Z"
      });
    } finally {
      store.close();
    }
  });

  it("reconciles every matching orphan in a positively proven multi-crash owner chain", async () => {
    const store = openGraphStore(path.join(dir, "multi-crash-orphans.sqlite"));
    try {
      for (const [snapshotId, generation] of [[101, 4], [102, 5]] as const) {
        await store.createBuildSnapshot({
          snapshot: snapshotState(String(snapshotId)),
          controller_generation: generation,
          invalidation_generation: 1,
          created_at: "2026-07-18T00:00:00.000Z"
        });
      }
      await expect(store.reconcileOrphanedBuilds({
        repo_root: "/tmp/repo",
        current_owner: activeOwnerLease(6),
        recovered_owners: [deadOwnerLease(4), deadOwnerLease(5)],
        updated_at: "2026-07-20T00:00:00.000Z"
      })).resolves.toEqual({ outcome: "reconciled", snapshot_ids: ["101", "102"] });
      expect(store.db.prepare(`
        SELECT id, publication_state FROM snapshots ORDER BY id
      `).all()).toEqual([
        { id: 101, publication_state: "failed" },
        { id: 102, publication_state: "failed" }
      ]);
    } finally {
      store.close();
    }
  });

  it("refuses a database marked with a newer schema version", () => {
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
    const beforeStat = fs.statSync(databasePath);
    const beforeArtifacts = [`${databasePath}-wal`, `${databasePath}-shm`].filter(fs.existsSync);
    const readonlyBefore = new Database(databasePath, { readonly: true });
    expect(readonlyBefore.pragma("journal_mode", { simple: true })).toBe("wal");
    readonlyBefore.close();

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
    const afterStat = fs.statSync(databasePath);
    expect({ size: afterStat.size, mtimeMs: afterStat.mtimeMs }).toEqual({
      size: beforeStat.size,
      mtimeMs: beforeStat.mtimeMs
    });
    expect([`${databasePath}-wal`, `${databasePath}-shm`].filter(fs.existsSync)).toEqual(beforeArtifacts);
    const readonlyAfter = new Database(databasePath, { readonly: true });
    expect(readonlyAfter.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(readonlyAfter.prepare("SELECT MAX(version) AS version FROM schema_migrations").get()).toEqual({
      version: futureVersion
    });
    readonlyAfter.close();
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
      await expect(store.getSnapshot({
        repo_root: snapshot.repo_root,
        snapshot_id: snapshot.repo_root
      })).resolves.toBeNull();
      await expect(store.readExplicit({
        repo_root: snapshot.repo_root,
        snapshot_id: snapshot.repo_root
      })).resolves.toEqual({
        status: "missing",
        snapshot_id: snapshot.repo_root,
        reason: "snapshot_not_found"
      });
    } finally {
      store.close();
    }
  });

  it("keeps bootstrap seeding, freshness, and controlled build publication independent", async () => {
    const store = openGraphStore(path.join(dir, "publication-freshness-independence.sqlite"));
    const prior = snapshotState("140");
    const target = { ...snapshotState("141"), freshness: "refreshing" as const };
    try {
      await store.upsertSnapshot({ snapshot: prior });
      await expect(store.upsertSnapshot({ snapshot: prior })).rejects.toThrow("UNIQUE constraint failed");
      await expect(store.upsertSnapshot({ snapshot: target })).rejects.toThrow(
        "Bootstrap snapshot seeding cannot create a controlled build."
      );
      expect(store.db.prepare("SELECT COUNT(*) AS count FROM snapshots WHERE id = 141").get()).toEqual({ count: 0 });

      await store.createBuildSnapshot({
        snapshot: target,
        controller_generation: 5,
        invalidation_generation: 8,
        created_at: target.created_at
      });
      await store.markSnapshotFreshness({ snapshot_id: target.id, freshness: "fresh" });
      await expect(store.getSnapshot({ repo_root: prior.repo_root })).resolves.toMatchObject({ id: prior.id });
      await expect(store.readExplicit({ repo_root: prior.repo_root, snapshot_id: target.id })).resolves.toMatchObject({
        status: "blocked",
        publication_state: "building"
      });
      await expect(store.upsertSnapshot({ snapshot: { ...target, freshness: "fresh" } })).rejects.toThrow(
        "UNIQUE constraint failed"
      );
      await expect(store.createBuildSnapshot({
        snapshot: { ...prior, freshness: "refreshing" },
        controller_generation: 5,
        invalidation_generation: 8,
        created_at: prior.created_at
      })).rejects.toThrow("Snapshot id already exists: 140");

      await store.markSnapshotFreshness({ snapshot_id: prior.id, freshness: "refreshing" });
      await expect(store.getSnapshot({ repo_root: prior.repo_root })).resolves.toMatchObject({
        id: prior.id,
        freshness: "refreshing"
      });
      expect(store.db.prepare(`
        SELECT id, freshness, publication_state FROM snapshots ORDER BY id
      `).all()).toEqual([
        { id: 140, freshness: "refreshing", publication_state: "published" },
        { id: 141, freshness: "fresh", publication_state: "building" }
      ]);
    } finally {
      store.close();
    }
  });

  it("allows writes to a new numeric build while keeping its graph reads unpublished", async () => {
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
      await createBuildingSnapshot(store, refresh);

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
      ).resolves.toEqual([]);
      expect(store.db.prepare(`
        SELECT COUNT(*) AS count
        FROM nodes JOIN files ON files.id = nodes.file_id
        WHERE files.snapshot_id = ?
      `).get(Number(refresh.id))).toEqual({ count: 1 });
    } finally {
      store.close();
    }
  });

  it("selects the latest published snapshot while a newer build remains invisible", async () => {
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
      await createBuildingSnapshot(store, refreshing);

      await expect(store.getSnapshot({ repo_root: fresh.repo_root })).resolves.toMatchObject({
        id: cold.id,
        freshness: "cold"
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

  it("does not select an unpublished refreshing snapshot", async () => {
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
      await createBuildingSnapshot(store, refreshing);

      await expect(store.getSnapshot({ repo_root: cold.repo_root })).resolves.toMatchObject({
        id: cold.id,
        freshness: "cold"
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
      await createBuildingSnapshot(store, { ...snapshot, freshness: "refreshing" });
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

      await store.removeEntry({ snapshot_id: snapshot.id, path: "/tmp/repo/a.py" });
      await publishBuildingSnapshot(store, snapshot.id);
      const listed = await store.listFiles({ snapshot_id: snapshot.id });
      expect(listed.map((entry) => entry.path)).toEqual(["/tmp/repo/__init__.py"]);
      expect(listed[0]).toMatchObject({
        path: "/tmp/repo/__init__.py",
        file_identity: {
          indexed_at: "2026-05-08T00:00:00.000Z",
          content_hash: "c1"
        },
        indexed: true
      });

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
      await createBuildingSnapshot(store, { ...snapshot, freshness: "refreshing" });
      await store.replaceSnapshotExtraction({ batch, replace: true });
      await publishBuildingSnapshot(store, snapshot.id);

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
      await createBuildingSnapshot(store, { ...snapshot, freshness: "refreshing" });
      await store.replaceSnapshotExtraction({
        batch: extractionBatch({
          snapshot_id: snapshot.id,
          source_path: "src/service.py",
          node_id: "old-node",
          name: "OldName"
        }),
        replace: true
      });
      await store.replaceSnapshotExtraction({
        batch: extractionBatch({
          snapshot_id: snapshot.id,
          source_path: "src/service.py",
          node_id: "new-node",
          name: "NewName"
        }),
        replace: true
      });
      await publishBuildingSnapshot(store, snapshot.id);

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
      await createBuildingSnapshot(store, { ...snapshot, freshness: "refreshing" });
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
      await publishBuildingSnapshot(store, snapshot.id);

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
      await createBuildingSnapshot(store, { ...snapshot, freshness: "refreshing" });
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

      await publishBuildingSnapshot(store, snapshot.id);
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
      await createBuildingSnapshot(store, { ...snapshot, freshness: "refreshing" });
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

  it("prunes old published snapshots without deleting or quota-counting an active build", async () => {
    const store = openGraphStore(path.join(dir, "snapshot-prune.sqlite"));

    try {
      for (let index = 1; index <= 6; index += 1) {
        const snapshot = {
          ...snapshotState(String(4600 + index)),
          freshness: index === 5 ? "refreshing" as const : "fresh" as const,
          created_at: `2026-05-08T00:00:0${index}.000Z`,
          updated_at: `2026-05-08T00:00:0${index}.000Z`
        };
        await createBuildingSnapshot(store, { ...snapshot, freshness: "refreshing" });
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
        if (index !== 5) {
          await publishBuildingSnapshot(store, snapshot.id);
        }
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
      expect(store.db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'index' AND name = 'idx_unresolved_refs_source_node_id'
      `).get()).toEqual({ name: "idx_unresolved_refs_source_node_id" });
      expect((await store.listSnapshots({ repo_root: "/tmp/repo" })).map((snapshot) => snapshot.id)).toEqual([
        "4604",
        "4606"
      ]);
      await expect(store.readExplicit({ repo_root: "/tmp/repo", snapshot_id: "4605" })).resolves.toMatchObject({
        status: "blocked",
        publication_state: "building"
      });
      expect(countRows(store.db, "node_fts")).toBe(3);
      expect(countRows(store.db, "docs_fts")).toBe(3);
    } finally {
      store.close();
    }
  });

  it("reports non-vacuum pruning truthfully and removes only deleted snapshot FTS rows", async () => {
    const store = openGraphStore(path.join(dir, "snapshot-prune-without-vacuum.sqlite"));

    try {
      for (let index = 1; index <= 3; index += 1) {
        const snapshot = {
          ...snapshotState(String(4700 + index)),
          created_at: `2026-05-08T00:01:0${index}.000Z`,
          updated_at: `2026-05-08T00:01:0${index}.000Z`
        };
        await createBuildingSnapshot(store, { ...snapshot, freshness: "refreshing" });
        await store.replaceSnapshotExtraction({
          batch: extractionBatch({
            snapshot_id: snapshot.id,
            source_path: `src/retention_${index}.py`,
            node_id: `retention-node-${index}`,
            name: `RetentionSymbol${index}`
          }),
          replace: true
        });
        await store.replaceSnapshotDocs({
          snapshot_id: snapshot.id,
          repo_root: snapshot.repo_root,
          documents: [
            {
              path: `docs/retention_${index}.md`,
              title: `Retention doc ${index}`,
              headings: [{ id: `retention-${index}`, text: `Retention ${index}`, depth: 1, line: 1 }],
              selected_text: `Retention documentation ${index}`,
              content_hash: `retention-doc-hash-${index}`,
              byte_count: 25,
              indexed_at: "2026-05-08T00:00:00.000Z",
              truncated: false
            }
          ]
        });
        await publishBuildingSnapshot(store, snapshot.id);
      }

      const result = await store.pruneRepositorySnapshots({
        repo_root: "/tmp/repo",
        retain_latest_snapshots: 1,
        retain_latest_fresh_snapshots: 0,
        vacuum: false
      });

      expect(result).toEqual({
        repo_root: "/tmp/repo",
        deleted_snapshots: 2,
        retained_snapshot_ids: ["4703"],
        optimized: false,
        vacuumed: false
      });
      expect(store.db.prepare(`
        SELECT node_fts.node_id
        FROM node_fts
        ORDER BY node_fts.node_id
      `).all()).toEqual([{ node_id: "retention-node-3" }]);
      expect(store.db.prepare(`
        SELECT docs_fts.path
        FROM docs_fts
        ORDER BY docs_fts.path
      `).all()).toEqual([{ path: "docs/retention_3.md" }]);
    } finally {
      store.close();
    }
  });

  it("applies graph read budgets and keeps failed edge transactions atomic", async () => {
    const store = openGraphStore(path.join(dir, "budget.sqlite"));
    const snapshot = snapshotState("47");

    try {
      await createBuildingSnapshot(store, { ...snapshot, freshness: "refreshing" });
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
      await publishBuildingSnapshot(store, snapshot.id);
      expect(await store.searchNodes({ snapshot_id: snapshot.id, query: "Shared", max_rows: 2 })).toHaveLength(2);
      expect(await store.getReferences({ snapshot_id: snapshot.id, node_id: "node-0" })).toEqual([]);
    } finally {
      store.close();
    }
  });

  it("deduplicates parser reference identities before deterministic limit and offset paging", async () => {
    const store = openGraphStore(path.join(dir, "reference-identity-pagination.sqlite"));
    const snapshot = snapshotState("48");
    const edge = (id: string, source: string, target: string) => ({
      id,
      source_node_id: source,
      target_node_id: target,
      kind: "call",
      source_range: { start_line: 2, start_column: 4, end_line: 2, end_column: 12 },
      provenance: "tree-sitter-python",
      confidence: 0.9,
      metadata: { reference_name: target }
    });
    const unresolved = (id: string, line: number) => ({
      id,
      source_node_id: "source-a",
      source_file_path: "src/source-a.py",
      reference_name: "Target",
      reference_kind: "call",
      source_range: { start_line: line, start_column: 2, end_line: line, end_column: 8 },
      candidate_metadata: { resolution: "missing" }
    });

    try {
      await createBuildingSnapshot(store, { ...snapshot, freshness: "refreshing" });
      for (const [nodeId, sourcePath] of [
        ["target-a", "src/target-a.py"],
        ["target-b", "src/target-b.py"],
        ["source-b", "src/source-b.py"]
      ] as const) {
        await store.replaceSnapshotExtraction({
          batch: extractionBatch({ snapshot_id: snapshot.id, source_path: sourcePath, node_id: nodeId, name: nodeId }),
          replace: true
        });
      }
      const sourceBatch = extractionBatch({
        snapshot_id: snapshot.id,
        source_path: "src/source-a.py",
        node_id: "source-a",
        name: "source-a"
      });
      await store.replaceSnapshotExtraction({
        batch: {
          ...sourceBatch,
          edges: [
            edge("out-b-1", "source-a", "target-b"),
            edge("out-b-duplicate", "source-a", "target-b"),
            edge("out-a-1", "source-a", "target-a"),
            edge("out-a-duplicate", "source-a", "target-a")
          ],
          unresolved_references: [
            unresolved("unresolved-1", 1),
            unresolved("unresolved-1-duplicate", 1),
            unresolved("unresolved-2", 2)
          ]
        },
        replace: true
      });
      await store.insertEdges({
        snapshot_id: snapshot.id,
        file_path: "src/source-b.py",
        edges: [
          edge("incoming-b-1", "source-b", "target-a"),
          edge("incoming-b-duplicate", "source-b", "target-a")
        ]
      });
      await publishBuildingSnapshot(store, snapshot.id);

      await expect(store.getReferences({
        snapshot_id: snapshot.id,
        node_id: "source-a",
        max_rows: 1,
        offset: 0
      })).resolves.toEqual([expect.objectContaining({ target_node_id: "target-a" })]);
      await expect(store.getReferences({
        snapshot_id: snapshot.id,
        node_id: "source-a",
        max_rows: 1,
        offset: 1
      })).resolves.toEqual([expect.objectContaining({ target_node_id: "target-b" })]);
      await expect(store.getReferences({
        snapshot_id: snapshot.id,
        node_id: "source-a",
        max_rows: 1,
        offset: 2
      })).resolves.toEqual([]);

      await expect(store.getIncomingEdges({
        snapshot_id: snapshot.id,
        node_id: "target-a",
        max_rows: 1,
        offset: 0
      })).resolves.toEqual([expect.objectContaining({ source_node_id: "source-a" })]);
      await expect(store.getIncomingEdges({
        snapshot_id: snapshot.id,
        node_id: "target-a",
        max_rows: 1,
        offset: 1
      })).resolves.toEqual([expect.objectContaining({ source_node_id: "source-b" })]);
      await expect(store.getIncomingEdges({
        snapshot_id: snapshot.id,
        node_id: "target-a",
        max_rows: 1,
        offset: 2
      })).resolves.toEqual([]);

      await expect(store.getUnresolvedReferences({
        snapshot_id: snapshot.id,
        source_node_id: "source-a",
        reference_name: "Target",
        max_rows: 1,
        offset: 0
      })).resolves.toEqual([expect.objectContaining({ source_range: expect.objectContaining({ start_line: 1 }) })]);
      await expect(store.getUnresolvedReferences({
        snapshot_id: snapshot.id,
        source_node_id: "source-a",
        reference_name: "Target",
        max_rows: 1,
        offset: 1
      })).resolves.toEqual([expect.objectContaining({ source_range: expect.objectContaining({ start_line: 2 }) })]);
      await expect(store.getUnresolvedReferences({
        snapshot_id: snapshot.id,
        source_node_id: "source-a",
        reference_name: "Target",
        max_rows: 1,
        offset: 2
      })).resolves.toEqual([]);
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

async function createBuildingSnapshot(
  store: ReturnType<typeof openGraphStore>,
  snapshot: SnapshotState
): Promise<void> {
  await store.createBuildSnapshot({
    snapshot,
    controller_generation: 0,
    invalidation_generation: 0,
    created_at: snapshot.created_at
  });
}

async function publishBuildingSnapshot(
  store: ReturnType<typeof openGraphStore>,
  snapshotId: string
): Promise<void> {
  await store.markSnapshotFreshness({ snapshot_id: snapshotId, freshness: "fresh" });
  await store.transitionBuild({
    repo_root: "/tmp/repo",
    snapshot_id: snapshotId,
    from: "building",
    to: "published",
    controller_generation: 0,
    invalidation_generation: 0,
    updated_at: "2026-05-08T00:01:00.000Z"
  });
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

function snapshotEvidenceRows(db: import("better-sqlite3").Database, snapshotId: number): object {
  return {
    snapshot: db.prepare(`
      SELECT id, freshness, publication_state, publication_updated_at
      FROM snapshots WHERE id = ?
    `).get(snapshotId),
    files: db.prepare(`
      SELECT path, language, content_hash, size_bytes, mtime_ms, indexed_at, indexing_error, node_count
      FROM files WHERE snapshot_id = ? ORDER BY path
    `).all(snapshotId),
    nodes: db.prepare(`
      SELECT nodes.id, nodes.name, nodes.qualified_name, nodes.metadata_json
      FROM nodes INNER JOIN files ON files.id = nodes.file_id
      WHERE files.snapshot_id = ? ORDER BY nodes.id
    `).all(snapshotId),
    edges: db.prepare(`
      SELECT edges.source_node_id, edges.target_node_id, edges.kind, edges.metadata_json
      FROM edges INNER JOIN files ON files.id = edges.file_id
      WHERE files.snapshot_id = ? ORDER BY edges.id
    `).all(snapshotId),
    unresolved: db.prepare(`
      SELECT unresolved_refs.source_node_id, unresolved_refs.reference_name,
             unresolved_refs.reference_kind, unresolved_refs.candidate_metadata_json
      FROM unresolved_refs INNER JOIN files ON files.id = unresolved_refs.file_id
      WHERE files.snapshot_id = ? ORDER BY unresolved_refs.id
    `).all(snapshotId),
    nodeFts: db.prepare(`
      SELECT node_fts.node_id, node_fts.name, node_fts.qualified_name
      FROM node_fts
      INNER JOIN nodes ON nodes.id = node_fts.node_id
      INNER JOIN files ON files.id = nodes.file_id
      WHERE files.snapshot_id = ? ORDER BY node_fts.node_id
    `).all(snapshotId),
    documents: db.prepare(`
      SELECT id, path, title, content_hash, byte_count, indexed_at, selected_text_truncated
      FROM docs_documents WHERE snapshot_id = ? ORDER BY path
    `).all(snapshotId),
    headings: db.prepare(`
      SELECT docs_headings.heading_id, docs_headings.heading_text,
             docs_headings.depth, docs_headings.line
      FROM docs_headings
      INNER JOIN docs_documents ON docs_documents.id = docs_headings.document_id
      WHERE docs_documents.snapshot_id = ? ORDER BY docs_headings.id
    `).all(snapshotId),
    docsFts: db.prepare(`
      SELECT docs_fts.path, docs_fts.title, docs_fts.selected_text
      FROM docs_fts
      INNER JOIN docs_documents ON docs_documents.id = docs_fts.rowid
      WHERE docs_documents.snapshot_id = ? ORDER BY docs_fts.rowid
    `).all(snapshotId),
    coverage: db.prepare(`
      SELECT evidence_class, state, reason, indexed_files, eligible_files_seen,
             scan_truncated, indexed_roots_json, missing_priority_roots_json
      FROM snapshot_index_coverage WHERE snapshot_id = ? ORDER BY evidence_class
    `).all(snapshotId)
  };
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

function deadOwnerLease(ownerGeneration: number): RepositoryOwnershipLease & { state: "dead" } {
  return {
    repo_root: "/tmp/repo",
    runtime_identity: `test:${SCHEMA_VERSION}`,
    schema_version: SCHEMA_VERSION,
    owner_id: "dead-owner",
    owner_pid: 999999999,
    owner_generation: ownerGeneration,
    heartbeat_at: "2026-07-18T00:00:00.000Z",
    state: "dead"
  };
}

function activeOwnerLease(ownerGeneration: number): RepositoryOwnershipLease & { state: "active" } {
  return {
    ...deadOwnerLease(ownerGeneration),
    owner_id: "replacement-owner",
    owner_pid: process.pid,
    state: "active"
  };
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
