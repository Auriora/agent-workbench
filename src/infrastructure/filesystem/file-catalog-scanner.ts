/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import {
  buildFileCatalogEntry,
  catalogSkipReason,
  createSkippedPathPopulationAccumulator,
  mergeSkippedRoots,
  normalizeCatalogPath,
  type GitignoreRule,
  type RepositoryCompositionAdmissionReceipt,
  type RepositoryCompositionAdmissionUnit
} from "../../domain/policies/index.js";
import type {
  FileCatalogScanPort,
  FileCatalogScanResult,
  FileCatalogSkippedPath,
  FileIdentityPort
} from "../../ports/index.js";
import { FileIdentityAdapter } from "./file-identity.js";
import { readRootIgnoreRules } from "./ignore-file-policy.js";
import { isNestedGitRepository } from "./nested-git-repository.js";

const MAX_SKIPPED_PATHS = 100;

export class FileCatalogScannerAdapter implements FileCatalogScanPort {
  private readonly fileIdentity: FileIdentityPort;

  constructor(input: { fileIdentity?: FileIdentityPort } = {}) {
    this.fileIdentity = input.fileIdentity ?? new FileIdentityAdapter();
  }

  public async scan(input: {
    repo_root: string;
    indexed_roots: readonly string[];
    skipped_roots: readonly string[];
    max_files: number;
    after_path?: string;
    priority_paths?: readonly string[];
    priority_path_patterns?: readonly string[];
    repository_composition?: RepositoryCompositionAdmissionReceipt;
  }): Promise<FileCatalogScanResult> {
    if (!Number.isSafeInteger(input.max_files) || input.max_files <= 0) {
      throw new TypeError("max_files must be a positive safe integer.");
    }
    const repoRoot = path.resolve(input.repo_root);
    const indexedRoots = input.indexed_roots.length > 0 ? input.indexed_roots : ["."];
    const entries: FileCatalogEntry[] = [];
    const skippedPaths: FileCatalogSkippedPath[] = [];
    const skippedPathPopulation = createSkippedPathPopulationAccumulator<FileCatalogSkippedPath["reason"]>();
    const skippedRoots = new Set(input.skipped_roots);
    const recordSkippedPath = skippedPathRecorder(skippedPaths, skippedPathPopulation);
    const prioritizedPaths = normalizeCatalogPaths(input.priority_paths ?? []);
    const prioritizedPathPatterns = normalizeCatalogPatterns(input.priority_path_patterns ?? []);
    const prioritySet = new Set<string>();
    const admittedPriorityPaths: string[] = [];
    const scanUnits = buildScanUnits(repoRoot, indexedRoots, input.repository_composition);
    let truncated = false;
    let continuationCursor: string | undefined;
    const normalizedAfterPath = input.after_path === undefined
      ? undefined
      : normalizeScanPath(repoRoot, input.after_path);

    for (const requestedPath of prioritizedPaths) {
      if (prioritySet.has(requestedPath)) {
        continue;
      }
      prioritySet.add(requestedPath);
      const absolutePath = path.resolve(repoRoot, requestedPath);
      if (!isInsideRepo(repoRoot, absolutePath)) {
        recordSkippedPath({
          path: requestedPath,
          reason: "workspace_escape",
          detail: catalogSkipDetail("workspace_escape")
        });
        continue;
      }
      if (!fs.existsSync(absolutePath)) {
        continue;
      }
      const owner = findOwningScanUnit(scanUnits, requestedPath);
      const ownerRelativePath = toOwnerRelativePath(owner, requestedPath);
      const reason = catalogSkipReason({
        relativePath: ownerRelativePath,
        isDirectory: false,
        skippedRoots: input.skipped_roots,
        gitignoreRules: owner.gitignoreRules,
        hasNestedGitRepository: false
      });
      if (reason !== null) {
        recordSkippedPath({ path: requestedPath, reason, detail: catalogSkipDetail(reason) });
      } else {
        admittedPriorityPaths.push(requestedPath);
      }
    }

    const discoveredPaths = new Set<string>(admittedPriorityPaths);
    const discoveredFiles: string[] = [];

    for (const unit of scanUnits) {
      for (const indexedRoot of unit.indexedRoots) {
        const absoluteRoot = path.resolve(unit.absoluteRoot, indexedRoot);
        if (!isInsideRepo(repoRoot, absoluteRoot) || fs.existsSync(absoluteRoot) === false) {
          continue;
        }

        const rootStats = fs.statSync(absoluteRoot);
        if (rootStats.isFile()) {
          const candidatePath = toGlobalPath(unit, normalizeCatalogPath(path.relative(unit.absoluteRoot, absoluteRoot)));
          if (!discoveredPaths.has(candidatePath)) {
            const reason = catalogSkipReason({
              relativePath: normalizeCatalogPath(path.relative(unit.absoluteRoot, absoluteRoot)),
              isDirectory: false,
              skippedRoots: input.skipped_roots,
              gitignoreRules: unit.gitignoreRules,
              hasNestedGitRepository: false
            });
            if (reason !== null) {
              recordSkippedPath({
                path: candidatePath,
                reason,
                detail: catalogSkipDetail(reason)
              });
            } else {
              discoveredFiles.push(candidatePath);
              discoveredPaths.add(candidatePath);
            }
          }
          continue;
        }

        const candidates = await this.scanDirectory({
          repoRoot,
          unit,
          directory: absoluteRoot,
          skippedRoots: input.skipped_roots,
          recordSkippedRoot: (root) => skippedRoots.add(root),
          recordSkippedPath,
          admittedRepositoryRoots: unit.admittedRepositoryRoots
        });
        for (const candidatePath of candidates) {
          if (discoveredPaths.has(candidatePath)) {
            continue;
          }
          discoveredFiles.push(candidatePath);
          discoveredPaths.add(candidatePath);
        }
      }
    }

    if (input.repository_composition !== undefined) {
      discoveredFiles.sort((left, right) => left.localeCompare(right));
    }

    const { prioritizedPaths: discoveredPriorityPaths, remainingPaths } = prioritizeDiscoveredPathsByPattern(
      discoveredFiles,
      prioritizedPathPatterns
    );

    const combinedPaths = [...admittedPriorityPaths, ...discoveredPriorityPaths, ...remainingPaths];
    const normalizedAfterPathIndex = normalizedAfterPath === undefined ? -1 : combinedPaths.indexOf(normalizedAfterPath);
    if (input.after_path !== undefined && normalizedAfterPathIndex === -1) {
      throw new Error(`Catalog scan continuation cursor not found in traversal sequence: ${input.after_path}`);
    }
    const resumeIndex = normalizedAfterPath === undefined ? 0 : normalizedAfterPathIndex + 1;

    for (let index = resumeIndex; index < combinedPaths.length; index += 1) {
      if (entries.length >= input.max_files) {
        truncated = true;
        break;
      }
      const relativePath = normalizeCatalogPath(combinedPaths[index]);
      const owner = findOwningScanUnit(scanUnits, relativePath);
      const absolutePath = path.resolve(repoRoot, relativePath);
      const beforeCount = entries.length;

      await this.scanFile({
        repoRoot,
        unit: owner,
        absolutePath,
        skippedRoots: input.skipped_roots,
        recordSkippedRoot: (root) => {
          skippedRoots.add(root);
        },
        recordSkippedPath,
        maxFiles: input.max_files,
        entries,
        setTruncated: () => {
          truncated = true;
        }
      });
      if (entries.length > beforeCount) {
        continuationCursor = relativePath;
      }
    }

    if (admittedPriorityPaths.length === 0 && prioritizedPathPatterns.length === 0) {
      entries.sort((left, right) => left.path.localeCompare(right.path));
    }

    return {
      repo_root: repoRoot,
      indexed_roots: indexedRoots,
      skipped_roots: mergeSkippedRoots([...skippedRoots]),
      skipped_paths: skippedPaths,
      skipped_path_population: skippedPathPopulation.finalize(),
      files: entries,
      truncated,
      continuation_cursor: truncated ? continuationCursor : undefined
    };
  }

  private async scanDirectory(input: {
    repoRoot: string;
    unit: ScanUnit;
    directory: string;
    skippedRoots: readonly string[];
    recordSkippedRoot: (root: string) => void;
    recordSkippedPath: (skipped: FileCatalogSkippedPath) => void;
    admittedRepositoryRoots: ReadonlySet<string>;
  }): Promise<string[]> {
    const discoveredPaths: string[] = [];

    const children = readDirectoryOrSkip({
      repoRoot: input.repoRoot,
      directory: input.directory,
      recordSkippedRoot: input.recordSkippedRoot,
      recordSkippedPath: input.recordSkippedPath
    });
    if (children === null) {
      return [];
    }
    children.sort(compareCatalogEntries);

    for (const child of children) {
      const absolutePath = path.join(input.directory, child.name);
      const localRelativePath = normalizeCatalogPath(path.relative(input.unit.absoluteRoot, absolutePath));
      const relativePath = toGlobalPath(input.unit, localRelativePath);
      if (child.isDirectory() && input.admittedRepositoryRoots.has(relativePath)) {
        continue;
      }
      const skipReason = catalogSkipReason({
        relativePath: localRelativePath,
        isDirectory: child.isDirectory(),
        skippedRoots: input.skippedRoots,
        gitignoreRules: input.unit.gitignoreRules,
        hasNestedGitRepository: child.isDirectory() && isNestedGitRepository(input.repoRoot, absolutePath)
      });
      if (skipReason !== null) {
        input.recordSkippedPath({
          path: relativePath,
          reason: skipReason,
          detail: catalogSkipDetail(skipReason)
        });
        continue;
      }

      if (child.isDirectory()) {
        const nestedPaths = await this.scanDirectory({ ...input, directory: absolutePath });
        discoveredPaths.push(...nestedPaths);
        continue;
      }

      if (!child.isFile()) {
        continue;
      }

      discoveredPaths.push(relativePath);
    }

    return discoveredPaths;
  }

  private async scanFile(input: {
    repoRoot: string;
    unit: ScanUnit;
    absolutePath: string;
    skippedRoots: readonly string[];
    recordSkippedRoot: (root: string) => void;
    recordSkippedPath: (skipped: FileCatalogSkippedPath) => void;
    maxFiles: number;
    entries: FileCatalogEntry[];
    setTruncated: () => void;
  }): Promise<void> {
    if (input.entries.length >= input.maxFiles) {
      input.setTruncated();
      return;
    }

    const relativePath = normalizeCatalogPath(path.relative(input.repoRoot, input.absolutePath));
    const localRelativePath = normalizeCatalogPath(path.relative(input.unit.absoluteRoot, input.absolutePath));
    const skipReason = catalogSkipReason({
      relativePath: localRelativePath,
      isDirectory: false,
      skippedRoots: input.skippedRoots,
      gitignoreRules: input.unit.gitignoreRules,
      hasNestedGitRepository: false
    });
    if (skipReason !== null) {
      input.recordSkippedPath({
        path: relativePath,
        reason: skipReason,
        detail: catalogSkipDetail(skipReason)
      });
      return;
    }

    const stats = statFileOrSkip({
      repoRoot: input.repoRoot,
      absolutePath: input.absolutePath,
      recordSkippedRoot: input.recordSkippedRoot,
      recordSkippedPath: input.recordSkippedPath
    });
    if (stats === null) {
      return;
    }
    const language = await this.fileIdentity.inferLanguage({ path: input.absolutePath });
    input.entries.push(
      buildFileCatalogEntry({
        file_identity: {
          path: relativePath,
          language,
          content_hash: `stat:${stats.size}:${Math.trunc(stats.mtimeMs)}`,
          size_bytes: stats.size,
          mtime_ms: stats.mtimeMs
        }
      })
    );
  }
}

type ScanUnit = {
  pathPrefix: string;
  absoluteRoot: string;
  gitignoreRules: readonly GitignoreRule[];
  indexedRoots: readonly string[];
  admittedRepositoryRoots: ReadonlySet<string>;
};

function buildScanUnits(
  repoRoot: string,
  indexedRoots: readonly string[],
  repositoryComposition?: RepositoryCompositionAdmissionReceipt
): readonly ScanUnit[] {
  const admittedUnits = listAdmittedUnits(repositoryComposition);
  const admittedRoots = new Set(admittedUnits.map((unit) => unit.pathPrefix).filter((pathPrefix) => pathPrefix.length > 0));
  const units = admittedUnits.length === 0
    ? [{ pathPrefix: "", absoluteRoot: repoRoot }]
    : admittedUnits.map((unit) => ({
        pathPrefix: unit.pathPrefix,
        absoluteRoot: path.resolve(repoRoot, unit.pathPrefix)
      }));

  return units
    .map((unit) => ({
      pathPrefix: unit.pathPrefix,
      absoluteRoot: unit.absoluteRoot,
      gitignoreRules: readRootIgnoreRules(unit.absoluteRoot),
      indexedRoots: indexedRootsForUnit(unit.pathPrefix, indexedRoots, admittedRoots),
      admittedRepositoryRoots: descendantRepositoryRoots(unit.pathPrefix, admittedRoots)
    }))
    .filter((unit) => unit.indexedRoots.length > 0);
}

function listAdmittedUnits(
  repositoryComposition?: RepositoryCompositionAdmissionReceipt
): readonly { pathPrefix: string; source_available: boolean }[] {
  if (repositoryComposition === undefined) {
    return [];
  }

  const units = repositoryComposition.repositories
    .filter((unit) => isInitializedDeclaredSubmoduleUnit(unit) || normalizeCompositionPathPrefix(unit.path_prefix) === "")
    .map((unit) => ({
      pathPrefix: normalizeCompositionPathPrefix(unit.path_prefix),
      source_available: unit.source_available
    }))
    .filter((unit) => unit.pathPrefix === "" || unit.source_available)
    .sort((left, right) => left.pathPrefix.localeCompare(right.pathPrefix));

  return units.some((unit) => unit.pathPrefix === "")
    ? units
    : [{ pathPrefix: "", source_available: true }, ...units];
}

function isInitializedDeclaredSubmoduleUnit(unit: RepositoryCompositionAdmissionUnit): boolean {
  return (
    normalizeCompositionPathPrefix(unit.path_prefix).length > 0 &&
    (unit.state === "initialized" || unit.state === "worktree_revision_mismatch" || unit.state === "metadata_unavailable") &&
    unit.source_available === true &&
    typeof unit.declaration_path === "string" &&
    unit.declaration_path.length > 0 &&
    typeof unit.head_gitlink_oid === "string" &&
    unit.head_gitlink_oid.length > 0
  );
}

function normalizeCompositionPathPrefix(pathPrefix: string): string {
  const normalized = normalizeCatalogPath(pathPrefix).replace(/^\.\/+/u, "").replace(/\/+$/u, "");
  return normalized === "." ? "" : normalized;
}

function indexedRootsForUnit(
  unitPathPrefix: string,
  indexedRoots: readonly string[],
  admittedRoots: ReadonlySet<string>
): string[] {
  const requestedRoots = indexedRoots.length > 0 ? indexedRoots : ["."];
  const localRoots = new Set<string>();

  for (const requestedRoot of requestedRoots) {
    const normalizedRoot = normalizeRelativeSelector(requestedRoot);
    if (unitPathPrefix.length === 0) {
      if (normalizedRoot.length === 0) {
        localRoots.add(".");
        continue;
      }
      if (pathBelongsToNestedUnit(normalizedRoot, admittedRoots)) {
        continue;
      }
      localRoots.add(normalizedRoot);
      continue;
    }

    if (normalizedRoot.length === 0 || isPathPrefix(normalizedRoot, unitPathPrefix)) {
      localRoots.add(".");
      continue;
    }
    if (isPathPrefix(unitPathPrefix, normalizedRoot)) {
      const suffix = normalizedRoot.slice(unitPathPrefix.length).replace(/^\/+/u, "");
      localRoots.add(suffix.length === 0 ? "." : suffix);
    }
  }

  return Array.from(localRoots).sort();
}

function descendantRepositoryRoots(
  unitPathPrefix: string,
  admittedRoots: ReadonlySet<string>
): ReadonlySet<string> {
  const descendants = new Set<string>();
  for (const admittedRoot of admittedRoots) {
    if (admittedRoot.length === 0 || admittedRoot === unitPathPrefix) {
      continue;
    }
    if (unitPathPrefix.length === 0 || admittedRoot.startsWith(`${unitPathPrefix}/`)) {
      descendants.add(admittedRoot);
    }
  }
  return descendants;
}

function pathBelongsToNestedUnit(pathValue: string, admittedRoots: ReadonlySet<string>): boolean {
  for (const admittedRoot of admittedRoots) {
    if (admittedRoot.length > 0 && (pathValue === admittedRoot || pathValue.startsWith(`${admittedRoot}/`))) {
      return true;
    }
  }
  return false;
}

function findOwningScanUnit(units: readonly ScanUnit[], relativePath: string): ScanUnit {
  const normalizedPath = normalizeCatalogPath(relativePath).replace(/^\.\/+/u, "").replace(/\/+$/u, "");
  let owner = units[0];
  for (const unit of units) {
    if (
      unit.pathPrefix.length > owner.pathPrefix.length &&
      (normalizedPath === unit.pathPrefix || normalizedPath.startsWith(`${unit.pathPrefix}/`))
    ) {
      owner = unit;
    }
  }
  return owner;
}

function toOwnerRelativePath(unit: ScanUnit, relativePath: string): string {
  if (unit.pathPrefix.length === 0) {
    return normalizeCatalogPath(relativePath);
  }
  const normalized = normalizeCatalogPath(relativePath);
  if (normalized === unit.pathPrefix) {
    return ".";
  }
  return normalized.slice(unit.pathPrefix.length + 1);
}

function toGlobalPath(unit: ScanUnit, localRelativePath: string): string {
  const normalizedLocalPath = normalizeCatalogPath(localRelativePath).replace(/^\.\/+/u, "").replace(/\/+$/u, "");
  if (unit.pathPrefix.length === 0) {
    return normalizedLocalPath.length === 0 ? "." : normalizedLocalPath;
  }
  if (normalizedLocalPath.length === 0 || normalizedLocalPath === ".") {
    return unit.pathPrefix;
  }
  return `${unit.pathPrefix}/${normalizedLocalPath}`;
}

function isPathPrefix(prefix: string, candidate: string): boolean {
  return candidate === prefix || candidate.startsWith(`${prefix}/`);
}

function normalizeRelativeSelector(value: string): string {
  const normalized = normalizeCatalogPath(value).replace(/^\.\/+/u, "").replace(/\/+$/u, "");
  return normalized === "." ? "" : normalized;
}

function readDirectoryOrSkip(input: {
  repoRoot: string;
  directory: string;
  recordSkippedRoot: (root: string) => void;
  recordSkippedPath: (skipped: FileCatalogSkippedPath) => void;
}): fs.Dirent[] | null {
  try {
    return fs.readdirSync(input.directory, { withFileTypes: true });
  } catch (error) {
    if (isSkippableFilesystemError(error)) {
      const path = relativeCatalogPath(input.repoRoot, input.directory);
      input.recordSkippedRoot(path);
      input.recordSkippedPath({
        path,
        reason: filesystemSkipReason(error),
        detail: "Directory could not be read during catalog scan."
      });
      return null;
    }
    throw error;
  }
}

function statFileOrSkip(input: {
  repoRoot: string;
  absolutePath: string;
  recordSkippedRoot: (root: string) => void;
  recordSkippedPath: (skipped: FileCatalogSkippedPath) => void;
}): fs.Stats | null {
  try {
    return fs.statSync(input.absolutePath);
  } catch (error) {
    if (isSkippableFilesystemError(error)) {
      const path = relativeCatalogPath(input.repoRoot, input.absolutePath);
      input.recordSkippedRoot(path);
      input.recordSkippedPath({
        path,
        reason: filesystemSkipReason(error),
        detail: "File metadata could not be read during catalog scan."
      });
      return null;
    }
    throw error;
  }
}

function filesystemSkipReason(error: unknown): FileCatalogSkippedPath["reason"] {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return "permission_denied";
  }
  const code = String(error.code);
  if (code === "ENOENT") return "missing";
  if (code === "ENOTDIR") return "not_directory";
  return "permission_denied";
}

function skippedPathRecorder(
  skippedPaths: FileCatalogSkippedPath[],
  population: ReturnType<typeof createSkippedPathPopulationAccumulator<FileCatalogSkippedPath["reason"]>>
): (skipped: FileCatalogSkippedPath) => void {
  return (skipped) => {
    if (!population.record(skipped)) {
      return;
    }
    if (skippedPaths.length >= MAX_SKIPPED_PATHS) {
      return;
    }
    skippedPaths.push(skipped);
  };
}

function catalogSkipDetail(reason: FileCatalogSkippedPath["reason"]): string {
  switch (reason) {
    case "secret":
      return "Secret-bearing local environment file was excluded from catalog evidence.";
    case "generated_or_vendor":
      return "Generated, dependency, cache, build, or vendor path was excluded from catalog evidence.";
    case "configured_skip":
      return "Path matched caller-provided skipped roots.";
    case "hidden_path":
      return "Hidden local path is not allowlisted as repository-shape evidence.";
    case "gitignore":
      return "Path matched root ignore-file skip rules.";
    case "nested_git_repository":
      return "Nested git checkout was skipped during catalog scan.";
    case "permission_denied":
      return "Path could not be accessed during catalog scan.";
    case "missing":
      return "Path disappeared during catalog scan.";
    case "not_directory":
      return "Expected directory was not a directory during catalog scan.";
    case "workspace_escape":
      return "Path escaped the repository root.";
  }
}

function isSkippableFilesystemError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  return ["EACCES", "EPERM", "ENOENT", "ENOTDIR"].includes(String(error.code));
}

function normalizeCatalogPaths(requestedPaths: readonly string[]): string[] {
  return requestedPaths.map((value) =>
    normalizeCatalogPath(value).replace(/^\.\/+/u, "").replace(/\/+$/u, "")
  );
}

function normalizeCatalogPatterns(requestedPatterns: readonly string[]): string[] {
  return requestedPatterns
    .map((value) => normalizeCatalogPath(value).replace(/^\.\/+/u, ""))
    .filter((value) => value.length > 0);
}

function prioritizeDiscoveredPathsByPattern(
  discoveredPaths: readonly string[],
  patterns: readonly string[]
): { prioritizedPaths: string[]; remainingPaths: string[] } {
  if (patterns.length === 0) {
    return { prioritizedPaths: [], remainingPaths: [...discoveredPaths] };
  }

  const prioritized: string[] = [];
  const prioritySet = new Set<string>();
  for (const pattern of patterns) {
    for (const candidatePath of discoveredPaths) {
      if (prioritySet.has(candidatePath)) {
        continue;
      }
      if (isPathMatchedByPattern(candidatePath, pattern)) {
        prioritized.push(candidatePath);
        prioritySet.add(candidatePath);
      }
    }
  }

  const remainingPaths = discoveredPaths.filter((path) => !prioritySet.has(path));

  return { prioritizedPaths: prioritized, remainingPaths };
}

function isPathMatchedByPattern(pathValue: string, pattern: string): boolean {
  if (!pattern.includes("*") && !pattern.includes("?")) {
    if (pathValue === pattern) {
      return true;
    }
    if (pattern.endsWith("/")) {
      return pathValue.startsWith(pattern);
    }
    return pathValue.endsWith(`/${pattern}`);
  }
  return isGlobPatternMatch(pathValue, pattern);
}

function isGlobPatternMatch(pathValue: string, pattern: string): boolean {
  const pathSegments = splitPathSegments(pathValue);
  const patternSegments = splitPathSegments(pattern);
  const memo = new Map<string, boolean>();

  const matchSegment = (patternSegment: string, valueSegment: string): boolean => {
    const escaped = patternSegment
      .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
      .replace(/\\\*/gu, ".*")
      .replace(/\\\?/gu, ".");
    return new RegExp(`^${escaped}$`).test(valueSegment);
  };

  const visit = (patternIndex: number, pathIndex: number): boolean => {
    const memoKey = `${patternIndex}:${pathIndex}`;
    if (memo.has(memoKey)) {
      return memo.get(memoKey) as boolean;
    }

    let matched: boolean;
    if (patternIndex === patternSegments.length) {
      matched = pathIndex === pathSegments.length;
    } else if (patternSegments[patternIndex] === "**") {
      matched = visit(patternIndex + 1, pathIndex) || (pathIndex < pathSegments.length && visit(patternIndex, pathIndex + 1));
    } else if (pathIndex < pathSegments.length && matchSegment(patternSegments[patternIndex], pathSegments[pathIndex])) {
      matched = visit(patternIndex + 1, pathIndex + 1);
    } else {
      matched = false;
    }
    memo.set(memoKey, matched);
    return matched;
  };

  return visit(0, 0);
}

function splitPathSegments(value: string): readonly string[] {
  return value.split("/").filter((segment) => segment.length > 0);
}

function normalizeScanPath(repoRoot: string, value: string): string {
  return normalizeCatalogPath(path.relative(repoRoot, path.resolve(repoRoot, value)))
    .replace(/^\.\/+/u, "")
    .replace(/\/+$/u, "");
}

function relativeCatalogPath(repoRoot: string, absolutePath: string): string {
  const relativePath = normalizeCatalogPath(path.relative(repoRoot, absolutePath));
  return relativePath.length === 0 ? "." : relativePath;
}

function isInsideRepo(repoRoot: string, absolutePath: string): boolean {
  const relative = path.relative(repoRoot, absolutePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function compareCatalogEntries(left: fs.Dirent, right: fs.Dirent): number {
  return catalogTraversalPriority(left) - catalogTraversalPriority(right) || left.name.localeCompare(right.name);
}

function catalogTraversalPriority(entry: fs.Dirent): number {
  const name = entry.name.toLowerCase();
  if (entry.isDirectory()) {
    if (["src", "lib", "app", "cmd", "internal", "include"].includes(name)) return 0;
    if (["test", "tests", "__tests__"].includes(name)) return 5;
    if (["docs", "doc", "documentation"].includes(name)) return 60;
    if (name === ".github") return 70;
    return 30;
  }

  if (isProjectShapeFile(name)) return 0;
  if (isSourceLikeFile(name)) return 5;
  if (name.includes("test") || name.includes("spec")) return 8;
  if (name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".mdx")) return 60;
  if (name.endsWith(".json") || name.endsWith(".yaml") || name.endsWith(".yml") || name.endsWith(".toml")) return 20;
  return 30;
}

function isProjectShapeFile(name: string): boolean {
  return [
    "pyproject.toml",
    "package.json",
    "go.mod",
    "go.work",
    "makefile",
    "cmakelists.txt",
    "dockerfile"
  ].includes(name);
}

function isSourceLikeFile(name: string): boolean {
  return /\.(py|pyi|ts|tsx|js|jsx|mjs|cjs|cs|go|rs|java|c|cc|cpp|cxx|h|hh|hpp|hxx|sh)$/u.test(name);
}
