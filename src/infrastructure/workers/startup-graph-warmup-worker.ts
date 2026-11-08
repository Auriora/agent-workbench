/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import { channel } from "node:diagnostics_channel";
import path from "node:path";
import { parentPort, workerData } from "node:worker_threads";
import type { RefreshWorkerProgress } from "../../contracts/index.js";
import { runRepositoryGraphBuildSlice } from "../../application/use-cases/index-repository-graph.js";
import { discoverRepositoryComposition } from "../../application/use-cases/repository-composition.js";
import { SCHEMA_VERSION, openGraphStore } from "../sqlite/index.js";
import { GitMetadataCommandAdapter } from "../commands/index.js";
import {
  captureGraphBuildRepositoryInputs,
  FileCatalogScannerAdapter,
  WorkspaceFileAdapter
} from "../filesystem/index.js";
import {
  createProductionExtractorRegistry,
  ResourceExtractorAdapter
} from "../extraction/index.js";
import { SystemClockAdapter } from "../time/index.js";
import { createGraphBuildObservationClient } from "./graph-build-observation-client.js";
import type { GraphBuildPathIdentity, GraphBuildWatchObservation } from "../../ports/index.js";
import type { SnapshotRepositoryComposition } from "../../domain/models/runtime.js";

const COMMON_RAILS_FRONT_DOOR_PRIORITY_PATHS = [
  "AGENTS.md",
  "README.md",
  "Gemfile",
  "config/application.rb",
  "config/routes.rb"
] as const;
const MAX_REFRESH_EXTRACTION_FILES_PER_PASS = 250;

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
  deadlineAt: string;
  timeoutMs: number;
  watcherObservation: GraphBuildWatchObservation;
};

const input = workerData as StartupGraphWarmupWorkerData;
assertGeneration("controllerGeneration", input.controllerGeneration);
assertGeneration("invalidationGeneration", input.invalidationGeneration);
const cooperativeExtractionDeadline = resolveCooperativeExtractionDeadline(input);
const workObservation = channel("agent-workbench.refresh.work");
const phaseObservation = channel("agent-workbench.refresh.phase");
const workCounts = {
  directory_enumerations: 0,
  directory_entries_considered: 0,
  file_stat_attempts: 0,
  wildcard_regex_compilations: 0
};
const workspace = new WorkspaceFileAdapter({ repoRoot: input.repoRoot });
const graphStore = openGraphStore(input.databasePath);
const crashBarrierProbe = readCrashBarrierProbe();
const workerGraphStore = decorateGraphStore(graphStore, async (method, args) => {
  if (crashBarrierProbe === undefined) return;
  const barrier = matchingCrashBarrier(method, args);
  if (barrier !== undefined && barrier === crashBarrierProbe.barrier) {
    await pauseAtCrashBarrier(crashBarrierProbe, barrier);
  }
});
const extractors = createProductionExtractorRegistry();
if (parentPort === null) {
  throw new Error("Startup graph warmup worker requires a parent message port.");
}
const observationClient = createGraphBuildObservationClient({
  port: parentPort,
  identity: {
    execution_id: input.executionId,
    target_snapshot_id: input.snapshotId,
    controller_generation: input.controllerGeneration,
    invalidation_generation: input.invalidationGeneration,
    watcher_epoch: input.watcherObservation.epoch
  },
  initial_observation: input.watcherObservation
});

try {
  const watch = await observationClient.start();
  const persisted = await loadPersistedBuildInputs({ store: workerGraphStore, watch });
  observeBuildPhase("composition");
  const capturedInputs: GraphBuildPathIdentity[] = persisted?.inputs ?? [];
  const capturedInputKeys = new Set(capturedInputs.map(identityKey));
  const repositoryComposition = persisted?.repository_composition ?? await discoverRepositoryComposition({
    workspace,
    git: new GitMetadataCommandAdapter(),
    repo_root: input.repoRoot,
    canonicalize_repo_root: (repoRoot) => fs.realpathSync.native(repoRoot),
    before_repository_inspection: async ({ repo_root, path_prefix }) => {
      for (const identity of captureGraphBuildRepositoryInputs(repo_root, path_prefix)) {
        const key = identityKey(identity);
        if (!capturedInputKeys.has(key)) {
          capturedInputKeys.add(key);
          capturedInputs.push(identity);
        }
      }
    }
  });
  reportProgress("composition", repositoryComposition.repositories.length);
  const result = await runRepositoryGraphBuildSlice({
    repo_root: input.repoRoot,
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
    max_extraction_files: Math.min(input.maxFiles, MAX_REFRESH_EXTRACTION_FILES_PER_PASS),
    priority_paths: COMMON_RAILS_FRONT_DOOR_PRIORITY_PATHS,
    controller_generation: input.controllerGeneration,
    invalidation_generation: input.invalidationGeneration,
    repository_composition: repositoryComposition,
    should_yield_extraction: () => Date.now() >= cooperativeExtractionDeadline,
    report_build_progress: reportProgress,
    observe_build_phase: phaseObservation.hasSubscribers ? observeBuildPhase : undefined,
    manifest: {
      store: workerGraphStore,
      watcher: observationClient,
      create_scanner: (capture) => new FileCatalogScannerAdapter({
        capture,
        observe: workObservation.hasSubscribers ? (event) => { workCounts[event] += 1; } : undefined
      }),
      inputs: capturedInputs
    }
  });
  observeBuildPhase("finalizing");
  if (result.outcome === "complete") {
    reportProgress("finalizing", 1);
  }
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
  observationClient.close();
  if (workObservation.hasSubscribers) workObservation.publish(workCounts);
  graphStore.close();
}

function observeBuildPhase(phase: RefreshWorkerProgress["phase"]): void {
  if (phaseObservation.hasSubscribers) phaseObservation.publish(phase);
}

function assertGeneration(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer.`);
  }
}

function resolveCooperativeExtractionDeadline(input: StartupGraphWarmupWorkerData): number {
  const hardDeadline = Date.parse(input.deadlineAt);
  if (!Number.isFinite(hardDeadline) || !Number.isSafeInteger(input.timeoutMs) || input.timeoutMs <= 0) {
    throw new TypeError("Refresh worker deadline must be a valid future deadline.");
  }
  const settlementReserve = Math.max(5_000, Math.floor(input.timeoutMs * 5 / 6));
  return hardDeadline - settlementReserve;
}

function reportProgress(
  phase: "composition" | "catalog" | "extraction" | "docs" | "graph_write" | "resolution" | "finalizing",
  completedUnits: number
): void {
  const progress = {
    execution_id: input.executionId,
    target_snapshot_id: input.snapshotId,
    phase,
    completed_units: completedUnits
  };
  const observation = channel("agent-workbench.refresh.progress");
  if (observation.hasSubscribers) observation.publish(progress);
  parentPort?.postMessage({ type: "progress", progress });
}

async function loadPersistedBuildInputs(candidate: {
  store: WorkerGraphStore;
  watch: GraphBuildWatchObservation;
}): Promise<{ repository_composition: SnapshotRepositoryComposition; inputs: GraphBuildPathIdentity[] } | undefined> {
  const progress = await candidate.store.getGraphBuildProgress({ snapshot_id: input.snapshotId });
  if (progress === null) {
    const latest = await candidate.store.getLatestPublished({ repo_root: input.repoRoot });
    if (latest.status !== "selected") return undefined;
    const sourceProgress = await candidate.store.getGraphBuildProgress({ snapshot_id: latest.snapshot.id });
    if (sourceProgress === null || sourceProgress.phase === "complete" || sourceProgress.status === "completed") return undefined;
    if (sourceProgress.owner_id !== input.executionId ||
      sourceProgress.controller_generation !== input.controllerGeneration ||
      sourceProgress.invalidation_generation !== input.invalidationGeneration) return undefined;
    return await persistedInputsFor({ progress: sourceProgress, snapshot_id: latest.snapshot.id, store: candidate.store, watch: candidate.watch });
  }
  return await persistedInputsFor({ progress, snapshot_id: input.snapshotId, store: candidate.store, watch: candidate.watch });
}

async function persistedInputsFor(candidate: {
  progress: Awaited<ReturnType<WorkerGraphStore["getGraphBuildProgress"]>> & {};
  snapshot_id: string;
  store: WorkerGraphStore;
  watch: GraphBuildWatchObservation;
}): Promise<{ repository_composition: SnapshotRepositoryComposition; inputs: GraphBuildPathIdentity[] }> {
  const progress = candidate.progress;
  if (progress === null || progress.owner_id !== input.executionId ||
    progress.controller_generation !== input.controllerGeneration ||
    progress.invalidation_generation !== input.invalidationGeneration ||
    progress.manifest_id === undefined || progress.counters_version !== 2 ||
    progress.status !== "active") {
    throw new Error("Persisted graph continuation does not match the worker execution fence.");
  }
  const repositoryComposition = await candidate.store.getRepositoryComposition({ snapshot_id: candidate.snapshot_id });
  if (repositoryComposition === null) {
    throw new Error("Persisted graph continuation has no repository composition evidence.");
  }
  const manifest = await candidate.store.getGraphBuildManifest({ manifest_id: progress.manifest_id });
  if (manifest === null || manifest.state !== "sealed" || manifest.owner_id !== input.executionId ||
    manifest.repo_root !== input.repoRoot || manifest.controller_generation !== input.controllerGeneration ||
    manifest.invalidation_generation !== input.invalidationGeneration || manifest.watcher_epoch !== candidate.watch.epoch ||
    manifest.watcher_sequence !== candidate.watch.sequence ||
    manifest.composition_fingerprint !== repositoryComposition.composition_fingerprint) {
    throw new Error("Persisted graph continuation manifest fence does not match the worker execution.");
  }
  return { repository_composition: repositoryComposition, inputs: [...manifest.inputs] };
}

function identityKey(identity: GraphBuildPathIdentity): string {
  return JSON.stringify([identity.scope ?? "workspace", identity.root ?? input.repoRoot, identity.path]);
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
  if (method === "sealGraphBuildManifest") return "catalog";
  if (method === "replaceSnapshotDocs") return "docs";
  if (method === "commitGraphBuildFileOutcome") {
    const request = args[0] as { entry?: { path?: unknown } } | undefined;
    if (request?.entry?.path === "app.py") return "graph";
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
