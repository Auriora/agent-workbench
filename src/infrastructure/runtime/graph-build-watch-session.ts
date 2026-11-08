/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import type { WorkspaceWatchHandle, WorkspaceWatchRequest } from "../../domain/models/index.js";
import type { GraphBuildWatchObservation, GraphBuildWatchQueuePort } from "../../ports/index.js";
import { GraphBuildValidationError } from "../../ports/index.js";
import { FilesystemWorkspaceWatcherAdapter } from "../filesystem/workspace-watcher.js";

/** A daemon owns this single session across sequential worker isolates. */
export class GraphBuildWatchSession implements GraphBuildWatchQueuePort {
  private handle: WorkspaceWatchHandle | undefined;
  private initialization: Promise<GraphBuildWatchObservation> | undefined;
  private closed = false;
  private coverage = false;
  private drainQueue: (() => Promise<void>) | undefined;
  private observeQueue: (() => { pending_events: number; healthy: boolean }) | undefined;

  constructor(private readonly input: WorkspaceWatchRequest,
    private readonly watcher = new FilesystemWorkspaceWatcherAdapter()) {}

  async start(): Promise<GraphBuildWatchObservation> {
    if (this.closed) throw new GraphBuildValidationError("watch_session_closed");
    this.initialization ??= this.watcher.start(this.input).then(handle => {
      this.handle = handle;
      return this.observe();
    });
    await this.initialization;
    return this.observe();
  }

  async registerDirectory(input: { path: string; repository_key?: string }): Promise<GraphBuildWatchObservation> {
    await this.start();
    await this.watcher.registerDirectory({ watch_id: this.handle!.id, ...input });
    return this.observe();
  }

  observe(): GraphBuildWatchObservation {
    if (this.closed || this.handle === undefined) {
      return { epoch: "unavailable", sequence: 0, healthy: false, pending_events: 0, covered_directories: [] };
    }
    const observed = this.watcher.observe({ watch_id: this.handle.id });
    const queued = this.observeQueue?.();
    return { ...observed, healthy: observed.healthy && (queued?.healthy ?? true),
      pending_events: observed.pending_events + (queued?.pending_events ?? 0) };
  }

  bindDrain(drain: () => Promise<void>, observeQueue: () => { pending_events: number; healthy: boolean }): void {
    if (this.drainQueue !== undefined) throw new GraphBuildValidationError("watch_queue_already_bound");
    this.drainQueue = drain;
    this.observeQueue = observeQueue;
  }

  public coverageEstablished(): boolean {
    return this.coverage;
  }

  /** Called only after atomic publication or complete restored coverage proof. */
  public establishCoverage(input: { directories: readonly string[] }): void {
    this.coverage = input.directories.length > 0;
  }

  async pollEvents(input: { force?: boolean; max_events?: number } = {}) {
    await this.start();
    return input.force === true
      ? this.watcher.drainObservedEvents({ watch_id: this.handle!.id })
      : await this.watcher.poll({ watch_id: this.handle!.id, max_events: input.max_events });
  }

  async drain(): Promise<GraphBuildWatchObservation> {
    if (this.drainQueue === undefined) throw new GraphBuildValidationError("watch_queue_unavailable");
    await this.drainQueue();
    return this.observe();
  }

  async close(): Promise<void> {
    this.closed = true;
    this.coverage = false;
    await this.initialization?.catch(() => undefined);
    if (this.handle !== undefined) await this.watcher.stop({ watch_id: this.handle.id });
  }
}
