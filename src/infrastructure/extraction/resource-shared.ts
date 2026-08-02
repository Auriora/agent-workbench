/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ExtractionRequest } from "../../domain/models/index.js";

export type RailsDiscoveryMetadata = {
  rails_project_roots: readonly string[];
  rails_roles: readonly string[];
  rails_is_config_file: boolean;
  rails_is_route_file: boolean;
  rails_is_test_file: boolean;
};

export function nodeId(snapshotId: string, filePath: string, kind: string, name: string): string {
  return `${snapshotId}:${filePath}:${kind}:${name}`;
}

export function lineRange(line: string, lineNumber: number) {
  return {
    start_line: lineNumber,
    start_column: 0,
    end_line: lineNumber,
    end_column: line.length
  };
}

export function fullFileRange(content: string) {
  const lines = content.split("\n");
  const endLine = Math.max(1, lines.length);
  const lastLine = lines[lines.length - 1] ?? "";
  return {
    start_line: 1,
    start_column: 0,
    end_line: endLine,
    end_column: lastLine.length
  };
}

export function lambdaHandlerTarget(handler: string): { file_paths: string[]; export_name: string } | undefined {
  const normalized = handler.trim().replaceAll("\\", "/");
  const lastDot = normalized.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === normalized.length - 1) {
    return undefined;
  }
  const modulePath = normalized.slice(0, lastDot);
  const exportName = normalized.slice(lastDot + 1);
  if (!/^[A-Za-z0-9_./-]+$/u.test(modulePath) || !/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(exportName)) {
    return undefined;
  }
  const candidateExtensions = [".py", ".ts", ".js", ".mjs", ".cjs"];
  const existingExtension = pathExtension(modulePath);
  return {
    file_paths: existingExtension.length > 0 ? [modulePath] : candidateExtensions.map((extension) => `${modulePath}${extension}`),
    export_name: exportName
  };
}

export function resourceNodeIdentity(input: ExtractionRequest): {
  id: string;
  qualified_name: string;
  file_path: string;
  language: string;
} {
  return {
    id: nodeId(input.snapshot_id, input.path, "resource", input.path),
    qualified_name: input.path,
    file_path: input.path,
    language: input.language
  };
}

export function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}

export function discoverRailsPathMetadata(filePath: string): RailsDiscoveryMetadata | undefined {
  const normalized = normalizeRepoPath(filePath);
  const roots = inferRailsProjectRoots(normalized);
  const roles = resolveRailsRoles(normalized);
  const railsIsConfigFile = isRailsConfigFile(normalized);
  const railsIsRouteFile = isRailsRouteFile(normalized);
  const railsIsTestFile = isRailsTestFile(normalized);

  if (!railsIsConfigFile && !railsIsRouteFile && !railsIsTestFile && roles.length === 0) {
    return undefined;
  }

  return {
    rails_project_roots: roots,
    rails_roles: roles,
    rails_is_config_file: railsIsConfigFile,
    rails_is_route_file: railsIsRouteFile,
    rails_is_test_file: railsIsTestFile
  };
}

export function inferRailsProjectRoots(filePath: string): string[] {
  const normalized = normalizeRepoPath(filePath);
  const lowerSegments = normalized.split("/").map((segment) => segment.toLowerCase());
  const roleIndex = lastIndexForRoleBoundary(lowerSegments);
  if (roleIndex >= 0) {
    return [normalizeRoot(lowerSegments.slice(0, roleIndex))];
  }

  const configIndex = lowerSegments.indexOf("config");
  if (configIndex > -1) {
    return [normalizeRoot(lowerSegments.slice(0, configIndex))];
  }

  const migrationIndex = lowerSegments.indexOf("db");
  if (migrationIndex > -1 && lowerSegments[migrationIndex + 1] === "migrate") {
    return [normalizeRoot(lowerSegments.slice(0, migrationIndex))];
  }

  const testRootIndex = indexOfAny(lowerSegments, "test", "spec");
  if (testRootIndex > -1) {
    return [normalizeRoot(lowerSegments.slice(0, testRootIndex))];
  }

  const basename = basenameFromSegments(lowerSegments);
  if (isRailsManifestPath(normalized, basename)) {
    return [normalizeRoot(lowerSegments.slice(0, -1))];
  }

  return [];
}

export function isRailsConfigFile(filePath: string): boolean {
  const normalized = normalizeRepoPath(filePath).toLowerCase();
  return normalized === "config.ru" ||
    normalized.endsWith("/config.ru") ||
    normalized.startsWith("config/") ||
    normalized.includes("/config/");
}

export function isRailsRouteFile(filePath: string): boolean {
  const normalized = normalizeRepoPath(filePath).toLowerCase();
  return normalized === "config/routes.rb" ||
    normalized.endsWith("/config/routes.rb") ||
    normalized.startsWith("config/routes/") && normalized.endsWith(".rb") ||
    normalized.includes("/config/routes/") && normalized.endsWith(".rb");
}

export function isRailsTestFile(filePath: string): boolean {
  const normalized = normalizeRepoPath(filePath).toLowerCase();
  const basename = normalized.slice(normalized.lastIndexOf("/") + 1);
  if (!/\.rb$/u.test(basename)) {
    return false;
  }
  if (/_spec\.rb$/u.test(basename) || /_test\.rb$/u.test(basename)) {
    return normalized.startsWith("spec/") ||
      normalized.startsWith("test/") ||
      normalized.includes("/spec/") ||
      normalized.includes("/test/");
  }
  return false;
}

function resolveRailsRoles(filePath: string): string[] {
  const lowerSegments = normalizeRepoPath(filePath).toLowerCase().split("/");
  const roleBoundaryIndex = lastIndexForRoleBoundary(lowerSegments);
  if (roleBoundaryIndex < 0) {
    return [];
  }

  const roleSegments = lowerSegments.slice(roleBoundaryIndex + 1);
  const firstRoleIndex = roleSegments.findIndex((segment) => railsRoleByDirectory.has(segment));
  if (firstRoleIndex < 0) {
    return [];
  }

  const normalizedRoleSegments = roleSegments.slice(firstRoleIndex);
  const roles = normalizedRoleSegments.filter((segment) => railsRoleByDirectory.has(segment))
    .map((segment) => {
      if (segment === "models" && normalizedRoleSegments.includes("concerns")) {
        return "concern";
      }
      return railsRoleByDirectory.get(segment) ?? segment.slice(0, -1);
    });
  return uniqueSorted(roles);
}

function lastIndexForRoleBoundary(segments: readonly string[]): number {
  const appIndex = lastIndexForPattern(segments, "app");
  if (appIndex >= 0 && isRailsRoleSegment(segments[appIndex + 1])) {
    return appIndex;
  }
  let appIndexBeforeNamespace = segments.length - 3;
  while (appIndexBeforeNamespace >= 0) {
    if (
      segments[appIndexBeforeNamespace] === "app" &&
      appIndexBeforeNamespace + 2 < segments.length &&
      isRailsRoleSegment(segments[appIndexBeforeNamespace + 2])
    ) {
      return appIndexBeforeNamespace;
    }
    appIndexBeforeNamespace -= 1;
  }
  const srcIndex = lastIndexForPattern(segments, "src");
  if (srcIndex >= 0 && isRailsRoleSegment(segments[srcIndex + 1])) {
    return srcIndex;
  }
  let srcIndexBeforeNamespace = segments.length - 3;
  while (srcIndexBeforeNamespace >= 0) {
    if (
      segments[srcIndexBeforeNamespace] === "src" &&
      srcIndexBeforeNamespace + 2 < segments.length &&
      isRailsRoleSegment(segments[srcIndexBeforeNamespace + 2])
    ) {
      return srcIndexBeforeNamespace;
    }
    srcIndexBeforeNamespace -= 1;
  }
  return -1;
}

function isRailsRoleSegment(segment: string | undefined): boolean {
  return segment !== undefined && railsRoleByDirectory.has(segment);
}

function basenameFromSegments(segments: readonly string[]): string {
  return segments[segments.length - 1] ?? "";
}

export function isRailsManifestFile(filePath: string): boolean {
  const normalized = normalizeRepoPath(filePath).toLowerCase();
  const lower = basenameFromSegments(normalized.split("/")).toLowerCase();
  return lower === "gemfile" ||
    lower === "gemfile.lock" ||
    lower === "rakefile" ||
    lower === "config.ru" ||
    lower === ".ruby-version" ||
    normalized === "config.ru" ||
    normalized.endsWith("/config.ru") ||
    normalized === "rakefile";
}

function isRailsManifestPath(path: string, basename: string): boolean {
  return basename === "gemfile" ||
    basename === "gemfile.lock" ||
    basename === "rakefile" ||
    basename === ".ruby-version" ||
    path === "config.ru" ||
    path.endsWith("/config.ru");
}

function indexOfAny<T>(segments: readonly T[], ...values: readonly T[]): number {
  return segments.findIndex((segment) => values.includes(segment));
}

function lastIndexForPattern(segments: readonly string[], value: string): number {
  return segments.lastIndexOf(value);
}

function normalizeRoot(segments: readonly string[]): string {
  if (segments.length === 0) {
    return ".";
  }
  return segments.join("/");
}

function normalizeRepoPath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

const railsRoleByDirectory = new Map<string, string>([
  ["channels", "channel"],
  ["concerns", "concern"],
  ["controllers", "controller"],
  ["helpers", "helper"],
  ["jobs", "job"],
  ["mailers", "mailer"],
  ["migrate", "migration"],
  ["models", "model"],
  ["services", "service"]
]);

function pathExtension(filePath: string): string {
  const slash = filePath.lastIndexOf("/");
  const basename = slash >= 0 ? filePath.slice(slash + 1) : filePath;
  const dot = basename.lastIndexOf(".");
  return dot <= 0 ? "" : basename.slice(dot);
}
