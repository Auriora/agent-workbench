/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { WorkspaceFileEvent, WorkspaceWatcherConfig } from "../../domain/models/index.js";
import type { ClockPort } from "../../ports/index.js";

export type WorkspaceChangeQueueDrainResult = {
  status: "idle" | "drained" | "overflow";
  events: readonly WorkspaceFileEvent[];
  snapshot_freshness: "fresh" | "refreshing" | "stale";
  bounded_rescan_required: boolean;
  reason?: string;
};

export class WorkspaceChangeQueue {
  private readonly pending = new Map<string, WorkspaceFileEvent>();
  private readonly clock: ClockPort;
  private readonly debounceMs: number;
  private readonly eventBudget: number;
  private lastEventAtMs = 0;
  private overflowed = false;

  constructor(input: {
    config: Pick<WorkspaceWatcherConfig, "debounce_ms" | "event_budget">;
    clock: ClockPort;
  }) {
    this.clock = input.clock;
    this.debounceMs = input.config.debounce_ms;
    this.eventBudget = input.config.event_budget;
  }

  public enqueue(event: WorkspaceFileEvent): void {
    if (this.overflowed) {
      return;
    }
    const normalizedEvents = normalizeQueueEvent(event);
    for (const normalizedEvent of normalizedEvents) {
      if (this.pending.size >= this.eventBudget && !this.pending.has(normalizedEvent.path)) {
        this.pending.clear();
        this.overflowed = true;
        this.lastEventAtMs = this.clock.nowUnixMs();
        return;
      }
      this.applyEvent(normalizedEvent);
      this.lastEventAtMs = this.clock.nowUnixMs();
    }
  }

  public markOverflow(reason = "workspace watcher event budget exceeded"): void {
    this.pending.clear();
    this.overflowed = true;
    this.lastEventAtMs = this.clock.nowUnixMs();
  }

  public drain(): WorkspaceChangeQueueDrainResult {
    if (this.overflowed) {
      this.overflowed = false;
      return {
        status: "overflow",
        events: [],
        snapshot_freshness: "stale",
        bounded_rescan_required: true,
        reason: "Workspace watcher queue overflow requires a bounded rescan."
      };
    }

    if (this.pending.size === 0) {
      return {
        status: "idle",
        events: [],
        snapshot_freshness: "fresh",
        bounded_rescan_required: false
      };
    }

    const ageMs = this.clock.nowUnixMs() - this.lastEventAtMs;
    if (ageMs < this.debounceMs) {
      return {
        status: "idle",
        events: [],
        snapshot_freshness: "refreshing",
        bounded_rescan_required: false
      };
    }

    const events = [...this.pending.values()].sort(compareEvents);
    this.pending.clear();
    return {
      status: "drained",
      events,
      snapshot_freshness: "stale",
      bounded_rescan_required: events.length > 0
    };
  }

  private applyEvent(event: WorkspaceFileEvent): void {
    const current = this.pending.get(event.path);
    if (event.kind === "deleted") {
      this.pending.set(event.path, event);
      return;
    }
    if (current?.kind === "created" && event.kind === "modified") {
      this.pending.set(event.path, { ...event, kind: "created", recorded_at: current.recorded_at });
      return;
    }
    if (current?.kind === "deleted" && event.kind === "created") {
      this.pending.set(event.path, { ...event, kind: "modified" });
      return;
    }
    this.pending.set(event.path, event);
  }
}

function normalizeQueueEvent(event: WorkspaceFileEvent): WorkspaceFileEvent[] {
  if (event.kind !== "renamed") {
    return [event];
  }
  const events: WorkspaceFileEvent[] = [];
  if (event.old_path !== undefined && event.old_path.length > 0) {
    events.push({
      kind: "deleted",
      path: event.old_path,
      recorded_at: event.recorded_at,
      snapshot_id: event.snapshot_id
    });
  }
  events.push({
    kind: "modified",
    path: event.path,
    recorded_at: event.recorded_at,
    snapshot_id: event.snapshot_id
  });
  return events;
}

function compareEvents(left: WorkspaceFileEvent, right: WorkspaceFileEvent): number {
  return `${left.path}:${left.kind}`.localeCompare(`${right.path}:${right.kind}`);
}
