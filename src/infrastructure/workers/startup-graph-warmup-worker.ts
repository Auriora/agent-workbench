/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { parentPort, workerData } from "node:worker_threads";
import { runRepositoryGraphBuildSlice } from "../../application/use-cases/index-repository-graph.js";
import { SCHEMA_VERSION, openGraphStore } from "../sqlite/index.js";
import {
  FileCatalogScannerAdapter,
  WorkspaceFileAdapter
} from "../filesystem/index.js";
import {
  createProductionExtractorRegistry,
  ResourceExtractorAdapter
} from "../extraction/index.js";
import { SystemClockAdapter } from "../time/index.js";

const COMMON_RAILS_FRONT_DOOR_PRIORITY_PATHS = [
  "AGENTS.md",
  "README.md",
  "Gemfile",
  "config/application.rb",
  "config/routes.rb"
] as const;

type StartupGraphWarmupWorkerData = {
  executionId: string;
  repoRoot: string;
  databasePath: string;
  snapshotId: string;
  configIdentity: string;
  maxFiles: number;
  retainLatestSnapshots: number;
  retainLatestFreshSnapshots: number;
  controllerGeneration: number;
  invalidationGeneration: number;
};

const input = workerData as StartupGraphWarmupWorkerData;
assertGeneration("controllerGeneration", input.controllerGeneration);
assertGeneration("invalidationGeneration", input.invalidationGeneration);
const scanner = new FileCatalogScannerAdapter();
const workspace = new WorkspaceFileAdapter({ repoRoot: input.repoRoot });
const graphStore = openGraphStore(input.databasePath);
const crashBarrierProbe = readCrashBarrierProbe();
const workerGraphStore = crashBarrierProbe === undefined
  ? graphStore
  : decorateGraphStore(graphStore, async (method, args) => {
      const barrier = matchingCrashBarrier(method, args);
      if (barrier !== undefined && barrier === crashBarrierProbe.barrier) {
        await pauseAtCrashBarrier(crashBarrierProbe, barrier);
      }
    });
const extractors = createProductionExtractorRegistry();

try {
  const result = await runRepositoryGraphBuildSlice({
    repo_root: input.repoRoot,
    scanner,
    workspace,
    extractors,
    resource_extractor: new ResourceExtractorAdapter(),
    graph: workerGraphStore,
    catalog: workerGraphStore,
    docs_index: workerGraphStore,
    documentation_concerns: workerGraphStore,
    snapshots: workerGraphStore,
    build_progress: workerGraphStore,
    build_seed: workerGraphStore,
    build_read: workerGraphStore,
    build_coverage: workerGraphStore,
    build_resolution: workerGraphStore,
    clock: new SystemClockAdapter(),
    schema_version: SCHEMA_VERSION,
    snapshot_id: input.snapshotId,
    owner_id: input.executionId,
    config_identity: input.configIdentity,
    max_files: input.maxFiles,
    max_extraction_files: input.maxFiles,
    priority_paths: COMMON_RAILS_FRONT_DOOR_PRIORITY_PATHS,
    controller_generation: input.controllerGeneration,
    invalidation_generation: input.invalidationGeneration
  });
  await graphStore.pruneRepositorySnapshots({
    repo_root: input.repoRoot,
    retain_latest_snapshots: input.retainLatestSnapshots,
    retain_latest_fresh_snapshots: input.retainLatestFreshSnapshots,
    vacuum: false
  });
  if (crashBarrierProbe?.barrier === "prepublication") {
    await pauseAtCrashBarrier(crashBarrierProbe, "prepublication");
  }
  if (result.outcome === "partial") {
    if (result.continuation_cursor === undefined || result.partial_kind === undefined) {
      throw new Error("Partial graph build slice did not return its continuation contract.");
    }
    parentPort?.postMessage({
      type: "partial",
      result: {
        outcome: "partial",
        execution_id: input.executionId,
        target_snapshot_id: input.snapshotId,
        completed_generation: input.invalidationGeneration,
        continuation_cursor: result.continuation_cursor,
        partial_kind: result.partial_kind
      }
    });
  } else {
    parentPort?.postMessage({
      type: "complete",
      result: {
        outcome: "complete",
        execution_id: input.executionId,
        target_snapshot_id: input.snapshotId,
        completed_generation: input.invalidationGeneration
      }
    });
  }
} finally {
  graphStore.close();
}

function assertGeneration(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer.`);
  }
}

type TestCrashBarrier = "generation" | "catalog" | "docs" | "graph" | "prepublication";
type TestCrashBarrierProbe = {
  barrier: TestCrashBarrier;
  markerPath: string;
  releasePath: string;
};
type WorkerGraphStore = typeof graphStore;

function readCrashBarrierProbe(): TestCrashBarrierProbe | undefined {
  if (process.env.NODE_ENV !== "test") {
    return undefined;
  }
  const barrier = process.env.AGENT_WORKBENCH_TEST_REFRESH_CRASH_BARRIER;
  const markerPath = process.env.AGENT_WORKBENCH_TEST_REFRESH_CRASH_MARKER;
  const releasePath = process.env.AGENT_WORKBENCH_TEST_REFRESH_CRASH_RELEASE;
  if (
    barrier === undefined ||
    !isTestCrashBarrier(barrier) ||
    markerPath === undefined ||
    releasePath === undefined
  ) {
    return undefined;
  }
  const probeRoot = path.resolve(input.repoRoot, ".cache", "agent-workbench", "test-crash");
  const resolvedMarkerPath = path.resolve(markerPath);
  const resolvedReleasePath = path.resolve(releasePath);
  if (!isWithin(probeRoot, resolvedMarkerPath) || !isWithin(probeRoot, resolvedReleasePath)) {
    throw new Error("Refresh crash probe paths must remain inside the repository test-crash cache root.");
  }
  return {
    barrier,
    markerPath: resolvedMarkerPath,
    releasePath: resolvedReleasePath
  };
}

function isTestCrashBarrier(value: string): value is TestCrashBarrier {
  return value === "generation" ||
    value === "catalog" ||
    value === "docs" ||
    value === "graph" ||
    value === "prepublication";
}

function decorateGraphStore(
  store: WorkerGraphStore,
  after: (method: string, args: readonly unknown[]) => Promise<void>
): WorkerGraphStore {
  return new Proxy(store, {
    get(target, property) {
      const value = Reflect.get(target, property, target) as unknown;
      if (typeof value !== "function") return value;
      const method = String(property);
      return async (...args: unknown[]) => {
        const result = await value.apply(target, args);
        await after(method, args);
        return result;
      };
    }
  }) as WorkerGraphStore;
}

function matchingCrashBarrier(method: string, args: readonly unknown[]): TestCrashBarrier | undefined {
  if (method === "createBuildSnapshot") return "generation";
  if (method === "upsertEntry") return "catalog";
  if (method === "replaceSnapshotDocs") return "docs";
  if (method === "replaceSnapshotExtraction") {
    const request = args[0] as { batch?: { source_path?: unknown } } | undefined;
    if (request?.batch?.source_path === "app.py") return "graph";
  }
  return undefined;
}

async function pauseAtCrashBarrier(
  probe: TestCrashBarrierProbe,
  barrier: TestCrashBarrier
): Promise<void> {
  fs.mkdirSync(path.dirname(probe.markerPath), { recursive: true });
  const marker = `${JSON.stringify({
    barrier,
    snapshot_id: input.snapshotId,
    controller_generation: input.controllerGeneration,
    invalidation_generation: input.invalidationGeneration,
    daemon_pid: process.pid
  })}\n`;
  const temporaryMarkerPath = `${probe.markerPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryMarkerPath, marker, { flag: "wx" });
  fs.renameSync(temporaryMarkerPath, probe.markerPath);

  const deadline = Date.now() + 30_000;
  while (!fs.existsSync(probe.releasePath)) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out at test refresh crash barrier: ${barrier}.`);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}
