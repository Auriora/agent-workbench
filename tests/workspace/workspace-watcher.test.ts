/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkspaceChangeQueue } from "../../src/application/use-cases/workspace-change-queue.js";
import {
  classifyWorkspaceEventPath,
  deriveWorkspaceWatchDirectories,
  enqueueHookWorkspaceSignal,
  FilesystemWorkspaceWatcherAdapter,
  normalizeFsWatchEvent
} from "../../src/infrastructure/filesystem/index.js";
import type { ClockPort } from "../../src/ports/index.js";

class MutableClock implements ClockPort {
  private timestamp: number;

  constructor(initialIso: string) {
    this.timestamp = Date.parse(initialIso);
  }

  public now(): Date {
    return new Date(this.timestamp);
  }

  public nowIso8601(): string {
    return this.now().toISOString();
  }

  public nowUnixMs(): number {
    return this.timestamp;
  }
}

describe("filesystem workspace watcher", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-watch-"));
    fs.mkdirSync(path.join(repoRoot, "src", "included"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "src", "ignored-dir"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "src", "nested", ".git"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "node_modules", "pkg"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "src", "included", "app.ts~"), "editor temp\n");
    fs.writeFileSync(path.join(repoRoot, ".gitignore"), "src/ignored-dir/\n*.log\n");
    fs.writeFileSync(path.join(repoRoot, ".aiignore"), "scratch/\n");
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("derives watch directories from included indexed roots", () => {
    const directories = deriveWorkspaceWatchDirectories({
      repoRoot,
      indexedRoots: ["src"],
      skippedRoots: [],
      recursive: true
    }).map((directory) => path.relative(repoRoot, directory).replaceAll("\\", "/") || ".");

    expect(directories).toEqual(["src", "src/included"]);
  });

  it("filters editor temporary files and symlink escapes through event policy", () => {
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-watch-outside-"));
    try {
      const outsideFile = path.join(outsideRoot, "secret.txt");
      fs.writeFileSync(outsideFile, "secret\n");
      fs.symlinkSync(outsideFile, path.join(repoRoot, "src", "included", "outside-link.txt"));

      expect(
        classifyWorkspaceEventPath({
          repoRoot,
          path: "src/included/app.ts~",
          indexedRoots: ["src"],
          skippedRoots: []
        })
      ).toMatchObject({
        included: false,
        reason: "generated_or_vendor"
      });
      expect(
        classifyWorkspaceEventPath({
          repoRoot,
          path: "src/included/outside-link.txt",
          indexedRoots: ["src"],
          skippedRoots: []
        })
      ).toMatchObject({
        included: false,
        reason: "outside_repo"
      });
    } finally {
      fs.rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  it("normalizes fs.watch rename events without requiring an old path", () => {
    const filePath = path.join(repoRoot, "src", "included", "created.ts");
    fs.writeFileSync(filePath, "export const value = true;\n");

    expect(
      normalizeFsWatchEvent({
        repoRoot,
        absolutePath: filePath,
        eventType: "rename",
        recordedAt: "2026-07-05T12:00:00.000Z"
      })
    ).toEqual({
      kind: "created",
      path: "src/included/created.ts",
      recorded_at: "2026-07-05T12:00:00.000Z"
    });

    fs.rmSync(filePath);
    expect(
      normalizeFsWatchEvent({
        repoRoot,
        absolutePath: filePath,
        eventType: "rename",
        recordedAt: "2026-07-05T12:00:01.000Z"
      })
    ).toEqual({
      kind: "deleted",
      path: "src/included/created.ts",
      recorded_at: "2026-07-05T12:00:01.000Z"
    });
  });

  it("starts, polls, resets, and stops concrete file watchers", async () => {
    const watcher = new FilesystemWorkspaceWatcherAdapter();
    const handle = await watcher.start({
      repo_root: repoRoot,
      paths: ["src"],
      enabled: true
    });

    fs.writeFileSync(path.join(repoRoot, "src", "included", "app.ts"), "export const app = true;\n");
    const events = await waitForEvents(watcher, handle.id);
    expect(events.map((event) => event.path)).toContain("src/included/app.ts");
    expect(events.every((event) => event.path.endsWith(".log") === false)).toBe(true);

    await watcher.reset({ watch_id: handle.id });
    expect(await watcher.poll({ watch_id: handle.id })).toEqual([]);
    await watcher.stop({ watch_id: handle.id });
    expect(await watcher.poll({ watch_id: handle.id })).toEqual([]);
  });

  it("routes hook-derived signals through the same queue and inclusion policy", () => {
    const clock = new MutableClock("2026-07-05T12:00:00.000Z");
    const queue = new WorkspaceChangeQueue({
      clock,
      config: {
        debounce_ms: 0,
        event_budget: 10
      }
    });
    fs.writeFileSync(path.join(repoRoot, "src", "included", "app.ts"), "export const app = true;\n");
    fs.writeFileSync(path.join(repoRoot, "src", "ignored.log"), "debug\n");

    const routed = enqueueHookWorkspaceSignal({
      payload: {
        tool_input: {
          path: "src/included/app.ts"
        }
      },
      repo_root: repoRoot,
      indexed_roots: ["src"],
      skipped_roots: [],
      queue,
      clock
    });
    const ignored = enqueueHookWorkspaceSignal({
      payload: {
        tool_input: {
          path: "src/ignored.log"
        }
      },
      repo_root: repoRoot,
      indexed_roots: ["src"],
      skipped_roots: [],
      queue,
      clock
    });

    expect(routed.enqueued_events).toEqual([
      {
        kind: "modified",
        path: "src/included/app.ts",
        recorded_at: "2026-07-05T12:00:00.000Z",
        old_path: undefined
      }
    ]);
    expect(ignored).toEqual({
      enqueued_events: [],
      skipped_paths: ["src/ignored.log"]
    });
    expect(queue.drain()).toMatchObject({
      status: "drained",
      events: [
        expect.objectContaining({
          kind: "modified",
          path: "src/included/app.ts"
        })
      ],
      bounded_rescan_required: true,
      snapshot_freshness: "stale"
    });
  });
});

async function waitForEvents(
  watcher: FilesystemWorkspaceWatcherAdapter,
  watchId: string
): Promise<readonly { path: string }[]> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    const events = await watcher.poll({ watch_id: watchId });
    if (events.length > 0) {
      return events;
    }
  }
  return [];
}
