import path from "node:path";
import type {
  PlannedValidationCommand,
  ResponseMetadata,
  StaticFeedback,
  VerificationPlan,
  VerificationPlanRequest
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import type { FileCatalogScanPort } from "../../ports/index.js";
import { getCatalogRepoStatus } from "./get-repo-status.js";

export type PlanVerificationResult = {
  plan: VerificationPlan;
  meta: ResponseMetadata;
};

export async function planVerification(input: {
  request: VerificationPlanRequest;
  scanner: FileCatalogScanPort;
  default_repo_root: string;
}): Promise<PlanVerificationResult> {
  const repoRoot = path.resolve(input.request.repo_root ?? input.default_repo_root);
  const scanned = await input.scanner.scan({
    repo_root: repoRoot,
    indexed_roots: ["."],
    skipped_roots: [],
    max_files: 2000
  });
  const selectedPaths = uniqueSorted([
    ...input.request.files.map(normalizeRepoPath),
    ...input.request.changed_files.map(normalizeRepoPath)
  ]);
  const selectedEntries = selectEntries(scanned.files, selectedPaths);
  const commands = planValidationCommands({
    files: scanned.files,
    selectedEntries,
    maxCommands: input.request.max_commands
  });
  const staticFeedback =
    input.request.include_static_feedback && input.request.changed_files.length > 0
      ? buildStaticFeedback(input.request.changed_files, scanned.files)
      : undefined;
  const risks = [
    ...(selectedPaths.some((filePath) => scanned.files.every((entry) => entry.path !== filePath))
      ? [
          {
            severity: "warning" as const,
            message: "Some requested validation files were not found in the scanned repository.",
            why_this_matters: "The plan can only route validation from known local evidence."
          }
        ]
      : []),
    ...(commands.length === 0
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
    files: scanned.files,
    freshness: "unknown"
  });
  const plan: VerificationPlan = {
    task: input.request.task,
    repo_root: scanned.repo_root,
    status: commands.length > 0 ? "planned" : "blocked",
    summary: buildSummary(commands, staticFeedback),
    planned_commands: commands,
    ...(staticFeedback?.status === "actionable" ? { static_feedback: staticFeedback } : {}),
    risks,
    next_actions: [
      ...selectedEntries
        .filter((entry) => entry.file_identity.language === "python")
        .map((entry) => ({
          tool: "symbol_search",
          args: {
            query: symbolQueryFromPath(entry.path),
            repo_root: scanned.repo_root
          }
        })),
      ...commands.map((command) => ({
        tool: "manual_command",
        args: {
          command: command.display
        }
      })),
      ...(commands.length === 0
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
        : [])
    ]
  };

  return {
    plan,
    meta: {
      ...status.meta,
      verification_status: plan.status,
      truncated: scanned.truncated,
      budget: {
        row_limit: 2000
      }
    }
  };
}

function planValidationCommands(input: {
  files: readonly FileCatalogEntry[];
  selectedEntries: readonly FileCatalogEntry[];
  maxCommands: number;
}): PlannedValidationCommand[] {
  const allPaths = new Set(input.files.map((file) => file.path));
  const selectedLanguages = new Set(input.selectedEntries.map((file) => file.file_identity.language));
  const commands: PlannedValidationCommand[] = [];
  const includeAll = input.selectedEntries.length === 0;

  if (allPaths.has("package.json") && (includeAll || hasAny(selectedLanguages, ["typescript", "javascript", "json"]))) {
    commands.push({
      command: "pnpm",
      args: ["typecheck"],
      display: "pnpm typecheck",
      reason: "package.json and TypeScript/JavaScript-related files indicate type checking is relevant.",
      status: "planned",
      execution: "not_executed"
    });
    commands.push({
      command: "pnpm",
      args: ["test"],
      display: "pnpm test",
      reason: "package.json indicates the JavaScript/TypeScript test suite is the nearest broad validation path.",
      status: "planned",
      execution: "not_executed"
    });
  }

  if (allPaths.has("pyproject.toml") && (includeAll || selectedLanguages.has("python"))) {
    commands.push({
      command: "python3",
      args: ["-m", "pytest"],
      display: "python3 -m pytest",
      reason: "pyproject.toml and Python files indicate pytest is the nearest validation path.",
      status: "planned",
      execution: "not_executed"
    });
  }

  if (input.selectedEntries.some((file) => ["markdown", "json", "toml", "yaml"].includes(file.file_identity.language))) {
    commands.push({
      command: "manual_review",
      args: ["docs-config-syntax"],
      display: "planned docs/config syntax review",
      reason: "Documentation or configuration files changed; syntax/readability checks are planned, not executed.",
      status: "planned",
      execution: "not_executed"
    });
  }

  return commands.slice(0, input.maxCommands);
}

function buildStaticFeedback(
  changedFiles: readonly string[],
  files: readonly FileCatalogEntry[]
): StaticFeedback {
  const knownPaths = new Set(files.map((file) => file.path));
  const checkedFiles = uniqueSorted(changedFiles.map(normalizeRepoPath));
  const findings = checkedFiles
    .filter((filePath) => knownPaths.has(filePath) === false)
    .map((filePath) => ({
      path: filePath,
      severity: "warning" as const,
      message: "Changed file was not found in the scanned repository.",
      suggested_action: "Verify the path before relying on this validation plan."
    }));

  return {
    status: findings.length > 0 ? "actionable" : "silent",
    checked_files: checkedFiles,
    findings
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

function buildSummary(
  commands: readonly PlannedValidationCommand[],
  staticFeedback?: StaticFeedback
): string {
  const feedbackSummary =
    staticFeedback === undefined || staticFeedback.status === "silent"
      ? "static feedback is silent"
      : `${staticFeedback.findings.length} static feedback finding(s) need attention`;
  return `Planned ${commands.length} validation command(s); ${feedbackSummary}. Commands were not executed.`;
}

function hasAny(values: Set<string>, expected: readonly string[]): boolean {
  return expected.some((value) => values.has(value));
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function normalizeRepoPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function symbolQueryFromPath(filePath: string): string {
  const basename = filePath.slice(filePath.lastIndexOf("/") + 1);
  return basename.replace(/\.[^.]+$/u, "");
}
