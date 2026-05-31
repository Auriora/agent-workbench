import type {
  AdapterEvidence,
  EvidenceKind,
  Freshness,
  ResponseMetadata
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import { summarizeAdapterEvidence } from "../../domain/policies/index.js";
import type { FileCatalogScanPort } from "../../ports/index.js";

export type RuntimeStatus = {
  repo_root: string;
  freshness: Freshness;
  indexed_roots: string[];
  skipped_roots: string[];
  adapter_coverage: AdapterEvidence[];
};

export type RuntimeStatusResult = {
  status: RuntimeStatus;
  meta: ResponseMetadata;
};

export type GetRepoStatusResult = RuntimeStatusResult;

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return Array.from(new Set(values)).sort();
}

function strongestCapabilityLevel(
  coverage: readonly AdapterEvidence[]
): ResponseMetadata["capability_level"] {
  if (coverage.some((item) => item.capability_level === "semantic")) {
    return "semantic";
  }
  if (coverage.some((item) => item.capability_level === "partial_semantic")) {
    return "partial_semantic";
  }
  if (coverage.some((item) => item.capability_level === "resource_backed")) {
    return "resource_backed";
  }
  return "unsupported";
}

export function getCatalogRepoStatus(input: {
  repo_root: string;
  indexed_roots: readonly string[];
  skipped_roots: readonly string[];
  files: readonly FileCatalogEntry[];
  freshness?: Freshness;
}): GetRepoStatusResult {
  const coverage = summarizeAdapterEvidence(input.files);
  const languages = uniqueSorted(input.files.map((file) => file.file_identity.language));
  const evidenceKinds = uniqueSorted<EvidenceKind>(coverage.flatMap((item) => item.evidence_kinds));
  const freshness = input.freshness ?? "fresh";

  return {
    status: {
      repo_root: input.repo_root,
      freshness,
      indexed_roots: [...input.indexed_roots],
      skipped_roots: [...input.skipped_roots],
      adapter_coverage: [...coverage]
    },
    meta: {
      analysis_validity: coverage.length > 0 ? "valid" : "partial",
      freshness,
      scope: {
        repo_root: input.repo_root,
        indexed_roots: [...input.indexed_roots],
        skipped_roots: [...input.skipped_roots],
        languages
      },
      capability_level: strongestCapabilityLevel(coverage),
      evidence_kinds: evidenceKinds,
      verification_status: "needed",
      truncated: false
    }
  };
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
    max_files: input.max_files ?? 2000
  });
  const result = getCatalogRepoStatus({
    repo_root: scanned.repo_root,
    indexed_roots: scanned.indexed_roots,
    skipped_roots: scanned.skipped_roots,
    files: scanned.files,
    freshness: "fresh"
  });

  return {
    status: result.status,
    meta: {
      ...result.meta,
      truncated: scanned.truncated,
      budget: {
        row_limit: input.max_files ?? 2000
      }
    }
  };
}

export function getColdRepoStatus(repoRoot: string): GetRepoStatusResult {
  return {
    status: {
      repo_root: repoRoot,
      freshness: "cold",
      indexed_roots: [],
      skipped_roots: [],
      adapter_coverage: []
    },
    meta: {
      analysis_validity: "partial",
      freshness: "cold",
      scope: {
        repo_root: repoRoot,
        indexed_roots: [],
        skipped_roots: [],
        languages: []
      },
      capability_level: "unsupported",
      evidence_kinds: [],
      verification_status: "needed",
      truncated: false,
      budget: {
        time_ms: 50
      }
    }
  };
}
