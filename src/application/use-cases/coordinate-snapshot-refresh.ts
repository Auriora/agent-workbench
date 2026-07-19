/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ClockPort, SnapshotPort, WarmupCoordinatorPort } from "../../ports/index.js";

export type SnapshotRefreshCoordinationResult = {
  snapshot_id: string;
  execution_id: string;
  reused_active_warmup: boolean;
};

export async function coordinateSnapshotRefresh(input: {
  repo_root: string;
  snapshots: SnapshotPort;
  warmups: WarmupCoordinatorPort;
  clock: ClockPort;
  reason: string;
}): Promise<SnapshotRefreshCoordinationResult> {
  const currentSnapshot = await input.snapshots.getSnapshot({ repo_root: input.repo_root });
  const currentNumericId = currentSnapshot !== null && /^\d+$/u.test(currentSnapshot.id)
    ? Number.parseInt(currentSnapshot.id, 10)
    : undefined;
  const snapshotId = String(Math.max(
    input.clock.nowUnixMs(),
    currentNumericId === undefined ? 0 : currentNumericId + 1
  ));
  if (currentSnapshot !== null && currentSnapshot.freshness !== "stale") {
    await input.snapshots.markSnapshotFreshness({
      snapshot_id: currentSnapshot.id,
      freshness: "stale",
      reason: input.reason
    });
  }
  const activeWarmup = await input.warmups.getState({ repo_root: input.repo_root });
  if (activeWarmup?.state === "planned" || activeWarmup?.state === "running") {
    return {
      snapshot_id: activeWarmup.snapshot_id,
      execution_id: activeWarmup.execution_id,
      reused_active_warmup: true
    };
  }
  return {
    snapshot_id: snapshotId,
    execution_id: await input.warmups.requestWarmup({
      repo_root: input.repo_root,
      snapshot_id: snapshotId
    }),
    reused_active_warmup: false
  };
}
