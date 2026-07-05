/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { WorkspaceChangeQueue } from "../../src/application/use-cases/workspace-change-queue.js";
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

  public advance(ms: number): void {
    this.timestamp += ms;
  }
}

describe("workspace change queue", () => {
  it("debounces repeated modify events into one stale rescan request", () => {
    const clock = new MutableClock("2026-07-05T12:00:00.000Z");
    const queue = new WorkspaceChangeQueue({
      clock,
      config: {
        debounce_ms: 250,
        event_budget: 10
      }
    });

    queue.enqueue({ kind: "modified", path: "src/app.ts", recorded_at: clock.nowIso8601() });
    clock.advance(100);
    queue.enqueue({ kind: "modified", path: "src/app.ts", recorded_at: clock.nowIso8601() });

    expect(queue.drain()).toMatchObject({
      status: "idle",
      events: [],
      snapshot_freshness: "refreshing",
      bounded_rescan_required: false
    });

    clock.advance(250);
    expect(queue.drain()).toEqual({
      status: "drained",
      events: [
        {
          kind: "modified",
          path: "src/app.ts",
          recorded_at: "2026-07-05T12:00:00.100Z"
        }
      ],
      snapshot_freshness: "stale",
      bounded_rescan_required: true
    });
  });

  it("normalizes rename events into delete plus refresh work", () => {
    const clock = new MutableClock("2026-07-05T12:00:00.000Z");
    const queue = new WorkspaceChangeQueue({
      clock,
      config: {
        debounce_ms: 0,
        event_budget: 10
      }
    });

    queue.enqueue({
      kind: "renamed",
      old_path: "src/old.ts",
      path: "src/new.ts",
      recorded_at: clock.nowIso8601()
    });

    expect(queue.drain()).toEqual({
      status: "drained",
      events: [
        {
          kind: "modified",
          path: "src/new.ts",
          recorded_at: "2026-07-05T12:00:00.000Z",
          snapshot_id: undefined
        },
        {
          kind: "deleted",
          path: "src/old.ts",
          recorded_at: "2026-07-05T12:00:00.000Z",
          snapshot_id: undefined
        }
      ],
      snapshot_freshness: "stale",
      bounded_rescan_required: true
    });
  });

  it("turns event budget overflow into a stale bounded rescan signal", () => {
    const clock = new MutableClock("2026-07-05T12:00:00.000Z");
    const queue = new WorkspaceChangeQueue({
      clock,
      config: {
        debounce_ms: 0,
        event_budget: 1
      }
    });

    queue.enqueue({ kind: "modified", path: "src/a.ts", recorded_at: clock.nowIso8601() });
    queue.enqueue({ kind: "modified", path: "src/b.ts", recorded_at: clock.nowIso8601() });

    expect(queue.drain()).toEqual({
      status: "overflow",
      events: [],
      snapshot_freshness: "stale",
      bounded_rescan_required: true,
      reason: "Workspace watcher queue overflow requires a bounded rescan."
    });
  });
});
