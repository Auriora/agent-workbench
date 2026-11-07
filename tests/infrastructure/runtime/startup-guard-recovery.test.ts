/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import {
  MAX_STARTUP_GUARD_RECOVERY_REQUEST_BYTES,
  STARTUP_GUARD_RECOVERY_EXIT_CODES,
  STARTUP_GUARD_RECOVERY_SQLITE_APPLICATION_ID,
  STARTUP_GUARD_RECOVERY_SQLITE_USER_VERSION,
  type StartupGuardRecoveryRequest
} from "../../../src/contracts/startup-guard-recovery-contracts.js";
import { currentStartupGuardOwnerScope } from "../../../src/infrastructure/runtime/startup-guard-scope.js";
import {
  recoverStartupGuard,
  type StartupGuardRecoveryDatabaseConstructor
} from "../../../src/infrastructure/runtime/startup-guard-recovery.js";

type HelperResult = { code: number | null; stdout: string; stderr: string };

const temporaryDirectories: string[] = [];
const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const helperEntrypoint = path.join(
  repositoryRoot,
  "src/mcp/startup-guard-recovery-entrypoint.mjs"
);
const crashFixtureEntrypoint = path.join(
  repositoryRoot,
  "tests/fixtures/startup-guard-recovery-crash.mjs"
);

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

const describeLinux = process.platform === "linux" ? describe : describe.skip;

describeLinux("startup guard recovery helper", () => {
  it("recovers one dead guard and reports an already-recovered second call", async () => {
    const scope = currentStartupGuardOwnerScope();
    expect(scope).toBeDefined();
    const directory = createPrivateDirectory();
    const guardPath = path.join(directory, "startup.lock.reclaim");
    const deadPid = await exitedProcessPid();
    const request = createGuardRequest(guardPath, deadPid, scope!);

    await expect(runHelper(request)).resolves.toMatchObject({
      code: STARTUP_GUARD_RECOVERY_EXIT_CODES.recovered,
      stdout: "",
      stderr: ""
    });
    expect(fs.existsSync(guardPath)).toBe(false);
    expect(fs.statSync(`${guardPath}.sqlite`).mode & 0o777).toBe(0o600);

    await expect(runHelper(request)).resolves.toMatchObject({
      code: STARTUP_GUARD_RECOVERY_EXIT_CODES.already_recovered,
      stdout: "",
      stderr: ""
    });

    const replacementPid = await exitedProcessPid();
    const replacementRequest = createGuardRequest(guardPath, replacementPid, scope!);
    await expect(runHelper(replacementRequest)).resolves.toMatchObject({
      code: STARTUP_GUARD_RECOVERY_EXIT_CODES.recovered
    });
  });

  it("returns known-busy for a live owner without deleting the guard", async () => {
    const scope = currentStartupGuardOwnerScope();
    expect(scope).toBeDefined();
    const directory = createPrivateDirectory();
    const guardPath = path.join(directory, "live.lock.reclaim");
    const request = createGuardRequest(guardPath, process.pid, scope!);

    await expect(runHelper(request)).resolves.toMatchObject({
      code: STARTUP_GUARD_RECOVERY_EXIT_CODES.busy,
      stdout: "",
      stderr: ""
    });
    expect(fs.existsSync(guardPath)).toBe(true);
  });

  it("blocks replacement, legacy and foreign-scope evidence", async () => {
    const scope = currentStartupGuardOwnerScope();
    expect(scope).toBeDefined();
    const directory = createPrivateDirectory();
    const guardPath = path.join(directory, "replacement.lock.reclaim");
    const deadPid = await exitedProcessPid();
    const request = createGuardRequest(guardPath, deadPid, scope!);
    fs.unlinkSync(guardPath);
    writeGuard(guardPath, {
      pid: deadPid,
      created_at: "2026-11-06T00:00:01.000Z",
      token: "replacement",
      owner_scope: scope
    });

    await expect(runHelper(request)).resolves.toMatchObject({
      code: STARTUP_GUARD_RECOVERY_EXIT_CODES.ambiguous
    });
    expect(fs.existsSync(guardPath)).toBe(true);

    const legacyPath = path.join(directory, "legacy.lock.reclaim");
    const legacyRequest = createGuardRequest(legacyPath, deadPid, scope!);
    const legacyPayload = JSON.parse(fs.readFileSync(legacyPath, "utf8")) as Record<string, unknown>;
    delete legacyPayload.owner_scope;
    writeGuard(legacyPath, legacyPayload);
    await expect(runHelper(legacyRequest)).resolves.toMatchObject({
      code: STARTUP_GUARD_RECOVERY_EXIT_CODES.ambiguous
    });

    const foreignPath = path.join(directory, "foreign.lock.reclaim");
    const foreignScope = { ...scope!, fingerprint: "0".repeat(64) };
    const foreignRequest = createGuardRequest(foreignPath, deadPid, foreignScope);
    await expect(runHelper(foreignRequest)).resolves.toMatchObject({
      code: STARTUP_GUARD_RECOVERY_EXIT_CODES.ambiguous
    });
    expect(fs.existsSync(foreignPath)).toBe(true);
  });

  it("blocks corrupt and symlinked permanent exclusion storage", async () => {
    const scope = currentStartupGuardOwnerScope();
    expect(scope).toBeDefined();
    const directory = createPrivateDirectory();
    const deadPid = await exitedProcessPid();
    const corruptPath = path.join(directory, "corrupt.lock.reclaim");
    const corruptRequest = createGuardRequest(corruptPath, deadPid, scope!);
    fs.writeFileSync(`${corruptPath}.sqlite`, "not sqlite\n", { mode: 0o600 });
    await expect(runHelper(corruptRequest)).resolves.toMatchObject({
      code: STARTUP_GUARD_RECOVERY_EXIT_CODES.ambiguous
    });
    expect(fs.existsSync(corruptPath)).toBe(true);

    const symlinkPath = path.join(directory, "symlink.lock.reclaim");
    const symlinkRequest = createGuardRequest(symlinkPath, deadPid, scope!);
    const target = path.join(directory, "target.sqlite");
    fs.writeFileSync(target, "", { mode: 0o600 });
    fs.symlinkSync(target, `${symlinkPath}.sqlite`);
    await expect(runHelper(symlinkRequest)).resolves.toMatchObject({
      code: STARTUP_GUARD_RECOVERY_EXIT_CODES.ambiguous
    });
    expect(fs.existsSync(symlinkPath)).toBe(true);

    const journalPath = path.join(directory, "unsafe-journal.lock.reclaim");
    const journalRequest = createGuardRequest(journalPath, deadPid, scope!);
    fs.writeFileSync(`${journalPath}.sqlite-journal`, "unsafe\n", { mode: 0o640 });
    fs.chmodSync(`${journalPath}.sqlite-journal`, 0o640);
    await expect(runHelper(journalRequest)).resolves.toMatchObject({
      code: STARTUP_GUARD_RECOVERY_EXIT_CODES.ambiguous
    });
    expect(fs.existsSync(journalPath)).toBe(true);
  });

  it("rejects an unrelated nonempty SQLite database before mutation", async () => {
    const scope = currentStartupGuardOwnerScope();
    expect(scope).toBeDefined();
    const directory = createPrivateDirectory();
    const guardPath = path.join(directory, "unrelated.lock.reclaim");
    const deadPid = await exitedProcessPid();
    const request = createGuardRequest(guardPath, deadPid, scope!);
    const databasePath = `${guardPath}.sqlite`;
    const database = new Database(databasePath);
    database.exec("CREATE TABLE unrelated (value TEXT NOT NULL)");
    database.close();
    fs.chmodSync(databasePath, 0o600);

    await expect(runHelper(request)).resolves.toMatchObject({
      code: STARTUP_GUARD_RECOVERY_EXIT_CODES.ambiguous
    });
    expect(fs.existsSync(guardPath)).toBe(true);
  });

  it("rejects a marked database that contains unrelated schema", async () => {
    const scope = currentStartupGuardOwnerScope();
    expect(scope).toBeDefined();
    const directory = createPrivateDirectory();
    const guardPath = path.join(directory, "marked-schema.lock.reclaim");
    const deadPid = await exitedProcessPid();
    const request = createGuardRequest(guardPath, deadPid, scope!);
    const databasePath = `${guardPath}.sqlite`;
    const database = new Database(databasePath);
    database.exec(`PRAGMA application_id = ${STARTUP_GUARD_RECOVERY_SQLITE_APPLICATION_ID}; PRAGMA user_version = ${STARTUP_GUARD_RECOVERY_SQLITE_USER_VERSION}`);
    database.exec("CREATE TABLE unrelated (value TEXT NOT NULL)");
    database.close();
    fs.chmodSync(databasePath, 0o600);

    await expect(runHelper(request)).resolves.toMatchObject({
      code: STARTUP_GUARD_RECOVERY_EXIT_CODES.ambiguous
    });
    expect(fs.existsSync(guardPath)).toBe(true);
  });

  it("serializes two helper processes so at most one removes the guard", async () => {
    const scope = currentStartupGuardOwnerScope();
    expect(scope).toBeDefined();
    const directory = createPrivateDirectory();
    const guardPath = path.join(directory, "race.lock.reclaim");
    const deadPid = await exitedProcessPid();
    const request = createGuardRequest(guardPath, deadPid, scope!);

    const results = await Promise.all([runHelper(request), runHelper(request)]);
    const codes = results.map((item) => item.code);
    expect(codes.filter((code) => code === STARTUP_GUARD_RECOVERY_EXIT_CODES.recovered)).toHaveLength(1);
    expect(codes.every((code) => code === STARTUP_GUARD_RECOVERY_EXIT_CODES.recovered ||
      code === STARTUP_GUARD_RECOVERY_EXIT_CODES.already_recovered ||
      code === STARTUP_GUARD_RECOVERY_EXIT_CODES.busy)).toBe(true);
    expect(results.every((item) => item.stdout === "" && item.stderr === "")).toBe(true);
  });

  it("returns busy without deletion when the permanent database is held exclusively", async () => {
    const scope = currentStartupGuardOwnerScope();
    expect(scope).toBeDefined();
    const directory = createPrivateDirectory();
    const guardPath = path.join(directory, "held.lock.reclaim");
    const deadPid = await exitedProcessPid();
    const request = createGuardRequest(guardPath, deadPid, scope!);
    const database = new Database(`${guardPath}.sqlite`, { timeout: 0 });
    fs.chmodSync(`${guardPath}.sqlite`, 0o600);
    database.exec("BEGIN EXCLUSIVE");

    try {
      await expect(runHelper(request)).resolves.toMatchObject({
        code: STARTUP_GUARD_RECOVERY_EXIT_CODES.busy
      });
    } finally {
      database.exec("ROLLBACK");
      database.close();
    }
    expect(fs.existsSync(guardPath)).toBe(true);
  });

  it("retains the guard when process death evidence is unknown", () => {
    const scope = currentStartupGuardOwnerScope();
    expect(scope).toBeDefined();
    const directory = createPrivateDirectory();
    const guardPath = path.join(directory, "unknown-owner.lock.reclaim");
    const request = createGuardRequest(guardPath, 999_999_937, scope!);
    const before = fs.readFileSync(guardPath);

    const result = recoverStartupGuard(request, {
      database_constructor: Database as unknown as StartupGuardRecoveryDatabaseConstructor,
      owner_scope: () => scope,
      process_state: () => "unknown"
    });

    expect(result).toEqual({
      outcome: "ambiguous",
      code: STARTUP_GUARD_RECOVERY_EXIT_CODES.ambiguous
    });
    expect(fs.readFileSync(guardPath)).toEqual(before);
  });

  it.each(["before-unlink", "after-unlink"] as const)(
    "releases recovery state after a fixture crash %s",
    async (phase) => {
      const scope = currentStartupGuardOwnerScope();
      expect(scope).toBeDefined();
      const directory = createPrivateDirectory();
      const guardPath = path.join(directory, `${phase}.lock.reclaim`);
      const deadPid = await exitedProcessPid();
      const request = createGuardRequest(guardPath, deadPid, scope!);

      const crashed = await runCrashFixture(phase, request);
      expect(crashed.code).toBeNull();
      expect(crashed.signal).toBe("SIGKILL");
      if (phase === "before-unlink") {
        expect(fs.existsSync(guardPath)).toBe(true);
        await expect(runHelper(request)).resolves.toMatchObject({
          code: STARTUP_GUARD_RECOVERY_EXIT_CODES.recovered
        });
      } else {
        expect(fs.existsSync(guardPath)).toBe(false);
        await expect(runHelper(request)).resolves.toMatchObject({
          code: STARTUP_GUARD_RECOVERY_EXIT_CODES.already_recovered
        });
      }
    }
  );

  it("preserves the native rebuild exit code when the database binding fails", () => {
    const scope = currentStartupGuardOwnerScope();
    expect(scope).toBeDefined();
    const directory = createPrivateDirectory();
    const guardPath = path.join(directory, "native-failure.lock.reclaim");
    const request = createGuardRequest(guardPath, 999_999_937, scope!);
    class NativeBindingFailure {
      public constructor() {
        throw new Error("better-sqlite3 was compiled against a different NODE_MODULE_VERSION");
      }
    }
    const result = recoverStartupGuard(request, {
      database_constructor: NativeBindingFailure as never,
      owner_scope: () => scope,
      process_state: () => "dead"
    });

    expect(result).toEqual({
      outcome: "native_module_rebuild_required",
      code: STARTUP_GUARD_RECOVERY_EXIT_CODES.native_module_rebuild_required
    });
    expect(fs.existsSync(guardPath)).toBe(true);
  });

  it("keeps the stdin request budget shared with the caller", () => {
    expect(MAX_STARTUP_GUARD_RECOVERY_REQUEST_BYTES).toBe(8192);
  });
});

it("rejects an unavailable owner scope without mutating the guard", () => {
  const directory = createPrivateDirectory();
  const guardPath = path.join(directory, "unsupported-scope.lock.reclaim");
  const ownerScope = { kind: "linux-pid-namespace-v1" as const, fingerprint: "a".repeat(64) };
  const request = createGuardRequest(guardPath, 999_999_937, ownerScope);
  const result = recoverStartupGuard(request, {
    database_constructor: (() => {
      throw new Error("database constructor must not run without owner scope");
    }) as never,
    owner_scope: () => undefined,
    process_state: () => "dead"
  });

  expect(result).toEqual({
    outcome: "ambiguous",
    code: STARTUP_GUARD_RECOVERY_EXIT_CODES.ambiguous
  });
  expect(fs.existsSync(guardPath)).toBe(true);
});

function createPrivateDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "awb-startup-guard-"));
  fs.chmodSync(directory, 0o700);
  temporaryDirectories.push(directory);
  return directory;
}

function createGuardRequest(
  guardPath: string,
  pid: number,
  ownerScope: NonNullable<ReturnType<typeof currentStartupGuardOwnerScope>>
): StartupGuardRecoveryRequest {
  writeGuard(guardPath, {
    pid,
    created_at: "2026-11-06T00:00:00.000Z",
    token: `token-${path.basename(guardPath)}`,
    owner_scope: ownerScope
  });
  const stat = fs.statSync(guardPath, { bigint: true });
  return {
    guard_path: guardPath,
    expected: {
      dev: String(stat.dev),
      ino: String(stat.ino),
      pid,
      created_at: "2026-11-06T00:00:00.000Z",
      token: `token-${path.basename(guardPath)}`,
      owner_scope: ownerScope
    }
  };
}

function writeGuard(guardPath: string, payload: Record<string, unknown>): void {
  fs.writeFileSync(guardPath, `${JSON.stringify(payload)}\n`, { mode: 0o600 });
  fs.chmodSync(guardPath, 0o600);
}

async function exitedProcessPid(): Promise<number> {
  const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  const pid = child.pid;
  if (pid === undefined) throw new Error("Failed to create a fixture process.");
  await once(child, "exit");
  return pid;
}

async function runHelper(request: StartupGuardRecoveryRequest): Promise<HelperResult> {
  const child = spawn(process.execPath, [helperEntrypoint], {
    cwd: repositoryRoot,
    stdio: ["pipe", "pipe", "pipe"]
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout?.on("data", (chunk: Buffer) => stdout.push(Buffer.from(chunk)));
  child.stderr?.on("data", (chunk: Buffer) => stderr.push(Buffer.from(chunk)));
  child.stdin?.end(`${JSON.stringify(request)}\n`);
  const [code] = await once(child, "close") as [number | null, NodeJS.Signals | null];
  return {
    code,
    stdout: Buffer.concat(stdout).toString("utf8"),
    stderr: Buffer.concat(stderr).toString("utf8")
  };
}

async function runCrashFixture(
  phase: "before-unlink" | "after-unlink",
  request: StartupGuardRecoveryRequest
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  const child = spawn(process.execPath, [crashFixtureEntrypoint, phase], {
    cwd: repositoryRoot,
    stdio: ["pipe", "ignore", "ignore"]
  });
  child.stdin?.end(`${JSON.stringify(request)}\n`);
  const [code, signal] = await once(child, "close") as [number | null, NodeJS.Signals | null];
  return { code, signal };
}
