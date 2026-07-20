/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  SnapshotPublicationPort,
  SnapshotRefreshAdmissionFailurePort,
  SnapshotRefreshAdmission,
  SnapshotRefreshControllerPort,
  SnapshotRefreshPort,
  SnapshotPort
} from "../../ports/index.js";

export interface RepositoryRefreshTriggerPort {
  startup(input: { source: string }): Promise<SnapshotRefreshAdmission>;
  staleFirstRead(input: {
    source: string;
    visible_snapshot_id: string;
  }): Promise<SnapshotRefreshAdmission>;
  watcherBatch(input: { source: string; batch_identity: string }): Promise<SnapshotRefreshAdmission>;
  hasPendingGeneration(): Promise<boolean>;
  getGenerationReceipt(): {
    generation: number;
    dirty_generation?: number;
    dirty_visible_snapshot_id?: string;
  };
}

/** Serializes repository trigger admission and owns dirty-generation identity. */
export class RepositoryRefreshTriggerCoordinator implements RepositoryRefreshTriggerPort {
  private generation = 0;
  private seeded = false;
  private dirty: { generation: number; visible_snapshot_id?: string } | undefined;
  private lastWatcherBatch: {
    identity: string;
    admission: SnapshotRefreshAdmission;
  } | undefined;
  private mutationTail: Promise<void> = Promise.resolve();

  public constructor(private readonly options: {
    repo_root: string;
    controller: SnapshotRefreshPort &
      Partial<Pick<SnapshotRefreshControllerPort, "getReceipt">> &
      Partial<SnapshotRefreshAdmissionFailurePort>;
    publications: SnapshotPublicationPort;
    snapshots: Pick<SnapshotPort, "markSnapshotFreshness">;
  }) {}

  public async startup(input: { source: string }): Promise<SnapshotRefreshAdmission> {
    return await this.withMutation(async () => {
      try {
        await this.seed();
        const visible = await this.options.publications.getLatestPublished({
          repo_root: this.options.repo_root
        });
        if (visible.status === "selected" && visible.snapshot.freshness !== "stale") {
          await this.options.snapshots.markSnapshotFreshness({
            snapshot_id: visible.snapshot.id,
            freshness: "stale",
            reason: "startup_refresh_requested"
          });
        }
      } catch {
        if (this.options.controller.recordAdmissionFailure === undefined) throw new Error(
          "Refresh admission failure authority is unavailable."
        );
        return await this.options.controller.recordAdmissionFailure({
          repo_root: this.options.repo_root,
          invalidation_generation: this.generation,
          code: "store_failure"
        });
      }
      return await this.options.controller.request({
        repo_root: this.options.repo_root,
        reason: "startup",
        source: input.source,
        invalidation_generation: this.generation
      });
    });
  }

  public async staleFirstRead(input: {
    source: string;
    visible_snapshot_id: string;
  }): Promise<SnapshotRefreshAdmission> {
    return await this.withMutation(async () => {
      await this.seed();
      await this.clearCoveredDirty(input.visible_snapshot_id);
      if (this.dirty !== undefined && this.dirty.visible_snapshot_id === undefined) {
        this.dirty.visible_snapshot_id = input.visible_snapshot_id;
      } else if (this.dirty?.visible_snapshot_id !== input.visible_snapshot_id) {
        this.generation += 1;
        this.dirty = {
          generation: this.generation,
          visible_snapshot_id: input.visible_snapshot_id
        };
      }
      return await this.options.controller.request({
        repo_root: this.options.repo_root,
        reason: "stale_first_read",
        source: input.source,
        invalidation_generation: this.dirty.generation
      });
    });
  }

  public async watcherBatch(input: {
    source: string;
    batch_identity: string;
  }): Promise<SnapshotRefreshAdmission> {
    return await this.withMutation(async () => {
      await this.seed();
      if (this.lastWatcherBatch?.identity === input.batch_identity) {
        return this.lastWatcherBatch.admission;
      }
      const visible = await this.options.publications.getLatestPublished({
        repo_root: this.options.repo_root
      });
      if (visible.status === "selected" && visible.snapshot.freshness !== "stale") {
        await this.options.snapshots.markSnapshotFreshness({
          snapshot_id: visible.snapshot.id,
          freshness: "stale",
          reason: input.source
        });
      }
      this.generation += 1;
      this.dirty = { generation: this.generation };
      const admission = await this.options.controller.request({
        repo_root: this.options.repo_root,
        reason: "watcher_invalidation",
        source: input.source,
        invalidation_generation: this.generation
      });
      this.lastWatcherBatch = { identity: input.batch_identity, admission };
      return admission;
    });
  }

  public getGenerationReceipt() {
    return {
      generation: this.generation,
      dirty_generation: this.dirty?.generation,
      dirty_visible_snapshot_id: this.dirty?.visible_snapshot_id
    };
  }

  public async hasPendingGeneration(): Promise<boolean> {
    return await this.withMutation(async () => {
      await this.seed();
      await this.clearCoveredDirty();
      return this.dirty !== undefined;
    });
  }

  private async seed(): Promise<void> {
    if (this.seeded) return;
    const controllerGeneration = this.options.controller.getReceipt?.().requested_generation ?? 0;
    const published = await this.options.publications.getLatestPublished({
      repo_root: this.options.repo_root
    });
    const publishedGeneration = published.status === "selected"
      ? published.publication.invalidation_generation
      : 0;
    this.generation = Math.max(controllerGeneration, publishedGeneration);
    this.seeded = true;
  }

  private async clearCoveredDirty(visibleSnapshotId?: string): Promise<void> {
    if (this.dirty === undefined) return;
    const receipt = this.options.controller.getReceipt?.();
    if (
      receipt !== undefined &&
      (receipt.execution_state !== "complete" || receipt.started_generation < this.dirty.generation)
    ) return;
    const published = await this.options.publications.getLatestPublished({
      repo_root: this.options.repo_root
    });
    if (
      published.status === "selected" &&
      published.publication.invalidation_generation >= this.dirty.generation &&
      (visibleSnapshotId === undefined || published.snapshot.id === visibleSnapshotId)
    ) {
      this.dirty = undefined;
      this.generation = Math.max(this.generation, published.publication.invalidation_generation);
    }
  }

  private async withMutation<T>(operation: () => Promise<T>): Promise<T> {
    const prior = this.mutationTail;
    let release!: () => void;
    this.mutationTail = new Promise<void>((resolve) => { release = resolve; });
    await prior;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}
