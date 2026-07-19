/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import type {
  PlannedValidationCommand,
  ResponseMetadata,
  SkippedPath,
  StaticFeedback,
  VerificationPlan,
  VerificationPlanRequest
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import { isExplicitHiddenCatalogPathAllowed } from "../../domain/policies/index.js";
import type { FileCatalogScanPort, FileCatalogSkippedPath, WorkspaceFilePort } from "../../ports/index.js";
import { capNextActions } from "./response-metadata.js";
import { buildStatBackedFileCatalogEntry } from "./file-catalog-entry.js";
import { getCatalogRepoStatus } from "./get-repo-status.js";
import {
  cmakeValidationCommands,
  discoverCMakeTargets,
  discoverGoCiCommands,
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
  type CMakeTargetEvidence
} from "./validation-ecosystems.js";
import {
  discoverValidationProtocol,
  hostCommandBlockedReason,
  hostCommandsBlocked,
  isValidationEnvironmentReason,
  policyCommandsCoverHostSuppression,
  type ValidationProtocolDiscovery
} from "./validation-environment.js";
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
    max_files: 15000
  });
  const selectedPaths = uniqueSorted([
    ...input.request.files.map(normalizeRepoPath),
    ...input.request.changed_files.map(normalizeRepoPath)
  ]);
  const unsafePaths = selectedPaths.filter(isUnsafeValidationTarget);
  const files = await mergeDirectValidationEntries({
    scannedFiles: scanned.files,
    selectedPaths,
    workspace: input.workspace
  });
  const selectedEntries = selectEntries(files, selectedPaths);
  const discovery = await discoverValidationEvidence({
    files,
    selectedEntries,
    workspace: input.workspace
  });
  const commandPlan = planValidationCommands({
    files,
    selectedEntries,
    discovery,
    task: input.request.task,
    maxCommands: input.request.max_commands
  });
  const commands = commandPlan.commands;
  const staticFeedback =
    input.request.include_static_feedback && input.request.changed_files.length > 0
      ? buildStaticFeedback(input.request.changed_files, files)
      : undefined;
  const missingPaths = selectedPaths.filter((filePath) =>
    files.every((entry) => entry.path !== filePath)
  );
  const tooBroad = selectedPaths.length > 50;
  const lowConfidence = scanned.truncated || commandPlan.lowConfidenceReasons.length > 0;
  const blocked =
    unsafePaths.length > 0 ||
    missingPaths.length > 0 ||
    tooBroad ||
    discovery.discoveryErrors.length > 0 ||
    commandPlan.blockerReasons.length > 0 ||
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
    ...commandPlan.lowConfidenceReasons.filter(isValidationEnvironmentReason).map((reason) => ({
      severity: "warning" as const,
      message: reason.replace(/^validation-environment: /u, ""),
      why_this_matters: "Validation planning is evidence-driven; advisory environment or missing-script evidence should be checked before treating the plan as complete."
    })),
    ...(hasRuntimeSkippedPath(scanned.skipped_paths ?? [])
      ? [
          {
            severity: "warning" as const,
            message: "Some repository paths were skipped during validation discovery.",
            why_this_matters: "Skipped paths can hide validation config, tests, or generated noise; inspect skipped_paths before treating the plan as complete."
          }
        ]
      : []),
    ...commandPlan.blockerReasons.map((reason) => ({
      severity: "blocker" as const,
      message: reason,
      why_this_matters: "Repo-local validation guidance takes precedence over generic language command planning."
    })),
    ...(commands.length === 0 && commandPlan.blockerReasons.length === 0
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
    ...(commands.length === 0 && commandPlan.blockerReasons.length === 0
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
    planned_commands: commands,
    ...(staticFeedback?.status === "actionable" ? { static_feedback: staticFeedback } : {}),
    skipped_paths: mapSkippedPaths(scanned.skipped_paths ?? []),
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

function mapSkippedPaths(skippedPaths: readonly FileCatalogSkippedPath[]): SkippedPath[] | undefined {
  if (skippedPaths.length === 0) {
    return undefined;
  }
  return skippedPaths.slice(0, 50).map((skipped) => ({
    path: skipped.path,
    reason: skipped.reason,
    detail: skipped.detail
  }));
}

function hasRuntimeSkippedPath(skippedPaths: readonly FileCatalogSkippedPath[]): boolean {
  return skippedPaths.some((skipped) =>
    ["permission_denied", "missing", "not_directory", "workspace_escape"].includes(skipped.reason)
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
  const pluginIntegrationSelected =
    taskMentionsPluginIntegration(input.task) ||
    input.selectedEntries.some(isPluginIntegrationEvidencePath);
  const selectedPackageScripts = selectPackageScripts({
    packages: input.discovery.packageScripts,
    selectedEntries: input.selectedEntries,
    includeAll
  });

  commands.push(...input.discovery.validationProtocol.policyCommands);
  if (!hostCommandsBlocked(input.discovery.validationProtocol)) {
    lowConfidenceReasons.push(
      ...input.discovery.validationProtocol.environmentEvidence.map(
        (evidence) => `validation-environment: ${evidence.path} is validation-environment evidence (${evidence.detail}) but does not prove host commands are unsafe without repo guidance or policy.`
      )
    );
  }

  if (goShapeSelected) {
    if (hostCommandsBlocked(input.discovery.validationProtocol) || input.discovery.validationProtocol.prohibitsHostGoTest) {
      if (policyCommandsCoverHostSuppression(input.discovery.validationProtocol) === false) {
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
      if (policyCommandsCoverHostSuppression(input.discovery.validationProtocol) === false) {
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
      if (policyCommandsCoverHostSuppression(input.discovery.validationProtocol) === false) {
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
      if (policyCommandsCoverHostSuppression(input.discovery.validationProtocol) === false) {
        blockerReasons.push(hostCommandBlockedReason(input.discovery.validationProtocol, "SAM/CloudFormation"));
      }
    } else {
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
      if (policyCommandsCoverHostSuppression(input.discovery.validationProtocol) === false) {
        blockerReasons.push(hostCommandBlockedReason(input.discovery.validationProtocol, "MCP server"));
      }
    } else {
      commands.push(...mcpServerValidationCommands({
        packages: selectedPackageScripts,
        shape: input.discovery.mcpShape
      }));
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
      if (policyCommandsCoverHostSuppression(input.discovery.validationProtocol) === false) {
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
      if (policyCommandsCoverHostSuppression(input.discovery.validationProtocol) === false) {
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
