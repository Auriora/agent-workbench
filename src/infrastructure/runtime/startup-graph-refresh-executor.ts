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
  vacuum: boolean;
  controller_generation: number;
};

/** Sole production adapter for the existing startup graph worker. */
export class StartupGraphRefreshExecutor implements RefreshExecutorPort {
  private readonly workers = new Map<string, Worker>();

  public constructor(private readonly options: StartupGraphRefreshExecutorOptions) {}

  public run(input: Parameters<RefreshExecutorPort["run"]>[0]): Promise<RefreshExecutorCompletion> {
    if (this.workers.has(input.execution_id)) {
      throw new Error("Refresh execution already has a worker.");
    }
    const worker = new Worker(
      new URL("../workers/startup-graph-warmup-worker-entrypoint.mjs", import.meta.url),
      {
        workerData: {
          repoRoot: input.repo_root,
          databasePath: this.options.database_path,
          snapshotId: input.target_snapshot_id,
          configIdentity: this.options.config_identity,
          maxFiles: this.options.max_files,
          retainLatestSnapshots: this.options.retain_latest_snapshots,
          retainLatestFreshSnapshots: this.options.retain_latest_fresh_snapshots,
          vacuum: this.options.vacuum,
          controllerGeneration: this.options.controller_generation,
          invalidationGeneration: input.generation
        }
      }
    );
    this.workers.set(input.execution_id, worker);
    worker.unref();

    return new Promise<RefreshExecutorCompletion>((resolve, reject) => {
      let settled = false;
      const finish = (completion: RefreshExecutorCompletion): void => {
        if (settled) return;
        settled = true;
        this.workers.delete(input.execution_id);
        resolve(completion);
      };
      worker.once("message", (message: unknown) => {
        if (!isCompleteWorkerMessage(message, input.target_snapshot_id)) {
          finish({ exit_code: 0, results: [message] });
          return;
        }
        finish({
          exit_code: 0,
          results: [{
            outcome: "complete",
            execution_id: input.execution_id,
            target_snapshot_id: input.target_snapshot_id,
            completed_generation: input.generation
          }]
        });
      });
      worker.once("error", (error) => {
        if (settled) return;
        settled = true;
        this.workers.delete(input.execution_id);
        reject(error);
      });
      worker.once("exit", (code) => {
        if (!settled) {
          finish({ exit_code: code, results: [] });
        }
      });
    });
  }

  public async terminate(input: Parameters<RefreshExecutorPort["terminate"]>[0]): Promise<void> {
    const worker = this.workers.get(input.execution_id);
    if (worker === undefined) return;
    await worker.terminate();
    this.workers.delete(input.execution_id);
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
