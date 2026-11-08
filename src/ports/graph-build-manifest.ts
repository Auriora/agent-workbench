/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import type { EvidenceCoverageState } from "../contracts/index.js";
import type { ExtractionBatch, FileCatalogEntry, WorkspaceFileEvent } from "../domain/models/index.js";
import type { FileCatalogScanResult, GraphBuildProgress, SnapshotPublicationRecord, SnapshotPublicationTransition } from "./index.js";

/** Private build evidence; physical identity integers are lossless decimal strings. */
export type GraphBuildPathIdentity = {
  path: string;
  /** Only explicitly captured Git storage may have a separate canonical root. */
  scope?: "git";
  root?: string;
  kind: "file" | "directory" | "missing";
  device: string; inode: string; size_bytes: string; mtime_ns: string; ctime_ns: string;
};
export type GraphBuildWatchObservation = {
  epoch: string; sequence: number; healthy: boolean; pending_events: number;
  covered_directories: readonly string[];
};
export type GraphBuildDirectoryObservation = {
  identity: GraphBuildPathIdentity;
  repository_key: string;
  watcher_epoch: string;
  watcher_sequence: number;
  registered: boolean;
};
export type GraphBuildManifestFile = {
  ordinal: number;
  repository_key: string;
  entry: FileCatalogEntry;
  identity: GraphBuildPathIdentity;
  docs_eligible: boolean;
  outcome: "pending" | "extracted" | "resource" | "unsupported";
};
export type GraphBuildManifestFence = {
  repo_root: string; config_identity: string; owner_id: string;
  controller_generation: number; invalidation_generation: number;
  generation_source_hash: string; watcher_epoch: string;
  watcher_sequence: number;
  policy_version: string; ordering_version: string; composition_fingerprint: string;
};
export type GraphBuildProjectShape = {
  rails_roots: readonly string[]; route_file_paths: readonly string[];
  config_file_paths: readonly string[]; test_file_paths: readonly string[];
  role_file_paths: readonly string[]; role_roots: readonly string[];
  provenance: "catalog_scan"; evidence_coverage_state: EvidenceCoverageState;
  evidence_caveats: readonly string[];
};
export type GraphBuildCatalogMetadata = Omit<FileCatalogScanResult, "files">;
export type GraphBuildManifest = GraphBuildManifestFence & {
  manifest_id: string; state: "preparing" | "sealed" | "invalid";
  digest: string; started_at: string; sealed_at?: string; invalid_reason?: string;
  files: readonly GraphBuildManifestFile[];
  directories: readonly GraphBuildDirectoryObservation[];
  inputs: readonly GraphBuildPathIdentity[];
  graph_catalog: GraphBuildCatalogMetadata;
  docs_catalog: GraphBuildCatalogMetadata;
  shape: GraphBuildProjectShape;
  preparation_wall_ms: number;
};

export interface GraphBuildManifestPort {
  beginGraphBuildManifest(input: { manifest_id: string; fence: GraphBuildManifestFence; started_at: string }): Promise<void>;
  appendGraphBuildManifestObservation(input: {
    manifest_id: string; fence: GraphBuildManifestFence;
    file?: Omit<GraphBuildManifestFile, "ordinal" | "outcome" | "docs_eligible">;
    directory?: GraphBuildDirectoryObservation;
  }): Promise<void>;
  sealGraphBuildManifest(input: { manifest: GraphBuildManifest; progress: GraphBuildProgress }): Promise<void>;
  getGraphBuildManifest(input: { manifest_id?: string; snapshot_id?: string; fence?: GraphBuildManifestFence }): Promise<GraphBuildManifest | null>;
  invalidateGraphBuildManifest(input: { manifest_id: string; owner_id: string; reason: string; updated_at: string }): Promise<void>;
  commitGraphBuildFileOutcome(input: {
    manifest_id: string; fence: GraphBuildManifestFence; snapshot_id: string;
    ordinal: number; outcome: Exclude<GraphBuildManifestFile["outcome"], "pending">;
    entry: FileCatalogEntry; batch?: ExtractionBatch; updated_at: string;
  }): Promise<GraphBuildProgress>;
}

/** Discovery shares the canonical scanner; recording never starts a second walk. */
export interface GraphBuildCatalogCapturePort {
  beforeDirectory(input: { path: string; repository_key: string; identity: GraphBuildPathIdentity }): Promise<GraphBuildWatchObservation>;
  directory(input: GraphBuildDirectoryObservation): Promise<void>;
  file(input: { repository_key: string; entry: FileCatalogEntry; identity: GraphBuildPathIdentity }): Promise<void>;
}

export interface GraphBuildWatchPort {
  start(): Promise<GraphBuildWatchObservation>;
  registerDirectory(input: { path: string; repository_key?: string }): Promise<GraphBuildWatchObservation>;
  observe(): GraphBuildWatchObservation;
  /** Force queue admission outside controller mutation authority. */
  drain(): Promise<GraphBuildWatchObservation>;
  close(): Promise<void>;
}

export interface GraphBuildWatchQueuePort extends GraphBuildWatchPort {
  pollEvents(input?: { force?: boolean; max_events?: number }): Promise<readonly WorkspaceFileEvent[]>;
  bindDrain(drain: () => Promise<void>, observeQueue: () => { pending_events: number; healthy: boolean }): void;
  /** True only after every directory in a sealed inventory has been re-armed. */
  coverageEstablished(): boolean;
  /** Records an all-or-nothing coverage proof after caller identity validation. */
  establishCoverage(input: { directories: readonly string[] }): void;
}

export class GraphBuildValidationError extends Error {
  readonly code = "manifest_validation_failed";
  constructor(readonly reason: string, options?: ErrorOptions) {
    super(`Graph build freshness validation failed: ${reason}`, options);
    this.name = "GraphBuildValidationError";
  }
}

export type GraphBuildPublicationRequest = {
  repo_root: string; execution_id: string; target_snapshot_id: string;
  controller_generation: number; invalidation_generation: number;
  kind: "seed" | "complete";
};
export type GraphBuildValidationReceipt = GraphBuildPublicationRequest & {
  receipt_id: string; manifest_id: string; manifest_digest: string;
  watcher_epoch: string; start_sequence: number; end_sequence: number;
  checked_files: number; checked_directories: number; checked_inputs: number;
  validation_wall_ms: number; observed_at: string; policy_version: "manifest-identities-v1";
};
export interface GraphBuildPublicationValidationPort {
  prepare(input: GraphBuildPublicationRequest): Promise<GraphBuildValidationReceipt>;
  /** Must perform the last observation check and SQLite commit synchronously. */
  commit(input: { receipt: GraphBuildValidationReceipt; transition: SnapshotPublicationTransition & { to: "published" } }): SnapshotPublicationRecord & { state: "published" };
}

export interface GraphBuildAtomicPublicationPort {
  publishValidatedGraphBuild(input: {
    receipt: GraphBuildValidationReceipt;
    transition: SnapshotPublicationTransition & { to: "published" };
    assert_observation: () => void;
  }): SnapshotPublicationRecord & { state: "published" };
}

export interface GraphBuildWatchSourcePort {
  registerDirectory(input: { watch_id: string; path: string; repository_key?: string }): Promise<GraphBuildWatchObservation>;
  observe(input: { watch_id: string }): GraphBuildWatchObservation;
  drainObservedEvents(input: { watch_id: string }): readonly WorkspaceFileEvent[];
}

/** Canonical private inventory wire material, shared by admission and storage validation. */
export function graphBuildManifestDigestMaterial(manifest: GraphBuildManifest): string {
  const { state: _state, digest: _digest, started_at: _started, sealed_at: _sealed,
    invalid_reason: _invalid, preparation_wall_ms: _wall, files, ...capture } = manifest;
  const value = { ...capture, files: files.map(({ outcome: _outcome, ...file }) => file) };
  const stable = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(stable);
    if (item !== null && typeof item === "object") {
      return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, stable(child)]));
    }
    return item;
  };
  return JSON.stringify(stable(value));
}
