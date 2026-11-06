/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DAEMON_LIFETIME_EVIDENCE_MAX_BYTES,
  type DaemonLifetimeEvidenceAvailable,
  type DaemonLifetimeLaunch
} from "../../src/contracts/daemon-lifetime-contracts.js";
import { FileDaemonLifetimeEvidenceAdapter } from "../../src/infrastructure/runtime/daemon-lifetime-evidence.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("FileDaemonLifetimeEvidenceAdapter", () => {
  it("starts unavailable until ready and writes private bounded evidence", () => {
    const evidencePath = createEvidencePath();
    const adapter = new FileDaemonLifetimeEvidenceAdapter(evidencePath);

    expect(adapter.getEvidence()).toEqual({ status: "unavailable", reason: "not_admitted" });

    adapter.ready(launch());
    const evidence = available(adapter);
    expect(evidence.current.phase).toBe("ready");
    expect(evidence.current.reason).toBe("admitted");
    expect(evidence.current.daemon_id).toBe("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
    expect(evidence.previous).toBeUndefined();
    expect(fs.statSync(evidencePath).mode & 0o777).toBe(0o600);
    expect(fs.statSync(path.dirname(evidencePath)).mode & 0o777).toBe(0o700);
    expect(fs.statSync(evidencePath).size).toBeLessThanOrEqual(DAEMON_LIFETIME_EVIDENCE_MAX_BYTES);
    expect(fs.readdirSync(path.dirname(evidencePath)).filter((name) => name.includes(".lock"))).toEqual([]);
  });

  it("preserves fatal cause through signal and exit observations", () => {
    const adapter = new FileDaemonLifetimeEvidenceAdapter(createEvidencePath());
    adapter.ready(launch());
    adapter.observeFatal("unhandledRejection");
    adapter.observeSignal("SIGTERM");
    adapter.observeExit(17);

    const current = available(adapter).current;
    expect(current.phase).toBe("exit");
    expect(current.reason).toBe("unhandledRejection");
    expect(current.observed_signal).toBe("SIGTERM");
    expect(current.observed_code).toBe(17);
  });

  it("rotates terminal evidence and classifies a nonterminal prior owner loss", () => {
    const evidencePath = createEvidencePath();
    const first = new FileDaemonLifetimeEvidenceAdapter(evidencePath);
    first.ready(launch());
    first.observeExit(0);

    const second = new FileDaemonLifetimeEvidenceAdapter(evidencePath);
    second.ready(launch());
    expect(available(second).previous?.reason).toBe("exit");

    const third = new FileDaemonLifetimeEvidenceAdapter(evidencePath);
    third.ready(launch());
    const rotated = available(third);
    expect(rotated.previous?.phase).toBe("owner_loss");
    expect(rotated.previous?.reason).toBe("unknown_prior_owner_loss");
    expect(rotated.previous?.observed_code).toBeUndefined();
    expect(rotated.previous?.observed_signal).toBeUndefined();
  });

  it("rejects stale writers after replacement admission", () => {
    const evidencePath = createEvidencePath();
    const first = new FileDaemonLifetimeEvidenceAdapter(evidencePath);
    first.ready(launch());
    const second = new FileDaemonLifetimeEvidenceAdapter(evidencePath);
    second.ready(launch());
    const before = fs.readFileSync(evidencePath, "utf8");

    first.observeExit(9);

    expect(first.getEvidence()).toEqual({ status: "unavailable", reason: "stale_generation" });
    expect(fs.readFileSync(evidencePath, "utf8")).toBe(before);
    expect(available(second).current.phase).toBe("ready");
  });

  it("does not wait or overwrite while another writer holds the lock", () => {
    const evidencePath = createEvidencePath();
    const first = new FileDaemonLifetimeEvidenceAdapter(evidencePath);
    first.ready(launch());
    const lockPath = `${evidencePath}.lock`;
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, token: crypto.randomUUID() }), { mode: 0o600 });

    const replacement = new FileDaemonLifetimeEvidenceAdapter(evidencePath);
    replacement.ready(launch());

    expect(replacement.getEvidence()).toEqual({ status: "unavailable", reason: "lock_contention" });
    const before = fs.readFileSync(evidencePath, "utf8");
    first.observeFatal("uncaughtException");
    first.observeExit(1);
    expect(first.getEvidence()).toEqual({ status: "unavailable", reason: "lock_contention" });
    expect(fs.readFileSync(evidencePath, "utf8")).toBe(before);
    fs.unlinkSync(lockPath);
    expect(JSON.parse(fs.readFileSync(evidencePath, "utf8")).current.phase).toBe("ready");
  });

  it("preserves a replacement lock that appears during the dead-owner probe", () => {
    const evidencePath = createEvidencePath();
    const lockPath = `${evidencePath}.lock`;
    fs.writeFileSync(lockPath, JSON.stringify({ pid: 999999937, token: crypto.randomUUID() }), { mode: 0o600 });
    const replacement = JSON.stringify({ pid: process.pid, token: crypto.randomUUID() });
    vi.spyOn(process, "kill").mockImplementationOnce(() => {
      fs.unlinkSync(lockPath);
      fs.writeFileSync(lockPath, replacement, { mode: 0o600 });
      throw Object.assign(new Error("fixture dead owner"), { code: "ESRCH" });
    });
    const adapter = new FileDaemonLifetimeEvidenceAdapter(evidencePath);
    adapter.ready(launch());
    expect(adapter.getEvidence()).toEqual({ status: "unavailable", reason: "lock_contention" });
    expect(fs.readFileSync(lockPath, "utf8")).toBe(replacement);
    expect(fs.existsSync(evidencePath)).toBe(false);
  });

  it.each([
    { phase: "ready", reason: "exit", observed_code: 1 },
    { phase: "owner_loss", reason: "unknown_prior_owner_loss", observed_signal: "SIGTERM" },
    { phase: "fatal", reason: "admitted" }
  ])("rejects inconsistent persisted lifecycle facts: %j", (invalid) => {
    const evidencePath = createEvidencePath();
    const adapter = new FileDaemonLifetimeEvidenceAdapter(evidencePath);
    adapter.ready(launch());
    const file = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
    Object.assign(file.current, invalid);
    fs.writeFileSync(evidencePath, JSON.stringify(file), { mode: 0o600 });
    const replacement = new FileDaemonLifetimeEvidenceAdapter(evidencePath);
    replacement.ready(launch());
    expect(replacement.getEvidence()).toEqual({ status: "unavailable", reason: "store_corrupt" });
  });

  it("rejects malformed, oversized, unsafe, and contended stores explicitly", () => {
    const malformedPath = createEvidencePath();
    fs.writeFileSync(malformedPath, "not-json", { mode: 0o600 });
    const malformed = new FileDaemonLifetimeEvidenceAdapter(malformedPath);
    malformed.ready(launch());
    expect(malformed.getEvidence()).toEqual({ status: "unavailable", reason: "store_corrupt" });

    const oversizedPath = createEvidencePath();
    fs.writeFileSync(oversizedPath, "x".repeat(DAEMON_LIFETIME_EVIDENCE_MAX_BYTES + 1), { mode: 0o600 });
    const oversized = new FileDaemonLifetimeEvidenceAdapter(oversizedPath);
    oversized.ready(launch());
    expect(oversized.getEvidence()).toEqual({ status: "unavailable", reason: "store_oversized" });

    const targetPath = createEvidencePath();
    const target = `${targetPath}.target`;
    fs.writeFileSync(target, "{}", { mode: 0o600 });
    fs.symlinkSync(target, targetPath);
    const unsafe = new FileDaemonLifetimeEvidenceAdapter(targetPath);
    unsafe.ready(launch());
    expect(unsafe.getEvidence()).toEqual({ status: "unavailable", reason: "store_unsafe" });

    const contendedPath = createEvidencePath();
    const lockPath = `${contendedPath}.lock`;
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, token: crypto.randomUUID() }), { mode: 0o600 });
    const contended = new FileDaemonLifetimeEvidenceAdapter(contendedPath);
    contended.ready(launch());
    expect(contended.getEvidence()).toEqual({ status: "unavailable", reason: "lock_contention" });
    fs.unlinkSync(lockPath);
    contended.ready(launch());
    expect(contended.getEvidence()).toEqual({ status: "unavailable", reason: "lock_contention" });
  });

  it("recovers one lock left by a dead owner", () => {
    const evidencePath = createEvidencePath();
    fs.writeFileSync(
      `${evidencePath}.lock`,
      JSON.stringify({ pid: 999999937, token: crypto.randomUUID() }),
      { mode: 0o600 }
    );
    const adapter = new FileDaemonLifetimeEvidenceAdapter(evidencePath);
    adapter.ready(launch());
    expect(available(adapter).current.phase).toBe("ready");
  });
});

function createEvidencePath(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-lifetime-"));
  temporaryDirectories.push(directory);
  return path.join(directory, "daemon-lifetime.json");
}

function launch(): DaemonLifetimeLaunch {
  return {
    daemon_id: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    launch_token: crypto.randomUUID(),
    pid: process.pid,
    runtime_version: "0.6.9",
    build_fingerprint: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    started_at: "2026-11-06T10:00:00.000Z"
  };
}

function available(adapter: FileDaemonLifetimeEvidenceAdapter): DaemonLifetimeEvidenceAvailable {
  const evidence = adapter.getEvidence();
  expect(evidence.status).toBe("available");
  if (evidence.status !== "available") throw new Error("Expected available daemon lifetime evidence.");
  return evidence;
}
