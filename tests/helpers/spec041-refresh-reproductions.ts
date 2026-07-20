/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  ClockPort,
  RefreshDeadlineSchedulerPort,
  RefreshActivityLease,
  RefreshExecutorPort,
  SnapshotPublicationPort,
  SnapshotRefreshAdmission,
  SnapshotRefreshPort,
  SnapshotRefreshRequest
} from "../../src/ports/index.js";
import { SnapshotRefreshController } from "../../src/infrastructure/runtime/index.js";
import { DaemonRefreshLifetimeCoordinator } from "../../src/mcp/daemon.js";

/**
 * Deterministic harness around the production controller-owned deadline path.
 */
export function createDeadlineControllerHarness(clock: ClockPort) {
  const workerStarted = deferred<void>();
  let workerInvocations = 0;
  let terminateInvocations = 0;
  let fireDeadline: (() => void) | undefined;

  const executor: RefreshExecutorPort = {
    async run(): Promise<never> {
      workerInvocations += 1;
      workerStarted.resolve(undefined);
      return await new Promise<never>(() => undefined);
    },
    async terminate(): Promise<void> {
      terminateInvocations += 1;
    }
  };
  const deadlineScheduler: RefreshDeadlineSchedulerPort = {
    arm(input) {
      fireDeadline = input.onDeadline;
      return {
        cancel(): void {
          fireDeadline = undefined;
        }
      };
    }
  };
  const publication: SnapshotPublicationPort = {
    async allocateBuildSnapshotId() {
      return "1001";
    },
    async transitionBuild(input) {
      return {
        repo_root: input.repo_root,
        snapshot_id: input.snapshot_id,
        controller_generation: 1,
        invalidation_generation: 1,
        state: input.to,
        updated_at: input.updated_at
      };
    },
    async getLatestPublished() {
      return { status: "missing", reason: "no_published_snapshot" };
    },
    async readExplicit(input) {
      return { status: "missing", snapshot_id: input.snapshot_id, reason: "snapshot_not_found" };
    }
  };
  const controller = new SnapshotRefreshController({
    repo_root: "/repo",
    controller_generation: 1,
    timeout_ms: 30_000,
    clock,
    executor,
    publication,
    deadline_scheduler: deadlineScheduler,
    create_execution_id: () => "exec-deadline"
  });
  const terminal = deferred<void>();
  controller.onTransition((transition) => {
    if (transition.state === "terminal") {
      terminal.resolve(undefined);
    }
  });

  return {
    workerStarted,
    async start(): Promise<void> {
      await controller.request({
        repo_root: "/repo",
        reason: "startup",
        source: "test",
        invalidation_generation: 1
      });
    },
    async fireDeadlineBarrier(): Promise<void> {
      if (fireDeadline === undefined) {
        throw new Error("Deadline was not armed.");
      }
      fireDeadline();
      await terminal.promise;
    },
    receipt(): {
      execution_id: string;
      state: "idle" | "running" | "complete" | "failed";
      activity_lease_held: boolean;
      worker_invocations: number;
      terminate_invocations: number;
      failure_code?: string;
    } {
      const receipt = controller.getReceipt();
      return {
        execution_id: receipt.execution_id ?? "exec-deadline",
        state: receipt.execution_state === "planned" ? "running" : receipt.execution_state,
        activity_lease_held: receipt.activity_lease?.state === "held",
        worker_invocations: workerInvocations,
        terminate_invocations: terminateInvocations,
        failure_code: receipt.last_failure?.code
      };
    }
  };
}

export function createGenerationCatchupHarness(): SnapshotRefreshPort & {
  workerStarted: ReturnType<typeof deferred<void>>;
  releaseWorker: ReturnType<typeof deferred<void>>;
  beforePublication: ReturnType<typeof deferred<void>>;
  releasePublication: ReturnType<typeof deferred<void>>;
  executeAcceptedPass(): Promise<void>;
  receipt(): {
    execution_state: "idle" | "planned" | "running" | "complete";
    started_generation: number;
    requested_generation: number;
    worker_invocations: number;
    published_generation: number;
  };
} {
  const workerStarted = deferred<void>();
  const releaseWorker = deferred<void>();
  const beforePublication = deferred<void>();
  const releasePublication = deferred<void>();
  let publishedGeneration = 0;
  let workerInvocations = 0;
  let snapshotSequence = 1000;
  const terminal = deferred<void>();
  const executor: RefreshExecutorPort = {
    async run(input) {
      workerInvocations += 1;
      if (workerInvocations === 1) {
        workerStarted.resolve(undefined);
        await releaseWorker.promise;
      }
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
  const publication: SnapshotPublicationPort = {
    async allocateBuildSnapshotId() { return String(++snapshotSequence); },
    async transitionBuild(input) {
      if (input.to === "superseded") {
        beforePublication.resolve(undefined);
        await releasePublication.promise;
      }
      if (input.to === "published") publishedGeneration = input.invalidation_generation;
      return { ...input, state: input.to };
    },
    async getLatestPublished() { return { status: "missing", reason: "no_published_snapshot" }; },
    async readExplicit(input) {
      return { status: "missing", snapshot_id: input.snapshot_id, reason: "snapshot_not_found" };
    }
  };
  const controller = new SnapshotRefreshController({
    repo_root: "/repo",
    controller_generation: 1,
    timeout_ms: 30_000,
    clock: {
      now: () => new Date("2026-07-19T12:00:00.000Z"),
      nowIso8601: () => "2026-07-19T12:00:00.000Z",
      nowUnixMs: () => 1000
    },
    executor,
    publication,
    create_execution_id: () => "exec-refresh-1"
  });
  controller.onTransition((transition) => {
    if (transition.state === "terminal") terminal.resolve(undefined);
  });

  return {
    workerStarted,
    releaseWorker,
    beforePublication,
    releasePublication,
    request: (input) => controller.request(input),
    async executeAcceptedPass(): Promise<void> {
      await terminal.promise;
    },
    receipt() {
      const receipt = controller.getReceipt();
      return {
        execution_state: receipt.execution_state as "idle" | "planned" | "running" | "complete",
        started_generation: receipt.started_generation,
        requested_generation: receipt.requested_generation,
        worker_invocations: workerInvocations,
        published_generation: publishedGeneration
      };
    }
  };
}

export function createPhase1DaemonLifetimeReproduction() {
  const workerStarted = deferred<void>();
  const releaseWorker = deferred<void>();
  let connectedClients = 0;
  let closed = false;
  let fireIdle: (() => void) | undefined;
  const executor: RefreshExecutorPort = {
    async run(input) {
      workerStarted.resolve(undefined);
      await releaseWorker.promise;
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
  const publication: SnapshotPublicationPort = {
    async allocateBuildSnapshotId() { return "1001"; },
    async transitionBuild(input) {
      return { ...input, state: input.to };
    },
    async getLatestPublished() { return { status: "missing", reason: "no_published_snapshot" }; },
    async readExplicit(input) {
      return { status: "missing", snapshot_id: input.snapshot_id, reason: "snapshot_not_found" };
    }
  };
  const controller = new SnapshotRefreshController({
    repo_root: "/repo",
    controller_generation: 1,
    timeout_ms: 30_000,
    clock: {
      now: () => new Date("2026-07-19T12:00:00.000Z"),
      nowIso8601: () => "2026-07-19T12:00:00.000Z",
      nowUnixMs: () => 1000
    },
    executor,
    publication,
    create_execution_id: () => "exec-1"
  });
  const lifetime = new DaemonRefreshLifetimeCoordinator({
    controller,
    connected_clients: () => connectedClients,
    idle_grace_ms: 1,
    close: () => { closed = true; },
    schedule: (_delay, callback) => {
      fireIdle = callback;
      return { cancel: () => { fireIdle = undefined; } };
    }
  });
  lifetime.start();

  return {
    workerStarted,
    releaseWorker,
    connectRequester(): void {
      connectedClients += 1;
      lifetime.clientConnected();
    },
    disconnectRequester(): void {
      connectedClients -= 1;
      lifetime.clientDisconnected();
    },
    async startRefresh(): Promise<void> {
      await controller.request({
        repo_root: "/repo",
        reason: "startup",
        source: "test",
        invalidation_generation: 1
      });
      await new Promise<void>((resolve) => {
        const unsubscribe = controller.onTransition((transition) => {
          if (transition.state === "terminal") {
            unsubscribe();
            resolve();
          }
        });
      });
    },
    fireIdleDecision(): void {
      fireIdle?.();
    },
    receipt(): {
      connected_clients: number;
      closed: boolean;
      activity_lease: RefreshActivityLease | null;
    } {
      return {
        connected_clients: connectedClients,
        closed,
        activity_lease: controller.getReceipt().activity_lease
      };
    }
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}
