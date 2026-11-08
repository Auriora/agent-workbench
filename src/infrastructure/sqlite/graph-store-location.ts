/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { GRAPH_STORE_IDENTITY_VERSION } from "../../contracts/graph-store-identity-contracts.js";
import type { RepositoryOwnershipAdmission, RepositoryOwnershipLease } from "../../ports/index.js";

export const GRAPH_STORE_FILE_NAME = `graph-v${GRAPH_STORE_IDENTITY_VERSION}.sqlite`;
export const PREVIOUS_GRAPH_STORE_FILE_NAME = "graph-v3.sqlite";
export const PREVIOUS_GRAPH_STORE_BACKUP_FILE_NAME = "graph-v3.sqlite.pre-v4";
export const REPOSITORY_OWNERSHIP_FILE_NAME = "refresh-owner.json";

const PREVIOUS_GRAPH_STORE_BLOCKER = Buffer.from(
  "Agent Workbench graph-v3 store retired; v4 claim pending.\n",
  "utf8"
);

const PREVIOUS_GRAPH_STORE_CLAIMED_BLOCKER = Buffer.from(
  "Agent Workbench graph-v3 store retired; v4 claim complete.\n", "utf8"
);

export const GRAPH_STORE_V4_MIGRATION_BARRIERS = [
  "rollback_artifact_retained",
  "previous_store_blocked",
  "v4_store_linked",
  "v4_store_claimed"
] as const;
export type GraphStoreV4MigrationBarrier = typeof GRAPH_STORE_V4_MIGRATION_BARRIERS[number];

export type GraphStoreV4MigrationPaths = {
  readonly canonical_path: string;
  readonly previous_path: string;
  readonly rollback_path: string;
  readonly ownership_path: string;
};

export type GraphStoreV4MigrationInput = {
  readonly databasePath: string;
  readonly admission: Extract<RepositoryOwnershipAdmission, { outcome: "acquired" }>;
  /** Creates the empty v4 candidate and closes/checkpoints its own SQLite handle. */
  readonly initializeEmpty: (temporaryPath: string) => void;
  /** Semantically validates a v4 store without changing it. */
  readonly validateV4: (databasePath: string) => void;
  /** Test-only durable phase barrier injection. Throwing simulates a process crash. */
  readonly barrier?: (barrier: GraphStoreV4MigrationBarrier) => void;
  /** Test-only diagnostics; it cannot be used to recover around a failure. */
  readonly onDiagnostic?: (diagnostic: {
    readonly phase: "not_required" | "validate_target" | "backup" | "block" | "claim" | "complete";
    readonly paths: GraphStoreV4MigrationPaths;
  }) => void;
};

export type GraphStoreV4MigrationResult = {
  readonly outcome: "not_required" | "migrated" | "already_current";
  readonly paths: GraphStoreV4MigrationPaths;
};

export class GraphStoreV4MigrationRequiredError extends Error {
  public readonly code = "graph_store_v4_migration_required";

  public constructor() {
    super("Graph v4 migration required: graph-v3.sqlite exists and must be retired under repository ownership.");
    this.name = "GraphStoreV4MigrationRequiredError";
  }
}

export function graphStorePath(repoRoot: string): string {
  const canonicalRoot = fs.realpathSync(repoRoot);
  let cacheDir = canonicalRoot;
  for (const component of [".cache", "agent-workbench"]) {
    cacheDir = path.join(cacheDir, component);
    try { fs.mkdirSync(cacheDir); } catch (error) {
      if (!isAlreadyExistsError(error)) throw error;
    }
    const stat = fs.lstatSync(cacheDir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error("Graph store cache directories must be regular directories, not symbolic links.");
    }
  }
  const result = path.join(cacheDir, GRAPH_STORE_FILE_NAME);
  assertRegularArtifact(result);
  assertRegularArtifact(path.join(cacheDir, REPOSITORY_OWNERSHIP_FILE_NAME));
  return result;
}

/** Returns every durable path used by the one v3-to-v4 migration protocol. */
export function graphStoreV4MigrationPaths(databasePath: string): GraphStoreV4MigrationPaths {
  const cacheDirectory = path.dirname(databasePath);
  return {
    canonical_path: databasePath,
    previous_path: path.join(cacheDirectory, PREVIOUS_GRAPH_STORE_FILE_NAME),
    rollback_path: path.join(cacheDirectory, PREVIOUS_GRAPH_STORE_BACKUP_FILE_NAME),
    ownership_path: path.join(cacheDirectory, REPOSITORY_OWNERSHIP_FILE_NAME)
  };
}

/**
 * Prevents the normal store opener from treating v3 as a seed. The transition
 * needs repository ownership and is performed before the shared store opens.
 */
export function seedVersionedGraphStore(
  databasePath: string
): void {
  if (path.basename(databasePath) !== GRAPH_STORE_FILE_NAME || fs.existsSync(databasePath)) return;
  if (fs.existsSync(graphStoreV4MigrationPaths(databasePath).previous_path)) {
    throw new GraphStoreV4MigrationRequiredError();
  }
}

/**
 * Retires v3 under the already-acquired version-independent repository lease.
 * The ownership admission covers participating writers. This protocol cannot
 * prove that arbitrary unmanaged SQLite handles do not exist; a busy WAL blocks.
 */
export function migrateGraphStoreToV4(input: GraphStoreV4MigrationInput): GraphStoreV4MigrationResult {
  const paths = graphStoreV4MigrationPaths(input.databasePath);
  assertCanonicalV4Path(paths);
  assertCanonicalArtifactPaths(paths);
  assertActiveOwnershipAdmission(input.admission, paths.ownership_path);

  const previousExists = fs.existsSync(paths.previous_path);
  const rollbackExists = fs.existsSync(paths.rollback_path);
  const previousIsBlocker = previousExists && isPreviousBlocker(paths.previous_path);
  const previousClaimComplete = previousIsBlocker && isPreviousBlocker(paths.previous_path, true);
  const targetExists = fs.existsSync(paths.canonical_path);

  if (!previousExists && !rollbackExists) {
    if (!targetExists) {
      input.onDiagnostic?.({ phase: "not_required", paths });
      return { outcome: "not_required", paths };
    }
    input.onDiagnostic?.({ phase: "validate_target", paths });
    validateV4Store(paths.canonical_path, input.validateV4);
    input.onDiagnostic?.({ phase: "complete", paths });
    return { outcome: "already_current", paths };
  }
  if (!previousExists) {
    throw new Error("Graph v4 migration found a rollback artifact without its canonical v3 blocker.");
  }
  if (previousIsBlocker && !rollbackExists) {
    throw new Error("Graph v4 migration found a v3 retirement blocker without its rollback artifact.");
  }
  if (!previousIsBlocker && rollbackExists && !filesEqual(paths.previous_path, paths.rollback_path)) {
    throw new Error("Graph v4 migration found a conflicting v3 rollback artifact.");
  }
  if (targetExists) {
    if (!previousIsBlocker) {
      throw new Error("Graph v4 migration found a conflicting target before v3 retirement.");
    }
    input.onDiagnostic?.({ phase: "validate_target", paths });
    validateV4Store(paths.canonical_path, input.validateV4);
    if (!previousClaimComplete) assertEmptyV4Store(paths.canonical_path);
  }

  if (!previousIsBlocker) {
    validateV3Store(paths.previous_path);
    checkpointPreviousStore(paths.previous_path);
    assertNoSQLiteSidecars(paths.previous_path);
    retainRollbackArtifact(paths.previous_path, paths.rollback_path);
    input.onDiagnostic?.({ phase: "backup", paths });
    input.barrier?.("rollback_artifact_retained");
    publishPreviousBlocker(paths.previous_path);
    input.onDiagnostic?.({ phase: "block", paths });
    input.barrier?.("previous_store_blocked");
  } else {
    validateV3Store(paths.rollback_path);
  }

  let claimed = false;
  if (!fs.existsSync(paths.canonical_path)) {
    claimEmptyV4Store(paths.canonical_path, input.initializeEmpty, input.validateV4);
    claimed = true;
    input.onDiagnostic?.({ phase: "claim", paths });
    input.barrier?.("v4_store_linked");
  }
  validateV4Store(paths.canonical_path, input.validateV4);
  if (!previousClaimComplete) {
    assertEmptyV4Store(paths.canonical_path);
    publishPreviousBlocker(paths.previous_path, true);
    input.barrier?.("v4_store_claimed");
  }
  input.onDiagnostic?.({ phase: "complete", paths });
  return { outcome: claimed ? "migrated" : "already_current", paths };
}

function assertCanonicalV4Path(paths: GraphStoreV4MigrationPaths): void {
  if (path.basename(paths.canonical_path) !== GRAPH_STORE_FILE_NAME) {
    throw new Error(`Graph v4 migration requires canonical ${GRAPH_STORE_FILE_NAME}.`);
  }
}

/** Reject redirected cache artifacts before any SQLite or ownership reads. */
function assertCanonicalArtifactPaths(paths: GraphStoreV4MigrationPaths): void {
  const parent = path.resolve(path.dirname(paths.canonical_path));
  if (fs.realpathSync(parent) !== parent) {
    throw new Error("Graph store migration requires a canonical cache directory without symbolic links.");
  }
  for (const artifact of Object.values(paths)) {
    assertRegularArtifact(artifact);
    assertRegularArtifact(`${artifact}-wal`);
    assertRegularArtifact(`${artifact}-shm`);
  }
}

function assertRegularArtifact(filePath: string): void {
  let stat: fs.Stats;
  try { stat = fs.lstatSync(filePath); } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("Graph store artifacts must be regular files, not symbolic links.");
  }
}

function assertActiveOwnershipAdmission(
  admission: RepositoryOwnershipAdmission,
  ownershipPath: string
): asserts admission is Extract<RepositoryOwnershipAdmission, { outcome: "acquired" }> {
  if (admission.outcome !== "acquired") {
    throw new Error("Graph v4 migration requires an acquired repository ownership admission.");
  }
  const diskLease = readOwnershipLease(ownershipPath);
  if (diskLease === undefined || !sameActiveLease(diskLease, admission.lease)) {
    throw new Error("Graph v4 migration requires the on-disk ownership admission for the active process.");
  }
}

function readOwnershipLease(ownershipPath: string): RepositoryOwnershipLease | undefined {
  try {
    const value: unknown = JSON.parse(fs.readFileSync(ownershipPath, "utf8"));
    if (value === null || typeof value !== "object") return undefined;
    const candidate = value as Partial<RepositoryOwnershipLease>;
    if (
      candidate.state !== "active" || typeof candidate.repo_root !== "string" ||
      typeof candidate.runtime_identity !== "string" || typeof candidate.schema_version !== "number" ||
      typeof candidate.owner_id !== "string" || typeof candidate.owner_pid !== "number" ||
      typeof candidate.owner_generation !== "number" || typeof candidate.heartbeat_at !== "string"
    ) return undefined;
    return candidate as RepositoryOwnershipLease;
  } catch {
    return undefined;
  }
}

function sameActiveLease(onDisk: RepositoryOwnershipLease, active: RepositoryOwnershipLease): boolean {
  return onDisk.state === "active" && active.state === "active" &&
    onDisk.repo_root === active.repo_root && onDisk.runtime_identity === active.runtime_identity &&
    onDisk.schema_version === active.schema_version && onDisk.owner_id === active.owner_id &&
    onDisk.owner_pid === active.owner_pid && onDisk.owner_generation === active.owner_generation &&
    onDisk.heartbeat_at === active.heartbeat_at;
}

function validateV3Store(databasePath: string): void {
  assertRegularArtifact(databasePath);
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const marker = database.prepare("SELECT MAX(version) AS version FROM schema_migrations")
      .get() as { version: number | null };
    if (marker.version !== 3) throw new Error("Graph v4 migration requires a complete v3 source store.");
    const integrity = database.pragma("quick_check") as Array<{ quick_check: string }>;
    if (integrity.length !== 1 || integrity[0]?.quick_check !== "ok") {
      throw new Error("Graph v4 migration source failed SQLite integrity validation.");
    }
  } finally {
    database.close();
  }
}

function checkpointPreviousStore(databasePath: string): void {
  const database = new Database(databasePath, { fileMustExist: true });
  try {
    database.pragma("busy_timeout = 0");
    const checkpoint = database.pragma("wal_checkpoint(TRUNCATE)") as Array<{
      busy: number; log: number; checkpointed: number;
    }>;
    if (checkpoint.some((entry) => entry.busy !== 0 || entry.log !== entry.checkpointed)) {
      throw new Error("Graph v4 migration is blocked by active v3 SQLite ownership.");
    }
  } finally {
    database.close();
  }
}

function assertNoSQLiteSidecars(databasePath: string): void {
  if (fs.existsSync(`${databasePath}-wal`) || fs.existsSync(`${databasePath}-shm`)) {
    throw new Error("Graph v4 migration is blocked by retained v3 SQLite sidecar evidence.");
  }
}

function retainRollbackArtifact(previousPath: string, rollbackPath: string): void {
  if (fs.existsSync(rollbackPath)) {
    if (!filesEqual(previousPath, rollbackPath)) {
      throw new Error("Graph v4 migration found a conflicting v3 rollback artifact.");
    }
    validateV3Store(rollbackPath);
    return;
  }
  const temporaryPath = `${rollbackPath}.temporary-${process.pid}-${randomUUID()}`;
  try {
    fs.copyFileSync(previousPath, temporaryPath, fs.constants.COPYFILE_EXCL);
    fsyncFile(temporaryPath);
    validateV3Store(temporaryPath);
    try {
      fs.linkSync(temporaryPath, rollbackPath);
    } catch (error) {
      if (!isAlreadyExistsError(error)) throw error;
      if (!filesEqual(previousPath, rollbackPath)) {
        throw new Error("Graph v4 migration found a conflicting v3 rollback artifact.");
      }
    }
    fsyncDirectory(path.dirname(rollbackPath));
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function publishPreviousBlocker(previousPath: string, claimed = false): void {
  const temporaryPath = `${previousPath}.block-${process.pid}-${randomUUID()}`;
  try {
    const descriptor = fs.openSync(temporaryPath, "wx", 0o600);
    try {
      fs.writeFileSync(descriptor, claimed ? PREVIOUS_GRAPH_STORE_CLAIMED_BLOCKER : PREVIOUS_GRAPH_STORE_BLOCKER);
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(temporaryPath, previousPath);
    fsyncDirectory(path.dirname(previousPath));
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function claimEmptyV4Store(
  canonicalPath: string,
  initializeEmpty: (temporaryPath: string) => void,
  validateV4: (databasePath: string) => void
): void {
  const temporaryPath = path.join(
    path.dirname(canonicalPath), `.${GRAPH_STORE_FILE_NAME}.empty-${process.pid}-${randomUUID()}`
  );
  try {
    initializeEmpty(temporaryPath);
    if (!fs.statSync(temporaryPath).isFile()) {
      throw new Error("Graph v4 migration initializer did not create a regular candidate file.");
    }
    assertNoSQLiteSidecars(temporaryPath);
    validateV4Store(temporaryPath, validateV4);
    assertEmptyV4Store(temporaryPath);
    fsyncFile(temporaryPath);
    try {
      fs.linkSync(temporaryPath, canonicalPath);
    } catch (error) {
      if (!isAlreadyExistsError(error)) throw error;
      validateV4Store(canonicalPath, validateV4);
      assertEmptyV4Store(canonicalPath);
    }
    fsyncDirectory(path.dirname(canonicalPath));
  } finally {
    fs.rmSync(temporaryPath, { force: true });
    fs.rmSync(`${temporaryPath}-wal`, { force: true });
    fs.rmSync(`${temporaryPath}-shm`, { force: true });
  }
}

function validateV4Store(databasePath: string, validateV4: (databasePath: string) => void): void {
  assertRegularArtifact(databasePath);
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const marker = database.prepare("SELECT MAX(version) AS version FROM schema_migrations")
      .get() as { version: number | null };
    if (marker.version !== GRAPH_STORE_IDENTITY_VERSION) {
      throw new Error("Graph v4 migration found a target with an incompatible schema identity.");
    }
    const integrity = database.pragma("quick_check") as Array<{ quick_check: string }>;
    if (integrity.length !== 1 || integrity[0]?.quick_check !== "ok") {
      throw new Error("Graph v4 migration target failed SQLite integrity validation.");
    }
  } finally {
    database.close();
  }
  validateV4(databasePath);
}

function assertEmptyV4Store(databasePath: string): void {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    assertV4DerivedStoreEmpty(database);
  } finally {
    database.close();
  }
}

function assertV4DerivedStoreEmpty(database: Database.Database): void {
  for (const table of ["snapshots", "graph_build_progress", "snapshot_index_coverage"]) {
    const exists = database.prepare(`
      SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?
    `).get(table) as { present: number } | undefined;
    if (exists === undefined) continue;
    const count = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
    if (count.count !== 0) {
      throw new Error(`Graph v4 migration target must be empty; ${table} contains derived evidence.`);
    }
  }
}

function isPreviousBlocker(previousPath: string, claimedOnly = false): boolean {
  const stat = fs.lstatSync(previousPath);
  if (!stat.isFile() || stat.isSymbolicLink()) return false;
  if (stat.size !== PREVIOUS_GRAPH_STORE_BLOCKER.length && stat.size !== PREVIOUS_GRAPH_STORE_CLAIMED_BLOCKER.length) return false;
  const content = fs.readFileSync(previousPath);
  return content.equals(PREVIOUS_GRAPH_STORE_CLAIMED_BLOCKER) || (!claimedOnly && content.equals(PREVIOUS_GRAPH_STORE_BLOCKER));
}

function filesEqual(leftPath: string, rightPath: string): boolean {
  const leftStat = fs.statSync(leftPath);
  const rightStat = fs.statSync(rightPath);
  if (leftStat.size !== rightStat.size) return false;
  const left = fs.openSync(leftPath, "r");
  const right = fs.openSync(rightPath, "r");
  const leftBuffer = Buffer.allocUnsafe(64 * 1024);
  const rightBuffer = Buffer.allocUnsafe(64 * 1024);
  try {
    let position = 0;
    while (position < leftStat.size) {
      const length = Math.min(leftBuffer.length, leftStat.size - position);
      const leftRead = fs.readSync(left, leftBuffer, 0, length, position);
      const rightRead = fs.readSync(right, rightBuffer, 0, length, position);
      if (leftRead === 0 || rightRead === 0 || leftRead !== rightRead ||
        !leftBuffer.subarray(0, leftRead).equals(rightBuffer.subarray(0, rightRead))) return false;
      position += leftRead;
    }
    return true;
  } finally {
    fs.closeSync(left);
    fs.closeSync(right);
  }
}

function isAlreadyExistsError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

function fsyncFile(filePath: string): void {
  const descriptor = fs.openSync(filePath, "r");
  try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
}

function fsyncDirectory(directoryPath: string): void {
  // Windows does not provide a directory file descriptor that Node can fsync.
  if (process.platform === "win32") return;
  const descriptor = fs.openSync(directoryPath, "r");
  try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
}
