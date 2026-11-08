/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { restoreGraphBuildWatchCoverage } from "../../src/infrastructure/runtime/restore-graph-build-watch-coverage.js";
import type {
  GraphBuildManifest,
  GraphBuildPathIdentity,
  GraphBuildWatchObservation,
  GraphBuildWatchQueuePort
} from "../../src/ports/index.js";

describe("graph build watch coverage restoration", () => {
  it("arms all sealed nested directories without a discovery enumeration", async () => {
    const watcher = new RecordingWatcher();
    const readdir = vi.spyOn(fs, "readdirSync");
    try {
      const result = await restoreGraphBuildWatchCoverage({
        repo_root: "/repo",
        store: async () => storeFor(manifest()),
        watcher,
        read_identity: async identity => identity
      });

      expect(result).toMatchObject({ state: "established", directories: [".", "src", "src/nested"] });
      expect(watcher.registered).toEqual([
        { path: ".", repository_key: "superproject" },
        { path: "src", repository_key: "superproject" },
        { path: "src/nested", repository_key: "superproject" }
      ]);
      expect(watcher.coverageEstablished()).toBe(true);
      expect(readdir).not.toHaveBeenCalled();
    } finally {
      readdir.mockRestore();
    }
  });

  it("leaves a healthy watcher without coverage when a persisted directory changed", async () => {
    const watcher = new RecordingWatcher();
    const result = await restoreGraphBuildWatchCoverage({
      repo_root: "/repo",
      store: async () => storeFor(manifest()),
      watcher,
      read_identity: async identity => identity.path === "src" ? { ...identity, inode: "different" } : identity
    });

    expect(result).toEqual({ state: "coverage_not_established", reason: "persisted_directory_identity_changed_before_arming" });
    expect(watcher.observe().healthy).toBe(true);
    expect(watcher.coverageEstablished()).toBe(false);
    expect(watcher.registered).toEqual([]);
  });

  it("leaves a healthy watcher without coverage when a persisted policy input changed", async () => {
    const watcher = new RecordingWatcher();
    const policyInput: GraphBuildPathIdentity = {
      path: ".gitignore", kind: "file", device: "1", inode: "policy", size_bytes: "8", mtime_ns: "1", ctime_ns: "1"
    };
    const result = await restoreGraphBuildWatchCoverage({
      repo_root: "/repo",
      store: async () => storeFor({ ...manifest(), inputs: [policyInput] }),
      watcher,
      read_identity: async identity => identity.path === ".gitignore" ? { ...identity, mtime_ns: "2" } : identity
    });

    expect(result).toEqual({ state: "coverage_not_established", reason: "persisted_input_identity_changed_before_arming" });
    expect(watcher.observe().healthy).toBe(true);
    expect(watcher.coverageEstablished()).toBe(false);
    expect(watcher.registered).toEqual([]);
  });

  it("rejects sequence drift while arming without poisoning watcher health", async () => {
    const watcher = new RecordingWatcher({ sequenceDriftOnRegister: true });
    const result = await restoreGraphBuildWatchCoverage({
      repo_root: "/repo", store: async () => storeFor(manifest()), watcher, read_identity: async identity => identity
    });

    expect(result).toEqual({ state: "coverage_not_established", reason: "watcher_changed_during_coverage_arming" });
    expect(watcher.observe().healthy).toBe(true);
    expect(watcher.coverageEstablished()).toBe(false);
  });

  it("rejects epoch drift while arming without fabricating fresh coverage", async () => {
    const watcher = new RecordingWatcher({ epochDriftOnRegister: true });
    const result = await restoreGraphBuildWatchCoverage({
      repo_root: "/repo", store: async () => storeFor(manifest()), watcher, read_identity: async identity => identity
    });

    expect(result).toEqual({ state: "coverage_not_established", reason: "watcher_changed_during_coverage_arming" });
    expect(watcher.observe().healthy).toBe(true);
    expect(watcher.coverageEstablished()).toBe(false);
  });
});

class RecordingWatcher implements GraphBuildWatchQueuePort {
  public readonly registered: Array<{ path: string; repository_key?: string }> = [];
  private epoch = "epoch-1";
  private sequence = 0;
  private covered = new Set<string>(["."]);
  private established = false;

  constructor(private readonly drift: { sequenceDriftOnRegister?: boolean; epochDriftOnRegister?: boolean } = {}) {}

  public async start(): Promise<GraphBuildWatchObservation> { return this.observe(); }
  public async registerDirectory(input: { path: string; repository_key?: string }): Promise<GraphBuildWatchObservation> {
    this.registered.push(input);
    this.covered.add(input.path);
    if (this.drift.sequenceDriftOnRegister) this.sequence += 1;
    if (this.drift.epochDriftOnRegister) this.epoch = "epoch-2";
    return this.observe();
  }
  public observe(): GraphBuildWatchObservation {
    return { epoch: this.epoch, sequence: this.sequence, healthy: true, pending_events: 0, covered_directories: [...this.covered] };
  }
  public async drain(): Promise<GraphBuildWatchObservation> { return this.observe(); }
  public async close(): Promise<void> {}
  public async pollEvents(): Promise<readonly []> { return []; }
  public bindDrain(): void {}
  public coverageEstablished(): boolean { return this.established; }
  public establishCoverage(): void { this.established = true; }
}

function storeFor(value: GraphBuildManifest) {
  return {
    async getLatestPublished() {
      return { status: "selected" as const, snapshot: { id: "snapshot-1" }, publication: { state: "published" as const } };
    },
    async getGraphBuildManifest() { return value; }
  } as any;
}

function manifest(): GraphBuildManifest {
  const identity = (path: string): GraphBuildPathIdentity => ({
    path, kind: "directory", device: "1", inode: path, size_bytes: "0", mtime_ns: "1", ctime_ns: "1"
  });
  return {
    manifest_id: "manifest-1", state: "sealed", digest: "digest", started_at: "2026-01-01T00:00:00.000Z",
    repo_root: "/repo", config_identity: "default", owner_id: "execution-1", controller_generation: 1,
    invalidation_generation: 0, generation_source_hash: "source", watcher_epoch: "old-epoch", watcher_sequence: 0,
    policy_version: "manifest-identities-v1", ordering_version: "catalog-v1", composition_fingerprint: "composition",
    files: [], inputs: [], graph_catalog: {} as any, docs_catalog: {} as any, shape: {} as any, preparation_wall_ms: 0,
    directories: [".", "src", "src/nested"].map(path => ({
      identity: identity(path), repository_key: "superproject", watcher_epoch: "old-epoch", watcher_sequence: 0, registered: true
    }))
  };
}
