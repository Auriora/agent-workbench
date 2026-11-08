/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Worker } from "node:worker_threads";
import { describe, expect, it, vi } from "vitest";
import { SnapshotRefreshController } from "../../src/infrastructure/runtime/refresh-controller.js";
import { StartupGraphRefreshExecutor } from "../../src/infrastructure/runtime/startup-graph-refresh-executor.js";
import type {
  ClockPort,
  DaemonRefreshActivityTransition,
  GraphBuildWatchPort,
  RefreshDeadlineSchedulerPort,
  RefreshExecutorPort,
  SnapshotPublicationPort,
  SnapshotPublicationTransition
} from "../../src/ports/index.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function harness(mode: "native-wait" | "python-parse") {
  const entered = deferred<void>();
  const exited = deferred<void>();
  const terminal = deferred<void>();
  const confirmed = deferred<void>();
  const confirmation = deferred<void>();
  const buffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 3);
  const state = new Int32Array(buffer);
  const events: string[] = [];
  const transitions: SnapshotPublicationTransition[] = [];
  const workerTerminations: string[] = [];
  let workerCount = 0;
  let now = Date.parse("2026-11-08T12:00:00.000Z");
  let fireDeadline!: () => void;
  let armedTimeout: number | undefined;
  const clock: ClockPort = {
    now: () => new Date(now),
    nowUnixMs: () => now,
    nowIso8601: () => new Date(now).toISOString()
  };
  const deadlineScheduler: RefreshDeadlineSchedulerPort = {
    arm({ deadline, onDeadline }) {
      armedTimeout = deadline.timeout_ms;
      let cancelled = false;
      fireDeadline = () => { if (!cancelled) onDeadline(); };
      return { cancel() { cancelled = true; } };
    }
  };
  const observe = () => ({ epoch: "native-overrun-watch", sequence: 0, healthy: true, pending_events: 0, covered_directories: ["."] });
  const observation: GraphBuildWatchPort = {
    start: async () => observe(), observe, drain: async () => observe(),
    registerDirectory: async () => observe(), close: async () => undefined
  };
  const production = new StartupGraphRefreshExecutor({
    database_path: "/unused/native-overrun.sqlite", config_identity: "native-overrun", max_files: 1,
    retain_latest_snapshots: 1, retain_latest_fresh_snapshots: 1,
    controller_generation: 11, observation,
    worker_factory({ workerData }) {
      workerCount += 1;
      const worker = new Worker(new URL("../fixtures/refresh-native-overrun/worker.mjs", import.meta.url), {
        workerData: { ...workerData, testMode: mode, testState: buffer,
          testExtractorUrl: new URL("../../src/infrastructure/tree-sitter/python-extractor.ts", import.meta.url).href }
      });
      worker.once("message", () => { events.push("native_entered"); entered.resolve(undefined); });
      worker.once("exit", () => { events.push("worker_exit"); exited.resolve(undefined); });
      return worker;
    }
  });
  const executor: RefreshExecutorPort = {
    run: input => production.run(input),
    async terminate(input) {
      workerTerminations.push(input.reason);
      await production.terminate(input);
      // Hold only confirmation, after real Worker.terminate has observed exit,
      // to deterministically exercise the controller's unconfirmed fence.
      await confirmation.promise;
    }
  };
  const publication: SnapshotPublicationPort = {
    allocateBuildSnapshotId: async () => "11001",
    getLatestPublished: async () => ({ status: "missing", reason: "no_published_snapshot" }),
    readExplicit: async () => ({ status: "blocked", snapshot_id: "11001", publication_state: "building",
      reason: "snapshot_unpublished", message: "Snapshot is not published." }),
    async transitionBuild(input) {
      transitions.push(input);
      return { repo_root: input.repo_root, snapshot_id: input.snapshot_id,
        controller_generation: input.controller_generation, invalidation_generation: input.invalidation_generation,
        state: input.to, updated_at: input.updated_at };
    }
  };
  const validation = {
    prepare: vi.fn(async () => { throw new Error("An overrun must not validate publication."); }),
    commit: vi.fn(() => { throw new Error("An overrun must not publish."); })
  };
  const controller = new SnapshotRefreshController({
    repo_root: "/native-overrun", controller_generation: 11, timeout_ms: 1_000,
    clock, executor, publication, validation, deadline_scheduler: deadlineScheduler,
    create_execution_id: () => "native-overrun-execution"
  });
  controller.onTransition((transition: DaemonRefreshActivityTransition) => {
    if (transition.state === "terminal") { events.push("terminal"); terminal.resolve(undefined); }
    if (transition.state === "termination_confirmed") { events.push("termination_confirmed"); confirmed.resolve(undefined); }
  });
  return { controller, entered, exited, terminal, confirmed, confirmation, state, events, transitions,
    workerTerminations, validation, workerCount: () => workerCount,
    expire() { expect(armedTimeout).toBe(1_000); now += 1_000; fireDeadline(); } };
}

describe("hard refresh deadlines during synchronous native work", () => {
  it.each(["native-wait", "python-parse"] as const)("fails %s without publishing or admitting a successor before termination confirmation", async mode => {
    const run = harness(mode);
    try {
      await expect(run.controller.request({ repo_root: "/native-overrun", reason: "startup", source: "test", invalidation_generation: 1 }))
        .resolves.toMatchObject({ outcome: "accepted", target_snapshot_id: "11001" });
      await run.entered.promise;
      expect(Atomics.load(run.state, 0)).toBe(1);
      if (mode === "python-parse") {
        expect(Atomics.load(run.state, 2)).toBeGreaterThan(1_800_000);
        expect(Atomics.load(run.state, 2)).toBeLessThan(2_000_000);
      }
      await expect(run.controller.request({ repo_root: "/native-overrun", reason: "watcher_invalidation", source: "coalesced", invalidation_generation: 2 }))
        .resolves.toMatchObject({ outcome: "reused", target_snapshot_id: "11001" });
      expect(run.workerCount()).toBe(1);
      // Controlled time advances only after the actual native call boundary;
      // the test has no tiny real-time timer or input-size-based sleep.
      run.expire();
      await run.terminal.promise;
      await run.exited.promise;
      expect(Atomics.load(run.state, 0)).toBe(1);
      expect(run.controller.getReceipt()).toMatchObject({ execution_state: "failed", worker_termination_state: "unconfirmed",
        worker_invocations: 1, last_failure: { code: "worker_timeout" } });
      await expect(run.controller.request({ repo_root: "/native-overrun", reason: "stale_first_read", source: "blocked-successor", invalidation_generation: 3 }))
        .resolves.toMatchObject({ outcome: "blocked", reason: "termination_unconfirmed" });
      expect(run.workerCount()).toBe(1);
      expect(run.workerTerminations).toEqual(["deadline"]);
      expect(run.transitions.map(transition => transition.to)).toEqual(["failed"]);
      expect(run.validation.prepare).not.toHaveBeenCalled();
      expect(run.validation.commit).not.toHaveBeenCalled();
      run.confirmation.resolve(undefined);
      await run.confirmed.promise;
      expect(run.events.indexOf("worker_exit")).toBeLessThan(run.events.indexOf("termination_confirmed"));
      expect(run.controller.getReceipt()).toMatchObject({ execution_state: "failed", worker_termination_state: "confirmed" });
    } finally {
      run.confirmation.resolve(undefined);
      await run.controller.shutdown();
    }
  }, 20_000);

  it("keeps shutdown pending until a blocked native worker exits and termination is confirmed", async () => {
    const run = harness("native-wait");
    try {
      await run.controller.request({ repo_root: "/native-overrun", reason: "startup", source: "shutdown-test", invalidation_generation: 1 });
      await run.entered.promise;
      expect(Atomics.load(run.state, 0)).toBe(1);
      let settled = false;
      const shutdown = run.controller.shutdown().then(() => { settled = true; });
      await run.exited.promise;
      expect(settled).toBe(false);
      expect(run.controller.getReceipt()).toMatchObject({ worker_termination_state: "unconfirmed" });
      await expect(run.controller.request({ repo_root: "/native-overrun", reason: "stale_first_read", source: "shutdown-successor", invalidation_generation: 2 }))
        .resolves.toMatchObject({ outcome: "blocked", reason: "controller_shutdown" });
      expect(run.workerCount()).toBe(1);
      expect(run.workerTerminations).toEqual(["controller_shutdown"]);
      expect(run.validation.prepare).not.toHaveBeenCalled();
      expect(run.validation.commit).not.toHaveBeenCalled();
      run.confirmation.resolve(undefined);
      await shutdown;
      expect(run.controller.getReceipt()).toMatchObject({ execution_state: "failed", worker_termination_state: "confirmed",
        last_failure: { code: "controller_shutdown" } });
      expect(run.events.indexOf("worker_exit")).toBeLessThan(run.events.indexOf("termination_confirmed"));
      expect(run.transitions.map(transition => transition.to)).toEqual(["failed"]);
    } finally {
      run.confirmation.resolve(undefined);
      await run.controller.shutdown();
    }
  });
});
