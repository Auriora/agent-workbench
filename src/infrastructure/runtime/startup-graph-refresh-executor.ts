/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Worker } from "node:worker_threads";
import type {
  RefreshExecutorCompletion,
  RefreshExecutorPort
} from "../../ports/index.js";

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
          repoRoot: input.repo_root,
          databasePath: this.options.database_path,
          snapshotId: input.target_snapshot_id,
          configIdentity: this.options.config_identity,
          maxFiles: this.options.max_files,
          retainLatestSnapshots: this.options.retain_latest_snapshots,
          retainLatestFreshSnapshots: this.options.retain_latest_fresh_snapshots,
          controllerGeneration: this.options.controller_generation,
          invalidationGeneration: input.generation
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
        if (results.length >= 2) return;
        if (!isCompleteWorkerMessage(message, input.target_snapshot_id)) {
          results.push(message);
          return;
        }
        results.push({
            outcome: "complete",
            execution_id: input.execution_id,
            target_snapshot_id: input.target_snapshot_id,
            completed_generation: input.generation
        });
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

function isCompleteWorkerMessage(message: unknown, snapshotId: string): boolean {
  if (
    typeof message !== "object" ||
    message === null ||
    !("type" in message) ||
    (message as { type?: unknown }).type !== "complete" ||
    !("result" in message)
  ) {
    return false;
  }
  const result = (message as { result?: unknown }).result;
  return (
    typeof result === "object" &&
    result !== null &&
    "snapshot_id" in result &&
    (result as { snapshot_id?: unknown }).snapshot_id === snapshotId
  );
}
