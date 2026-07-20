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
  SnapshotRefreshAdmissionFailurePort,
  SnapshotRefreshControllerPort,
  SnapshotRefreshControllerReceipt,
  SnapshotRefreshDiagnosticsPort,
  SnapshotRefreshRequest
} from "../../ports/index.js";
import type {
  InvalidationGeneration,
  RefreshFailure,
  RefreshFailureCode,
  SnapshotPublicationState,
  SnapshotRefreshDiagnosticsReceipt
} from "../../contracts/index.js";
import {
  createRefreshFailure,
  snapshotRefreshDiagnosticsReceiptSchema
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

type ControllerFailureCode = ControllerWorkerFailureCode | "store_failure" | "permission_failure";

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

/**
 * Repository-scoped refresh admission and execution authority.
 *
 * Admission mutates state synchronously before returning its promise, which is
 * the controller's linearization point. Executor work is launched in a
 * microtask so every accepted caller observes `planned` first.
 */
export class SnapshotRefreshController implements SnapshotRefreshControllerPort, SnapshotRefreshDiagnosticsPort, SnapshotRefreshAdmissionFailurePort {
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
  private terminationConfirmedExecutionId: string | undefined;
  private workerTerminationState: SnapshotRefreshControllerReceipt["worker_termination_state"] = "not_required";
  private terminationConfirmationNotified = false;
  private diagnosticRevision = 0;
  private targetPublicationState: SnapshotPublicationState | undefined;
  private unsettledPublicationExecutionId: string | undefined;

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
    if (this.unsettledPublicationExecutionId !== undefined) {
      const blocked = await this.reconcileUnsettledBuild(input);
      if (blocked !== undefined) return blocked;
    }
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
      // Every admitted request advances the immutable diagnostics identity,
      // including same-generation requests that reuse the active execution.
      this.bumpDiagnosticRevision();
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
    } catch (error) {
      const code = classifyRefreshInfrastructureFailure(error);
      this.recordFailedAdmission({
        invalidation_generation: admittedGeneration,
        code
      });
      return code === "permission_failure"
        ? {
            outcome: "blocked",
            reused: false,
            state: "idle",
            reason: "permission_failure",
            message: "Refresh operation was not permitted."
          }
        : {
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
    this.workerTerminationState = "not_required";
    this.terminationUnconfirmedExecutionId = undefined;
    this.terminationConfirmedExecutionId = undefined;
    this.terminationConfirmationNotified = false;
    this.targetPublicationState = "building";
    this.active = {
      execution_id: executionId,
      target_snapshot_id: targetSnapshotId,
      state: "planned",
      started_generation: this.startedGeneration,
      lease,
      publication_state: "building"
    };
    this.bumpDiagnosticRevision();
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
      worker_termination_state: this.workerTerminationState,
      last_failure: this.lastFailure
    };
  }

  public async recordAdmissionFailure(input: {
    repo_root: string;
    invalidation_generation: InvalidationGeneration;
    code: "store_failure" | "permission_failure" | "orphaned_build";
    target_snapshot_id?: string;
  }): Promise<Extract<SnapshotRefreshAdmission, { outcome: "blocked" }>> {
    if (input.repo_root !== this.repoRoot) {
      throw new TypeError("Refresh admission failure repository does not match controller ownership.");
    }
    return await this.withMutation(() => {
      if (this.active !== undefined) {
        throw new Error("Cannot record an admission failure while refresh execution is active.");
      }
      this.recordFailedAdmission(input);
      return input.code === "permission_failure"
        ? {
            outcome: "blocked",
            reused: false,
            state: "idle",
            reason: "permission_failure",
            message: "Refresh operation was not permitted."
          }
        : {
            outcome: "blocked",
            reused: false,
            state: "idle",
            reason: "store_failure",
            message: "Refresh store operation failed."
          };
    });
  }

  public async getDiagnostics(input: { repo_root: string }): Promise<SnapshotRefreshDiagnosticsReceipt> {
    if (input.repo_root !== this.repoRoot) {
      throw new TypeError("Refresh diagnostics repository does not match controller ownership.");
    }
    return await this.withMutation(async () => {
      const visible = await this.publication.getLatestPublished({ repo_root: this.repoRoot });
      const visibleSnapshotId = visible.status === "selected" ? visible.snapshot.id : undefined;
      const graphFreshness = visible.status !== "selected"
        ? "cold"
        : this.executionState === "failed"
          ? "stale"
        : visible.snapshot.freshness === "fresh"
          ? "fresh"
          : "stale";
      const nonIdle = this.executionState !== "idle";
      const hasTargetPublication = nonIdle && this.targetPublicationState !== undefined;
      return snapshotRefreshDiagnosticsReceiptSchema.parse({
        repo_identity: this.repoRoot,
        controller_generation: this.controllerGeneration,
        diagnostic_revision: this.diagnosticRevision,
        execution_id: nonIdle ? this.executionId : undefined,
        started_generation: nonIdle ? this.startedGeneration : undefined,
        requested_generation: nonIdle ? this.requestedGeneration : undefined,
        target_snapshot_id: hasTargetPublication ? this.targetSnapshotId : undefined,
        visible_snapshot_id: visibleSnapshotId,
        execution_state: this.executionState,
        publication_state: hasTargetPublication ? this.targetPublicationState : undefined,
        graph_freshness: graphFreshness,
        activity_lease_held: this.active?.lease.state === "held",
        worker_invocations: this.workerInvocations,
        worker_termination_state: this.workerTerminationState,
        last_failure: this.lastFailure
      });
    });
  }

  public onTransition(
    listener: (transition: DaemonRefreshActivityTransition) => void | Promise<void>
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async execute(executionId: string): Promise<void> {
    while (this.active?.execution_id === executionId) {
      const pass = await this.withMutation(() => {
        const current = this.active;
        if (current?.execution_id !== executionId) return undefined;
        current.state = "running";
        this.executionState = "running";
        this.workerInvocations += 1;
        this.bumpDiagnosticRevision();
        this.emitActive("running", current);
        return current;
      });
      if (pass === undefined) return;

      const outcome = await this.executePass(pass);
      const continueExecution = await this.withMutation(async () => {
        if (this.active?.execution_id !== executionId) {
          return false;
        }
        if (outcome.outcome === "failed") {
          await this.failActiveBuild(executionId, outcome.code);
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
            this.targetPublicationState = "superseded";
            this.bumpDiagnosticRevision();
          } catch (error) {
            await this.failActiveBuild(executionId, classifyRefreshInfrastructureFailure(error));
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
          } catch (error) {
            this.fail(executionId, classifyRefreshInfrastructureFailure(error));
            return false;
          }
          this.targetSnapshotId = targetSnapshotId;
          this.targetPublicationState = "building";
          this.active = {
            ...pass,
            target_snapshot_id: targetSnapshotId,
            started_generation: this.startedGeneration,
            state: "running",
            publication_state: "building"
          };
          this.bumpDiagnosticRevision();
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
          this.targetPublicationState = "published";
          this.bumpDiagnosticRevision();
        } catch (error) {
          await this.failActiveBuild(executionId, classifyRefreshInfrastructureFailure(error));
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
    this.workerTerminationState = "not_required";
    this.active = undefined;
    this.bumpDiagnosticRevision();
    this.emit({
      execution_id: executionId,
      controller_generation: this.controllerGeneration,
      state: "terminal",
      execution_state: "complete",
      lease: releasedLease
    });
  }

  private fail(
    executionId: string,
    code: ControllerFailureCode,
    targetWasCreated = true
  ): void {
    const execution = this.active;
    if (execution?.execution_id !== executionId) {
      return;
    }
    const targetSnapshotId = targetWasCreated ? execution.target_snapshot_id : undefined;
    const failure = createRefreshFailure({
      code,
      execution_id: executionId,
      target_snapshot_id: targetSnapshotId,
      occurred_at: this.clock.nowIso8601()
    });
    const releasedLease = this.releaseLease(execution.lease);
    this.executionState = "failed";
    if (!targetWasCreated) this.targetPublicationState = undefined;
    this.lastFailure = failure;
    this.workerTerminationState = this.terminationConfirmedExecutionId === executionId
      ? "confirmed"
      : this.terminationUnconfirmedExecutionId === executionId
        ? "unconfirmed"
        : "not_required";
    this.active = undefined;
    this.bumpDiagnosticRevision();
    this.emit({
      execution_id: executionId,
      controller_generation: this.controllerGeneration,
      state: "terminal",
      execution_state: "failed",
      lease: releasedLease,
      failure
    });
    this.emitTerminationConfirmed(executionId);
  }

  private async failActiveBuild(
    executionId: string,
    code: ControllerFailureCode
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
      const selection = await this.publication.readExplicit({
        repo_root: this.repoRoot,
        snapshot_id: execution.target_snapshot_id
      });
      if (selection.status === "missing") {
        this.fail(executionId, code, false);
        return;
      }
      if (selection.status === "blocked" && selection.publication_state !== "building") {
        execution.publication_state = selection.publication_state;
        this.targetPublicationState = selection.publication_state;
        this.fail(executionId, code);
        return;
      }
      if (selection.status === "selected") {
        this.quarantineUnsettledBuild(executionId, "store_failure");
        return;
      }
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
      this.targetPublicationState = "failed";
      this.bumpDiagnosticRevision();
      this.fail(executionId, code);
    } catch (error) {
      this.quarantineUnsettledBuild(executionId, classifyRefreshInfrastructureFailure(error));
    }
  }

  private recordFailedAdmission(input: {
    invalidation_generation: InvalidationGeneration;
    code: "store_failure" | "permission_failure" | "orphaned_build";
    target_snapshot_id?: string;
  }): void {
    const executionId = this.createExecutionId();
    this.requestedGeneration = Math.max(this.requestedGeneration, input.invalidation_generation);
    this.startedGeneration = this.requestedGeneration;
    this.executionId = executionId;
    this.targetSnapshotId = input.target_snapshot_id;
    this.targetPublicationState = input.code === "orphaned_build" ? "failed" : undefined;
    this.executionState = "failed";
    this.workerTerminationState = "not_required";
    this.lastFailure = createRefreshFailure({
      code: input.code,
      execution_id: executionId,
      target_snapshot_id: input.target_snapshot_id,
      occurred_at: this.clock.nowIso8601()
    });
    this.bumpDiagnosticRevision();
  }

  private quarantineUnsettledBuild(
    executionId: string,
    code: "store_failure" | "permission_failure"
  ): void {
    const execution = this.active;
    if (execution?.execution_id !== executionId) return;
    this.unsettledPublicationExecutionId = executionId;
    this.executionState = "failed";
    this.targetPublicationState = "building";
    this.lastFailure = createRefreshFailure({
      code,
      execution_id: executionId,
      target_snapshot_id: execution.target_snapshot_id,
      occurred_at: this.clock.nowIso8601()
    });
    this.workerTerminationState = this.terminationConfirmedExecutionId === executionId
      ? "confirmed"
      : this.terminationUnconfirmedExecutionId === executionId
        ? "unconfirmed"
        : "not_required";
    this.bumpDiagnosticRevision();
  }

  private async reconcileUnsettledBuild(
    input: SnapshotRefreshRequest
  ): Promise<Extract<SnapshotRefreshAdmission, { outcome: "blocked" }> | undefined> {
    const executionId = this.unsettledPublicationExecutionId;
    const execution = this.active;
    if (executionId === undefined || execution?.execution_id !== executionId) {
      return undefined;
    }
    this.requestedGeneration = Math.max(this.requestedGeneration, input.invalidation_generation);
    try {
      const selection = await this.publication.readExplicit({
        repo_root: this.repoRoot,
        snapshot_id: execution.target_snapshot_id
      });
      if (selection.status === "missing") {
        this.unsettledPublicationExecutionId = undefined;
        this.fail(executionId, "store_failure", false);
        return undefined;
      }
      if (selection.status === "blocked" && selection.publication_state !== "building") {
        execution.publication_state = selection.publication_state;
        this.targetPublicationState = selection.publication_state;
        this.unsettledPublicationExecutionId = undefined;
        this.fail(executionId, "store_failure");
        return undefined;
      }
      if (selection.status === "selected") {
        this.quarantineUnsettledBuild(executionId, "store_failure");
        return {
          outcome: "blocked",
          reused: false,
          state: "idle",
          reason: "store_failure",
          message: "Refresh store operation failed."
        };
      }
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
      this.targetPublicationState = "failed";
      this.unsettledPublicationExecutionId = undefined;
      this.bumpDiagnosticRevision();
      this.fail(executionId, "store_failure");
      return undefined;
    } catch (error) {
      const code = classifyRefreshInfrastructureFailure(error);
      this.quarantineUnsettledBuild(executionId, code);
      return code === "permission_failure"
        ? {
            outcome: "blocked",
            reused: false,
            state: "idle",
            reason: "permission_failure",
            message: "Refresh operation was not permitted."
          }
        : {
            outcome: "blocked",
            reused: false,
            state: "idle",
            reason: "store_failure",
            message: "Refresh store operation failed."
          };
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
          void this.withMutation(() => {
            if (this.terminationUnconfirmedExecutionId !== executionId) return;
            this.terminationUnconfirmedExecutionId = undefined;
            this.terminationConfirmedExecutionId = executionId;
            if (this.executionState === "failed" && this.executionId === executionId) {
              this.workerTerminationState = "confirmed";
              this.bumpDiagnosticRevision();
            }
            this.emitTerminationConfirmed(executionId);
          });
        },
        () => undefined
      );
    } catch {
      // Admission remains quarantined because termination was not confirmed.
    }
  }

  private emitTerminationConfirmed(executionId: string): void {
    if (
      this.executionState !== "failed" ||
      this.workerTerminationState !== "confirmed" ||
      this.terminationConfirmationNotified
    ) return;
    this.terminationConfirmationNotified = true;
    this.emit({
      execution_id: executionId,
      controller_generation: this.controllerGeneration,
      state: "termination_confirmed",
      execution_state: "failed"
    });
  }

  private bumpDiagnosticRevision(): void {
    this.diagnosticRevision += 1;
  }
}

export function classifyRefreshInfrastructureFailure(
  error: unknown
): "store_failure" | "permission_failure" {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (code === "EACCES" || code === "EPERM") return "permission_failure";
  }
  return "store_failure";
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
