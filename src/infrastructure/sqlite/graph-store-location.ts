/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export const GRAPH_STORE_IDENTITY_VERSION = 2;
export const GRAPH_STORE_FILE_NAME = `graph-v${GRAPH_STORE_IDENTITY_VERSION}.sqlite`;
export const LEGACY_GRAPH_STORE_FILE_NAME = "graph.sqlite";
export const LEGACY_GRAPH_STORE_BACKUP_FILE_NAME = "graph-v1.sqlite.pre-v2";
const LEGACY_GRAPH_STORE_BLOCKER = Buffer.from(
  "Agent Workbench graph store retired by schema identity v2.\n",
  "utf8"
);

export function graphStorePath(repoRoot: string): string {
  const cacheDir = path.join(repoRoot, ".cache", "agent-workbench");
  fs.mkdirSync(cacheDir, { recursive: true });
  return path.join(cacheDir, GRAPH_STORE_FILE_NAME);
}

export function seedVersionedGraphStore(databasePath: string): void {
  if (path.basename(databasePath) !== GRAPH_STORE_FILE_NAME || fs.existsSync(databasePath)) {
    return;
  }

  const legacyPath = path.join(path.dirname(databasePath), LEGACY_GRAPH_STORE_FILE_NAME);
  if (!fs.existsSync(legacyPath)) {
    return;
  }

  const temporaryPath = path.join(
    path.dirname(databasePath),
    `.${GRAPH_STORE_FILE_NAME}.seed-${process.pid}-${randomUUID()}`
  );
  const legacy = new Database(legacyPath, { readonly: true, fileMustExist: true });
  try {
    try {
      legacy.prepare("VACUUM INTO ?").run(temporaryPath);
    } catch (error) {
      fs.rmSync(temporaryPath, { force: true });
      throw error;
    }
  } finally {
    legacy.close();
  }
  try {
    fsyncFile(temporaryPath);
    try {
      fs.linkSync(temporaryPath, databasePath);
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }
    }
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

export function retireLegacyGraphStore(databasePath: string): void {
  if (path.basename(databasePath) !== GRAPH_STORE_FILE_NAME) {
    return;
  }
  assertVersionedStoreReady(databasePath);
  const cacheDirectory = path.dirname(databasePath);
  const legacyPath = path.join(cacheDirectory, LEGACY_GRAPH_STORE_FILE_NAME);
  const backupPath = path.join(cacheDirectory, LEGACY_GRAPH_STORE_BACKUP_FILE_NAME);
  if (fs.existsSync(legacyPath) && isLegacyBlocker(legacyPath)) {
    if (!fs.existsSync(backupPath)) {
      throw new Error("Legacy graph store blocker is missing its rollback artifact.");
    }
    return;
  }
  if (!fs.existsSync(legacyPath)) {
    if (!fs.existsSync(backupPath)) return;
    publishLegacyBlocker(legacyPath);
    return;
  }

  const legacy = new Database(legacyPath, { fileMustExist: true });
  try {
    const checkpoint = legacy.pragma("wal_checkpoint(TRUNCATE)") as Array<{
      busy: number;
      log: number;
      checkpointed: number;
    }>;
    if (checkpoint.some((entry) => entry.busy !== 0 || entry.log !== entry.checkpointed)) {
      throw new Error("Legacy graph store retirement is blocked by active SQLite ownership.");
    }
  } finally {
    legacy.close();
  }

  if (fs.existsSync(backupPath)) {
    if (!filesEqual(backupPath, legacyPath)) {
      throw new Error("Legacy graph store retirement found a conflicting rollback artifact.");
    }
  } else {
    const temporaryBackupPath = `${backupPath}.seed-${process.pid}-${randomUUID()}`;
    try {
      fs.copyFileSync(legacyPath, temporaryBackupPath, fs.constants.COPYFILE_EXCL);
      fsyncFile(temporaryBackupPath);
      fs.linkSync(temporaryBackupPath, backupPath);
    } finally {
      fs.rmSync(temporaryBackupPath, { force: true });
    }
  }
  publishLegacyBlocker(legacyPath);
}

function assertVersionedStoreReady(databasePath: string): void {
  if (!fs.existsSync(databasePath)) {
    throw new Error("Legacy graph store retirement requires a published versioned store.");
  }
  const versioned = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const marker = versioned.prepare(`
      SELECT MAX(version) AS version FROM schema_migrations
    `).get() as { version: number | null };
    if (marker.version !== GRAPH_STORE_IDENTITY_VERSION) {
      throw new Error("Legacy graph store retirement requires the current versioned schema.");
    }
  } finally {
    versioned.close();
  }
}

function publishLegacyBlocker(legacyPath: string): void {
  const temporaryBlockerPath = `${legacyPath}.block-${process.pid}-${randomUUID()}`;
  try {
    const descriptor = fs.openSync(temporaryBlockerPath, "wx", 0o600);
    try {
      fs.writeFileSync(descriptor, LEGACY_GRAPH_STORE_BLOCKER);
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(temporaryBlockerPath, legacyPath);
  } finally {
    fs.rmSync(temporaryBlockerPath, { force: true });
  }
  fs.rmSync(`${legacyPath}-wal`, { force: true });
  fs.rmSync(`${legacyPath}-shm`, { force: true });
}

function isLegacyBlocker(legacyPath: string): boolean {
  const stat = fs.statSync(legacyPath);
  return stat.isFile() && stat.size === LEGACY_GRAPH_STORE_BLOCKER.length &&
    fs.readFileSync(legacyPath).equals(LEGACY_GRAPH_STORE_BLOCKER);
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
      if (
        leftRead === 0 ||
        rightRead === 0 ||
        leftRead !== rightRead ||
        !leftBuffer.subarray(0, leftRead).equals(rightBuffer.subarray(0, rightRead))
      ) {
        return false;
      }
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
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}
