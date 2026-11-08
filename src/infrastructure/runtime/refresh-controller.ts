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
  GraphBuildPublicationValidationPort,
  GraphBuildValidationReceipt,
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
  RefreshWorkerProgress,
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
  | "manifest_validation_failed"
>;
type PassFailureCode = ControllerWorkerFailureCode | "manifest_validation_failed" | "controller_shutdown";

type PartialRefreshWorkerResult = Extract<RefreshWorkerResult, { outcome: "partial" }>;

type PassOutcome =
  | { outcome: "partial"; result: PartialRefreshWorkerResult }
  | { outcome: "complete"; result: Extract<RefreshWorkerResult, { outcome: "complete" }> }
  | { outcome: "failed"; code: PassFailureCode; worker_started: boolean };

type ControllerFailureCode = PassFailureCode | "store_failure" | "permission_failure" | "manifest_validation_failed";

export type SnapshotRefreshControllerOptions = {
  repo_root: string;
  controller_generation: number;
  timeout_ms: number;
  clock: ClockPort;
  executor: RefreshExecutorPort;
  publication: SnapshotPublicationPort;
  validation: GraphBuildPublicationValidationPort;
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
  private readonly validation: GraphBuildPublicationValidationPort;
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
  private lastWorkerProgress: SnapshotRefreshControllerReceipt["last_worker_progress"];
  private pass = 0;
  private mutationTail: Promise<void> = Promise.resolve();
  private terminationUnconfirmedExecutionId: string | undefined;
  private terminationConfirmedExecutionId: string | undefined;
  private workerTerminationState: SnapshotRefreshControllerReceipt["worker_termination_state"] = "not_required";
  private terminationConfirmationNotified = false;
  private diagnosticRevision = 0;
  private targetPublicationState: SnapshotPublicationState | undefined;
  private unsettledPublicationExecutionId: string | undefined;
  private shutdownRequested = false;
  private shutdownPromise: Promise<void> | undefined;
  private executionPromise: Promise<void> | undefined;
  private currentPassAbort: (() => void) | undefined;
  private currentPassExecutionId: string | undefined;
  private currentPassCancelled = false;
  private workerStartedExecutionId: string | undefined;
  private readonly terminationPromises = new Map<string, Promise<boolean>>();
  private unsettledPublicationReason: "termination_unconfirmed" | "publication_failure" | undefined;

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
    this.validation = options.validation;
    this.deadlineScheduler = options.deadline_scheduler ?? new SystemRefreshDeadlineScheduler();
    this.createExecutionId = options.create_execution_id ?? (() => `refresh-${crypto.randomUUID()}`);
  }

  public shutdown(): Promise<void> {
    if (this.shutdownPromise !== undefined) return this.shutdownPromise;
    this.shutdownRequested = true;
    const active = this.active;
    const executionId = active?.execution_id ?? this.terminationUnconfirmedExecutionId;
    const terminationExecutionId = active?.state === "running" &&
      this.workerStartedExecutionId === active.execution_id
      ? active.execution_id
      : active === undefined
        ? this.terminationUnconfirmedExecutionId
        : undefined;
    const termination = terminationExecutionId !== undefined
      ? this.beginTermination(terminationExecutionId, "controller_shutdown")
      : undefined;
    this.currentPassAbort?.();
    this.shutdownPromise = this.settleShutdown(executionId, termination);
    return this.shutdownPromise;
  }

  public async request(input: SnapshotRefreshRequest): Promise<SnapshotRefreshAdmission> {
    if (input.repo_root !== this.repoRoot) {
      throw new TypeError("Refresh request repository does not match controller ownership.");
    }
    if (!Number.isInteger(input.invalidation_generation) || input.invalidation_generation < 0) {
      throw new TypeError("invalidation_generation must be a non-negative integer.");
    }

    if (this.shutdownRequested) return this.controllerShutdownAdmission();

    return await this.withMutation(() => this.admit(input));
  }

  private async admit(input: SnapshotRefreshRequest): Promise<SnapshotRefreshAdmission> {
    if (this.shutdownRequested) return this.controllerShutdownAdmission();
    if (this.unsettledPublicationExecutionId !== undefined) {
      const blocked = await this.reconcileUnsettledBuild(input);
      if (blocked !== undefined) return blocked;
      if (this.shutdownRequested) return this.controllerShutdownAdmission();
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
      if (this.shutdownRequested) return this.controllerShutdownAdmission();
      const classified = classifyRefreshInfrastructureFailure(error);
      const code = classified === "manifest_validation_failed" ? "store_failure" : classified;
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
    if (this.shutdownRequested) {
      return this.controllerShutdownAdmission();
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
    this.lastWorkerProgress = undefined;
    this.active = {
      execution_id: executionId,
      target_snapshot_id: targetSnapshotId,
      state: "planned",
      started_generation: this.startedGeneration,
      lease,
      publication_state: "building",
    };
    this.bumpDiagnosticRevision();
    this.emitActive("planned", this.active);

    queueMicrotask(() => {
      const execution = this.execute(executionId).catch(async () => {
        await this.withMutation(async () => {
          const current = this.active;
          if (current?.execution_id !== executionId) return;
          if (current.publication_state === "building") {
            await this.failActiveBuild(
              executionId,
              this.shutdownRequested ? "controller_shutdown" : "worker_error"
            );
          } else {
            this.fail(executionId, "worker_error");
          }
        });
      });
      this.executionPromise = execution;
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
      worker_termination_state: this.synchronousWorkerTerminationState(),
      publication_state: this.targetPublicationState,
      last_failure: this.lastFailure,
      last_worker_progress: this.lastWorkerProgress
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
    if (this.shutdownRequested) return this.controllerShutdownAdmission();
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
        last_worker_progress: this.lastWorkerProgress,
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
        if (current?.execution_id !== executionId || this.shutdownRequested) return undefined;
        current.state = "running";
        this.executionState = "running";
        this.bumpDiagnosticRevision();
        this.currentPassExecutionId = executionId;
        this.currentPassCancelled = false;
        this.currentPassAbort = () => {
          this.currentPassCancelled = true;
        };
        this.emitActive("running", current);
        if (this.shutdownRequested || this.currentPassCancelled) {
          this.currentPassAbort = undefined;
          this.currentPassExecutionId = undefined;
          return undefined;
        }
        return current;
      });
      if (pass === undefined) return;

      const outcome = await this.executePass(pass);
      const publicationKind = outcome.outcome === "complete"
        ? "complete"
        : outcome.outcome === "partial" && outcome.result.partial_kind === "publish_seed"
          ? "seed"
          : undefined;
      let validationReceipt: GraphBuildValidationReceipt | undefined;
      let validationFailure: unknown;
      if (publicationKind !== undefined) {
        try {
          // Identity reads and forced event admission must never run under the
          // controller mutation authority; the receipt is committed below.
          validationReceipt = await this.validation.prepare({
            repo_root: this.repoRoot,
            execution_id: pass.execution_id,
            target_snapshot_id: pass.target_snapshot_id,
            controller_generation: this.controllerGeneration,
            invalidation_generation: pass.started_generation,
            kind: publicationKind
          });
        } catch (error) {
          validationFailure = error;
        }
      }
      const continueExecution = await this.withMutation(async () => {
        if (this.active?.execution_id !== executionId) {
          return false;
        }
        if (this.shutdownRequested) {
          await this.failActiveBuild(executionId, "controller_shutdown");
          return false;
        }
        if (outcome.outcome === "failed") {
          await this.failActiveBuild(executionId, outcome.code);
          return false;
        }
        if (outcome.outcome === "partial") {
          if (this.requestedGeneration > pass.started_generation) {
            if (this.shutdownRequested) {
              await this.failActiveBuild(executionId, "controller_shutdown");
              return false;
            }
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

            if (this.shutdownRequested) {
              await this.failActiveBuild(executionId, "controller_shutdown");
              return false;
            }

            if (!(await this.allocateReplacementTarget(executionId, this.requestedGeneration))) {
              return false;
            }
            return true;
          }

          if (validationFailure !== undefined) {
            await this.failActiveBuild(executionId, classifyRefreshInfrastructureFailure(validationFailure));
            return false;
          }

          if (outcome.result.partial_kind === "publish_seed") {
            if (this.shutdownRequested) {
              await this.failActiveBuild(executionId, "controller_shutdown");
              return false;
            }
            try {
              if (validationReceipt === undefined) throw new Error("Missing graph build validation receipt.");
              this.validation.commit({ receipt: validationReceipt, transition: {
                repo_root: this.repoRoot,
                snapshot_id: pass.target_snapshot_id,
                controller_generation: this.controllerGeneration,
                invalidation_generation: pass.started_generation,
                from: "building",
                to: "published",
                updated_at: this.clock.nowIso8601()
              } });
              pass.publication_state = "published";
              this.targetPublicationState = "published";
              this.bumpDiagnosticRevision();
            } catch (error) {
              await this.failActiveBuild(executionId, classifyRefreshInfrastructureFailure(error));
              return false;
            }
            if (this.shutdownRequested) {
              await this.failActiveBuild(executionId, "controller_shutdown");
              return false;
            }
            if (!(await this.allocateReplacementTarget(executionId, this.startedGeneration))) {
              return false;
            }
            return true;
          }
          return true;
        }

        if (this.requestedGeneration > pass.started_generation) {
          if (this.shutdownRequested) {
            await this.failActiveBuild(executionId, "controller_shutdown");
            return false;
          }
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
          if (this.shutdownRequested) {
            await this.failActiveBuild(executionId, "controller_shutdown");
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
            await this.failActiveBuild(
              executionId,
              this.shutdownRequested ? "controller_shutdown" : classifyRefreshInfrastructureFailure(error)
            );
            return false;
          }
          if (this.shutdownRequested) {
            await this.failActiveBuild(executionId, "controller_shutdown");
            return false;
          }
          this.targetSnapshotId = targetSnapshotId;
          this.targetPublicationState = "building";
          this.lastWorkerProgress = undefined;
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
        if (validationFailure !== undefined) {
          await this.failActiveBuild(executionId, classifyRefreshInfrastructureFailure(validationFailure));
          return false;
        }
        if (this.shutdownRequested) {
          await this.failActiveBuild(executionId, "controller_shutdown");
          return false;
        }
        try {
          if (validationReceipt === undefined) throw new Error("Missing graph build validation receipt.");
          this.validation.commit({ receipt: validationReceipt, transition: {
            repo_root: this.repoRoot,
            snapshot_id: pass.target_snapshot_id,
            controller_generation: this.controllerGeneration,
            invalidation_generation: pass.started_generation,
            from: "building",
            to: "published",
            updated_at: this.clock.nowIso8601()
          } });
          pass.publication_state = "published";
          this.targetPublicationState = "published";
          this.bumpDiagnosticRevision();
        } catch (error) {
          await this.failActiveBuild(executionId, classifyRefreshInfrastructureFailure(error));
          return false;
        }
        if (this.shutdownRequested) {
          await this.failActiveBuild(executionId, "controller_shutdown");
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

  private async allocateReplacementTarget(
    executionId: string,
    startedGeneration: number
  ): Promise<boolean> {
    if (this.active?.execution_id !== executionId) {
      return false;
    }
    if (this.shutdownRequested) {
      await this.failActiveBuild(executionId, "controller_shutdown");
      return false;
    }
    let targetSnapshotId: string;
    try {
      targetSnapshotId = await this.publication.allocateBuildSnapshotId({
        repo_root: this.repoRoot,
        minimum_id: String(Math.max(1, this.clock.nowUnixMs()))
      });
    } catch (error) {
      await this.failActiveBuild(
        executionId,
        this.shutdownRequested ? "controller_shutdown" : classifyRefreshInfrastructureFailure(error)
      );
      return false;
    }

    if (this.shutdownRequested || this.active?.execution_id !== executionId) {
      if (this.active?.execution_id === executionId) {
        await this.failActiveBuild(executionId, "controller_shutdown");
      }
      return false;
    }

    this.targetSnapshotId = targetSnapshotId;
    this.targetPublicationState = "building";
    this.lastWorkerProgress = undefined;
    this.startedGeneration = startedGeneration;
    this.pass += 1;
    if (this.active !== undefined) {
      this.active.target_snapshot_id = targetSnapshotId;
      this.active.started_generation = this.startedGeneration;
      this.active.state = "running";
      this.active.publication_state = "building";
    }
    this.bumpDiagnosticRevision();
    return true;
  }

  private async executePass(execution: ActiveExecution): Promise<PassOutcome> {
    const deadline = {
      timeout_ms: this.timeoutMs,
      deadline_at: new Date(this.clock.nowUnixMs() + this.timeoutMs).toISOString()
    };

    const outcome = await new Promise<PassOutcome>((resolve) => {
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
        code: ControllerWorkerFailureCode | "manifest_validation_failed",
        reason: "deadline" | "worker_error"
      ): void => {
        this.beginTermination(execution.execution_id, reason);
        settle({ outcome: "failed", code, worker_started: true });
      };
      this.currentPassExecutionId = execution.execution_id;
      this.currentPassAbort = () => {
        if (claim()) {
          settle({ outcome: "failed", code: "controller_shutdown", worker_started: true });
        }
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

      if (this.shutdownRequested || this.currentPassCancelled) {
        if (claim()) {
          settle({ outcome: "failed", code: "controller_shutdown", worker_started: false });
        }
        return;
      }

      let workerRun: Promise<RefreshExecutorCompletion>;
      try {
        this.workerStartedExecutionId = execution.execution_id;
        const runInput = {
          repo_root: this.repoRoot,
          execution_id: execution.execution_id,
          target_snapshot_id: execution.target_snapshot_id,
          generation: execution.started_generation,
          deadline,
          on_progress: (progress: RefreshWorkerProgress) => {
            if (
              progress.execution_id !== execution.execution_id ||
              progress.target_snapshot_id !== execution.target_snapshot_id
            ) return;
            this.lastWorkerProgress = progress;
            this.bumpDiagnosticRevision();
          }
        };
        this.workerInvocations += 1;
        this.bumpDiagnosticRevision();
        workerRun = this.executor.run(runInput);
      } catch (error) {
        if (claim()) {
          this.beginTermination(execution.execution_id, "worker_error");
          const code = typeof error === "object" && error !== null && "code" in error && error.code === "manifest_validation_failed"
            ? "manifest_validation_failed" : "worker_error";
          settle({ outcome: "failed", code, worker_started: false });
        }
        return;
      }
      void Promise.resolve(workerRun).then(
          (completion) => {
            if (claim()) {
              const outcome = this.validateCompletion(execution, completion);
              if (outcome.outcome === "failed") {
                if (outcome.code === "controller_shutdown") {
                  settle(outcome);
                } else {
                  settleStartedWorkerFailure(outcome.code, "worker_error");
                }
              } else {
                settle(outcome);
              }
            }
          },
          (error) => {
            if (claim()) {
              const code = typeof error === "object" && error !== null && "code" in error && error.code === "manifest_validation_failed"
                ? "manifest_validation_failed" : "worker_error";
              settleStartedWorkerFailure(code, "worker_error");
            }
          }
        );
    });
    if (this.currentPassExecutionId === execution.execution_id) {
      this.currentPassExecutionId = undefined;
      this.currentPassAbort = undefined;
    }
    if (this.workerStartedExecutionId === execution.execution_id) {
      this.workerStartedExecutionId = undefined;
    }
    return outcome;
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
    if (result.outcome === "partial") {
      return { outcome: "partial", result };
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
    if (!targetWasCreated) {
      this.targetPublicationState = undefined;
      this.lastWorkerProgress = undefined;
    }
    this.lastFailure = failure;
    this.workerTerminationState = this.terminationConfirmedExecutionId === executionId
      ? "confirmed"
      : this.terminationUnconfirmedExecutionId === executionId
        ? "unconfirmed"
        : "not_required";
    this.active = undefined;
    if (this.unsettledPublicationExecutionId === executionId) {
      this.unsettledPublicationExecutionId = undefined;
      this.unsettledPublicationReason = undefined;
    }
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
    if (code === "controller_shutdown" && this.terminationUnconfirmedExecutionId === executionId) {
      this.quarantineUnsettledBuild(executionId, code);
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
        this.quarantineUnsettledBuild(
          executionId,
          code === "controller_shutdown" ? code : "store_failure"
        );
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
      if (this.shutdownRequested) {
        execution.publication_state = "failed";
        this.targetPublicationState = "failed";
        this.unsettledPublicationExecutionId = undefined;
        this.unsettledPublicationReason = undefined;
        this.bumpDiagnosticRevision();
        this.fail(executionId, "controller_shutdown");
        return;
      }
      execution.publication_state = "failed";
      this.targetPublicationState = "failed";
      this.bumpDiagnosticRevision();
      this.fail(executionId, code);
    } catch (error) {
      const classified = classifyRefreshInfrastructureFailure(error);
      this.quarantineUnsettledBuild(executionId, classified === "manifest_validation_failed" ? "store_failure" : classified);
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
    this.lastWorkerProgress = undefined;
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
    code: "store_failure" | "permission_failure" | "controller_shutdown"
  ): void {
    const execution = this.active;
    if (execution?.execution_id !== executionId) return;
    this.unsettledPublicationExecutionId = executionId;
    this.unsettledPublicationReason = code === "controller_shutdown" &&
      this.terminationUnconfirmedExecutionId === executionId
      ? "termination_unconfirmed"
      : "publication_failure";
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
        this.unsettledPublicationReason = undefined;
        this.fail(executionId, "store_failure", false);
        return undefined;
      }
      if (selection.status === "blocked" && selection.publication_state !== "building") {
        execution.publication_state = selection.publication_state;
        this.targetPublicationState = selection.publication_state;
        this.unsettledPublicationExecutionId = undefined;
        this.unsettledPublicationReason = undefined;
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
      if (this.shutdownRequested) {
        execution.publication_state = "failed";
        this.targetPublicationState = "failed";
        this.unsettledPublicationExecutionId = undefined;
        this.unsettledPublicationReason = undefined;
        this.bumpDiagnosticRevision();
        this.fail(executionId, "controller_shutdown");
        return this.controllerShutdownAdmission();
      }
      execution.publication_state = "failed";
      this.targetPublicationState = "failed";
      this.unsettledPublicationExecutionId = undefined;
      this.unsettledPublicationReason = undefined;
      this.bumpDiagnosticRevision();
      this.fail(executionId, "store_failure");
      return undefined;
    } catch (error) {
      if (this.shutdownRequested) {
        this.quarantineUnsettledBuild(executionId, "controller_shutdown");
        return this.controllerShutdownAdmission();
      }
      const classified = classifyRefreshInfrastructureFailure(error);
      const code = classified === "manifest_validation_failed" ? "store_failure" : classified;
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

  private controllerShutdownAdmission(): Extract<SnapshotRefreshAdmission, { outcome: "blocked" }> {
    return {
      outcome: "blocked",
      reused: false,
      state: "idle",
      reason: "controller_shutdown",
      message: "Refresh controller is shutting down."
    };
  }

  private synchronousWorkerTerminationState(): SnapshotRefreshControllerReceipt["worker_termination_state"] {
    if (this.executionId !== undefined) {
      if (this.terminationUnconfirmedExecutionId === this.executionId) return "unconfirmed";
      if (this.terminationConfirmedExecutionId === this.executionId) return "confirmed";
    }
    return this.workerTerminationState;
  }

  private async settleShutdown(
    executionId: string | undefined,
    initialTermination: Promise<boolean> | undefined
  ): Promise<void> {
    // Let an already queued execution observe the synchronous shutdown flag.
    await Promise.resolve();
    let termination = initialTermination;
    const active = this.active;
    if (
      termination === undefined &&
      executionId !== undefined &&
      active?.execution_id === executionId &&
      active.state === "running" &&
      this.workerStartedExecutionId === executionId
    ) {
      termination = this.beginTermination(executionId, "controller_shutdown");
      this.currentPassAbort?.();
    }

    const execution = this.executionPromise;
    if (execution !== undefined) await execution;
    if (termination !== undefined && !(await termination)) {
      await this.withMutation(async () => {
        if (executionId !== undefined) {
          await this.failActiveBuild(executionId, "controller_shutdown");
        }
      });
      throw new Error("Refresh controller shutdown could not confirm worker termination.");
    }

    await this.withMutation(async () => {
      if (executionId !== undefined && this.active?.execution_id === executionId) {
        if (
          this.unsettledPublicationExecutionId === executionId &&
          this.unsettledPublicationReason === "publication_failure"
        ) return;
        await this.failActiveBuild(executionId, "controller_shutdown");
      }
    });
    if (this.active !== undefined || this.terminationUnconfirmedExecutionId !== undefined) {
      throw new Error("Refresh controller shutdown could not settle active refresh state.");
    }
  }

  private beginTermination(
    executionId: string,
    reason: "deadline" | "worker_error" | "controller_shutdown"
  ): Promise<boolean> {
    const existing = this.terminationPromises.get(executionId);
    if (existing !== undefined) return existing;
    if (this.terminationConfirmedExecutionId === executionId) return Promise.resolve(true);
    this.terminationUnconfirmedExecutionId = executionId;
    let request: Promise<void>;
    try {
      request = Promise.resolve(this.executor.terminate({ execution_id: executionId, reason }));
    } catch {
      request = Promise.reject(new Error("Refresh worker termination failed."));
    }
    const settled = request.then(
      async () => {
        await this.withMutation(() => {
          if (this.terminationUnconfirmedExecutionId !== executionId) return;
          this.terminationUnconfirmedExecutionId = undefined;
          this.terminationConfirmedExecutionId = executionId;
          if (this.executionState === "failed" && this.executionId === executionId) {
            this.workerTerminationState = "confirmed";
            this.bumpDiagnosticRevision();
          }
          this.emitTerminationConfirmed(executionId);
        });
        if (
          this.terminationPromises.get(executionId) === settled &&
          this.terminationUnconfirmedExecutionId !== executionId
        ) {
          this.terminationPromises.delete(executionId);
        }
        return true;
      },
      () => false
    );
    this.terminationPromises.set(executionId, settled);
    return settled;
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
): "store_failure" | "permission_failure" | "manifest_validation_failed" {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (code === "manifest_validation_failed") return "manifest_validation_failed";
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
  const completeKeys = new Set([
    "outcome",
    "execution_id",
    "target_snapshot_id",
    "completed_generation"
  ]);
  const partialKeys = new Set([
    ...completeKeys,
    "continuation_cursor",
    "partial_kind"
  ]);
  if (
    candidate.outcome === "complete" &&
    typeof candidate.execution_id === "string" &&
    candidate.execution_id.length > 0 &&
    typeof candidate.target_snapshot_id === "string" &&
    candidate.target_snapshot_id.length > 0 &&
    typeof candidate.completed_generation === "number" &&
    Number.isInteger(candidate.completed_generation) &&
    candidate.completed_generation >= 0 &&
    Object.keys(candidate).every((key) => completeKeys.has(key))
  ) {
    return true;
  }
  return (
    candidate.outcome === "partial" &&
    typeof candidate.execution_id === "string" &&
    candidate.execution_id.length > 0 &&
    typeof candidate.target_snapshot_id === "string" &&
    candidate.target_snapshot_id.length > 0 &&
    typeof candidate.completed_generation === "number" &&
    Number.isInteger(candidate.completed_generation) &&
    candidate.completed_generation >= 0 &&
    typeof candidate.continuation_cursor === "string" &&
    candidate.continuation_cursor.length > 0 &&
    (candidate.partial_kind === "publish_seed" || candidate.partial_kind === "continue_build") &&
    Object.keys(candidate).every((key) => partialKeys.has(key))
  );
}
