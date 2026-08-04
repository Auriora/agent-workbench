/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type RepositoryKey = "superproject" | `submodule:${string}`;

export type RepositoryCompositionState =
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

export type RepositoryClaimBlocker = {
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

export type RepositoryUnitEvidence = {
  repository_key: RepositoryKey;
  parent_repository_key?: RepositoryKey;
  path_prefix: string;
  depth: number;
  state: RepositoryCompositionState;
  declaration_path?: string;
  head_gitlink_oid?: string;
  index_gitlink_oid?: string;
  worktree_head_oid?: string;
  pinned_revision_matches: boolean | "unknown";
  cleanliness: "clean" | "dirty" | "unknown" | "unavailable";
  source_available: boolean;
  evidence_paths: readonly string[];
  claim_blockers: readonly RepositoryClaimBlocker[];
};

export type RepositoryCompositionAggregateClaims = {
  worktree_cleanliness: "clean" | "dirty" | "blocked";
  pinned_composition: "complete" | "mismatch" | "blocked";
};

export type RepositoryCompositionLimit =
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

export type RepositoryCompositionReceipt = {
  superproject_key: "superproject";
  repositories: readonly RepositoryUnitEvidence[];
  aggregate_claims: RepositoryCompositionAggregateClaims;
  skipped_or_blocked: readonly RepositoryUnitEvidence[];
  source_complete: boolean;
  truncated: boolean;
  composition_fingerprint: string;
  limits: readonly RepositoryCompositionLimit[];
};
