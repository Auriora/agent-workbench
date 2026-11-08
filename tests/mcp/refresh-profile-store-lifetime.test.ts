/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { createRefreshBaselineFixture } from "../../src/debug/fixtures/refresh-baseline-fixture.js";
import { createRefreshProfileRuntime, measureRefreshGeneration } from "../../src/debug/refresh-profile.js";

it.skipIf(typeof process.threadCpuUsage !== "function")("admits and completes watcher work through the reopened store after a committed continuation pause", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-profile-store-lifetime-"));
  const fixture = createRefreshBaselineFixture({ parent_root: root, python_files: 1 });
  const output = path.join(root, "profile");
  fs.mkdirSync(output);
  const runtime = createRefreshProfileRuntime({ source: fixture.repo_root, output, max_files: 2000, pause_committed_continuation: true });
  let passed = false;
  try {
    const first = await measureRefreshGeneration({
      runtime, output, run: 1, scenario: "paused_initial_generation",
      action: () => runtime.triggers.startup({ source: "store-lifetime-test" })
    });
    if (first.state !== "complete") throw new Error(JSON.stringify(first));
    expect(runtime.interruption).toMatchObject({ kind: "paused_committed_worker_continuation", restored_cursor: expect.any(String) });
    const before = await runtime.store().getLatestPublished({ repo_root: fixture.repo_root });
    expect(before.status).toBe("selected");
    if (before.status !== "selected") throw new Error("Expected the paused generation publication.");

    const second = await measureRefreshGeneration({
      runtime, output, run: 2, scenario: "watcher_after_store_reopen",
      action: async () => {
        const admission = await runtime.triggers.watcherBatch({ source: "store-lifetime-test", batch_identity: "after-store-reopen" });
        expect(admission.outcome).toBe("accepted");
        // Admission must mark the old publication stale through the same
        // physical handle now used by the runtime, before new workers finish.
        expect(await runtime.store().getSnapshot({ repo_root: fixture.repo_root, snapshot_id: before.snapshot.id }))
          .toMatchObject({ id: before.snapshot.id, freshness: "stale" });
        return admission;
      }
    });
    if (second.state !== "complete") throw new Error(JSON.stringify(second));
    expect(second.run.worker_invocations).toBeGreaterThan(0);
    const after = await runtime.store().getLatestPublished({ repo_root: fixture.repo_root });
    expect(after.status).toBe("selected");
    if (after.status !== "selected") throw new Error("Expected the watcher generation publication.");
    expect(after.snapshot.id).not.toBe(before.snapshot.id);
    expect(after.snapshot.freshness).toBe("fresh");
    expect(runtime.controller.getReceipt()).toMatchObject({ execution_state: "complete", worker_termination_state: "not_required" });
    passed = true;
  } finally {
    await runtime.close();
    if (passed) fs.rmSync(root, { recursive: true, force: true });
    else console.error(`Retained failed profiling store-lifetime evidence at ${root}`);
  }
}, 30_000);
