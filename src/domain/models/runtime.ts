/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  AnalysisValidity,
  CapabilityLevel,
  Freshness,
  SnapshotValidityReceipt as SnapshotValidityReceiptContract
} from "../../contracts/runtime-contracts.js";

export type RepoRoot = string;
export type WorkspaceRoot = string;
export type SnapshotId = string;

export type SnapshotFreshness = Freshness;

export type SnapshotPathValidityState = "valid" | "stale" | "degraded";

export type SnapshotValidityReceipt = SnapshotValidityReceiptContract;

export interface SnapshotState {
  id: SnapshotId;
  repo_root: RepoRoot;
  workspace_root: WorkspaceRoot;
  repo_identity: string;
  config_identity: string;
  schema_version: number;
  freshness: SnapshotFreshness;
  analysis_validity?: AnalysisValidity;
  owner_state: SnapshotOwnershipState;
  created_at: string;
  updated_at: string;
  reason?: string;
}

export interface FileContentHashBinding {
  path: string;
  content_hash: string;
}

export interface SnapshotOwnershipRecord {
  repo_root: RepoRoot;
  snapshot_id: SnapshotId;
  owner_id: string;
  state: SnapshotOwnershipState;
  heartbeat_at: string;
  schema_version: number;
}

export type SnapshotOwnershipState = "owner" | "observer" | "stale_owner" | "dead_owner" | "isolated_worker";

export interface RuntimeContextInput {
  operation: string;
  repo_root: RepoRoot;
  workspace_root: WorkspaceRoot;
  request_id: string;
  snapshot_id?: SnapshotId;
  freshness?: SnapshotFreshness;
  capability_level?: CapabilityLevel;
  budget_ms?: number;
  deadline_at?: string;
  usage_context?: Record<string, string>;
  cancellation_token?: string;
}

export interface RuntimeContext {
  operation: string;
  repo_root: RepoRoot;
  workspace_root: WorkspaceRoot;
  request_id: string;
  snapshot_id?: SnapshotId;
  freshness: SnapshotFreshness;
  capability_level?: CapabilityLevel;
  budget_ms?: number;
  deadline_at?: string;
  usage_context?: Record<string, string>;
  cancellation_token?: string;
  scope?: {
    indexed_roots: readonly string[];
    skipped_roots: readonly string[];
    languages: readonly string[];
  };
}

export interface WarmupExecution {
  execution_id: string;
  repo_root: RepoRoot;
  snapshot_id: SnapshotId;
  state: WarmupExecutionState;
  owner_id: string;
  queued_jobs: number;
  started_at: string;
  updated_at: string;
  reason?: string;
}

export type WarmupExecutionState = "idle" | "planned" | "running" | "failed" | "complete" | "cancelled";
