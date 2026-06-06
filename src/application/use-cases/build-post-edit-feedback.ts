import path from "node:path";
import type {
  PostEditFeedbackFinding,
  PostEditFeedbackRequest,
  PostEditFeedbackResult,
  ResponseMetadata
} from "../../contracts/index.js";
import { capNextActions, invalidResponseMeta } from "../../presentation/metadata.js";

export type BuildPostEditFeedbackResult = {
  feedback: PostEditFeedbackResult;
  meta: ResponseMetadata;
};

export function buildPostEditFeedback(input: {
  request: PostEditFeedbackRequest;
  default_repo_root: string;
}): BuildPostEditFeedbackResult {
  const repoRoot = path.resolve(input.request.repo_root ?? input.default_repo_root);
  const changedFiles = uniqueSorted(input.request.changed_files.map(normalizeRepoPath));
  const diagnosticFiles = input.request.diagnostics?.checked_files.map(normalizeRepoPath) ?? [];
  const checkedFiles = uniqueSorted([...changedFiles, ...diagnosticFiles]);
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
  const visibleMessage = buildVisibleMessage(findings);

  return {
    feedback: {
      repo_root: repoRoot,
      status,
      summary: buildSummary({ checkedFiles, findings }),
      checked_files: checkedFiles,
      findings,
      visible_message: visibleMessage,
      next_actions: buildNextActions({
        repoRoot,
        checkedFiles,
        findings
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
}) {
  if (input.findings.length === 0 || input.checkedFiles.length === 0) {
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

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function normalizeRepoPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}
