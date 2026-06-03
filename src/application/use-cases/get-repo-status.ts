import type {
  AdapterEvidence,
  AnalysisValidity,
  EvidenceKind,
  Freshness,
  RuntimeStatusCaveat,
  ResponseMetadata
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import type { SnapshotState, WarmupExecution } from "../../domain/models/runtime.js";
import { summarizeAdapterEvidence } from "../../domain/policies/index.js";
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

const warningSeverities: Record<
  "parser" | "grammar" | "timeout" | "crash" | "enrichment" | "language" | "runner" | "watcher",
  RuntimeStatusCaveat["severity"]
> = {
  parser: "warning",
  grammar: "warning",
  timeout: "blocker",
  crash: "blocker",
  enrichment: "warning",
  language: "warning",
  runner: "warning",
  watcher: "blocker"
};

function deriveStatusCaveats(input: {
  coverage: readonly AdapterEvidence[];
  snapshot?: SnapshotState | null;
  warmup?: WarmupExecution | null;
}): RuntimeStatusCaveat[] {
  const caveats: RuntimeStatusCaveat[] = [];
  const reason = (input.snapshot?.reason ?? input.warmup?.reason ?? "").toLowerCase();

  if (reason.includes("grammar")) {
    caveats.push({
      kind: "missing_parser_grammar",
      severity: warningSeverities.grammar,
      message:
        "A required tree-sitter grammar was unavailable while producing this snapshot; parser-derived semantic evidence should be treated as partial.",
      evidence_kinds: ["parser"]
    });
    return caveats;
  }

  if (reason.includes("parser timeout") || reason.includes("parser timed out")) {
    caveats.push({
      kind: "parser_timeout",
      severity: warningSeverities.timeout,
      message:
        "Parser execution timed out; semantic evidence is incomplete and should be treated as degraded for this repository.",
      evidence_kinds: ["parser"]
    });
  }
  if (reason.includes("parser") && reason.includes("crash")) {
    caveats.push({
      kind: "parser_crash",
      severity: warningSeverities.crash,
      message:
        "Parser execution crashed; semantic evidence is incomplete and should not be treated as complete proof.",
      evidence_kinds: ["parser"]
    });
  }
  if (reason.includes("parser") && !reason.includes("timeout") && !reason.includes("crash")) {
    caveats.push({
      kind: "missing_tree_sitter_parser",
      severity: warningSeverities.parser,
      message:
        "Tree-sitter parser was unavailable; semantic parsing evidence is degraded and fallback enrichments were not used.",
      evidence_kinds: ["parser"]
    });
  }
  if (reason.includes("test runner")) {
    caveats.push({
      kind: "missing_test_runner",
      severity: warningSeverities.runner,
      message: "No reliable test runner was detected in snapshot evidence; validation coverage is degraded.",
      evidence_kinds: []
    });
  }

  const hasUnsupportedLanguageCoverage = input.coverage.some(
    (entry) =>
      entry.domain === "language" && entry.capability_level === "unsupported"
  );
  if (hasUnsupportedLanguageCoverage) {
    caveats.push({
      kind: "unsupported_language_or_platform",
      severity: warningSeverities.language,
      message:
        "Unsupported language/platform coverage was observed; direct reads or rule-based routing should be preferred for these files.",
      evidence_kinds: []
    });
  }

  const hasPartialParserCoverage = input.coverage.some(
    (entry) =>
      entry.domain === "language" &&
      entry.capability_level === "partial_semantic" &&
      entry.evidence_kinds.includes("parser")
  );
  const hasOptionalEnrichmentEvidence = input.coverage.some((entry) =>
    entry.evidence_kinds.includes("compiler_api") || entry.evidence_kinds.includes("lsp")
  );
  if (hasPartialParserCoverage && !hasOptionalEnrichmentEvidence) {
    caveats.push({
      kind: "missing_optional_enrichment_evidence",
      severity: warningSeverities.enrichment,
      message:
        "Optional enrichment (compiler/LSP/infra parser) is missing; evidence is limited to canonical parser extraction.",
      evidence_kinds: ["parser"]
    });
  }

  if (input.snapshot?.owner_state === "stale_owner" || input.snapshot?.owner_state === "dead_owner") {
    caveats.push({
      kind: "stale_watcher_snapshot",
      severity: warningSeverities.watcher,
      message:
        "Watcher ownership is stale or unavailable; snapshot-based indices should be treated as potentially stale until refresh completes.",
      evidence_kinds: []
    });
  }

  return dedupeCaveats(caveats);
}

function dedupeCaveats(caveats: RuntimeStatusCaveat[]): RuntimeStatusCaveat[] {
  const byKind = new Map<string, RuntimeStatusCaveat>();
  for (const caveat of caveats) {
    byKind.set(caveat.kind, {
      ...caveat,
      evidence_kinds: uniqueSorted(caveat.evidence_kinds),
      message: `${caveat.message}`
    });
  }
  return Array.from(byKind.values());
}

export function getCatalogRepoStatus(input: {
  repo_root: string;
  indexed_roots: readonly string[];
  skipped_roots: readonly string[];
  files: readonly FileCatalogEntry[];
  freshness?: Freshness;
  snapshot?: SnapshotState | null;
  warmup?: WarmupExecution | null;
}): GetRepoStatusResult {
  const coverage = summarizeAdapterEvidence(input.files);
  const languages = uniqueSorted(input.files.map((file) => file.file_identity.language));
  const evidenceKinds = uniqueSorted<EvidenceKind>(coverage.flatMap((item) => item.evidence_kinds));
  const classified = classifyRuntimeStatus({
    snapshot: input.snapshot,
    warmup: input.warmup,
    freshness: input.freshness ?? input.snapshot?.freshness ?? "fresh",
    hasEvidence: coverage.length > 0
  });

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
  const caveats = input.snapshot === null || input.snapshot === undefined
    ? []
    : deriveStatusCaveats({
      coverage,
      snapshot: input.snapshot,
      warmup: input.warmup
    });

  return {
    status,
    meta: {
      analysis_validity: classified.analysis_validity,
      freshness: classified.freshness,
      scope: {
        repo_root: input.repo_root,
        indexed_roots: [...input.indexed_roots],
        skipped_roots: [...input.skipped_roots],
        languages
      },
      capability_level: strongestCapabilityLevel(coverage),
      evidence_kinds: evidenceKinds,
      verification_status: "needed",
      truncated: false,
      caveats: caveats.length === 0 ? undefined : caveats
    }
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

  const maxFiles = input.max_files ?? 2000;
  const files = await input.catalog.listFiles({
    snapshot_id: snapshot.id,
    max_rows: maxFiles
  });
  const result = getCatalogRepoStatus({
    repo_root: snapshot.repo_root,
    indexed_roots: input.indexed_roots ?? ["."],
    skipped_roots: input.skipped_roots ?? [],
    files,
    snapshot,
    warmup
  });
  return {
    status: result.status,
    meta: {
      ...result.meta,
      truncated: files.length >= maxFiles,
      budget: {
        row_limit: maxFiles
      }
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
    freshness: "unknown"
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

function classifyRuntimeStatus(input: {
  snapshot?: SnapshotState | null;
  warmup?: WarmupExecution | null;
  freshness: Freshness;
  hasEvidence: boolean;
}): {
  runtime_state: RuntimeStatusState;
  freshness: Freshness;
  analysis_validity: AnalysisValidity;
} {
  if (input.snapshot === null) {
    return {
      runtime_state: "cold",
      freshness: "cold",
      analysis_validity: "invalid"
    };
  }

  const analysisValidity = input.snapshot?.analysis_validity;
  if (analysisValidity === "invalid_due_to_environment") {
    return {
      runtime_state: "invalid_due_to_environment",
      freshness: input.freshness,
      analysis_validity: "invalid_due_to_environment"
    };
  }
  if (analysisValidity === "invalid") {
    return {
      runtime_state: "invalid",
      freshness: input.freshness,
      analysis_validity: "invalid"
    };
  }

  if (input.warmup?.state === "planned" || input.warmup?.state === "running") {
    return {
      runtime_state: "refreshing",
      freshness: "refreshing",
      analysis_validity: input.hasEvidence ? "valid" : "partial"
    };
  }

  if (analysisValidity === "partial" || (input.snapshot !== undefined && input.freshness === "unknown")) {
    return {
      runtime_state: "partial",
      freshness: input.freshness,
      analysis_validity: "partial"
    };
  }

  if (input.freshness === "unknown") {
    return {
      runtime_state: "partial",
      freshness: "unknown",
      analysis_validity: input.hasEvidence ? "valid" : "partial"
    };
  }

  if (input.freshness === "cold" || input.freshness === "refreshing" || input.freshness === "stale") {
    return {
      runtime_state: input.freshness,
      freshness: input.freshness,
      analysis_validity: input.hasEvidence ? "valid" : "partial"
    };
  }

  return {
    runtime_state: "fresh",
    freshness: "fresh",
    analysis_validity: input.hasEvidence ? "valid" : "partial"
  };
}
