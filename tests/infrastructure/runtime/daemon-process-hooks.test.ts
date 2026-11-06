/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { installDaemonProcessHooks } from "../../../src/infrastructure/runtime/daemon-process-hooks.js";
import type { DaemonLifetimeEvidencePort } from "../../../src/ports/index.js";
import type { DaemonLifetimeLaunch } from "../../../src/contracts/daemon-lifetime-contracts.js";
import type { DaemonShutdownReceipt } from "../../../src/contracts/daemon-shutdown-contracts.js";

class RecordingEvidence implements DaemonLifetimeEvidencePort {
  public readonly fatal: string[] = [];
  public readonly signals: string[] = [];
  public readonly exits: Array<number | null> = [];

  ready(_launch: DaemonLifetimeLaunch): void {}
  observeFatal(origin: "uncaughtException" | "unhandledRejection"): void {
    this.fatal.push(origin);
  }
  observeSignal(signal: "SIGTERM"): void {
    this.signals.push(signal);
  }
  observeExit(code: number | null): void {
    this.exits.push(code);
  }
  observeShutdown(_receipt: DaemonShutdownReceipt): void {}
  getEvidence() {
    return {
      status: "unavailable" as const,
      reason: "not_admitted" as const
    };
  }
}

describe("daemon process hooks", () => {
  it("observes fatal origins, SIGTERM, and exit without replacing process behavior", () => {
    const processTarget = new EventEmitter();
    const evidence = new RecordingEvidence();
    const dispose = installDaemonProcessHooks({
      evidence,
      process: processTarget as never
    });

    processTarget.emit("uncaughtExceptionMonitor", new Error("fatal"), "uncaughtException");
    processTarget.emit("uncaughtExceptionMonitor", new Error("rejection"), "unhandledRejection");
    processTarget.emit("SIGTERM");
    processTarget.emit("exit", 17);

    expect(evidence.fatal).toEqual(["uncaughtException", "unhandledRejection"]);
    expect(evidence.signals).toEqual(["SIGTERM"]);
    expect(evidence.exits).toEqual([17]);
    expect(processTarget.listenerCount("uncaughtExceptionMonitor")).toBe(1);
    expect(processTarget.listenerCount("SIGTERM")).toBe(1);
    expect(processTarget.listenerCount("exit")).toBe(1);

    dispose();
    expect(processTarget.listenerCount("uncaughtExceptionMonitor")).toBe(0);
    expect(processTarget.listenerCount("SIGTERM")).toBe(0);
    expect(processTarget.listenerCount("exit")).toBe(0);
  });

  it("contains sink failures inside process callbacks", () => {
    const processTarget = new EventEmitter();
    const evidence: DaemonLifetimeEvidencePort = {
      ready() {},
      observeFatal() { throw new Error("sink unavailable"); },
      observeSignal() { throw new Error("sink unavailable"); },
      observeExit() { throw new Error("sink unavailable"); },
      observeShutdown() { throw new Error("sink unavailable"); },
      getEvidence() { throw new Error("sink unavailable"); }
    };
    const dispose = installDaemonProcessHooks({
      evidence,
      process: processTarget as never
    });

    expect(() => processTarget.emit("uncaughtExceptionMonitor", new Error("fatal"), "uncaughtException"))
      .not.toThrow();
    expect(() => processTarget.emit("SIGTERM")).not.toThrow();
    expect(() => processTarget.emit("exit", 1)).not.toThrow();
    dispose();
  });
});
