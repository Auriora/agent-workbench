/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { GraphBuildManifestPublicationValidator } from "../../src/application/use-cases/validate-graph-build-manifest.js";
import { SnapshotRefreshController } from "../../src/infrastructure/runtime/refresh-controller.js";
import { GraphBuildValidationError } from "../../src/ports/graph-build-manifest.js";
import type { ClockPort, GraphBuildManifest, GraphBuildPathIdentity, GraphBuildWatchObservation, RefreshExecutorPort, SnapshotPublicationPort } from "../../src/ports/index.js";

const identity: GraphBuildPathIdentity = {
  path: "src", kind: "directory", device: "1", inode: "2", size_bytes: "0", mtime_ns: "3", ctime_ns: "4"
};

function manifest(): GraphBuildManifest {
  return {
    manifest_id: "manifest-1", state: "sealed", digest: "digest-1", started_at: "2026-11-08T10:00:00.000Z",
    repo_root: "/repo", config_identity: "config", owner_id: "execution-1", controller_generation: 3,
    invalidation_generation: 7, generation_source_hash: "source", watcher_epoch: "epoch-1", watcher_sequence: 0,
    policy_version: "policy", ordering_version: "order", composition_fingerprint: "composition",
    files: [], directories: [{ identity, repository_key: "superproject", watcher_epoch: "epoch-1", watcher_sequence: 0, registered: true }],
    inputs: [], graph_catalog: {} as GraphBuildManifest["graph_catalog"], docs_catalog: {} as GraphBuildManifest["docs_catalog"],
    shape: {} as GraphBuildManifest["shape"], preparation_wall_ms: 1
  };
}

const clock: ClockPort = {
  now: () => new Date("2026-11-08T10:01:00.000Z"), nowIso8601: () => "2026-11-08T10:01:00.000Z", nowUnixMs: () => 1000
};

function observation(covered = ["src"]): GraphBuildWatchObservation {
  return { epoch: "epoch-1", sequence: 0, healthy: true, pending_events: 0, covered_directories: covered };
}

describe("sealed manifest publication validation", () => {
  it("consumes a receipt exactly once and commits only after a final clean observation", async () => {
    const sealed = manifest();
    let committed = 0;
    const watcher = { start: async () => observation(), registerDirectory: async () => observation(), observe: () => observation(), drain: async () => observation(), close: async () => {} };
    const store = {
      getGraphBuildManifest: async () => sealed,
      invalidateGraphBuildManifest: async () => { throw new Error("should not invalidate"); },
      publishValidatedGraphBuild: ({ assert_observation }: { assert_observation: () => void }) => {
        assert_observation(); committed += 1;
        return { repo_root: "/repo", snapshot_id: "701", controller_generation: 3, invalidation_generation: 7, state: "published" as const, updated_at: clock.nowIso8601() };
      }
    };
    const validator = new GraphBuildManifestPublicationValidator({ store: async () => store as never, watcher, read_identity: async expected => expected, clock, create_receipt_id: () => "receipt-1" });
    const receipt = await validator.prepare({ repo_root: "/repo", execution_id: "execution-1", target_snapshot_id: "701", controller_generation: 3, invalidation_generation: 7, kind: "seed" });
    validator.commit({ receipt, transition: { repo_root: "/repo", snapshot_id: "701", controller_generation: 3, invalidation_generation: 7, from: "building", to: "published", updated_at: clock.nowIso8601() } });
    expect(committed).toBe(1);
    expect(() => validator.commit({ receipt, transition: { repo_root: "/repo", snapshot_id: "701", controller_generation: 3, invalidation_generation: 7, from: "building", to: "published", updated_at: clock.nowIso8601() } })).toThrow("already_consumed");
  });

  it("does not confuse a hidden directory with a different unprefixed directory", async () => {
    const captured = manifest();
    captured.directories = [{ ...captured.directories[0]!, identity: { ...identity, path: ".src" } }];
    const validator = new GraphBuildManifestPublicationValidator({
      store: async () => ({
        getGraphBuildManifest: async () => captured,
        invalidateGraphBuildManifest: async () => undefined
      }) as never,
      watcher: { observe: () => observation(["src"]) } as never,
      read_identity: async value => value, clock
    });
    await expect(validator.prepare({ repo_root: "/repo", execution_id: "execution-1", target_snapshot_id: "701", controller_generation: 3, invalidation_generation: 7, kind: "seed" }))
      .rejects.toThrow("directory_not_covered");
  });

  it("rejects a receipt when watcher coverage disappears before commit", async () => {
    const sealed = manifest();
    let covered = true;
    const watcher = { start: async () => observation(), registerDirectory: async () => observation(), observe: () => observation(covered ? ["src"] : []), drain: async () => observation(), close: async () => {} };
    let invalidated = false;
    const store = {
      getGraphBuildManifest: async () => sealed,
      invalidateGraphBuildManifest: async () => { invalidated = true; },
      publishValidatedGraphBuild: ({ assert_observation }: { assert_observation: () => void }) => { assert_observation(); throw new Error("unreachable"); }
    };
    const validator = new GraphBuildManifestPublicationValidator({ store: async () => store as never, watcher, read_identity: async expected => expected, clock });
    const receipt = await validator.prepare({ repo_root: "/repo", execution_id: "execution-1", target_snapshot_id: "701", controller_generation: 3, invalidation_generation: 7, kind: "complete" });
    covered = false;
    expect(() => validator.commit({ receipt, transition: { repo_root: "/repo", snapshot_id: "701", controller_generation: 3, invalidation_generation: 7, from: "building", to: "published", updated_at: clock.nowIso8601() } })).toThrow("watcher_changed_before_publication_commit");
    expect(invalidated).toBe(false);
  });

  it("issues distinct receipts for seed and final publication", async () => {
    const sealed = manifest();
    let sequence = 0;
    const watcher = { start: async () => observation(), registerDirectory: async () => observation(), observe: () => observation(), drain: async () => observation(), close: async () => {} };
    const store = { getGraphBuildManifest: async () => sealed, invalidateGraphBuildManifest: async () => {}, publishValidatedGraphBuild: () => ({}) };
    const validator = new GraphBuildManifestPublicationValidator({ store: async () => store as never, watcher, read_identity: async expected => expected, clock, create_receipt_id: () => `receipt-${++sequence}` });
    const seed = await validator.prepare({ repo_root: "/repo", execution_id: "execution-1", target_snapshot_id: "701", controller_generation: 3, invalidation_generation: 7, kind: "seed" });
    const complete = await validator.prepare({ repo_root: "/repo", execution_id: "execution-1", target_snapshot_id: "702", controller_generation: 3, invalidation_generation: 7, kind: "complete" });
    expect(seed.receipt_id).not.toBe(complete.receipt_id);
    expect(seed.kind).toBe("seed");
    expect(complete.kind).toBe("complete");
  });

  it("invalidates the exact owner manifest when an identity changes after capture", async () => {
    const sealed = manifest();
    let invalidated: { manifest_id: string; owner_id: string } | undefined;
    const watcher = { start: async () => observation(), registerDirectory: async () => observation(), observe: () => observation(), drain: async () => observation(), close: async () => {} };
    const store = { getGraphBuildManifest: async () => sealed, invalidateGraphBuildManifest: async (input: { manifest_id: string; owner_id: string }) => { invalidated = input; }, publishValidatedGraphBuild: () => ({}) };
    const validator = new GraphBuildManifestPublicationValidator({ store: async () => store as never, watcher,
      read_identity: async expected => ({ ...expected, inode: "changed" }), clock });
    await expect(validator.prepare({ repo_root: "/repo", execution_id: "execution-1", target_snapshot_id: "701", controller_generation: 3, invalidation_generation: 7, kind: "complete" })).rejects.toThrow("identity_changed");
    expect(invalidated).toMatchObject({ manifest_id: "manifest-1", owner_id: "execution-1" });
  });

  it("rejects an event observed after every identity read and before forced drain completes", async () => {
    const sealed = manifest();
    let invalidated = false;
    const watcher = { start: async () => observation(), registerDirectory: async () => observation(), observe: () => observation(), drain: async () => ({ ...observation(), sequence: 1 }), close: async () => {} };
    const store = { getGraphBuildManifest: async () => sealed, invalidateGraphBuildManifest: async () => { invalidated = true; }, publishValidatedGraphBuild: () => ({}) };
    const validator = new GraphBuildManifestPublicationValidator({ store: async () => store as never, watcher, read_identity: async expected => expected, clock });
    await expect(validator.prepare({ repo_root: "/repo", execution_id: "execution-1", target_snapshot_id: "701", controller_generation: 3, invalidation_generation: 7, kind: "complete" })).rejects.toThrow("watcher_sequence_changed");
    expect(invalidated).toBe(true);
  });

  it.each([
    ["unhealthy watcher", { ...observation(), healthy: false }],
    ["queued watcher event", { ...observation(), pending_events: 1 }],
    ["changed watcher epoch", { ...observation(), epoch: "unavailable" }],
    ["changed watcher sequence", { ...observation(), sequence: 1 }]
  ])("rejects %s before identity validation", async (_name, invalidObservation) => {
    const sealed = manifest();
    let invalidated = false;
    const watcher = { start: async () => invalidObservation, registerDirectory: async () => invalidObservation, observe: () => invalidObservation, drain: async () => invalidObservation, close: async () => {} };
    const store = { getGraphBuildManifest: async () => sealed, invalidateGraphBuildManifest: async () => { invalidated = true; }, publishValidatedGraphBuild: () => ({}) };
    const validator = new GraphBuildManifestPublicationValidator({ store: async () => store as never, watcher, read_identity: async expected => expected, clock });
    await expect(validator.prepare({ repo_root: "/repo", execution_id: "execution-1", target_snapshot_id: "701", controller_generation: 3, invalidation_generation: 7, kind: "complete" })).rejects.toThrow("watcher_");
    expect(invalidated).toBe(true);
  });

  it("drains through a generation request outside controller mutation authority", async () => {
    let controller: SnapshotRefreshController;
    let runs = 0;
    let secondStartedResolve!: () => void;
    const secondStarted = new Promise<void>(resolve => { secondStartedResolve = resolve; });
    const executor: RefreshExecutorPort = {
      async run(input) {
        runs += 1;
        if (runs === 1) return { exit_code: 0, results: [{ outcome: "complete", execution_id: input.execution_id, target_snapshot_id: input.target_snapshot_id, completed_generation: input.generation }] };
        secondStartedResolve();
        return await new Promise(() => undefined);
      },
      async terminate() {}
    };
    const transitions: string[] = [];
    const publication: SnapshotPublicationPort = {
      async allocateBuildSnapshotId() { return String(700 + runs); },
      async transitionBuild(input) { transitions.push(`${input.snapshot_id}:${input.to}`); return { ...input, state: input.to }; },
      async getLatestPublished() { return { status: "missing", reason: "no_published_snapshot" }; },
      async readExplicit(input) { return { status: "missing", snapshot_id: input.snapshot_id, reason: "snapshot_not_found" }; }
    };
    let prepared = false;
    const validation = {
      async prepare() {
        prepared = true;
        await controller.request({ repo_root: "/repo", reason: "watcher_invalidation", source: "watcher_invalidation", invalidation_generation: 8 });
        throw new GraphBuildValidationError("watcher_sequence_changed_during_validation");
      },
      commit() { throw new Error("obsolete pass must not publish"); }
    };
    controller = new SnapshotRefreshController({ repo_root: "/repo", controller_generation: 3, timeout_ms: 30_000, clock, executor, publication, validation });
    await controller.request({ repo_root: "/repo", reason: "startup", source: "test", invalidation_generation: 7 });
    await secondStarted;
    expect(prepared).toBe(true);
    expect(transitions).toEqual(["700:superseded"]);
    expect(controller.getReceipt()).toMatchObject({ execution_state: "running", requested_generation: 8, started_generation: 8, last_failure: undefined });
    await controller.shutdown();
  });
});
