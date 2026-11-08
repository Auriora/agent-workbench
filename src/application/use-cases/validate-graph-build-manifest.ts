/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import crypto from "node:crypto";
import type {
  ClockPort,
  GraphBuildAtomicPublicationPort,
  GraphBuildManifest,
  GraphBuildManifestPort,
  GraphBuildPathIdentity,
  GraphBuildPublicationRequest,
  GraphBuildPublicationValidationPort,
  GraphBuildValidationReceipt,
  GraphBuildWatchObservation,
  GraphBuildWatchPort,
  SnapshotPublicationRecord,
  SnapshotPublicationTransition
} from "../../ports/index.js";
import { GraphBuildValidationError } from "../../ports/index.js";

type ManifestStore = GraphBuildManifestPort & GraphBuildAtomicPublicationPort;
type IssuedReceipt = { receipt: GraphBuildValidationReceipt; store: ManifestStore; covered_directories: readonly string[]; consumed: boolean };

export type GraphBuildManifestPublicationValidatorOptions = {
  /** Resolves at use time so a profiling harness can reopen its isolated store. */
  store: () => Promise<ManifestStore>;
  watcher: GraphBuildWatchPort;
  /** Reads one recorded identity only; it must not enumerate a directory. */
  read_identity: (expected: GraphBuildPathIdentity) => Promise<GraphBuildPathIdentity>;
  clock: ClockPort;
  create_receipt_id?: () => string;
  /** Synchronous, non-throwing session bookkeeping after the receipt commits. */
  on_published?: (input: { directories: readonly string[] }) => void;
};

/** Turns a sealed discovery inventory into a one-use publication receipt. */
export class GraphBuildManifestPublicationValidator implements GraphBuildPublicationValidationPort {
  private readonly issued = new Map<string, IssuedReceipt>();
  private readonly createReceiptId: () => string;

  constructor(private readonly options: GraphBuildManifestPublicationValidatorOptions) {
    this.createReceiptId = options.create_receipt_id ?? (() => `manifest-receipt-${crypto.randomUUID()}`);
  }

  public async prepare(request: GraphBuildPublicationRequest): Promise<GraphBuildValidationReceipt> {
    const store = await this.options.store();
    const startedAt = this.options.clock.nowUnixMs();
    let manifest: GraphBuildManifest | undefined;
    try {
      const fetched = await store.getGraphBuildManifest({ snapshot_id: request.target_snapshot_id });
      if (fetched === null || fetched.state !== "sealed") this.reject("sealed_manifest_unavailable");
      manifest = fetched;
      this.assertManifestTarget(fetched, request);
      const start = this.requireCleanObservation(fetched, this.options.watcher.observe(), "before_identity_validation");
      let checkedFiles = 0;
      let checkedDirectories = 0;
      let checkedInputs = 0;
      for (const file of fetched.files) { await this.assertIdentity(file.identity, "file"); checkedFiles += 1; }
      for (const directory of fetched.directories) { await this.assertIdentity(directory.identity, "directory"); checkedDirectories += 1; }
      for (const input of fetched.inputs) { await this.assertIdentity(input, "input"); checkedInputs += 1; }
      // The coordinator admits raw events before this returns, outside mutation authority.
      const end = this.requireCleanObservation(fetched, await this.options.watcher.drain(), "after_watcher_drain");
      if (end.sequence !== start.sequence) this.reject("watcher_sequence_changed_during_validation");
      const receipt: GraphBuildValidationReceipt = Object.freeze({
        ...request, receipt_id: this.createReceiptId(), manifest_id: fetched.manifest_id, manifest_digest: fetched.digest,
        watcher_epoch: fetched.watcher_epoch, start_sequence: start.sequence, end_sequence: end.sequence,
        checked_files: checkedFiles, checked_directories: checkedDirectories, checked_inputs: checkedInputs,
        validation_wall_ms: Math.max(0, this.options.clock.nowUnixMs() - startedAt), observed_at: this.options.clock.nowIso8601(),
        policy_version: "manifest-identities-v1"
      });
      this.issued.clear();
      if (this.issued.has(receipt.receipt_id)) this.reject("duplicate_receipt_id");
      this.issued.set(receipt.receipt_id, { receipt, store, covered_directories: fetched.directories.map(directory => normalizePath(directory.identity.path)), consumed: false });
      return receipt;
    } catch (error) {
      if (manifest !== undefined && manifest.state === "sealed") {
        try {
          await store.invalidateGraphBuildManifest({ manifest_id: manifest.manifest_id, owner_id: request.execution_id,
            reason: validationReason(error), updated_at: this.options.clock.nowIso8601() });
        } catch { /* Original evidence failure remains actionable. */ }
      }
      if (error instanceof GraphBuildValidationError) throw error;
      throw new GraphBuildValidationError("manifest_validation_operation_failed", { cause: error });
    }
  }

  public commit(input: { receipt: GraphBuildValidationReceipt; transition: SnapshotPublicationTransition & { to: "published" } }): SnapshotPublicationRecord & { state: "published" } {
    const issued = this.issued.get(input.receipt.receipt_id);
    if (issued === undefined || issued.consumed || issued.receipt !== input.receipt) {
      throw new GraphBuildValidationError("receipt_is_not_issued_or_is_already_consumed");
    }
    if (!samePublicationTarget(issued.receipt, input.transition)) throw new GraphBuildValidationError("publication_transition_does_not_match_receipt");
    issued.consumed = true;
    try {
      const published = issued.store.publishValidatedGraphBuild({ receipt: issued.receipt, transition: input.transition, assert_observation: () => {
        const observation = this.options.watcher.observe();
        const covered = new Set(observation.covered_directories.map(normalizePath));
        if (!observation.healthy || observation.epoch !== issued.receipt.watcher_epoch || observation.sequence !== issued.receipt.end_sequence || observation.pending_events !== 0 || issued.covered_directories.some(directory => !covered.has(directory))) {
          throw new GraphBuildValidationError("watcher_changed_before_publication_commit");
        }
      } });
      this.options.on_published?.({ directories: issued.covered_directories });
      return published;
    } catch (error) {
      if (error instanceof GraphBuildValidationError) throw error;
      throw new GraphBuildValidationError("atomic_publication_failed", { cause: error });
    } finally { this.issued.delete(input.receipt.receipt_id); }
  }

  private assertManifestTarget(manifest: GraphBuildManifest, request: GraphBuildPublicationRequest): void {
    if (manifest.repo_root !== request.repo_root || manifest.owner_id !== request.execution_id || manifest.controller_generation !== request.controller_generation || manifest.invalidation_generation !== request.invalidation_generation) this.reject("manifest_fence_does_not_match_publication_target");
  }

  private requireCleanObservation(manifest: GraphBuildManifest, observation: GraphBuildWatchObservation, phase: string): GraphBuildWatchObservation {
    if (!observation.healthy) this.reject(`${phase}:watcher_unhealthy`);
    if (observation.epoch !== manifest.watcher_epoch) this.reject(`${phase}:watcher_epoch_changed`);
    if (observation.sequence !== manifest.watcher_sequence) this.reject(`${phase}:watcher_sequence_changed`);
    if (observation.pending_events !== 0) this.reject(`${phase}:watcher_events_pending`);
    const covered = new Set(observation.covered_directories.map(normalizePath));
    for (const directory of manifest.directories) if (!covered.has(normalizePath(directory.identity.path))) this.reject(`${phase}:directory_not_covered:${directory.identity.path}`);
    return observation;
  }

  private async assertIdentity(expected: GraphBuildPathIdentity, kind: string): Promise<void> {
    const actual = await this.options.read_identity(expected);
    if (!sameIdentity(expected, actual)) this.reject(`${kind}_identity_changed:${expected.path}`);
  }

  private reject(reason: string): never { throw new GraphBuildValidationError(reason); }
}

function samePublicationTarget(receipt: GraphBuildValidationReceipt, transition: SnapshotPublicationTransition): boolean {
  return transition.repo_root === receipt.repo_root && transition.snapshot_id === receipt.target_snapshot_id && transition.controller_generation === receipt.controller_generation && transition.invalidation_generation === receipt.invalidation_generation && transition.to === "published";
}
function sameIdentity(left: GraphBuildPathIdentity, right: GraphBuildPathIdentity): boolean {
  return left.path === right.path && left.scope === right.scope && left.root === right.root && left.kind === right.kind && left.device === right.device && left.inode === right.inode && left.size_bytes === right.size_bytes && left.mtime_ns === right.mtime_ns && left.ctime_ns === right.ctime_ns;
}
function normalizePath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/\/$/, "");
  return normalized === "." ? "" : normalized;
}
function validationReason(error: unknown): string { return error instanceof GraphBuildValidationError ? error.reason : "manifest_validation_operation_failed"; }
