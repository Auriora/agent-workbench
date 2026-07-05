/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { WorkspaceChangeQueue } from "../../application/use-cases/workspace-change-queue.js";
import type { WorkspaceFileEvent } from "../../domain/models/index.js";
import type { ClockPort } from "../../ports/index.js";
import { classifyWorkspaceEventPath } from "./workspace-event-policy.js";

const PATH_KEYS = ["path", "file_path", "filename"] as const;

export type HookWorkspaceSignalResult = {
  enqueued_events: readonly WorkspaceFileEvent[];
  skipped_paths: readonly string[];
};

export function enqueueHookWorkspaceSignal(input: {
  payload: unknown;
  repo_root: string;
  indexed_roots: readonly string[];
  skipped_roots: readonly string[];
  queue: WorkspaceChangeQueue;
  clock: ClockPort;
}): HookWorkspaceSignalResult {
  const payload = objectValue(input.payload);
  const enqueuedEvents: WorkspaceFileEvent[] = [];
  const skippedPaths: string[] = [];

  for (const candidate of extractHookChangedFiles(payload)) {
    const decision = classifyWorkspaceEventPath({
      repoRoot: input.repo_root,
      path: candidate.path,
      indexedRoots: input.indexed_roots,
      skippedRoots: input.skipped_roots
    });
    if (!decision.included) {
      skippedPaths.push(decision.relativePath);
      continue;
    }
    const event: WorkspaceFileEvent = {
      kind: candidate.kind,
      path: decision.relativePath,
      old_path: candidate.old_path,
      recorded_at: input.clock.nowIso8601()
    };
    input.queue.enqueue(event);
    enqueuedEvents.push(event);
  }

  return {
    enqueued_events: enqueuedEvents.sort(compareEvents),
    skipped_paths: Array.from(new Set(skippedPaths)).sort()
  };
}

function extractHookChangedFiles(payload: Record<string, unknown>): Array<{
  kind: WorkspaceFileEvent["kind"];
  path: string;
  old_path?: string;
}> {
  const toolInput = objectValue(payload.tool_input);
  const files = new Set<string>();
  for (const key of PATH_KEYS) {
    const value = toolInput[key];
    if (typeof value === "string") {
      files.add(value);
    }
  }

  const oldPath = toolInput.old_path;
  const newPath = toolInput.new_path;
  if (typeof oldPath === "string" && typeof newPath === "string") {
    return [{ kind: "renamed", path: newPath, old_path: oldPath }];
  }
  if (typeof oldPath === "string") {
    return [{ kind: "deleted", path: oldPath }];
  }
  if (typeof newPath === "string") {
    return [{ kind: "modified", path: newPath }];
  }

  return [...files].sort().map((file) => ({
    kind: "modified",
    path: file
  }));
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function compareEvents(left: WorkspaceFileEvent, right: WorkspaceFileEvent): number {
  return `${left.path}:${left.kind}`.localeCompare(`${right.path}:${right.kind}`);
}
