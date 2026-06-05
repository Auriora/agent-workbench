import type { CapabilityLevel, RepoScope, ResponseMetadata } from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import type {
  FileCatalogScanPort,
  SnapshotPort,
  WarmupCoordinatorPort
} from "../../ports/index.js";
import { getCatalogRepoStatus } from "./get-repo-status.js";

export type GetRepoScopeResult = {
  scope: RepoScope;
  meta: ResponseMetadata;
};

export async function getRepoScope(input: {
  repo_root: string;
  scanner: FileCatalogScanPort;
  snapshots?: SnapshotPort;
  warmups?: WarmupCoordinatorPort;
}): Promise<GetRepoScopeResult> {
  const [scanned, snapshot, warmup] = await Promise.all([
    input.scanner.scan({
      repo_root: input.repo_root,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 2000
    }),
    input.snapshots?.getSnapshot({ repo_root: input.repo_root }) ?? Promise.resolve(undefined),
    input.warmups?.getState({ repo_root: input.repo_root }) ?? Promise.resolve(undefined)
  ]);
  const status = getCatalogRepoStatus({
    repo_root: scanned.repo_root,
    indexed_roots: scanned.indexed_roots,
    skipped_roots: scanned.skipped_roots,
    files: scanned.files,
    freshness: snapshot?.freshness ?? "unknown",
    snapshot: snapshot ?? undefined,
    warmup: warmup ?? undefined
  });

  return {
    scope: {
      repo_root: scanned.repo_root,
      indexed_roots: [...scanned.indexed_roots],
      skipped_roots: [...scanned.skipped_roots],
      languages: uniqueSorted(scanned.files.map((file) => file.file_identity.language)),
      file_counts: countByLanguage(scanned.files),
      capability_counts: countByCapability(scanned.files),
      generated_or_vendor_roots: [...scanned.skipped_roots]
    },
    meta: {
      ...status.meta,
      truncated: scanned.truncated,
      budget: {
        row_limit: 2000
      }
    }
  };
}

function countByLanguage(files: readonly FileCatalogEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of files) {
    counts[file.file_identity.language] = (counts[file.file_identity.language] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function countByCapability(files: readonly FileCatalogEntry[]): Record<CapabilityLevel, number> {
  const counts: Record<CapabilityLevel, number> = {
    semantic: 0,
    partial_semantic: 0,
    resource_backed: 0,
    unsupported: 0
  };
  for (const file of files) {
    counts[file.adapter_evidence?.capability_level ?? "unsupported"] += 1;
  }
  return counts;
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}
