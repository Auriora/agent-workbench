/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  AdapterEvidence,
  DocumentationRankingReceipt,
  Freshness,
  RepositoryCompositionSummary,
  ResponseMetadata
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import type {
  SnapshotState,
  SnapshotRepositoryClaimBlocker,
  SnapshotRepositoryComposition,
  SnapshotRepositoryCompositionLimit,
  SnapshotRepositoryUnit,
  SnapshotValidityReceipt,
  WarmupExecution
} from "../../domain/models/runtime.js";
import { summarizeAdapterEvidence } from "../../domain/policies/index.js";
import {
  buildRuntimeResponseMeta,
  uniqueSorted,
  type WatcherFreshnessState
} from "./response-metadata.js";
import type {
  FileCatalogPort,
  FileCatalogScanPort,
  DocumentationConcernIndexPort,
  DocsIndexPort,
  SnapshotPort,
  WarmupCoordinatorPort
} from "../../ports/index.js";
import type { RepositoryRefreshTriggerPort } from "./repository-refresh-triggers.js";
import {
  mergeDocumentationRankingTrust,
  readDocumentationRankingReadiness
} from "./documentation-ranking-readiness.js";
import {
  refreshAdmissionWatcher,
  refreshTriggerFailureWatcher
} from "./response-metadata.js";

export type RuntimeStatusState =
  | "cold"
  | "refreshing"
  | "fresh"
  | "stale"
  | "degraded"
  | "partial"
  | "invalid"
  | "invalid_due_to_environment";

export type RuntimeStatus = {
  repo_root: string;
  runtime_state: RuntimeStatusState;
  freshness: Freshness;
  indexed_roots: string[];
  skipped_roots: string[];
  adapter_coverage: AdapterEvidence[];
  snapshot_id?: string;
  owner_state?: SnapshotState["owner_state"];
  warmup_state?: WarmupExecution["state"];
  watcher_freshness?: WatcherFreshnessState;
  snapshot_validity?: SnapshotValidityReceipt;
  documentation_ranking?: DocumentationRankingReceipt;
  repository_composition?: RepositoryCompositionSummary;
  reason?: string;
};

export type RuntimeStatusResult = {
  status: RuntimeStatus;
  meta: ResponseMetadata;
};

export type GetRepoStatusResult = RuntimeStatusResult;

export function getCatalogRepoStatus(input: {
  repo_root: string;
  indexed_roots: readonly string[];
  skipped_roots: readonly string[];
  files: readonly FileCatalogEntry[];
  freshness?: Freshness;
  snapshot?: SnapshotState | null;
  warmup?: WarmupExecution | null;
  watcher?: WatcherFreshnessState;
  snapshot_validity?: SnapshotValidityReceipt;
  row_limit?: number;
  truncated?: boolean;
}): GetRepoStatusResult {
  const coverage = summarizeAdapterEvidence(input.files);
  const languages = uniqueSorted(input.files.map((file) => file.file_identity.language));
  const runtimePresentation = buildRuntimeResponseMeta({
    repoRoot: input.repo_root,
    indexedRoots: input.indexed_roots,
    skippedRoots: input.skipped_roots,
    languages,
    coverage,
    snapshot: input.snapshot,
    snapshotValidity: input.snapshot_validity,
    warmup: input.warmup,
    watcher: input.watcher,
    freshness: input.freshness,
    truncated: input.truncated,
    repositoryComposition: summarizeRepositoryComposition(input.snapshot?.repository_composition),
    budget: input.row_limit === undefined ? undefined : { row_limit: input.row_limit }
  });
  const classified = runtimePresentation.classification;

  const status: RuntimeStatus = {
    repo_root: input.repo_root,
    runtime_state: classified.runtime_state,
    freshness: classified.freshness,
    indexed_roots: [...input.indexed_roots],
    skipped_roots: [...input.skipped_roots],
    adapter_coverage: [...coverage]
  };
  if (input.snapshot?.id !== undefined) {
    status.snapshot_id = input.snapshot.id;
  }
  if (input.snapshot?.owner_state !== undefined) {
    status.owner_state = input.snapshot.owner_state;
  }
  if (input.warmup?.state !== undefined) {
    status.warmup_state = input.warmup.state;
  }
  if (input.watcher !== undefined) {
    status.watcher_freshness = input.watcher;
  }
  if (input.snapshot_validity !== undefined) {
    status.snapshot_validity = input.snapshot_validity;
  }
  const repositoryComposition = summarizeRepositoryComposition(input.snapshot?.repository_composition);
  if (repositoryComposition !== undefined) {
    status.repository_composition = repositoryComposition;
  }
  const reason = input.snapshot?.reason ?? input.warmup?.reason;
  if (reason !== undefined) {
    status.reason = reason;
  }
  return {
    status,
    meta: runtimePresentation.meta
  };
}

export async function getSnapshotRepoStatus(input: {
  repo_root: string;
  snapshots: SnapshotPort;
  catalog: FileCatalogPort;
  documentation_concerns: DocumentationConcernIndexPort;
  docs_index?: DocsIndexPort;
  warmups?: WarmupCoordinatorPort;
  refresh_triggers: RepositoryRefreshTriggerPort;
  watcher?: WatcherFreshnessState;
  snapshot_validity?: SnapshotValidityReceipt;
  snapshot_id?: string;
  selected_snapshot_id?: string | null;
  indexed_roots?: readonly string[];
  skipped_roots?: readonly string[];
  max_files?: number;
}): Promise<GetRepoStatusResult> {
  const snapshot = input.selected_snapshot_id === null
    ? null
    : await input.snapshots.getSnapshot({
      repo_root: input.repo_root,
      snapshot_id: input.selected_snapshot_id ?? input.snapshot_id
    });
  if (snapshot === null) {
    const warmup = input.warmups
      ? await input.warmups.getState({ repo_root: input.repo_root })
      : null;
    return getCatalogRepoStatus({
      repo_root: input.repo_root,
      indexed_roots: input.indexed_roots ?? ["."],
      skipped_roots: input.skipped_roots ?? [],
      files: [],
      freshness: "cold",
      snapshot,
      warmup,
      watcher: input.watcher
    });
  }

  const readiness = await readDocumentationRankingReadiness({
    snapshot_id: snapshot.id,
    repo_root: input.repo_root,
    docs_index: input.docs_index,
    documentation_concerns: input.documentation_concerns
  });
  let rankingRefreshWatcher: WatcherFreshnessState | undefined;
  if (readiness.receipt.recovery === "refresh") {
    try {
      const admission = await input.refresh_triggers.staleFirstRead({
        source: "documentation-ranking-readiness",
        visible_snapshot_id: snapshot.id
      });
      rankingRefreshWatcher = refreshAdmissionWatcher(admission);
    } catch {
      rankingRefreshWatcher = refreshTriggerFailureWatcher();
    }
  }
  const warmup = input.warmups
    ? await input.warmups.getState({ repo_root: input.repo_root })
    : null;

  const rowLimit = input.max_files ?? 200;
  const files = await input.catalog.listFiles({
    snapshot_id: snapshot.id,
    max_rows: rowLimit
  });
  const result = getSnapshotMetadataRepoStatus({
    repo_root: snapshot.repo_root,
    indexed_roots: input.indexed_roots ?? ["."],
    skipped_roots: input.skipped_roots ?? [],
    snapshot,
    warmup,
    watcher: rankingRefreshWatcher ?? input.watcher,
    snapshot_validity: input.snapshot_validity,
    files,
    row_limit: rowLimit,
    truncated: files.length >= rowLimit
  });
  result.status.documentation_ranking = readiness.receipt;
  result.meta = mergeDocumentationRankingTrust(result.meta, readiness);
  return result;
}

export async function getScannedRepoStatus(input: {
  repo_root: string;
  scanner: FileCatalogScanPort;
  indexed_roots?: readonly string[];
  skipped_roots?: readonly string[];
  max_files?: number;
  watcher?: WatcherFreshnessState;
}): Promise<GetRepoStatusResult> {
  const scanned = await input.scanner.scan({
    repo_root: input.repo_root,
    indexed_roots: input.indexed_roots ?? ["."],
    skipped_roots: input.skipped_roots ?? [],
    max_files: input.max_files ?? 15000
  });
  const result = getCatalogRepoStatus({
    repo_root: scanned.repo_root,
    indexed_roots: scanned.indexed_roots,
    skipped_roots: scanned.skipped_roots,
    files: scanned.files,
    freshness: "unknown",
    watcher: input.watcher,
    row_limit: input.max_files ?? 15000,
    truncated: scanned.truncated
  });

  return {
    status: result.status,
    meta: result.meta
  };
}

export function getSnapshotMetadataRepoStatus(input: {
  repo_root: string;
  indexed_roots: readonly string[];
  skipped_roots: readonly string[];
  snapshot: SnapshotState | null;
  warmup?: WarmupExecution | null;
  watcher?: WatcherFreshnessState;
  snapshot_validity?: SnapshotValidityReceipt;
  files?: readonly FileCatalogEntry[];
  row_limit?: number;
  truncated?: boolean;
}): GetRepoStatusResult {
  const files = input.files ?? [];
  const coverage = summarizeAdapterEvidence(files);
  const languages = uniqueSorted(files.map((file) => file.file_identity.language));
  const runtimePresentation = buildRuntimeResponseMeta({
    repoRoot: input.snapshot?.repo_root ?? input.repo_root,
    indexedRoots: input.indexed_roots,
    skippedRoots: input.skipped_roots,
    languages,
    coverage,
    snapshot: input.snapshot,
    snapshotValidity: input.snapshot_validity,
    warmup: input.warmup,
    watcher: input.watcher,
    freshness: input.snapshot?.freshness ?? "cold",
    hasEvidence: input.snapshot !== null,
    truncated: input.truncated,
    repositoryComposition: summarizeRepositoryComposition(input.snapshot?.repository_composition),
    budget: {
      row_limit: input.row_limit
    }
  });
  const classified = runtimePresentation.classification;
  const status: RuntimeStatus = {
    repo_root: input.snapshot?.repo_root ?? input.repo_root,
    runtime_state: classified.runtime_state,
    freshness: classified.freshness,
    indexed_roots: [...input.indexed_roots],
    skipped_roots: [...input.skipped_roots],
    adapter_coverage: [...coverage]
  };
  if (input.snapshot?.id !== undefined) {
    status.snapshot_id = input.snapshot.id;
  }
  if (input.snapshot?.owner_state !== undefined) {
    status.owner_state = input.snapshot.owner_state;
  }
  if (input.warmup?.state !== undefined) {
    status.warmup_state = input.warmup.state;
  }
  if (input.watcher !== undefined) {
    status.watcher_freshness = input.watcher;
  }
  if (input.snapshot_validity !== undefined) {
    status.snapshot_validity = input.snapshot_validity;
  }
  const repositoryComposition = summarizeRepositoryComposition(input.snapshot?.repository_composition);
  if (repositoryComposition !== undefined) {
    status.repository_composition = repositoryComposition;
  }
  const reason = input.snapshot?.reason ?? input.warmup?.reason;
  if (reason !== undefined) {
    status.reason = reason;
  }

  return {
    status,
    meta: runtimePresentation.meta
  };
}

const MAX_PUBLIC_REPOSITORY_UNITS = 50;
const MAX_PUBLIC_EVIDENCE_PATHS_PER_UNIT = 8;
const MAX_PUBLIC_CLAIM_BLOCKERS_PER_UNIT = 8;
const MAX_PUBLIC_LIMITS = 20;

export function summarizeRepositoryComposition(
  composition?: SnapshotRepositoryComposition
): RepositoryCompositionSummary | undefined {
  if (composition === undefined) {
    return undefined;
  }
  return {
    composition_fingerprint: composition.composition_fingerprint,
    source_complete: composition.source_complete,
    truncated: composition.truncated,
    aggregate_claims: { ...composition.aggregate_claims },
    repositories: composition.repositories
      .slice(0, MAX_PUBLIC_REPOSITORY_UNITS)
      .map(summarizeRepositoryUnit),
    skipped_or_blocked: composition.skipped_or_blocked
      .slice(0, MAX_PUBLIC_REPOSITORY_UNITS)
      .map(summarizeRepositoryUnit),
    limits: composition.limits
      .slice(0, MAX_PUBLIC_LIMITS)
      .map(summarizeRepositoryLimit)
  };
}

function summarizeRepositoryUnit(unit: SnapshotRepositoryUnit): RepositoryCompositionSummary["repositories"][number] {
  return removeUndefinedProperties({
    repository_key: unit.repository_key,
    parent_repository_key: unit.parent_repository_key,
    path_prefix: publicRelativePath(unit.path_prefix),
    depth: unit.depth,
    state: unit.state,
    declaration_path: publicOptionalRelativePath(unit.declaration_path),
    head_gitlink_oid: unit.head_gitlink_oid,
    index_gitlink_oid: unit.index_gitlink_oid,
    worktree_head_oid: unit.worktree_head_oid,
    pinned_revision_matches: unit.pinned_revision_matches,
    cleanliness: unit.cleanliness,
    source_available: unit.source_available,
    evidence_paths: unit.evidence_paths
      .map(publicRelativePath)
      .filter((value) => value.length > 0)
      .slice(0, MAX_PUBLIC_EVIDENCE_PATHS_PER_UNIT),
    claim_blockers: unit.claim_blockers
      .slice(0, MAX_PUBLIC_CLAIM_BLOCKERS_PER_UNIT)
      .map(summarizeClaimBlocker)
  });
}

function summarizeClaimBlocker(
  blocker: SnapshotRepositoryClaimBlocker
): RepositoryCompositionSummary["repositories"][number]["claim_blockers"][number] {
  return {
    kind: blocker.kind,
    path_prefix: publicRelativePath(blocker.path_prefix),
    evidence_paths: blocker.evidence_paths
      .map(publicRelativePath)
      .filter((value) => value.length > 0)
      .slice(0, MAX_PUBLIC_EVIDENCE_PATHS_PER_UNIT),
    blocked_claims: [...blocker.blocked_claims]
  };
}

function summarizeRepositoryLimit(
  limit: SnapshotRepositoryCompositionLimit
): RepositoryCompositionSummary["limits"][number] {
  return {
    kind: limit.kind,
    path_prefix: publicRelativePath(limit.path_prefix),
    limit: limit.limit
  };
}

function publicOptionalRelativePath(value: string | undefined): string | undefined {
  return value === undefined ? undefined : publicRelativePath(value);
}

function publicRelativePath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\/+/u, "");
  if (normalized === "" || normalized === ".") {
    return ".";
  }
  if (normalized.startsWith("/") || /^[a-z][a-z0-9+.-]*:/iu.test(normalized)) {
    return "[redacted]";
  }
  const safeSegments = normalized
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..");
  return safeSegments.length === 0 ? "." : safeSegments.join("/");
}

function removeUndefinedProperties<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as T;
}
