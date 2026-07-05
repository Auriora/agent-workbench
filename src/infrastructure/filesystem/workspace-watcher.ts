/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import type {
  WorkspaceFileEvent,
  WorkspaceWatchHandle,
  WorkspaceWatchRequest
} from "../../domain/models/index.js";
import { resolveWorkspaceWatcherConfig } from "../../domain/models/index.js";
import type { WorkspaceWatcherPort } from "../../ports/index.js";
import { SystemClockAdapter } from "../time/index.js";
import { classifyWorkspaceEventPath } from "./workspace-event-policy.js";

type WatchSession = {
  id: string;
  repoRoot: string;
  indexedRoots: readonly string[];
  skippedRoots: readonly string[];
  recursive: boolean;
  events: WorkspaceFileEvent[];
  watchers: fs.FSWatcher[];
  watchedDirectories: Set<string>;
};

let nextWatcherId = 0;

export class FilesystemWorkspaceWatcherAdapter implements WorkspaceWatcherPort {
  private readonly sessions = new Map<string, WatchSession>();
  private readonly clock = new SystemClockAdapter();

  public async start(input: WorkspaceWatchRequest): Promise<WorkspaceWatchHandle> {
    const config = resolveWorkspaceWatcherConfig(input);
    const id = `workspace-watch-${++nextWatcherId}`;
    const repoRoot = path.resolve(input.repo_root);
    const session: WatchSession = {
      id,
      repoRoot,
      indexedRoots: input.paths?.length ? input.paths : ["."],
      skippedRoots: input.skipped_roots ?? [],
      recursive: input.recursive !== false,
      events: [],
      watchers: [],
      watchedDirectories: new Set()
    };

    if (config.enabled) {
      for (const directory of deriveWorkspaceWatchDirectories({
        repoRoot,
        indexedRoots: session.indexedRoots,
        skippedRoots: session.skippedRoots,
        recursive: session.recursive
      })) {
        this.watchDirectory(session, directory);
      }
    }

    this.sessions.set(id, session);
    return {
      id,
      started_at: this.clock.nowIso8601()
    };
  }

  public async stop(input: { watch_id: string }): Promise<void> {
    const session = this.sessions.get(input.watch_id);
    if (session === undefined) {
      return;
    }
    for (const watcher of session.watchers) {
      watcher.close();
    }
    this.sessions.delete(input.watch_id);
  }

  public async poll(input: { watch_id: string; max_events?: number }): Promise<readonly WorkspaceFileEvent[]> {
    const session = this.sessions.get(input.watch_id);
    if (session === undefined) {
      return [];
    }
    const maxEvents = input.max_events ?? session.events.length;
    return session.events.splice(0, Math.max(0, maxEvents));
  }

  public async reset(input: { watch_id: string }): Promise<void> {
    const session = this.sessions.get(input.watch_id);
    if (session === undefined) {
      return;
    }
    session.events.splice(0);
  }

  private watchDirectory(session: WatchSession, directory: string): void {
    if (session.watchedDirectories.has(directory)) {
      return;
    }
    session.watchedDirectories.add(directory);
    try {
      const watcher = fs.watch(directory, (eventType, fileName) => {
        this.recordFsEvent(session, directory, eventType, fileName);
      });
      watcher.unref();
      watcher.on("error", () => {
        session.events.push({
          kind: "modified",
          path: ".",
          recorded_at: this.clock.nowIso8601()
        });
      });
      session.watchers.push(watcher);
    } catch (_error) {
      session.events.push({
        kind: "modified",
        path: path.relative(session.repoRoot, directory).replaceAll("\\", "/") || ".",
        recorded_at: this.clock.nowIso8601()
      });
    }
  }

  private recordFsEvent(
    session: WatchSession,
    directory: string,
    eventType: string,
    fileName: string | Buffer | null
  ): void {
    const absolutePath = fileName === null ? directory : path.join(directory, fileName.toString());
    const event = normalizeFsWatchEvent({
      repoRoot: session.repoRoot,
      absolutePath,
      eventType,
      recordedAt: this.clock.nowIso8601()
    });
    if (event === null) {
      return;
    }

    const decision = classifyWorkspaceEventPath({
      repoRoot: session.repoRoot,
      path: event.path,
      indexedRoots: session.indexedRoots,
      skippedRoots: session.skippedRoots
    });
    if (!decision.included) {
      return;
    }
    if (decision.isDirectory && session.recursive) {
      for (const watchDirectory of deriveWorkspaceWatchDirectories({
        repoRoot: session.repoRoot,
        indexedRoots: [decision.relativePath],
        skippedRoots: session.skippedRoots,
        recursive: true
      })) {
        this.watchDirectory(session, watchDirectory);
      }
    }
    session.events.push(event);
  }
}

export function deriveWorkspaceWatchDirectories(input: {
  repoRoot: string;
  indexedRoots: readonly string[];
  skippedRoots: readonly string[];
  recursive: boolean;
}): string[] {
  const repoRoot = path.resolve(input.repoRoot);
  const indexedRoots = input.indexedRoots.length === 0 ? ["."] : input.indexedRoots;
  const directories = new Set<string>();

  for (const indexedRoot of indexedRoots) {
    const decision = classifyWorkspaceEventPath({
      repoRoot,
      path: indexedRoot,
      indexedRoots,
      skippedRoots: input.skippedRoots
    });
    if (!decision.included || !decision.exists || !decision.isDirectory) {
      continue;
    }
    collectWatchDirectories({
      repoRoot,
      directory: decision.absolutePath,
      indexedRoots,
      skippedRoots: input.skippedRoots,
      recursive: input.recursive,
      directories
    });
  }

  return [...directories].sort();
}

export function normalizeFsWatchEvent(input: {
  repoRoot: string;
  absolutePath: string;
  eventType: string;
  recordedAt: string;
}): WorkspaceFileEvent | null {
  const relative = path.relative(path.resolve(input.repoRoot), path.resolve(input.absolutePath));
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  const eventPath = relative.replaceAll("\\", "/") || ".";
  if (input.eventType === "change") {
    return {
      kind: "modified",
      path: eventPath,
      recorded_at: input.recordedAt
    };
  }
  if (input.eventType === "rename") {
    return {
      kind: fs.existsSync(input.absolutePath) ? "created" : "deleted",
      path: eventPath,
      recorded_at: input.recordedAt
    };
  }
  return null;
}

function collectWatchDirectories(input: {
  repoRoot: string;
  directory: string;
  indexedRoots: readonly string[];
  skippedRoots: readonly string[];
  recursive: boolean;
  directories: Set<string>;
}): void {
  input.directories.add(input.directory);
  if (!input.recursive) {
    return;
  }

  let children: fs.Dirent[];
  try {
    children = fs.readdirSync(input.directory, { withFileTypes: true });
  } catch (_error) {
    return;
  }

  for (const child of children) {
    if (!child.isDirectory()) {
      continue;
    }
    const childPath = path.join(input.directory, child.name);
    const decision = classifyWorkspaceEventPath({
      repoRoot: input.repoRoot,
      path: path.relative(input.repoRoot, childPath),
      indexedRoots: input.indexedRoots,
      skippedRoots: input.skippedRoots
    });
    if (!decision.included || !decision.isDirectory) {
      continue;
    }
    collectWatchDirectories({
      ...input,
      directory: childPath
    });
  }
}
