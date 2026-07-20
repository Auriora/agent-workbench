/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { parentPort, workerData } from "node:worker_threads";
import { buildRepositoryGraph } from "../../application/use-cases/index-repository-graph.js";
import { SCHEMA_VERSION, openGraphStore } from "../sqlite/index.js";
import {
  FileCatalogScannerAdapter,
  WorkspaceFileAdapter
} from "../filesystem/index.js";
import {
  ExtractorRegistryAdapter,
  ResourceExtractorAdapter
} from "../extraction/index.js";
import {
  CppDeclarationExtractorAdapter,
  GoDeclarationExtractorAdapter,
  JavaScriptTypeScriptTreeSitterExtractorAdapter,
  PythonTreeSitterExtractorAdapter
} from "../tree-sitter/index.js";
import { SystemClockAdapter } from "../time/index.js";

type StartupGraphWarmupWorkerData = {
  repoRoot: string;
  databasePath: string;
  snapshotId: string;
  configIdentity: string;
  maxFiles: number;
  retainLatestSnapshots: number;
  retainLatestFreshSnapshots: number;
  vacuum: boolean;
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
const extractors = new ExtractorRegistryAdapter();
extractors.register(new CppDeclarationExtractorAdapter({ language: "c" }));
extractors.register(new CppDeclarationExtractorAdapter({ language: "cpp" }));
extractors.register(new GoDeclarationExtractorAdapter());
extractors.register(new JavaScriptTypeScriptTreeSitterExtractorAdapter({ language: "javascript" }));
extractors.register(new JavaScriptTypeScriptTreeSitterExtractorAdapter({ language: "typescript" }));
extractors.register(new PythonTreeSitterExtractorAdapter());

try {
  const result = await buildRepositoryGraph({
    repo_root: input.repoRoot,
    scanner,
    workspace,
    extractors,
    resource_extractor: new ResourceExtractorAdapter(),
    graph: workerGraphStore,
    catalog: workerGraphStore,
    docs_index: workerGraphStore,
    snapshots: workerGraphStore,
    clock: new SystemClockAdapter(),
    schema_version: SCHEMA_VERSION,
    snapshot_id: input.snapshotId,
    config_identity: input.configIdentity,
    controller_generation: input.controllerGeneration,
    invalidation_generation: input.invalidationGeneration,
    max_files: input.maxFiles
  });
  await graphStore.pruneRepositorySnapshots({
    repo_root: input.repoRoot,
    retain_latest_snapshots: input.retainLatestSnapshots,
    retain_latest_fresh_snapshots: input.retainLatestFreshSnapshots,
    vacuum: input.vacuum
  });
  if (crashBarrierProbe?.barrier === "prepublication") {
    await pauseAtCrashBarrier(crashBarrierProbe, "prepublication");
  }
  parentPort?.postMessage({ type: "complete", result });
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
