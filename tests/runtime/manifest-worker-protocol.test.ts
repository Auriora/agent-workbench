/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EventEmitter } from "node:events";
import type { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";
import type { GraphBuildWatchObservation, GraphBuildWatchPort } from "../../src/ports/index.js";
import { StartupGraphRefreshExecutor } from "../../src/infrastructure/runtime/startup-graph-refresh-executor.js";
import { createGraphBuildObservationClient } from "../../src/infrastructure/workers/graph-build-observation-client.js";

const observation = (overrides: Partial<GraphBuildWatchObservation> = {}): GraphBuildWatchObservation => ({
  epoch: "watch-1",
  sequence: 3,
  healthy: true,
  pending_events: 0,
  covered_directories: ["."],
  ...overrides
});

class ProtocolPort extends EventEmitter {
  public readonly sent: unknown[] = [];
  public postMessage(message: unknown): void { this.sent.push(message); }
}

class ProtocolWorker extends EventEmitter {
  public readonly sent: unknown[] = [];
  public terminationCalls = 0;
  public factoryCalls = 0;
  public workerData: Record<string, unknown> | undefined;
  private resolveFactoryReady!: () => void;
  public readonly factoryReady = new Promise<void>((resolve) => { this.resolveFactoryReady = resolve; });
  public created(workerData: Record<string, unknown>): void {
    this.factoryCalls += 1;
    this.workerData = workerData;
    this.resolveFactoryReady();
  }
  public unref(): this { return this; }
  public postMessage(message: unknown): void { this.sent.push(message); }
  public async terminate(): Promise<number> {
    this.terminationCalls += 1;
    queueMicrotask(() => this.emit("exit", 1));
    return 1;
  }
}

function watchPort(registerDirectory: GraphBuildWatchPort["registerDirectory"] = async ({ path }) =>
  observation({ covered_directories: [".", path] })
): GraphBuildWatchPort {
  return {
    start: async () => observation(),
    observe: () => observation(),
    registerDirectory,
    drain: async () => observation(),
    close: async () => undefined
  };
}

function executor(worker: ProtocolWorker, watcher: GraphBuildWatchPort = watchPort()): StartupGraphRefreshExecutor {
  return new StartupGraphRefreshExecutor({
    database_path: "/tmp/test.sqlite",
    config_identity: "test",
    max_files: 1,
    retain_latest_snapshots: 1,
    retain_latest_fresh_snapshots: 1,
    controller_generation: 4,
    observation: watcher,
    worker_factory: ({ workerData }) => {
      worker.created(workerData);
      return worker as unknown as Worker;
    }
  });
}

const execution = {
  repo_root: "/repo",
  execution_id: "exec-1",
  target_snapshot_id: "snapshot-1",
  generation: 5,
  deadline: { timeout_ms: 60_000, deadline_at: "2026-07-20T10:01:00.000Z" }
};

function request(overrides: Record<string, unknown> = {}) {
  return {
    type: "graph_build_observation_request",
    request_id: "request-1",
    execution_id: execution.execution_id,
    target_snapshot_id: execution.target_snapshot_id,
    controller_generation: 4,
    invalidation_generation: execution.generation,
    watcher_epoch: "watch-1",
    operation: "observe",
    ...overrides
  };
}

describe("manifest worker observation protocol", () => {
  it("fails closed for stale epochs, wrong targets, and duplicate request ids", async () => {
    const worker = new ProtocolWorker();
    const completion = executor(worker).run(execution);
    await worker.factoryReady;
    worker.emit("message", request({ watcher_epoch: "stale" }));
    await expect(completion).rejects.toThrow("Malformed or duplicate");
    expect(worker.terminationCalls).toBe(1);

    const duplicateWorker = new ProtocolWorker();
    const duplicateCompletion = executor(duplicateWorker).run(execution);
    await duplicateWorker.factoryReady;
    duplicateWorker.emit("message", request());
    duplicateWorker.emit("message", request());
    await expect(duplicateCompletion).rejects.toThrow("Malformed or duplicate");
    expect(duplicateWorker.terminationCalls).toBe(1);
  });

  it("does not settle while a directory arm acknowledgement is pending", async () => {
    let release: ((value: GraphBuildWatchObservation) => void) | undefined;
    const worker = new ProtocolWorker();
    const completion = executor(worker, watchPort(async () => new Promise<GraphBuildWatchObservation>((resolve) => {
      release = resolve;
    }))).run(execution);
    await worker.factoryReady;
    worker.emit("message", request({ operation: "register_directory", path: "app", repository_key: "superproject" }));
    worker.emit("exit", 0);
    let settled = false;
    void completion.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    release?.(observation({ covered_directories: [".", "app"] }));
    await expect(completion).resolves.toMatchObject({ exit_code: 0, results: [] });
  });

  it("confirms termination only after an admitted directory arm settles", async () => {
    let release: ((value: GraphBuildWatchObservation) => void) | undefined;
    const worker = new ProtocolWorker();
    const runtime = executor(worker, watchPort(async () => new Promise<GraphBuildWatchObservation>((resolve) => {
      release = resolve;
    })));
    const completion = runtime.run(execution);
    await worker.factoryReady;
    worker.emit("message", request({ operation: "register_directory", path: "app", repository_key: "superproject" }));
    await Promise.resolve();
    let terminated = false;
    const termination = runtime.terminate({ execution_id: execution.execution_id, reason: "controller_shutdown" })
      .then(() => { terminated = true; });
    await Promise.resolve();
    expect(terminated).toBe(false);
    release?.(observation({ covered_directories: [".", "app"] }));
    await termination;
    await expect(completion).resolves.toMatchObject({ exit_code: 1 });
  });

  it("force-drains a debounced pending observation before admitting a worker", async () => {
    let drains = 0;
    const worker = new ProtocolWorker();
    const watcher: GraphBuildWatchPort = {
      start: async () => observation({ pending_events: 1 }),
      observe: () => observation({ pending_events: 1 }),
      registerDirectory: async ({ path }) => observation({ covered_directories: [".", path] }),
      drain: async () => {
        drains += 1;
        return observation({ sequence: 4, pending_events: 0 });
      },
      close: async () => undefined
    };
    const completion = executor(worker, watcher).run(execution);
    await worker.factoryReady;
    expect(drains).toBe(1);
    expect(worker.workerData).toMatchObject({ watcherObservation: observation({ sequence: 4 }) });
    worker.emit("exit", 0);
    await expect(completion).resolves.toMatchObject({ exit_code: 0, results: [] });
  });

  it("does not spawn after termination confirms during a pending pre-pass drain", async () => {
    let releaseDrain: ((value: GraphBuildWatchObservation) => void) | undefined;
    let drains = 0;
    const worker = new ProtocolWorker();
    const watcher: GraphBuildWatchPort = {
      start: async () => observation(),
      observe: () => observation(),
      registerDirectory: async ({ path }) => observation({ covered_directories: [".", path] }),
      drain: async () => {
        drains += 1;
        return drains === 1
          ? await new Promise<GraphBuildWatchObservation>((resolve) => { releaseDrain = resolve; })
          : observation();
      },
      close: async () => undefined
    };
    const runtime = executor(worker, watcher);
    const completion = runtime.run(execution);
    expect(() => runtime.run(execution)).toThrow("Refresh execution already has a worker.");
    await expect(runtime.terminate({ execution_id: execution.execution_id, reason: "controller_shutdown" })).resolves.toBeUndefined();
    releaseDrain?.(observation());
    await expect(completion).rejects.toThrow("refresh_execution_cancelled_before_worker_start");
    expect(worker.factoryCalls).toBe(0);

    const replacement = runtime.run(execution);
    await worker.factoryReady;
    worker.emit("exit", 0);
    await expect(replacement).resolves.toMatchObject({ exit_code: 0, results: [] });
  });

  it("correlates acknowledgements and rejects mismatched or duplicate acknowledgements", async () => {
    const port = new ProtocolPort();
    const client = createGraphBuildObservationClient({
      port: port as never,
      identity: {
        execution_id: execution.execution_id,
        target_snapshot_id: execution.target_snapshot_id,
        controller_generation: 4,
        invalidation_generation: execution.generation,
        watcher_epoch: "watch-1"
      },
      initial_observation: observation()
    });
    const started = client.start();
    const sent = port.sent[0] as Record<string, unknown>;
    port.emit("message", {
      ...sent,
      type: "graph_build_observation_ack",
      target_snapshot_id: "wrong-target",
      accepted: true,
      result: observation()
    });
    await expect(started).rejects.toThrow("Mismatched");

    const secondPort = new ProtocolPort();
    const secondClient = createGraphBuildObservationClient({
      port: secondPort as never,
      identity: {
        execution_id: execution.execution_id,
        target_snapshot_id: execution.target_snapshot_id,
        controller_generation: 4,
        invalidation_generation: execution.generation,
        watcher_epoch: "watch-1"
      },
      initial_observation: observation()
    });
    const secondStarted = secondClient.start();
    const secondSent = secondPort.sent[0] as Record<string, unknown>;
    const acknowledgement = { ...secondSent, type: "graph_build_observation_ack", accepted: true, result: observation() };
    secondPort.emit("message", acknowledgement);
    await expect(secondStarted).resolves.toEqual(observation());
    secondPort.emit("message", acknowledgement);
    await expect(secondClient.start()).rejects.toThrow("Duplicate");
  });
});
