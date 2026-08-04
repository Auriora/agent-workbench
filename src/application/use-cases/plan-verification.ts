/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import type {
  PlannedValidationCommand,
  ProjectUnitEvidence,
  ResponseMetadata,
  SkippedPath,
  StaticFeedback,
  VerificationPlan,
  VerificationPlanRequest
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import {
  isExplicitHiddenCatalogPathAllowed,
  type RepositoryCompositionAdmissionReceipt
} from "../../domain/policies/index.js";
import type {
  FileCatalogScanPort,
  FileCatalogScanResult,
  FileCatalogSkippedPath,
  GitRepositoryCompositionPort,
  WorkspaceFilePort
} from "../../ports/index.js";
import { capNextActions } from "./response-metadata.js";
import { buildStatBackedFileCatalogEntry } from "./file-catalog-entry.js";
import { getCatalogRepoStatus } from "./get-repo-status.js";
import {
  cmakeValidationCommands,
  discoverCMakeTargets,
  discoverGoCiCommands,
  discoverRubyValidationCommands,
  discoverPythonNearestTests,
  dotnetTestTargets,
  isDocsOrConfigLanguage,
  isDotnetProjectPath,
  isDotnetTestProjectPath,
  isGithubWorkflowPath,
  isSamInfraTestPath,
  isSamRelatedPath,
  isSamTemplatePath,
  lowerExtension,
  markdownQualityCommands,
  nearestDotnetProject,
  projectShapeConfigCandidates,
  selectSamTemplates,
  type RubyValidationCommandCandidate,
  type CMakeTargetEvidence
} from "./validation-ecosystems.js";
import {
  discoverValidationProtocol,
  guidanceCommandsCoverFamily,
  hostCommandBlockedReason,
  hostCommandsBlocked,
  isValidationEnvironmentReason,
  repoCommandsCoverHostSuppression,
  type ValidationProtocolDiscovery
} from "./validation-environment.js";
import { planCommand } from "../../domain/policies/command-safety.js";
import {
  configuredPackageCommands,
  detectPackageManager,
  discoverPackageScripts,
  selectPackageScripts,
  type PackageScriptEvidence
} from "./validation-package-scripts.js";
import {
  detectMcpServerShape,
  isMcpServerEvidencePath,
  mcpTransportLabels,
  type McpServerShape
} from "./mcp-server-shape.js";
import { buildStaticFeedback } from "./validation-static-feedback.js";
import { normalizeRepoPath, uniqueSorted } from "./validation-utils.js";
import { detectRailsProjectShape, type RailsProjectShape } from "./rails-project-shape.js";
import { discoverProjectUnits } from "./project-unit-discovery.js";
import {
  recognizeProjectUnitMarkers,
  type ScriptMarkerGuidance
} from "./project-unit-markers.js";
import {
  assessProjectUnitReadiness,
  projectUnitNextActions
} from "./validation-environment.js";
import {
  applyRepositoryGitClaimEvidence,
  inspectRepositoryGitClaims
} from "./project-unit-git-claims.js";
import {
  boundaryForPath,
  discoverRepositoryBoundaries
} from "./project-unit-boundaries.js";
import { discoverRepositoryComposition } from "./repository-composition.js";
import type {
  RepositoryCompositionReceipt,
  RepositoryUnitEvidence
} from "./repository-composition-model.js";

export type PlanVerificationResult = {
  plan: VerificationPlan;
  meta: ResponseMetadata;
};

type RepositoryReference = NonNullable<PlannedValidationCommand["repository"]>;

type RepositoryAwareFileCatalogScanPort = Omit<FileCatalogScanPort, "scan"> & {
  scan(input: Parameters<FileCatalogScanPort["scan"]>[0] & {
    repository_composition?: RepositoryCompositionAdmissionReceipt;
  }): Promise<FileCatalogScanResult>;
};

export async function planVerification(input: {
  request: VerificationPlanRequest;
  scanner: FileCatalogScanPort;
  workspace: WorkspaceFilePort;
  default_repo_root: string;
  git?: GitRepositoryCompositionPort;
  canonicalize_repo_root?: (repo_root: string) => string;
}): Promise<PlanVerificationResult> {
  const repoRoot = path.resolve(input.request.repo_root ?? input.default_repo_root);
  const selectedPaths = uniqueSorted([
    ...input.request.files.map(normalizeRepoPath),
    ...input.request.changed_files.map(normalizeRepoPath)
  ]);
  const unsafePaths = selectedPaths.filter(isUnsafeValidationTarget);
  const composition = input.git === undefined
    ? undefined
    : await discoverRepositoryComposition({
        workspace: input.workspace,
        git: input.git,
        repo_root: repoRoot,
        canonicalize_repo_root: input.canonicalize_repo_root
      });
  const planningScope = buildRepositoryPlanningScope({
    composition,
    selectedPaths
  });
  const crossesRepositoryBoundary = selectionCrossesRepositoryBoundary({
    composition,
    selectedPaths
  });
  const scanned = await (input.scanner as RepositoryAwareFileCatalogScanPort).scan({
    repo_root: repoRoot,
    indexed_roots: ["."],
    skipped_roots: [],
    max_files: 15000,
    priority_paths: selectedPaths.filter((filePath) => !unsafePaths.includes(filePath)),
    repository_composition: composition === undefined
      ? undefined
      : repositoryCompositionAdmission(composition)
  });
  const selectedPathsForPlanning = planningScope === undefined
    ? selectedPaths
    : selectedPaths.map((filePath) => unprefixRepositoryPath(planningScope.path_prefix, filePath));
  const workspaceForPlanning = planningScope === undefined
    ? input.workspace
    : scopedWorkspace(input.workspace, planningScope.path_prefix);
  const scannedFilesForPlanning = planningScope === undefined
    ? composition !== undefined && selectedPaths.length === 0
      ? superprojectCatalogEntries(scanned.files, composition)
      : scanned.files
    : localizeCatalogEntries(scanned.files, planningScope.path_prefix);
  const files = await mergeDirectValidationEntries({
    scannedFiles: scannedFilesForPlanning,
    selectedPaths: selectedPathsForPlanning,
    workspace: workspaceForPlanning
  });
  const selectedScope = await classifySelectedScope(workspaceForPlanning, selectedPathsForPlanning);
  const railsDiscoveryFiles = files.filter((file) => !isEmbeddedFixturePath(file.path));
  const selectedEntries = selectEntries(files, selectedPathsForPlanning);
  const railsShape = detectRailsProjectShape({
    files: railsDiscoveryFiles,
    scan_truncated: scanned.truncated
  });
  const projectUnitPlan = crossesRepositoryBoundary
    ? {
        applies: true,
        commands: [],
        units: [],
        limitations: [],
        blockerMessages: [
          "Selected paths span multiple repositories without explicit repository aggregation evidence."
        ],
        nextActions: []
      }
    : await planProjectUnitValidation({
    files,
    selectedPaths: selectedScope.files,
    selectedSubtrees: selectedScope.subtrees,
    workspace: workspaceForPlanning,
    skippedPaths: scanned.skipped_paths ?? [],
    maxCommands: input.request.max_commands,
    repositoryUnit: planningScope?.unit
  });
  const discovery = projectUnitPlan.applies
    ? undefined
    : await discoverValidationEvidence({
        files: railsDiscoveryFiles,
        selectedEntries,
        railsShape,
        workspace: workspaceForPlanning
      });
  const commandPlan = projectUnitPlan.applies
    ? { commands: [], lowConfidenceReasons: [], blockerReasons: [] }
    : planValidationCommands({
        files,
        selectedEntries,
        discovery: discovery!,
        task: input.request.task,
        maxCommands: input.request.max_commands
      });
  const commands = projectUnitPlan.applies ? projectUnitPlan.commands : commandPlan.commands;
  const repositoryCommands = attachRepositoryToCommands(commands, planningScope?.reference);
  const requestedExclusions = (scanned.skipped_paths ?? []).filter((skipped) => selectedPaths.includes(skipped.path));
  const excludedPathSet = new Set(requestedExclusions.map((skipped) => skipped.path));
  const changedFilesForPlanning = planningScope === undefined
    ? input.request.changed_files
    : input.request.changed_files.map((filePath) => unprefixRepositoryPath(planningScope.path_prefix, normalizeRepoPath(filePath)));
  const staticFeedback =
    input.request.include_static_feedback && input.request.changed_files.length > 0
      ? prefixStaticFeedback(
          buildStaticFeedback(
            changedFilesForPlanning.filter((filePath, index) =>
              !excludedPathSet.has(normalizeRepoPath(input.request.changed_files[index] ?? filePath))
            ),
            files
          ),
          planningScope?.path_prefix
        )
      : undefined;
  const missingPaths = selectedPaths.filter((filePath) =>
    selectedScope.subtrees.includes(planningScope === undefined ? filePath : unprefixRepositoryPath(planningScope.path_prefix, filePath)) === false &&
    !excludedPathSet.has(filePath) &&
    files.every((entry) => entry.path !== (planningScope === undefined ? filePath : unprefixRepositoryPath(planningScope.path_prefix, filePath)))
  );
  const repositoryRisks = repositoryCompositionRisks(planningScope?.unit);
  const projectUnits = prefixProjectUnits({
    units: projectUnitPlan.units,
    pathPrefix: planningScope?.path_prefix,
    repository: planningScope?.reference
  });
  const tooBroad = selectedPaths.length > 50;
  const hasProjectUnitBlockedGuidance =
    projectUnitPlan.blockerMessages.length > 0 || projectUnitPlan.nextActions.length > 0;
  const lowConfidence = scanned.truncated || commandPlan.lowConfidenceReasons.length > 0;
  const blocked =
    unsafePaths.length > 0 ||
    requestedExclusions.length > 0 ||
    missingPaths.length > 0 ||
    tooBroad ||
    (discovery?.discoveryErrors.length ?? 0) > 0 ||
    commandPlan.blockerReasons.length > 0 ||
    projectUnitPlan.units.some((unit) => unit.readiness === "blocked") ||
    repositoryRisks.blocksValidation ||
    repositoryCommands.length === 0;
  const risks = [
    ...(unsafePaths.length > 0
      ? [
          {
            severity: "blocker" as const,
            message: "Unsafe validation target paths were refused.",
            why_this_matters: "Validation targets must be repo-relative paths without shell metacharacters."
          }
        ]
      : []),
    ...(missingPaths.length > 0
      ? [
          {
            severity: "blocker" as const,
            message: "Some requested validation files were not found in the scanned repository.",
            why_this_matters: "The plan can only route validation from known local evidence."
          }
        ]
      : []),
    ...(requestedExclusions.length > 0
      ? [
          {
            severity: "blocker" as const,
            message: "Some requested validation files were excluded by workspace policy.",
            why_this_matters: "Inspect skipped_path_summary.actionable_paths for the exact exclusion reason before changing validation scope."
          }
        ]
      : []),
    ...(tooBroad
      ? [
          {
            severity: "blocker" as const,
            message: "Too many validation target files were requested.",
            why_this_matters: "Narrow the validation target set before relying on a planned command list."
          }
        ]
      : []),
    ...(lowConfidence
      ? [
          {
            severity: "warning" as const,
            message: "Validation discovery is low confidence for at least one repository area.",
            why_this_matters: "Missing configured scripts or truncated scans can leave relevant checks undiscovered."
          }
        ]
      : []),
    ...commandPlan.lowConfidenceReasons.filter(isValidationEnvironmentReason).map((reason) => ({
      severity: "warning" as const,
      message: reason.replace(/^validation-environment: /u, ""),
      why_this_matters: "Validation planning is evidence-driven; advisory environment or missing-script evidence should be checked before treating the plan as complete."
    })),
    ...(hasRuntimeSkippedPath(scanned.skipped_path_population)
      ? [
          {
            severity: "warning" as const,
            message: "Some repository paths were skipped during validation discovery.",
            why_this_matters: "Skipped paths can hide validation config, tests, or generated noise; inspect skipped_path_summary before treating the plan as complete."
          }
        ]
      : []),
    ...commandPlan.blockerReasons.map((reason) => ({
      severity: "blocker" as const,
      message: reason,
      why_this_matters: "Repo-local validation guidance takes precedence over generic language command planning."
    })),
    ...projectUnitPlan.blockerMessages.map((message) => ({
      severity: "blocker" as const,
      message,
      why_this_matters: "Project-unit evidence is bounded by its repository, dependency, and execution-environment authority."
    })),
    ...projectUnitPlan.limitations.map((message) => ({
      severity: "warning" as const,
      message,
      why_this_matters: "Bounded project-unit discovery reports limitations instead of broadening scope or inventing a fallback."
    })),
    ...repositoryRisks.risks,
    ...(repositoryCommands.length === 0 && commandPlan.blockerReasons.length === 0 && !hasProjectUnitBlockedGuidance
      ? [
          {
            severity: "warning" as const,
            message: "No validation command could be planned from current repository evidence.",
            why_this_matters: "Add explicit files or project configuration before treating validation as covered."
          }
        ]
      : [])
  ];
  const status = getCatalogRepoStatus({
    repo_root: scanned.repo_root,
    indexed_roots: scanned.indexed_roots,
    skipped_roots: scanned.skipped_roots,
    files,
    freshness: "unknown"
  });
  const nextActions = capNextActions([
    ...selectedEntries
      .filter((entry) => entry.file_identity.language === "python")
      .map((entry) => ({
        tool: "symbol_search",
        args: {
          query: symbolQueryFromPath(entry.path),
          repo_root: scanned.repo_root
        }
      })),
    ...(repositoryCommands.length === 0 && commandPlan.blockerReasons.length === 0 && !hasProjectUnitBlockedGuidance
      ? [
          {
            tool: "context_for_task",
            args: {
              task: input.request.task ?? "Gather more repository context for validation planning.",
              repo_root: scanned.repo_root,
              files: selectedPaths
            }
          }
        ]
      : []),
    ...projectUnitPlan.nextActions
  ]);
  const plan: VerificationPlan = {
    task: input.request.task,
    repo_root: scanned.repo_root,
    status: blocked ? "blocked" : "planned",
    summary: buildSummary({
      commands,
      staticFeedback,
      blocked,
      risks,
      nextActions
    }),
    planned_commands: repositoryCommands,
    ...(projectUnitPlan.applies ? { project_units: projectUnits } : {}),
    ...(staticFeedback?.status === "actionable" ? { static_feedback: staticFeedback } : {}),
    skipped_path_summary: buildSkippedPathSummary({
      population: scanned.skipped_path_population,
      skippedPaths: scanned.skipped_paths ?? [],
      selectedPaths,
      sourceTruncated: scanned.truncated
    }),
    risks,
    next_actions: nextActions
  };

  return {
    plan,
    meta: {
      ...status.meta,
      verification_status: plan.status,
      truncated: scanned.truncated,
      budget: {
        row_limit: 15000
      }
    }
  };
}

type ProjectUnitPlanningResult = {
  applies: boolean;
  units: ProjectUnitEvidence[];
  commands: PlannedValidationCommand[];
  blockerMessages: string[];
  limitations: string[];
  nextActions: VerificationPlan["next_actions"];
};

type RepositoryPlanningScope = {
  unit: RepositoryUnitEvidence;
  path_prefix: string;
  reference: RepositoryReference;
};

function repositoryCompositionAdmission(
  receipt: RepositoryCompositionReceipt
): RepositoryCompositionAdmissionReceipt {
  return {
    repositories: receipt.repositories.map((unit) => ({
      path_prefix: unit.path_prefix,
      state: unit.state,
      source_available: unit.source_available,
      declaration_path: unit.declaration_path,
      head_gitlink_oid: unit.head_gitlink_oid
    }))
  };
}

function buildRepositoryPlanningScope(input: {
  composition?: RepositoryCompositionReceipt;
  selectedPaths: readonly string[];
}): RepositoryPlanningScope | undefined {
  if (input.composition === undefined || input.selectedPaths.length === 0) {
    return undefined;
  }
  const units = [...input.composition.repositories, ...input.composition.skipped_or_blocked];
  const selectedUnits = input.selectedPaths.map((filePath) => repositoryUnitForPath(units, filePath));
  if (selectedUnits.some((unit) => unit === undefined)) {
    return undefined;
  }
  const keys = new Set(selectedUnits.map((unit) => unit!.repository_key));
  if (keys.size !== 1) {
    return undefined;
  }
  const unit = selectedUnits[0];
  if (unit === undefined || unit.path_prefix === ".") {
    return undefined;
  }
  return {
    unit,
    path_prefix: unit.path_prefix,
    reference: repositoryReference(unit)
  };
}

function selectionCrossesRepositoryBoundary(input: {
  composition?: RepositoryCompositionReceipt;
  selectedPaths: readonly string[];
}): boolean {
  if (input.composition === undefined || input.selectedPaths.length < 2) return false;
  const units = [...input.composition.repositories, ...input.composition.skipped_or_blocked];
  const keys = new Set(input.selectedPaths
    .map((filePath) => repositoryUnitForPath(units, filePath)?.repository_key)
    .filter((key): key is RepositoryUnitEvidence["repository_key"] => key !== undefined));
  return keys.size > 1;
}

function superprojectCatalogEntries(
  entries: readonly FileCatalogEntry[],
  composition: RepositoryCompositionReceipt
): FileCatalogEntry[] {
  const units = [...composition.repositories, ...composition.skipped_or_blocked];
  return entries.filter((entry) => repositoryUnitForPath(units, entry.path)?.repository_key === "superproject");
}

function repositoryUnitForPath(
  units: readonly RepositoryUnitEvidence[],
  filePath: string
): RepositoryUnitEvidence | undefined {
  return [...units]
    .filter((unit) => pathContainsRepositoryPrefix(unit.path_prefix, filePath))
    .sort((left, right) => repositoryPrefixLength(right.path_prefix) - repositoryPrefixLength(left.path_prefix))
    [0];
}

function repositoryReference(unit: RepositoryUnitEvidence): RepositoryReference {
  return {
    repository_key: unit.repository_key,
    path_prefix: unit.path_prefix,
    state: unit.state
  };
}

function localizeCatalogEntries(
  entries: readonly FileCatalogEntry[],
  pathPrefix: string
): FileCatalogEntry[] {
  return entries
    .filter((entry) => pathContainsRepositoryPrefix(pathPrefix, entry.path))
    .map((entry) => ({
      ...entry,
      path: unprefixRepositoryPath(pathPrefix, entry.path)
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function scopedWorkspace(
  workspace: WorkspaceFilePort,
  pathPrefix: string
): WorkspaceFilePort {
  const toGlobal = (filePath: string) => prefixRepositoryPath(pathPrefix, normalizeRepoPath(filePath));
  return {
    readText: (input) => workspace.readText({ path: toGlobal(input.path) }),
    readTextPrefix: workspace.readTextPrefix === undefined
      ? undefined
      : (input) => workspace.readTextPrefix!({ path: toGlobal(input.path), max_bytes: input.max_bytes }),
    readBinary: (input) => workspace.readBinary({ path: toGlobal(input.path) }),
    writeText: (input) => workspace.writeText({
      path: toGlobal(input.path),
      content: input.content,
      overwrite: input.overwrite
    }),
    writeBinary: (input) => workspace.writeBinary({
      path: toGlobal(input.path),
      content: input.content,
      overwrite: input.overwrite
    }),
    stat: (input) => workspace.stat({ path: toGlobal(input.path) }),
    deletePath: (input) => workspace.deletePath({ path: toGlobal(input.path) }),
    ensureDirectory: (input) => workspace.ensureDirectory({ path: toGlobal(input.path) })
  };
}

function applyRepositoryCompositionClaimEvidence(
  units: readonly ProjectUnitEvidence[],
  repositoryUnit: RepositoryUnitEvidence
): ProjectUnitEvidence[] {
  if (repositoryUnit.source_available === false) {
    return units.map((unit) => ({
      ...cloneProjectUnit(unit),
      readiness: "blocked",
      blockers: [
        ...unit.blockers,
        {
          kind: "submodule_unavailable" as const,
          unit_root: unit.root,
          evidence_paths: [...repositoryUnit.evidence_paths],
          message: `Repository ${repositoryUnit.path_prefix} has no locally available source; validation candidates are blocked.`,
          blocked_claims: ["validation_candidate", "repository_traversal"] as const
        }
      ],
      planned_commands: []
    }));
  }
  if (repositoryUnit.claim_blockers.length === 0 && repositoryUnit.state === "initialized") {
    return units.map(cloneProjectUnit);
  }
  return units.map((unit) => {
    const blockedClaims = repositoryUnit.claim_blockers.flatMap((blocker) => blocker.blocked_claims);
    const mappedClaims = uniqueSorted([
      ...(blockedClaims.includes("worktree_cleanliness") ? ["worktree_cleanliness"] : []),
      ...(blockedClaims.includes("pinned_composition") || repositoryUnit.state === "worktree_revision_mismatch"
        ? ["diff_completeness"]
        : [])
    ]) as Array<"worktree_cleanliness" | "diff_completeness">;
    if (mappedClaims.length === 0 && repositoryUnit.state !== "worktree_revision_mismatch") {
      return cloneProjectUnit(unit);
    }
    return {
      ...cloneProjectUnit(unit),
      readiness: unit.readiness === "ready" ? "limited" : unit.readiness,
      blockers: [
        ...unit.blockers,
        {
          kind: "git_claim_unavailable" as const,
          unit_root: unit.root,
          evidence_paths: uniqueSorted(repositoryUnit.evidence_paths),
          message: repositoryUnit.state === "worktree_revision_mismatch"
            ? `Repository ${repositoryUnit.path_prefix} source is readable, but its worktree revision does not match the parent gitlink; pinned-composition and diff-completeness claims are blocked.`
            : `Repository ${repositoryUnit.path_prefix} source is readable, but Git metadata is incomplete; dependent repository claims are blocked.`,
          blocked_claims: mappedClaims.length === 0 ? ["diff_completeness"] : mappedClaims
        }
      ]
    };
  });
}

function repositoryCompositionRisks(unit?: RepositoryUnitEvidence): {
  blocksValidation: boolean;
  risks: VerificationPlan["risks"];
} {
  if (unit === undefined) {
    return { blocksValidation: false, risks: [] };
  }
  if (unit.source_available === false) {
    return {
      blocksValidation: true,
      risks: [{
        severity: "blocker" as const,
        message: `Selected repository ${unit.path_prefix} has no locally available source.`,
        why_this_matters: "Validation planning cannot invent commands for an uninitialized or blocked submodule."
      }]
    };
  }
  if (unit.state === "worktree_revision_mismatch" || unit.state === "metadata_unavailable" || unit.claim_blockers.length > 0) {
    return {
      blocksValidation: false,
      risks: [{
        severity: "warning" as const,
        message: `Selected repository ${unit.path_prefix} has readable source but limited Git claim authority.`,
        why_this_matters: "The plan can use repository-local source evidence, but pinned-composition, diff, or worktree-cleanliness claims may remain blocked."
      }]
    };
  }
  return { blocksValidation: false, risks: [] };
}

function attachRepositoryToCommands(
  commands: readonly PlannedValidationCommand[],
  repository?: RepositoryReference
): PlannedValidationCommand[] {
  return commands.map((command) => ({
    ...command,
    repository: command.repository ?? repository
  }));
}

function prefixProjectUnits(input: {
  units: readonly ProjectUnitEvidence[];
  pathPrefix?: string;
  repository?: RepositoryReference;
}): ProjectUnitEvidence[] {
  return input.units.map((unit) => ({
    ...unit,
    root: input.pathPrefix === undefined ? unit.root : prefixRepositoryPath(input.pathPrefix, unit.root),
    repository: unit.repository ?? input.repository,
    markers: unit.markers.map((marker) => ({
      ...marker,
      path: input.pathPrefix === undefined ? marker.path : prefixRepositoryPath(input.pathPrefix, marker.path),
      evidence_path: marker.evidence_path === undefined || input.pathPrefix === undefined
        ? marker.evidence_path
        : prefixRepositoryPath(input.pathPrefix, marker.evidence_path)
    })),
    blockers: unit.blockers.map((blocker) => ({
      ...blocker,
      unit_root: input.pathPrefix === undefined ? blocker.unit_root : prefixRepositoryPath(input.pathPrefix, blocker.unit_root),
      evidence_paths: input.pathPrefix === undefined
        ? blocker.evidence_paths
        : blocker.evidence_paths.map((evidencePath) => prefixRepositoryPath(input.pathPrefix!, evidencePath))
    })),
    planned_commands: attachRepositoryToCommands(unit.planned_commands, input.repository)
  }));
}

function prefixStaticFeedback(
  feedback: StaticFeedback,
  pathPrefix?: string
): StaticFeedback {
  if (pathPrefix === undefined) {
    return feedback;
  }
  return {
    status: feedback.status,
    checked_files: feedback.checked_files.map((filePath) => prefixRepositoryPath(pathPrefix, filePath)),
    findings: feedback.findings.map((finding) => ({
      ...finding,
      path: prefixRepositoryPath(pathPrefix, finding.path)
    }))
  };
}

function cloneProjectUnit(unit: ProjectUnitEvidence): ProjectUnitEvidence {
  return {
    ...unit,
    markers: [...unit.markers],
    blockers: [...unit.blockers],
    planned_commands: [...unit.planned_commands]
  };
}

function prefixRepositoryPath(pathPrefix: string, filePath: string): string {
  const normalizedPrefix = normalizeRepoPath(pathPrefix);
  const normalizedPath = normalizeRepoPath(filePath);
  if (normalizedPrefix === ".") {
    return normalizedPath;
  }
  if (normalizedPath === ".") {
    return normalizedPrefix;
  }
  return `${normalizedPrefix}/${normalizedPath}`;
}

function unprefixRepositoryPath(pathPrefix: string, filePath: string): string {
  const normalizedPrefix = normalizeRepoPath(pathPrefix);
  const normalizedPath = normalizeRepoPath(filePath);
  if (normalizedPrefix === ".") {
    return normalizedPath;
  }
  if (normalizedPath === normalizedPrefix) {
    return ".";
  }
  return normalizedPath.startsWith(`${normalizedPrefix}/`)
    ? normalizedPath.slice(normalizedPrefix.length + 1)
    : normalizedPath;
}

function pathContainsRepositoryPrefix(pathPrefix: string, filePath: string): boolean {
  const normalizedPrefix = normalizeRepoPath(pathPrefix);
  const normalizedPath = normalizeRepoPath(filePath);
  return normalizedPrefix === "." ||
    normalizedPath === normalizedPrefix ||
    normalizedPath.startsWith(`${normalizedPrefix}/`);
}

function repositoryPrefixLength(pathPrefix: string): number {
  return pathPrefix === "." ? 0 : pathPrefix.split("/").length;
}

async function planProjectUnitValidation(input: {
  files: readonly FileCatalogEntry[];
  selectedPaths: readonly string[];
  selectedSubtrees: readonly string[];
  workspace: WorkspaceFilePort;
  skippedPaths: readonly FileCatalogSkippedPath[];
  maxCommands: number;
  repositoryUnit?: RepositoryUnitEvidence;
}): Promise<ProjectUnitPlanningResult> {
  const scriptGuidance = await discoverProjectUnitScriptGuidance(input.workspace, input.files);
  const markerRecognition = recognizeProjectUnitMarkers({
    files: input.files,
    script_guidance: scriptGuidance
  });
  const boundaryDiscovery = await discoverRepositoryBoundaries({
    workspace: input.workspace,
    skipped_paths: input.skippedPaths
  });
  const discovery = discoverProjectUnits({
    candidates: markerRecognition.candidates,
    selected_paths: input.selectedPaths,
    selected_subtrees: input.selectedSubtrees
  });
  const selectedBoundaries = uniqueSorted([...input.selectedPaths, ...input.selectedSubtrees])
    .map((selectedPath) => boundaryForPath(selectedPath, boundaryDiscovery.boundaries))
    .filter((boundary): boundary is NonNullable<typeof boundary> => boundary !== undefined);
  const applies = discovery.units.length > 0 || selectedBoundaries.length > 0;
  if (!applies) {
    return { applies: false, units: [], commands: [], blockerMessages: [], limitations: [], nextActions: [] };
  }

  const protocol = await discoverValidationProtocol(input.workspace);
  const plannedUnits: ProjectUnitEvidence[] = [];
  for (const unit of discovery.units) {
    const boundary = boundaryForPath(unit.root, boundaryDiscovery.boundaries) ??
      unit.markers.map((marker) => boundaryForPath(marker.path, boundaryDiscovery.boundaries)).find((item) => item !== undefined);
    const commandPlan = boundary === undefined
      ? await planExistingProjectUnitCommands({
          unit,
          files: input.files,
          selectedPaths: input.selectedPaths,
          selectedSubtrees: input.selectedSubtrees,
          workspace: input.workspace,
          maxCommands: input.maxCommands
        })
      : { commands: [], blockerReasons: [] };
    const fallbackCommand = commandPlan.commands.length === 0 &&
      (unit.kind === "repository_script" || !hostCommandsBlocked(protocol))
      ? projectUnitCommand(unit)
      : undefined;
    const commands = commandPlan.commands.length > 0
      ? commandPlan.commands
      : fallbackCommand === undefined ? [] : [fallbackCommand];
    const environmentBlocked = boundary === undefined &&
      unit.kind !== "repository_script" &&
      hostCommandsBlocked(protocol) &&
      commands.length === 0;
    plannedUnits.push(assessProjectUnitReadiness({
      root: unit.root,
      kind: unit.kind,
      markers: unit.markers,
      selection: unit.selection === "broad_request_coherent_root" ? "explicit_aggregator" : unit.selection,
      boundary: boundary?.boundary ?? "same_repository",
      planned_commands: commands,
      dependency: { status: "ready", evidence_paths: unit.markers.map((marker) => marker.path) },
      environment: environmentBlocked
        ? {
            status: "unknown",
            detail: commandPlan.blockerReasons[0] ?? hostCommandBlockedReason(protocol, projectUnitFamilyLabel(unit.kind)),
            evidence_paths: protocol.evidencePaths
          }
        : { status: "ready", evidence_paths: unit.markers.map((marker) => marker.path) },
      blockers: boundary === undefined ? [] : [boundary.blocker]
    }));
  }
  const units = input.repositoryUnit === undefined
    ? applyRepositoryGitClaimEvidence(plannedUnits, await inspectRepositoryGitClaims(input.workspace))
    : applyRepositoryCompositionClaimEvidence(plannedUnits, input.repositoryUnit);
  const commands = units
    .filter((unit) => unit.readiness !== "blocked")
    .flatMap((unit) => unit.planned_commands)
    .filter((command, index, all) => all.findIndex((candidate) =>
      candidate.command === command.command && JSON.stringify(candidate.args) === JSON.stringify(command.args)
    ) === index)
    .sort((left, right) => left.display.localeCompare(right.display))
    .slice(0, input.maxCommands);
  const blockerMessages = uniqueSorted([
    ...units.filter((unit) => unit.readiness === "blocked").flatMap((unit) =>
      unit.blockers
        .filter((blocker) => blocker.blocked_claims.some((claim) => claim === "validation_candidate" || claim === "repository_traversal"))
        .map((blocker) => blocker.message)
    ),
    ...selectedBoundaries.map((boundary) => boundary.blocker.message)
  ]);
  const limitations = uniqueSorted([
    ...markerRecognition.limitations.map((item) => item.message),
    ...boundaryDiscovery.limitations.map((item) => item.message),
    ...discovery.limitations.map((item) => item.message)
  ]);
  return {
    applies,
    units,
    commands,
    blockerMessages,
    limitations,
    nextActions: projectUnitNextActions(units)
  };
}

async function planExistingProjectUnitCommands(input: {
  unit: ReturnType<typeof discoverProjectUnits>["units"][number];
  files: readonly FileCatalogEntry[];
  selectedPaths: readonly string[];
  selectedSubtrees: readonly string[];
  workspace: WorkspaceFilePort;
  maxCommands: number;
}): Promise<CommandPlanningResult> {
  const unitFiles = input.files.filter((file) =>
    input.unit.root === "." || file.path === input.unit.root || file.path.startsWith(`${input.unit.root}/`)
  );
  const selected = [...input.selectedPaths, ...input.selectedSubtrees].filter((selectedPath) =>
    input.unit.root === "." || selectedPath === input.unit.root || selectedPath.startsWith(`${input.unit.root}/`)
  );
  const selectedEntries = selectEntries(unitFiles, selected);
  const railsShape = detectRailsProjectShape({ files: unitFiles, scan_truncated: false });
  const discovery = await discoverValidationEvidence({
    files: unitFiles,
    selectedEntries,
    railsShape,
    workspace: input.workspace
  });
  const planned = planValidationCommands({
    files: unitFiles,
    selectedEntries,
    discovery,
    maxCommands: input.maxCommands
  });
  return {
    ...planned,
    commands: planned.blockerReasons.length > 0
      ? []
      : planned.commands.filter((command) => command.command !== "manual_review")
  };
}

function projectUnitFamilyLabel(kind: ProjectUnitEvidence["kind"]): string {
  if (kind === "dotnet") return ".NET";
  if (kind === "maven") return "Maven";
  if (kind === "cargo") return "Cargo";
  return "repository-script";
}

function projectUnitCommand(unit: ReturnType<typeof discoverProjectUnits>["units"][number]): PlannedValidationCommand | undefined {
  const marker = unit.markers[0];
  if (marker === undefined) return undefined;
  const planned = (() => {
    switch (unit.kind) {
      case "dotnet":
        return { command: "dotnet", args: ["build", marker.path] };
      case "maven":
        return { command: "mvn", args: ["-f", marker.path, "test"] };
      case "cargo":
        return { command: "cargo", args: ["test", "--manifest-path", marker.path] };
      case "repository_script":
        return { command: marker.path, args: [] };
    }
  })();
  const decision = planCommand({ ...planned, source: "configured" });
  if (!decision.allowed) return undefined;
  const display = [decision.command.command, ...decision.command.args].join(" ");
  return {
    command: decision.command.command,
    args: decision.command.args,
    display,
    reason: `Project unit ${unit.root} uses marker evidence ${marker.path}; this command is planned only and was not executed.`,
    status: "planned",
    execution: "not_executed"
  };
}

async function discoverProjectUnitScriptGuidance(
  workspace: WorkspaceFilePort,
  files: readonly FileCatalogEntry[]
): Promise<ScriptMarkerGuidance[]> {
  const paths = new Set(files.map((file) => file.path));
  const extensionlessPaths = [...paths].filter((filePath) =>
    path.posix.extname(filePath) === "" && filePath.includes("/")
  );
  const guidancePaths = [...paths].filter((filePath) =>
    path.posix.basename(filePath) === "AGENTS.md" ||
    /(?:^|\/)validation-protocol\.md$/iu.test(filePath)
  ).sort();
  const guidance: ScriptMarkerGuidance[] = [];
  for (const guidancePath of guidancePaths) {
    const stat = await inputStat(workspace, guidancePath);
    if (stat === undefined || stat.size_bytes > 128_000) continue;
    let content: string;
    try {
      content = workspace.readTextPrefix === undefined
        ? await workspace.readText({ path: guidancePath })
        : await workspace.readTextPrefix({ path: guidancePath, max_bytes: 128_000 });
    } catch {
      continue;
    }
    for (const scriptPath of extensionlessPaths) {
      if (!content.includes(`\`${scriptPath}\``)) continue;
      const localEvidence = content.split(/\r?\n/u).filter((line, index, lines) =>
        line.includes(scriptPath) || lines[index - 1]?.includes(scriptPath) || lines[index + 1]?.includes(scriptPath)
      ).join(" ");
      guidance.push({
        script_path: scriptPath,
        evidence_path: guidancePath,
        evidence_source: /validation-protocol\.md$/iu.test(guidancePath) ? "validation_protocol" : "repository_guidance",
        purpose: localEvidence
      });
    }
  }
  return guidance;
}

async function classifySelectedScope(
  workspace: WorkspaceFilePort,
  selectedPaths: readonly string[]
): Promise<{ files: string[]; subtrees: string[] }> {
  const files: string[] = [];
  const subtrees: string[] = [];
  for (const selectedPath of selectedPaths) {
    const stat = await inputStat(workspace, selectedPath);
    if (stat !== undefined && stat.exists && !stat.is_file) subtrees.push(selectedPath);
    else files.push(selectedPath);
  }
  return { files: uniqueSorted(files), subtrees: uniqueSorted(subtrees) };
}

async function inputStat(workspace: WorkspaceFilePort, filePath: string) {
  try { return await workspace.stat({ path: filePath }); } catch { return undefined; }
}

function buildSkippedPathSummary(input: {
  population: FileCatalogScanResult["skipped_path_population"];
  skippedPaths: readonly FileCatalogSkippedPath[];
  selectedPaths: readonly string[];
  sourceTruncated: boolean;
}): VerificationPlan["skipped_path_summary"] {
  if (input.population.total_count === 0) {
    return undefined;
  }
  const selected = new Set(input.selectedPaths);
  const actionablePaths: SkippedPath[] = input.skippedPaths
    .filter((skipped) => selected.has(skipped.path))
    .sort((left, right) => left.path.localeCompare(right.path) || left.reason.localeCompare(right.reason))
    .slice(0, 50)
    .map((skipped) => ({ path: skipped.path, reason: skipped.reason, detail: skipped.detail }));
  return {
    total_count: input.population.total_count,
    groups: input.population.groups.map((group) => ({
      ...group,
      sample_paths: [...group.sample_paths]
    })),
    count_basis: "scanner_observed_unique_reason_path",
    source_truncated: input.sourceTruncated,
    actionable_paths: actionablePaths
  };
}

function hasRuntimeSkippedPath(population: FileCatalogScanResult["skipped_path_population"]): boolean {
  return population.groups.some((group) =>
    ["permission_denied", "missing", "not_directory", "workspace_escape"].includes(group.reason)
  );
}

async function mergeDirectValidationEntries(input: {
  scannedFiles: readonly FileCatalogEntry[];
  selectedPaths: readonly string[];
  workspace: WorkspaceFilePort;
}): Promise<FileCatalogEntry[]> {
  const byPath = new Map(input.scannedFiles.map((file) => [file.path, file]));
  for (const filePath of uniqueSorted([
    ...input.selectedPaths,
    ...projectShapeConfigCandidates(input.selectedPaths),
    "package.json",
    "package-lock.json",
    "npm-shrinkwrap.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
    "pnpm-workspace.yaml",
    "pnpm-workspace.yml",
    "nx.json",
    "turbo.json",
    "pyproject.toml",
    "go.mod",
    "go.work",
    "Makefile",
    "CMakeLists.txt",
    "template.yaml",
    "template.yml",
    "template.json",
    "mcp.json",
    "mcp-server.json",
    ".well-known/mcp/server-card.json"
  ])) {
    if (byPath.has(filePath)) {
      continue;
    }
    if (!isExplicitHiddenCatalogPathAllowed(filePath)) {
      continue;
    }
    const stat = await input.workspace.stat({ path: filePath });
    if (!stat.exists || !stat.is_file) {
      continue;
    }
    byPath.set(
      filePath,
      buildStatBackedFileCatalogEntry({
        path: filePath,
        size_bytes: stat.size_bytes,
        mtime_ms: stat.mtime_ms
      })
    );
  }
  return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
}

async function discoverValidationEvidence(input: {
  files: readonly FileCatalogEntry[];
  selectedEntries: readonly FileCatalogEntry[];
  railsShape: RailsProjectShape;
  workspace: WorkspaceFilePort;
}): Promise<ValidationDiscovery> {
  const paths = new Set(input.files.map((file) => file.path));
  const packageManager = detectPackageManager(paths);
  const packageDiscovery = await discoverPackageScripts({
    workspace: input.workspace,
    packageJsonPaths: [...paths].filter((filePath) => path.posix.basename(filePath) === "package.json"),
    packageManager,
    allPaths: paths
  });
  const validationProtocol = await discoverValidationProtocol(input.workspace);

  return {
    packageScripts: packageDiscovery.packages,
    discoveryErrors: [...packageDiscovery.errors, ...validationProtocol.errors],
    validationProtocol,
    hasPyproject: paths.has("pyproject.toml"),
    hasGoMod: paths.has("go.mod"),
    hasGoWork: paths.has("go.work"),
    hasMakefile: paths.has("Makefile") || paths.has("makefile"),
    hasRootCMake: paths.has("CMakeLists.txt"),
    localCMakeFiles: [...paths].filter((filePath) => filePath.endsWith("/CMakeLists.txt")).sort(),
    cmakeTargets: await discoverCMakeTargets({
      workspace: input.workspace,
      cmakeFiles: [...paths].filter((filePath) => filePath === "CMakeLists.txt" || filePath.endsWith("/CMakeLists.txt")).sort()
    }),
    rubyValidationCommands: discoverRubyValidationCommands({
      files: input.files,
      selectedEntries: input.selectedEntries,
      railsRoots: input.railsShape.rails_roots
    }),
    railsShape: input.railsShape,
    dotnetSolutions: [...paths].filter((filePath) => lowerExtension(filePath) === ".sln").sort(),
    dotnetProjects: [...paths].filter((filePath) => isDotnetProjectPath(filePath)).sort(),
    dotnetTestProjects: [...paths].filter((filePath) => isDotnetProjectPath(filePath) && isDotnetTestProjectPath(filePath)).sort(),
    samTemplates: [...paths].filter(isSamTemplatePath).sort(),
    samInfraTests: [...paths].filter(isSamInfraTestPath).sort(),
    goCiCommands: await discoverGoCiCommands({
      workflowPaths: [...paths].filter(isGithubWorkflowPath).sort(),
      workspace: input.workspace
    }),
    mcpShape: detectMcpServerShape(paths),
    pythonNearestTests: await discoverPythonNearestTests({
      files: input.files,
      selectedEntries: input.selectedEntries,
      workspace: input.workspace
    })
  };
}

type ValidationDiscovery = {
  packageScripts: PackageScriptEvidence[];
  discoveryErrors: string[];
  validationProtocol: ValidationProtocolDiscovery;
  hasPyproject: boolean;
  hasGoMod: boolean;
  hasGoWork: boolean;
  hasMakefile: boolean;
  hasRootCMake: boolean;
  localCMakeFiles: string[];
  cmakeTargets: CMakeTargetEvidence[];
  rubyValidationCommands: RubyValidationCommandCandidate[];
  railsShape: RailsProjectShape;
  dotnetSolutions: string[];
  dotnetProjects: string[];
  dotnetTestProjects: string[];
  samTemplates: string[];
  samInfraTests: string[];
  goCiCommands: PlannedValidationCommand[];
  mcpShape: McpServerShape;
  pythonNearestTests: PlannedValidationCommand[];
};

type CommandPlanningResult = {
  commands: PlannedValidationCommand[];
  lowConfidenceReasons: string[];
  blockerReasons: string[];
};

function planValidationCommands(input: {
  files: readonly FileCatalogEntry[];
  selectedEntries: readonly FileCatalogEntry[];
  discovery: ValidationDiscovery;
  task?: string;
  maxCommands: number;
}): CommandPlanningResult {
  const selectedLanguages = new Set(input.selectedEntries.map((file) => file.file_identity.language));
  const commands: PlannedValidationCommand[] = [];
  const lowConfidenceReasons: string[] = [...input.discovery.discoveryErrors];
  const blockerReasons: string[] = [];
  const includeAll = input.selectedEntries.length === 0;
  const hasGoFiles = input.files.some((file) => file.file_identity.language === "go");
  const hasCppFiles = input.files.some((file) => file.file_identity.language === "cpp" || file.file_identity.language === "c");
  const hasDotnetFiles = input.files.some((file) => file.file_identity.language === "csharp" || isDotnetProjectPath(file.path));
  const hasDocsOrConfigFiles = input.files.some((file) => isDocsOrConfigLanguage(file.file_identity.language));
  const hasSamTemplate = input.discovery.samTemplates.length > 0;
  const goShapeSelected = input.discovery.hasGoMod && (includeAll ? hasGoFiles : selectedLanguages.has("go"));
  const cmakeShapeSelected =
    (input.discovery.hasRootCMake || input.discovery.localCMakeFiles.length > 0) &&
    (includeAll ? hasCppFiles : hasAny(selectedLanguages, ["c", "cpp"]));
  const dotnetShapeSelected =
    (input.discovery.dotnetSolutions.length > 0 || input.discovery.dotnetProjects.length > 0) &&
    (includeAll || selectedLanguages.has("csharp") || input.selectedEntries.some((file) => isDotnetProjectPath(file.path)));
  const samShapeSelected =
    hasSamTemplate &&
    (includeAll || input.selectedEntries.some((file) => isSamRelatedPath(file.path)));
  const mcpShapeSelected =
    input.discovery.mcpShape.detected &&
    (includeAll ||
      input.selectedEntries.some((file) => isMcpServerEvidencePath(file.path)) ||
      input.selectedEntries.some((file) => file.path === "package.json") ||
      taskMentionsMcp(input.task));
  const rubyShapeSelected =
    input.discovery.rubyValidationCommands.length > 0 &&
    (includeAll
      ? input.discovery.railsShape.rails_roots.length > 0
      : input.selectedEntries.some((file) => isRailsValidationSelection(file, input.discovery.railsShape)));
  const pluginIntegrationSelected =
    taskMentionsPluginIntegration(input.task) ||
    input.selectedEntries.some(isPluginIntegrationEvidencePath);
  const selectedPackageScripts = selectPackageScripts({
    packages: input.discovery.packageScripts,
    selectedEntries: input.selectedEntries,
    includeAll
  });

  commands.push(
    ...input.discovery.validationProtocol.policyCommands,
    ...input.discovery.validationProtocol.guidanceCommands
  );
  if (!hostCommandsBlocked(input.discovery.validationProtocol)) {
    lowConfidenceReasons.push(
      ...input.discovery.validationProtocol.environmentEvidence.map(
        (evidence) => `validation-environment: ${evidence.path} is validation-environment evidence (${evidence.detail}) but does not prove host commands are unsafe without repo guidance or policy.`
      )
    );
  }

  if (goShapeSelected) {
    if (hostCommandsBlocked(input.discovery.validationProtocol) || input.discovery.validationProtocol.prohibitsHostGoTest) {
      if (repoCommandsCoverHostSuppression(input.discovery.validationProtocol) === false) {
        blockerReasons.push(hostCommandBlockedReason(input.discovery.validationProtocol, "Go"));
      }
    } else {
      if (input.discovery.goCiCommands.length > 0) {
        commands.push(...input.discovery.goCiCommands);
      } else if (input.discovery.hasMakefile) {
        commands.push({
          command: "make",
          args: ["test"],
          display: "make test",
          reason: "Makefile and Go project files indicate repository-specific Go validation may be available.",
          status: "planned",
          execution: "not_executed"
        });
      } else {
        commands.push({
          command: "go",
          args: ["test", "./..."],
          display: "go test ./...",
          reason: input.discovery.hasGoWork
            ? "go.work/go.mod and Go source files indicate workspace-wide Go tests are the primary validation path."
            : "go.mod and Go source files indicate Go tests are the primary validation path.",
          status: "planned",
          execution: "not_executed"
        });
      }
    }
  }

  if (cmakeShapeSelected) {
    if (hostCommandsBlocked(input.discovery.validationProtocol)) {
      if (repoCommandsCoverHostSuppression(input.discovery.validationProtocol) === false) {
        blockerReasons.push(hostCommandBlockedReason(input.discovery.validationProtocol, "CMake"));
      }
    } else {
      commands.push(...cmakeValidationCommands({
        discovery: input.discovery,
        selectedEntries: input.selectedEntries,
        includeAll
      }));
    }
  }

  if (dotnetShapeSelected) {
    if (hostCommandsBlocked(input.discovery.validationProtocol)) {
      if (repoCommandsCoverHostSuppression(input.discovery.validationProtocol) === false) {
        blockerReasons.push(hostCommandBlockedReason(input.discovery.validationProtocol, ".NET"));
      }
    } else {
      const selectedDotnetProject = nearestDotnetProject({
        selectedEntries: input.selectedEntries,
        projects: input.discovery.dotnetProjects
      });
      if (selectedDotnetProject !== undefined) {
        commands.push({
          command: "dotnet",
          args: ["build", selectedDotnetProject],
          display: `dotnet build ${selectedDotnetProject}`,
          reason: `${selectedDotnetProject} is the nearest .NET project for selected files.`,
          status: "planned",
          execution: "not_executed"
        });
      }
      const solution = input.discovery.dotnetSolutions[0];
      if (solution !== undefined) {
        commands.push({
          command: "dotnet",
          args: ["build", solution],
          display: `dotnet build ${solution}`,
          reason: `${solution} is the repository solution file for broader .NET validation.`,
          status: "planned",
          execution: "not_executed"
        });
      } else if (selectedDotnetProject === undefined && input.discovery.dotnetProjects[0] !== undefined) {
        const project = input.discovery.dotnetProjects[0];
        commands.push({
          command: "dotnet",
          args: ["build", project],
          display: `dotnet build ${project}`,
          reason: `${project} is available .NET project evidence.`,
          status: "planned",
          execution: "not_executed"
        });
      }
      for (const testProject of dotnetTestTargets({
        selectedEntries: input.selectedEntries,
        selectedProject: selectedDotnetProject,
        testProjects: input.discovery.dotnetTestProjects
      })) {
        commands.push({
          command: "dotnet",
          args: ["test", testProject],
          display: `dotnet test ${testProject}`,
          reason: `${testProject} is test-project evidence for .NET validation.`,
          status: "planned",
          execution: "not_executed"
        });
      }
      if (!hasDotnetFiles) {
        lowConfidenceReasons.push("dotnet project files were present but no C#/Razor files were selected");
      }
    }
  }

  if (samShapeSelected) {
    if (hostCommandsBlocked(input.discovery.validationProtocol)) {
      if (repoCommandsCoverHostSuppression(input.discovery.validationProtocol) === false) {
        blockerReasons.push(hostCommandBlockedReason(input.discovery.validationProtocol, "SAM/CloudFormation"));
      }
    } else if (!guidanceCommandsCoverFamily(input.discovery.validationProtocol, "sam")) {
      for (const template of selectSamTemplates({
        templates: input.discovery.samTemplates,
        selectedEntries: input.selectedEntries,
        includeAll
      }).slice(0, 2)) {
        commands.push({
          command: "cfn-lint",
          args: [template],
          display: `cfn-lint ${template}`,
          reason: `${template} is SAM/CloudFormation template evidence; cfn-lint is planned but not executed.`,
          status: "planned",
          execution: "not_executed"
        });
        commands.push({
          command: "sam",
          args: ["validate", "--template-file", template],
          display: `sam validate --template-file ${template}`,
          reason: `${template} is SAM template evidence; SAM validation is planned but not executed.`,
          status: "planned",
          execution: "not_executed"
        });
      }
      for (const testPath of input.discovery.samInfraTests.slice(0, 2)) {
        commands.push({
          command: "python3",
          args: ["-m", "pytest", testPath],
          display: `python3 -m pytest ${testPath}`,
          reason: `${testPath} is infrastructure test evidence near SAM/CloudFormation templates.`,
          status: "planned",
          execution: "not_executed"
        });
      }
    }
  }

  if (mcpShapeSelected) {
    if (hostCommandsBlocked(input.discovery.validationProtocol)) {
      if (repoCommandsCoverHostSuppression(input.discovery.validationProtocol) === false) {
        blockerReasons.push(hostCommandBlockedReason(input.discovery.validationProtocol, "MCP server"));
      }
    } else {
      commands.push(...mcpServerValidationCommands({
        packages: selectedPackageScripts,
        shape: input.discovery.mcpShape
      }));
    }
  }

  if (rubyShapeSelected) {
    if (hostCommandsBlocked(input.discovery.validationProtocol)) {
      if (repoCommandsCoverHostSuppression(input.discovery.validationProtocol) === false) {
        blockerReasons.push(hostCommandBlockedReason(input.discovery.validationProtocol, "Ruby/Rails"));
      }
    } else {
      const rubyCommand = selectRubyValidationCommand(input.discovery.rubyValidationCommands);
      if (rubyCommand !== undefined && !hasPlannedCommand(commands, rubyCommand)) {
        const decision = planCommand({
          command: rubyCommand.command,
          args: rubyCommand.args,
          source: "discovered"
        });
        if (decision.allowed) {
          commands.push({
            command: decision.command.command,
            args: decision.command.args,
            display: rubyCommand.display,
            reason: rubyCommand.reason,
            status: "planned",
            execution: "not_executed"
          });
        } else {
          lowConfidenceReasons.push(
            `validation-command-safety: ${decision.message}`
          );
        }
      }
    }
  }

  if (
    selectedPackageScripts.length > 0 &&
    !goShapeSelected &&
    !cmakeShapeSelected &&
    !dotnetShapeSelected &&
    !samShapeSelected &&
    !mcpShapeSelected &&
    (includeAll || hasAny(selectedLanguages, ["typescript", "javascript", "json"]))
  ) {
    if (hostCommandsBlocked(input.discovery.validationProtocol)) {
      if (repoCommandsCoverHostSuppression(input.discovery.validationProtocol) === false) {
        blockerReasons.push(hostCommandBlockedReason(input.discovery.validationProtocol, "JavaScript/TypeScript"));
      }
    } else {
      commands.push(
        ...configuredPackageCommands(selectedPackageScripts, [
          ...(pluginIntegrationSelected
            ? [
                {
                  script: "validate:plugin",
                  reason: "Configured plugin validation script is relevant to the selected integration change."
                },
                {
                  script: "validate:skills",
                  reason: "Configured skill validation script checks the skills packaged with the selected integration."
                },
                {
                  script: "pack:dry-run",
                  reason: "Configured package dry-run script checks the distributable payload for the selected integration."
                }
              ]
            : []),
          {
            script: "typecheck",
            reason: "Configured package script indicates type checking is available for JavaScript/TypeScript validation."
          },
          {
            script: "lint",
            reason: "Configured package script indicates lint validation is available."
          },
          {
            script: "format:check",
            reason: "Configured package script indicates formatter validation is available without mutating files."
          },
          {
            script: "test",
            reason: "Configured package script indicates the JavaScript/TypeScript test suite is available."
          },
          {
            script: "test:client",
            reason: "Configured package script indicates client-side JavaScript/TypeScript tests are available."
          },
          {
            script: "test:api",
            reason: "Configured package script indicates API JavaScript/TypeScript tests are available."
          },
          {
            script: "test:e2e",
            reason: "Configured package script indicates end-to-end JavaScript/TypeScript tests are available."
          }
        ])
      );
    }
    for (const script of ["typecheck", "lint", "format:check", "test"]) {
      if (selectedPackageScripts.every((pkg) => pkg.scripts[script] === undefined)) {
        lowConfidenceReasons.push(`missing selected package script: ${script}`);
      }
    }
  }

  if (
    input.discovery.hasPyproject &&
    (includeAll || selectedLanguages.has("python") || input.selectedEntries.some((file) => file.path === "pyproject.toml"))
  ) {
    if (hostCommandsBlocked(input.discovery.validationProtocol)) {
      if (repoCommandsCoverHostSuppression(input.discovery.validationProtocol) === false) {
        blockerReasons.push(hostCommandBlockedReason(input.discovery.validationProtocol, "Python"));
      }
    } else {
      commands.push(...input.discovery.pythonNearestTests);
      commands.push({
        command: "python3",
        args: ["-m", "pytest"],
        display: "python3 -m pytest",
        reason:
          input.discovery.pythonNearestTests.length > 0
            ? "Broad pytest remains as deferred fallback after nearest-test targets."
            : "pyproject.toml and Python files indicate pytest is the available validation path.",
        status: "planned",
        execution: "not_executed"
      });
    }
  }

  if (
    input.selectedEntries.some((file) => isDocsOrConfigLanguage(file.file_identity.language)) ||
    (includeAll && hasDocsOrConfigFiles)
  ) {
    const markdownCommands = markdownQualityCommands({
      files: input.files,
      selectedEntries: input.selectedEntries,
      includeAll
    });
    commands.push(...markdownCommands);
    if (markdownCommands.length === 0 || input.selectedEntries.some((file) => file.file_identity.language !== "markdown")) {
      commands.push({
        command: "manual_review",
        args: ["docs-config-syntax"],
        display: "planned docs/config syntax review",
        reason: includeAll && input.selectedEntries.length === 0
          ? "Repository documentation or configuration files are present; syntax/readability checks are planned, not executed."
          : "Documentation or configuration files changed; syntax/readability checks are planned, not executed.",
        status: "planned",
        execution: "not_executed"
      });
    }
  }

  return {
    commands: commands.slice(0, input.maxCommands),
    lowConfidenceReasons,
    blockerReasons
  };
}

function taskMentionsPluginIntegration(task: string | undefined): boolean {
  return task !== undefined && /\b(?:plugin|plugins|hook|hooks|skill|skills|package|packaging)\b/iu.test(task);
}

function selectRubyValidationCommand(
  candidates: readonly RubyValidationCommandCandidate[]
): RubyValidationCommandCandidate | undefined {
  return candidates[0];
}

function hasPlannedCommand(
  commands: readonly PlannedValidationCommandLike[],
  candidate: RubyValidationCommandCandidate
): boolean {
  return commands.some((command) =>
    isRubyPolicyEquivalent(command, candidate) ||
    (command.command === candidate.command &&
      command.args.length === candidate.args.length &&
      command.args.every((arg, index) => candidate.args[index] === arg) &&
      command.display === candidate.display)
  );
}

function isRubyPolicyEquivalent(
  command: PlannedValidationCommandLike,
  candidate: RubyValidationCommandCandidate
): boolean {
  if (command.command !== "bundle" || command.args.length < 2 || command.args[0] !== "exec") {
    return false;
  }
  if (candidate.family === "rspec") {
    return command.args[1] === "rspec" && candidate.args[1] === "rspec";
  }
  if (candidate.family === "minitest") {
    return (
      command.args[1] === "ruby" &&
      command.args[2] === "-I" &&
      candidate.args[0] === "exec" &&
      candidate.args[1] === "ruby" &&
      candidate.args[2] === "-I" &&
      command.args[3] === candidate.args[3]
    );
  }
  return false;
}

type PlannedValidationCommandLike = Pick<PlannedValidationCommand, "command" | "args" | "display">;

function isRailsValidationSelection(file: FileCatalogEntry, shape: RailsProjectShape): boolean {
  if (file.file_identity.language === "ruby") {
    return true;
  }
  const basename = path.posix.basename(normalizeRepoPath(file.path).toLowerCase());
  if (["gemfile", "gemfile.lock", ".ruby-version", "rakefile", "config.ru"].includes(basename)) {
    return true;
  }
  return shape.route_file_paths.includes(file.path) ||
    shape.config_file_paths.includes(file.path) ||
    shape.test_file_paths.includes(file.path) ||
    shape.role_file_paths.includes(file.path);
}

function isEmbeddedFixturePath(filePath: string): boolean {
  const normalized = normalizeRepoPath(filePath).toLowerCase();
  return normalized.startsWith("tests/fixtures/") || normalized.includes("/tests/fixtures/");
}

function isPluginIntegrationEvidencePath(file: FileCatalogEntry): boolean {
  return /(?:^|\/)(?:plugins?|skills?|hooks?)(?:\/|$)/iu.test(file.path) ||
    /(?:^|\/)(?:plugin|skill|hook)[^/]*\.(?:[cm]?[jt]s|json|toml|ya?ml)$/iu.test(file.path);
}

function mcpServerValidationCommands(input: {
  packages: readonly PackageScriptEvidence[];
  shape: McpServerShape;
}): PlannedValidationCommand[] {
  const scriptCommands = configuredPackageCommands(input.packages, [
    {
      script: "mcp:smoke",
      reason: "Configured MCP smoke script indicates initialize/tools-list/call-tool validation is available."
    },
    {
      script: "mcp:inspect",
      reason: "Configured MCP inspector script indicates protocol smoke validation is available."
    },
    {
      script: "inspect:mcp",
      reason: "Configured MCP inspector script indicates protocol smoke validation is available."
    },
    {
      script: "mcp:stdio",
      reason: "Configured MCP stdio server script can support initialize and tools/list smoke validation."
    },
    {
      script: "mcp:http",
      reason: "Configured MCP HTTP server script can support HTTP/SSE or streamable HTTP smoke validation."
    }
  ]);
  if (scriptCommands.length > 0) {
    return [
      ...scriptCommands,
      manualMcpSmokeCommand(input.shape, "Configured MCP script evidence is present; run protocol smoke checks explicitly and treat this plan as not executed.")
    ];
  }
  return [
    manualMcpSmokeCommand(
      input.shape,
      "MCP server project-shape evidence exists but no safe repo script was discovered; perform manual initialize, tools/list, and targeted call-tool smoke checks."
    )
  ];
}

function manualMcpSmokeCommand(shape: McpServerShape, reason: string): PlannedValidationCommand {
  return {
    command: "manual_review",
    args: ["mcp-initialize-tools-list-call-tool"],
    display: "planned MCP initialize/tools-list/call-tool smoke review",
    reason: [
      reason,
      shape.transports.length > 0 ? `Transport evidence: ${mcpTransportLabels(shape.transports).join(", ")}.` : "Transport evidence is incomplete.",
      shape.entrypoints.length > 0 ? `Entrypoint evidence: ${shape.entrypoints.slice(0, 2).join(", ")}.` : "Entrypoint evidence is incomplete.",
      shape.tool_registries.length > 0 ? `Tool registry evidence: ${shape.tool_registries.slice(0, 2).join(", ")}.` : "Tool registry evidence is incomplete."
    ].join(" "),
    status: "planned",
    execution: "not_executed"
  };
}

function selectEntries(
  files: readonly FileCatalogEntry[],
  selectedPaths: readonly string[]
): FileCatalogEntry[] {
  if (selectedPaths.length === 0) {
    return [];
  }
  const selected = new Set(selectedPaths);
  return files.filter((file) => selected.has(file.path));
}

function buildSummary(input: {
  commands: readonly PlannedValidationCommand[];
  staticFeedback: StaticFeedback | undefined;
  blocked: boolean;
  risks: ReadonlyArray<VerificationPlan["risks"][number]>;
  nextActions: ReadonlyArray<VerificationPlan["next_actions"][number]>;
}): string {
  const feedbackSummary =
    input.staticFeedback === undefined || input.staticFeedback.status === "silent"
      ? "static feedback is silent"
      : `${input.staticFeedback.findings.length} static feedback finding(s) need attention`;
  const statusSummary = input.blocked ? "Validation planning is blocked" : "Validation planning is ready";
  const blocker = input.risks.find((risk) => risk.severity === "blocker");
  const nextAction = input.nextActions[0];
  const blockedDetails =
    input.blocked && blocker !== undefined
      ? ` Blocker: ${blocker.message} Next action: ${nextAction === undefined ? blocker.why_this_matters : `Call ${nextAction.tool}.`}`
      : "";
  return `${statusSummary}; planned ${input.commands.length} validation command(s); ${feedbackSummary}. Commands were not executed.${blockedDetails}`;
}

function hasAny(values: Set<string>, expected: readonly string[]): boolean {
  return expected.some((value) => values.has(value));
}

function symbolQueryFromPath(filePath: string): string {
  const basename = filePath.slice(filePath.lastIndexOf("/") + 1);
  return basename.replace(/\.[^.]+$/u, "");
}

function isUnsafeValidationTarget(filePath: string): boolean {
  return /[;&|`$<>]/u.test(filePath);
}

function taskMentionsMcp(task: string | undefined): boolean {
  return task !== undefined && /\bmcp\b|tools\/list|call[-_ ]?tool|initialize|stdio|sse|streamable http/iu.test(task);
}
