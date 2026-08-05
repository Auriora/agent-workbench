/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Worker } from "node:worker_threads";
import type {
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
  worker_factory?: (input: { workerData: Record<string, unknown> }) => Worker;
};

/** Sole production adapter for the existing startup graph worker. */
export class StartupGraphRefreshExecutor implements RefreshExecutorPort {
  private readonly workers = new Map<string, Worker>();
  private readonly terminations = new Map<string, Promise<void>>();

  public constructor(private readonly options: StartupGraphRefreshExecutorOptions) {}

  public run(input: Parameters<RefreshExecutorPort["run"]>[0]): Promise<RefreshExecutorCompletion> {
    if (this.workers.has(input.execution_id)) {
      throw new Error("Refresh execution already has a worker.");
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
      deadlineAt: input.deadline.deadline_at,
      timeoutMs: input.deadline.timeout_ms
    };
    const worker = this.options.worker_factory?.({ workerData }) ?? new Worker(
      new URL("../workers/startup-graph-warmup-worker-entrypoint.mjs", import.meta.url),
      { workerData }
    );
    this.workers.set(input.execution_id, worker);
    worker.unref();

    return new Promise<RefreshExecutorCompletion>((resolve, reject) => {
      const results: unknown[] = [];
      let workerError: Error | undefined;
      const cleanup = (): void => {
        this.workers.delete(input.execution_id);
        this.terminations.delete(input.execution_id);
        worker.off("message", onMessage);
        worker.off("error", onError);
        worker.off("exit", onExit);
      };
      const onMessage = (message: unknown): void => {
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
        cleanup();
        if (workerError !== undefined) {
          reject(workerError);
        } else {
          resolve({ exit_code: code, results });
        }
      };
      worker.on("message", onMessage);
      worker.once("error", onError);
      worker.once("exit", onExit);
    });
  }

  public async terminate(input: Parameters<RefreshExecutorPort["terminate"]>[0]): Promise<void> {
    const worker = this.workers.get(input.execution_id);
    if (worker === undefined) return;
    let termination = this.terminations.get(input.execution_id);
    if (termination === undefined) {
      termination = Promise.resolve().then(async () => {
        await worker.terminate();
      });
      this.terminations.set(input.execution_id, termination);
    }
    await termination;
  }
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
