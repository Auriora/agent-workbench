/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import crypto from "node:crypto";
import type {
  ClockPort,
  DaemonRefreshActivityTransition,
  RefreshActivityLease,
  RefreshDeadlineHandle,
  RefreshDeadlineSchedulerPort,
  RefreshExecutorCompletion,
  RefreshExecutorPort,
  RefreshWorkerResult,
  SnapshotPublicationPort,
  SnapshotRefreshAdmission,
  SnapshotRefreshControllerPort,
  SnapshotRefreshControllerReceipt,
  SnapshotRefreshRequest
} from "../../ports/index.js";
import type {
  InvalidationGeneration,
  RefreshFailure,
  RefreshFailureCode,
  RefreshFailureMessage
} from "../../contracts/index.js";

type ActiveExecution = {
  execution_id: string;
  target_snapshot_id: string;
  state: "planned" | "running";
  started_generation: InvalidationGeneration;
  lease: RefreshActivityLease & { state: "held" };
  publication_state: "building" | "published" | "superseded" | "failed";
};

type ControllerWorkerFailureCode = Extract<
  RefreshFailureCode,
  | "worker_timeout"
  | "worker_error"
  | "worker_exit_without_result"
  | "invalid_worker_result"
>;

type PassOutcome =
  | { outcome: "complete"; result: RefreshWorkerResult }
  | { outcome: "failed"; code: ControllerWorkerFailureCode; worker_started: boolean };

type ControllerFailureCode = ControllerWorkerFailureCode | "store_failure";

export type SnapshotRefreshControllerOptions = {
  repo_root: string;
  controller_generation: number;
  timeout_ms: number;
  clock: ClockPort;
  executor: RefreshExecutorPort;
  publication: SnapshotPublicationPort;
  deadline_scheduler?: RefreshDeadlineSchedulerPort;
  create_execution_id?: () => string;
};

const failureMessageByCode = {
  worker_timeout: "Refresh worker deadline expired.",
  worker_error: "Refresh worker failed.",
  worker_exit_without_result: "Refresh worker exited without a valid result.",
  invalid_worker_result: "Refresh worker returned an invalid result.",
  store_failure: "Refresh store operation failed."
} as const satisfies Record<ControllerFailureCode, RefreshFailureMessage>;

/**
 * Repository-scoped refresh admission and execution authority.
 *
 * Admission mutates state synchronously before returning its promise, which is
 * the controller's linearization point. Executor work is launched in a
 * microtask so every accepted caller observes `planned` first.
 */
export class SnapshotRefreshController implements SnapshotRefreshControllerPort {
  private readonly repoRoot: string;
  private readonly controllerGeneration: number;
  private readonly timeoutMs: number;
  private readonly clock: ClockPort;
  private readonly executor: RefreshExecutorPort;
  private readonly publication: SnapshotPublicationPort;
  private readonly deadlineScheduler: RefreshDeadlineSchedulerPort;
  private readonly createExecutionId: () => string;
  private readonly listeners = new Set<
    (transition: DaemonRefreshActivityTransition) => void | Promise<void>
  >();

  private executionState: SnapshotRefreshControllerReceipt["execution_state"] = "idle";
  private active: ActiveExecution | undefined;
  private executionId: string | undefined;
  private targetSnapshotId: string | undefined;
  private requestedGeneration: InvalidationGeneration = 0;
  private startedGeneration: InvalidationGeneration = 0;
  private workerInvocations = 0;
  private lastFailure: RefreshFailure | undefined;
  private pass = 0;
  private mutationTail: Promise<void> = Promise.resolve();
  private terminationUnconfirmedExecutionId: string | undefined;

  constructor(options: SnapshotRefreshControllerOptions) {
    if (!Number.isInteger(options.controller_generation) || options.controller_generation <= 0) {
      throw new TypeError("controller_generation must be a positive integer.");
    }
    if (!Number.isFinite(options.timeout_ms) || !Number.isInteger(options.timeout_ms) || options.timeout_ms <= 0) {
      throw new TypeError("timeout_ms must be a finite positive integer.");
    }
    this.repoRoot = options.repo_root;
    this.controllerGeneration = options.controller_generation;
    this.timeoutMs = options.timeout_ms;
    this.clock = options.clock;
    this.executor = options.executor;
    this.publication = options.publication;
    this.deadlineScheduler = options.deadline_scheduler ?? new SystemRefreshDeadlineScheduler();
    this.createExecutionId = options.create_execution_id ?? (() => `refresh-${crypto.randomUUID()}`);
  }

  public async request(input: SnapshotRefreshRequest): Promise<SnapshotRefreshAdmission> {
    if (input.repo_root !== this.repoRoot) {
      throw new TypeError("Refresh request repository does not match controller ownership.");
    }
    if (!Number.isInteger(input.invalidation_generation) || input.invalidation_generation < 0) {
      throw new TypeError("invalidation_generation must be a non-negative integer.");
    }

    return await this.withMutation(() => this.admit(input));
  }

  private async admit(input: SnapshotRefreshRequest): Promise<SnapshotRefreshAdmission> {
    if (this.terminationUnconfirmedExecutionId !== undefined) {
      return {
        outcome: "blocked",
        reused: false,
        state: "idle",
        reason: "termination_unconfirmed",
        message: "Prior refresh worker termination is not yet confirmed.",
        execution_id: this.terminationUnconfirmedExecutionId
      };
    }
    if (this.active !== undefined) {
      this.requestedGeneration = Math.max(
        this.requestedGeneration,
        input.invalidation_generation
      );
      return {
        outcome: "reused",
        reused: true,
        execution_id: this.active.execution_id,
        target_snapshot_id: this.active.target_snapshot_id,
        state: this.active.state,
        started_generation: this.active.started_generation,
        requested_generation: this.requestedGeneration
      };
    }

    const admittedGeneration = Math.max(this.requestedGeneration, input.invalidation_generation);
    let targetSnapshotId: string;
    try {
      targetSnapshotId = await this.publication.allocateBuildSnapshotId({
        repo_root: this.repoRoot,
        minimum_id: String(Math.max(1, this.clock.nowUnixMs()))
      });
    } catch {
      return {
        outcome: "blocked",
        reused: false,
        state: "idle",
        reason: "store_failure",
        message: "Refresh store operation failed."
      };
    }
    const executionId = this.createExecutionId();
    this.pass = 1;
    this.requestedGeneration = admittedGeneration;
    this.startedGeneration = admittedGeneration;
    const lease: RefreshActivityLease & { state: "held" } = {
      execution_id: executionId,
      controller_generation: this.controllerGeneration,
      acquired_at: this.clock.nowIso8601(),
      state: "held"
    };
    this.executionId = executionId;
    this.targetSnapshotId = targetSnapshotId;
    this.executionState = "planned";
    this.active = {
      execution_id: executionId,
      target_snapshot_id: targetSnapshotId,
      state: "planned",
      started_generation: this.startedGeneration,
      lease,
      publication_state: "building"
    };
    this.emitActive("planned", this.active);

    queueMicrotask(() => {
      void this.execute(executionId).catch(() => {
        void this.withMutation(async () => {
          const execution = this.active;
          if (execution?.execution_id !== executionId) {
            return;
          }
          if (execution.publication_state === "building") {
            await this.failActiveBuild(executionId, "worker_error");
          } else {
            this.fail(executionId, "worker_error");
          }
        });
      });
    });
    return {
      outcome: "accepted",
      reused: false,
      execution_id: executionId,
      target_snapshot_id: targetSnapshotId,
      state: "planned",
      started_generation: this.startedGeneration,
      requested_generation: this.requestedGeneration
    };
  }

  public getReceipt(): SnapshotRefreshControllerReceipt {
    return {
      repo_root: this.repoRoot,
      controller_generation: this.controllerGeneration,
      execution_state: this.executionState,
      execution_id: this.executionId,
      target_snapshot_id: this.targetSnapshotId,
      started_generation: this.startedGeneration,
      requested_generation: this.requestedGeneration,
      activity_lease: this.active?.lease ?? null,
      worker_invocations: this.workerInvocations,
      last_failure: this.lastFailure
    };
  }

  public onTransition(
    listener: (transition: DaemonRefreshActivityTransition) => void | Promise<void>
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async execute(executionId: string): Promise<void> {
    while (this.active?.execution_id === executionId) {
      const pass = this.active;
      pass.state = "running";
      this.executionState = "running";
      this.emitActive("running", pass);
      this.workerInvocations += 1;

      const outcome = await this.executePass(pass);
      const continueExecution = await this.withMutation(async () => {
        if (this.active?.execution_id !== executionId) {
          return false;
        }
        if (outcome.outcome === "failed") {
          if (outcome.worker_started) {
            await this.failActiveBuild(executionId, outcome.code);
          } else {
            this.fail(executionId, outcome.code);
          }
          return false;
        }
        if (this.requestedGeneration > pass.started_generation) {
          try {
            await this.publication.transitionBuild({
              repo_root: this.repoRoot,
              snapshot_id: pass.target_snapshot_id,
              controller_generation: this.controllerGeneration,
              invalidation_generation: pass.started_generation,
              from: "building",
              to: "superseded",
              updated_at: this.clock.nowIso8601()
            });
            pass.publication_state = "superseded";
          } catch {
            this.fail(executionId, "store_failure");
            return false;
          }
          this.pass += 1;
          this.startedGeneration = this.requestedGeneration;
          let targetSnapshotId: string;
          try {
            targetSnapshotId = await this.publication.allocateBuildSnapshotId({
              repo_root: this.repoRoot,
              minimum_id: String(Math.max(1, this.clock.nowUnixMs()))
            });
          } catch {
            this.fail(executionId, "store_failure");
            return false;
          }
          this.targetSnapshotId = targetSnapshotId;
          this.active = {
            ...pass,
            target_snapshot_id: targetSnapshotId,
            started_generation: this.startedGeneration,
            state: "running",
            publication_state: "building"
          };
          return true;
        }
        try {
          await this.publication.transitionBuild({
            repo_root: this.repoRoot,
            snapshot_id: pass.target_snapshot_id,
            controller_generation: this.controllerGeneration,
            invalidation_generation: pass.started_generation,
            from: "building",
            to: "published",
            updated_at: this.clock.nowIso8601()
          });
          pass.publication_state = "published";
        } catch {
          this.fail(executionId, "store_failure");
          return false;
        }
        this.complete(executionId);
        return false;
      });
      if (!continueExecution) {
        return;
      }
    }
  }

  private async executePass(execution: ActiveExecution): Promise<PassOutcome> {
    const deadline = {
      timeout_ms: this.timeoutMs,
      deadline_at: new Date(this.clock.nowUnixMs() + this.timeoutMs).toISOString()
    };

    return await new Promise<PassOutcome>((resolve) => {
      let claimed = false;
      let deadlineHandle: RefreshDeadlineHandle | undefined;
      const claim = (): boolean => {
        if (claimed) {
          return false;
        }
        claimed = true;
        try {
          deadlineHandle?.cancel();
        } catch {
          // Timer cleanup cannot replace the already claimed worker outcome.
        }
        return true;
      };
      const settle = (outcome: PassOutcome): void => {
        resolve(outcome);
      };
      const settleStartedWorkerFailure = (
        code: ControllerWorkerFailureCode,
        reason: "deadline" | "worker_error"
      ): void => {
        this.beginTermination(execution.execution_id, reason);
        settle({ outcome: "failed", code, worker_started: true });
      };

      try {
        deadlineHandle = this.deadlineScheduler.arm({
          deadline,
          onDeadline: () => {
            if (!claim()) {
              return;
            }
            settleStartedWorkerFailure("worker_timeout", "deadline");
          }
        });
      } catch {
        claimed = true;
        settle({ outcome: "failed", code: "worker_error", worker_started: false });
        return;
      }
      if (claimed) {
        try {
          deadlineHandle.cancel();
        } catch {
          // Deadline cleanup is best-effort after terminal settlement is claimed.
        }
        return;
      }

      let workerRun: Promise<RefreshExecutorCompletion>;
      try {
        workerRun = this.executor.run({
          repo_root: this.repoRoot,
          execution_id: execution.execution_id,
          target_snapshot_id: execution.target_snapshot_id,
          generation: execution.started_generation,
          deadline
        });
      } catch {
        if (claim()) {
          this.beginTermination(execution.execution_id, "worker_error");
          settle({ outcome: "failed", code: "worker_error", worker_started: false });
        }
        return;
      }
      void Promise.resolve(workerRun).then(
          (completion) => {
            if (claim()) {
              const outcome = this.validateCompletion(execution, completion);
              if (outcome.outcome === "failed") {
                settleStartedWorkerFailure(outcome.code, "worker_error");
              } else {
                settle(outcome);
              }
            }
          },
          () => {
            if (claim()) {
              settleStartedWorkerFailure("worker_error", "worker_error");
            }
          }
        );
    });
  }

  private validateCompletion(
    execution: ActiveExecution,
    completion: RefreshExecutorCompletion
  ): PassOutcome {
    if (
      typeof completion !== "object" ||
      completion === null ||
      !Number.isInteger(completion.exit_code) ||
      !Array.isArray(completion.results)
    ) {
      return { outcome: "failed", code: "invalid_worker_result", worker_started: true };
    }
    if (completion.exit_code !== 0) {
      return { outcome: "failed", code: "worker_error", worker_started: true };
    }
    if (completion.results.length === 0) {
      return { outcome: "failed", code: "worker_exit_without_result", worker_started: true };
    }
    if (completion.results.length !== 1) {
      return { outcome: "failed", code: "invalid_worker_result", worker_started: true };
    }
    const result = completion.results[0];
    if (!isRefreshWorkerResult(result)) {
      return { outcome: "failed", code: "invalid_worker_result", worker_started: true };
    }
    if (
      result.execution_id !== execution.execution_id ||
      result.target_snapshot_id !== execution.target_snapshot_id ||
      result.completed_generation !== execution.started_generation
    ) {
      return { outcome: "failed", code: "invalid_worker_result", worker_started: true };
    }
    return { outcome: "complete", result };
  }

  private complete(executionId: string): void {
    const execution = this.active;
    if (execution?.execution_id !== executionId) {
      return;
    }
    if (execution.publication_state !== "published") {
      this.fail(executionId, "store_failure");
      return;
    }
    const releasedLease = this.releaseLease(execution.lease);
    this.executionState = "complete";
    this.lastFailure = undefined;
    this.active = undefined;
    this.emit({
      execution_id: executionId,
      controller_generation: this.controllerGeneration,
      state: "terminal",
      execution_state: "complete",
      lease: releasedLease
    });
  }

  private fail(executionId: string, code: ControllerFailureCode): void {
    const execution = this.active;
    if (execution?.execution_id !== executionId) {
      return;
    }
    const message = failureMessageByCode[code];
    const failure: RefreshFailure = {
      code,
      category: code === "store_failure" ? "store" : "worker",
      message,
      execution_id: executionId,
      target_snapshot_id: execution.target_snapshot_id,
      occurred_at: this.clock.nowIso8601()
    };
    const releasedLease = this.releaseLease(execution.lease);
    this.executionState = "failed";
    this.lastFailure = failure;
    this.active = undefined;
    this.emit({
      execution_id: executionId,
      controller_generation: this.controllerGeneration,
      state: "terminal",
      execution_state: "failed",
      lease: releasedLease,
      failure
    });
  }

  private async failActiveBuild(
    executionId: string,
    code: ControllerWorkerFailureCode
  ): Promise<void> {
    const execution = this.active;
    if (execution?.execution_id !== executionId) {
      return;
    }
    if (execution.publication_state !== "building") {
      this.fail(executionId, code);
      return;
    }
    try {
      await this.publication.transitionBuild({
        repo_root: this.repoRoot,
        snapshot_id: execution.target_snapshot_id,
        controller_generation: this.controllerGeneration,
        invalidation_generation: execution.started_generation,
        from: "building",
        to: "failed",
        updated_at: this.clock.nowIso8601()
      });
      execution.publication_state = "failed";
      this.fail(executionId, code);
    } catch {
      this.fail(executionId, "store_failure");
    }
  }

  private async withMutation<T>(operation: () => T | Promise<T>): Promise<T> {
    const prior = this.mutationTail;
    let release!: () => void;
    this.mutationTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prior;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private releaseLease(
    lease: RefreshActivityLease & { state: "held" }
  ): RefreshActivityLease & { state: "released" } {
    return {
      execution_id: lease.execution_id,
      controller_generation: lease.controller_generation,
      acquired_at: lease.acquired_at,
      state: "released",
      released_at: this.clock.nowIso8601()
    };
  }

  private emitActive(state: "planned" | "running", execution: ActiveExecution): void {
    this.emit({
      execution_id: execution.execution_id,
      controller_generation: this.controllerGeneration,
      state: "active",
      execution_state: state,
      lease: execution.lease
    });
  }

  private emit(transition: DaemonRefreshActivityTransition): void {
    for (const listener of this.listeners) {
      try {
        void Promise.resolve(listener(transition)).catch(() => undefined);
      } catch {
        // Observers cannot own or interrupt refresh lifecycle settlement.
      }
    }
  }

  private beginTermination(
    executionId: string,
    reason: "deadline" | "worker_error" | "controller_shutdown"
  ): void {
    if (this.terminationUnconfirmedExecutionId === executionId) {
      return;
    }
    this.terminationUnconfirmedExecutionId = executionId;
    try {
      void this.executor.terminate({ execution_id: executionId, reason }).then(
        () => {
          if (this.terminationUnconfirmedExecutionId === executionId) {
            this.terminationUnconfirmedExecutionId = undefined;
          }
        },
        () => undefined
      );
    } catch {
      // Admission remains quarantined because termination was not confirmed.
    }
  }
}

export class SystemRefreshDeadlineScheduler implements RefreshDeadlineSchedulerPort {
  public arm(input: {
    deadline: { timeout_ms: number; deadline_at: string };
    onDeadline: () => void;
  }): RefreshDeadlineHandle {
    const timer = setTimeout(input.onDeadline, input.deadline.timeout_ms);
    return {
      cancel(): void {
        clearTimeout(timer);
      }
    };
  }
}

function isRefreshWorkerResult(value: unknown): value is RefreshWorkerResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.outcome === "complete" &&
    typeof candidate.execution_id === "string" &&
    candidate.execution_id.length > 0 &&
    typeof candidate.target_snapshot_id === "string" &&
    candidate.target_snapshot_id.length > 0 &&
    typeof candidate.completed_generation === "number" &&
    Number.isInteger(candidate.completed_generation) &&
    candidate.completed_generation >= 0 &&
    Object.keys(candidate).every((key) =>
      ["outcome", "execution_id", "target_snapshot_id", "completed_generation"].includes(key)
    )
  );
}
