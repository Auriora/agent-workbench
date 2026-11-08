/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { afterEach, describe, expect, it } from "vitest";
import { createRefreshProfileRuntime, measureRefreshGeneration } from "../../src/debug/refresh-profile.js";
import { GraphBuildManifestPublicationValidator } from "../../src/application/use-cases/validate-graph-build-manifest.js";
import { RepositoryRefreshTriggerCoordinator } from "../../src/application/use-cases/repository-refresh-triggers.js";
import { readCapturedGraphBuildPathIdentity } from "../../src/infrastructure/filesystem/graph-build-path-identities.js";
import { GraphBuildWatchSession } from "../../src/infrastructure/runtime/graph-build-watch-session.js";
import { SnapshotRefreshController } from "../../src/infrastructure/runtime/refresh-controller.js";
import { StartupGraphRefreshExecutor } from "../../src/infrastructure/runtime/startup-graph-refresh-executor.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/index.js";
import { SystemClockAdapter } from "../../src/infrastructure/time/index.js";
import { createAsyncPublicationPort, createRepositoryWorkspaceRefreshService } from "../../src/server.js";
import { resolveWorkspaceWatcherConfig } from "../../src/domain/models/index.js";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("manifest-backed production refresh", () => {
  it("runs a real controller, worker RPC bridge, shared watcher session, validation, seed, and completion", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-manifest-refresh-"));
    roots.push(root);
    const source = path.join(root, "source");
    const output = path.join(root, "output");
    fs.mkdirSync(source); fs.mkdirSync(output);
    fs.writeFileSync(path.join(source, "README.md"), "# Runtime\n");
    fs.writeFileSync(path.join(source, "a.py"), "def caller():\n    return helper()\n");
    fs.writeFileSync(path.join(source, "b.py"), "def helper():\n    return 1\n");
    const runtime = createRefreshProfileRuntime({ source, output, max_files: 2000 });
    try {
      const measured = await measureRefreshGeneration({
        runtime, output, run: 1, scenario: "manifest_integration",
        action: () => runtime.triggers.startup({ source: "manifest-integration" })
      });
      expect(measured).toMatchObject({ state: "complete" });
      if (measured.state !== "complete") return;
      expect(measured.run.worker_invocations).toBeGreaterThan(1);
      expect(measured.run.work_counts.directory_enumerations).toBeGreaterThan(0);
      const selected = await runtime.store().getLatestPublished({ repo_root: source });
      expect(selected).toMatchObject({ status: "selected" });
      const progress = selected.status === "selected"
        ? await runtime.store().getGraphBuildProgress({ snapshot_id: selected.snapshot.id })
        : null;
      expect(progress).toMatchObject({ counters_version: 2, phase: "complete" });
      expect(await runtime.store().getGraphBuildManifest({ snapshot_id: selected.status === "selected" ? selected.snapshot.id : "" }))
        .toMatchObject({ state: "sealed" });
    } finally {
      await runtime.close();
    }
  }, 30_000);

  it.each([1, 2])("rejects deterministic late mutation at publication %i (seed/final)", async (publishNumber) => {
    const fixture = integrationFixture();
    const harness = await createHarness(fixture.source, fixture.database, publishNumber);
    try {
      await harness.triggers.startup({ source: "late-mutation" });
      await terminal(harness.controller);
      expect(harness.publications()).toBeGreaterThanOrEqual(publishNumber);
      expect(harness.controller.getReceipt()).toMatchObject({ execution_state: "failed" });
    } finally { await harness.close(); }
  }, 30_000);

  it("blocks fresh publication when observation is explicitly disabled", async () => {
    const fixture = integrationFixture();
    const harness = await createHarness(fixture.source, fixture.database, undefined, false);
    try {
      await harness.triggers.startup({ source: "disabled-observation" });
      await terminal(harness.controller);
      expect(harness.controller.getReceipt()).toMatchObject({ execution_state: "failed", last_failure: { code: "manifest_validation_failed" } });
      expect(harness.publications()).toBe(0);
      await expect(harness.store.getLatestPublished({ repo_root: fixture.source })).resolves.toMatchObject({ status: "missing" });
    } finally { await harness.close(); }
  });

  it("restarts after a published partial seed with a new epoch/owner and builds a new generation", async () => {
    const fixture = integrationFixture();
    const first = await createHarness(fixture.source, fixture.database);
    let seededId: string | undefined;
    try {
      await first.triggers.startup({ source: "seed-then-restart" });
      seededId = await waitForPublished(first.store, fixture.source);
    } finally { await first.close(); }
    const second = await createHarness(fixture.source, fixture.database);
    try {
      await second.triggers.startup({ source: "restart" });
      await terminal(second.controller);
      const selected = await second.store.getLatestPublished({ repo_root: fixture.source });
      expect(selected).toMatchObject({ status: "selected" });
      if (selected.status !== "selected") return;
      expect(selected.snapshot.id).not.toBe(seededId);
      expect(selected.publication.controller_generation).toBe(second.generation);
      expect(selected.publication.invalidation_generation).toBe(0);
    } finally { await second.close(); }
  }, 30_000);
});

function integrationFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-manifest-refresh-ports-")); roots.push(root);
  const source = path.join(root, "source"), state = path.join(root, "state"); fs.mkdirSync(source); fs.mkdirSync(state);
  fs.writeFileSync(path.join(source, "a.py"), "def a():\n    return b()\n");
  fs.writeFileSync(path.join(source, "b.py"), "def b():\n    return 1\n");
  return { source, database: path.join(state, "graph.sqlite") };
}

async function createHarness(source: string, database: string, mutateAtPublication?: number, watchEnabled = true) {
  const store = openGraphStore(database), clock = new SystemClockAdapter(), generation = Date.now();
  const workerErrors: string[] = [];
  const session = new GraphBuildWatchSession({ repo_root: source, paths: ["."], skipped_roots: [], enabled: watchEnabled, debounce_ms: 25, event_budget: 2000 });
  await session.start();
  let sequenceBump = 0, publications = 0;
  const watcher = { start: () => session.start(), registerDirectory: (input: { path: string; repository_key?: string }) => session.registerDirectory(input),
    observe: () => ({ ...session.observe(), sequence: session.observe().sequence + sequenceBump }),
    drain: async () => ({ ...(await session.drain()), sequence: session.observe().sequence + sequenceBump }), close: () => session.close() };
  const proxied = new Proxy(store, { get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver) as unknown;
    if (property !== "publishValidatedGraphBuild" || typeof value !== "function") return value;
    return (...args: unknown[]) => { publications += 1; if (publications === mutateAtPublication) sequenceBump += 1; return value.apply(target, args); };
  }});
  const validation = new GraphBuildManifestPublicationValidator({ store: async () => proxied, watcher,
    read_identity: async expected => readCapturedGraphBuildPathIdentity(source, expected), clock,
    on_published: input => session.establishCoverage(input) });
  const publication = createAsyncPublicationPort(async () => store);
  const controller = new SnapshotRefreshController({ repo_root: source, controller_generation: generation, timeout_ms: 60_000, clock,
    executor: new StartupGraphRefreshExecutor({ database_path: database, config_identity: "default", max_files: 1,
      retain_latest_snapshots: 3, retain_latest_fresh_snapshots: 2, controller_generation: generation, observation: watcher,
      worker_factory: ({ workerData }) => { const worker = new Worker(new URL("../../src/infrastructure/workers/startup-graph-warmup-worker-entrypoint.mjs", import.meta.url), { workerData }); worker.on("error", error => workerErrors.push(error.stack ?? error.message)); return worker; } }), publication, validation });
  const triggers = new RepositoryRefreshTriggerCoordinator({ repo_root: source, controller, publications: publication, snapshots: store });
  const refresh = createRepositoryWorkspaceRefreshService({ repoRoot: source, triggers, observation: session, clock,
    config: resolveWorkspaceWatcherConfig({ enabled: watchEnabled, debounce_ms: 25, event_budget: 2000 }), indexedRoots: ["."], skippedRoots: [], pollIntervalMs: 25 });
  return { store, controller, triggers, generation, workerErrors, publications: () => publications,
    close: async () => { await controller.shutdown(); await refresh.close(); await session.close(); store.close(); } };
}

async function terminal(controller: SnapshotRefreshController): Promise<void> {
  for (let index = 0; index < 600; index += 1) { if (["complete", "failed"].includes(controller.getReceipt().execution_state)) return; await new Promise(resolve => setTimeout(resolve, 25)); }
  throw new Error("controller_terminal_timeout");
}
async function waitForPublished(store: ReturnType<typeof openGraphStore>, repoRoot: string): Promise<string> {
  for (let index = 0; index < 600; index += 1) { const selected = await store.getLatestPublished({ repo_root: repoRoot }); if (selected.status === "selected") return selected.snapshot.id; await new Promise(resolve => setTimeout(resolve, 25)); }
  throw new Error("seed_publication_timeout");
}
