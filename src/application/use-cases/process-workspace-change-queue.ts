/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { WorkspaceFileEvent } from "../../domain/models/index.js";
import type { WorkspaceChangeQueue } from "./workspace-change-queue.js";
import type { RepositoryRefreshTriggerPort } from "./repository-refresh-triggers.js";

const overflowSequenceByQueue = new WeakMap<WorkspaceChangeQueue, number>();

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
  triggers: RepositoryRefreshTriggerPort;
}): Promise<WorkspaceChangeQueueProcessResult> {
  const drain = input.queue.drain();

  if (drain.status === "idle" && drain.snapshot_freshness === "fresh") {
    return {
      status: "idle",
      repo_root: input.repo_root,
      events: drain.events,
      bounded_rescan_required: false,
      snapshot_id: undefined
    };
  }

  if (drain.status === "idle" && drain.snapshot_freshness === "refreshing") {
    return {
      status: "refreshing",
      repo_root: input.repo_root,
      events: drain.events,
      bounded_rescan_required: false,
      snapshot_id: undefined
    };
  }

  if (drain.status === "idle") {
    return {
      status: "refreshing",
      repo_root: input.repo_root,
      events: drain.events,
      bounded_rescan_required: false,
      snapshot_id: undefined
    };
  }

  try {
    const admission = await input.triggers.watcherBatch({
      source: staleReason(drain.status),
      batch_identity: watcherBatchIdentity(input.queue, drain.status, drain.events)
    });
    if (admission.outcome === "blocked") {
      return {
        status: "degraded",
        repo_root: input.repo_root,
        events: drain.events,
        bounded_rescan_required: true,
        reason: admission.message
      };
    }
    if (admission.target_snapshot_id === undefined) {
      return {
        status: "degraded",
        repo_root: input.repo_root,
        events: drain.events,
        bounded_rescan_required: true,
        reason: "Refresh admission did not identify a target snapshot."
      };
    }
    return {
      status: "stale_rescan_scheduled",
      repo_root: input.repo_root,
      events: drain.events,
      bounded_rescan_required: true,
      snapshot_id: admission.target_snapshot_id,
      execution_id: admission.execution_id
    };
  } catch {
    return {
      status: "degraded",
      repo_root: input.repo_root,
      events: drain.events,
      bounded_rescan_required: true,
      reason: "Workspace refresh trigger failed."
    };
  }
}

function watcherBatchIdentity(
  queue: WorkspaceChangeQueue,
  status: "drained" | "overflow",
  events: readonly WorkspaceFileEvent[]
): string {
  if (status === "overflow") {
    const sequence = (overflowSequenceByQueue.get(queue) ?? 0) + 1;
    overflowSequenceByQueue.set(queue, sequence);
    return `overflow:${sequence}`;
  }
  return [
    status,
    ...events.map((event) => [
      event.kind,
      event.path,
      event.old_path ?? "",
      event.recorded_at,
      event.snapshot_id ?? ""
    ].join("\u0000"))
  ].join("\u0001");
}

function staleReason(status: "drained" | "overflow"): string {
  return status === "overflow"
    ? "Workspace watcher overflow requires bounded rescan."
    : "Workspace watcher observed included file changes.";
}
