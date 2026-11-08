/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./native-runtime-startup.mjs";
import { validateTreeSitterSourceBuild } from "./native-runtime-guard.mjs";
import { Worker } from "node:worker_threads";
import { GraphBuildValidationError } from "../../ports/index.js";
import type {
  GraphBuildWatchObservation,
  GraphBuildWatchPort,
  RefreshExecutorCompletion,
  RefreshExecutorPort,
  RefreshWorkerResult
} from "../../ports/index.js";
import type { RefreshWorkerProgress } from "../../contracts/index.js";

export type StartupGraphRefreshExecutorOptions = {
  database_path: string;
  config_identity: string;
  max_files: number;
  retain_latest_snapshots: number;
  retain_latest_fresh_snapshots: number;
  controller_generation: number;
  observation: GraphBuildWatchPort;
  worker_factory?: (input: { workerData: Record<string, unknown> }) => Worker;
};

/** Sole production adapter for the existing startup graph worker. */
export class StartupGraphRefreshExecutor implements RefreshExecutorPort {
  private readonly workers = new Map<string, Worker>();
  private readonly starting = new Set<string>();
  private readonly cancelledBeforeStart = new Set<string>();
  private readonly terminations = new Map<string, Promise<void>>();
  private readonly observationSettlements = new Map<string, () => Promise<void>>();

  public constructor(private readonly options: StartupGraphRefreshExecutorOptions) {}

  public run(input: Parameters<RefreshExecutorPort["run"]>[0]): Promise<RefreshExecutorCompletion> {
    validateTreeSitterSourceBuild();
    if (this.workers.has(input.execution_id) || this.starting.has(input.execution_id)) {
      throw new Error("Refresh execution already has a worker.");
    }
    // Disabled or unhealthy observation fails synchronously. A queued native
    // event is admitted below through the canonical force drain.
    assertRootWatchObservation(this.options.observation.observe());
    this.starting.add(input.execution_id);
    return this.runAfterDrain(input);
  }

  private async runAfterDrain(input: Parameters<RefreshExecutorPort["run"]>[0]): Promise<RefreshExecutorCompletion> {
    let watcherObservation: GraphBuildWatchObservation;
    try {
      // executePass invokes this adapter outside controller/coordinator locks.
      watcherObservation = await this.options.observation.drain();
      if (this.cancelledBeforeStart.has(input.execution_id)) {
        throw new GraphBuildValidationError("refresh_execution_cancelled_before_worker_start");
      }
      assertDrainedRootWatchObservation(watcherObservation);
    } catch (error) {
      this.starting.delete(input.execution_id);
      this.cancelledBeforeStart.delete(input.execution_id);
      throw error;
    }
    const workerData = {
      executionId: input.execution_id,
      repoRoot: input.repo_root,
      databasePath: this.options.database_path,
      snapshotId: input.target_snapshot_id,
      configIdentity: this.options.config_identity,
      maxFiles: this.options.max_files,
      retainLatestSnapshots: this.options.retain_latest_snapshots,
      retainLatestFreshSnapshots: this.options.retain_latest_fresh_snapshots,
      controllerGeneration: this.options.controller_generation,
      invalidationGeneration: input.generation,
      watcherObservation,
      deadlineAt: input.deadline.deadline_at,
      timeoutMs: input.deadline.timeout_ms
    };
    let worker: Worker;
    try {
      worker = this.options.worker_factory?.({ workerData }) ?? new Worker(
        new URL("../workers/startup-graph-warmup-worker-entrypoint.mjs", import.meta.url),
        { workerData }
      );
    } catch (error) {
      this.starting.delete(input.execution_id);
      this.cancelledBeforeStart.delete(input.execution_id);
      throw error;
    }
    this.workers.set(input.execution_id, worker);
    this.starting.delete(input.execution_id);
    worker.unref();

    return new Promise<RefreshExecutorCompletion>((resolve, reject) => {
      const results: unknown[] = [];
      let workerError: Error | undefined;
      let exited = false;
      let exitCode: number | undefined;
      let pendingObservationRequests = 0;
      const observationWaiters = new Set<() => void>();
      const requestIds = new Set<string>();
      const cleanup = (): void => {
        this.workers.delete(input.execution_id);
        this.starting.delete(input.execution_id);
        this.cancelledBeforeStart.delete(input.execution_id);
        this.terminations.delete(input.execution_id);
        this.observationSettlements.delete(input.execution_id);
        worker.off("message", onMessage);
        worker.off("error", onError);
        worker.off("exit", onExit);
      };
      const settle = (): void => {
        if (!exited || pendingObservationRequests !== 0 || exitCode === undefined) return;
        cleanup();
        if (workerError !== undefined) {
          reject(workerError);
        } else {
          resolve({ exit_code: exitCode, results });
        }
      };
      const settleObservationRequests = (): void => {
        if (pendingObservationRequests !== 0) return;
        for (const resolve of observationWaiters) resolve();
        observationWaiters.clear();
      };
      this.observationSettlements.set(input.execution_id, async () => {
        if (pendingObservationRequests === 0) return;
        await new Promise<void>((resolve) => observationWaiters.add(resolve));
      });
      const failProtocol = (error: Error): void => {
        if (workerError !== undefined) return;
        workerError = error;
        void this.terminate({ execution_id: input.execution_id, reason: "worker_error" });
      };
      const onMessage = (message: unknown): void => {
        if (isObservationRequestMessage(message)) {
          const request = parseObservationRequest(message, {
            execution_id: input.execution_id,
            target_snapshot_id: input.target_snapshot_id,
            controller_generation: this.options.controller_generation,
            invalidation_generation: input.generation,
            watcher_epoch: watcherObservation.epoch
          });
          if (request === undefined || requestIds.has((message as { request_id?: string }).request_id ?? "")) {
            failProtocol(new Error("Malformed or duplicate graph-build observation request."));
            return;
          }
          requestIds.add(request.request_id);
          pendingObservationRequests += 1;
          void this.fulfillObservationRequest(request, watcherObservation.epoch)
            .then((result) => {
              worker.postMessage({
                type: "graph_build_observation_ack",
                request_id: request.request_id,
                execution_id: request.execution_id,
                target_snapshot_id: request.target_snapshot_id,
                controller_generation: request.controller_generation,
                invalidation_generation: request.invalidation_generation,
                watcher_epoch: request.watcher_epoch,
                accepted: true,
                result
              });
            })
            .catch((error: unknown) => {
              const failure = toError(error);
              try {
                worker.postMessage({
                  type: "graph_build_observation_ack",
                  request_id: request.request_id,
                  execution_id: request.execution_id,
                  target_snapshot_id: request.target_snapshot_id,
                  controller_generation: request.controller_generation,
                  invalidation_generation: request.invalidation_generation,
                  watcher_epoch: request.watcher_epoch,
                  accepted: false,
                  error: failure.message
                });
              } finally {
                failProtocol(failure);
              }
            })
            .finally(() => {
              pendingObservationRequests -= 1;
              settleObservationRequests();
              settle();
            });
          return;
        }
        const progress = getRefreshWorkerProgress(
          message,
          input.target_snapshot_id,
          input.execution_id
        );
        if (progress !== undefined) {
          input.on_progress?.(progress);
          return;
        }
        if (results.length >= 2) return;
        const result = getRefreshWorkerResult(
          message,
          input.target_snapshot_id,
          input.execution_id
        );
        if (result === undefined) {
          results.push(message);
          return;
        }
        results.push(result);
      };
      const onError = (error: Error): void => {
        workerError = error;
      };
      const onExit = (code: number): void => {
        exited = true;
        exitCode = code;
        settle();
      };
      worker.on("message", onMessage);
      worker.once("error", onError);
      worker.once("exit", onExit);
    });
  }

  private async fulfillObservationRequest(
    request: GraphBuildObservationRequest,
    expectedEpoch: string
  ): Promise<GraphBuildWatchObservation> {
    const observation = request.operation === "observe"
      ? this.options.observation.observe()
      : await this.options.observation.registerDirectory({ path: request.path!, repository_key: request.repository_key });
    assertWatchObservation(observation, expectedEpoch, request.operation === "observe" ? "." : request.path!);
    return observation;
  }

  public async terminate(input: Parameters<RefreshExecutorPort["terminate"]>[0]): Promise<void> {
    const worker = this.workers.get(input.execution_id);
    if (worker === undefined) {
      if (this.starting.has(input.execution_id)) {
        // No isolate exists yet. Mark the asynchronous admission cancelled but
        // do not await its drain: that drain may re-enter trigger admission.
        this.cancelledBeforeStart.add(input.execution_id);
      }
      return;
    }
    const awaitObservationSettlements = this.observationSettlements.get(input.execution_id);
    let termination = this.terminations.get(input.execution_id);
    if (termination === undefined) {
      termination = Promise.resolve().then(async () => {
        await worker.terminate();
        await awaitObservationSettlements?.();
      });
      this.terminations.set(input.execution_id, termination);
    }
    await termination;
  }
}

type GraphBuildObservationRequest = {
  type: "graph_build_observation_request";
  request_id: string;
  execution_id: string;
  target_snapshot_id: string;
  controller_generation: number;
  invalidation_generation: number;
  watcher_epoch: string;
  operation: "observe" | "register_directory";
  path?: string;
  repository_key?: string;
};

function isObservationRequestMessage(value: unknown): value is { type: "graph_build_observation_request" } {
  return typeof value === "object" && value !== null &&
    (value as { type?: unknown }).type === "graph_build_observation_request";
}

function parseObservationRequest(
  value: unknown,
  identity: Omit<GraphBuildObservationRequest, "type" | "request_id" | "operation" | "path">
): GraphBuildObservationRequest | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const request = value as Record<string, unknown>;
  if (typeof request.request_id !== "string" || request.request_id.length === 0 || request.request_id.length > 512 ||
    request.execution_id !== identity.execution_id || request.target_snapshot_id !== identity.target_snapshot_id ||
    request.controller_generation !== identity.controller_generation || request.invalidation_generation !== identity.invalidation_generation ||
    request.watcher_epoch !== identity.watcher_epoch ||
    (request.operation !== "observe" && request.operation !== "register_directory")) {
    return undefined;
  }
  if (request.operation === "observe") {
    if (request.path !== undefined || request.repository_key !== undefined) return undefined;
  } else if (!isBoundedRelativePath(request.path) ||
    (request.repository_key !== undefined && !isBoundedRepositoryKey(request.repository_key))) {
    return undefined;
  }
  const allowed = request.operation === "observe"
    ? new Set(["type", "request_id", "execution_id", "target_snapshot_id", "controller_generation", "invalidation_generation", "watcher_epoch", "operation"])
    : new Set(["type", "request_id", "execution_id", "target_snapshot_id", "controller_generation", "invalidation_generation", "watcher_epoch", "operation", "path", "repository_key"]);
  if (!Object.keys(request).every((key) => allowed.has(key))) return undefined;
  return request as GraphBuildObservationRequest;
}

function assertRootWatchObservation(observation: GraphBuildWatchObservation): void {
  if (typeof observation.epoch !== "string" || observation.epoch.length === 0) {
    throw new GraphBuildValidationError("watch_session_epoch_unavailable");
  }
  assertWatchObservation(observation, observation.epoch, ".");
}

function assertDrainedRootWatchObservation(observation: GraphBuildWatchObservation): void {
  assertRootWatchObservation(observation);
  if (observation.pending_events !== 0) {
    throw new GraphBuildValidationError("watch_observation_pending_after_drain");
  }
}


function assertWatchObservation(
  observation: GraphBuildWatchObservation,
  expectedEpoch: string,
  requiredDirectory: string
): void {
  if (observation.epoch !== expectedEpoch || !observation.healthy ||
    !Number.isSafeInteger(observation.sequence) || observation.sequence < 0 ||
    !Number.isSafeInteger(observation.pending_events) || observation.pending_events < 0 ||
    !observation.covered_directories.includes(requiredDirectory)) {
    throw new GraphBuildValidationError("watch_observation_unhealthy_or_missing_coverage");
  }
}

function isBoundedRelativePath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 4096 || value.includes("\0")) return false;
  const normalized = value.replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/\/+$/, "") || ".";
  return !normalized.startsWith("/") && normalized !== ".." && !normalized.startsWith("../");
}

function isBoundedRepositoryKey(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && !value.includes("\0");
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function getRefreshWorkerProgress(
  message: unknown,
  snapshotId: string,
  executionId: string
): RefreshWorkerProgress | undefined {
  if (typeof message !== "object" || message === null) return undefined;
  const envelope = message as { type?: unknown; progress?: unknown };
  if (envelope.type !== "progress" || typeof envelope.progress !== "object" || envelope.progress === null) {
    return undefined;
  }
  const progress = envelope.progress as Record<string, unknown>;
  const fields = new Set(["execution_id", "target_snapshot_id", "phase", "completed_units"]);
  if (
    progress.execution_id !== executionId ||
    progress.target_snapshot_id !== snapshotId ||
    (progress.phase !== "composition" && progress.phase !== "catalog" && progress.phase !== "extraction" &&
      progress.phase !== "docs" && progress.phase !== "graph_write" && progress.phase !== "resolution" &&
      progress.phase !== "finalizing") ||
    typeof progress.completed_units !== "number" ||
    !Number.isSafeInteger(progress.completed_units) ||
    progress.completed_units < 0 ||
    !Object.keys(progress).every((key) => fields.has(key))
  ) return undefined;
  return progress as RefreshWorkerProgress;
}

function getRefreshWorkerResult(
  message: unknown,
  snapshotId: string,
  executionId: string
): RefreshWorkerResult | undefined {
  if (
    typeof message !== "object" ||
    message === null ||
    !("type" in message) ||
    !("result" in message)
  ) {
    return undefined;
  }
  const type = (message as { type?: unknown }).type;
  if (type !== "complete" && type !== "partial") {
    return undefined;
  }
  const result = (message as { result?: unknown }).result;
  if (!isRefreshWorkerResult(result, snapshotId, executionId)) {
    return undefined;
  }
  if (typeof result !== "object" || result === null) return undefined;
  if (result.outcome !== type) {
    return undefined;
  }
  if (result.outcome === "complete") {
    return {
      outcome: "complete",
      execution_id: result.execution_id,
      target_snapshot_id: result.target_snapshot_id,
      completed_generation: result.completed_generation
    };
  }
  return {
    outcome: "partial",
    execution_id: result.execution_id,
    target_snapshot_id: result.target_snapshot_id,
    completed_generation: result.completed_generation,
    continuation_cursor: result.continuation_cursor,
    partial_kind: result.partial_kind
  };
}

function isRefreshWorkerResult(
  value: unknown,
  snapshotId: string,
  executionId: string
): value is RefreshWorkerResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const completeFields = new Set(["outcome", "execution_id", "target_snapshot_id", "completed_generation"]);
  const partialFields = new Set(["outcome", "execution_id", "target_snapshot_id", "completed_generation", "continuation_cursor", "partial_kind"]);

  if (
    candidate.outcome === "complete" &&
    candidate.execution_id === executionId &&
    candidate.target_snapshot_id === snapshotId &&
    typeof candidate.execution_id === "string" &&
    candidate.execution_id.length > 0 &&
    typeof candidate.target_snapshot_id === "string" &&
    candidate.target_snapshot_id.length > 0 &&
    typeof candidate.completed_generation === "number" &&
    Number.isInteger(candidate.completed_generation) &&
    candidate.completed_generation >= 0 &&
    Object.keys(candidate).every((key) => completeFields.has(key))
  ) {
    return true;
  }

  return (
    candidate.outcome === "partial" &&
    candidate.execution_id === executionId &&
    candidate.target_snapshot_id === snapshotId &&
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
    Object.keys(candidate).every((key) => partialFields.has(key))
  );
}
