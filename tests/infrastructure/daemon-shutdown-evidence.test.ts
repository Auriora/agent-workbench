/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { daemonShutdownReceiptSchema, type DaemonShutdownReceipt } from "../../src/contracts/daemon-shutdown-contracts.js";
import { FileDaemonLifetimeEvidenceAdapter } from "../../src/infrastructure/runtime/daemon-lifetime-evidence.js";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});
const blocked: DaemonShutdownReceipt = {
  state: "blocked", phase: "refresh", cause: "deadline",
  worker_termination_state: "unconfirmed", activity_lease_held: true,
  publication_state: "building"
};

describe("daemon shutdown lifetime evidence", () => {
  it("preserves blocked shutdown and stronger fatal cause through process exit", () => {
    const { adapter } = createAdapter();
    adapter.observeFatal("uncaughtException");
    adapter.observeShutdown(blocked);
    adapter.observeExit(1);
    const evidence = adapter.getEvidence();
    expect(evidence.status).toBe("available");
    if (evidence.status !== "available") throw new Error("Missing fixture evidence");
    expect(evidence.current).toMatchObject({
      phase: "exit", reason: "uncaughtException", observed_code: 1, shutdown: blocked
    });
  });

  it("preserves observed blocked facts while unknown terminal loss stays unknown", () => {
    const { adapter, receiptPath } = createAdapter();
    adapter.observeShutdown(blocked);
    const next = new FileDaemonLifetimeEvidenceAdapter(receiptPath);
    next.ready(launch());
    const evidence = next.getEvidence();
    expect(evidence.status).toBe("available");
    if (evidence.status !== "available") throw new Error("Missing fixture evidence");
    expect(evidence.previous).toMatchObject({
      phase: "owner_loss", reason: "unknown_prior_owner_loss", shutdown: blocked
    });
    expect(evidence.previous?.observed_code).toBeUndefined();
    expect(evidence.previous?.observed_signal).toBeUndefined();
  });

  it.each([
    { activity_lease_held: true },
    { worker_termination_state: "unconfirmed" },
    { publication_state: "building" },
    { phase: "refresh" },
    { cause: "deadline" }
  ])("rejects false settled evidence: %j", (unsafe) => {
    expect(daemonShutdownReceiptSchema.safeParse({
      state: "settled", phase: "complete", cause: "complete",
      activity_lease_held: false, worker_termination_state: "confirmed",
      publication_state: "failed", ...unsafe
    }).success).toBe(false);
  });

  it("rejects arbitrary raw diagnostic data without writing it", () => {
    const { adapter, receiptPath } = createAdapter();
    const before = fs.readFileSync(receiptPath, "utf8");
    adapter.observeShutdown({ ...blocked, message: "/home/private token=secret" } as never);
    expect(adapter.getEvidence()).toEqual({ status: "unavailable", reason: "invalid_observation" });
    expect(fs.readFileSync(receiptPath, "utf8")).toBe(before);
  });

  it("rejects a blocked result claiming that shutdown completed", () => {
    expect(daemonShutdownReceiptSchema.safeParse({ ...blocked, phase: "complete" }).success).toBe(false);
  });
});

function createAdapter() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "awb-shutdown-evidence-"));
  directories.push(directory);
  const receiptPath = path.join(directory, "lifetime.json");
  const adapter = new FileDaemonLifetimeEvidenceAdapter(receiptPath);
  adapter.ready(launch());
  return { adapter, receiptPath };
}
function launch() {
  return { daemon_id: "a".repeat(64), launch_token: crypto.randomUUID(), pid: process.pid,
    runtime_version: "0.6.9", started_at: new Date().toISOString() };
}
