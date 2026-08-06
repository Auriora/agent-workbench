/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import type {
  ChangedFilesContextRequest,
  ChangedFilesContextResult,
  DiagnosticsForFilesRequest,
  ResponseMetadata,
  RuntimeError,
  VerificationPlanRequest
} from "../../contracts/index.js";
import type { GitRepositoryCompositionPort } from "../../ports/index.js";
import type { DiagnoseChangedFilesResult } from "./diagnose-changed-files.js";
import type { GetRepoStatusResult } from "./get-repo-status.js";
import type { PlanVerificationResult } from "./plan-verification.js";
import { invalidResponseMeta } from "./response-metadata.js";

export type ChangedFilesContextUseCaseResult = {
  context: ChangedFilesContextResult;
  meta: ResponseMetadata;
  errors?: RuntimeError[];
};

export async function getChangedFilesContext(input: {
  request: ChangedFilesContextRequest;
  git: GitRepositoryCompositionPort;
  getRepoStatus: (input: { repo_root: string }) => Promise<GetRepoStatusResult> | GetRepoStatusResult;
  diagnoseChangedFiles: (input: { request: DiagnosticsForFilesRequest }) => Promise<DiagnoseChangedFilesResult> | DiagnoseChangedFilesResult;
  planVerification: (input: { request: VerificationPlanRequest }) => Promise<PlanVerificationResult> | PlanVerificationResult;
  default_repo_root: string;
}): Promise<ChangedFilesContextUseCaseResult> {
  const repoRoot = path.resolve(input.request.repo_root ?? input.default_repo_root);
  const gitResult = await input.git.inspectRepositoryCleanliness({ repo_root: repoRoot });
  const explicitFiles = uniqueSafePaths(input.request.files);
  const discoveredFiles = gitResult.status === "available" ? gitResult.changed_paths : [];
  const malformedGitEvidence = gitResult.status === "available" &&
    uniqueSafePaths(discoveredFiles).length !== new Set(discoveredFiles).size;
  const safeDiscoveredFiles = uniqueSafePaths(discoveredFiles);
  const discoveredSet = new Set(safeDiscoveredFiles);
  const changedFiles = [
    ...safeDiscoveredFiles,
    ...explicitFiles.filter((filePath) => !discoveredSet.has(filePath))
  ].slice(0, input.request.max_files);
  const truncated = new Set([...discoveredFiles, ...explicitFiles]).size > changedFiles.length;

  const changes: ChangedFilesContextResult["changes"] = gitResult.status === "available" && !malformedGitEvidence
    ? {
        state: "available",
        cleanliness: gitResult.cleanliness,
        staged: boundedCategory(gitResult.staged_paths, changedFiles),
        unstaged: boundedCategory(gitResult.unstaged_paths, changedFiles),
        untracked: boundedCategory(gitResult.untracked_paths, changedFiles),
        changed_files: changedFiles
      }
    : {
        state: "blocked",
        staged: [],
        unstaged: [],
        untracked: [],
        changed_files: changedFiles,
        reason: "Git change inventory was unavailable or malformed."
      };

  const status = await capture(() => input.getRepoStatus({ repo_root: repoRoot }));
  const diagnostics = changedFiles.length === 0
    ? { ok: true as const, value: undefined }
    : await capture(() => input.diagnoseChangedFiles({
        request: { repo_root: repoRoot, files: changedFiles, max_files: input.request.max_files }
      }));
  const verification = changedFiles.length === 0
    ? { ok: true as const, value: undefined }
    : await capture(() => input.planVerification({
        request: {
          repo_root: repoRoot,
          task: input.request.task,
          files: changedFiles,
          changed_files: changedFiles,
          include_static_feedback: true,
          max_commands: input.request.max_commands
        }
      }));

  const repositoryStatus = status.ok
    ? { state: "available" as const, value: {
        runtime_state: status.value.status.runtime_state,
        freshness: status.value.status.freshness,
        snapshot_id: status.value.status.snapshot_id
      } }
    : { state: "unavailable" as const, reason: "Repository status provider failed." };
  const diagnosticsComponent = changedFiles.length === 0
    ? { state: "not_applicable" as const }
    : diagnostics.ok
      ? {
          state: diagnostics.value!.diagnostics.status === "blocked" ? "blocked" as const : "available" as const,
          value: diagnostics.value!.diagnostics,
          ...(diagnostics.value!.diagnostics.status === "blocked" ? { reason: diagnostics.value!.diagnostics.summary } : {})
        }
      : { state: "unavailable" as const, reason: "Diagnostics provider failed." };
  const verificationComponent = changedFiles.length === 0
    ? { state: "not_applicable" as const }
    : verification.ok
      ? {
          state: verification.value!.plan.status === "blocked" ? "blocked" as const : "available" as const,
          value: verification.value!.plan,
          ...(verification.value!.plan.status === "blocked" ? { reason: verification.value!.plan.summary } : {})
        }
      : { state: "unavailable" as const, reason: "Verification-plan provider failed." };

  const requiredStates = [changes.state, repositoryStatus.state, diagnosticsComponent.state, verificationComponent.state];
  const blocked = requiredStates.includes("blocked");
  const unavailable = requiredStates.includes("unavailable");
  const statusLimited = status.ok && (
    status.value.meta.analysis_validity !== "valid" || status.value.meta.freshness !== "fresh"
  );
  const state: ChangedFilesContextResult["state"] = blocked
    ? "blocked"
    : unavailable || statusLimited || truncated
      ? "degraded"
      : changedFiles.length === 0
        ? "no_changes"
        : "ready";
  const errors: RuntimeError[] = [
    ...(gitResult.status === "blocked" || malformedGitEvidence ? [{ code: "git_evidence_blocked", message: "Git change inventory was unavailable or malformed.", retryable: false }] : []),
    ...(!status.ok ? [{ code: "repo_status_unavailable", message: "Repository status provider failed.", retryable: false }] : []),
    ...(!diagnostics.ok ? [{ code: "diagnostics_unavailable", message: "Diagnostics provider failed.", retryable: false }] : []),
    ...(!verification.ok ? [{ code: "verification_plan_unavailable", message: "Verification-plan provider failed.", retryable: false }] : [])
  ];

  const baseMeta = status.ok ? status.value.meta : invalidResponseMeta({ repoRoot });
  return {
    context: {
      repo_root: repoRoot,
      state,
      changes,
      repository_status: repositoryStatus,
      diagnostics: diagnosticsComponent,
      verification: verificationComponent,
      lifecycle_context: input.request.lifecycle_context,
      next_actions: state === "ready" || state === "no_changes" ? [] : componentNextActions({ repoRoot, changedFiles, diagnostics: diagnosticsComponent.state, verification: verificationComponent.state })
    },
    meta: {
      ...baseMeta,
      analysis_validity: state === "blocked" ? "invalid" : state === "degraded" ? "partial" : baseMeta.analysis_validity,
      verification_status: state === "blocked" ? "blocked" : state === "degraded" ? "needed" : baseMeta.verification_status,
      truncated: baseMeta.truncated || truncated
    },
    ...(errors.length > 0 ? { errors } : {})
  };
}

async function capture<T>(operation: () => Promise<T> | T): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await operation() };
  } catch {
    return { ok: false };
  }
}

function uniqueSafePaths(paths: readonly string[]): string[] {
  return [...new Set(paths.map((value) => value.replaceAll("\\", "/")).filter((value) =>
    value.length > 0 && value.length <= 500 && !value.startsWith("/") &&
    value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
  ))].sort();
}

function boundedCategory(paths: readonly string[], selected: readonly string[]): string[] {
  const allowed = new Set(selected);
  return uniqueSafePaths(paths).filter((filePath) => allowed.has(filePath));
}

function componentNextActions(input: {
  repoRoot: string;
  changedFiles: readonly string[];
  diagnostics: string;
  verification: string;
}) {
  return [
    ...(input.diagnostics !== "available" && input.changedFiles.length > 0
      ? [{ tool: "diagnostics_for_files", args: { repo_root: input.repoRoot, files: [...input.changedFiles] } }]
      : []),
    ...(input.verification !== "available" && input.changedFiles.length > 0
      ? [{ tool: "verification_plan", args: { repo_root: input.repoRoot, changed_files: [...input.changedFiles] } }]
      : [])
  ];
}
