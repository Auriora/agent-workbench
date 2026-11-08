/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { WorkspaceFileEvent, WorkspaceWatchHandle, WorkspaceWatchRequest } from "../../domain/models/index.js";
import { resolveWorkspaceWatcherConfig } from "../../domain/models/index.js";
import type { GraphBuildWatchObservation, GraphBuildWatchSourcePort, WorkspaceWatcherPort } from "../../ports/index.js";
import { SystemClockAdapter } from "../time/index.js";
import { classifyWorkspaceEventPath } from "./workspace-event-policy.js";
import { isNestedGitRepository } from "./nested-git-repository.js";

type WatchSession = {
  id: string; epoch: string; repoRoot: string; canonicalRepoRoot: string;
  indexedRoots: readonly string[]; skippedRoots: readonly string[]; eventBudget: number;
  enabled: boolean; healthy: boolean; closed: boolean; sequence: number;
  events: WorkspaceFileEvent[]; watchers: fs.FSWatcher[];
  watchedDirectories: Set<string>; coveredDirectories: Set<string>;
  admittedChildRoots: Map<string, { path: string; canonicalRoot: string }>;
};

let nextWatcherId = 0;

/** Watches only directories explicitly admitted by the graph-build scanner. */
export class FilesystemWorkspaceWatcherAdapter implements WorkspaceWatcherPort, GraphBuildWatchSourcePort {
  private readonly sessions = new Map<string, WatchSession>();
  private readonly clock = new SystemClockAdapter();

  public async start(input: WorkspaceWatchRequest): Promise<WorkspaceWatchHandle> {
    const config = resolveWorkspaceWatcherConfig(input);
    const id = `workspace-watch-${++nextWatcherId}`;
    const repoRoot = path.resolve(input.repo_root);
    const canonicalRepoRoot = fs.realpathSync(repoRoot);
    const session: WatchSession = {
      id, epoch: randomUUID(), repoRoot, canonicalRepoRoot,
      indexedRoots: input.paths?.length ? input.paths : ["."], skippedRoots: input.skipped_roots ?? [],
      eventBudget: config.event_budget, enabled: config.enabled, healthy: config.enabled, closed: false, sequence: 0,
      events: [], watchers: [], watchedDirectories: new Set(), coveredDirectories: new Set(), admittedChildRoots: new Map()
    };
    this.sessions.set(id, session);
    if (config.enabled) {
      try { this.watchDirectory(session, canonicalRepoRoot, "."); }
      catch (error) { this.markUnhealthy(session); throw error; }
    }
    return { id, started_at: this.clock.nowIso8601() };
  }

  public async stop(input: { watch_id: string }): Promise<void> {
    const session = this.sessions.get(input.watch_id);
    if (session === undefined) return;
    session.closed = true;
    session.healthy = false;
    for (const watcher of session.watchers) watcher.close();
    this.sessions.delete(input.watch_id);
  }

  public async poll(input: { watch_id: string; max_events?: number }): Promise<readonly WorkspaceFileEvent[]> {
    const session = this.sessions.get(input.watch_id);
    if (session === undefined) return [];
    return session.events.splice(0, Math.max(0, input.max_events ?? session.events.length));
  }

  public async reset(input: { watch_id: string }): Promise<void> {
    this.sessions.get(input.watch_id)?.events.splice(0);
  }

  public async registerDirectory(input: { watch_id: string; path: string; repository_key?: string }): Promise<GraphBuildWatchObservation> {
    const session = this.requireSession(input.watch_id);
    if (!session.enabled || !session.healthy || session.closed) {
      this.markUnhealthy(session);
      throw new Error(`Graph build watcher cannot register directory in an unhealthy session: ${input.path}`);
    }
    const relativePath = normalizeWatchPath(input.path);
    let admission: { child: ChildRegistration | undefined; decision: ReturnType<typeof classifyWorkspaceEventPath> };
    try {
      const child = childRegistration(session, relativePath, input.repository_key);
      const decision = child === undefined ? classifyWorkspaceEventPath({
        repoRoot: session.repoRoot, path: relativePath, indexedRoots: session.indexedRoots, skippedRoots: session.skippedRoots
      }) : classifyWorkspaceEventPath({ repoRoot: child.canonicalRoot, path: child.localPath, indexedRoots: ["."], skippedRoots: [] });
      if (!decision.included || !decision.exists || !decision.isDirectory) {
        throw new Error(`Graph build watcher cannot register an unadmitted directory: ${input.path}`);
      }
      admission = { child, decision };
    } catch (error) {
      this.markUnhealthy(session);
      throw error;
    }
    const { child, decision } = admission;
    try {
      const canonicalDirectory = fs.realpathSync(child === undefined ? decision.absolutePath : path.resolve(child.canonicalRoot, child.localPath));
      if (!fs.statSync(canonicalDirectory).isDirectory() || !isContained(session.canonicalRepoRoot, canonicalDirectory)) {
        throw new Error(`Graph build watcher directory escaped workspace containment: ${input.path}`);
      }
      if (child?.arm === true && !isNestedGitRepository(session.repoRoot, canonicalDirectory)) {
        throw new Error(`Graph build watcher child repository has no Git admission evidence: ${input.path}`);
      }
      if (child?.arm === true) {
        session.admittedChildRoots.set(child.repositoryKey, { path: relativePath, canonicalRoot: canonicalDirectory });
      }
      this.watchDirectory(session, canonicalDirectory, relativePath);
    } catch (error) {
      this.markUnhealthy(session);
      throw error;
    }
    return this.observation(session);
  }

  public observe(input: { watch_id: string }): GraphBuildWatchObservation {
    const session = this.sessions.get(input.watch_id);
    return session === undefined ? missingObservation(input.watch_id) : this.observation(session);
  }

  public drainObservedEvents(input: { watch_id: string }): readonly WorkspaceFileEvent[] {
    const session = this.sessions.get(input.watch_id);
    return session === undefined ? [] : session.events.splice(0);
  }

  private requireSession(watchId: string): WatchSession {
    const session = this.sessions.get(watchId);
    if (session === undefined) throw new Error(`Graph build watcher session is unavailable: ${watchId}`);
    return session;
  }

  private observation(session: WatchSession): GraphBuildWatchObservation {
    return {
      epoch: session.epoch, sequence: session.sequence,
      healthy: session.enabled && session.healthy && !session.closed,
      pending_events: session.events.length,
      covered_directories: [...session.coveredDirectories].sort()
    };
  }

  private watchDirectory(session: WatchSession, directory: string, relativePath: string): void {
    if (session.watchedDirectories.has(directory)) {
      session.coveredDirectories.add(normalizeWatchPath(relativePath));
      return;
    }
    const watcher = fs.watch(directory, (eventType, fileName) => this.recordFsEvent(session, directory, eventType, fileName));
    watcher.unref();
    watcher.on("error", () => this.markUnhealthy(session));
    watcher.on("close", () => { if (!session.closed) this.markUnhealthy(session); });
    session.watchers.push(watcher);
    session.watchedDirectories.add(directory);
    session.coveredDirectories.add(normalizeWatchPath(relativePath));
  }

  private recordFsEvent(session: WatchSession, directory: string, eventType: string, fileName: string | Buffer | null): void {
    // Advance before filtering: excluded events remain observable synchronization evidence.
    session.sequence += 1;
    if (!session.healthy || session.closed) return;
    const absolutePath = fileName === null ? directory : path.join(directory, fileName.toString());
    const event = normalizeFsWatchEvent({ repoRoot: session.repoRoot, absolutePath, eventType, recordedAt: this.clock.nowIso8601() });
    if (event === null) return;
    const decision = classifyObservedEvent(session, event.path);
    if (!decision.included && !isGraphBuildMetadataEvent(event.path)) return;
    if (session.events.length >= session.eventBudget) {
      this.markUnhealthy(session);
      return;
    }
    session.events.push(event);
  }

  private markUnhealthy(session: WatchSession): void {
    if (session.healthy) session.sequence += 1;
    session.healthy = false;
  }
}

/** Direct roots only; recursive enumeration belongs exclusively to scanner admission. */
export function deriveWorkspaceWatchDirectories(input: {
  repoRoot: string; indexedRoots: readonly string[]; skippedRoots: readonly string[]; recursive: boolean;
}): string[] {
  const repoRoot = path.resolve(input.repoRoot);
  const indexedRoots = input.indexedRoots.length === 0 ? ["."] : input.indexedRoots;
  const directories = new Set<string>();
  for (const indexedRoot of indexedRoots) {
    const decision = classifyWorkspaceEventPath({ repoRoot, path: indexedRoot, indexedRoots, skippedRoots: input.skippedRoots });
    if (decision.included && decision.exists && decision.isDirectory) directories.add(decision.absolutePath);
  }
  return [...directories].sort();
}

export function normalizeFsWatchEvent(input: {
  repoRoot: string; absolutePath: string; eventType: string; recordedAt: string;
}): WorkspaceFileEvent | null {
  const relative = path.relative(path.resolve(input.repoRoot), path.resolve(input.absolutePath));
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  const eventPath = relative.replaceAll("\\", "/") || ".";
  if (input.eventType === "change") return { kind: "modified", path: eventPath, recorded_at: input.recordedAt };
  if (input.eventType === "rename") return {
    kind: fs.existsSync(input.absolutePath) ? "created" : "deleted", path: eventPath, recorded_at: input.recordedAt
  };
  return null;
}

function normalizeWatchPath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/\/+$/, "");
  if (normalized.length === 0 || normalized === ".") return ".";
  if (path.posix.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`Watcher directory must be repository-relative: ${value}`);
  }
  return normalized;
}

function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

type ChildRegistration = {
  repositoryKey: string;
  canonicalRoot: string;
  localPath: string;
  arm: boolean;
};

function childRegistration(session: WatchSession, relativePath: string, repositoryKey: string | undefined): ChildRegistration | undefined {
  if (repositoryKey?.startsWith("submodule:")) {
    const prefix = normalizeWatchPath(repositoryKey.slice("submodule:".length));
    if (prefix === relativePath) {
      const canonicalRoot = fs.realpathSync(path.resolve(session.repoRoot, relativePath));
      if (!isContained(session.canonicalRepoRoot, canonicalRoot)) {
        throw new Error(`Graph build watcher child repository escaped workspace containment: ${relativePath}`);
      }
      return { repositoryKey, canonicalRoot, localPath: ".", arm: true };
    }
  }
  const existing = [...session.admittedChildRoots.entries()]
    .filter(([, child]) => relativePath === child.path || relativePath.startsWith(`${child.path}/`))
    .sort(([, left], [, right]) => right.path.length - left.path.length)[0];
  if (existing !== undefined) {
    const [key, child] = existing;
    if (repositoryKey !== key) {
      throw new Error(`Graph build watcher requires the admitted repository key for child path: ${relativePath}`);
    }
    return { repositoryKey: key, canonicalRoot: child.canonicalRoot, localPath: relativePath.slice(child.path.length).replace(/^\//, "") || ".", arm: false };
  }
  if (repositoryKey === undefined || !repositoryKey.startsWith("submodule:")) {
    if (isUnderUnadmittedNestedRepository(session, relativePath)) {
      throw new Error(`Graph build watcher refuses an undeclared nested repository path: ${relativePath}`);
    }
    return undefined;
  }
  return undefined;
}

function classifyObservedEvent(session: WatchSession, relativePath: string): { included: boolean } {
  const child = [...session.admittedChildRoots.values()]
    .filter(candidate => relativePath === candidate.path || relativePath.startsWith(`${candidate.path}/`))
    .sort((left, right) => right.path.length - left.path.length)[0];
  if (child !== undefined) {
    const localPath = relativePath.slice(child.path.length).replace(/^\//, "") || ".";
    return classifyWorkspaceEventPath({ repoRoot: child.canonicalRoot, path: localPath, indexedRoots: ["."], skippedRoots: [] });
  }
  return classifyWorkspaceEventPath({
    repoRoot: session.repoRoot, path: relativePath, indexedRoots: session.indexedRoots, skippedRoots: session.skippedRoots
  });
}

function isUnderUnadmittedNestedRepository(session: WatchSession, relativePath: string): boolean {
  const segments = relativePath === "." ? [] : relativePath.split("/");
  for (let index = 1; index <= segments.length; index += 1) {
    const candidate = path.resolve(session.repoRoot, segments.slice(0, index).join("/"));
    if (isNestedGitRepository(session.repoRoot, candidate)) return true;
  }
  return false;
}

function missingObservation(epoch: string): GraphBuildWatchObservation {
  return { epoch, sequence: 0, healthy: false, pending_events: 0, covered_directories: [] };
}

/** Metadata inputs are validated separately, but their root-level changes still invalidate a receipt. */
function isGraphBuildMetadataEvent(relativePath: string): boolean {
  return [".gitignore", ".aiignore", ".gitmodules"].includes(path.posix.basename(normalizeWatchPath(relativePath)));
}
