import path from "node:path";
import type {
  DiagnosticsProviderStatus,
  PostEditDeferredCheck,
  PostEditFeedbackFinding,
  PostEditFeedbackRequest,
  PostEditFeedbackResult,
  ResponseMetadata
} from "../../contracts/index.js";
import { capNextActions, invalidResponseMeta } from "./response-metadata.js";

export type BuildPostEditFeedbackResult = {
  feedback: PostEditFeedbackResult;
  meta: ResponseMetadata;
};

type BuildPostEditFeedbackRequest = Omit<PostEditFeedbackRequest, "deferred_checks" | "max_inline_files"> &
  Partial<Pick<PostEditFeedbackRequest, "deferred_checks" | "max_inline_files">>;

export function buildPostEditFeedback(input: {
  request: BuildPostEditFeedbackRequest;
  default_repo_root: string;
}): BuildPostEditFeedbackResult {
  const repoRoot = path.resolve(input.request.repo_root ?? input.default_repo_root);
  const changedFiles = uniqueSorted(input.request.changed_files.map(normalizeRepoPath));
  const diagnosticFiles = input.request.diagnostics?.checked_files.map(normalizeRepoPath) ?? [];
  const checkedFiles = uniqueSorted([...changedFiles, ...diagnosticFiles]);
  const deferredChecks = buildDeferredChecks({
    changedFiles,
    request: input.request
  });
  const findings = [
    ...input.request.edit_risks.map(toEditRiskFinding),
    ...(input.request.diagnostics?.findings ?? []).map((finding): PostEditFeedbackFinding => ({
      path: normalizeRepoPath(finding.path),
      severity: finding.severity,
      message: finding.message,
      category: "diagnostic",
      blocking: finding.blocking,
      suggested_action: finding.fix_hint
    })),
    ...validationFindings(input.request.validation_status)
  ].sort(compareFindings);
  const blocked = findings.some((finding) => finding.blocking);
  const status = blocked ? "blocked" : findings.length > 0 ? "needed" : "done";
  const outcome = classifyOutcome({
    checkedFiles,
    findings,
    deferredChecks
  });
  const visibleMessage = buildVisibleMessage(findings);

  return {
    feedback: {
      repo_root: repoRoot,
      status,
      outcome,
      summary: buildSummary({ checkedFiles, findings }),
      checked_files: checkedFiles,
      findings,
      deferred_checks: deferredChecks,
      visible_message: visibleMessage,
      next_actions: buildNextActions({
        repoRoot,
        checkedFiles,
        findings,
        deferredChecks
      })
    },
    meta: {
      ...invalidResponseMeta({ repoRoot }),
      analysis_validity: "valid",
      freshness: "fresh",
      capability_level: "resource_backed",
      evidence_kinds: findings.length > 0 ? ["config"] : [],
      verification_status: status
    }
  };
}

function buildDeferredChecks(input: {
  changedFiles: readonly string[];
  request: BuildPostEditFeedbackRequest;
}): PostEditDeferredCheck[] {
  const maxInlineFiles = input.request.max_inline_files ?? 20;
  const deferredChecks: PostEditDeferredCheck[] = [...(input.request.deferred_checks ?? [])];
  if (input.changedFiles.length > maxInlineFiles) {
    deferredChecks.push({
      reason: "too_many_files",
      outcome: "queued",
      count: input.changedFiles.length - maxInlineFiles,
      paths: input.changedFiles.slice(maxInlineFiles),
      message: "Changed file count exceeds the inline post-edit diagnostics budget.",
      follow_up_tool: "diagnostics_for_files"
    });
  }

  const providerStatuses = input.request.diagnostics?.provider_statuses ?? [];
  const failed = statusesByKind(providerStatuses, "failed");
  if (failed.length > 0) {
    deferredChecks.push(providerDeferredCheck({
      reason: "provider_failed",
      outcome: "errored",
      statuses: failed,
      message: "One or more diagnostics providers failed before completing post-edit checks."
    }));
  }

  const unavailable = statusesByKind(providerStatuses, "unavailable");
  if (unavailable.length > 0) {
    deferredChecks.push(providerDeferredCheck({
      reason: "provider_unavailable",
      outcome: "unavailable",
      statuses: unavailable,
      message: "One or more diagnostics providers were unavailable for post-edit checks."
    }));
  }

  const notApplicable = statusesByKind(providerStatuses, "not_applicable");
  if (notApplicable.length > 0) {
    deferredChecks.push(providerDeferredCheck({
      reason: "provider_not_applicable",
      outcome: "skipped",
      statuses: notApplicable,
      message: "No diagnostics provider applied to one or more changed files."
    }));
  }

  return mergeDeferredChecks(deferredChecks);
}

function statusesByKind(
  statuses: readonly DiagnosticsProviderStatus[],
  status: DiagnosticsProviderStatus["status"]
): DiagnosticsProviderStatus[] {
  return statuses.filter((providerStatus) => providerStatus.status === status);
}

function providerDeferredCheck(input: {
  reason: PostEditDeferredCheck["reason"];
  outcome: PostEditDeferredCheck["outcome"];
  statuses: readonly DiagnosticsProviderStatus[];
  message: string;
}): PostEditDeferredCheck {
  return {
    reason: input.reason,
    outcome: input.outcome,
    count: input.statuses.length,
    paths: uniqueSorted(
      input.statuses
        .map((status) => status.path)
        .filter((pathValue): pathValue is string => pathValue !== undefined)
        .map(normalizeRepoPath)
    ),
    message: input.message,
    follow_up_tool: "diagnostics_for_files"
  };
}

function mergeDeferredChecks(checks: readonly PostEditDeferredCheck[]): PostEditDeferredCheck[] {
  return checks
    .map((check) => ({
      ...check,
      paths: check.paths === undefined ? undefined : uniqueSorted(check.paths.map(normalizeRepoPath))
    }))
    .sort(compareDeferredChecks);
}

function classifyOutcome(input: {
  checkedFiles: readonly string[];
  findings: readonly PostEditFeedbackFinding[];
  deferredChecks: readonly PostEditDeferredCheck[];
}): PostEditFeedbackResult["outcome"] {
  if (input.findings.length > 0) {
    return "actionable";
  }
  if (input.deferredChecks.some((check) => check.outcome === "queued")) {
    return "queued";
  }
  if (input.deferredChecks.some((check) => check.outcome === "errored")) {
    return "errored";
  }
  if (input.deferredChecks.some((check) => check.outcome === "unavailable")) {
    return "unavailable";
  }
  if (input.deferredChecks.some((check) => check.outcome === "skipped")) {
    return "skipped";
  }
  if (input.checkedFiles.length > 0) {
    return "checked";
  }
  return "silent";
}

function toEditRiskFinding(risk: PostEditFeedbackRequest["edit_risks"][number]): PostEditFeedbackFinding {
  return {
    path: risk.path === undefined ? undefined : normalizeRepoPath(risk.path),
    severity: risk.severity,
    message: risk.message,
    category: "edit_risk",
    blocking: risk.blocking,
    suggested_action: risk.suggested_action
  };
}

function validationFindings(
  status: PostEditFeedbackRequest["validation_status"]
): PostEditFeedbackFinding[] {
  if (status !== "blocked") {
    return [];
  }
  return [
    {
      severity: "warning",
      message: "Validation planning is blocked for the changed files.",
      category: "validation",
      blocking: false,
      suggested_action: "Inspect validation_plan risks before treating the edit as ready."
    }
  ];
}

function buildNextActions(input: {
  repoRoot: string;
  checkedFiles: readonly string[];
  findings: readonly PostEditFeedbackFinding[];
  deferredChecks: readonly PostEditDeferredCheck[];
}) {
  if (input.findings.length === 0 && input.deferredChecks.length === 0) {
    return [];
  }
  return capNextActions([
    {
      tool: "diagnostics_for_files",
      args: {
        repo_root: input.repoRoot,
        files: input.checkedFiles
      }
    },
    {
      tool: "verification_plan",
      args: {
        repo_root: input.repoRoot,
        changed_files: input.checkedFiles
      }
    }
  ]);
}

function buildSummary(input: {
  checkedFiles: readonly string[];
  findings: readonly PostEditFeedbackFinding[];
}): string {
  if (input.findings.length === 0) {
    return "Post-edit feedback is quiet: no actionable findings.";
  }
  return `${input.findings.length} post-edit finding(s) need attention across ${input.checkedFiles.length} checked file(s).`;
}

function buildVisibleMessage(findings: readonly PostEditFeedbackFinding[]): string | undefined {
  if (findings.length === 0) {
    return undefined;
  }
  return findings
    .slice(0, 3)
    .map((finding) => {
      const prefix = finding.path === undefined ? "" : `${finding.path}: `;
      return `${prefix}${finding.message}`;
    })
    .join(" ");
}

function compareFindings(left: PostEditFeedbackFinding, right: PostEditFeedbackFinding): number {
  const severity = severityRank(left.severity) - severityRank(right.severity);
  if (severity !== 0) return severity;
  const category = categoryRank(left.category) - categoryRank(right.category);
  if (category !== 0) return category;
  return `${left.path ?? ""}:${left.category}:${left.message}`.localeCompare(
    `${right.path ?? ""}:${right.category}:${right.message}`
  );
}

function severityRank(severity: PostEditFeedbackFinding["severity"]): number {
  return severity === "blocker" ? 0 : 1;
}

function categoryRank(category: PostEditFeedbackFinding["category"]): number {
  if (category === "diagnostic") return 0;
  if (category === "edit_risk") return 1;
  return 2;
}

function compareDeferredChecks(left: PostEditDeferredCheck, right: PostEditDeferredCheck): number {
  const outcome = outcomeRank(left.outcome) - outcomeRank(right.outcome);
  if (outcome !== 0) return outcome;
  return `${left.reason}:${left.paths?.join(",") ?? ""}`.localeCompare(
    `${right.reason}:${right.paths?.join(",") ?? ""}`
  );
}

function outcomeRank(outcome: PostEditDeferredCheck["outcome"]): number {
  if (outcome === "queued") return 0;
  if (outcome === "errored") return 1;
  if (outcome === "unavailable") return 2;
  return 3;
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function normalizeRepoPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}
