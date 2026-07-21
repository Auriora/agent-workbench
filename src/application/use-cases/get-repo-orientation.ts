/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { OrientationReceipt, ResponseMetadata } from "../../contracts/index.js";
import type { GetRepoStatusResult, RuntimeStatus } from "./get-repo-status.js";

export type GetRepoOrientationResult = {
  orientation: OrientationReceipt;
  meta: ResponseMetadata;
};

const refreshWhen: OrientationReceipt["refresh_when"] = [
  "repository_root_changes",
  "scope_or_ignore_rules_change",
  "runtime_identity_changes",
  "policy_changes",
  "indexed_path_is_deleted",
  "index_becomes_invalid"
];

export function getRepoOrientation(input: GetRepoStatusResult): GetRepoOrientationResult {
  const blockers = materialOrientationBlockers(input.status, input.meta);
  const refreshRequired = orientationRefreshRequired(input.status);
  return {
    orientation: {
      repo_root: input.status.repo_root,
      ...(input.status.snapshot_id === undefined ? {} : { snapshot_id: input.status.snapshot_id }),
      freshness: input.status.freshness,
      trust_summary: {
        analysis_validity: input.meta.analysis_validity,
        capability_level: input.meta.capability_level,
        orientation_reusable: blockers.length === 0
      },
      material_blockers: blockers,
      detail_resources: ["repo:///status", "repo:///scope", "repo:///overview"],
      refresh_required: refreshRequired,
      refresh_when: refreshWhen,
      ordinary_content_edit_requires_refresh: false
    },
    meta: input.meta
  };
}

function orientationRefreshRequired(status: RuntimeStatus): boolean {
  const watcher = status.watcher_freshness;
  const ranking = status.documentation_ranking;
  const matchingRanking = status.snapshot_id !== undefined &&
    ranking?.snapshot_id === status.snapshot_id
    ? ranking
    : undefined;
  return status.snapshot_id === undefined ||
    status.runtime_state === "invalid" ||
    status.snapshot_validity?.refresh_required === true ||
    matchingRanking?.recovery === "refresh" ||
    watcher?.status === "degraded" ||
    watcher?.queue_state === "overflowed" ||
    watcher?.queue_state === "failed" ||
    watcher?.queue_state === "unavailable" ||
    watcher?.scope_status === "changed" ||
    watcher?.ignore_rules_status === "changed" ||
    watcher?.scope_status === "unknown" ||
    watcher?.ignore_rules_status === "unknown" ||
    status.owner_state === "stale_owner" ||
    status.owner_state === "dead_owner" ||
    status.warmup_state === "failed";
}

function materialOrientationBlockers(
  status: RuntimeStatus,
  meta: ResponseMetadata
): string[] {
  const blockers: string[] = [];
  const watcher = status.watcher_freshness;
  if (status.snapshot_id === undefined) {
    blockers.push("No repository snapshot is available.");
  } else if (status.documentation_ranking === undefined) {
    blockers.push("Ranked documentation readiness is unavailable for the selected snapshot.");
  } else if (status.documentation_ranking.snapshot_id !== status.snapshot_id) {
    blockers.push("Ranked documentation readiness does not match the selected snapshot.");
  } else if (
    status.documentation_ranking.state === "invalid" ||
    status.documentation_ranking.state === "unavailable"
  ) {
    blockers.push("Ranked documentation readiness is invalid or unavailable.");
  }
  if (status.snapshot_validity?.state === "stale") {
    blockers.push("One or more indexed paths are missing or deleted.");
  } else if (status.snapshot_validity?.state === "degraded") {
    blockers.push("Snapshot path validity could not be established within the declared bound.");
  }
  if (meta.analysis_validity === "invalid" || meta.analysis_validity === "invalid_due_to_environment") {
    blockers.push("Repository index evidence is invalid.");
  }
  if (
    watcher?.status === "degraded" ||
    watcher?.queue_state === "overflowed" ||
    watcher?.queue_state === "failed" ||
    watcher?.queue_state === "unavailable"
  ) {
    blockers.push("Workspace watcher freshness is degraded or unavailable.");
  }
  if (watcher?.scope_status === "changed" || watcher?.ignore_rules_status === "changed") {
    blockers.push("Repository scope or ignore rules changed.");
  } else if (watcher?.scope_status === "unknown" || watcher?.ignore_rules_status === "unknown") {
    blockers.push("Repository scope or ignore-rule synchronization is unknown.");
  }
  if (status.owner_state === "stale_owner" || status.owner_state === "dead_owner") {
    blockers.push("Repository runtime ownership is not current.");
  }
  if (status.warmup_state === "failed") {
    blockers.push("Repository index refresh failed.");
  }
  return blockers;
}
