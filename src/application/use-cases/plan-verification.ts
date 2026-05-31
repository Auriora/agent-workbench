import path from "node:path";
import type {
  PlannedValidationCommand,
  ResponseMetadata,
  StaticFeedback,
  VerificationPlan,
  VerificationPlanRequest
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import { planCommand } from "../../domain/policies/command-safety.js";
import type { FileCatalogScanPort, WorkspaceFilePort } from "../../ports/index.js";
import { getCatalogRepoStatus } from "./get-repo-status.js";

export type PlanVerificationResult = {
  plan: VerificationPlan;
  meta: ResponseMetadata;
};

export async function planVerification(input: {
  request: VerificationPlanRequest;
  scanner: FileCatalogScanPort;
  workspace: WorkspaceFilePort;
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
  const unsafePaths = selectedPaths.filter(isUnsafeValidationTarget);
  const selectedEntries = selectEntries(scanned.files, selectedPaths);
  const discovery = await discoverValidationEvidence({
    files: scanned.files,
    workspace: input.workspace
  });
  const commandPlan = planValidationCommands({
    files: scanned.files,
    selectedEntries,
    discovery,
    maxCommands: input.request.max_commands
  });
  const commands = commandPlan.commands;
  const staticFeedback =
    input.request.include_static_feedback && input.request.changed_files.length > 0
      ? buildStaticFeedback(input.request.changed_files, scanned.files)
      : undefined;
  const missingPaths = selectedPaths.filter((filePath) =>
    scanned.files.every((entry) => entry.path !== filePath)
  );
  const tooBroad = selectedPaths.length > 50;
  const lowConfidence = scanned.truncated || commandPlan.lowConfidenceReasons.length > 0;
  const blocked =
    unsafePaths.length > 0 ||
    missingPaths.length > 0 ||
    tooBroad ||
    scanned.truncated ||
    discovery.discoveryErrors.length > 0 ||
    commands.length === 0;
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
    status: blocked ? "blocked" : "planned",
    summary: buildSummary(commands, staticFeedback, blocked),
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

async function discoverValidationEvidence(input: {
  files: readonly FileCatalogEntry[];
  workspace: WorkspaceFilePort;
}): Promise<ValidationDiscovery> {
  const paths = new Set(input.files.map((file) => file.path));
  const packageDiscovery = paths.has("package.json")
    ? await readPackageScripts(input.workspace)
    : { scripts: {}, errors: [] };

  return {
    packageScripts: packageDiscovery.scripts,
    discoveryErrors: packageDiscovery.errors,
    hasPyproject: paths.has("pyproject.toml")
  };
}

type ValidationDiscovery = {
  packageScripts: Record<string, string>;
  discoveryErrors: string[];
  hasPyproject: boolean;
};

type CommandPlanningResult = {
  commands: PlannedValidationCommand[];
  lowConfidenceReasons: string[];
};

function planValidationCommands(input: {
  files: readonly FileCatalogEntry[];
  selectedEntries: readonly FileCatalogEntry[];
  discovery: ValidationDiscovery;
  maxCommands: number;
}): CommandPlanningResult {
  const selectedLanguages = new Set(input.selectedEntries.map((file) => file.file_identity.language));
  const commands: PlannedValidationCommand[] = [];
  const lowConfidenceReasons: string[] = [...input.discovery.discoveryErrors];
  const includeAll = input.selectedEntries.length === 0;

  if (Object.keys(input.discovery.packageScripts).length > 0 && (includeAll || hasAny(selectedLanguages, ["typescript", "javascript", "json"]))) {
    commands.push(
      ...configuredPackageCommands(input.discovery.packageScripts, [
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
        }
      ])
    );
    for (const script of ["typecheck", "lint", "format:check", "test"]) {
      if (input.discovery.packageScripts[script] === undefined) {
        lowConfidenceReasons.push(`missing package script: ${script}`);
      }
    }
  }

  if (input.discovery.hasPyproject && (includeAll || selectedLanguages.has("python"))) {
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

  return {
    commands: commands.slice(0, input.maxCommands),
    lowConfidenceReasons
  };
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
  staticFeedback: StaticFeedback | undefined,
  blocked: boolean
): string {
  const feedbackSummary =
    staticFeedback === undefined || staticFeedback.status === "silent"
      ? "static feedback is silent"
      : `${staticFeedback.findings.length} static feedback finding(s) need attention`;
  const statusSummary = blocked ? "Validation planning is blocked" : "Validation planning is ready";
  return `${statusSummary}; planned ${commands.length} validation command(s); ${feedbackSummary}. Commands were not executed.`;
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

function configuredPackageCommands(
  scripts: Record<string, string>,
  candidates: readonly { script: string; reason: string }[]
): PlannedValidationCommand[] {
  const commands: PlannedValidationCommand[] = [];
  for (const candidate of candidates) {
    if (scripts[candidate.script] === undefined) {
      continue;
    }
    const decision = planCommand({
      command: "pnpm",
      args: ["run", candidate.script],
      source: "configured"
    });
    if (!decision.allowed) {
      continue;
    }
    commands.push({
      command: decision.command.command,
      args: decision.command.args,
      display: [decision.command.command, ...decision.command.args].join(" "),
      reason: candidate.reason,
      status: "planned",
      execution: "not_executed"
    });
  }
  return commands;
}

async function readPackageScripts(
  workspace: WorkspaceFilePort
): Promise<{ scripts: Record<string, string>; errors: string[] }> {
  let parsed: { scripts?: unknown };
  try {
    const content = await workspace.readText({ path: "package.json" });
    parsed = JSON.parse(content) as { scripts?: unknown };
  } catch (_error) {
    return {
      scripts: {},
      errors: ["package.json could not be read as JSON"]
    };
  }
  if (parsed.scripts === undefined || typeof parsed.scripts !== "object" || parsed.scripts === null) {
    return { scripts: {}, errors: [] };
  }
  return {
    scripts: Object.fromEntries(
      Object.entries(parsed.scripts).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    ),
    errors: []
  };
}

function isUnsafeValidationTarget(filePath: string): boolean {
  return /[;&|`$<>]/u.test(filePath);
}
