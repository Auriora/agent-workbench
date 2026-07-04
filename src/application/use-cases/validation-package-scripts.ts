/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import type { PlannedValidationCommand } from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import { planCommand } from "../../domain/policies/command-safety.js";
import type { WorkspaceFilePort } from "../../ports/index.js";
import { uniqueSorted } from "./validation-utils.js";

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

export type PackageScriptEvidence = {
  package_json_path: string;
  directory: string;
  package_manager: PackageManager;
  scripts: Record<string, string>;
  tsconfig_paths: string[];
  workspace_config_paths: string[];
};

export async function discoverPackageScripts(input: {
  workspace: WorkspaceFilePort;
  packageJsonPaths: readonly string[];
  packageManager: PackageManager;
  allPaths: ReadonlySet<string>;
}): Promise<{ packages: PackageScriptEvidence[]; errors: string[] }> {
  const packages: PackageScriptEvidence[] = [];
  const errors: string[] = [];
  for (const packageJsonPath of uniqueSorted(input.packageJsonPaths)) {
    const result = await readPackageScripts({
      workspace: input.workspace,
      packageJsonPath,
      packageManager: input.packageManager,
      allPaths: input.allPaths
    });
    if (result.error !== undefined) {
      errors.push(result.error);
      continue;
    }
    packages.push(result.package);
  }
  return { packages, errors };
}

export function configuredPackageCommands(
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
        reason: packageCommandReason(pkg, candidate.reason),
        status: "planned",
        execution: "not_executed"
      });
    }
  }
  return commands;
}

export function selectPackageScripts(input: {
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

export function detectPackageManager(paths: Set<string>): PackageManager {
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

async function readPackageScripts(input: {
  workspace: WorkspaceFilePort;
  packageJsonPath: string;
  packageManager: PackageManager;
  allPaths: ReadonlySet<string>;
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
  const tsconfigPaths = packageTsconfigPaths(normalizedDirectory, input.allPaths);
  const workspaceConfigPaths = workspaceConfigPathsForPackage(normalizedDirectory, input.allPaths);
  if (parsed.scripts === undefined || typeof parsed.scripts !== "object" || parsed.scripts === null) {
    return {
      package: {
        package_json_path: input.packageJsonPath,
        directory: normalizedDirectory,
        package_manager: input.packageManager,
        scripts: {},
        tsconfig_paths: tsconfigPaths,
        workspace_config_paths: workspaceConfigPaths
      }
    };
  }
  return {
    package: {
      package_json_path: input.packageJsonPath,
      directory: normalizedDirectory,
      package_manager: input.packageManager,
      tsconfig_paths: tsconfigPaths,
      workspace_config_paths: workspaceConfigPaths,
      scripts: Object.fromEntries(
        Object.entries(parsed.scripts).filter((entry): entry is [string, string] => typeof entry[1] === "string")
      )
    }
  };
}

function packageCommandReason(pkg: PackageScriptEvidence, baseReason: string): string {
  const evidence: string[] = [];
  if (pkg.directory !== ".") {
    evidence.push(`Package evidence: ${pkg.package_json_path}`);
  }
  if (pkg.tsconfig_paths.length > 0) {
    evidence.push(`tsconfig evidence: ${pkg.tsconfig_paths.slice(0, 2).join(", ")}`);
  }
  if (pkg.workspace_config_paths.length > 0) {
    evidence.push(`workspace evidence: ${pkg.workspace_config_paths.slice(0, 2).join(", ")}`);
  }
  return evidence.length === 0
    ? baseReason
    : `${baseReason} ${evidence.join(". ")}.`;
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

function packageTsconfigPaths(directory: string, paths: ReadonlySet<string>): string[] {
  const candidates = [
    path.posix.join(directory, "tsconfig.json"),
    path.posix.join(directory, "tsconfig.app.json"),
    path.posix.join(directory, "tsconfig.build.json"),
    path.posix.join(directory, "tsconfig.node.json")
  ].map((candidate) => candidate.replace(/^\.\//u, ""));
  return candidates.filter((candidate) => paths.has(candidate)).sort();
}

function workspaceConfigPathsForPackage(directory: string, paths: ReadonlySet<string>): string[] {
  const candidates = [
    "pnpm-workspace.yaml",
    "pnpm-workspace.yml",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
    "nx.json",
    "turbo.json"
  ];
  if (directory === ".") {
    return candidates.filter((candidate) => paths.has(candidate)).sort();
  }
  return candidates.filter((candidate) => paths.has(candidate)).sort();
}
