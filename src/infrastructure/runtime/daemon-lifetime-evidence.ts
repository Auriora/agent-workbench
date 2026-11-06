/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  DAEMON_LIFETIME_EVIDENCE_MAX_BYTES,
  DAEMON_LIFETIME_EVIDENCE_SCHEMA_VERSION,
  daemonLifetimeEvidenceFileSchema,
  daemonLifetimeFatalOriginSchema,
  daemonLifetimeLaunchSchema,
  daemonLifetimeSignalSchema,
  type DaemonLifetimeEvidence,
  type DaemonLifetimeEvidenceFile,
  type DaemonLifetimeEvidenceUnavailableReason,
  type DaemonLifetimeFatalOrigin,
  type DaemonLifetimeLaunch,
  type DaemonLifetimeRecord
} from "../../contracts/daemon-lifetime-contracts.js";
import type { DaemonLifetimeEvidencePort } from "../../ports/index.js";

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,255}$/u;

class EvidenceStoreFailure extends Error {
  public constructor(public readonly reason: DaemonLifetimeEvidenceUnavailableReason) {
    super(reason);
  }
}

type ActiveLaunch = { launch: DaemonLifetimeLaunch; generation: number };
type FatalReason = "uncaughtException" | "unhandledRejection";
type WriteLock = { fd: number; token: string; device: number; inode: number };
type DeadLockIdentity = { pid: number; token: string; device: number; inode: number };

export class FileDaemonLifetimeEvidenceAdapter implements DaemonLifetimeEvidencePort {
  private activeLaunch: ActiveLaunch | undefined;
  private unavailableReason: DaemonLifetimeEvidenceUnavailableReason | undefined = "not_admitted";
  private strongestFatalReason: FatalReason | undefined;
  private readyAttempted = false;

  public constructor(private readonly evidencePath: string) {}

  public ready(launch: DaemonLifetimeLaunch): void {
    if (this.readyAttempted) return;
    this.readyAttempted = true;
    const parsedLaunch = daemonLifetimeLaunchSchema.safeParse(launch);
    if (!parsedLaunch.success || !this.hasSafeLaunchIdentifiers(parsedLaunch.data)) {
      this.unavailableReason = "invalid_launch";
      return;
    }
    try {
      const active = this.withWriteLock(() => {
        const existing = this.readFileEnvelope();
        const generation = existing === undefined ? 1 : existing.generation + 1;
        const previous = existing === undefined
          ? undefined
          : this.isTerminal(existing.current) ? existing.current : this.asOwnerLoss(existing.current);
        const current = this.newRecord(parsedLaunch.data);
        this.writeFileEnvelope({
          schema_version: DAEMON_LIFETIME_EVIDENCE_SCHEMA_VERSION,
          generation,
          current,
          ...(previous === undefined ? {} : { previous })
        });
        return { launch: parsedLaunch.data, generation };
      }, true);
      this.activeLaunch = active;
      this.unavailableReason = undefined;
    } catch (error) {
      this.unavailableReason = this.failureReason(error);
    }
  }

  public observeFatal(origin: DaemonLifetimeFatalOrigin): void {
    const parsedOrigin = daemonLifetimeFatalOriginSchema.safeParse(origin);
    if (!parsedOrigin.success) {
      this.unavailableReason = "invalid_observation";
      return;
    }
    this.strongestFatalReason ??= parsedOrigin.data;
    this.updateCurrent((current) => ({
      ...current,
      timestamp: now(),
      phase: "fatal",
      reason: this.strongestFatalReason ?? parsedOrigin.data
    }));
  }

  public observeSignal(signal: "SIGTERM"): void {
    const parsedSignal = daemonLifetimeSignalSchema.safeParse(signal);
    if (!parsedSignal.success) {
      this.unavailableReason = "invalid_observation";
      return;
    }
    this.updateCurrent((current) => ({
      ...current,
      timestamp: now(),
      phase: "signal",
      reason: isFatalReason(current.reason) ? current.reason : "sigterm",
      observed_signal: parsedSignal.data
    }));
  }

  public observeExit(code: number | null): void {
    if (code !== null && (!Number.isInteger(code) || code < 0)) {
      this.unavailableReason = "invalid_observation";
      return;
    }
    this.updateCurrent((current) => ({
      ...current,
      timestamp: now(),
      phase: "exit",
      reason: this.strongestFatalReason ?? (isFatalReason(current.reason) || current.reason === "sigterm" ? current.reason : "exit"),
      observed_code: code
    }));
  }

  public getEvidence(): DaemonLifetimeEvidence {
    if (this.activeLaunch === undefined) {
      return { status: "unavailable", reason: this.unavailableReason ?? "not_admitted" };
    }
    if (this.unavailableReason !== undefined) {
      return { status: "unavailable", reason: this.unavailableReason };
    }
    try {
      const file = this.readFileEnvelope();
      if (
        file === undefined ||
        file.generation !== this.activeLaunch.generation ||
        file.current.launch_token !== this.activeLaunch.launch.launch_token
      ) {
        return { status: "unavailable", reason: file === undefined ? "store_missing" : "stale_generation" };
      }
      return {
        status: "available",
        current: file.current,
        ...(file.previous === undefined ? {} : { previous: file.previous })
      };
    } catch (error) {
      return { status: "unavailable", reason: this.failureReason(error) };
    }
  }

  private updateCurrent(transform: (current: DaemonLifetimeRecord) => DaemonLifetimeRecord): void {
    const active = this.activeLaunch;
    if (active === undefined) return;
    try {
      this.withWriteLock(() => {
        const file = this.readFileEnvelope();
        if (
          file === undefined ||
          file.generation !== active.generation ||
          file.current.launch_token !== active.launch.launch_token
        ) {
          throw new EvidenceStoreFailure("stale_generation");
        }
        const current = transform(file.current);
        daemonLifetimeEvidenceFileSchema.parse({ ...file, current });
        this.writeFileEnvelope({ ...file, current });
      });
    } catch (error) {
      this.unavailableReason = this.failureReason(error);
    }
  }

  private newRecord(launch: DaemonLifetimeLaunch): DaemonLifetimeRecord {
    return { ...launch, timestamp: now(), phase: "ready", reason: "admitted" };
  }

  private asOwnerLoss(record: DaemonLifetimeRecord): DaemonLifetimeRecord {
    const { daemon_id, launch_token, pid, runtime_version, build_fingerprint, started_at } = record;
    return {
      daemon_id,
      launch_token,
      pid,
      runtime_version,
      ...(build_fingerprint === undefined ? {} : { build_fingerprint }),
      started_at,
      timestamp: now(),
      phase: "owner_loss",
      reason: "unknown_prior_owner_loss"
    };
  }

  private isTerminal(record: DaemonLifetimeRecord): boolean {
    return record.phase === "exit" || record.phase === "owner_loss";
  }

  private readFileEnvelope(): DaemonLifetimeEvidenceFile | undefined {
    this.ensurePrivateDirectory();
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(this.evidencePath);
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw new EvidenceStoreFailure("store_unreadable");
    }
    if (stat.isSymbolicLink() || !stat.isFile()) throw new EvidenceStoreFailure("store_unsafe");
    if ((stat.mode & 0o077) !== 0) throw new EvidenceStoreFailure("store_unsafe");

    let fd: number | undefined;
    try {
      fd = fs.openSync(this.evidencePath, fs.constants.O_RDONLY | noFollowFlag());
      const opened = fs.fstatSync(fd);
      if (!opened.isFile()) throw new EvidenceStoreFailure("store_unsafe");
      if (opened.size > DAEMON_LIFETIME_EVIDENCE_MAX_BYTES) {
        throw new EvidenceStoreFailure("store_oversized");
      }
      const buffer = Buffer.alloc(DAEMON_LIFETIME_EVIDENCE_MAX_BYTES + 1);
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
      if (bytesRead > DAEMON_LIFETIME_EVIDENCE_MAX_BYTES) {
        throw new EvidenceStoreFailure("store_oversized");
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(buffer.subarray(0, bytesRead).toString("utf8"));
      } catch {
        throw new EvidenceStoreFailure("store_corrupt");
      }
      const result = daemonLifetimeEvidenceFileSchema.safeParse(parsed);
      if (!result.success) throw new EvidenceStoreFailure("store_corrupt");
      return result.data;
    } catch (error) {
      if (error instanceof EvidenceStoreFailure) throw error;
      throw new EvidenceStoreFailure("store_unreadable");
    } finally {
      if (fd !== undefined) {
        try { fs.closeSync(fd); } catch { /* bounded read already classified */ }
      }
    }
  }

  private writeFileEnvelope(file: DaemonLifetimeEvidenceFile): void {
    const serialized = JSON.stringify(file);
    if (Buffer.byteLength(serialized, "utf8") > DAEMON_LIFETIME_EVIDENCE_MAX_BYTES) {
      throw new EvidenceStoreFailure("store_oversized");
    }
    this.ensurePrivateDirectory();
    this.assertTargetPathSafe(this.evidencePath);
    const temporaryPath = `${this.evidencePath}.${crypto.randomUUID()}.tmp`;
    let fd: number | undefined;
    try {
      fd = fs.openSync(
        temporaryPath,
        fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | noFollowFlag(),
        PRIVATE_FILE_MODE
      );
      fs.writeFileSync(fd, serialized, { encoding: "utf8" });
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = undefined;
      fs.renameSync(temporaryPath, this.evidencePath);
      fs.chmodSync(this.evidencePath, PRIVATE_FILE_MODE);
      this.syncDirectory();
    } catch (error) {
      if (fd !== undefined) {
        try { fs.closeSync(fd); } catch { /* preserve bounded failure */ }
      }
      try { fs.unlinkSync(temporaryPath); } catch { /* renamed or absent */ }
      if (error instanceof EvidenceStoreFailure) throw error;
      throw new EvidenceStoreFailure("store_unwritable");
    }
  }

  private withWriteLock<T>(operation: () => T, recoverDeadOwner = false): T {
    this.ensurePrivateDirectory();
    const lockPath = `${this.evidencePath}.lock`;
    this.assertTargetPathSafe(lockPath);
    const lock = this.acquireWriteLock(lockPath, recoverDeadOwner);
    try {
      return operation();
    } finally {
      this.releaseWriteLock(lockPath, lock);
    }
  }

  private acquireWriteLock(lockPath: string, recoverDeadOwner: boolean): WriteLock {
    let recoveredDeadOwner = false;
    for (;;) {
      let fd: number | undefined;
      try {
        fd = fs.openSync(
          lockPath,
          fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | noFollowFlag(),
          PRIVATE_FILE_MODE
        );
        const token = crypto.randomUUID();
        const serialized = JSON.stringify({ pid: process.pid, token });
        if (Buffer.byteLength(serialized, "utf8") > 256) {
          fs.closeSync(fd);
          throw new EvidenceStoreFailure("store_oversized");
        }
        fs.writeFileSync(fd, serialized, { encoding: "utf8" });
        fs.fsyncSync(fd);
        const stat = fs.fstatSync(fd);
        return { fd, token, device: stat.dev, inode: stat.ino };
      } catch (error) {
        if (fd !== undefined) {
          try { fs.closeSync(fd); } catch { /* preserve bounded failure */ }
          try { fs.unlinkSync(lockPath); } catch { /* preserve bounded failure */ }
        }
        if (error instanceof EvidenceStoreFailure) throw error;
        if (!isAlreadyExists(error) || !recoverDeadOwner || recoveredDeadOwner) {
          throw new EvidenceStoreFailure("lock_contention");
        }
        const deadLock = this.readDeadLockIdentity(lockPath);
        if (deadLock === undefined) {
          throw new EvidenceStoreFailure("lock_contention");
        }
        let lockStat: fs.Stats;
        try {
          lockStat = fs.lstatSync(lockPath);
          if (
            !lockStat.isFile() ||
            lockStat.dev !== deadLock.device ||
            lockStat.ino !== deadLock.inode ||
            this.readLockToken(lockPath, lockStat) !== deadLock.token
          ) {
            throw new Error("lock changed");
          }
        } catch {
          throw new EvidenceStoreFailure("lock_contention");
        }
        try {
          const currentStat = fs.lstatSync(lockPath);
          if (
            currentStat.dev !== deadLock.device ||
            currentStat.ino !== deadLock.inode ||
            this.readLockToken(lockPath, currentStat) !== deadLock.token
          ) {
            throw new Error("lock changed");
          }
          fs.unlinkSync(lockPath);
        }
        catch { throw new EvidenceStoreFailure("lock_contention"); }
        recoveredDeadOwner = true;
      }
    }
  }

  private releaseWriteLock(lockPath: string, lock: WriteLock): void {
    try {
      const stat = fs.lstatSync(lockPath);
      if (!stat.isFile() || stat.dev !== lock.device || stat.ino !== lock.inode) return;
      if (this.readLockToken(lockPath, stat) === lock.token) fs.unlinkSync(lockPath);
    } catch {
      // A replaced or already-removed lock must not remove another owner's lock.
    } finally {
      try { fs.closeSync(lock.fd); } catch { /* preserve the operation result */ }
    }
  }

  private readLockToken(lockPath: string, expected: fs.Stats): string | undefined {
    let fd: number | undefined;
    try {
      fd = fs.openSync(lockPath, fs.constants.O_RDONLY | noFollowFlag());
      const opened = fs.fstatSync(fd);
      if (opened.dev !== expected.dev || opened.ino !== expected.ino || opened.size > 256) return undefined;
      const buffer = Buffer.alloc(257);
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
      if (bytesRead > 256) return undefined;
      const parsed = JSON.parse(buffer.subarray(0, bytesRead).toString("utf8")) as { token?: unknown };
      return typeof parsed.token === "string" ? parsed.token : undefined;
    } catch {
      return undefined;
    } finally {
      if (fd !== undefined) {
        try { fs.closeSync(fd); } catch { /* bounded lock read */ }
      }
    }
  }

  private readDeadLockIdentity(lockPath: string): DeadLockIdentity | undefined {
    let fd: number | undefined;
    try {
      const stat = fs.lstatSync(lockPath);
      if (stat.isSymbolicLink() || !stat.isFile() || (stat.mode & 0o077) !== 0 || stat.size > 256) {
        return undefined;
      }
      fd = fs.openSync(lockPath, fs.constants.O_RDONLY | noFollowFlag());
      const buffer = Buffer.alloc(257);
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
      if (bytesRead > 256) return undefined;
      const parsed = JSON.parse(buffer.subarray(0, bytesRead).toString("utf8")) as { pid?: unknown; token?: unknown };
      if (!Number.isInteger(parsed.pid) || (parsed.pid as number) <= 0 || typeof parsed.token !== "string") return undefined;
      try {
        process.kill(parsed.pid as number, 0);
        return undefined;
      } catch (error) {
        return isNoSuchProcess(error)
          ? { pid: parsed.pid as number, token: parsed.token, device: stat.dev, inode: stat.ino }
          : undefined;
      }
    } catch {
      return undefined;
    } finally {
      if (fd !== undefined) {
        try { fs.closeSync(fd); } catch { /* bounded lock read */ }
      }
    }
  }

  private ensurePrivateDirectory(): void {
    const directory = path.dirname(this.evidencePath);
    const parsed = path.parse(directory);
    let current = parsed.root;
    const components = directory.slice(parsed.root.length).split(path.sep).filter(Boolean);
    for (const component of components) {
      current = path.join(current, component);
      try {
        const stat = fs.lstatSync(current);
        if (stat.isSymbolicLink() || !stat.isDirectory()) {
          throw new EvidenceStoreFailure("store_unsafe");
        }
      } catch (error) {
        if (error instanceof EvidenceStoreFailure) throw error;
        if (!isMissing(error)) throw new EvidenceStoreFailure("store_unwritable");
        try {
          fs.mkdirSync(current, PRIVATE_DIRECTORY_MODE);
        } catch {
          throw new EvidenceStoreFailure("store_unwritable");
        }
      }
      if (current === directory) {
        try {
          const stat = fs.statSync(current);
          if ((stat.mode & 0o077) !== 0) throw new EvidenceStoreFailure("store_unsafe");
        } catch (error) {
          if (error instanceof EvidenceStoreFailure) throw error;
          throw new EvidenceStoreFailure("store_unwritable");
        }
      }
    }
  }

  private assertTargetPathSafe(target: string): void {
    try {
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink() || !stat.isFile()) throw new EvidenceStoreFailure("store_unsafe");
    } catch (error) {
      if (error instanceof EvidenceStoreFailure) throw error;
      if (!isMissing(error)) throw new EvidenceStoreFailure("store_unwritable");
    }
  }

  private syncDirectory(): void {
    let fd: number | undefined;
    try {
      fd = fs.openSync(path.dirname(this.evidencePath), fs.constants.O_RDONLY);
      fs.fsyncSync(fd);
    } catch {
      // Directory fsync is not available on every supported platform.
    } finally {
      if (fd !== undefined) {
        try { fs.closeSync(fd); } catch { /* best effort after atomic rename */ }
      }
    }
  }

  private hasSafeLaunchIdentifiers(launch: DaemonLifetimeLaunch): boolean {
    return SAFE_IDENTIFIER_PATTERN.test(launch.daemon_id) &&
      SAFE_IDENTIFIER_PATTERN.test(launch.launch_token) &&
      SAFE_IDENTIFIER_PATTERN.test(launch.runtime_version) &&
      (launch.build_fingerprint === undefined || SAFE_IDENTIFIER_PATTERN.test(launch.build_fingerprint));
  }

  private failureReason(error: unknown): DaemonLifetimeEvidenceUnavailableReason {
    return error instanceof EvidenceStoreFailure ? error.reason : "store_unwritable";
  }
}

function isFatalReason(reason: DaemonLifetimeRecord["reason"]): reason is "uncaughtException" | "unhandledRejection" {
  return reason === "uncaughtException" || reason === "unhandledRejection";
}

function now(): string {
  return new Date().toISOString();
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isAlreadyExists(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}

function isNoSuchProcess(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ESRCH";
}

function noFollowFlag(): number {
  return typeof fs.constants.O_NOFOLLOW === "number" ? fs.constants.O_NOFOLLOW : 0;
}


