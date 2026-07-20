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

/**
 * Deliberately records but drops a newer generation during publication.
 * T005 replaces this catch-up reproduction through the production trigger
 * boundary. T002 owns only the deadline reproduction above.
 */
export function createPhase1GenerationCatchupReproduction(): SnapshotRefreshPort & {
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
  let executionState: "idle" | "planned" | "running" | "complete" = "idle";
  let startedGeneration = 0;
  let requestedGeneration = 0;
  let publishedGeneration = 0;
  let workerInvocations = 0;
  const executionId = "exec-refresh-1";

  return {
    workerStarted,
    releaseWorker,
    beforePublication,
    releasePublication,
    async request(input: SnapshotRefreshRequest): Promise<SnapshotRefreshAdmission> {
      requestedGeneration = Math.max(requestedGeneration, input.invalidation_generation);
      if (executionState === "running") {
        return {
          outcome: "reused",
          reused: true,
          execution_id: executionId,
          target_snapshot_id: "snap-building-1",
          state: "running",
          started_generation: startedGeneration,
          requested_generation: requestedGeneration
        };
      }
      executionState = "planned";
      startedGeneration = input.invalidation_generation;
      return {
        outcome: "accepted",
        reused: false,
        execution_id: executionId,
        target_snapshot_id: "snap-building-1",
        state: "planned",
        started_generation: startedGeneration,
        requested_generation: requestedGeneration
      };
    },
    async executeAcceptedPass(): Promise<void> {
      executionState = "running";
      workerInvocations += 1;
      workerStarted.resolve(undefined);
      await releaseWorker.promise;
      beforePublication.resolve(undefined);
      await releasePublication.promise;
      publishedGeneration = startedGeneration;
      executionState = "complete";
    },
    receipt() {
      return {
        execution_state: executionState,
        started_generation: startedGeneration,
        requested_generation: requestedGeneration,
        worker_invocations: workerInvocations,
        published_generation: publishedGeneration
      };
    }
  };
}

/**
 * Deliberately closes on client count alone while a refresh lease is held.
 * T004 replaces this factory with production daemon lifetime coordination.
 */
export function createPhase1DaemonLifetimeReproduction() {
  const workerStarted = deferred<void>();
  const releaseWorker = deferred<void>();
  let connectedClients = 0;
  let closed = false;
  const activityLease: RefreshActivityLease = {
    execution_id: "exec-1",
    controller_generation: 1,
    acquired_at: "2026-07-19T12:00:00.000Z",
    state: "held"
  };

  return {
    workerStarted,
    releaseWorker,
    connectRequester(): void {
      connectedClients += 1;
    },
    disconnectRequester(): void {
      connectedClients -= 1;
    },
    async startRefresh(): Promise<void> {
      workerStarted.resolve(undefined);
      await releaseWorker.promise;
    },
    fireIdleDecision(): void {
      if (connectedClients === 0) {
        closed = true;
      }
    },
    receipt(): {
      connected_clients: number;
      closed: boolean;
      activity_lease: RefreshActivityLease;
    } {
      return {
        connected_clients: connectedClients,
        closed,
        activity_lease: activityLease
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
