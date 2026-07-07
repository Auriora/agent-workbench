/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  AdapterEvidence,
  AnalysisValidity,
  AttentionItem,
  CapabilityLevel,
  EvidenceKind,
  Freshness,
  FileReference,
  IntegrationHealth,
  IntegrationSurfaceHealth,
  NextAction,
  ResponseEnvelope,
  ResponseMetadata,
  RuntimeError,
  RuntimeStatusCaveat,
  ScopeMetadata,
  TrustCalibration,
  TrustUse,
  TrustVerificationRequirement,
  VerificationStatus
} from "../../contracts/index.js";
import { makeEnvelope } from "../../contracts/index.js";
import type { SnapshotState, WarmupExecution } from "../../domain/models/runtime.js";

export type RuntimeTrustState =
  | "cold"
  | "refreshing"
  | "fresh"
  | "stale"
  | "degraded"
  | "partial"
  | "invalid"
  | "invalid_due_to_environment";

export type RuntimeTrustClassification = {
  runtime_state: RuntimeTrustState;
  freshness: Freshness;
  analysis_validity: AnalysisValidity;
};

export type WatcherFreshnessState = {
  status: "fresh" | "refreshing" | "stale" | "degraded";
  queue_state: "drained" | "pending" | "overflowed" | "unavailable" | "failed";
  scope_status: "synchronized" | "changed" | "unknown";
  ignore_rules_status: "synchronized" | "changed" | "unknown";
  reason?: string;
};

const runtimeCaveatSeverities: Record<
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

export function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return Array.from(new Set(values)).sort();
}

export type TrustSurfaceKind =
  | "context_routing"
  | "docs_routing"
  | "docs_direct_read"
  | "graph_symbol_routing"
  | "graph_reference_routing"
  | "graph_impact_routing"
  | "diagnostics_static"
  | "markdown_quality"
  | "validation_plan"
  | "edit_preview"
  | "edit_apply"
  | "repository_status"
  | "docs_session_scope"
  | "integration_health"
  | "integration_profile"
  | "generic_error";

export type TrustSurfacePolicy = {
  surface_kind: TrustSurfaceKind;
  includes_direct_read?: boolean;
  includes_executed_validation?: boolean;
  mutation_applied?: boolean;
};

type MutableTrustCalibration = {
  safe_to_use_for: Set<TrustUse>;
  not_safe_to_use_for: Set<TrustUse>;
  must_verify_by: Set<TrustVerificationRequirement>;
};

const proofLikeTrustUses: readonly TrustUse[] = [
  "bounded_executed_validation_claim",
  "implementation_claim",
  "passed_validation_claim",
  "task_completion_claim",
  "closure_claim",
  "safe_mutation_claim",
  "whole_program_impact_claim",
  "security_or_vulnerability_claim"
];

export function buildTrustCalibration(input: {
  policy: TrustSurfacePolicy;
  meta: Omit<ResponseMetadata, "trust">;
  warnings?: readonly AttentionItem[];
  errors?: readonly RuntimeError[];
}): TrustCalibration {
  const calibration = baseTrustCalibration(input.policy);
  strengthenTrustFromEvidence(calibration, input.policy, input.meta);
  applyVerificationStatusRules(calibration, input.policy, input.meta.verification_status);
  applyFailureStateRules(calibration, {
    meta: input.meta,
    warnings: input.warnings ?? [],
    errors: input.errors ?? []
  });
  return finalizeTrustCalibration(calibration);
}

export function makeTrustedEnvelope<T>(input: {
  data: T;
  meta: Omit<ResponseMetadata, "trust">;
  trust_policy: TrustSurfacePolicy;
  warnings?: AttentionItem[];
  errors?: RuntimeError[];
}): ResponseEnvelope<T> {
  const warnings = input.warnings ?? [];
  const errors = input.errors ?? [];
  return makeEnvelope({
    data: input.data,
    meta: {
      ...input.meta,
      trust: buildTrustCalibration({
        policy: input.trust_policy,
        meta: input.meta,
        warnings,
        errors
      })
    },
    warnings,
    errors
  });
}

function baseTrustCalibration(policy: TrustSurfacePolicy): MutableTrustCalibration {
  const calibration = mutableTrustCalibration();
  switch (policy.surface_kind) {
    case "repository_status":
    case "docs_session_scope":
    case "integration_health":
      addAll(calibration.safe_to_use_for, ["navigation", "next_read_selection", "runtime_availability"]);
      addAll(calibration.not_safe_to_use_for, proofLikeTrustUses);
      addAll(calibration.must_verify_by, [
        "direct_read_relevant_source",
        "inspect_ranked_evidence",
        "run_planned_validation"
      ]);
      return calibration;
    case "integration_profile":
      addAll(calibration.safe_to_use_for, ["navigation", "next_read_selection"]);
      addAll(calibration.not_safe_to_use_for, [...proofLikeTrustUses, "runtime_availability"]);
      addAll(calibration.must_verify_by, [
        "direct_read_relevant_source",
        "inspect_ranked_evidence",
        "run_planned_validation"
      ]);
      return calibration;
    case "context_routing":
    case "docs_routing":
      addAll(calibration.safe_to_use_for, ["navigation", "next_read_selection"]);
      addAll(calibration.not_safe_to_use_for, proofLikeTrustUses);
      addAll(calibration.must_verify_by, [
        "direct_read_relevant_source",
        "inspect_ranked_evidence",
        "run_planned_validation"
      ]);
      return calibration;
    case "graph_symbol_routing":
    case "graph_reference_routing":
    case "graph_impact_routing":
      addAll(calibration.safe_to_use_for, ["navigation", "next_read_selection"]);
      addAll(calibration.not_safe_to_use_for, [
        "safe_mutation_claim",
        "whole_program_impact_claim",
        "passed_validation_claim",
        "task_completion_claim",
        "closure_claim",
        "security_or_vulnerability_claim"
      ]);
      addAll(calibration.must_verify_by, ["direct_read_relevant_source", "run_planned_validation"]);
      return calibration;
    case "docs_direct_read":
      addAll(calibration.not_safe_to_use_for, proofLikeTrustUses);
      addAll(calibration.must_verify_by, ["direct_read_relevant_source", "run_planned_validation"]);
      return calibration;
    case "diagnostics_static":
    case "markdown_quality":
      addAll(calibration.safe_to_use_for, ["navigation"]);
      addAll(calibration.not_safe_to_use_for, [
        "passed_validation_claim",
        "task_completion_claim",
        "closure_claim",
        "safe_mutation_claim",
        "whole_program_impact_claim",
        "security_or_vulnerability_claim"
      ]);
      addAll(calibration.must_verify_by, [
        "review_diagnostics_output",
        "direct_read_relevant_source",
        "run_planned_validation"
      ]);
      return calibration;
    case "validation_plan":
      addAll(calibration.safe_to_use_for, ["validation_planning"]);
      addAll(calibration.not_safe_to_use_for, [
        "passed_validation_claim",
        "task_completion_claim",
        "closure_claim",
        "safe_mutation_claim",
        "whole_program_impact_claim",
        "security_or_vulnerability_claim"
      ]);
      addAll(calibration.must_verify_by, ["run_planned_validation", "obtain_executed_validation_evidence"]);
      return calibration;
    case "edit_preview":
      addAll(calibration.safe_to_use_for, ["edit_preview_review"]);
      addAll(calibration.not_safe_to_use_for, [
        "applied_edit_observation",
        "safe_mutation_claim",
        "task_completion_claim",
        "closure_claim",
        "passed_validation_claim",
        "whole_program_impact_claim",
        "security_or_vulnerability_claim"
      ]);
      addAll(calibration.must_verify_by, ["review_generated_diff", "run_planned_validation"]);
      return calibration;
    case "edit_apply":
      if (policy.mutation_applied === true) {
        addAll(calibration.safe_to_use_for, ["applied_edit_observation"]);
      } else {
        addAll(calibration.not_safe_to_use_for, ["applied_edit_observation"]);
      }
      addAll(calibration.not_safe_to_use_for, [
        "safe_mutation_claim",
        "passed_validation_claim",
        "task_completion_claim",
        "closure_claim",
        "whole_program_impact_claim",
        "security_or_vulnerability_claim"
      ]);
      addAll(calibration.must_verify_by, ["review_generated_diff", "run_planned_validation"]);
      return calibration;
    case "generic_error":
      addAll(calibration.safe_to_use_for, ["navigation"]);
      addAll(calibration.not_safe_to_use_for, proofLikeTrustUses);
      addAll(calibration.must_verify_by, [
        "direct_read_relevant_source",
        "refresh_runtime_snapshot",
        "resolve_blocked_environment",
        "run_planned_validation"
      ]);
      return calibration;
  }
}

function strengthenTrustFromEvidence(
  calibration: MutableTrustCalibration,
  policy: TrustSurfacePolicy,
  meta: Omit<ResponseMetadata, "trust">
): void {
  if (policy.includes_direct_read === true && meta.evidence_kinds.includes("direct_read")) {
    calibration.safe_to_use_for.add("precise_direct_read_claim");
  }
  if (
    policy.includes_executed_validation === true &&
    meta.evidence_kinds.includes("executed_command") &&
    meta.verification_status === "done"
  ) {
    calibration.safe_to_use_for.add("bounded_executed_validation_claim");
  }
  if (
    (meta.evidence_kinds.includes("parser") ||
      meta.evidence_kinds.includes("compiler_api") ||
      meta.evidence_kinds.includes("lsp")) &&
    (meta.capability_level === "partial_semantic" || meta.capability_level === "semantic")
  ) {
    calibration.safe_to_use_for.add("local_structure_reference");
  }
}

function applyVerificationStatusRules(
  calibration: MutableTrustCalibration,
  policy: TrustSurfacePolicy,
  status: VerificationStatus
): void {
  if (status === "planned") {
    calibration.safe_to_use_for.add("validation_planning");
    calibration.not_safe_to_use_for.add("passed_validation_claim");
    calibration.must_verify_by.add("run_planned_validation");
  }
  if (status === "needed") {
    calibration.must_verify_by.add("run_planned_validation");
  }
  if (status === "blocked") {
    calibration.not_safe_to_use_for.add("passed_validation_claim");
    calibration.must_verify_by.add("resolve_blocked_environment");
  }
  if (
    status === "done" &&
    policy.includes_executed_validation !== true &&
    !calibration.safe_to_use_for.has("bounded_executed_validation_claim")
  ) {
    calibration.not_safe_to_use_for.add("passed_validation_claim");
  }
}

function applyFailureStateRules(
  calibration: MutableTrustCalibration,
  input: {
    meta: Omit<ResponseMetadata, "trust">;
    warnings: readonly AttentionItem[];
    errors: readonly RuntimeError[];
  }
): void {
  if (!isFailureState(input)) {
    return;
  }

  for (const use of proofLikeTrustUses) {
    calibration.safe_to_use_for.delete(use);
    calibration.not_safe_to_use_for.add(use);
  }
  addAll(calibration.must_verify_by, [
    "refresh_runtime_snapshot",
    "resolve_blocked_environment",
    "direct_read_relevant_source",
    "run_planned_validation"
  ]);
}

function isFailureState(input: {
  meta: Omit<ResponseMetadata, "trust">;
  warnings: readonly AttentionItem[];
  errors: readonly RuntimeError[];
}): boolean {
  return (
    input.meta.analysis_validity === "invalid" ||
    input.meta.analysis_validity === "invalid_due_to_environment" ||
    input.meta.analysis_validity === "partial" ||
    input.meta.freshness === "stale" ||
    input.meta.freshness === "cold" ||
    input.meta.freshness === "refreshing" ||
    input.meta.freshness === "unknown" ||
    input.meta.verification_status === "blocked" ||
    input.meta.verification_status === "planned" ||
    input.warnings.length > 0 ||
    input.errors.length > 0 ||
    (input.meta.caveats ?? []).some((caveat) => caveat.severity === "blocker")
  );
}

function finalizeTrustCalibration(calibration: MutableTrustCalibration): TrustCalibration {
  for (const use of calibration.not_safe_to_use_for) {
    calibration.safe_to_use_for.delete(use);
  }
  return {
    safe_to_use_for: uniqueSorted([...calibration.safe_to_use_for]),
    not_safe_to_use_for: uniqueSorted([...calibration.not_safe_to_use_for]),
    must_verify_by: uniqueSorted([...calibration.must_verify_by])
  };
}

function mutableTrustCalibration(): MutableTrustCalibration {
  return {
    safe_to_use_for: new Set<TrustUse>(),
    not_safe_to_use_for: new Set<TrustUse>(),
    must_verify_by: new Set<TrustVerificationRequirement>()
  };
}

function addAll<T>(target: Set<T>, values: readonly T[]): void {
  for (const value of values) {
    target.add(value);
  }
}

export function strongestCapabilityLevel(levels: readonly CapabilityLevel[]): CapabilityLevel {
  if (levels.includes("semantic")) return "semantic";
  if (levels.includes("partial_semantic")) return "partial_semantic";
  if (levels.includes("resource_backed")) return "resource_backed";
  return "unsupported";
}

export const PUBLIC_NEXT_ACTION_TOOLS = [
  "context_for_task",
  "diagnostics_for_files",
  "docs_current_for_task",
  "docs_map",
  "docs_outline",
  "docs_read_section",
  "docs_search",
  "symbol_search",
  "find_references",
  "impact",
  "preview_workspace_edit",
  "apply_workspace_edit",
  "verification_plan"
] as const;

const publicNextActionTools = new Set<string>(PUBLIC_NEXT_ACTION_TOOLS);

export type UnavailableNextAction = {
  action: NextAction;
  status: "unavailable" | "blocked" | "hidden" | "unknown";
  reason: string;
  evidence_kinds: EvidenceKind[];
};

export type SessionAwareNextActionResult = {
  next_actions: NextAction[];
  unavailable_actions: UnavailableNextAction[];
  assumptions: string[];
};

export type PresentationSessionContext = {
  integrationHealth?: IntegrationHealth;
};

export function classifyRuntimeTrust(input: {
  snapshot?: SnapshotState | null;
  warmup?: WarmupExecution | null;
  freshness: Freshness;
  hasEvidence: boolean;
  watcher?: WatcherFreshnessState;
}): RuntimeTrustClassification {
  const watcherClassification = classifyWatcherFreshness(input.watcher, input.hasEvidence);
  if (watcherClassification !== undefined) {
    return watcherClassification;
  }

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

function classifyWatcherFreshness(
  watcher: WatcherFreshnessState | undefined,
  hasEvidence: boolean
): RuntimeTrustClassification | undefined {
  if (watcher === undefined || isFreshWatcherState(watcher)) {
    return undefined;
  }

  if (watcher.status === "refreshing" || watcher.queue_state === "pending") {
    return {
      runtime_state: "refreshing",
      freshness: "refreshing",
      analysis_validity: hasEvidence ? "valid" : "partial"
    };
  }

  if (
    watcher.status === "degraded" ||
    watcher.queue_state === "failed" ||
    watcher.queue_state === "unavailable"
  ) {
    return {
      runtime_state: "degraded",
      freshness: "stale",
      analysis_validity: "partial"
    };
  }

  return {
    runtime_state: "stale",
    freshness: "stale",
    analysis_validity: hasEvidence ? "valid" : "partial"
  };
}

function isFreshWatcherState(watcher: WatcherFreshnessState): boolean {
  return (
    watcher.status === "fresh" &&
    watcher.queue_state === "drained" &&
    watcher.scope_status === "synchronized" &&
    watcher.ignore_rules_status === "synchronized"
  );
}

export function deriveRuntimeStatusCaveats(input: {
  coverage: readonly AdapterEvidence[];
  snapshot?: SnapshotState | null;
  warmup?: WarmupExecution | null;
  watcher?: WatcherFreshnessState;
}): RuntimeStatusCaveat[] {
  const caveats: RuntimeStatusCaveat[] = [];
  const reason = (input.snapshot?.reason ?? input.warmup?.reason ?? "").toLowerCase();

  if (input.coverage.length === 0) {
    caveats.push({
      kind: "no_adapter_coverage",
      severity: runtimeCaveatSeverities.language,
      message:
        "No scanner-visible adapter coverage was observed; status is limited to repository availability and cannot prove language, docs, config, or validation readiness.",
      evidence_kinds: []
    });
  }

  if (reason.includes("grammar")) {
    caveats.push({
      kind: "missing_parser_grammar",
      severity: runtimeCaveatSeverities.grammar,
      message:
        "A required tree-sitter grammar was unavailable while producing this snapshot; parser-derived semantic evidence should be treated as partial.",
      evidence_kinds: ["parser"]
    });
    return dedupeRuntimeCaveats(caveats);
  }

  if (reason.includes("parser timeout") || reason.includes("parser timed out")) {
    caveats.push({
      kind: "parser_timeout",
      severity: runtimeCaveatSeverities.timeout,
      message:
        "Parser execution timed out; semantic evidence is incomplete and should be treated as degraded for this repository.",
      evidence_kinds: ["parser"]
    });
  }
  if (reason.includes("parser") && reason.includes("crash")) {
    caveats.push({
      kind: "parser_crash",
      severity: runtimeCaveatSeverities.crash,
      message:
        "Parser execution crashed; semantic evidence is incomplete and should not be treated as complete proof.",
      evidence_kinds: ["parser"]
    });
  }
  if (reason.includes("parser") && !reason.includes("timeout") && !reason.includes("crash")) {
    caveats.push({
      kind: "missing_tree_sitter_parser",
      severity: runtimeCaveatSeverities.parser,
      message:
        "Tree-sitter parser was unavailable; semantic parsing evidence is degraded and fallback enrichments were not used.",
      evidence_kinds: ["parser"]
    });
  }
  if (reason.includes("test runner")) {
    caveats.push({
      kind: "missing_test_runner",
      severity: runtimeCaveatSeverities.runner,
      message: "No reliable test runner was detected in snapshot evidence; validation coverage is degraded.",
      evidence_kinds: []
    });
  }

  const hasUnsupportedLanguageCoverage = input.coverage.some(
    (entry) => entry.domain === "language" && entry.capability_level === "unsupported"
  );
  if (hasUnsupportedLanguageCoverage) {
    caveats.push({
      kind: "unsupported_language_or_platform",
      severity: runtimeCaveatSeverities.language,
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
  if (input.snapshot !== undefined && hasPartialParserCoverage && !hasOptionalEnrichmentEvidence) {
    caveats.push({
      kind: "missing_optional_enrichment_evidence",
      severity: runtimeCaveatSeverities.enrichment,
      message:
        "Optional enrichment (compiler/LSP/infra parser) is missing; evidence is limited to canonical parser extraction.",
      evidence_kinds: ["parser"]
    });
  }

  if (input.snapshot?.owner_state === "stale_owner" || input.snapshot?.owner_state === "dead_owner") {
    caveats.push({
      kind: "stale_watcher_snapshot",
      severity: runtimeCaveatSeverities.watcher,
      message:
        "Watcher ownership is stale or unavailable; snapshot-based indices should be treated as potentially stale until refresh completes.",
      evidence_kinds: []
    });
  }

  const watcherCaveat = watcherFreshnessCaveat(input.watcher);
  if (watcherCaveat !== undefined) {
    caveats.push(watcherCaveat);
  }

  return dedupeRuntimeCaveats(caveats);
}

function watcherFreshnessCaveat(
  watcher: WatcherFreshnessState | undefined
): RuntimeStatusCaveat | undefined {
  if (watcher === undefined || isFreshWatcherState(watcher)) {
    return undefined;
  }

  if (watcher.status === "refreshing" || watcher.queue_state === "pending") {
    return {
      kind: "watcher_refreshing",
      severity: "warning",
      message: watcher.reason ?? "Workspace watcher queue is still processing; freshness is refreshing until the queue drains and rescan evidence is published.",
      evidence_kinds: []
    };
  }

  if (
    watcher.status === "degraded" ||
    watcher.queue_state === "failed" ||
    watcher.queue_state === "unavailable"
  ) {
    return {
      kind: "degraded_watcher_freshness",
      severity: runtimeCaveatSeverities.watcher,
      message: watcher.reason ?? "Workspace watcher freshness is degraded; snapshot evidence must be treated as stale until a successful bounded rescan completes.",
      evidence_kinds: []
    };
  }

  return {
    kind: "stale_watcher_snapshot",
    severity: runtimeCaveatSeverities.watcher,
    message: watcher.reason ?? "Workspace watcher freshness is stale because queue, scope, or ignore-rule synchronization is not proven.",
    evidence_kinds: []
  };
}

export function buildRuntimeResponseMeta(input: {
  repoRoot: string;
  indexedRoots: readonly string[];
  skippedRoots: readonly string[];
  languages: readonly string[];
  coverage: readonly AdapterEvidence[];
  snapshot?: SnapshotState | null;
  warmup?: WarmupExecution | null;
  watcher?: WatcherFreshnessState;
  freshness?: Freshness;
  hasEvidence?: boolean;
  verification_status?: VerificationStatus;
  truncated?: boolean;
  budget?: ResponseMetadata["budget"];
}): {
  classification: RuntimeTrustClassification;
  meta: ResponseMetadata;
} {
  const classification = classifyRuntimeTrust({
    snapshot: input.snapshot,
    warmup: input.warmup,
    freshness: input.freshness ?? input.snapshot?.freshness ?? "fresh",
    hasEvidence: input.hasEvidence ?? input.coverage.length > 0,
    watcher: input.watcher
  });
  const evidenceKinds = uniqueSorted<EvidenceKind>(input.coverage.flatMap((item) => item.evidence_kinds));
  const caveats =
    input.snapshot === null
      ? []
      : deriveRuntimeStatusCaveats({
          coverage: input.coverage,
          snapshot: input.snapshot,
          warmup: input.warmup,
          watcher: input.watcher
        });

  return {
    classification,
    meta: buildResponseMeta({
      analysis_validity: classification.analysis_validity,
      freshness: classification.freshness,
      scope: {
        repo_root: input.repoRoot,
        indexed_roots: [...input.indexedRoots],
        skipped_roots: [...input.skippedRoots],
        languages: uniqueSorted(input.languages)
      },
      capability_level: strongestCapabilityLevel(input.coverage.map((item) => item.capability_level)),
      evidence_kinds: evidenceKinds,
      verification_status: input.verification_status ?? "needed",
      truncated: input.truncated ?? false,
      budget: input.budget,
      caveats
    })
  };
}

function dedupeRuntimeCaveats(caveats: readonly RuntimeStatusCaveat[]): RuntimeStatusCaveat[] {
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

export function capNextActions(actions: readonly NextAction[], limit = 3): NextAction[] {
  return sessionAwareNextActions(actions, { limit }).next_actions;
}

export function sessionAwareNextActions(
  actions: readonly NextAction[],
  input: {
    integrationHealth?: IntegrationHealth;
    limit?: number;
  } = {}
): SessionAwareNextActionResult {
  const seen = new Set<string>();
  const capped: NextAction[] = [];
  const unavailable: UnavailableNextAction[] = [];
  const assumptions: string[] = [];
  const surfaceByTool = integrationSurfaceByTool(input.integrationHealth);
  const hasKnownSessionDiscovery = input.integrationHealth?.session.discovery_state === "provided";

  for (const action of actions) {
    if (!publicNextActionTools.has(action.tool)) {
      continue;
    }

    const surface = surfaceByTool.get(action.tool);
    if (surface !== undefined) {
      if (surface.callable === "callable" && surface.status === "available") {
        pushUniqueAction({ action, seen, capped, limit: input.limit ?? 3 });
        continue;
      }

      if (surface.callable === "unknown" || surface.status === "unknown") {
        if (!hasKnownSessionDiscovery) {
          assumptions.push(
            `Callable state for ${action.tool} is unknown because caller discovery evidence was not provided.`
          );
          pushUniqueAction({ action, seen, capped, limit: input.limit ?? 3 });
        } else {
          unavailable.push(unavailableFromSurface(action, surface));
        }
        continue;
      }

      unavailable.push(unavailableFromSurface(action, surface));
      continue;
    }

    if (input.integrationHealth !== undefined && hasKnownSessionDiscovery) {
      unavailable.push({
        action,
        status: "unavailable",
        reason: "The MCP tool is public but was not present in integration health evidence.",
        evidence_kinds: ["config"]
      });
      continue;
    }

    if (input.integrationHealth !== undefined) {
      assumptions.push(
        `No integration health evidence was found for ${action.tool}; preserving public next action with unknown callability.`
      );
    }
    pushUniqueAction({ action: publicNextAction(action), seen, capped, limit: input.limit ?? 3 });
  }

  return {
    next_actions: capped,
    unavailable_actions: dedupeUnavailableNextActions(unavailable),
    assumptions: uniqueSorted(assumptions)
  };
}

export function presentNextActions(
  actions: readonly NextAction[],
  context: PresentationSessionContext = {},
  limit = 3
): NextAction[] {
  return sessionAwareNextActions(actions, {
    integrationHealth: context.integrationHealth,
    limit
  }).next_actions;
}

function integrationSurfaceByTool(
  health: IntegrationHealth | undefined
): Map<string, IntegrationSurfaceHealth> {
  const surfaces = new Map<string, IntegrationSurfaceHealth>();
  for (const surface of health?.surfaces ?? []) {
    if (surface.kind === "tool") {
      surfaces.set(surface.name, surface);
    }
  }
  return surfaces;
}

function publicNextAction(action: NextAction): NextAction {
  if (!Object.prototype.hasOwnProperty.call(action.args, "repo_root")) {
    return action;
  }
  const { repo_root: _repoRoot, ...args } = action.args;
  return {
    ...action,
    args
  };
}

function pushUniqueAction(input: {
  action: NextAction;
  seen: Set<string>;
  capped: NextAction[];
  limit: number;
}): void {
  if (input.capped.length >= input.limit) {
    return;
  }

  const key = `${input.action.tool}:${JSON.stringify(input.action.args)}`;
  if (input.seen.has(key)) {
    return;
  }
  input.seen.add(key);
  input.capped.push(input.action);
}

function unavailableFromSurface(
  action: NextAction,
  surface: IntegrationSurfaceHealth
): UnavailableNextAction {
  const status = surface.status === "available" ? "unknown" : surface.status;
  return {
    action,
    status,
    reason: surface.reason,
    evidence_kinds: uniqueSorted(surface.evidence_kinds)
  };
}

function dedupeUnavailableNextActions(
  actions: readonly UnavailableNextAction[]
): UnavailableNextAction[] {
  const seen = new Set<string>();
  const result: UnavailableNextAction[] = [];
  for (const item of actions) {
    const action = item.action;
    const itemKey = `${action.tool}:${JSON.stringify(action.args)}:${item.status}`;
    if (seen.has(itemKey)) {
      continue;
    }
    seen.add(itemKey);
    result.push(item);
  }
  return result;
}

export function invalidResponseMeta(input: {
  repoRoot: string;
  analysis_validity?: ResponseMetadata["analysis_validity"];
  freshness?: ResponseMetadata["freshness"];
  verification_status?: VerificationStatus;
  budget?: ResponseMetadata["budget"];
}): ResponseMetadata {
  return {
    analysis_validity: input.analysis_validity ?? "invalid",
    freshness: input.freshness ?? "unknown",
    scope: emptyScope(input.repoRoot),
    capability_level: "unsupported",
    evidence_kinds: [],
    verification_status: input.verification_status ?? "blocked",
    truncated: false,
    ...(input.budget === undefined ? {} : { budget: input.budget })
  };
}

export function buildResponseMeta(input: {
  analysis_validity: ResponseMetadata["analysis_validity"];
  freshness: ResponseMetadata["freshness"];
  scope: ScopeMetadata;
  capability_level?: CapabilityLevel;
  evidence_kinds?: readonly EvidenceKind[];
  files?: readonly Pick<FileReference, "capability_level" | "evidence_kinds">[];
  verification_status: VerificationStatus;
  truncated?: boolean;
  budget?: ResponseMetadata["budget"];
  caveats?: readonly RuntimeStatusCaveat[];
}): ResponseMetadata {
  const fileCapabilities = input.files?.map((file) => file.capability_level) ?? [];
  const fileEvidence = input.files?.flatMap((file) => file.evidence_kinds) ?? [];
  const capability = input.capability_level ?? strongestCapabilityLevel(fileCapabilities);
  const evidence = uniqueSorted<EvidenceKind>([...(input.evidence_kinds ?? []), ...fileEvidence]);
  return {
    analysis_validity: input.analysis_validity,
    freshness: input.freshness,
    scope: input.scope,
    capability_level: capability,
    evidence_kinds: evidence,
    verification_status: input.verification_status,
    truncated: input.truncated ?? false,
    ...(input.budget === undefined ? {} : { budget: input.budget }),
    ...(input.caveats === undefined || input.caveats.length === 0 ? {} : { caveats: [...input.caveats] })
  };
}

export function emptyScope(repoRoot: string): ScopeMetadata {
  return {
    repo_root: repoRoot,
    indexed_roots: [],
    skipped_roots: [],
    languages: []
  };
}
