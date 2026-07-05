/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { WorkspaceFileEvent } from "../../domain/models/index.js";
import type { SnapshotState } from "../../domain/models/runtime.js";
import type {
  ClockPort,
  SnapshotPort,
  WarmupCoordinatorPort
} from "../../ports/index.js";
import type { WorkspaceChangeQueue } from "./workspace-change-queue.js";

export type WorkspaceChangeQueueProcessResult =
  | {
      status: "idle" | "refreshing";
      repo_root: string;
      events: readonly WorkspaceFileEvent[];
      bounded_rescan_required: false;
      snapshot_id?: string;
    }
  | {
      status: "stale_rescan_scheduled";
      repo_root: string;
      events: readonly WorkspaceFileEvent[];
      bounded_rescan_required: true;
      snapshot_id: string;
      execution_id: string;
    }
  | {
      status: "degraded";
      repo_root: string;
      events: readonly WorkspaceFileEvent[];
      bounded_rescan_required: true;
      snapshot_id?: string;
      reason: string;
    };

export async function processWorkspaceChangeQueue(input: {
  repo_root: string;
  queue: WorkspaceChangeQueue;
  snapshots: SnapshotPort;
  warmups: WarmupCoordinatorPort;
  clock: ClockPort;
}): Promise<WorkspaceChangeQueueProcessResult> {
  const drain = input.queue.drain();
  const currentSnapshot = await input.snapshots.getSnapshot({ repo_root: input.repo_root });

  if (drain.status === "idle" && drain.snapshot_freshness === "fresh") {
    return {
      status: "idle",
      repo_root: input.repo_root,
      events: drain.events,
      bounded_rescan_required: false,
      snapshot_id: currentSnapshot?.id
    };
  }

  if (drain.status === "idle" && drain.snapshot_freshness === "refreshing") {
    return {
      status: "refreshing",
      repo_root: input.repo_root,
      events: drain.events,
      bounded_rescan_required: false,
      snapshot_id: currentSnapshot?.id
    };
  }

  if (drain.status === "idle") {
    return {
      status: "refreshing",
      repo_root: input.repo_root,
      events: drain.events,
      bounded_rescan_required: false,
      snapshot_id: currentSnapshot?.id
    };
  }

  const snapshotId = currentSnapshot?.id ?? String(input.clock.nowUnixMs());
  try {
    if (currentSnapshot !== null) {
      await input.snapshots.markSnapshotFreshness({
        snapshot_id: currentSnapshot.id,
        freshness: "stale",
        reason: staleReason(drain.status)
      });
    }
    const executionId = await input.warmups.requestWarmup({
      repo_root: input.repo_root,
      snapshot_id: snapshotId
    });
    return {
      status: "stale_rescan_scheduled",
      repo_root: input.repo_root,
      events: drain.events,
      bounded_rescan_required: true,
      snapshot_id: snapshotId,
      execution_id: executionId
    };
  } catch (error) {
    return {
      status: "degraded",
      repo_root: input.repo_root,
      events: drain.events,
      bounded_rescan_required: true,
      snapshot_id: currentSnapshot?.id,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

function staleReason(status: "drained" | "overflow"): string {
  return status === "overflow"
    ? "Workspace watcher overflow requires bounded rescan."
    : "Workspace watcher observed included file changes.";
}
