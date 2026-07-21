/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  AdapterEvidence,
  AnalysisValidity,
  DocumentationRankingReceipt,
  Freshness,
  ResponseMetadata
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import type {
  SnapshotState,
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
  SnapshotPort,
  WarmupCoordinatorPort
} from "../../ports/index.js";

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
  warmups?: WarmupCoordinatorPort;
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
  const warmup = input.warmups
    ? await input.warmups.getState({ repo_root: input.repo_root })
    : null;
  if (snapshot === null) {
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
    watcher: input.watcher,
    snapshot_validity: input.snapshot_validity,
    files,
    row_limit: rowLimit,
    truncated: files.length >= rowLimit
  });
  const readiness = await readDocumentationRankingReadiness({
    snapshot_id: snapshot.id,
    documentation_concerns: input.documentation_concerns
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

type DocumentationRankingReadiness = {
  receipt: DocumentationRankingReceipt;
  analysis_validity?: AnalysisValidity;
  blocked: boolean;
  authority_map_absent: boolean;
};

async function readDocumentationRankingReadiness(input: {
  snapshot_id: string;
  documentation_concerns: DocumentationConcernIndexPort;
}): Promise<DocumentationRankingReadiness> {
  try {
    const state = await input.documentation_concerns.getDocumentationConcernIndexState({
      snapshot_id: input.snapshot_id
    });
    if (state.snapshot_id !== input.snapshot_id) {
      return unavailableDocumentationRanking(
        input.snapshot_id,
        "environment_repair",
        "Documentation ranking readiness did not match the selected snapshot.",
        "invalid_due_to_environment"
      );
    }
    if (state.status === "ready") {
      if (state.state === "complete") {
        return {
          receipt: {
            snapshot_id: input.snapshot_id,
            state: "ready",
            recovery: "none",
            authority_map: "present"
          },
          blocked: false,
          authority_map_absent: false
        };
      }
      if (state.state === "no_map") {
        return {
          receipt: {
            snapshot_id: input.snapshot_id,
            state: "ready",
            recovery: "none",
            authority_map: "absent",
            ...(state.failure_reason === undefined ? {} : { reason: state.failure_reason })
          },
          analysis_validity: "partial",
          blocked: false,
          authority_map_absent: true
        };
      }
      return invalidDocumentationRanking(input.snapshot_id, state.failure_reason);
    }
    switch (state.reason) {
      case "concern_index_invalid":
        return invalidDocumentationRanking(input.snapshot_id, state.failure_reason);
      case "snapshot_not_published":
      case "snapshot_schema_incompatible":
      case "concern_index_state_missing":
        return unavailableDocumentationRanking(
          input.snapshot_id,
          "refresh",
          state.failure_reason ?? state.reason,
          "invalid_due_to_environment"
        );
      case "snapshot_not_found":
        return unavailableDocumentationRanking(
          input.snapshot_id,
          "request_repair",
          state.failure_reason ?? state.reason,
          "invalid"
        );
    }
  } catch {
    return unavailableDocumentationRanking(
      input.snapshot_id,
      "environment_repair",
      "Documentation ranking readiness could not be read from the snapshot store.",
      "invalid_due_to_environment"
    );
  }
}

function invalidDocumentationRanking(
  snapshot_id: string,
  reason?: string
): DocumentationRankingReadiness {
  return {
    receipt: {
      snapshot_id,
      state: "invalid",
      recovery: "source_repair",
      authority_map: "unknown",
      ...(reason === undefined ? {} : { reason })
    },
    analysis_validity: "invalid",
    blocked: true,
    authority_map_absent: false
  };
}

function unavailableDocumentationRanking(
  snapshot_id: string,
  recovery: "refresh" | "request_repair" | "environment_repair",
  reason: string,
  analysis_validity: "invalid" | "invalid_due_to_environment"
): DocumentationRankingReadiness {
  return {
    receipt: {
      snapshot_id,
      state: "unavailable",
      recovery,
      authority_map: "unknown",
      reason
    },
    analysis_validity,
    blocked: true,
    authority_map_absent: false
  };
}

function mergeDocumentationRankingTrust(
  meta: ResponseMetadata,
  readiness: DocumentationRankingReadiness
): ResponseMetadata {
  const analysisStrength: Record<AnalysisValidity, number> = {
    valid: 0,
    partial: 1,
    invalid: 2,
    invalid_due_to_environment: 3
  };
  const desiredValidity = readiness.analysis_validity;
  const analysisValidity = desiredValidity !== undefined &&
      analysisStrength[desiredValidity] > analysisStrength[meta.analysis_validity]
    ? desiredValidity
    : meta.analysis_validity;
  const caveats = readiness.authority_map_absent
    ? [
        ...(meta.caveats ?? []),
        {
          kind: "authority_map_absent" as const,
          severity: "warning" as const,
          message: "No documentation authority map was published for this snapshot.",
          evidence_kinds: ["docs" as const]
        }
      ]
    : meta.caveats;
  return {
    ...meta,
    analysis_validity: analysisValidity,
    verification_status: readiness.blocked ||
        analysisValidity === "invalid" ||
        analysisValidity === "invalid_due_to_environment"
      ? "blocked"
      : meta.verification_status,
    ...(caveats === undefined ? {} : { caveats })
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
  const reason = input.snapshot?.reason ?? input.warmup?.reason;
  if (reason !== undefined) {
    status.reason = reason;
  }

  return {
    status,
    meta: runtimePresentation.meta
  };
}
