/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import {
  startupGuardRecoveryRequestSchema,
  startupGuardRecoveryExitCode,
  STARTUP_GUARD_RECOVERY_SQLITE_APPLICATION_ID,
  STARTUP_GUARD_RECOVERY_SQLITE_USER_VERSION,
  type StartupGuardOwnerScope,
  type StartupGuardRecoveryExpected,
  type StartupGuardRecoveryRequest,
  type StartupGuardRecoveryOutcome
} from "../../contracts/startup-guard-recovery-contracts.js";
import { currentStartupGuardOwnerScope } from "./startup-guard-scope.js";

const MAX_GUARD_BYTES = 4096;
const PRIVATE_MODE = 0o600;
const PRIVATE_DIRECTORY_MODE = 0o700;

type StartupGuardRecoveryStatement = {
  all: (...parameters: unknown[]) => unknown[];
  get: (...parameters: unknown[]) => unknown;
  run: (...parameters: unknown[]) => unknown;
};

export type StartupGuardRecoveryDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => StartupGuardRecoveryStatement;
  close: () => void;
};

export type StartupGuardRecoveryDatabaseConstructor = new (
  filename: string,
  options?: { timeout?: number; fileMustExist?: boolean }
) => StartupGuardRecoveryDatabase;

export type StartupGuardProcessState = "dead" | "live" | "unknown";

export type StartupGuardRecoveryDependencies = {
  database_constructor: StartupGuardRecoveryDatabaseConstructor;
  process_state?: (pid: number) => StartupGuardProcessState;
  owner_scope?: () => StartupGuardOwnerScope | undefined;
};

export type StartupGuardRecoveryResult = {
  outcome: StartupGuardRecoveryOutcome;
  code: number;
};

type GuardSnapshot = {
  identity: { dev: string; ino: string };
  expected: StartupGuardRecoveryExpected;
};

export function recoverStartupGuard(
  input: StartupGuardRecoveryRequest,
  dependencies: StartupGuardRecoveryDependencies
): StartupGuardRecoveryResult {
  const parsed = startupGuardRecoveryRequestSchema.safeParse(input);
  if (!parsed.success) return result("ambiguous");
  const request = parsed.data;
  if (!path.isAbsolute(request.guard_path) || !isReclaimPath(request.guard_path)) {
    return result("ambiguous");
  }

  const ownerScope = Object.hasOwn(dependencies, "owner_scope")
    ? dependencies.owner_scope?.()
    : currentStartupGuardOwnerScope();
  if (request.expected.owner_scope === undefined || ownerScope === undefined ||
      !sameScope(request.expected.owner_scope, ownerScope)) {
    return result("ambiguous");
  }

  const parentDirectory = path.dirname(request.guard_path);
  if (!isPrivateDirectory(parentDirectory)) return result("ambiguous");
  const guardStorage = validateGuardStorage(request.guard_path);
  if (guardStorage === false) return result("ambiguous");

  const databasePath = `${request.guard_path}.sqlite`;
  const databaseIdentity = prepareDatabaseStorage(databasePath, parentDirectory);
  if (databaseIdentity === false) return result("ambiguous");
  if (!validateJournalStorage(databasePath)) return result("ambiguous");

  let database: StartupGuardRecoveryDatabase;
  try {
    database = new dependencies.database_constructor(databasePath, {
      timeout: 0,
      fileMustExist: true
    });
  } catch (error) {
    return result(classifyDatabaseFailure(error));
  }

  let transactionStarted = false;
  try {
    if (!sameIdentity(readDatabaseIdentity(databasePath), databaseIdentity) ||
        !validateJournalStorage(databasePath)) return result("ambiguous");
    database.exec("BEGIN EXCLUSIVE");
    transactionStarted = true;
    if (!validateOrInitializeDatabaseMarker(database)) {
      database.exec("ROLLBACK");
      transactionStarted = false;
      return result("ambiguous");
    }

    const current = readGuardSnapshot(request.guard_path);
    if (current === undefined) {
      database.exec("COMMIT");
      transactionStarted = false;
      return result("already_recovered");
    }
    if (current === "ambiguous" || !sameExpected(current.expected, request.expected) ||
        !sameIdentity(current.identity, request.expected)) {
      database.exec("ROLLBACK");
      transactionStarted = false;
      return result("ambiguous");
    }

    const processState = (dependencies.process_state ?? currentProcessState)(request.expected.pid);
    if (processState !== "dead") {
      database.exec("ROLLBACK");
      transactionStarted = false;
      return result(processState === "live" ? "busy" : "ambiguous");
    }

    const rechecked = readGuardSnapshot(request.guard_path);
    if (rechecked === undefined) {
      database.exec("COMMIT");
      transactionStarted = false;
      return result("already_recovered");
    }
    if (rechecked === "ambiguous" || !sameExpected(rechecked.expected, request.expected) ||
        !sameIdentity(rechecked.identity, request.expected)) {
      database.exec("ROLLBACK");
      transactionStarted = false;
      return result("ambiguous");
    }
    if (!sameIdentity(readDatabaseIdentity(databasePath), databaseIdentity) ||
        !validateJournalStorage(databasePath)) {
      database.exec("ROLLBACK");
      transactionStarted = false;
      return result("ambiguous");
    }

    try {
      fs.unlinkSync(request.guard_path);
    } catch (error) {
      if (isMissingFileError(error)) {
        database.exec("COMMIT");
        transactionStarted = false;
        return result("already_recovered");
      }
      database.exec("ROLLBACK");
      transactionStarted = false;
      return result("ambiguous");
    }
    database.exec("COMMIT");
    transactionStarted = false;
    return result("recovered");
  } catch (error) {
    if (transactionStarted) {
      try { database.exec("ROLLBACK"); } catch {}
    }
    return result(classifyDatabaseFailure(error));
  } finally {
    try { database.close(); } catch {}
  }
}

function readGuardSnapshot(guardPath: string): GuardSnapshot | undefined | "ambiguous" {
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(guardPath, fs.constants.O_RDONLY | noFollowFlag());
    const stat = fs.fstatSync(descriptor, { bigint: true });
    if (!stat.isFile()) return "ambiguous";
    const mode = Number(stat.mode & 0o777n);
    if (mode !== PRIVATE_MODE) return "ambiguous";
    const buffer = Buffer.alloc(MAX_GUARD_BYTES + 1);
    const bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, 0);
    if (bytesRead > MAX_GUARD_BYTES) return "ambiguous";
    let parsed: unknown;
    try {
      parsed = JSON.parse(buffer.subarray(0, bytesRead).toString("utf8"));
    } catch {
      return "ambiguous";
    }
    if (typeof parsed !== "object" || parsed === null) return "ambiguous";
    const value = parsed as Record<string, unknown>;
    if (
      typeof value.pid !== "number" || !Number.isInteger(value.pid) || value.pid <= 0 ||
      typeof value.created_at !== "string" || typeof value.token !== "string" ||
      typeof value.owner_scope !== "object" || value.owner_scope === null
    ) return "ambiguous";
    const ownerScope = value.owner_scope as Record<string, unknown>;
    if (
      ownerScope.kind !== "linux-pid-namespace-v1" ||
      typeof ownerScope.fingerprint !== "string" ||
      !/^[0-9a-f]{64}$/u.test(ownerScope.fingerprint)
    ) return "ambiguous";
    return {
      identity: { dev: String(stat.dev), ino: String(stat.ino) },
      expected: {
        dev: String(stat.dev),
        ino: String(stat.ino),
        pid: value.pid,
        created_at: value.created_at,
        token: value.token,
        owner_scope: {
          kind: "linux-pid-namespace-v1",
          fingerprint: ownerScope.fingerprint
        }
      }
    };
  } catch (error) {
    if (isMissingFileError(error)) return undefined;
    return "ambiguous";
  } finally {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch {}
    }
  }
}

function prepareDatabaseStorage(
  databasePath: string,
  parentDirectory: string
): { dev: string; ino: string } | false {
  try {
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(databasePath);
    } catch (error) {
      if (!isMissingFileError(error)) return false;
      try {
        const descriptor = fs.openSync(
          databasePath,
          fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR | noFollowFlag(),
          PRIVATE_MODE
        );
        fs.closeSync(descriptor);
      } catch (createError) {
        if (!isFileExistsError(createError)) return false;
      }
      stat = fs.lstatSync(databasePath);
    }
    if (!stat.isFile() || stat.mode !== (fs.constants.S_IFREG | PRIVATE_MODE)) return false;
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) return false;
    if (stat.mode & 0o077) return false;
    if (!isPrivateDirectory(parentDirectory)) return false;
    return readDatabaseIdentity(databasePath) ?? false;
  } catch {
    return false;
  }
}

function readDatabaseIdentity(databasePath: string): { dev: string; ino: string } | undefined {
  try {
    const stat = fs.lstatSync(databasePath, { bigint: true });
    if (!stat.isFile() || Number(stat.mode & 0o777n) !== PRIVATE_MODE) return undefined;
    if (typeof process.getuid === "function" && Number(stat.uid) !== process.getuid()) return undefined;
    return { dev: String(stat.dev), ino: String(stat.ino) };
  } catch {
    return undefined;
  }
}

function validateGuardStorage(guardPath: string): boolean | "missing" {
  try {
    const stat = fs.lstatSync(guardPath);
    if (!stat.isFile() || stat.mode !== (fs.constants.S_IFREG | PRIVATE_MODE)) return false;
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) return false;
    return (stat.mode & 0o077) === 0;
  } catch (error) {
    return isMissingFileError(error) ? "missing" : false;
  }
}

function validateJournalStorage(databasePath: string): boolean {
  for (const suffix of ["-journal", "-wal", "-shm"]) {
    try {
      const stat = fs.lstatSync(`${databasePath}${suffix}`);
      if (stat.isSymbolicLink() || !stat.isFile() ||
          stat.mode !== (fs.constants.S_IFREG | PRIVATE_MODE)) return false;
      if (typeof process.getuid === "function" && stat.uid !== process.getuid()) return false;
    } catch (error) {
      if (!isMissingFileError(error)) return false;
    }
  }
  return true;
}

function validateOrInitializeDatabaseMarker(database: StartupGuardRecoveryDatabase): boolean {
  try {
    const applicationId = readPragmaInteger(database, "application_id");
    const userVersion = readPragmaInteger(database, "user_version");
    const tableCount = readScalarInteger(
      database.prepare("SELECT COUNT(*) AS count FROM sqlite_master").get()
    );
    if (applicationId === undefined || userVersion === undefined || tableCount === undefined) {
      return false;
    }
    if (applicationId === 0 && userVersion === 0 && tableCount === 0) {
      database.exec(`PRAGMA application_id = ${STARTUP_GUARD_RECOVERY_SQLITE_APPLICATION_ID}`);
      database.exec(`PRAGMA user_version = ${STARTUP_GUARD_RECOVERY_SQLITE_USER_VERSION}`);
      return readPragmaInteger(database, "application_id") === STARTUP_GUARD_RECOVERY_SQLITE_APPLICATION_ID &&
        readPragmaInteger(database, "user_version") === STARTUP_GUARD_RECOVERY_SQLITE_USER_VERSION;
    }
    return applicationId === STARTUP_GUARD_RECOVERY_SQLITE_APPLICATION_ID &&
      userVersion === STARTUP_GUARD_RECOVERY_SQLITE_USER_VERSION && tableCount === 0;
  } catch {
    return false;
  }
}

function readPragmaInteger(
  database: StartupGuardRecoveryDatabase,
  name: "application_id" | "user_version"
): number | undefined {
  return readScalarInteger(database.prepare(`PRAGMA ${name}`).get());
}

function readScalarInteger(value: unknown): number | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const values = Object.values(value as Record<string, unknown>);
  return values.length === 1 && typeof values[0] === "number" && Number.isInteger(values[0])
    ? values[0]
    : undefined;
}

function isPrivateDirectory(directory: string): boolean {
  try {
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return false;
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) return false;
    return (stat.mode & 0o777) === PRIVATE_DIRECTORY_MODE;
  } catch {
    return false;
  }
}

function sameExpected(left: StartupGuardRecoveryExpected, right: StartupGuardRecoveryExpected): boolean {
  return sameIdentity(left, right) && left.pid === right.pid &&
    left.token === right.token && left.created_at === right.created_at &&
    left.owner_scope !== undefined && right.owner_scope !== undefined &&
    sameScope(left.owner_scope, right.owner_scope);
}

function sameIdentity(
  left: { dev: string; ino: string } | undefined,
  right: { dev: string; ino: string }
): boolean {
  return left !== undefined && left.dev === right.dev && left.ino === right.ino;
}

function sameScope(left: StartupGuardOwnerScope, right: StartupGuardOwnerScope): boolean {
  return left.kind === right.kind && left.fingerprint === right.fingerprint;
}

function currentProcessState(pid: number): StartupGuardProcessState {
  if (pid === process.pid) return "live";
  try {
    process.kill(pid, 0);
    return "live";
  } catch (error) {
    return errorCode(error) === "ESRCH" ? "dead" : "unknown";
  }
}

function classifyDatabaseFailure(
  error: unknown
): "busy" | "ambiguous" | "native_module_rebuild_required" {
  const code = errorCode(error);
  if (code === "SQLITE_BUSY" || code === "SQLITE_LOCKED") return "busy";
  if (isNativeModuleFailure(error)) return "native_module_rebuild_required";
  return "ambiguous";
}

function isNativeModuleFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\.node\b|ERR_DLOPEN|node-gyp|node_gyp_build|better-sqlite3|was compiled against|NODE_MODULE_VERSION|invalid ELF|Module did not self-register/iu.test(message);
}

function result(outcome: StartupGuardRecoveryOutcome): StartupGuardRecoveryResult {
  return {
    outcome,
    code: startupGuardRecoveryExitCode(outcome)
  };
}

function isReclaimPath(filePath: string): boolean {
  return path.basename(filePath).endsWith(".reclaim");
}

function noFollowFlag(): number {
  return fs.constants.O_NOFOLLOW ?? 0;
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function isMissingFileError(error: unknown): boolean {
  return errorCode(error) === "ENOENT";
}

function isFileExistsError(error: unknown): boolean {
  return errorCode(error) === "EEXIST";
}
