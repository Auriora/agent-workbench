/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { WorkspaceChangeQueue } from "../../src/application/use-cases/workspace-change-queue.js";
import type { ClockPort } from "../../src/ports/index.js";
import { createPhase1GenerationCatchupReproduction } from "../helpers/spec041-refresh-reproductions.js";

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
  it.fails("runs one sequential catch-up when a newer queue generation arrives during publication", async () => {
    const clock = new MutableClock("2026-07-05T12:00:00.000Z");
    const queue = new WorkspaceChangeQueue({
      clock,
      config: {
        debounce_ms: 0,
        event_budget: 10
      }
    });
    const controller = createPhase1GenerationCatchupReproduction();

    queue.enqueue({ kind: "modified", path: "src/first.ts", recorded_at: clock.nowIso8601() });
    expect(queue.drain()).toMatchObject({ status: "drained" });
    const firstAdmission = await controller.request({
      repo_root: "/repo",
      reason: "watcher_invalidation",
      source: "workspace_change_queue",
      invalidation_generation: 1
    });
    expect(firstAdmission).toMatchObject({
      outcome: "accepted",
      state: "planned",
      started_generation: 1,
      requested_generation: 1
    });
    const activePass = controller.executeAcceptedPass();
    await controller.workerStarted.promise;

    clock.advance(1);
    queue.enqueue({ kind: "deleted", path: "src/later.ts", recorded_at: clock.nowIso8601() });
    expect(queue.drain()).toMatchObject({ status: "drained" });
    const coalesced = await controller.request({
      repo_root: "/repo",
      reason: "watcher_invalidation",
      source: "workspace_change_queue",
      invalidation_generation: 2
    });
    expect(coalesced).toMatchObject({
      outcome: "reused",
      execution_id: firstAdmission.outcome === "blocked" ? undefined : firstAdmission.execution_id,
      started_generation: 1,
      requested_generation: 2
    });

    controller.releaseWorker.resolve(undefined);
    await controller.beforePublication.promise;
    expect(controller.receipt()).toMatchObject({
      execution_state: "running",
      started_generation: 1,
      requested_generation: 2,
      worker_invocations: 1,
      published_generation: 0
    });
    controller.releasePublication.resolve(undefined);
    await activePass;

    // The local harness intentionally reproduces the pre-controller seam: it
    // records generation 2 but publishes generation 1 and reports complete.
    // All setup/barrier assertions above pass; this final receipt is the only
    // expected failure and locks the required catch-up behavior.
    expect(controller.receipt()).toMatchObject({
      execution_state: "complete",
      started_generation: 2,
      requested_generation: 2,
      worker_invocations: 2,
      published_generation: 2
    });
  });

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
