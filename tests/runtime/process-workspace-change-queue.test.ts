/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { processWorkspaceChangeQueue } from "../../src/application/use-cases/process-workspace-change-queue.js";
import { WorkspaceChangeQueue } from "../../src/application/use-cases/workspace-change-queue.js";
import type { ClockPort } from "../../src/ports/index.js";
import {
  RepositoryRefreshTriggerCoordinator,
  type RepositoryRefreshTriggerPort
} from "../../src/application/use-cases/repository-refresh-triggers.js";
import { createRepositoryWorkspaceRefreshService } from "../../src/server.js";
import type { GraphBuildWatchQueuePort } from "../../src/ports/index.js";

class RecordingTriggers implements RepositoryRefreshTriggerPort {
  public readonly watcherRequests: string[] = [];
  public readonly watcherBatchIdentities: string[] = [];
  public failure: Error | undefined;
  public onWatcherRequest: (() => void) | undefined;

  public constructor(private readonly admission: any = {
    outcome: "accepted",
    reused: false,
    execution_id: "refresh-1",
    target_snapshot_id: "target-1",
    state: "planned",
    started_generation: 1,
    requested_generation: 1
  }) {}

  public async startup(): Promise<any> { return this.admission; }
  public async staleFirstRead(): Promise<any> { return this.admission; }
  public async watcherBatch(input: { source: string; batch_identity: string }): Promise<any> {
    this.watcherRequests.push(input.source);
    this.watcherBatchIdentities.push(input.batch_identity);
    this.onWatcherRequest?.();
    if (this.failure !== undefined) throw this.failure;
    return this.admission;
  }
  public async hasPendingGeneration(): Promise<boolean> { return false; }
  public getGenerationReceipt() { return { generation: this.watcherRequests.length }; }
}

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

describe("process workspace change queue", () => {
  it("marks a fresh visible snapshot stale before admitting startup work", async () => {
    let freshness: "fresh" | "stale" = "fresh";
    const observedAtRequest: Array<"fresh" | "stale"> = [];
    const triggers = new RepositoryRefreshTriggerCoordinator({
      repo_root: "/repo",
      controller: {
        async request(input: any) {
          observedAtRequest.push(freshness);
          return {
            outcome: "accepted",
            reused: false,
            execution_id: "exec-startup",
            target_snapshot_id: "snapshot-startup",
            state: "planned",
            started_generation: input.invalidation_generation,
            requested_generation: input.invalidation_generation
          };
        },
        getReceipt() {
          return {
            repo_root: "/repo",
            controller_generation: 1,
            requested_generation: 0,
            started_generation: 0,
            execution_state: "idle" as const,
            activity_lease: null,
            worker_invocations: 0,
            worker_termination_state: "not_required" as const
          };
        }
      },
      publications: {
        async getLatestPublished() {
          return {
            status: "selected" as const,
            snapshot: { id: "1000", freshness },
            publication: { invalidation_generation: 5 }
          } as any;
        }
      } as any,
      snapshots: {
        async markSnapshotFreshness(input) {
          expect(input).toMatchObject({
            snapshot_id: "1000",
            freshness: "stale",
            reason: "startup_refresh_requested"
          });
          freshness = "stale";
        }
      }
    });

    await triggers.startup({ source: "daemon-startup" });

    expect(observedAtRequest).toEqual(["stale"]);
    expect(freshness).toBe("stale");
  });

  it("reuses one dirty generation for status polling and advances once per watcher batch", async () => {
    const requests: number[] = [];
    const freshnessMarks: string[] = [];
    const controller: any = {
      async request(input: any) {
        requests.push(input.invalidation_generation);
        return {
          outcome: requests.length === 1 ? "accepted" : "reused",
          reused: requests.length !== 1,
          execution_id: "exec-1",
          target_snapshot_id: "1001",
          state: requests.length === 1 ? "planned" : "running",
          started_generation: requests[0],
          requested_generation: input.invalidation_generation
        };
      },
      getReceipt() {
        return {
          requested_generation: 0,
          started_generation: 0,
          execution_state: "idle"
        };
      }
    };
    const publications: any = {
      async getLatestPublished() {
        return {
          status: "selected",
          snapshot: { id: "1000", freshness: "fresh" },
          publication: { invalidation_generation: 5 }
        };
      }
    };
    const triggers = new RepositoryRefreshTriggerCoordinator({
      repo_root: "/repo",
      controller,
      publications,
      snapshots: {
        async markSnapshotFreshness(input) { freshnessMarks.push(input.snapshot_id); }
      }
    });

    await triggers.staleFirstRead({ source: "status", visible_snapshot_id: "1000" });
    await triggers.staleFirstRead({ source: "orientation", visible_snapshot_id: "1000" });
    await triggers.watcherBatch({ source: "watcher", batch_identity: "batch-1" });

    expect(requests).toEqual([6, 6, 7]);
    expect(freshnessMarks).toEqual(["1000"]);
    expect(triggers.getGenerationReceipt()).toMatchObject({ generation: 7, dirty_generation: 7 });
  });

  it("does not retry a failed stale-first-read generation", async () => {
    let requests = 0;
    let executionState: "idle" | "failed" = "idle";
    const admission = {
      outcome: "accepted" as const,
      reused: false as const,
      execution_id: "exec-failed",
      target_snapshot_id: "1001",
      state: "planned" as const,
      started_generation: 6,
      requested_generation: 6
    };
    const triggers = new RepositoryRefreshTriggerCoordinator({
      repo_root: "/repo",
      controller: {
        async request() {
          requests += 1;
          return admission;
        },
        getReceipt() {
          return {
            repo_root: "/repo",
            controller_generation: 1,
            requested_generation: 5,
            started_generation: 5,
            execution_state: executionState,
            activity_lease: null,
            worker_invocations: 1,
            worker_termination_state: "not_required" as const
          };
        }
      },
      publications: {
        async getLatestPublished() {
          return {
            status: "selected" as const,
            snapshot: { id: "1000", freshness: "fresh" as const },
            publication: { invalidation_generation: 5 }
          } as any;
        },
        async allocateBuildSnapshotId() { throw new Error("not used"); },
        async transitionBuild() { throw new Error("not used"); },
        async readExplicit() { throw new Error("not used"); }
      },
      snapshots: { async markSnapshotFreshness() {} }
    });

    expect(await triggers.staleFirstRead({ source: "status", visible_snapshot_id: "1000" }))
      .toEqual(admission);
    executionState = "failed";
    expect(await triggers.staleFirstRead({ source: "orientation", visible_snapshot_id: "1000" }))
      .toEqual(admission);
    expect(requests).toBe(1);
  });

  it("autonomously admits modifications without a status or orientation read", async () => {
    const clock = new MutableClock("2026-07-05T12:00:00.000Z");
    const triggers = new RecordingTriggers();
    let polls = 0;
    let scheduled: (() => void) | undefined;
    let admitted!: () => void;
    const admissionObserved = new Promise<void>((resolve) => { admitted = resolve; });
    triggers.onWatcherRequest = admitted;
    const observation: GraphBuildWatchQueuePort = {
      async start() { return { epoch: "watch-1", sequence: 0, healthy: true, pending_events: 0, covered_directories: ["."] }; },
      async registerDirectory() { return this.observe(); },
      observe() { return { epoch: "watch-1", sequence: 0, healthy: true, pending_events: 0, covered_directories: ["."] }; },
      async drain() { return this.observe(); },
      async close() {},
      coverageEstablished: () => true,
      establishCoverage() {},
      bindDrain() {},
      async pollEvents() {
        polls += 1;
        return polls === 1
          ? [{ kind: "modified" as const, path: "src/app.ts", recorded_at: clock.nowIso8601() }]
          : [];
      }
    };
    const service = createRepositoryWorkspaceRefreshService({
      repoRoot: "/repo",
      triggers,
      observation,
      clock,
      config: { enabled: true, debounce_ms: 0, event_budget: 10 },
      indexedRoots: ["."],
      skippedRoots: [],
      schedulePoll: ({ callback }) => {
        scheduled = callback;
        return { cancel() { scheduled = undefined; } };
      }
    });

    expect(scheduled).toBeDefined();
    scheduled!();
    await admissionObserved;
    expect(triggers.watcherRequests).toHaveLength(1);
    await service.close();
  });

  it("reuses a stable identity for sequential duplicate batches and advances for new evidence", async () => {
    const requests: number[] = [];
    const controller: any = {
      async request(input: any) {
        requests.push(input.invalidation_generation);
        return {
          outcome: "accepted",
          reused: false,
          execution_id: `exec-${input.invalidation_generation}`,
          target_snapshot_id: `snapshot-${input.invalidation_generation}`,
          state: "planned",
          started_generation: input.invalidation_generation,
          requested_generation: input.invalidation_generation
        };
      },
      getReceipt() {
        return { requested_generation: 0, started_generation: 0, execution_state: "idle" };
      }
    };
    const triggers = new RepositoryRefreshTriggerCoordinator({
      repo_root: "/repo",
      controller,
      publications: {
        async getLatestPublished() {
          return {
            status: "selected",
            snapshot: { id: "1000", freshness: "stale" },
            publication: { invalidation_generation: 5 }
          };
        }
      } as any,
      snapshots: { async markSnapshotFreshness() {} }
    });
    const queue = new WorkspaceChangeQueue({
      clock: new MutableClock("2026-07-05T12:00:00.000Z"),
      config: { debounce_ms: 0, event_budget: 10 }
    });
    const event = {
      kind: "modified" as const,
      path: "src/app.ts",
      recorded_at: "2026-07-05T12:00:00.000Z"
    };

    queue.enqueue(event);
    const first = await processWorkspaceChangeQueue({ repo_root: "/repo", queue, triggers });
    queue.enqueue(event);
    const duplicate = await processWorkspaceChangeQueue({ repo_root: "/repo", queue, triggers });
    queue.enqueue({ ...event, recorded_at: "2026-07-05T12:00:01.000Z" });
    const next = await processWorkspaceChangeQueue({ repo_root: "/repo", queue, triggers });

    expect(duplicate).toEqual(first);
    expect(next).not.toEqual(first);
    expect(requests).toEqual([6, 7]);
    expect(triggers.getGenerationReceipt()).toMatchObject({ generation: 7, dirty_generation: 7 });
  });

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
    const triggers = new RecordingTriggers();

    await expect(
      processWorkspaceChangeQueue({
        repo_root: "/repo",
        queue,
        triggers
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
      snapshot_id: "target-1",
      execution_id: "refresh-1"
    });
    expect(triggers.watcherRequests).toEqual(["Workspace watcher observed included file changes."]);
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
    const triggers = new RecordingTriggers();

    const result = await processWorkspaceChangeQueue({
      repo_root: "/repo",
      queue,
      triggers
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
    expect(triggers.watcherRequests).toHaveLength(1);
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
    const triggers = new RecordingTriggers({
      outcome: "reused",
      reused: true,
      execution_id: "refresh-existing",
      target_snapshot_id: "target-existing",
      state: "running",
      started_generation: 1,
      requested_generation: 1
    });

    await expect(
      processWorkspaceChangeQueue({
        repo_root: "/repo",
        queue,
        triggers
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
      snapshot_id: "target-existing",
      execution_id: "refresh-existing"
    });
    expect(triggers.watcherRequests).toHaveLength(1);
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
    const triggers = new RecordingTriggers();
    triggers.failure = new Error("refresh unavailable");

    await expect(
      processWorkspaceChangeQueue({
        repo_root: "/repo",
        queue,
        triggers
      })
    ).resolves.toEqual({
      status: "degraded",
      repo_root: "/repo",
      events: [],
      bounded_rescan_required: true,
      reason: "Workspace refresh trigger failed."
    });
    expect(JSON.stringify(await processWorkspaceChangeQueue({
      repo_root: "/repo",
      queue,
      triggers
    }))).not.toContain("refresh unavailable");
  });

  it("redacts raw watcher failures from degraded freshness evidence", async () => {
    const clock = new MutableClock("2026-07-05T12:00:00.000Z");
    const service = createRepositoryWorkspaceRefreshService({
      repoRoot: "/repo",
      triggers: new RecordingTriggers(),
      observation: {
        async start() { return { epoch: "watch-1", sequence: 0, healthy: true, pending_events: 0, covered_directories: ["."] }; },
        async registerDirectory() { return this.observe(); },
        observe() { return { epoch: "watch-1", sequence: 0, healthy: true, pending_events: 0, covered_directories: ["."] }; },
        async drain() { return this.observe(); },
        async close() {},
        coverageEstablished: () => true,
      establishCoverage() {},
      bindDrain() {},
        async pollEvents() { throw new Error("secret-token at /private/workspace"); }
      },
      clock,
      config: { enabled: true, debounce_ms: 0, event_budget: 10 },
      indexedRoots: ["."],
      skippedRoots: [],
      schedulePoll: () => ({ cancel() {} })
    });

    const result = await service.poll();
    expect(result).toEqual({
      status: "degraded",
      queue_state: "failed",
      scope_status: "unknown",
      ignore_rules_status: "unknown",
      reason: "Workspace watcher processing failed."
    });
    expect(JSON.stringify(result)).not.toMatch(/secret-token|private\/workspace/);
    await service.close();
  });

  it("keeps ownership refusals observable without idle retries and permits a new generation", async () => {
    const clock = new MutableClock("2026-11-08T12:00:00.000Z");
    const admission = { outcome: "blocked", reused: false, state: "idle", reason: "owner_active",
      message: "Another owner is active." };
    const triggers = new RecordingTriggers(admission);
    let active = false;
    triggers.hasPendingGeneration = async () => active;
    let health!: () => { healthy: boolean; pending_events: number };
    let polls = 0;
    const service = createRepositoryWorkspaceRefreshService({
      repoRoot: "/repo", triggers, clock,
      observation: {
        async start() { return this.observe(); },
        async registerDirectory() { return this.observe(); },
        observe() { return { epoch: "epoch", sequence: 1, healthy: true, pending_events: 0, covered_directories: ["."] }; },
        async drain() { return this.observe(); },
        async close() {},
        coverageEstablished: () => true,
        establishCoverage() {},
        bindDrain(_drain, queueHealth) { health = queueHealth!; },
        async pollEvents() {
          return ++polls === 1 ? [{ kind: "modified", path: "src/app.ts", recorded_at: clock.nowIso8601() }] : [];
        }
      },
      config: { enabled: true, debounce_ms: 0, event_budget: 10 },
      indexedRoots: ["."], skippedRoots: [], schedulePoll: () => ({ cancel() {} })
    });
    try {
      await expect(service.poll()).resolves.toMatchObject({ status: "degraded", refresh_admission: admission });
      expect(health()).toEqual({ healthy: true, pending_events: 0 });
      await expect(service.poll({ force: true })).resolves.toMatchObject({ status: "degraded", refresh_admission: admission });
      expect(triggers.watcherRequests).toHaveLength(1);
      active = true;
      await expect(service.poll({ force: true })).resolves.toMatchObject({ status: "refreshing" });
      active = false;
      await expect(service.poll()).resolves.toMatchObject({ status: "fresh" });
      expect(triggers.watcherRequests).toHaveLength(1);
    } finally { await service.close(); }
  });

  it("binds forced raw-event drains outside debounce timing", async () => {
    const clock = new MutableClock("2026-07-05T12:00:00.000Z");
    const triggers = new RecordingTriggers();
    let boundDrain: (() => Promise<void>) | undefined;
    let forceSeen = false;
    let polls = 0;
    triggers.hasPendingGeneration = async () => true;
    const service = createRepositoryWorkspaceRefreshService({
      repoRoot: "/repo",
      triggers,
      observation: {
        async start() { return { epoch: "epoch", sequence: 0, healthy: true, pending_events: 0, covered_directories: ["."] }; },
        async registerDirectory() { return this.observe(); },
        observe() { return { epoch: "epoch", sequence: 0, healthy: true, pending_events: 0, covered_directories: ["."] }; },
        async drain() { return this.observe(); },
        async close() {},
        coverageEstablished: () => true,
        establishCoverage() {},
        bindDrain(drain) { boundDrain = drain; },
        async pollEvents(input) {
          forceSeen = input?.force === true;
          polls += 1;
          return polls === 1 ? [{ kind: "modified", path: "src/app.ts", recorded_at: clock.nowIso8601() }] : [];
        }
      },
      clock,
      config: { enabled: true, debounce_ms: 60_000, event_budget: 10 },
      indexedRoots: ["."],
      skippedRoots: [],
      schedulePoll: () => ({ cancel() {} })
    });

    await service.poll();
    expect(triggers.watcherRequests).toHaveLength(0);
    await boundDrain!();
    expect(forceSeen).toBe(true);
    expect(triggers.watcherRequests).toHaveLength(1);
    await expect(service.poll({ force: true })).resolves.toMatchObject({ status: "refreshing" });
    expect(triggers.watcherRequests).toHaveLength(1);
    await service.close();
  });
});
