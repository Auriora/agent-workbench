/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, expectTypeOf, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import type { Worker } from "node:worker_threads";
import type {
  ClockPort,
  DaemonRefreshActivityTransition,
  RefreshActivityLease,
  RefreshDeadlineSchedulerPort,
  RefreshExecutorCompletion,
  RefreshExecutorPort,
  SnapshotPublicationPort,
  SnapshotPublicationRecord,
  SnapshotPublicationSelection,
  SnapshotPublicationTransition,
  SnapshotRefreshAdmission
} from "../../src/ports/index.js";
import type { FileContentHashBinding, SnapshotState } from "../../src/domain/models/runtime.js";
import {
  InMemoryCancellationAdapter,
  InMemoryRuntimeOperationsAdapter,
  SnapshotRefreshController
} from "../../src/infrastructure/runtime/index.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/index.js";
import { createDeadlineControllerHarness } from "../helpers/spec041-refresh-reproductions.js";
import { RepositoryRefreshTriggerCoordinator } from "../../src/application/use-cases/repository-refresh-triggers.js";
import { StartupGraphRefreshExecutor } from "../../src/infrastructure/runtime/startup-graph-refresh-executor.js";

class MutableClock implements ClockPort {
  private timestamp: number;

  constructor(initialIso: string) {
    this.timestamp = Date.parse(initialIso);
  }

  public now(): Date {
    return new Date(this.timestamp);
  }

  public nowIso8601(): string {
    return this.now().toISOString();
  }

  public nowUnixMs(): number {
    return this.timestamp;
  }

  public advance(ms: number): void {
    this.timestamp += ms;
  }
}

class ProtocolWorker extends EventEmitter {
  public terminationCalls = 0;
  public unref(): this { return this; }
  public async terminate(): Promise<number> {
    this.terminationCalls += 1;
    queueMicrotask(() => this.emit("exit", 1));
    return 1;
  }
}

function createProtocolExecutor(worker: ProtocolWorker): StartupGraphRefreshExecutor {
  return new StartupGraphRefreshExecutor({
    database_path: "/tmp/test.sqlite",
    config_identity: "test",
    max_files: 1,
    retain_latest_snapshots: 1,
    retain_latest_fresh_snapshots: 1,
    vacuum: false,
    controller_generation: 4,
    worker_factory: () => worker as unknown as Worker
  });
}

class ControlledRefreshExecutor implements RefreshExecutorPort {
  public readonly calls: Array<Parameters<RefreshExecutorPort["run"]>[0]> = [];
  public readonly terminations: Array<{ execution_id: string; reason: string }> = [];
  private readonly pending: Array<ReturnType<typeof controlledDeferred<RefreshExecutorCompletion>>> = [];
  private readonly callWaiters: Array<{
    count: number;
    barrier: ReturnType<typeof controlledDeferred<void>>;
  }> = [];

  constructor(
    private readonly terminationBehavior: "resolve" | "delayed" | "hang" | "reject" | "throw" = "resolve",
    private readonly runThrows = false
  ) {}
  private readonly delayedTermination = controlledDeferred<void>();

  public run(
    input: Parameters<RefreshExecutorPort["run"]>[0]
  ): Promise<RefreshExecutorCompletion> {
    if (this.runThrows) {
      throw new Error("synchronous executor failure");
    }
    this.calls.push(input);
    const pending = controlledDeferred<RefreshExecutorCompletion>();
    this.pending.push(pending);
    for (const waiter of this.callWaiters) {
      if (this.calls.length >= waiter.count) {
        waiter.barrier.resolve(undefined);
      }
    }
    return pending.promise;
  }

  public terminate(input: {
    execution_id: string;
    reason: "deadline" | "worker_error" | "controller_shutdown";
  }): Promise<void> {
    this.terminations.push(input);
    if (this.terminationBehavior === "throw") {
      throw new Error("synchronous termination failure");
    }
    if (this.terminationBehavior === "reject") {
      return Promise.reject(new Error("termination rejection"));
    }
    if (this.terminationBehavior === "hang") {
      return new Promise<void>(() => undefined);
    }
    if (this.terminationBehavior === "delayed") {
      return this.delayedTermination.promise;
    }
    return Promise.resolve();
  }

  public complete(index: number, completion?: RefreshExecutorCompletion): void {
    const call = this.calls[index];
    if (call === undefined) {
      throw new Error(`Worker invocation ${index} was not observed.`);
    }
    this.pending[index]?.resolve(
      completion ?? {
        exit_code: 0,
        results: [{
          outcome: "complete",
          execution_id: call.execution_id,
          target_snapshot_id: call.target_snapshot_id,
          completed_generation: call.generation
        }]
      }
    );
  }

  public fail(index: number): void {
    this.pending[index]?.reject(new Error("unsafe worker detail"));
  }

  public async waitForCalls(count: number): Promise<void> {
    if (this.calls.length >= count) {
      return;
    }
    const barrier = controlledDeferred<void>();
    this.callWaiters.push({ count, barrier });
    await barrier.promise;
  }

  public confirmTermination(): void {
    this.delayedTermination.resolve(undefined);
  }

  public async waitForTerminationConfirmation(): Promise<void> {
    await this.delayedTermination.promise;
  }
}

class ControlledDeadlineScheduler implements RefreshDeadlineSchedulerPort {
  private readonly deadlines: Array<{ active: boolean; fire: () => void }> = [];

  public arm(input: { onDeadline: () => void }) {
    const entry = { active: true, fire: input.onDeadline };
    this.deadlines.push(entry);
    return {
      cancel(): void {
        entry.active = false;
      }
    };
  }

  public fire(index: number): void {
    const deadline = this.deadlines[index];
    if (deadline?.active === true) {
      deadline.fire();
    }
  }

  public activeCount(): number {
    return this.deadlines.filter((deadline) => deadline.active).length;
  }
}

class ControlledPublicationPort implements SnapshotPublicationPort {
  public readonly transitions: SnapshotPublicationTransition[] = [];
  private readonly buildingSnapshotIds = new Set<string>();
  private failingState: SnapshotPublicationTransition["to"] | undefined;
  private deferredTransition: {
    state: SnapshotPublicationTransition["to"];
    entered: ReturnType<typeof controlledDeferred<void>>;
    release: ReturnType<typeof controlledDeferred<void>>;
  } | undefined;
  private allocationSequence = 1000;
  private allocationFails = false;
  private allocationFailureCode: string | undefined;
  private omitNextAllocatedBuild = false;
  private latestPublished: {
    snapshot: SnapshotState;
    publication: SnapshotPublicationRecord & { state: "published" };
  } | undefined;

  public async allocateBuildSnapshotId(): Promise<string> {
    if (this.allocationFails) {
      this.allocationFails = false;
      throw Object.assign(new Error("target allocation failure SENTINEL_SECRET"), {
        code: this.allocationFailureCode
      });
    }
    this.allocationSequence += 1;
    const snapshotId = String(this.allocationSequence);
    if (this.omitNextAllocatedBuild) {
      this.omitNextAllocatedBuild = false;
    } else {
      this.buildingSnapshotIds.add(snapshotId);
    }
    return snapshotId;
  }

  public async transitionBuild<TState extends SnapshotPublicationTransition["to"]>(
    input: SnapshotPublicationTransition & { to: TState }
  ): Promise<SnapshotPublicationRecord & { state: TState }> {
    this.transitions.push(input);
    if (this.deferredTransition?.state === input.to) {
      const deferred = this.deferredTransition;
      this.deferredTransition = undefined;
      deferred.entered.resolve(undefined);
      await deferred.release.promise;
    }
    if (this.failingState === input.to) {
      this.failingState = undefined;
      throw new Error("publication transition failed");
    }
    this.buildingSnapshotIds.delete(input.snapshot_id);
    const record = {
      repo_root: input.repo_root,
      snapshot_id: input.snapshot_id,
      controller_generation: 7,
      invalidation_generation: 0,
      state: input.to,
      updated_at: input.updated_at
    };
    if (input.to === "published") {
      this.latestPublished = {
        snapshot: {
          id: input.snapshot_id,
          repo_root: input.repo_root,
          workspace_root: input.repo_root,
          repo_identity: input.repo_root,
          config_identity: "test",
          schema_version: SCHEMA_VERSION,
          freshness: "fresh",
          owner_state: "owner",
          created_at: input.updated_at,
          updated_at: input.updated_at
        },
        publication: { ...record, state: "published" }
      };
    }
    return record;
  }

  public async getLatestPublished(): Promise<
    Exclude<SnapshotPublicationSelection, { status: "blocked" }>
  > {
    return this.latestPublished === undefined
      ? { status: "missing", reason: "no_published_snapshot" }
      : { status: "selected", ...this.latestPublished };
  }

  public async readExplicit(input: {
    snapshot_id: string;
  }): Promise<SnapshotPublicationSelection> {
    if (this.buildingSnapshotIds.has(input.snapshot_id)) {
      return {
        status: "blocked",
        snapshot_id: input.snapshot_id,
        publication_state: "building",
        reason: "snapshot_unpublished",
        message: "Snapshot is not published."
      };
    }
    return { status: "missing", snapshot_id: input.snapshot_id, reason: "snapshot_not_found" };
  }

  public failNext(state: SnapshotPublicationTransition["to"]): void {
    this.failingState = state;
  }

  public failNextAllocation(code?: string): void {
    this.allocationFails = true;
    this.allocationFailureCode = code;
  }

  public omitNextBuild(): void {
    this.omitNextAllocatedBuild = true;
  }

  public setLatestPublished(snapshotId: string, freshness: SnapshotState["freshness"]): void {
    const updatedAt = "2026-07-20T09:59:00.000Z";
    this.latestPublished = {
      snapshot: {
        id: snapshotId,
        repo_root: "/repo",
        workspace_root: "/repo",
        repo_identity: "/repo",
        config_identity: "test",
        schema_version: SCHEMA_VERSION,
        freshness,
        owner_state: "owner",
        created_at: updatedAt,
        updated_at: updatedAt
      },
      publication: {
        repo_root: "/repo",
        snapshot_id: snapshotId,
        controller_generation: 7,
        invalidation_generation: 0,
        state: "published",
        updated_at: updatedAt
      }
    };
  }

  public markLatestFreshness(freshness: SnapshotState["freshness"]): void {
    if (this.latestPublished === undefined) throw new Error("Missing published snapshot fixture.");
    this.latestPublished.snapshot = { ...this.latestPublished.snapshot, freshness };
  }

  public deferNext(state: SnapshotPublicationTransition["to"]): {
    entered: Promise<void>;
    release: () => void;
  } {
    const entered = controlledDeferred<void>();
    const release = controlledDeferred<void>();
    this.deferredTransition = { state, entered, release };
    return { entered: entered.promise, release: () => release.resolve(undefined) };
  }
}

function controlledDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function observeTerminal(controller: SnapshotRefreshController) {
  const barrier = controlledDeferred<Extract<
    DaemonRefreshActivityTransition,
    { state: "terminal" }
  >>();
  const unsubscribe = controller.onTransition((transition) => {
    if (transition.state === "terminal") {
      unsubscribe();
      barrier.resolve(transition);
    }
  });
  return barrier.promise;
}

async function waitForControllerState(
  controller: SnapshotRefreshController,
  state: "failed" | "complete"
): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (controller.getReceipt().execution_state === state) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for controller state ${state}.`);
}

function createControlledController(options?: {
  executor?: ControlledRefreshExecutor;
  deadlines?: ControlledDeadlineScheduler;
  publication?: ControlledPublicationPort;
}) {
  const clock = new MutableClock("2026-07-20T10:00:00.000Z");
  const executor = options?.executor ?? new ControlledRefreshExecutor();
  const deadlines = options?.deadlines ?? new ControlledDeadlineScheduler();
  const publication = options?.publication ?? new ControlledPublicationPort();
  let executionSequence = 0;
  const controller = new SnapshotRefreshController({
    repo_root: "/repo",
    controller_generation: 7,
    timeout_ms: 30_000,
    clock,
    executor,
    publication,
    deadline_scheduler: deadlines,
    create_execution_id: () => `exec-${++executionSequence}`
  });
  return { clock, executor, deadlines, publication, controller };
}

describe("runtime operation adapters", () => {
  it("settles the production worker protocol only after exit with every emitted message", async () => {
    const worker = new ProtocolWorker();
    const executor = createProtocolExecutor(worker);
    let settled = false;
    const completion = executor.run({
      repo_root: "/repo",
      execution_id: "exec-protocol",
      target_snapshot_id: "44",
      generation: 7,
      deadline: { timeout_ms: 1000, deadline_at: "2026-07-20T10:00:01.000Z" }
    }).then((value) => {
      settled = true;
      return value;
    });

    worker.emit("message", { type: "complete", result: { snapshot_id: "44" } });
    await Promise.resolve();
    expect(settled).toBe(false);
    worker.emit("message", { type: "complete", result: { snapshot_id: "44" } });
    worker.emit("exit", 0);

    await expect(completion).resolves.toMatchObject({ exit_code: 0, results: [{}, {}] });
    expect((await completion).results).toHaveLength(2);
  });

  it("retains a valid message alongside a later nonzero worker exit", async () => {
    const worker = new ProtocolWorker();
    const executor = createProtocolExecutor(worker);
    const completion = executor.run({
      repo_root: "/repo",
      execution_id: "exec-nonzero",
      target_snapshot_id: "45",
      generation: 8,
      deadline: { timeout_ms: 1000, deadline_at: "2026-07-20T10:00:01.000Z" }
    });
    worker.emit("message", { type: "complete", result: { snapshot_id: "45" } });
    worker.emit("exit", 2);
    await expect(completion).resolves.toMatchObject({ exit_code: 2, results: [{}] });
  });

  it("terminates a retained production worker exactly once", async () => {
    const worker = new ProtocolWorker();
    const executor = createProtocolExecutor(worker);
    const completion = executor.run({
      repo_root: "/repo",
      execution_id: "exec-terminate",
      target_snapshot_id: "46",
      generation: 9,
      deadline: { timeout_ms: 1000, deadline_at: "2026-07-20T10:00:01.000Z" }
    });
    await Promise.all([
      executor.terminate({ execution_id: "exec-terminate", reason: "worker_error" }),
      executor.terminate({ execution_id: "exec-terminate", reason: "worker_error" })
    ]);
    expect(worker.terminationCalls).toBe(1);
    await expect(completion).resolves.toEqual({ exit_code: 1, results: [] });
  });

  it("requires a finite positive controller deadline", () => {
    const clock = new MutableClock("2026-07-20T10:00:00.000Z");
    const executor = new ControlledRefreshExecutor();
    const publication = new ControlledPublicationPort();
    for (const timeout of [0, -1, Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(() => new SnapshotRefreshController({
        repo_root: "/repo",
        controller_generation: 1,
        timeout_ms: timeout,
        clock,
        executor,
        publication
      })).toThrow("timeout_ms must be a finite positive integer.");
    }
  });

  it("locks activity-lease settlement and blocked ownership admission shapes", () => {
    const heldLease = {
      execution_id: "exec-1",
      controller_generation: 2,
      acquired_at: "2026-07-19T12:00:00.000Z",
      state: "held"
    } satisfies RefreshActivityLease;
    const releasedLease = {
      ...heldLease,
      state: "released",
      released_at: "2026-07-19T12:00:01.000Z"
    } satisfies RefreshActivityLease;
    const activeOwner = {
      repo_root: "/repo",
      runtime_identity: "runtime-1",
      schema_version: 8,
      owner_id: "daemon-1",
      owner_pid: 1234,
      owner_generation: 2,
      heartbeat_at: "2026-07-19T12:00:00.000Z",
      state: "active"
    } as const;
    const admissions = [
      {
        outcome: "accepted",
        reused: false,
        execution_id: "exec-1",
        target_snapshot_id: "snap-1",
        state: "planned",
        started_generation: 1,
        requested_generation: 1
      },
      {
        outcome: "reused",
        reused: true,
        execution_id: "exec-1",
        target_snapshot_id: "snap-1",
        state: "planned",
        started_generation: 1,
        requested_generation: 2
      },
      {
        outcome: "reused",
        reused: true,
        execution_id: "exec-1",
        target_snapshot_id: "snap-1",
        state: "running",
        started_generation: 1,
        requested_generation: 2
      },
      {
        outcome: "blocked",
        reused: false,
        state: "idle",
        reason: "owner_active",
        message: "A healthy daemon already owns repository refresh execution.",
        owner: activeOwner
      },
      {
        outcome: "blocked",
        reused: false,
        state: "idle",
        reason: "ownership_ambiguous",
        message: "Repository refresh ownership cannot be established safely.",
        owner: { ...activeOwner, state: "ambiguous" }
      }
    ] satisfies SnapshotRefreshAdmission[];
    const transitions = [
      {
        execution_id: "exec-1",
        controller_generation: 2,
        state: "active",
        execution_state: "planned",
        lease: heldLease
      },
      {
        execution_id: "exec-1",
        controller_generation: 2,
        state: "active",
        execution_state: "running",
        lease: heldLease
      },
      {
        execution_id: "exec-1",
        controller_generation: 2,
        state: "terminal",
        execution_state: "complete",
        lease: releasedLease
      },
      {
        execution_id: "exec-1",
        controller_generation: 2,
        state: "terminal",
        execution_state: "failed",
        lease: releasedLease,
        failure: {
          code: "worker_error",
          category: "worker",
          message: "Refresh worker failed.",
          execution_id: "exec-1",
          target_snapshot_id: "snap-1",
          occurred_at: "2026-07-19T12:00:01.000Z"
        }
      }
    ] satisfies DaemonRefreshActivityTransition[];

    expect(heldLease).not.toHaveProperty("released_at");
    expect(releasedLease).toMatchObject({ state: "released" });
    expect(admissions.map((admission) => admission.outcome)).toEqual([
      "accepted",
      "reused",
      "reused",
      "blocked",
      "blocked"
    ]);
    expect(admissions[3]).toMatchObject({
      outcome: "blocked",
      reused: false,
      state: "idle",
      reason: "owner_active"
    });
    expect(admissions[3]).not.toHaveProperty("execution_id");
    expect(transitions.map((transition) => [transition.state, transition.execution_state])).toEqual([
      ["active", "planned"],
      ["active", "running"],
      ["terminal", "complete"],
      ["terminal", "failed"]
    ]);
    expectTypeOf<{
      outcome: "accepted";
      reused: false;
      execution_id: "exec";
      state: "running";
      started_generation: 1;
      requested_generation: 1;
    }>().not.toMatchTypeOf<SnapshotRefreshAdmission>();
    expectTypeOf<{
      outcome: "blocked";
      reused: false;
      state: "idle";
      reason: "owner_active";
      message: "blocked";
      owner: {
        repo_root: "/repo";
        runtime_identity: "runtime-1";
        schema_version: 8;
        owner_id: "daemon-1";
        owner_pid: 1234;
        owner_generation: 2;
        heartbeat_at: "2026-07-19T12:00:00.000Z";
        state: "ambiguous";
      };
    }>().not.toMatchTypeOf<SnapshotRefreshAdmission>();
    expectTypeOf<{
      execution_id: "exec";
      controller_generation: 1;
      acquired_at: "2026-07-19T12:00:00.000Z";
      state: "held";
      released_at: "2026-07-19T12:00:01.000Z";
    }>().not.toMatchTypeOf<RefreshActivityLease>();
    expectTypeOf<{
      execution_id: "exec";
      controller_generation: 1;
      state: "active";
      execution_state: "running";
      lease: typeof releasedLease;
    }>().not.toMatchTypeOf<DaemonRefreshActivityTransition>();
    expectTypeOf<{
      execution_id: "exec";
      controller_generation: 1;
      state: "terminal";
      execution_state: "complete";
      lease: typeof heldLease;
    }>().not.toMatchTypeOf<DaemonRefreshActivityTransition>();
    expectTypeOf<{
      execution_id: "exec";
      controller_generation: 1;
      state: "terminal";
      execution_state: "complete";
      lease: typeof releasedLease;
      failure: (typeof transitions)[3]["failure"];
    }>().not.toMatchTypeOf<DaemonRefreshActivityTransition>();
    expectTypeOf<{
      execution_id: "exec";
      controller_generation: 1;
      state: "terminal";
      execution_state: "failed";
      lease: typeof releasedLease;
    }>().not.toMatchTypeOf<DaemonRefreshActivityTransition>();
  });

  it("does not expose a forced path around admitted controller work", async () => {
    const { controller, executor } = createControlledController();
    const [ordinaryRequest, racingInvalidation] = await Promise.all([
      controller.request({
        repo_root: "/repo",
        reason: "startup",
        source: "startup",
        invalidation_generation: 1
      }),
      controller.request({
        repo_root: "/repo",
        reason: "watcher_invalidation",
        source: "watcher",
        invalidation_generation: 2
      })
    ]);

    expect(ordinaryRequest).toMatchObject({ outcome: "accepted", state: "planned" });
    expect(racingInvalidation).toMatchObject({
      outcome: "reused",
      execution_id: ordinaryRequest.outcome === "blocked" ? "" : ordinaryRequest.execution_id,
      requested_generation: 2
    });
    await executor.waitForCalls(1);
    expect(executor.calls).toHaveLength(1);
    expect(executor.calls[0]?.deadline).toEqual({
      timeout_ms: 30_000,
      deadline_at: "2026-07-20T10:00:30.000Z"
    });
  });

  it("linearizes requests and runs one coalesced newest-generation catch-up pass", async () => {
    const { controller, executor, deadlines, publication } = createControlledController();
    const transitions: DaemonRefreshActivityTransition[] = [];
    controller.onTransition((transition) => {
      transitions.push(transition);
    });

    const [first, duplicate] = await Promise.all([
      controller.request({
        repo_root: "/repo",
        reason: "startup",
        source: "startup",
        invalidation_generation: 1
      }),
      controller.request({
        repo_root: "/repo",
        reason: "stale_first_read",
        source: "client-2",
        invalidation_generation: 1
      })
    ]);
    expect(first).toMatchObject({ outcome: "accepted", state: "planned" });
    expect(duplicate).toMatchObject({
      outcome: "reused",
      execution_id: first.outcome === "blocked" ? "" : first.execution_id,
      started_generation: 1,
      requested_generation: 1
    });
    await executor.waitForCalls(1);
    expect(executor.calls).toHaveLength(1);

    const [generationTwo, generationFour] = await Promise.all([
      controller.request({
        repo_root: "/repo",
        reason: "watcher_invalidation",
        source: "watcher",
        invalidation_generation: 2
      }),
      controller.request({
        repo_root: "/repo",
        reason: "watcher_invalidation",
        source: "watcher",
        invalidation_generation: 4
      })
    ]);
    expect(generationTwo).toMatchObject({ outcome: "reused", started_generation: 1 });
    expect(generationFour).toMatchObject({
      outcome: "reused",
      started_generation: 1,
      requested_generation: 4
    });

    executor.complete(0);
    await executor.waitForCalls(2);
    expect(executor.calls.map((call) => call.generation)).toEqual([1, 4]);
    expect(executor.calls[1]?.execution_id).toBe(executor.calls[0]?.execution_id);
    expect(controller.getReceipt()).toMatchObject({
      execution_state: "running",
      started_generation: 4,
      requested_generation: 4,
      worker_invocations: 2,
      activity_lease: { state: "held" }
    });

    const completion = observeTerminal(controller);
    executor.complete(1);
    await completion;
    expect(controller.getReceipt()).toMatchObject({
      execution_state: "complete",
      started_generation: 4,
      requested_generation: 4,
      worker_invocations: 2,
      activity_lease: null
    });
    expect(transitions.map((transition) => [transition.state, transition.execution_state])).toEqual([
      ["active", "planned"],
      ["active", "running"],
      ["active", "running"],
      ["terminal", "complete"]
    ]);
    expect(transitions.at(-1)).toMatchObject({ lease: { state: "released" } });
    expect(deadlines.activeCount()).toBe(0);
    expect(publication.transitions.map((transition) => ({
      snapshot_id: transition.snapshot_id,
      to: transition.to
    }))).toEqual([
      { snapshot_id: "1001", to: "superseded" },
      { snapshot_id: "1002", to: "published" }
    ]);
  });

  it("advances diagnostics revision for a same-generation reused request", async () => {
    const { controller, executor } = createControlledController();
    await controller.request({
      repo_root: "/repo",
      reason: "startup",
      source: "startup",
      invalidation_generation: 1
    });
    await executor.waitForCalls(1);
    const before = await controller.getDiagnostics({ repo_root: "/repo" });

    await expect(controller.request({
      repo_root: "/repo",
      reason: "stale_first_read",
      source: "client-2",
      invalidation_generation: 1
    })).resolves.toMatchObject({
      outcome: "reused",
      requested_generation: 1
    });

    const after = await controller.getDiagnostics({ repo_root: "/repo" });
    expect(after.diagnostic_revision).toBe(before.diagnostic_revision + 1);
    expect(after.execution_id).toBe(before.execution_id);
    expect(executor.calls).toHaveLength(1);
  });

  it("publishes an ordinary successful build before releasing the execution lease", async () => {
    const { controller, executor, publication } = createControlledController();
    const observed: string[] = [];
    controller.onTransition((transition) => {
      if (transition.state === "terminal") {
        observed.push(`terminal:${transition.execution_state}`);
      }
    });
    const originalTransition = publication.transitionBuild.bind(publication);
    publication.transitionBuild = async (input) => {
      const result = await originalTransition(input);
      observed.push(`publication:${input.to}`);
      return result;
    };
    const terminal = observeTerminal(controller);
    await controller.request({
      repo_root: "/repo",
      reason: "startup",
      source: "test",
      invalidation_generation: 1
    });
    await executor.waitForCalls(1);
    executor.complete(0);
    await terminal;

    expect(observed).toEqual(["publication:published", "terminal:complete"]);
    expect(publication.transitions).toEqual([
      expect.objectContaining({ snapshot_id: "1001", to: "published" })
    ]);
  });

  it("serializes a racing request behind an in-flight publication decision", async () => {
    const { controller, executor, publication } = createControlledController();
    await controller.request({
      repo_root: "/repo",
      reason: "startup",
      source: "test",
      invalidation_generation: 1
    });
    await executor.waitForCalls(1);
    const publicationBarrier = publication.deferNext("published");
    const firstTerminal = observeTerminal(controller);
    executor.complete(0);
    await publicationBarrier.entered;

    const racingRequest = controller.request({
      repo_root: "/repo",
      reason: "watcher_invalidation",
      source: "watcher",
      invalidation_generation: 2
    });
    expect(controller.getReceipt()).toMatchObject({
      execution_state: "running",
      started_generation: 1,
      requested_generation: 1,
      activity_lease: { state: "held" }
    });

    publicationBarrier.release();
    await firstTerminal;
    const admission = await racingRequest;
    expect(admission).toMatchObject({
      outcome: "accepted",
      execution_id: "exec-2",
      started_generation: 2,
      requested_generation: 2
    });
    expect(publication.transitions).toEqual([
      expect.objectContaining({ snapshot_id: "1001", to: "published" })
    ]);
  });

  it("releases a failed execution when the worker exits before creating its build snapshot", async () => {
    const publication = new ControlledPublicationPort();
    publication.omitNextBuild();
    const { controller, executor, deadlines } = createControlledController({ publication });
    await controller.request({
      repo_root: "/repo",
      reason: "startup",
      source: "test",
      invalidation_generation: 1
    });
    await executor.waitForCalls(1);
    const terminal = observeTerminal(controller);
    executor.fail(0);
    await terminal;

    expect(controller.getReceipt()).toMatchObject({
      execution_state: "failed",
      activity_lease: null,
      last_failure: { code: "worker_error" }
    });
    expect(controller.getReceipt()).toMatchObject({
      target_snapshot_id: "1001",
      last_failure: { target_snapshot_id: undefined }
    });
    await expect(controller.getDiagnostics({ repo_root: "/repo" })).resolves.toMatchObject({
      execution_state: "failed",
      graph_freshness: "cold",
      activity_lease_held: false,
      last_failure: { code: "worker_error" }
    });
    expect(publication.transitions).toHaveLength(0);
    expect(deadlines.activeCount()).toBe(0);
  });

  it.each([
    {
      name: "worker error",
      settle: (executor: ControlledRefreshExecutor) => executor.fail(0),
      code: "worker_error"
    },
    {
      name: "non-zero exit",
      settle: (executor: ControlledRefreshExecutor) =>
        executor.complete(0, { exit_code: 2, results: [] }),
      code: "worker_error"
    },
    {
      name: "zero exit without result",
      settle: (executor: ControlledRefreshExecutor) =>
        executor.complete(0, { exit_code: 0, results: [] }),
      code: "worker_exit_without_result"
    },
    {
      name: "invalid result",
      settle: (executor: ControlledRefreshExecutor) =>
        executor.complete(0, { exit_code: 0, results: [{ outcome: "complete" }] }),
      code: "invalid_worker_result"
    },
    {
      name: "more than one result",
      settle: (executor: ControlledRefreshExecutor) =>
        executor.complete(0, { exit_code: 0, results: [{}, {}] }),
      code: "invalid_worker_result"
    }
  ])("settles $name once and releases its activity lease", async ({ settle, code }) => {
    const { controller, executor, deadlines, publication } = createControlledController();
    const terminal: DaemonRefreshActivityTransition[] = [];
    controller.onTransition((transition) => {
      if (transition.state === "terminal") {
        terminal.push(transition);
      }
    });
    await controller.request({
      repo_root: "/repo",
      reason: "startup",
      source: "test",
      invalidation_generation: 1
    });
    await executor.waitForCalls(1);
    const terminalBarrier = observeTerminal(controller);
    settle(executor);
    await terminalBarrier;

    expect(controller.getReceipt()).toMatchObject({
      execution_state: "failed",
      activity_lease: null,
      last_failure: { code }
    });
    expect(terminal).toHaveLength(1);
    expect(terminal[0]).toMatchObject({
      state: "terminal",
      execution_state: "failed",
      lease: { state: "released" },
      failure: { code }
    });
    expect(executor.terminations).toEqual([
      { execution_id: "exec-1", reason: "worker_error" }
    ]);
    expect(deadlines.activeCount()).toBe(0);
    expect(publication.transitions).toEqual([
      expect.objectContaining({ snapshot_id: "1001", to: "failed" })
    ]);
  });

  it.each(["hang", "reject", "throw"] as const)(
    "settles deadline failure immediately when terminate %s",
    async (terminationBehavior) => {
      const executor = new ControlledRefreshExecutor(terminationBehavior);
      const { controller, deadlines, publication } = createControlledController({ executor });
      const terminal = observeTerminal(controller);
      await controller.request({
        repo_root: "/repo",
        reason: "startup",
        source: "test",
        invalidation_generation: 1
      });
      await executor.waitForCalls(1);
      deadlines.fire(0);
      await terminal;

      expect(executor.terminations).toEqual([{ execution_id: "exec-1", reason: "deadline" }]);
      expect(controller.getReceipt()).toMatchObject({
        execution_state: "failed",
        activity_lease: null,
        last_failure: {
          code: "worker_timeout",
          category: "worker",
          message: "Refresh worker deadline expired."
        }
      });
      expect(deadlines.activeCount()).toBe(0);
      expect(publication.transitions).toEqual([
        expect.objectContaining({ snapshot_id: "1001", to: "failed" })
      ]);
      await expect(controller.request({
        repo_root: "/repo",
        reason: "stale_first_read",
        source: "later-client",
        invalidation_generation: 2
      })).resolves.toMatchObject({
        outcome: "blocked",
        reason: "termination_unconfirmed",
        execution_id: "exec-1"
      });
      expect(executor.calls).toHaveLength(1);
    }
  );

  it("admits no successor until delayed worker termination is confirmed", async () => {
    const executor = new ControlledRefreshExecutor("delayed");
    const { controller, deadlines } = createControlledController({ executor });
    const terminal = observeTerminal(controller);
    await controller.request({
      repo_root: "/repo",
      reason: "startup",
      source: "test",
      invalidation_generation: 1
    });
    await executor.waitForCalls(1);
    deadlines.fire(0);
    await terminal;

    const unconfirmed = await controller.getDiagnostics({ repo_root: "/repo" });
    expect(unconfirmed).toMatchObject({
      execution_state: "failed",
      worker_termination_state: "unconfirmed",
      last_failure: { code: "worker_timeout" }
    });

    await expect(controller.request({
      repo_root: "/repo",
      reason: "stale_first_read",
      source: "blocked-client",
      invalidation_generation: 2
    })).resolves.toMatchObject({
      outcome: "blocked",
      reason: "termination_unconfirmed",
      execution_id: "exec-1"
    });
    expect(executor.calls).toHaveLength(1);

    executor.confirmTermination();
    await executor.waitForTerminationConfirmation();
    const confirmed = await controller.getDiagnostics({ repo_root: "/repo" });
    expect(confirmed).toMatchObject({
      execution_state: "failed",
      worker_termination_state: "confirmed",
      last_failure: unconfirmed.last_failure
    });
    expect(confirmed.diagnostic_revision).toBeGreaterThan(unconfirmed.diagnostic_revision);
    const successor = await controller.request({
      repo_root: "/repo",
      reason: "stale_first_read",
      source: "later-client",
      invalidation_generation: 2
    });
    expect(successor).toMatchObject({
      outcome: "accepted",
      execution_id: "exec-2",
      started_generation: 2
    });
    await executor.waitForCalls(2);
    expect(executor.calls.map((call) => call.execution_id)).toEqual(["exec-1", "exec-2"]);
  });

  it("contains synchronous executor failure and cancels its armed deadline", async () => {
    const executor = new ControlledRefreshExecutor("resolve", true);
    const deadlines = new ControlledDeadlineScheduler();
    const { controller, publication } = createControlledController({ executor, deadlines });
    const terminal = observeTerminal(controller);
    await controller.request({
      repo_root: "/repo",
      reason: "startup",
      source: "test",
      invalidation_generation: 1
    });
    await terminal;

    expect(deadlines.activeCount()).toBe(0);
    expect(executor.terminations).toEqual([
      { execution_id: "exec-1", reason: "worker_error" }
    ]);
    expect(controller.getReceipt()).toMatchObject({
      execution_state: "failed",
      activity_lease: null,
      last_failure: {
        code: "worker_error"
      }
    });
    expect(publication.transitions).toEqual([
      expect.objectContaining({ snapshot_id: "1001", to: "failed" })
    ]);
    expect(executor.calls).toHaveLength(0);
  });

  it("contains synchronous deadline-scheduler failure without launching the worker", async () => {
    const clock = new MutableClock("2026-07-20T10:00:00.000Z");
    const executor = new ControlledRefreshExecutor();
    const controller = new SnapshotRefreshController({
      repo_root: "/repo",
      controller_generation: 1,
      timeout_ms: 30_000,
      clock,
      executor,
      publication: new ControlledPublicationPort(),
      deadline_scheduler: {
        arm(): never {
          throw new Error("scheduler failure");
        }
      },
      create_execution_id: () => "exec-scheduler"
    });
    const terminal = observeTerminal(controller);
    await controller.request({
      repo_root: "/repo",
      reason: "startup",
      source: "test",
      invalidation_generation: 1
    });
    await terminal;

    expect(executor.calls).toHaveLength(0);
    expect(executor.terminations).toHaveLength(0);
    expect(controller.getReceipt()).toMatchObject({
      execution_state: "failed",
      activity_lease: null,
      last_failure: { code: "worker_error" }
    });
  });

  it("isolates throwing transition listeners from successful settlement", async () => {
    const { controller, executor } = createControlledController();
    controller.onTransition(() => {
      throw new Error("observer failure");
    });
    const terminal = observeTerminal(controller);
    await controller.request({
      repo_root: "/repo",
      reason: "startup",
      source: "test",
      invalidation_generation: 1
    });
    await executor.waitForCalls(1);
    executor.complete(0);
    await terminal;

    expect(controller.getReceipt()).toMatchObject({
      execution_state: "complete",
      activity_lease: null
    });
  });

  it("contains rejected asynchronous transition observers without awaiting them", async () => {
    const { controller, executor, deadlines, publication } = createControlledController();
    controller.onTransition(async () => {
      throw new Error("asynchronous observer failure");
    });
    const terminal = observeTerminal(controller);
    await controller.request({
      repo_root: "/repo",
      reason: "startup",
      source: "test",
      invalidation_generation: 1
    });
    await executor.waitForCalls(1);
    executor.complete(0);
    await terminal;

    expect(controller.getReceipt()).toMatchObject({
      execution_state: "complete",
      activity_lease: null
    });
    expect(deadlines.activeCount()).toBe(0);
    expect(publication.transitions).toEqual([
      expect.objectContaining({ snapshot_id: "1001", to: "published" })
    ]);
  });

  it("contains target allocation failure during catch-up and releases the lease", async () => {
    const publication = new ControlledPublicationPort();
    const { controller, executor } = createControlledController({ publication });
    await controller.request({
      repo_root: "/repo",
      reason: "startup",
      source: "test",
      invalidation_generation: 1
    });
    await executor.waitForCalls(1);
    await controller.request({
      repo_root: "/repo",
      reason: "watcher_invalidation",
      source: "watcher",
      invalidation_generation: 2
    });
    publication.failNextAllocation();
    const terminal = observeTerminal(controller);
    executor.complete(0);
    await terminal;

    expect(executor.calls).toHaveLength(1);
    expect(controller.getReceipt()).toMatchObject({
      execution_state: "failed",
      activity_lease: null,
      last_failure: {
        code: "store_failure",
        category: "store",
        message: "Refresh store operation failed."
      }
    });
    expect(JSON.stringify(controller.getReceipt())).not.toContain("target allocation failure");
    expect(executor.terminations).toHaveLength(0);
    expect(publication.transitions).toEqual([
      expect.objectContaining({ snapshot_id: "1001", to: "superseded" })
    ]);

    const successor = await controller.request({
      repo_root: "/repo",
      reason: "stale_first_read",
      source: "later-client",
      invalidation_generation: 2
    });
    expect(successor).toMatchObject({
      outcome: "accepted",
      execution_id: "exec-2",
      started_generation: 2
    });
    await executor.waitForCalls(2);
  });

  it("refuses initial target allocation failure before acquiring an activity lease", async () => {
    const publication = new ControlledPublicationPort();
    publication.failNextAllocation();
    const { controller, executor } = createControlledController({ publication });

    const refusal = await controller.request({
      repo_root: "/repo",
      reason: "startup",
      source: "test",
      invalidation_generation: 1
    });
    expect(refusal).toEqual({
      outcome: "blocked",
      reused: false,
      state: "idle",
      reason: "store_failure",
      message: "Refresh store operation failed."
    });
    expect(JSON.stringify(refusal)).not.toContain("target allocation failure");
    expect(executor.calls).toHaveLength(0);
    expect(executor.terminations).toHaveLength(0);
    expect(publication.transitions).toHaveLength(0);
    expect(controller.getReceipt()).toMatchObject({
      execution_state: "failed",
      started_generation: 1,
      requested_generation: 1,
      activity_lease: null,
      last_failure: { code: "store_failure", category: "store" }
    });

    const laterAdmission = await controller.request({
      repo_root: "/repo",
      reason: "stale_first_read",
      source: "later-client",
      invalidation_generation: 1
    });
    expect(laterAdmission).toMatchObject({
      outcome: "accepted",
      execution_id: "exec-2",
      started_generation: 1
    });
    await executor.waitForCalls(1);
  });

  it("classifies permission-denied allocation through the closed safe failure envelope", async () => {
    const publication = new ControlledPublicationPort();
    publication.failNextAllocation("EACCES");
    const { controller } = createControlledController({ publication });

    await expect(controller.request({
      repo_root: "/repo",
      reason: "startup",
      source: "test",
      invalidation_generation: 1
    })).resolves.toEqual({
      outcome: "blocked",
      reused: false,
      state: "idle",
      reason: "permission_failure",
      message: "Refresh operation was not permitted."
    });
    const diagnostics = await controller.getDiagnostics({ repo_root: "/repo" });
    expect(diagnostics.last_failure).toMatchObject({
      code: "permission_failure",
      category: "permission",
      message: "Refresh operation was not permitted."
    });
    expect(JSON.stringify(diagnostics)).not.toContain("SENTINEL_SECRET");
  });

  it("allocates and publishes one exact numeric build row through the real graph store", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "awb-refresh-controller-"));
    const store = openGraphStore(path.join(directory, "graph.sqlite"));
    const clock = new MutableClock("2026-07-20T10:00:00.000Z");
    const priorId = String(clock.nowUnixMs() + 10);
    const expectedTargetId = String(Number(priorId) + 1);
    const deadlines = new ControlledDeadlineScheduler();
    const executor: RefreshExecutorPort = {
      async run(input) {
        await store.createBuildSnapshot({
          snapshot: {
            id: input.target_snapshot_id,
            repo_root: "/repo",
            workspace_root: "/repo",
            repo_identity: "/repo",
            config_identity: "default",
            schema_version: SCHEMA_VERSION,
            freshness: "refreshing",
            owner_state: "owner",
            created_at: clock.nowIso8601(),
            updated_at: clock.nowIso8601()
          },
          controller_generation: 9,
          invalidation_generation: input.generation,
          created_at: clock.nowIso8601()
        });
        return {
          exit_code: 0,
          results: [{
            outcome: "complete",
            execution_id: input.execution_id,
            target_snapshot_id: input.target_snapshot_id,
            completed_generation: input.generation
          }]
        };
      },
      async terminate() {}
    };
    try {
      await store.upsertSnapshot({
        snapshot: {
          id: priorId,
          repo_root: "/repo",
          workspace_root: "/repo",
          repo_identity: "/repo",
          config_identity: "default",
          schema_version: SCHEMA_VERSION,
          freshness: "fresh",
          owner_state: "owner",
          created_at: clock.nowIso8601(),
          updated_at: clock.nowIso8601()
        }
      });
      const controller = new SnapshotRefreshController({
        repo_root: "/repo",
        controller_generation: 9,
        timeout_ms: 30_000,
        clock,
        executor,
        publication: store,
        deadline_scheduler: deadlines,
        create_execution_id: () => "exec-real-store"
      });
      const terminal = observeTerminal(controller);
      const admission = await controller.request({
        repo_root: "/repo",
        reason: "startup",
        source: "integration-test",
        invalidation_generation: 3
      });
      await terminal;

      expect(admission).toMatchObject({
        outcome: "accepted",
        target_snapshot_id: expectedTargetId
      });
      expect(await store.getLatestPublished({ repo_root: "/repo" })).toMatchObject({
        status: "selected",
        snapshot: { id: expectedTargetId },
        publication: { controller_generation: 9, invalidation_generation: 3 }
      });
      expect(store.db.prepare("SELECT id, publication_state FROM snapshots ORDER BY id").all()).toEqual([
        { id: Number(priorId), publication_state: "published" },
        { id: Number(expectedTargetId), publication_state: "published" }
      ]);

      const staleTargetId = await store.allocateBuildSnapshotId({
        repo_root: "/repo",
        minimum_id: expectedTargetId
      });
      await store.createBuildSnapshot({
        snapshot: {
          id: staleTargetId,
          repo_root: "/repo",
          workspace_root: "/repo",
          repo_identity: "/repo",
          config_identity: "default",
          schema_version: SCHEMA_VERSION,
          freshness: "refreshing",
          owner_state: "owner",
          created_at: clock.nowIso8601(),
          updated_at: clock.nowIso8601()
        },
        controller_generation: 12,
        invalidation_generation: 5,
        created_at: clock.nowIso8601()
      });
      await expect(store.transitionBuild({
        repo_root: "/repo",
        snapshot_id: staleTargetId,
        controller_generation: 11,
        invalidation_generation: 5,
        from: "building",
        to: "published",
        updated_at: clock.nowIso8601()
      })).rejects.toThrow("publication generation does not match");
      await expect(store.transitionBuild({
        repo_root: "/repo",
        snapshot_id: staleTargetId,
        controller_generation: 12,
        invalidation_generation: 6,
        from: "building",
        to: "published",
        updated_at: clock.nowIso8601()
      })).rejects.toThrow("publication generation does not match");
      await expect(store.createBuildSnapshot({
        snapshot: {
          id: staleTargetId,
          repo_root: "/repo",
          workspace_root: "/repo",
          repo_identity: "/repo",
          config_identity: "default",
          schema_version: SCHEMA_VERSION,
          freshness: "refreshing",
          owner_state: "owner",
          created_at: clock.nowIso8601(),
          updated_at: clock.nowIso8601()
        },
        controller_generation: 13,
        invalidation_generation: 6,
        created_at: clock.nowIso8601()
      })).rejects.toThrow("Snapshot id already exists");
      await expect(store.readExplicit({
        repo_root: "/repo",
        snapshot_id: staleTargetId
      })).resolves.toMatchObject({ status: "blocked", publication_state: "building" });
    } finally {
      store.close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each([
    { field: "execution_id", value: "another-execution" },
    { field: "target_snapshot_id", value: "another-snapshot" },
    { field: "completed_generation", value: 99 }
  ] as const)("rejects an otherwise valid result with mismatched $field", async ({ field, value }) => {
    const { controller, executor, deadlines, publication } = createControlledController();
    await controller.request({
      repo_root: "/repo",
      reason: "startup",
      source: "test",
      invalidation_generation: 1
    });
    await executor.waitForCalls(1);
    const call = executor.calls[0]!;
    const terminal = observeTerminal(controller);
    executor.complete(0, {
      exit_code: 0,
      results: [{
        outcome: "complete",
        execution_id: call.execution_id,
        target_snapshot_id: call.target_snapshot_id,
        completed_generation: call.generation,
        [field]: value
      }]
    });
    await terminal;

    expect(controller.getReceipt()).toMatchObject({
      execution_state: "failed",
      activity_lease: null,
      last_failure: { code: "invalid_worker_result" }
    });
    expect(executor.terminations).toEqual([
      { execution_id: "exec-1", reason: "worker_error" }
    ]);
    expect(deadlines.activeCount()).toBe(0);
    expect(publication.transitions).toEqual([
      expect.objectContaining({ snapshot_id: "1001", to: "failed" })
    ]);
  });

  it("reports store failure when final publication fails without terminating a valid worker", async () => {
    const { controller, executor, deadlines, publication } = createControlledController();
    publication.failNext("published");
    const terminal = observeTerminal(controller);
    await controller.request({
      repo_root: "/repo",
      reason: "startup",
      source: "test",
      invalidation_generation: 1
    });
    await executor.waitForCalls(1);
    executor.complete(0);
    await terminal;

    expect(controller.getReceipt()).toMatchObject({
      execution_state: "failed",
      activity_lease: null,
      last_failure: { code: "store_failure", category: "store" }
    });
    expect(publication.transitions).toEqual([
      expect.objectContaining({ snapshot_id: "1001", to: "published" }),
      expect.objectContaining({ snapshot_id: "1001", to: "failed" })
    ]);
    expect(executor.terminations).toHaveLength(0);
    expect(deadlines.activeCount()).toBe(0);
  });

  it("quarantines failed-build settlement until one later request cleans it and admits a successor", async () => {
    const { controller, executor, deadlines, publication } = createControlledController();
    publication.failNext("failed");
    await controller.request({
      repo_root: "/repo",
      reason: "startup",
      source: "test",
      invalidation_generation: 1
    });
    await executor.waitForCalls(1);
    executor.fail(0);
    await waitForControllerState(controller, "failed");

    expect(controller.getReceipt()).toMatchObject({
      execution_state: "failed",
      activity_lease: { state: "held" },
      last_failure: { code: "store_failure", category: "store" }
    });
    expect(publication.transitions).toEqual([
      expect.objectContaining({ snapshot_id: "1001", to: "failed" })
    ]);
    expect(executor.terminations).toEqual([
      { execution_id: "exec-1", reason: "worker_error" }
    ]);
    expect(deadlines.activeCount()).toBe(0);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(executor.calls).toHaveLength(1);
    expect(publication.transitions).toEqual([
      expect.objectContaining({ snapshot_id: "1001", to: "failed" })
    ]);

    await expect(controller.request({
      repo_root: "/repo",
      reason: "stale_first_read",
      source: "later-client",
      invalidation_generation: 2
    })).resolves.toMatchObject({
      outcome: "accepted",
      execution_id: "exec-2",
      started_generation: 2
    });
    await executor.waitForCalls(2);
    expect(executor.calls).toHaveLength(2);
    expect(publication.transitions).toEqual([
      expect.objectContaining({ snapshot_id: "1001", to: "failed" }),
      expect.objectContaining({ snapshot_id: "1001", to: "failed" })
    ]);
  });

  it("does not retry after failure and admits one successor only on a later request", async () => {
    const { controller, executor, clock } = createControlledController();
    const first = await controller.request({
      repo_root: "/repo",
      reason: "startup",
      source: "test",
      invalidation_generation: 1
    });
    await executor.waitForCalls(1);
    const failed = observeTerminal(controller);
    executor.fail(0);
    await failed;
    clock.advance(120_000);
    expect(executor.calls).toHaveLength(1);
    expect(controller.getReceipt()).toMatchObject({ execution_state: "failed" });

    const [successor, reused] = await Promise.all([
      controller.request({
        repo_root: "/repo",
        reason: "stale_first_read",
        source: "client-1",
        invalidation_generation: 2
      }),
      controller.request({
        repo_root: "/repo",
        reason: "stale_first_read",
        source: "client-2",
        invalidation_generation: 2
      })
    ]);
    expect(successor).toMatchObject({ outcome: "accepted", started_generation: 2 });
    expect(reused).toMatchObject({
      outcome: "reused",
      execution_id: successor.outcome === "blocked" ? "" : successor.execution_id
    });
    expect(successor.outcome === "blocked" ? "" : successor.execution_id).not.toBe(
      first.outcome === "blocked" ? "" : first.execution_id
    );
    await executor.waitForCalls(2);
    expect(executor.calls).toHaveLength(2);
    const completed = observeTerminal(controller);
    executor.complete(1);
    await completed;
    expect(controller.getReceipt()).toMatchObject({
      execution_state: "complete",
      last_failure: undefined
    });
  });

  it("fails active work when the finite controller deadline expires", async () => {
    const clock = new MutableClock("2026-05-31T12:00:00.000Z");
    const controller = createDeadlineControllerHarness(clock);
    await controller.start();
    await controller.workerStarted.promise;
    expect(controller.receipt()).toMatchObject({
      execution_id: "exec-deadline",
      state: "running",
      activity_lease_held: true,
      worker_invocations: 1,
      terminate_invocations: 0
    });

    clock.advance(30_001);
    await controller.fireDeadlineBarrier();

    expect(controller.receipt()).toMatchObject({
      execution_id: "exec-deadline",
      state: "failed",
      activity_lease_held: false,
      worker_invocations: 1,
      terminate_invocations: 1,
      failure_code: "worker_timeout"
    });
  });

  it("settles a deadline race once even when the worker reports a late result", async () => {
    const { controller, executor, deadlines, publication } = createControlledController();
    const terminal: DaemonRefreshActivityTransition[] = [];
    controller.onTransition((transition) => {
      if (transition.state === "terminal") {
        terminal.push(transition);
      }
    });
    await controller.request({
      repo_root: "/repo",
      reason: "startup",
      source: "test",
      invalidation_generation: 1
    });
    await executor.waitForCalls(1);
    const terminalBarrier = observeTerminal(controller);
    deadlines.fire(0);
    executor.complete(0);
    await terminalBarrier;

    expect(executor.terminations).toEqual([{ execution_id: "exec-1", reason: "deadline" }]);
    expect(terminal).toHaveLength(1);
    expect(terminal[0]).toMatchObject({
      execution_state: "failed",
      failure: { code: "worker_timeout" },
      lease: { state: "released" }
    });
    expect(controller.getReceipt()).toMatchObject({
      execution_state: "failed",
      last_failure: { code: "worker_timeout" }
    });
    expect(deadlines.activeCount()).toBe(0);
    expect(publication.transitions).toEqual([
      expect.objectContaining({ snapshot_id: "1001", to: "failed" })
    ]);
  });

  it("admits exactly one successor only after a later request observes failed work", async () => {
    const clock = new MutableClock("2026-05-31T12:00:00.000Z");
    const runtime = new InMemoryRuntimeOperationsAdapter({ clock });
    const failedExecution = await runtime.requestWarmup({
      repo_root: "/repo",
      snapshot_id: "snap-failed"
    });
    await runtime.completeWarmup({
      execution_id: failedExecution,
      success: false,
      reason: "safe failure"
    });

    // Reads and clock progress are explicit non-admission barriers.
    clock.advance(60_000);
    await expect(runtime.getState({ repo_root: "/repo" })).resolves.toMatchObject({
      execution_id: failedExecution,
      state: "failed"
    });

    const [firstLaterRequest, concurrentLaterRequest] = await Promise.all([
      runtime.requestWarmup({ repo_root: "/repo", snapshot_id: "snap-successor" }),
      runtime.requestWarmup({ repo_root: "/repo", snapshot_id: "snap-successor" })
    ]);
    expect(firstLaterRequest).not.toBe(failedExecution);
    expect(concurrentLaterRequest).toBe(firstLaterRequest);
  });

  it("bounds, redacts, retains, and atomically clears controller failure evidence", async () => {
    const publication = new ControlledPublicationPort();
    publication.setLatestPublished("snap-prior", "stale");
    const { controller, executor } = createControlledController({ publication });

    const firstTerminal = observeTerminal(controller);
    await controller.request({
      repo_root: "/repo",
      reason: "startup",
      source: "test",
      invalidation_generation: 1
    });
    await executor.waitForCalls(1);
    executor.fail(0);
    await firstTerminal;

    const failed = await controller.getDiagnostics({ repo_root: "/repo" });
    expect(failed).toMatchObject({
      execution_state: "failed",
      publication_state: "failed",
      visible_snapshot_id: "snap-prior",
      graph_freshness: "stale",
      last_failure: {
        code: "worker_error",
        category: "worker",
        message: "Refresh worker failed.",
        execution_id: "exec-1",
        target_snapshot_id: "1001"
      }
    });
    expect(Buffer.byteLength(failed.last_failure?.message ?? "", "utf8")).toBeLessThanOrEqual(512);
    expect(JSON.stringify(failed.last_failure)).not.toMatch(
      /unsafe worker detail|private\/workspace|API_TOKEN|SELECT \*|at worker/
    );

    await Promise.resolve();
    const successorTerminal = observeTerminal(controller);
    await expect(controller.request({
      repo_root: "/repo",
      reason: "stale_first_read",
      source: "later-client",
      invalidation_generation: 2
    })).resolves.toMatchObject({ outcome: "accepted", execution_id: "exec-2" });
    await executor.waitForCalls(2);
    const successor = await controller.getDiagnostics({ repo_root: "/repo" });
    expect(successor.execution_state).toBe("running");
    expect(successor.last_failure).toEqual(failed.last_failure);
    expect(successor.diagnostic_revision).toBeGreaterThan(failed.diagnostic_revision);

    executor.complete(1);
    await successorTerminal;
    const complete = await controller.getDiagnostics({ repo_root: "/repo" });
    expect(complete).toMatchObject({
      execution_state: "complete",
      publication_state: "published",
      target_snapshot_id: "1002",
      visible_snapshot_id: "1002",
      graph_freshness: "fresh",
      worker_termination_state: "not_required"
    });
    expect(complete.last_failure).toBeUndefined();
    expect(complete.diagnostic_revision).toBeGreaterThan(successor.diagnostic_revision);
  });

  it("reports authoritative failure after startup invalidates a fresh visible snapshot", async () => {
    const publication = new ControlledPublicationPort();
    publication.setLatestPublished("snap-prior", "fresh");
    const { controller, executor } = createControlledController({ publication });
    const triggers = new RepositoryRefreshTriggerCoordinator({
      repo_root: "/repo",
      controller,
      publications: publication,
      snapshots: {
        async markSnapshotFreshness(input) {
          expect(input).toMatchObject({
            snapshot_id: "snap-prior",
            freshness: "stale",
            reason: "startup_refresh_requested"
          });
          publication.markLatestFreshness(input.freshness);
        }
      }
    });

    const terminal = observeTerminal(controller);
    await triggers.startup({ source: "daemon-startup" });
    await executor.waitForCalls(1);
    expect(await controller.getDiagnostics({ repo_root: "/repo" })).toMatchObject({
      execution_state: "running",
      visible_snapshot_id: "snap-prior",
      graph_freshness: "stale",
      activity_lease_held: true
    });

    executor.fail(0);
    await terminal;
    expect(await controller.getDiagnostics({ repo_root: "/repo" })).toMatchObject({
      execution_state: "failed",
      publication_state: "failed",
      visible_snapshot_id: "snap-prior",
      graph_freshness: "stale",
      activity_lease_held: false,
      last_failure: {
        code: "worker_error",
        message: "Refresh worker failed."
      }
    });
  });

  it("records safe authoritative failure when startup freshness invalidation is unavailable", async () => {
    const publication = new ControlledPublicationPort();
    publication.setLatestPublished("snap-prior", "fresh");
    const { controller, executor } = createControlledController({ publication });
    const triggers = new RepositoryRefreshTriggerCoordinator({
      repo_root: "/repo",
      controller,
      publications: publication,
      snapshots: {
        async markSnapshotFreshness() {
          throw new Error("API_TOKEN=secret SELECT * FROM snapshots at /private/workspace");
        }
      }
    });

    await expect(triggers.startup({ source: "daemon-startup" })).resolves.toMatchObject({
      outcome: "blocked",
      reason: "store_failure",
      message: "Refresh store operation failed."
    });
    expect(executor.calls).toHaveLength(0);
    const diagnostics = await controller.getDiagnostics({ repo_root: "/repo" });
    expect(diagnostics).toMatchObject({
      execution_state: "failed",
      visible_snapshot_id: "snap-prior",
      graph_freshness: "stale",
      activity_lease_held: false,
      worker_termination_state: "not_required",
      last_failure: {
        code: "store_failure",
        category: "store",
        message: "Refresh store operation failed."
      }
    });
    expect(JSON.stringify(diagnostics)).not.toMatch(/API_TOKEN|SELECT \*|private\/workspace/);
  });

  it("stores cache entries with TTL and explicit snapshot/file invalidation", async () => {
    const clock = new MutableClock("2026-05-31T12:00:00.000Z");
    const runtime = new InMemoryRuntimeOperationsAdapter({ clock });

    await runtime.set({
      namespace: "query",
      key: "symbol:Runner",
      value: { rows: 1 },
      ttl_ms: 1_000,
      depends_on_snapshot_id: "snap-1",
      depends_on_file_paths: ["src/service.py"]
    });
    await runtime.set({
      namespace: "query",
      key: "symbol:Other",
      value: { rows: 2 },
      depends_on_snapshot_id: "snap-1",
      depends_on_file_paths: ["src/other.py"]
    });

    expect(await runtime.has({ namespace: "query", key: "symbol:Runner" })).toBe(true);
    expect(await runtime.invalidateFile({ snapshot_id: "snap-1", file_path: "./src/service.py" })).toBe(1);
    expect(await runtime.get({ namespace: "query", key: "symbol:Runner" })).toBeNull();
    expect(await runtime.get<{ rows: number }>({ namespace: "query", key: "symbol:Other" })).toEqual({
      rows: 2
    });

    await runtime.set({
      namespace: "query",
      key: "symbol:Runner",
      value: { rows: 1 },
      ttl_ms: 1_000
    });
    clock.advance(1_000);
    expect(await runtime.get({ namespace: "query", key: "symbol:Runner" })).toBeNull();
    expect(await runtime.invalidateSnapshot({ snapshot_id: "snap-1" })).toBe(1);
  });

  it("rejects stale cache reads when snapshot, config, or file hash no longer matches", async () => {
    const clock = new MutableClock("2026-05-31T12:00:00.000Z");
    const runtime = new InMemoryRuntimeOperationsAdapter({ clock });
    const key = { namespace: "parser", key: "file:service" };
    const stableHashes: readonly FileContentHashBinding[] = [
      { path: "src/service.py", content_hash: "stat:1024:1234" },
      { path: "./src/lib.py", content_hash: "stat:512:5678" }
    ];

    await runtime.set({
      ...key,
      value: { parsed: true },
      depends_on_snapshot_id: "snapshot-1",
      depends_on_config_identity: "default",
      depends_on_file_hashes: stableHashes
    });

    await expect(runtime.has(key)).resolves.toBe(true);
    await expect(
      runtime.get({
        ...key,
        depends_on_snapshot_id: "snapshot-1",
        depends_on_config_identity: "default",
        depends_on_file_hashes: stableHashes
      })
    ).resolves.toEqual({ parsed: true });

    await expect(
      runtime.get({
        ...key,
        depends_on_snapshot_id: "snapshot-2",
        depends_on_config_identity: "default",
        depends_on_file_hashes: stableHashes
      })
    ).resolves.toBeNull();

    await runtime.set({
      ...key,
      value: { parsed: true },
      depends_on_snapshot_id: "snapshot-1",
      depends_on_config_identity: "config-a",
      depends_on_file_hashes: stableHashes
    });
    await expect(
      runtime.get({
        ...key,
        depends_on_snapshot_id: "snapshot-1",
        depends_on_config_identity: "default",
        depends_on_file_hashes: stableHashes
      })
    ).resolves.toBeNull();

    await runtime.set({
      ...key,
      value: { parsed: true },
      depends_on_snapshot_id: "snapshot-1",
      depends_on_config_identity: "default",
      depends_on_file_hashes: [{ path: "./src/service.py", content_hash: "stat:1024:1234" }]
    });
    await expect(
      runtime.get({
        ...key,
        depends_on_snapshot_id: "snapshot-1",
        depends_on_config_identity: "default",
        depends_on_file_hashes: [{ path: "./src/service.py", content_hash: "stat:9999:9999" }]
      })
    ).resolves.toBeNull();
  });

  it("refuses duplicate warm-up work unless forced and records terminal state", async () => {
    const clock = new MutableClock("2026-05-31T12:00:00.000Z");
    const runtime = new InMemoryRuntimeOperationsAdapter({ clock });

    const first = await runtime.requestWarmup({ repo_root: "/repo", snapshot_id: "snap-1" });
    const duplicate = await runtime.requestWarmup({ repo_root: "/repo", snapshot_id: "snap-1" });
    const forced = await runtime.requestWarmup({
      repo_root: "/repo",
      snapshot_id: "snap-2",
      force: true
    });

    expect(duplicate).toBe(first);
    expect(forced).not.toBe(first);
    await runtime.markOwner({ execution_id: forced, owner_id: "owner-1" });
    expect(await runtime.getState({ repo_root: "/repo" })).toEqual(
      expect.objectContaining({
        execution_id: forced,
        state: "running",
        owner_id: "owner-1"
      })
    );

    await runtime.completeWarmup({
      execution_id: forced,
      success: false,
      reason: "parser unavailable"
    });
    expect(await runtime.getState({ repo_root: "/repo" })).toEqual(
      expect.objectContaining({
        state: "failed",
        reason: "parser unavailable"
      })
    );
  });

  it("keeps bounded reads on last valid cache evidence while refresh work is coordinated", async () => {
    const clock = new MutableClock("2026-05-31T12:00:00.000Z");
    const runtime = new InMemoryRuntimeOperationsAdapter({ clock });

    await runtime.set({
      namespace: "query",
      key: "symbol:Runner",
      value: { snapshot_id: "snap-1", rows: 1 },
      depends_on_snapshot_id: "snap-1",
      depends_on_config_identity: "default"
    });
    const first = await runtime.requestWarmup({ repo_root: "/repo", snapshot_id: "snap-2" });
    const duplicate = await runtime.requestWarmup({ repo_root: "/repo", snapshot_id: "snap-2" });
    await runtime.markOwner({ execution_id: first, owner_id: "owner-1" });

    await expect(runtime.getState({ repo_root: "/repo" })).resolves.toMatchObject({
      execution_id: first,
      snapshot_id: "snap-2",
      state: "running"
    });
    expect(duplicate).toBe(first);
    await expect(runtime.get({ namespace: "query", key: "symbol:Runner" })).resolves.toEqual({
      snapshot_id: "snap-1",
      rows: 1
    });
    await expect(
      runtime.get({
        namespace: "query",
        key: "symbol:Runner",
        depends_on_snapshot_id: "snap-2",
        depends_on_config_identity: "default"
      })
    ).resolves.toBeNull();
  });

  it("serializes graph-writer ownership per repository while allowing observers", async () => {
    const clock = new MutableClock("2026-05-31T12:00:00.000Z");
    const runtime = new InMemoryRuntimeOperationsAdapter({ clock });

    const [first, second] = await Promise.all([
      runtime.claimOwnership({ repo_root: "/repo", snapshot_id: "snap-1", owner_id: "owner-1" }),
      runtime.claimOwnership({ repo_root: "/repo", snapshot_id: "snap-1", owner_id: "owner-2" })
    ]);

    expect(first).toMatchObject({
      owner_id: "owner-1",
      state: "owner"
    });
    expect(second).toMatchObject({
      owner_id: "owner-1",
      state: "observer"
    });
    await expect(runtime.getOwner({ repo_root: "/repo" })).resolves.toMatchObject({
      owner_id: "owner-1",
      state: "owner"
    });
  });

  it("coordinates owner, observer, stale owner, dead owner, and isolated worker states", async () => {
    const clock = new MutableClock("2026-05-31T12:00:00.000Z");
    const runtime = new InMemoryRuntimeOperationsAdapter({
      clock,
      owner_stale_after_ms: 1_000,
      owner_dead_after_ms: 3_000
    });

    await expect(
      runtime.claimOwnership({ repo_root: "/repo", snapshot_id: "snap-1", owner_id: "owner-1" })
    ).resolves.toMatchObject({ state: "owner", owner_id: "owner-1" });
    await expect(
      runtime.claimOwnership({ repo_root: "/repo", snapshot_id: "snap-1", owner_id: "owner-2" })
    ).resolves.toMatchObject({ state: "observer", owner_id: "owner-1" });

    clock.advance(1_000);
    await expect(runtime.getOwner({ repo_root: "/repo" })).resolves.toMatchObject({
      state: "stale_owner"
    });
    await expect(
      runtime.claimOwnership({ repo_root: "/repo", snapshot_id: "snap-1", owner_id: "owner-2" })
    ).resolves.toMatchObject({ state: "stale_owner", owner_id: "owner-1" });

    clock.advance(2_000);
    await expect(runtime.getOwner({ repo_root: "/repo" })).resolves.toMatchObject({
      state: "dead_owner"
    });
    await expect(
      runtime.claimOwnership({ repo_root: "/repo", snapshot_id: "snap-2", owner_id: "owner-2" })
    ).resolves.toMatchObject({ state: "owner", owner_id: "owner-2", snapshot_id: "snap-2" });
    clock.advance(500);
    await runtime.heartbeat({ repo_root: "/repo", snapshot_id: "snap-2", owner_id: "owner-2" });
    clock.advance(600);
    await expect(runtime.getOwner({ repo_root: "/repo" })).resolves.toMatchObject({
      state: "owner",
      owner_id: "owner-2"
    });

    const isolated = new InMemoryRuntimeOperationsAdapter({
      clock,
      isolated_worker: true
    });
    await expect(
      isolated.claimOwnership({ repo_root: "/repo", snapshot_id: "snap-3", owner_id: "debug" })
    ).resolves.toMatchObject({ state: "isolated_worker", owner_id: "debug" });
    await expect(isolated.getOwner({ repo_root: "/repo" })).resolves.toBeNull();
  });

  it("creates stable runtime context signatures and scoped cancellation", async () => {
    const clock = new MutableClock("2026-05-31T12:00:00.000Z");
    const runtime = new InMemoryRuntimeOperationsAdapter({ clock });
    const cancellation = new InMemoryCancellationAdapter({ clock });
    const context = await runtime.create({
      operation: "symbol_search",
      repo_root: "/repo",
      workspace_root: "/repo",
      request_id: "request-1",
      snapshot_id: "snap-1",
      freshness: "fresh",
      budget_ms: 100
    });
    const same = await runtime.create({
      operation: "symbol_search",
      repo_root: "/repo",
      workspace_root: "/repo",
      request_id: "request-2",
      snapshot_id: "snap-1",
      freshness: "fresh",
      budget_ms: 100
    });
    const changed = runtime.applyOverrides({
      context,
      overrides: { freshness: "stale" }
    });

    await expect(runtime.getSignature({ context })).resolves.toBe(
      await runtime.getSignature({ context: same })
    );
    await expect(runtime.getSignature({ context: changed })).resolves.not.toBe(
      await runtime.getSignature({ context })
    );

    const token = await cancellation.create({ scope: "index", ttl_ms: 1_000 });
    await expect(cancellation.isCancelled({ token: token.token })).resolves.toBe(false);
    clock.advance(1_000);
    await expect(cancellation.isCancelled({ token: token.token })).resolves.toBe(true);

    const scoped = await cancellation.create({ scope: "index" });
    await expect(cancellation.revokeScope({ scope: "index" })).resolves.toBe(1);
    await expect(cancellation.isCancelled({ token: scoped.token })).resolves.toBe(true);
  });
});
