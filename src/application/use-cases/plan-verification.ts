import path from "node:path";
import type {
  PlannedValidationCommand,
  ResponseMetadata,
  StaticFeedback,
  VerificationPlan,
  VerificationPlanRequest
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import { isExplicitHiddenCatalogPathAllowed } from "../../domain/policies/index.js";
import { planCommand } from "../../domain/policies/command-safety.js";
import type { FileCatalogScanPort, WorkspaceFilePort } from "../../ports/index.js";
import { capNextActions } from "../../presentation/metadata.js";
import { buildStatBackedFileCatalogEntry } from "./file-catalog-entry.js";
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
    ...commandPlan.blockerReasons.map((reason) => ({
      severity: "blocker" as const,
      message: reason,
      why_this_matters: "Repo-local validation guidance takes precedence over generic language command planning."
    })),
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
    files,
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
    next_actions: capNextActions([
      ...selectedEntries
        .filter((entry) => entry.file_identity.language === "python")
        .map((entry) => ({
          tool: "symbol_search",
          args: {
            query: symbolQueryFromPath(entry.path),
            repo_root: scanned.repo_root
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
    ])
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
    "pyproject.toml",
    "go.mod",
    "go.work",
    "Makefile",
    "CMakeLists.txt"
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
    packageManager
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
  pythonNearestTests: PlannedValidationCommand[];
};

type CommandPlanningResult = {
  commands: PlannedValidationCommand[];
  lowConfidenceReasons: string[];
  blockerReasons: string[];
};

type ValidationProtocolDiscovery = {
  requiresDockerValidation: boolean;
  prohibitsHostGoTest: boolean;
  evidencePaths: string[];
  errors: string[];
};

type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

type PackageScriptEvidence = {
  package_json_path: string;
  directory: string;
  package_manager: PackageManager;
  scripts: Record<string, string>;
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
  const blockerReasons: string[] = [];
  const includeAll = input.selectedEntries.length === 0;
  const hasGoFiles = input.files.some((file) => file.file_identity.language === "go");
  const hasCppFiles = input.files.some((file) => file.file_identity.language === "cpp" || file.file_identity.language === "c");
  const goShapeSelected = input.discovery.hasGoMod && (includeAll ? hasGoFiles : selectedLanguages.has("go"));
  const cmakeShapeSelected =
    (input.discovery.hasRootCMake || input.discovery.localCMakeFiles.length > 0) &&
    (includeAll ? hasCppFiles : hasAny(selectedLanguages, ["c", "cpp"]));

  if (goShapeSelected) {
    if (input.discovery.validationProtocol.requiresDockerValidation || input.discovery.validationProtocol.prohibitsHostGoTest) {
      const evidence =
        input.discovery.validationProtocol.evidencePaths.length > 0
          ? ` Evidence: ${input.discovery.validationProtocol.evidencePaths.slice(0, 3).join(", ")}.`
          : "";
      blockerReasons.push(
        `Repository guidance requires Docker-based validation, so host Go commands were not planned.${evidence}`
      );
    } else {
      if (input.discovery.hasMakefile) {
        commands.push({
          command: "make",
          args: ["test"],
          display: "make test",
          reason: "Makefile and Go project files indicate repository-specific Go validation may be available.",
          status: "planned",
          execution: "not_executed"
        });
      }
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

  if (cmakeShapeSelected) {
    commands.push({
      command: "manual_review",
      args: ["cmake-build-test"],
      display: "planned CMake build/test review",
      reason: cmakeReason(input.discovery),
      status: "planned",
      execution: "not_executed"
    });
  }

  const selectedPackageScripts = selectPackageScripts({
    packages: input.discovery.packageScripts,
    selectedEntries: input.selectedEntries,
    includeAll
  });

  if (
    selectedPackageScripts.length > 0 &&
    !goShapeSelected &&
    !cmakeShapeSelected &&
    (includeAll || hasAny(selectedLanguages, ["typescript", "javascript", "json"]))
  ) {
    commands.push(
      ...configuredPackageCommands(selectedPackageScripts, [
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

  if (input.selectedEntries.some((file) => ["config", "markdown", "json", "toml", "yaml"].includes(file.file_identity.language))) {
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
    lowConfidenceReasons,
    blockerReasons
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
  packages: readonly PackageScriptEvidence[],
  candidates: readonly { script: string; reason: string }[]
): PlannedValidationCommand[] {
  const commands: PlannedValidationCommand[] = [];
  const seen = new Set<string>();
  for (const pkg of packages) {
    for (const candidate of candidates) {
      if (pkg.scripts[candidate.script] === undefined) {
        continue;
      }
      const planned = packageScriptCommand(pkg, candidate.script);
      const decision = planCommand({
        command: planned.command,
        args: planned.args,
        source: "configured"
      });
      if (!decision.allowed) {
        continue;
      }
      const display = [decision.command.command, ...decision.command.args].join(" ");
      if (seen.has(display)) {
        continue;
      }
      seen.add(display);
      commands.push({
        command: decision.command.command,
        args: decision.command.args,
        display,
        reason: pkg.directory === "."
          ? candidate.reason
          : `${candidate.reason} Package evidence: ${pkg.package_json_path}.`,
        status: "planned",
        execution: "not_executed"
      });
    }
  }
  return commands;
}

function packageScriptCommand(pkg: PackageScriptEvidence, script: string): { command: string; args: string[] } {
  if (pkg.directory === ".") {
    return {
      command: pkg.package_manager,
      args: ["run", script]
    };
  }
  if (pkg.package_manager === "pnpm") {
    return {
      command: "pnpm",
      args: ["--dir", pkg.directory, "run", script]
    };
  }
  if (pkg.package_manager === "yarn" || pkg.package_manager === "bun") {
    return {
      command: pkg.package_manager,
      args: ["--cwd", pkg.directory, "run", script]
    };
  }
  return {
    command: "npm",
    args: ["--prefix", pkg.directory, "run", script]
  };
}

function selectPackageScripts(input: {
  packages: readonly PackageScriptEvidence[];
  selectedEntries: readonly FileCatalogEntry[];
  includeAll: boolean;
}): PackageScriptEvidence[] {
  if (input.includeAll) {
    return prioritizePackageScripts(input.packages, []);
  }
  const selectedPaths = input.selectedEntries.map((entry) => entry.path);
  const relevant = input.packages.filter((pkg) =>
    selectedPaths.some((filePath) => isPackageAncestor(pkg.directory, filePath) || filePath === pkg.package_json_path)
  );
  return prioritizePackageScripts(relevant.length > 0 ? relevant : input.packages.filter((pkg) => pkg.directory === "."), selectedPaths);
}

function prioritizePackageScripts(
  packages: readonly PackageScriptEvidence[],
  selectedPaths: readonly string[]
): PackageScriptEvidence[] {
  return [...packages].sort((left, right) => {
    const leftSelected = selectedPaths.some((filePath) => isPackageAncestor(left.directory, filePath));
    const rightSelected = selectedPaths.some((filePath) => isPackageAncestor(right.directory, filePath));
    if (leftSelected !== rightSelected) {
      return leftSelected ? -1 : 1;
    }
    const depthDelta = packageDepth(right.directory) - packageDepth(left.directory);
    return depthDelta || left.directory.localeCompare(right.directory);
  });
}

function isPackageAncestor(directory: string, filePath: string): boolean {
  return directory === "." || filePath === directory || filePath.startsWith(`${directory}/`);
}

function packageDepth(directory: string): number {
  return directory === "." ? 0 : directory.split("/").length;
}

async function discoverValidationProtocol(workspace: WorkspaceFilePort): Promise<ValidationProtocolDiscovery> {
  const evidencePaths: string[] = [];
  const errors: string[] = [];
  let requiresDockerValidation = false;
  let prohibitsHostGoTest = false;

  for (const filePath of validationGuidanceCandidates()) {
    const stat = await statIfPresent(workspace, filePath);
    if (!stat.exists || !stat.is_file) {
      continue;
    }
    if (stat.size_bytes > 128_000) {
      errors.push(`${filePath} was too large to inspect for validation guidance`);
      continue;
    }
    let content: string;
    try {
      content = await workspace.readText({ path: filePath });
    } catch (_error) {
      errors.push(`${filePath} could not be read for validation guidance`);
      continue;
    }
    const lower = content.toLowerCase();
    const dockerOnly =
      /\bdocker[- ]only\b/u.test(lower) ||
      /always\s+use\s+docker/u.test(lower) ||
      /must\s+use\s+docker/u.test(lower) ||
      /validation[^.\n]{0,120}\buse\s+docker/u.test(lower);
    const noHostGo =
      /never\s+(?:run\s+)?`?go test`?\s+directly/u.test(lower) ||
      /do\s+not\s+(?:run\s+)?`?go test`?\s+directly/u.test(lower) ||
      /must\s+not\s+(?:run\s+)?`?go test`?/u.test(lower);

    if (dockerOnly || noHostGo) {
      evidencePaths.push(filePath);
      requiresDockerValidation = requiresDockerValidation || dockerOnly;
      prohibitsHostGoTest = prohibitsHostGoTest || noHostGo;
    }
  }

  return {
    requiresDockerValidation,
    prohibitsHostGoTest,
    evidencePaths: uniqueSorted(evidencePaths),
    errors
  };
}

function validationGuidanceCandidates(): string[] {
  return [
    "AGENTS.md",
    "CLAUDE.md",
    ".kiro/steering/testing-conventions.md",
    "docs/guides/ai-agent/AGENT-RULE-Testing-Conventions.md",
    "docs/testing.md",
    "docs/TESTING.md",
    "docs/developer/testing.md"
  ];
}

async function statIfPresent(
  workspace: WorkspaceFilePort,
  filePath: string
): Promise<{ exists: boolean; is_file: boolean; size_bytes: number }> {
  try {
    return await workspace.stat({ path: filePath });
  } catch (_error) {
    return { exists: false, is_file: false, size_bytes: 0 };
  }
}

function projectShapeConfigCandidates(selectedPaths: readonly string[]): string[] {
  const candidates = new Set<string>();
  for (const filePath of selectedPaths) {
    let directory = path.posix.dirname(filePath);
    while (directory !== "." && directory.length > 0) {
      candidates.add(path.posix.join(directory, "CMakeLists.txt"));
      candidates.add(path.posix.join(directory, "package.json"));
      candidates.add(path.posix.join(directory, "tsconfig.json"));
      const parent = path.posix.dirname(directory);
      if (parent === directory) {
        break;
      }
      directory = parent;
    }
  }
  return [...candidates];
}

function cmakeReason(discovery: ValidationDiscovery): string {
  const local = discovery.localCMakeFiles.length > 0
    ? ` Local CMake evidence: ${discovery.localCMakeFiles.slice(0, 3).join(", ")}.`
    : "";
  return `CMakeLists.txt and C/C++ files indicate CMake build/test validation is the primary path.${local}`;
}

async function discoverPythonNearestTests(input: {
  files: readonly FileCatalogEntry[];
  selectedEntries: readonly FileCatalogEntry[];
  workspace: WorkspaceFilePort;
}): Promise<PlannedValidationCommand[]> {
  const paths = new Set(input.files.map((file) => file.path));
  const pythonPaths = input.selectedEntries
    .filter((file) => file.file_identity.language === "python")
    .map((file) => file.path);
  const targets = new Map<string, string>();

  for (const filePath of pythonPaths) {
    if (isPythonTestPath(filePath)) {
      targets.set(filePath, "Explicit Python test file was selected.");
      continue;
    }
    for (const candidate of directPythonTestCandidates(filePath)) {
      if (paths.has(candidate)) {
        targets.set(candidate, `Nearest test inferred from ${filePath}.`);
      }
    }
  }

  const testPaths = [...paths].filter(isPythonTestPath);
  for (const sourcePath of pythonPaths.filter((filePath) => !isPythonTestPath(filePath))) {
    const moduleStem = moduleStemFromPath(sourcePath);
    const dottedModule = sourcePath.replace(/^src\//u, "").replace(/\.py$/u, "").replaceAll("/", ".");
    for (const testPath of testPaths) {
      if (targets.has(testPath)) {
        continue;
      }
      if (testPath.toLowerCase().includes(moduleStem.toLowerCase())) {
        targets.set(testPath, `Same-package test name matches ${sourcePath}.`);
        continue;
      }
      const stat = await input.workspace.stat({ path: testPath });
      if (!stat.exists || !stat.is_file || stat.size_bytes > 128_000) {
        continue;
      }
      const content = await input.workspace.readText({ path: testPath });
      if (content.includes(moduleStem) || content.includes(dottedModule)) {
        targets.set(testPath, `Same-package test mentions ${sourcePath}.`);
      }
    }
  }

  return [...targets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([target, reason]) => ({
      command: "python3",
      args: ["-m", "pytest", target],
      display: `python3 -m pytest ${target}`,
      reason,
      status: "planned" as const,
      execution: "not_executed" as const
    }));
}

function isPythonTestPath(filePath: string): boolean {
  const basename = path.posix.basename(filePath);
  return filePath.endsWith(".py") && (filePath.startsWith("tests/") || basename.startsWith("test_") || basename.endsWith("_test.py"));
}

function directPythonTestCandidates(filePath: string): string[] {
  const directory = path.posix.dirname(filePath);
  const basename = path.posix.basename(filePath);
  const testName = `test_${basename}`;
  const stem = basename.replace(/\.py$/u, "");
  const withoutSrc = directory.replace(/^src\//u, "");
  return uniqueSorted([
    path.posix.join(directory, testName),
    path.posix.join(directory, "tests", testName),
    path.posix.join("tests", withoutSrc, testName),
    path.posix.join("tests", `${stem}_test.py`),
    path.posix.join("tests", testName)
  ]);
}

function moduleStemFromPath(filePath: string): string {
  return path.posix.basename(filePath).replace(/\.py$/u, "");
}

async function discoverPackageScripts(input: {
  workspace: WorkspaceFilePort;
  packageJsonPaths: readonly string[];
  packageManager: PackageManager;
}): Promise<{ packages: PackageScriptEvidence[]; errors: string[] }> {
  const packages: PackageScriptEvidence[] = [];
  const errors: string[] = [];
  for (const packageJsonPath of uniqueSorted(input.packageJsonPaths)) {
    const result = await readPackageScripts({
      workspace: input.workspace,
      packageJsonPath,
      packageManager: input.packageManager
    });
    if (result.error !== undefined) {
      errors.push(result.error);
      continue;
    }
    packages.push(result.package);
  }
  return { packages, errors };
}

async function readPackageScripts(input: {
  workspace: WorkspaceFilePort;
  packageJsonPath: string;
  packageManager: PackageManager;
}): Promise<{ package: PackageScriptEvidence; error?: undefined } | { error: string }> {
  let parsed: { scripts?: unknown };
  try {
    const content = await input.workspace.readText({ path: input.packageJsonPath });
    parsed = JSON.parse(content) as { scripts?: unknown };
  } catch (_error) {
    return { error: `${input.packageJsonPath} could not be read as JSON` };
  }
  const directory = path.posix.dirname(input.packageJsonPath);
  const normalizedDirectory = directory === "." ? "." : directory;
  if (parsed.scripts === undefined || typeof parsed.scripts !== "object" || parsed.scripts === null) {
    return {
      package: {
        package_json_path: input.packageJsonPath,
        directory: normalizedDirectory,
        package_manager: input.packageManager,
        scripts: {}
      }
    };
  }
  return {
    package: {
      package_json_path: input.packageJsonPath,
      directory: normalizedDirectory,
      package_manager: input.packageManager,
      scripts: Object.fromEntries(
        Object.entries(parsed.scripts).filter((entry): entry is [string, string] => typeof entry[1] === "string")
      )
    }
  };
}

function detectPackageManager(paths: Set<string>): PackageManager {
  if (paths.has("package-lock.json") || paths.has("npm-shrinkwrap.json")) {
    return "npm";
  }
  if (paths.has("yarn.lock")) {
    return "yarn";
  }
  if (paths.has("bun.lock") || paths.has("bun.lockb")) {
    return "bun";
  }
  return "pnpm";
}

function isUnsafeValidationTarget(filePath: string): boolean {
  return /[;&|`$<>]/u.test(filePath);
}
