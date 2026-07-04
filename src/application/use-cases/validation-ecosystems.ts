/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import type { PlannedValidationCommand } from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import type { WorkspaceFilePort } from "../../ports/index.js";
import { normalizeRepoPath, statIfPresent, uniqueSorted } from "./validation-utils.js";

export type CMakeTargetEvidence = {
  name: string;
  kind: "library" | "executable";
  path: string;
  sources: string[];
};

export type CMakeDiscovery = {
  localCMakeFiles: readonly string[];
  cmakeTargets: readonly CMakeTargetEvidence[];
};

export function projectShapeConfigCandidates(selectedPaths: readonly string[]): string[] {
  const candidates = new Set<string>();
  for (const filePath of selectedPaths) {
    let directory = path.posix.dirname(filePath);
    while (directory !== "." && directory.length > 0) {
      candidates.add(path.posix.join(directory, "CMakeLists.txt"));
      candidates.add(path.posix.join(directory, "package.json"));
      candidates.add(path.posix.join(directory, "tsconfig.json"));
      candidates.add(path.posix.join(directory, "tsconfig.app.json"));
      candidates.add(path.posix.join(directory, "tsconfig.build.json"));
      candidates.add(path.posix.join(directory, "tsconfig.node.json"));
      candidates.add(path.posix.join(directory, "template.yaml"));
      candidates.add(path.posix.join(directory, "template.yml"));
      candidates.add(path.posix.join(directory, "template.json"));
      candidates.add(path.posix.join(directory, `${path.posix.basename(directory)}.csproj`));
      candidates.add(path.posix.join(directory, `${path.posix.basename(directory)}.fsproj`));
      candidates.add(path.posix.join(directory, `${path.posix.basename(directory)}.vbproj`));
      const parent = path.posix.dirname(directory);
      if (parent === directory) {
        break;
      }
      directory = parent;
    }
  }
  return [...candidates];
}

export function nearestDotnetProject(input: {
  selectedEntries: readonly FileCatalogEntry[];
  projects: readonly string[];
}): string | undefined {
  const selectedPaths = input.selectedEntries.map((entry) => entry.path);
  return [...input.projects].sort((left, right) => projectDistance(left, selectedPaths) - projectDistance(right, selectedPaths) || left.localeCompare(right))[0];
}

export function dotnetTestTargets(input: {
  selectedEntries: readonly FileCatalogEntry[];
  selectedProject: string | undefined;
  testProjects: readonly string[];
}): string[] {
  if (input.testProjects.length === 0) {
    return [];
  }
  const selectedPaths = input.selectedEntries.map((entry) => entry.path);
  const relevant =
    input.selectedProject === undefined
      ? input.testProjects
      : input.testProjects.filter((testProject) =>
          isRelevantDotnetTestProject({
            selectedProject: input.selectedProject ?? "",
            testProject,
            selectedPaths
          })
        );
  if (relevant.length === 0 && input.selectedProject !== undefined) {
    return [];
  }
  const ranked = [...input.testProjects].sort(
    (left, right) => projectDistance(left, selectedPaths) - projectDistance(right, selectedPaths) || left.localeCompare(right)
  );
  return ranked.filter((testProject) => relevant.includes(testProject)).slice(0, 2);
}

export function isDotnetProjectPath(filePath: string): boolean {
  return [".csproj", ".fsproj", ".vbproj"].includes(lowerExtension(filePath));
}

export function isDotnetTestProjectPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.includes("test") || lower.includes("spec");
}

export function isSamTemplatePath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    (lower.endsWith("template.yaml") || lower.endsWith("template.yml") || lower.endsWith("template.json")) &&
    (lower.includes("/sam/") || lower.includes("/cloudformation/") || lower.startsWith("infra/") || lower.startsWith("template."))
  );
}

export function isSamRelatedPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return isSamTemplatePath(lower) || lower.includes("/lambda/") || lower.includes("/handlers/") || lower.endsWith("/app.py") || lower.includes("/tests/infra/");
}

export function isSamInfraTestPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.endsWith(".py") && (lower.startsWith("tests/infra/") || lower.startsWith("test/infra/") || lower.includes("/tests/infra/") || lower.includes("/test/infra/"));
}

export function isGithubWorkflowPath(filePath: string): boolean {
  const lower = normalizeRepoPath(filePath).toLowerCase();
  return lower.startsWith(".github/workflows/") && (lower.endsWith(".yml") || lower.endsWith(".yaml"));
}

export function lowerExtension(filePath: string): string {
  const basename = path.posix.basename(filePath).toLowerCase();
  const dot = basename.lastIndexOf(".");
  return dot <= 0 ? "" : basename.slice(dot);
}

export function selectSamTemplates(input: {
  templates: readonly string[];
  selectedEntries: readonly FileCatalogEntry[];
  includeAll: boolean;
}): string[] {
  if (input.includeAll) {
    return [...input.templates].sort();
  }
  const selectedPaths = new Set(input.selectedEntries.map((entry) => entry.path));
  const selectedTemplates = input.templates.filter((template) => selectedPaths.has(template));
  const selectedDirectories = new Set(
    [...selectedPaths]
      .map((filePath) => path.posix.dirname(filePath))
      .flatMap((directory) => parentDirectories(directory))
  );
  const nearbyTemplates = input.templates.filter(
    (template) => !selectedPaths.has(template) && selectedDirectories.has(path.posix.dirname(template))
  );
  const fallback = input.templates.filter((template) => !selectedPaths.has(template) && !nearbyTemplates.includes(template));
  return [...selectedTemplates.sort(), ...nearbyTemplates.sort(), ...fallback.sort()];
}

export function isDocsOrConfigLanguage(language: string): boolean {
  return ["config", "markdown", "json", "toml", "yaml"].includes(language);
}

export function markdownQualityCommands(input: {
  files: readonly FileCatalogEntry[];
  selectedEntries: readonly FileCatalogEntry[];
  includeAll: boolean;
}): PlannedValidationCommand[] {
  const markdownEntries = input.includeAll
    ? input.files.filter((file) => file.file_identity.language === "markdown")
    : input.selectedEntries.filter((file) => file.file_identity.language === "markdown");
  if (markdownEntries.length === 0) {
    return [];
  }
  if (input.includeAll) {
    const scopePath = markdownEntries.some((entry) => entry.path === "docs" || entry.path.startsWith("docs/")) ? "docs" : ".";
    return [
      {
        command: "check_markdown_set",
        args: ["--scope-path", scopePath],
        display: `check_markdown_set --scope-path ${scopePath}`,
        reason: "Repository Markdown documents are present; bounded Markdown quality checks are planned, not executed.",
        status: "planned",
        execution: "not_executed"
      }
    ];
  }
  return markdownEntries.slice(0, 5).map((entry) => ({
    command: "check_markdown_document",
    args: [entry.path],
    display: `check_markdown_document ${entry.path}`,
    reason: `${entry.path} is a changed Markdown document; read-only Markdown quality checks are planned, not executed.`,
    status: "planned" as const,
    execution: "not_executed" as const
  }));
}

export function cmakeValidationCommands(input: {
  discovery: CMakeDiscovery;
  selectedEntries: readonly FileCatalogEntry[];
  includeAll: boolean;
}): PlannedValidationCommand[] {
  const commands: PlannedValidationCommand[] = [
    {
      command: "cmake",
      args: ["-S", ".", "-B", "build"],
      display: "cmake -S . -B build",
      reason: `${cmakeReason(input.discovery)} Configure command is a non-executed template.`,
      status: "planned",
      execution: "not_executed"
    }
  ];
  const target = nearestCMakeTarget({
    targets: input.discovery.cmakeTargets,
    selectedEntries: input.selectedEntries,
    includeAll: input.includeAll
  });
  if (target !== undefined) {
    commands.push({
      command: "cmake",
      args: ["--build", "build", "--target", target.name],
      display: `cmake --build build --target ${target.name}`,
      reason: `${target.path} declares ${target.kind} target ${target.name} with source evidence: ${target.sources.slice(0, 5).join(", ") || "none listed"}. Command is planned but not executed.`,
      status: "planned",
      execution: "not_executed"
    });
  }
  commands.push({
    command: "ctest",
    args: ["--test-dir", "build"],
    display: "ctest --test-dir build",
    reason: "CMake project evidence supports a non-executed CTest template after configure/build; inspect project policy before execution.",
    status: "planned",
    execution: "not_executed"
  });
  return commands;
}

export async function discoverCMakeTargets(input: {
  workspace: WorkspaceFilePort;
  cmakeFiles: readonly string[];
}): Promise<CMakeTargetEvidence[]> {
  const targets: CMakeTargetEvidence[] = [];
  for (const cmakeFile of input.cmakeFiles.slice(0, 20)) {
    const stat = await statIfPresent(input.workspace, cmakeFile);
    if (!stat.exists || !stat.is_file || stat.size_bytes > 256_000) {
      continue;
    }
    const content = await input.workspace.readText({ path: cmakeFile });
    targets.push(...parseCMakeTargets(cmakeFile, content));
  }
  return targets.sort((left, right) => left.path.localeCompare(right.path) || left.name.localeCompare(right.name));
}

export async function discoverGoCiCommands(input: {
  workflowPaths: readonly string[];
  workspace: WorkspaceFilePort;
}): Promise<PlannedValidationCommand[]> {
  const commands: PlannedValidationCommand[] = [];
  const seen = new Set<string>();
  for (const workflowPath of input.workflowPaths.slice(0, 5)) {
    const stat = await statIfPresent(input.workspace, workflowPath);
    if (!stat.exists || !stat.is_file || stat.size_bytes > 128_000) {
      continue;
    }
    let content: string;
    try {
      content = await input.workspace.readText({ path: workflowPath });
    } catch (_error) {
      continue;
    }
    for (const rawLine of content.split(/\r?\n/u)) {
      const command = goCiCommandFromWorkflowLine(rawLine);
      if (command === null || seen.has(command.display)) {
        continue;
      }
      seen.add(command.display);
      commands.push({
        ...command,
        reason: `${workflowPath} plans Go validation through CI run-step evidence.`,
        status: "planned",
        execution: "not_executed"
      });
      if (commands.length >= 3) {
        return commands;
      }
    }
  }
  return commands;
}

export async function discoverPythonNearestTests(input: {
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

function parentDirectories(directory: string): string[] {
  const directories = [directory];
  let current = directory;
  while (current.includes("/")) {
    current = current.slice(0, current.lastIndexOf("/"));
    directories.push(current);
  }
  directories.push(".");
  return [...new Set(directories)];
}

function isRelevantDotnetTestProject(input: {
  selectedProject: string;
  testProject: string;
  selectedPaths: readonly string[];
}): boolean {
  const selectedName = dotnetProjectStem(input.selectedProject);
  const testName = dotnetProjectStem(input.testProject);
  if (selectedName.length > 0 && testName.startsWith(selectedName)) {
    return true;
  }
  const selectedDir = path.posix.dirname(input.selectedProject);
  return input.selectedPaths.some((selectedPath) => selectedPath.startsWith(`${selectedDir}/`)) &&
    testName.includes(selectedName);
}

function dotnetProjectStem(projectPath: string): string {
  return path.posix.basename(projectPath).replace(/\.(?:csproj|fsproj|vbproj)$/iu, "").replace(/\.(?:tests?|specs?)$/iu, "").toLowerCase();
}

function projectDistance(projectPath: string, selectedPaths: readonly string[]): number {
  const projectDir = path.posix.dirname(projectPath);
  if (selectedPaths.length === 0) {
    return 0;
  }
  return Math.min(
    ...selectedPaths.map((selectedPath) => {
      if (selectedPath === projectPath) return 0;
      if (selectedPath.startsWith(`${projectDir}/`)) return 1;
      const projectRoot = projectDir.split("/")[0] ?? "";
      return selectedPath.startsWith(`${projectRoot}/`) ? 5 : 20;
    })
  );
}

function cmakeReason(discovery: CMakeDiscovery): string {
  const local = discovery.localCMakeFiles.length > 0
    ? ` Local CMake evidence: ${discovery.localCMakeFiles.slice(0, 3).join(", ")}.`
    : "";
  return `CMakeLists.txt and C/C++ files indicate CMake build/test validation is the primary path.${local}`;
}

function nearestCMakeTarget(input: {
  targets: readonly CMakeTargetEvidence[];
  selectedEntries: readonly FileCatalogEntry[];
  includeAll: boolean;
}): CMakeTargetEvidence | undefined {
  if (input.targets.length === 0) {
    return undefined;
  }
  const selectedPaths = input.selectedEntries.map((entry) => entry.path);
  return [...input.targets].sort((left, right) => {
    const leftScore = cmakeTargetScore(left, selectedPaths, input.includeAll);
    const rightScore = cmakeTargetScore(right, selectedPaths, input.includeAll);
    return rightScore - leftScore || left.path.localeCompare(right.path) || left.name.localeCompare(right.name);
  })[0];
}

function cmakeTargetScore(target: CMakeTargetEvidence, selectedPaths: readonly string[], includeAll: boolean): number {
  if (includeAll || selectedPaths.length === 0) {
    return target.path === "CMakeLists.txt" ? 10 : 8;
  }
  const targetDir = path.posix.dirname(target.path);
  let score = 0;
  for (const selectedPath of selectedPaths) {
    const selectedBase = path.posix.basename(selectedPath);
    if (target.sources.includes(selectedBase)) {
      score += 30;
    }
    if (target.sources.some((source) => path.posix.normalize(path.posix.join(targetDir, source)) === selectedPath)) {
      score += 40;
    }
    if (selectedPath.startsWith(`${targetDir}/`)) {
      score += 10;
    }
  }
  return score;
}

function parseCMakeTargets(filePath: string, content: string): CMakeTargetEvidence[] {
  const targets: CMakeTargetEvidence[] = [];
  const lines = content.split(/\r?\n/u);
  for (const line of lines) {
    const match = /^\s*add_(library|executable)\s*\(\s*([A-Za-z_][A-Za-z0-9_.:-]*)\b([^)]*)\)/u.exec(line);
    if (!match) {
      continue;
    }
    targets.push({
      kind: match[1] === "library" ? "library" : "executable",
      name: match[2] ?? "",
      path: filePath,
      sources: (match[3] ?? "")
        .trim()
        .split(/\s+/u)
        .filter((part) => part.length > 0 && !part.startsWith("$<"))
    });
  }
  return targets;
}

function goCiCommandFromWorkflowLine(rawLine: string): Omit<PlannedValidationCommand, "reason" | "status" | "execution"> | null {
  const match = /^\s*-\s*run:\s*(.+)$/u.exec(rawLine);
  const commandText = stripYamlScalarQuotes(match?.[1]?.trim() ?? "");
  if (commandText === "make test") {
    return {
      command: "make",
      args: ["test"],
      display: "make test"
    };
  }
  if (commandText === "go test ./...") {
    return {
      command: "go",
      args: ["test", "./..."],
      display: "go test ./..."
    };
  }
  const dockerCompose = /^docker\s+compose\s+run\s+--rm\s+([A-Za-z0-9_.-]+)\s+go\s+test\s+(.+)$/u.exec(commandText);
  if (dockerCompose?.[1] !== undefined && dockerCompose[2] !== undefined) {
    return {
      command: "docker",
      args: ["compose", "run", "--rm", dockerCompose[1], "go", "test", dockerCompose[2]],
      display: commandText
    };
  }
  return null;
}

function stripYamlScalarQuotes(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
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
