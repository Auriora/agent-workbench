/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FilesystemWorkspaceWatcherAdapter } from "../../src/infrastructure/filesystem/index.js";

describe("graph build watcher observations", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-watcher-generation-"));
    fs.mkdirSync(path.join(repoRoot, "src", "nested"), { recursive: true });
  });

  afterEach(() => fs.rmSync(repoRoot, { recursive: true, force: true }));

  it("starts with root coverage only and admits nested directories on demand", async () => {
    const watcher = new FilesystemWorkspaceWatcherAdapter();
    const handle = await watcher.start({ repo_root: repoRoot, enabled: true });
    expect(watcher.observe({ watch_id: handle.id })).toMatchObject({ healthy: true, covered_directories: ["."] });

    const registered = await watcher.registerDirectory({ watch_id: handle.id, path: "src/nested" });
    expect(registered.covered_directories).toEqual([".", "src/nested"]);
    await watcher.registerDirectory({ watch_id: handle.id, path: "src/nested" });
    expect(watcher.observe({ watch_id: handle.id }).covered_directories).toEqual([".", "src/nested"]);
    await watcher.stop({ watch_id: handle.id });
  });

  it("reports disabled and missing sessions as unhealthy", async () => {
    const watcher = new FilesystemWorkspaceWatcherAdapter();
    const handle = await watcher.start({ repo_root: repoRoot, enabled: false });
    expect(watcher.observe({ watch_id: handle.id }).healthy).toBe(false);
    await expect(watcher.registerDirectory({ watch_id: handle.id, path: "." })).rejects.toThrow("unhealthy session");
    expect(watcher.observe({ watch_id: "missing" })).toMatchObject({ healthy: false, covered_directories: [] });
  });

  it("advances synchronization sequence before filtering excluded events", async () => {
    fs.writeFileSync(path.join(repoRoot, ".gitignore"), "*.log\n");
    const watcher = new FilesystemWorkspaceWatcherAdapter();
    const handle = await watcher.start({ repo_root: repoRoot, enabled: true });
    fs.writeFileSync(path.join(repoRoot, "scratch.log"), "ignored\n");
    await waitForSequence(watcher, handle.id, 1);
    const observation = watcher.observe({ watch_id: handle.id });
    expect(observation.sequence).toBeGreaterThan(0);
    expect(watcher.drainObservedEvents({ watch_id: handle.id })).toEqual([]);
    await watcher.stop({ watch_id: handle.id });
  });

  it("queues root policy metadata even when ordinary hidden-path policy excludes it", async () => {
    const watcher = new FilesystemWorkspaceWatcherAdapter();
    const handle = await watcher.start({ repo_root: repoRoot, enabled: true });
    fs.writeFileSync(path.join(repoRoot, ".gitmodules"), "[submodule \"example\"]\n");
    const events = await waitForEvents(watcher, handle.id);
    expect(events.some(event => event.path === ".gitmodules")).toBe(true);
    await watcher.stop({ watch_id: handle.id });
  });

  it("rejects symlink escapes during registration", async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-watcher-outside-"));
    try {
      fs.symlinkSync(outside, path.join(repoRoot, "escape"));
      const watcher = new FilesystemWorkspaceWatcherAdapter();
      const handle = await watcher.start({ repo_root: repoRoot, enabled: true });
      await expect(watcher.registerDirectory({ watch_id: handle.id, path: "escape" })).rejects.toThrow();
      expect(watcher.observe({ watch_id: handle.id }).healthy).toBe(false);
      await watcher.stop({ watch_id: handle.id });
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it("admits only explicitly keyed child repositories and evaluates their events with child policy", async () => {
    fs.mkdirSync(path.join(repoRoot, "child", ".git"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "child", "src"));
    fs.writeFileSync(path.join(repoRoot, "child", ".git", "HEAD"), "ref: refs/heads/main\n");
    fs.writeFileSync(path.join(repoRoot, ".gitignore"), "child/src/**\n");
    const watcher = new FilesystemWorkspaceWatcherAdapter();
    const handle = await watcher.start({ repo_root: repoRoot, enabled: true });

    await expect(watcher.registerDirectory({ watch_id: handle.id, path: "child" })).rejects.toThrow("undeclared nested");
    expect(watcher.observe({ watch_id: handle.id }).healthy).toBe(false);
    await watcher.stop({ watch_id: handle.id });

    const admitted = await watcher.start({ repo_root: repoRoot, enabled: true });
    await watcher.registerDirectory({ watch_id: admitted.id, path: "child", repository_key: "submodule:child" });
    await watcher.registerDirectory({ watch_id: admitted.id, path: "child/src", repository_key: "submodule:child" });
    fs.writeFileSync(path.join(repoRoot, "child", "src", "app.ts"), "export const app = true;\n");
    const events = await waitForEvents(watcher, admitted.id);
    expect(events.some(event => event.path === "child/src/app.ts")).toBe(true);
    await watcher.stop({ watch_id: admitted.id });
  });

  it("uses a fresh opaque epoch for every watcher session", async () => {
    const first = new FilesystemWorkspaceWatcherAdapter();
    const second = new FilesystemWorkspaceWatcherAdapter();
    const firstHandle = await first.start({ repo_root: repoRoot, enabled: true });
    const secondHandle = await second.start({ repo_root: repoRoot, enabled: true });
    expect(first.observe({ watch_id: firstHandle.id }).epoch).not.toEqual(second.observe({ watch_id: secondHandle.id }).epoch);
    await first.stop({ watch_id: firstHandle.id });
    await second.stop({ watch_id: secondHandle.id });
  });
});

async function waitForSequence(watcher: FilesystemWorkspaceWatcherAdapter, watchId: string, minimum: number): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (watcher.observe({ watch_id: watchId }).sequence >= minimum) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

async function waitForEvents(watcher: FilesystemWorkspaceWatcherAdapter, watchId: string): Promise<readonly { path: string }[]> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const events = watcher.drainObservedEvents({ watch_id: watchId });
    if (events.length > 0) return events;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  return [];
}
