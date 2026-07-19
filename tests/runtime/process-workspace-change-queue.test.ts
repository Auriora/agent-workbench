/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { processWorkspaceChangeQueue } from "../../src/application/use-cases/process-workspace-change-queue.js";
import { WorkspaceChangeQueue } from "../../src/application/use-cases/workspace-change-queue.js";
import type { SnapshotState, WarmupExecution } from "../../src/domain/models/index.js";
import type { ClockPort, SnapshotPort, WarmupCoordinatorPort } from "../../src/ports/index.js";

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

class RecordingSnapshots implements SnapshotPort {
  public readonly freshnessMarks: Array<{
    snapshot_id: string;
    freshness: SnapshotState["freshness"];
    reason?: string;
  }> = [];

  constructor(private readonly snapshot: SnapshotState | null) {}

  public async getSnapshot(): Promise<SnapshotState | null> {
    return this.snapshot;
  }

  public async listSnapshots(): Promise<readonly SnapshotState[]> {
    return this.snapshot === null ? [] : [this.snapshot];
  }

  public async upsertSnapshot(): Promise<void> {}

  public async markSnapshotFreshness(input: {
    snapshot_id: string;
    freshness: SnapshotState["freshness"];
    reason?: string;
  }): Promise<void> {
    this.freshnessMarks.push(input);
  }
}

class RecordingWarmups implements WarmupCoordinatorPort {
  public readonly requests: Array<{ repo_root: string; snapshot_id: string; force?: boolean }> = [];

  constructor(private readonly activeState: WarmupExecution | null = null) {}

  public async getState(): Promise<WarmupExecution | null> {
    return this.activeState;
  }

  public async requestWarmup(input: {
    repo_root: string;
    snapshot_id: string;
    force?: boolean;
  }): Promise<string> {
    this.requests.push(input);
    return "warmup-1";
  }

  public async markOwner(): Promise<void> {}

  public async completeWarmup(): Promise<void> {}
}

describe("process workspace change queue", () => {
  it("marks the active snapshot stale before scheduling one bounded rescan", async () => {
    const clock = new MutableClock("2026-07-05T12:00:00.000Z");
    const queue = new WorkspaceChangeQueue({
      clock,
      config: {
        debounce_ms: 0,
        event_budget: 10
      }
    });
    queue.enqueue({
      kind: "modified",
      path: "src/app.ts",
      recorded_at: clock.nowIso8601()
    });
    const snapshots = new RecordingSnapshots(snapshot("snap-1"));
    const warmups = new RecordingWarmups();

    await expect(
      processWorkspaceChangeQueue({
        repo_root: "/repo",
        queue,
        snapshots,
        warmups,
        clock
      })
    ).resolves.toEqual({
      status: "stale_rescan_scheduled",
      repo_root: "/repo",
      events: [
        {
          kind: "modified",
          path: "src/app.ts",
          recorded_at: "2026-07-05T12:00:00.000Z"
        }
      ],
      bounded_rescan_required: true,
      snapshot_id: "1783252800000",
      execution_id: "warmup-1"
    });
    expect(snapshots.freshnessMarks).toEqual([
      {
        snapshot_id: "snap-1",
        freshness: "stale",
        reason: "Workspace watcher observed included file changes."
      }
    ]);
    expect(warmups.requests).toEqual([
      {
        repo_root: "/repo",
        snapshot_id: "1783252800000"
      }
    ]);
  });

  it("deduplicates event bursts before requesting the existing warmup path", async () => {
    const clock = new MutableClock("2026-07-05T12:00:00.000Z");
    const queue = new WorkspaceChangeQueue({
      clock,
      config: {
        debounce_ms: 0,
        event_budget: 10
      }
    });
    queue.enqueue({ kind: "modified", path: "src/app.ts", recorded_at: clock.nowIso8601() });
    queue.enqueue({ kind: "modified", path: "src/app.ts", recorded_at: clock.nowIso8601() });
    const snapshots = new RecordingSnapshots(snapshot("snap-1"));
    const warmups = new RecordingWarmups();

    const result = await processWorkspaceChangeQueue({
      repo_root: "/repo",
      queue,
      snapshots,
      warmups,
      clock
    });

    expect(result).toMatchObject({
      status: "stale_rescan_scheduled",
      events: [
        expect.objectContaining({
          kind: "modified",
          path: "src/app.ts"
        })
      ]
    });
    expect(result.events).toHaveLength(1);
    expect(warmups.requests).toHaveLength(1);
  });

  it("reuses a planned warmup instead of scheduling duplicate bounded rescans", async () => {
    const clock = new MutableClock("2026-07-05T12:00:00.000Z");
    const queue = new WorkspaceChangeQueue({
      clock,
      config: {
        debounce_ms: 0,
        event_budget: 10
      }
    });
    queue.enqueue({ kind: "modified", path: "src/app.ts", recorded_at: clock.nowIso8601() });
    const snapshots = new RecordingSnapshots(snapshot("snap-1"));
    const warmups = new RecordingWarmups(warmup("planned", "warmup-existing", "snap-existing"));

    await expect(
      processWorkspaceChangeQueue({
        repo_root: "/repo",
        queue,
        snapshots,
        warmups,
        clock
      })
    ).resolves.toEqual({
      status: "stale_rescan_scheduled",
      repo_root: "/repo",
      events: [
        {
          kind: "modified",
          path: "src/app.ts",
          recorded_at: "2026-07-05T12:00:00.000Z"
        }
      ],
      bounded_rescan_required: true,
      snapshot_id: "snap-existing",
      execution_id: "warmup-existing"
    });
    expect(snapshots.freshnessMarks).toEqual([
      {
        snapshot_id: "snap-1",
        freshness: "stale",
        reason: "Workspace watcher observed included file changes."
      }
    ]);
    expect(warmups.requests).toEqual([]);
  });

  it("keeps watcher freshness degraded when bounded rescan scheduling fails", async () => {
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
    const snapshots = new RecordingSnapshots(snapshot("snap-1"));
    const warmups = new RecordingWarmups();
    warmups.requestWarmup = async () => {
      throw new Error("warmup unavailable");
    };

    await expect(
      processWorkspaceChangeQueue({
        repo_root: "/repo",
        queue,
        snapshots,
        warmups,
        clock
      })
    ).resolves.toEqual({
      status: "degraded",
      repo_root: "/repo",
      events: [],
      bounded_rescan_required: true,
      snapshot_id: "snap-1",
      reason: "warmup unavailable"
    });
    expect(snapshots.freshnessMarks).toEqual([
      {
        snapshot_id: "snap-1",
        freshness: "stale",
        reason: "Workspace watcher overflow requires bounded rescan."
      }
    ]);
  });
});

function snapshot(id: string): SnapshotState {
  return {
    id,
    repo_root: "/repo",
    workspace_root: "/repo",
    repo_identity: "repo",
    config_identity: "default",
    schema_version: 1,
    freshness: "fresh",
    owner_state: "owner",
    created_at: "2026-07-05T12:00:00.000Z",
    updated_at: "2026-07-05T12:00:00.000Z"
  };
}

function warmup(
  state: WarmupExecution["state"],
  executionId: string,
  snapshotId: string
): WarmupExecution {
  return {
    execution_id: executionId,
    repo_root: "/repo",
    snapshot_id: snapshotId,
    state,
    owner_id: "owner",
    queued_jobs: state === "running" ? 1 : 0,
    started_at: "2026-07-05T12:00:00.000Z",
    updated_at: "2026-07-05T12:00:00.000Z"
  };
}
