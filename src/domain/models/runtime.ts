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

export type SnapshotRepositoryKey = "superproject" | `submodule:${string}`;

export type SnapshotRepositoryCompositionState =
  | "superproject"
  | "initialized"
  | "uninitialized"
  | "worktree_revision_mismatch"
  | "metadata_unavailable"
  | "declaration_without_gitlink"
  | "orphan_gitlink"
  | "path_blocked"
  | "cycle_blocked"
  | "limit_blocked";

export type SnapshotRepositoryClaimBlocker = {
  kind:
    | "git_metadata_unavailable"
    | "declaration_without_gitlink"
    | "orphan_gitlink"
    | "path_blocked"
    | "cycle_blocked"
    | "limit_blocked";
  path_prefix: string;
  message: string;
  evidence_paths: readonly string[];
  blocked_claims: readonly (
    | "source_availability"
    | "repository_traversal"
    | "pinned_composition"
    | "worktree_cleanliness"
  )[];
};

export type SnapshotRepositoryUnit = {
  repository_key: SnapshotRepositoryKey;
  parent_repository_key?: SnapshotRepositoryKey;
  path_prefix: string;
  depth: number;
  state: SnapshotRepositoryCompositionState;
  declaration_path?: string;
  head_gitlink_oid?: string;
  index_gitlink_oid?: string;
  worktree_head_oid?: string;
  pinned_revision_matches: boolean | "unknown";
  cleanliness: "clean" | "dirty" | "unknown" | "unavailable";
  source_available: boolean;
  evidence_paths: readonly string[];
  claim_blockers: readonly SnapshotRepositoryClaimBlocker[];
};

export type SnapshotRepositoryAggregateClaims = {
  worktree_cleanliness: "clean" | "dirty" | "blocked";
  pinned_composition: "complete" | "mismatch" | "blocked";
};

export type SnapshotRepositoryCompositionLimit =
  | {
      kind: "max_depth_exceeded";
      path_prefix: string;
      limit: number;
      message: string;
    }
  | {
      kind: "max_repositories_exceeded";
      path_prefix: string;
      limit: number;
      message: string;
    };

export type SnapshotRepositoryComposition = {
  superproject_key: "superproject";
  repositories: readonly SnapshotRepositoryUnit[];
  aggregate_claims: SnapshotRepositoryAggregateClaims;
  skipped_or_blocked: readonly SnapshotRepositoryUnit[];
  source_complete: boolean;
  truncated: boolean;
  composition_fingerprint: string;
  limits: readonly SnapshotRepositoryCompositionLimit[];
};

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
  composition_fingerprint?: string;
  repository_composition?: SnapshotRepositoryComposition;
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
