/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDaemonIdentity, daemonPaths, startAgentWorkbenchDaemon } from "../../src/mcp/daemon.js";
import { GraphBuildWatchSession } from "../../src/infrastructure/runtime/graph-build-watch-session.js";
import { StartupGraphRefreshExecutor } from "../../src/infrastructure/runtime/startup-graph-refresh-executor.js";
import { FileRepositoryOwnershipAdapter } from "../../src/infrastructure/runtime/repository-ownership.js";
import { SqliteGraphStoreAdapter } from "../../src/infrastructure/sqlite/graph-store.js";

afterEach(() => vi.restoreAllMocks());

describe("daemon bootstrap cleanup", () => {
  it("quiesces a started refresh before watcher, store, and ownership cleanup", async () => {
    const repoRoot = fixtureRoot();
    const order: string[] = [];
    let entered!: () => void;
    const workerEntered = new Promise<void>(resolve => { entered = resolve; });
    const run = vi.spyOn(StartupGraphRefreshExecutor.prototype, "run").mockImplementation(async () => {
      order.push("worker-run");
      entered();
      return await new Promise(() => undefined);
    });
    vi.spyOn(StartupGraphRefreshExecutor.prototype, "terminate").mockImplementation(async () => { order.push("terminate"); });
    wrapOrder(GraphBuildWatchSession.prototype, "close", order, "watcher-close");
    wrapOrder(SqliteGraphStoreAdapter.prototype, "close", order, "store-close");
    wrapOrder(FileRepositoryOwnershipAdapter.prototype, "release", order, "lease-release");

    await expect(startAgentWorkbenchDaemon({
      repoRoot,
      serverOptions: { startupRefreshDelayMs: 60_000 },
      testHooks: {
        beforeReady: async ({ refreshTriggers }) => {
          void refreshTriggers.startup({ source: "bootstrap-cleanup-test" });
          await workerEntered;
          throw new Error("fail after refresh start");
        }
      }
    })).rejects.toThrow("fail after refresh start");
    expect(run).toHaveBeenCalledOnce();
    expectOrdered(order, "terminate", "watcher-close", "store-close", "lease-release");
    cleanup(repoRoot);
  });

  it("retains watcher, store, and lease when worker quiescence cannot be confirmed", async () => {
    const repoRoot = fixtureRoot();
    const order: string[] = [];
    let entered!: () => void;
    const workerEntered = new Promise<void>(resolve => { entered = resolve; });
    let session: GraphBuildWatchSession | undefined;
    vi.spyOn(StartupGraphRefreshExecutor.prototype, "run").mockImplementation(async () => {
      entered();
      return await new Promise(() => undefined);
    });
    vi.spyOn(StartupGraphRefreshExecutor.prototype, "terminate").mockImplementation(async () => {
      order.push("terminate");
      throw new Error("termination refused");
    });
    const originalStart = GraphBuildWatchSession.prototype.start;
    vi.spyOn(GraphBuildWatchSession.prototype, "start").mockImplementation(async function (this: GraphBuildWatchSession) {
      session = this;
      return await originalStart.call(this);
    });
    wrapOrder(GraphBuildWatchSession.prototype, "close", order, "watcher-close");
    wrapOrder(SqliteGraphStoreAdapter.prototype, "close", order, "store-close");
    wrapOrder(FileRepositoryOwnershipAdapter.prototype, "release", order, "lease-release");

    await expect(startAgentWorkbenchDaemon({
      repoRoot,
      serverOptions: { startupRefreshDelayMs: 60_000 },
      testHooks: {
        beforeReady: async ({ refreshTriggers }) => {
          void refreshTriggers.startup({ source: "bootstrap-cleanup-test" });
          await workerEntered;
          throw new Error("fail after refresh start");
        }
      }
    })).rejects.toThrow("fail after refresh start");
    const termination = order.lastIndexOf("terminate");
    expect(termination).toBeGreaterThanOrEqual(0);
    expect(order.slice(termination + 1)).not.toContain("watcher-close");
    expect(order.slice(termination + 1)).not.toContain("store-close");
    expect(order.slice(termination + 1)).not.toContain("lease-release");
    // The production path deliberately retains resources; release the test's
    // watcher only after asserting the retained-ownership invariant.
    await session?.close();
    cleanup(repoRoot);
  });
});

function wrapOrder(target: object, method: string, order: string[], label: string): void {
  const methods = target as Record<string, (...input: unknown[]) => unknown>;
  const original = methods[method]!;
  vi.spyOn(methods, method).mockImplementation(function (this: object, ...args: unknown[]) {
    order.push(label);
    return original.apply(this, args);
  });
}

function expectOrdered(order: readonly string[], ...steps: readonly string[]): void {
  let previous = -1;
  for (const step of steps) {
    const index = order.indexOf(step, previous + 1);
    expect(index).toBeGreaterThan(previous);
    previous = index;
  }
}

function fixtureRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-bootstrap-cleanup-"));
  fs.writeFileSync(path.join(root, "a.py"), "def run():\n    return 1\n");
  return root;
}

function cleanup(repoRoot: string): void {
  const paths = daemonPaths(createDaemonIdentity(repoRoot));
  fs.rmSync(repoRoot, { recursive: true, force: true });
  fs.rmSync(paths.ipcDir, { recursive: true, force: true });
}
