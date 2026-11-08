/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  GraphBuildManifestPort,
  GraphBuildPathIdentity,
  GraphBuildWatchQueuePort,
  SnapshotPublicationPort
} from "../../ports/index.js";

type CoverageStore = Pick<GraphBuildManifestPort, "getGraphBuildManifest"> & Pick<SnapshotPublicationPort, "getLatestPublished">;

export type GraphBuildWatchCoverageRestoreResult =
  | { state: "established"; snapshot_id: string; directories: readonly string[] }
  | { state: "coverage_not_established"; reason: string };

/**
 * Rehydrates a published sealed inventory without discovery.  It reads only
 * recorded identities, then arms exactly those directories after the complete
 * pre-arm validation succeeds.  A stale inventory never changes watch health.
 */
export async function restoreGraphBuildWatchCoverage(input: {
  repo_root: string;
  store: () => Promise<CoverageStore>;
  watcher: GraphBuildWatchQueuePort;
  read_identity: (expected: GraphBuildPathIdentity) => Promise<GraphBuildPathIdentity>;
}): Promise<GraphBuildWatchCoverageRestoreResult> {
  const store = await input.store();
  const selected = await store.getLatestPublished({ repo_root: input.repo_root });
  if (selected.status !== "selected") return unavailable("published_snapshot_unavailable");
  const manifest = await store.getGraphBuildManifest({ snapshot_id: selected.snapshot.id });
  if (manifest === null || manifest.state !== "sealed") return unavailable("sealed_manifest_unavailable");
  const directories = manifest.directories;
  if (directories.length === 0 || directories.some(directory => !directory.registered)) {
    return unavailable("sealed_directory_coverage_unavailable");
  }

  const started = await input.watcher.start();
  if (!isClean(started)) return unavailable("watcher_not_clean_before_coverage_restore");
  if (!await identitiesMatch(directories.map(directory => directory.identity), input.read_identity)) {
    return unavailable("persisted_directory_identity_changed_before_arming");
  }
  if (!await identitiesMatch(manifest.inputs, input.read_identity)) {
    return unavailable("persisted_input_identity_changed_before_arming");
  }

  for (const directory of directories) {
    let observation;
    try {
      observation = await input.watcher.registerDirectory({
        path: directory.identity.path,
        repository_key: directory.repository_key
      });
    } catch {
      return unavailable("persisted_directory_cannot_be_armed");
    }
    if (!isFenced(observation, started)) return unavailable("watcher_changed_during_coverage_arming");
  }

  if (!await identitiesMatch(directories.map(directory => directory.identity), input.read_identity)) {
    return unavailable("persisted_directory_identity_changed_after_arming");
  }
  if (!await identitiesMatch(manifest.inputs, input.read_identity)) {
    return unavailable("persisted_input_identity_changed_after_arming");
  }
  const complete = input.watcher.observe();
  const required = new Set(directories.map(directory => normalizePath(directory.identity.path)));
  const covered = new Set(complete.covered_directories.map(normalizePath));
  if (!isFenced(complete, started) || [...required].some(directory => !covered.has(directory))) {
    return unavailable("watcher_coverage_not_complete");
  }
  input.watcher.establishCoverage({ directories: [...required] });
  return { state: "established", snapshot_id: selected.snapshot.id, directories: [...required] };
}

async function identitiesMatch(
  expected: readonly GraphBuildPathIdentity[],
  readIdentity: (expected: GraphBuildPathIdentity) => Promise<GraphBuildPathIdentity>
): Promise<boolean> {
  try {
    for (const identity of expected) {
      if (!sameIdentity(identity, await readIdentity(identity))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isClean(observation: { healthy: boolean; pending_events: number }): boolean {
  return observation.healthy && observation.pending_events === 0;
}

function isFenced(
  observation: { epoch: string; sequence: number; healthy: boolean; pending_events: number },
  start: { epoch: string; sequence: number }
): boolean {
  return isClean(observation) && observation.epoch === start.epoch && observation.sequence === start.sequence;
}

function sameIdentity(left: GraphBuildPathIdentity, right: GraphBuildPathIdentity): boolean {
  return left.path === right.path && left.scope === right.scope && left.root === right.root && left.kind === right.kind &&
    left.device === right.device && left.inode === right.inode && left.size_bytes === right.size_bytes &&
    left.mtime_ns === right.mtime_ns && left.ctime_ns === right.ctime_ns;
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/\/+$/, "") || ".";
}

function unavailable(reason: string): GraphBuildWatchCoverageRestoreResult {
  return { state: "coverage_not_established", reason };
}
