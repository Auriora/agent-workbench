/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { EvidenceCoverageState } from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";

export type RailsDiscoveryMetadata = {
  rails_project_roots: readonly string[];
  rails_roles: readonly string[];
  rails_is_config_file: boolean;
  rails_is_route_file: boolean;
  rails_is_test_file: boolean;
};

export type RailsProjectShape = {
  rails_roots: readonly string[];
  route_file_paths: readonly string[];
  config_file_paths: readonly string[];
  test_file_paths: readonly string[];
  role_file_paths: readonly string[];
  role_roots: readonly string[];
  provenance: "catalog_scan";
  evidence_coverage_state: EvidenceCoverageState;
  evidence_caveats: readonly string[];
};

type CandidateShapeFile = {
  metadata: RailsDiscoveryMetadata;
  file_roots: readonly string[];
};

export function detectRailsProjectShape(input: {
  files: readonly FileCatalogEntry[];
  scan_truncated?: boolean;
}): RailsProjectShape {
  const routeFilePaths = new Set<string>();
  const configFilePaths = new Set<string>();
  const testFilePaths = new Set<string>();
  const roleFilePaths = new Set<string>();
  const roleRoots = new Set<string>();
  const routeAnchors = new Set<string>();
  const applicationAnchors = new Set<string>();
  const engineAnchors = new Set<string>();
  const configRuRoots = new Set<string>();
  const candidates = new Map<string, CandidateShapeFile>();

  for (const file of input.files) {
    const metadata = discoverRailsPathMetadata(file.path);
    if (metadata === undefined) {
      if (isRailsConfigRu(file.path)) {
        for (const root of inferRailsProjectRoots(file.path)) {
          configRuRoots.add(root);
        }
      }
      continue;
    }

    const fileRoots = metadata.rails_project_roots;
    candidates.set(file.path, { metadata, file_roots: fileRoots });

    if (metadata.rails_is_route_file) {
      for (const root of fileRoots) {
        routeAnchors.add(root);
      }
    }
    if (isRailsApplicationConfigFile(file.path)) {
      for (const root of fileRoots) {
        applicationAnchors.add(root);
      }
    }
    if (isRailsEngineFile(file.path)) {
      for (const root of fileRoots) {
        engineAnchors.add(root);
      }
    }
    if (isRailsConfigRu(file.path)) {
      for (const root of fileRoots) {
        configRuRoots.add(root);
      }
    }
  }

  const admittedRoots = new Set<string>();
  for (const root of routeAnchors) {
    admittedRoots.add(root);
  }
  for (const root of applicationAnchors) {
    admittedRoots.add(root);
  }
  for (const root of engineAnchors) {
    admittedRoots.add(root);
  }
  for (const root of configRuRoots) {
    if (routeAnchors.has(root) || applicationAnchors.has(root) || engineAnchors.has(root)) {
      admittedRoots.add(root);
    }
  }

  for (const [path, candidate] of candidates.entries()) {
    const roots = candidate.file_roots.filter((root) => admittedRoots.has(root));
    if (roots.length === 0) {
      continue;
    }

    const metadata = candidate.metadata;
    if (metadata.rails_is_route_file) {
      routeFilePaths.add(path);
    }
    if (metadata.rails_is_config_file) {
      configFilePaths.add(path);
    }
    if (metadata.rails_is_test_file) {
      testFilePaths.add(path);
    }
    if (metadata.rails_roles.length > 0) {
      roleFilePaths.add(path);
      for (const root of roots) {
        roleRoots.add(root);
      }
    }
  }

  const railsRoots = new Set<string>([...admittedRoots, ...routeAnchors]);

  const caveats: string[] = [];
  if (input.scan_truncated === true) {
    caveats.push("graph_scan_truncated");
  }

  return {
    rails_roots: [...railsRoots].sort(),
    route_file_paths: [...routeFilePaths].sort(),
    config_file_paths: [...configFilePaths].sort(),
    test_file_paths: [...testFilePaths].sort(),
    role_file_paths: [...roleFilePaths].sort(),
    role_roots: [...roleRoots].sort(),
    provenance: "catalog_scan",
    evidence_coverage_state: input.scan_truncated === true ? "partial" : "complete",
    evidence_caveats: caveats
  };
}

export function projectAdmitsRailsDiscovery(input: {
  filePath: string;
  discovery: RailsDiscoveryMetadata;
  shape: RailsProjectShape;
}): boolean {
  if (input.discovery.rails_is_route_file && !input.shape.route_file_paths.includes(input.filePath)) {
    return false;
  }
  if (input.discovery.rails_is_config_file && !input.shape.config_file_paths.includes(input.filePath)) {
    return false;
  }
  if (input.discovery.rails_is_test_file && !input.shape.test_file_paths.includes(input.filePath)) {
    return false;
  }
  if (input.discovery.rails_roles.length > 0 && !input.shape.role_file_paths.includes(input.filePath)) {
    return false;
  }
  if (input.discovery.rails_project_roots.length > 0 &&
    !input.discovery.rails_project_roots.some((root) => input.shape.rails_roots.includes(root))) {
    return false;
  }

  return true;
}

function discoverRailsPathMetadata(filePath: string): RailsDiscoveryMetadata | undefined {
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

function inferRailsProjectRoots(filePath: string): string[] {
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

  const libEngineIndex = lowerSegments.lastIndexOf("lib");
  if (libEngineIndex >= 0 && lowerSegments.at(-1) === "engine.rb") {
    return [normalizeRoot(lowerSegments.slice(0, libEngineIndex))];
  }

  const basename = basenameFromSegments(lowerSegments);
  if (isRailsManifestPath(normalized, basename)) {
    return [normalizeRoot(lowerSegments.slice(0, -1))];
  }

  return [];
}

function isRailsRouteFile(filePath: string): boolean {
  const normalized = normalizeRepoPath(filePath).toLowerCase();
  return normalized.endsWith("/config/routes.rb") || normalized === "config/routes.rb";
}

function isRailsConfigFile(filePath: string): boolean {
  const normalized = normalizeRepoPath(filePath).toLowerCase();
  return normalized === "config.ru" ||
    isRailsConfigRu(normalized) ||
    normalized.startsWith("config/") ||
    normalized.includes("/config/");
}

function isRailsTestFile(filePath: string): boolean {
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

function isRailsConfigRu(filePath: string): boolean {
  const normalized = normalizeRepoPath(filePath).toLowerCase();
  return normalized === "config.ru" || normalized.endsWith("/config.ru");
}

function isRailsApplicationConfigFile(filePath: string): boolean {
  const normalized = normalizeRepoPath(filePath).toLowerCase();
  return normalized.endsWith("/config/application.rb") || normalized === "config/application.rb";
}

function isRailsEngineFile(filePath: string): boolean {
  const normalized = normalizeRepoPath(filePath).toLowerCase();
  const segments = normalized.split("/");
  const libIndex = segments.lastIndexOf("lib");
  if (libIndex < 0) {
    return false;
  }
  return segments.at(-1) === "engine.rb" && libIndex + 1 < segments.length - 1;
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
  const appIndexBeforeNamespace = lastIndexForRoleBoundaryBeforeNamespace(segments, "app");
  if (appIndexBeforeNamespace >= 0) {
    return appIndexBeforeNamespace;
  }
  const srcIndex = lastIndexForPattern(segments, "src");
  if (srcIndex >= 0 && isRailsRoleSegment(segments[srcIndex + 1])) {
    return srcIndex;
  }
  const srcIndexBeforeNamespace = lastIndexForRoleBoundaryBeforeNamespace(segments, "src");
  if (srcIndexBeforeNamespace >= 0) {
    return srcIndexBeforeNamespace;
  }
  return -1;
}

function lastIndexForRoleBoundaryBeforeNamespace(segments: readonly string[], anchor: string): number {
  let index = segments.length - 3;
  while (index >= 0) {
    if (segments[index] === anchor && index + 2 < segments.length && isRailsRoleSegment(segments[index + 2])) {
      return index;
    }
    index -= 1;
  }
  return -1;
}

function isRailsRoleSegment(segment: string | undefined): boolean {
  return segment !== undefined && railsRoleByDirectory.has(segment);
}

function basenameFromSegments(segments: readonly string[]): string {
  return segments[segments.length - 1] ?? "";
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
  let index = segments.length - 1;
  while (index >= 0) {
    if (segments[index] === value) {
      return index;
    }
    index -= 1;
  }
  return -1;
}

function normalizeRoot(segments: readonly string[]): string {
  if (segments.length === 0) {
    return ".";
  }
  return segments.join("/");
}

function normalizeRepoPath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\//u, "");
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
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
