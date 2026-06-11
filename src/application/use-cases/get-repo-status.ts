import type {
  AdapterEvidence,
  Freshness,
  ResponseMetadata
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import type { SnapshotState, WarmupExecution } from "../../domain/models/runtime.js";
import { summarizeAdapterEvidence } from "../../domain/policies/index.js";
import {
  buildRuntimeResponseMeta,
  uniqueSorted
} from "../../presentation/metadata.js";
import type {
  FileCatalogPort,
  FileCatalogScanPort,
  SnapshotPort,
  WarmupCoordinatorPort
} from "../../ports/index.js";

export type RuntimeStatusState =
  | "cold"
  | "refreshing"
  | "fresh"
  | "stale"
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
    warmup: input.warmup,
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
  warmups?: WarmupCoordinatorPort;
  snapshot_id?: string;
  indexed_roots?: readonly string[];
  skipped_roots?: readonly string[];
  max_files?: number;
}): Promise<GetRepoStatusResult> {
  const snapshot = await input.snapshots.getSnapshot({
    repo_root: input.repo_root,
    snapshot_id: input.snapshot_id
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
      warmup
    });
  }

  const rowLimit = input.max_files ?? 200;
  const files = await input.catalog.listFiles({
    snapshot_id: snapshot.id,
    max_rows: rowLimit
  });

  return getSnapshotMetadataRepoStatus({
    repo_root: snapshot.repo_root,
    indexed_roots: input.indexed_roots ?? ["."],
    skipped_roots: input.skipped_roots ?? [],
    snapshot,
    warmup,
    files,
    row_limit: rowLimit,
    truncated: files.length >= rowLimit
  });
}

export async function getScannedRepoStatus(input: {
  repo_root: string;
  scanner: FileCatalogScanPort;
  indexed_roots?: readonly string[];
  skipped_roots?: readonly string[];
  max_files?: number;
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
    freshness: "unknown"
  });

  return {
    status: result.status,
    meta: {
      ...result.meta,
      truncated: scanned.truncated,
      budget: {
        row_limit: input.max_files ?? 15000
      }
    }
  };
}

export function getSnapshotMetadataRepoStatus(input: {
  repo_root: string;
  indexed_roots: readonly string[];
  skipped_roots: readonly string[];
  snapshot: SnapshotState | null;
  warmup?: WarmupExecution | null;
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
    warmup: input.warmup,
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
  const reason = input.snapshot?.reason ?? input.warmup?.reason;
  if (reason !== undefined) {
    status.reason = reason;
  }

  return {
    status,
    meta: runtimePresentation.meta
  };
}
