/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RepositoryOwnershipAdmission } from "../../src/ports/index.js";
import {
  GRAPH_STORE_FILE_NAME,
  GraphStoreV4MigrationRequiredError,
  PREVIOUS_GRAPH_STORE_BACKUP_FILE_NAME,
  PREVIOUS_GRAPH_STORE_FILE_NAME,
  graphStoreV4MigrationPaths,
  graphStorePath,
  migrateGraphStoreToV4,
  seedVersionedGraphStore
} from "../../src/infrastructure/sqlite/graph-store-location.js";

describe("v4 graph-store identity migration", () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-v4-store-"));
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("fails closed when the v4 opener sees a v3 source", () => {
    const paths = migrationPaths();
    createV3(paths.previous_path);

    let error: unknown;
    try {
      seedVersionedGraphStore(paths.canonical_path);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(GraphStoreV4MigrationRequiredError);
    expect((error as GraphStoreV4MigrationRequiredError).code).toBe("graph_store_v4_migration_required");
    expect(fs.existsSync(paths.canonical_path)).toBe(false);
  });

  it("rejects a redirected cache directory before creating external artifacts", () => {
    const root = path.join(directory, "repository");
    const outside = path.join(directory, "outside-cache");
    fs.mkdirSync(root);
    fs.mkdirSync(outside);
    fs.symlinkSync(outside, path.join(root, ".cache"), "dir");
    expect(() => graphStorePath(root)).toThrow("not symbolic links");
    expect(fs.readdirSync(outside)).toEqual([]);
  });

  it("requires a matching acquired lease on disk", () => {
    const paths = migrationPaths();
    createV3(paths.previous_path);
    const admission = activeAdmission();

    expect(() => migrate(paths, admission)).toThrow("on-disk ownership admission");
    writeAdmission(paths, { ...admission.lease, owner_generation: 99 });
    expect(() => migrate(paths, admission)).toThrow("on-disk ownership admission");
    expect(() => migrate(paths, { outcome: "blocked", reason: "owner_active", owner: admission.lease } as never))
      .toThrow("acquired repository ownership admission");
  });

  it("creates an empty v4 store, retains a verified v3 rollback artifact, and blocks old v3 opens", () => {
    const paths = migrationPaths();
    createV3(paths.previous_path, "legacy snapshot");
    const original = fs.readFileSync(paths.previous_path);
    const admission = activeAdmission();
    writeAdmission(paths, admission.lease);

    expect(migrate(paths, admission)).toMatchObject({ outcome: "migrated" });
    expect(path.basename(paths.canonical_path)).toBe(GRAPH_STORE_FILE_NAME);
    expect(path.basename(paths.previous_path)).toBe(PREVIOUS_GRAPH_STORE_FILE_NAME);
    expect(path.basename(paths.rollback_path)).toBe(PREVIOUS_GRAPH_STORE_BACKUP_FILE_NAME);
    expect(fs.readFileSync(paths.rollback_path)).toEqual(original);
    expect(readVersion(paths.rollback_path)).toBe(3);
    expect(readVersion(paths.canonical_path)).toBe(4);
    expect(readPayload(paths.canonical_path)).toBeNull();
    expect(() => readVersion(paths.previous_path)).toThrow();
  });

  it("blocks before retirement when the v3 WAL is busy", () => {
    const paths = migrationPaths();
    createV3(paths.previous_path);
    const writer = new Database(paths.previous_path);
    writer.pragma("journal_mode = WAL");
    writer.exec("BEGIN IMMEDIATE");
    const admission = activeAdmission();
    writeAdmission(paths, admission.lease);
    try {
      expect(() => migrate(paths, admission)).toThrow("active v3 SQLite ownership");
      expect(readVersion(paths.previous_path)).toBe(3);
      expect(fs.existsSync(paths.rollback_path)).toBe(false);
    } finally {
      writer.exec("ROLLBACK");
      writer.close();
    }
  });

  it("blocks conflicting rollback and canonical target evidence", () => {
    const paths = migrationPaths();
    createV3(paths.previous_path);
    const admission = activeAdmission();
    writeAdmission(paths, admission.lease);
    fs.writeFileSync(paths.rollback_path, "conflict");
    expect(() => migrate(paths, admission)).toThrow("conflicting v3 rollback artifact");
    expect(readVersion(paths.previous_path)).toBe(3);

    fs.rmSync(paths.rollback_path);
    createV4(paths.canonical_path);
    const target = new Database(paths.canonical_path);
    try {
      target.exec("CREATE TABLE snapshots(id INTEGER PRIMARY KEY); INSERT INTO snapshots VALUES (1);");
    } finally {
      target.close();
    }
    expect(() => migrateGraphStoreToV4({
      databasePath: paths.canonical_path,
      admission,
      initializeEmpty: () => { throw new Error("must not initialize an existing target"); },
      validateV4: (databasePath) => { expect(readVersion(databasePath)).toBe(4); }
    })).toThrow("conflicting target before v3 retirement");
    expect(readVersion(paths.previous_path)).toBe(3);
  });

  it("rejects even an empty v4 target before v3 retirement", () => {
    const paths = migrationPaths();
    createV3(paths.previous_path);
    createV4(paths.canonical_path);
    const admission = activeAdmission();
    writeAdmission(paths, admission.lease);
    expect(() => migrate(paths, admission)).toThrow("conflicting target before v3 retirement");
    expect(readVersion(paths.previous_path)).toBe(3);
    expect(fs.existsSync(paths.rollback_path)).toBe(false);
  });

  it("rejects a claimed candidate that contains snapshots, progress, or coverage evidence", () => {
    const paths = migrationPaths();
    createV3(paths.previous_path);
    const admission = activeAdmission();
    writeAdmission(paths, admission.lease);

    expect(() => migrateGraphStoreToV4({
      databasePath: paths.canonical_path,
      admission,
      initializeEmpty: (candidatePath) => {
        createV4(candidatePath);
        const candidate = new Database(candidatePath);
        try {
          candidate.exec("CREATE TABLE snapshots(id INTEGER PRIMARY KEY); INSERT INTO snapshots VALUES (1);");
        } finally {
          candidate.close();
        }
      },
      validateV4: () => undefined
    })).toThrow("target must be empty; snapshots contains derived evidence");
    expect(fs.existsSync(paths.canonical_path)).toBe(false);
    expect(readVersion(paths.rollback_path)).toBe(3);
  });

  it("rejects a nonempty target installed during the atomic claim", () => {
    const paths = migrationPaths();
    createV3(paths.previous_path);
    const admission = activeAdmission();
    writeAdmission(paths, admission.lease);
    expect(() => migrateGraphStoreToV4({
      databasePath: paths.canonical_path, admission,
      initializeEmpty: (candidatePath) => {
        createV4(candidatePath);
        createV4(paths.canonical_path);
        const racing = new Database(paths.canonical_path);
        try { racing.exec("CREATE TABLE snapshots(id INTEGER PRIMARY KEY); INSERT INTO snapshots VALUES (1);"); }
        finally { racing.close(); }
      },
      validateV4: () => undefined
    })).toThrow("target must be empty");
    expect(readVersion(paths.rollback_path)).toBe(3);
    expect(() => migrate(paths, admission)).toThrow("target must be empty");
    const retained = new Database(paths.canonical_path, { readonly: true });
    try { expect(retained.prepare("SELECT COUNT(*) AS count FROM snapshots").get()).toEqual({ count: 1 }); }
    finally { retained.close(); }
  });

  it.each(["canonical_path", "previous_path", "rollback_path", "ownership_path"] as const)(
    "rejects a symbolic link at %s before opening artifacts", (artifact) => {
      const paths = migrationPaths();
      const admission = activeAdmission();
      writeAdmission(paths, admission.lease);
      const outside = path.join(directory, "outside.sqlite");
      createV3(outside, "external evidence");
      const before = fs.readFileSync(outside);
      if (fs.existsSync(paths[artifact])) fs.unlinkSync(paths[artifact]);
      fs.symlinkSync(outside, paths[artifact]);
      expect(() => migrate(paths, admission)).toThrow("not symbolic links");
      expect(fs.readFileSync(outside)).toEqual(before);
      expect(fs.existsSync(`${outside}-wal`)).toBe(false);
    }
  );

  it("preserves a nonempty v4 store on completed-migration and fresh-store re-entry", () => {
    const paths = migrationPaths();
    createV3(paths.previous_path);
    const admission = activeAdmission();
    writeAdmission(paths, admission.lease);
    migrate(paths, admission);
    const completed = new Database(paths.canonical_path);
    try {
      completed.exec("CREATE TABLE snapshots(id INTEGER PRIMARY KEY); INSERT INTO snapshots VALUES (1);");
    } finally {
      completed.close();
    }
    expect(migrate(paths, admission)).toMatchObject({ outcome: "already_current" });
    const retained = new Database(paths.canonical_path, { readonly: true, fileMustExist: true });
    try {
      expect(retained.prepare("SELECT COUNT(*) AS count FROM snapshots").get()).toEqual({ count: 1 });
    } finally {
      retained.close();
    }

    const freshPaths = graphStoreV4MigrationPaths(path.join(directory, "fresh", GRAPH_STORE_FILE_NAME));
    fs.mkdirSync(path.dirname(freshPaths.canonical_path), { recursive: true });
    createV4(freshPaths.canonical_path, "fresh evidence");
    const freshAdmission = { ...admission, lease: { ...admission.lease, repo_root: path.join(directory, "fresh") } };
    writeAdmission(freshPaths, freshAdmission.lease);
    expect(migrateGraphStoreToV4({
      databasePath: freshPaths.canonical_path,
      admission: freshAdmission,
      initializeEmpty: () => { throw new Error("must not initialize a valid fresh v4 store"); },
      validateV4: (databasePath) => { expect(readVersion(databasePath)).toBe(4); }
    })).toMatchObject({ outcome: "already_current" });
    expect(readPayload(freshPaths.canonical_path)).toBe("fresh evidence");
  });

  for (const phase of ["rollback_artifact_retained", "previous_store_blocked", "v4_store_linked", "v4_store_claimed"] as const) {
    it(`re-enters the same protocol after a crash at ${phase}`, () => {
      const paths = migrationPaths();
      createV3(paths.previous_path);
      const admission = activeAdmission();
      writeAdmission(paths, admission.lease);

      expect(() => migrate(paths, admission, (barrier) => {
        if (barrier === phase) throw new Error(`crash at ${phase}`);
      })).toThrow(`crash at ${phase}`);
      expect(migrate(paths, admission).outcome).toMatch(/migrated|already_current/);
      expect(readVersion(paths.canonical_path)).toBe(4);
      expect(readVersion(paths.rollback_path)).toBe(3);
      expect(() => readVersion(paths.previous_path)).toThrow();
    });
  }

  function migrationPaths() {
    return graphStoreV4MigrationPaths(path.join(directory, GRAPH_STORE_FILE_NAME));
  }

  function activeAdmission(): Extract<RepositoryOwnershipAdmission, { outcome: "acquired" }> {
    return {
      outcome: "acquired",
      lease: {
        repo_root: directory,
        runtime_identity: "test-runtime",
        schema_version: 4,
        owner_id: "test-owner",
        owner_pid: process.pid,
        owner_generation: 7,
        heartbeat_at: "2026-11-08T00:00:00.000Z",
        state: "active"
      }
    };
  }

  function writeAdmission(
    paths: ReturnType<typeof migrationPaths>,
    lease: Extract<RepositoryOwnershipAdmission, { outcome: "acquired" }>["lease"]
  ): void {
    fs.writeFileSync(paths.ownership_path, `${JSON.stringify(lease)}\n`);
  }

  function migrate(
    paths: ReturnType<typeof migrationPaths>,
    admission: Extract<RepositoryOwnershipAdmission, { outcome: "acquired" }>,
    barrier?: (phase: "rollback_artifact_retained" | "previous_store_blocked" | "v4_store_linked" | "v4_store_claimed") => void
  ) {
    return migrateGraphStoreToV4({
      databasePath: paths.canonical_path,
      admission,
      initializeEmpty: (temporaryPath) => createV4(temporaryPath),
      validateV4: (databasePath) => {
        if (readVersion(databasePath) !== 4 || readPayload(databasePath) !== null) {
          throw new Error("v4 target must be an empty derived store");
        }
      },
      barrier
    });
  }

  function createV3(databasePath: string, payload: string | null = null): void {
    const database = new Database(databasePath);
    try {
      database.exec(`
        CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY);
        CREATE TABLE inherited_payload(value TEXT);
        INSERT INTO schema_migrations(version) VALUES (3);
        ${payload === null ? "" : `INSERT INTO inherited_payload(value) VALUES ('${payload.replaceAll("'", "''")}');`}
      `);
    } finally {
      database.close();
    }
  }

  function createV4(databasePath: string, payload: string | null = null): void {
    const database = new Database(databasePath);
    try {
      database.exec(`
        CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY);
        CREATE TABLE inherited_payload(value TEXT);
        INSERT INTO schema_migrations(version) VALUES (4);
        ${payload === null ? "" : `INSERT INTO inherited_payload(value) VALUES ('${payload.replaceAll("'", "''")}');`}
      `);
    } finally {
      database.close();
    }
  }

  function readVersion(databasePath: string): number | null {
    const database = new Database(databasePath, { readonly: true, fileMustExist: true });
    try {
      return (database.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as {
        version: number | null;
      }).version;
    } finally {
      database.close();
    }
  }

  function readPayload(databasePath: string): string | null {
    const database = new Database(databasePath, { readonly: true, fileMustExist: true });
    try {
      const row = database.prepare("SELECT value FROM inherited_payload LIMIT 1").get() as
        | { value: string }
        | undefined;
      return row?.value ?? null;
    } finally {
      database.close();
    }
  }
});
