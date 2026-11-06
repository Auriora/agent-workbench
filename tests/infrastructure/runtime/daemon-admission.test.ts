/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import {
  DAEMON_ADMISSION_REJECTED_MESSAGE,
  GUARANTEED_DAEMON_SESSION_INPUT_BYTES,
  MAX_DAEMON_MESSAGES,
  MAX_DAEMON_SESSIONS,
  MAX_DAEMON_SESSION_MESSAGES
} from "../../../src/contracts/daemon-admission-contracts.js";
import { DaemonAdmissionBudget } from "../../../src/infrastructure/runtime/daemon-admission.js";

const signal = (): AbortSignal => new AbortController().signal;

describe("DaemonAdmissionBudget", () => {
  it("caps sessions and releases a closed idle session", () => {
    const budget = new DaemonAdmissionBudget();
    const sessions = Array.from({ length: MAX_DAEMON_SESSIONS }, () => budget.tryOpenSession());
    expect(sessions.every(Boolean)).toBe(true);
    expect(budget.tryOpenSession()).toBeUndefined();
    sessions[0]?.close();
    expect(budget.snapshot().sessions).toBe(MAX_DAEMON_SESSIONS - 1);
    expect(budget.tryOpenSession()).toBeDefined();
  });

  it("keeps input accounting exact across guaranteed and shared portions", () => {
    const budget = new DaemonAdmissionBudget();
    const session = budget.tryOpenSession();
    expect(session?.reserveInput(GUARANTEED_DAEMON_SESSION_INPUT_BYTES)).toBe(true);
    expect(budget.snapshot().shared_input_bytes).toBe(0);
    expect(session?.reserveInput(1)).toBe(true);
    expect(budget.snapshot().shared_input_bytes).toBe(1);
    session?.releaseInput(1);
    session?.releaseInput(GUARANTEED_DAEMON_SESSION_INPUT_BYTES);
    expect(budget.snapshot().input_bytes).toBe(0);
    expect(budget.snapshot().shared_input_bytes).toBe(0);
    session?.close();
    expect(budget.snapshot().sessions).toBe(0);
  });

  it("retains running work through close and releases once it settles", async () => {
    const budget = new DaemonAdmissionBudget();
    const session = budget.tryOpenSession();
    expect(session?.reserveInput(10)).toBe(true);
    expect(session?.admitRequest("one", 10)).toBe(true);
    let finish!: () => void;
    const operation = new Promise<void>((resolve) => { finish = resolve; });
    const running = session?.runRequest("one", signal(), () => operation);
    session?.close();
    expect(budget.snapshot().sessions).toBe(1);
    finish();
    await running;
    expect(budget.snapshot().sessions).toBe(0);
    expect(budget.snapshot().messages).toBe(0);
  });

  it("rejects duplicate ids and enforces per-session messages", () => {
    const budget = new DaemonAdmissionBudget();
    const session = budget.tryOpenSession();
    for (let i = 0; i < MAX_DAEMON_SESSION_MESSAGES; i += 1) {
      expect(session?.reserveInput(1)).toBe(true);
      expect(session?.admitRequest(`id-${i}`, 1)).toBe(true);
    }
    expect(session?.reserveInput(1)).toBe(true);
    expect(session?.admitRequest("overflow", 1)).toBe(false);
    expect(session?.admitRequest("id-0", 0)).toBe(false);
    expect(budget.snapshot().messages).toBe(MAX_DAEMON_SESSION_MESSAGES);
  });

  it("keeps control leases until their release callback", () => {
    const budget = new DaemonAdmissionBudget();
    const session = budget.tryOpenSession();
    expect(session?.reserveInput(4)).toBe(true);
    const release = session?.admitControl(4);
    expect(release).toBeDefined();
    session?.close();
    expect(budget.snapshot().sessions).toBe(1);
    release?.();
    release?.();
    expect(budget.snapshot().sessions).toBe(0);
  });

  it("releases a protocol request that has no application handler", () => {
    const budget = new DaemonAdmissionBudget();
    const session = budget.tryOpenSession()!;
    expect(session.reserveInput(3)).toBe(true);
    expect(session.admitRequest(7, 3)).toBe(true);
    session.completeResponse(7);
    expect(budget.snapshot()).toEqual({ sessions: 1, input_bytes: 0, shared_input_bytes: 0, messages: 0 });
    session.close();
    expect(budget.snapshot().sessions).toBe(0);
  });

  it("cancels running work through its abort signal without freeing it early", async () => {
    const budget = new DaemonAdmissionBudget();
    const session = budget.tryOpenSession()!;
    const controller = new AbortController();
    expect(session.reserveInput(2)).toBe(true);
    expect(session.admitRequest("cancel", 2)).toBe(true);
    let finish!: () => void;
    let observedCancellation = false;
    const running = session.runRequest("cancel", controller.signal, async () => {
      await new Promise<void>((resolve) => { finish = resolve; });
      observedCancellation = controller.signal.aborted;
    });
    controller.abort();
    expect(budget.snapshot().messages).toBe(1);
    finish();
    await running;
    expect(observedCancellation).toBe(true);
    expect(budget.snapshot().messages).toBe(0);
  });

  it("counts controls and requests together against the per-session budget", () => {
    const budget = new DaemonAdmissionBudget();
    const session = budget.tryOpenSession()!;
    const releases: Array<() => void> = [];
    for (let i = 0; i < MAX_DAEMON_SESSION_MESSAGES - 1; i += 1) {
      expect(session.reserveInput(0)).toBe(true);
      const release = session.admitControl(0);
      expect(release).toBeDefined();
      releases.push(release!);
    }
    expect(session.reserveInput(0)).toBe(true);
    expect(session.admitRequest("last", 0)).toBe(true);
    expect(session.reserveInput(0)).toBe(true);
    expect(session.admitControl(0)).toBeUndefined();
    for (const release of releases) release();
    session.cancelRequest("last");
    session.close();
  });

  it("does not exceed the global message limit", () => {
    const budget = new DaemonAdmissionBudget();
    const sessions = Array.from({ length: MAX_DAEMON_SESSIONS }, () => budget.tryOpenSession());
    for (let i = 0; i < MAX_DAEMON_SESSIONS; i += 1) {
      const session = sessions[i]!;
      for (let j = 0; j < MAX_DAEMON_SESSION_MESSAGES; j += 1) {
        expect(session.reserveInput(0)).toBe(true);
        expect(session.admitRequest(`${i}-${j}`, 0)).toBe(true);
      }
    }
    expect(budget.snapshot().messages).toBe(MAX_DAEMON_MESSAGES);
  });

  it("enforces the shared overflow boundary while preserving each session guarantee", () => {
    const budget = new DaemonAdmissionBudget();
    const first = budget.tryOpenSession()!;
    const second = budget.tryOpenSession()!;
    const third = budget.tryOpenSession()!;
    const maxInput = 32 * 1024 * 1024;
    expect(first.reserveInput(maxInput)).toBe(true);
    expect(second.reserveInput(maxInput)).toBe(true);
    expect(budget.snapshot().shared_input_bytes).toBe(64 * 1024 * 1024 - 2 * GUARANTEED_DAEMON_SESSION_INPUT_BYTES);
    expect(third.reserveInput(GUARANTEED_DAEMON_SESSION_INPUT_BYTES)).toBe(true);
    expect(third.reserveInput(2 * GUARANTEED_DAEMON_SESSION_INPUT_BYTES)).toBe(true);
    expect(budget.snapshot().shared_input_bytes).toBe(64 * 1024 * 1024);
    expect(third.reserveInput(1)).toBe(false);
    first.close();
    second.close();
    third.close();
  });

  it("enforces the per-session input boundary without allocating the payload", () => {
    const budget = new DaemonAdmissionBudget();
    const session = budget.tryOpenSession()!;
    expect(session.reserveInput(32 * 1024 * 1024)).toBe(true);
    expect(session.reserveInput(1)).toBe(false);
    session.close();
  });

  it("keeps a healthy session admitted while another session uses its full message share", () => {
    const budget = new DaemonAdmissionBudget();
    const offender = budget.tryOpenSession()!;
    const healthy = budget.tryOpenSession()!;
    for (let i = 0; i < MAX_DAEMON_SESSION_MESSAGES; i += 1) {
      expect(offender.reserveInput(0)).toBe(true);
      expect(offender.admitRequest(`offender-${i}`, 0)).toBe(true);
    }
    expect(offender.reserveInput(0)).toBe(true);
    expect(offender.admitRequest("overflow", 0)).toBe(false);
    expect(healthy.reserveInput(0)).toBe(true);
    expect(healthy.admitRequest("healthy", 0)).toBe(true);
    healthy.cancelRequest("healthy");
    offender.close();
    healthy.close();
  });

  it("waits for actual work before reporting daemon quiescence", async () => {
    const budget = new DaemonAdmissionBudget();
    await budget.whenQuiescent();
    const session = budget.tryOpenSession()!;
    expect(session.reserveInput(1)).toBe(true);
    expect(session.admitRequest("deferred", 1)).toBe(true);
    let finish!: () => void;
    const running = session.runRequest("deferred", signal(), () => new Promise<void>((resolve) => { finish = resolve; }));
    session.close();
    let settled = false;
    const quiescent = budget.whenQuiescent().then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    finish();
    await running;
    await quiescent;
    expect(settled).toBe(true);
  });

  it("does not invoke a handler when abort occurs during listener registration", async () => {
    const budget = new DaemonAdmissionBudget();
    const session = budget.tryOpenSession()!;
    expect(session.reserveInput(1)).toBe(true);
    expect(session.admitRequest("race", 1)).toBe(true);
    let invoked = false;
    let aborted = false;
    const raceSignal = {
      get aborted(): boolean { return aborted; },
      addEventListener: (_type: string, listener: () => void): void => {
        aborted = true;
        listener();
      },
      removeEventListener: (): void => undefined
    } as unknown as AbortSignal;
    await expect(session.runRequest("race", raceSignal, () => {
      invoked = true;
    })).rejects.toThrow(DAEMON_ADMISSION_REJECTED_MESSAGE);
    expect(invoked).toBe(false);
    expect(budget.snapshot().messages).toBe(0);
    session.close();
  });

  it("rejects work after cancellation or closed admission", async () => {
    const budget = new DaemonAdmissionBudget();
    const session = budget.tryOpenSession()!;
    expect(session.reserveInput(1)).toBe(true);
    expect(session.admitRequest(1, 1)).toBe(true);
    session.cancelRequest(1);
    await expect(session.runRequest(1, signal(), () => undefined)).rejects.toThrow(DAEMON_ADMISSION_REJECTED_MESSAGE);
  });
});
