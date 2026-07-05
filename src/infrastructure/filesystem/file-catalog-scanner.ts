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
  mergeSkippedRoots,
  normalizeCatalogPath,
  parseGitignoreRules,
  type GitignoreRule
} from "../../domain/policies/index.js";
import type {
  FileCatalogScanPort,
  FileCatalogScanResult,
  FileCatalogSkippedPath,
  FileIdentityPort
} from "../../ports/index.js";
import { FileIdentityAdapter } from "./file-identity.js";

const MAX_SKIPPED_PATHS = 100;

function isInsideRoot(relativePath: string, root: string): boolean {
  const normalizedRoot = normalizeCatalogPath(root).replace(/^\/+|\/+$/g, "");
  return normalizedRoot === "." || relativePath === normalizedRoot || relativePath.startsWith(`${normalizedRoot}/`);
}

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
  }): Promise<FileCatalogScanResult> {
    const repoRoot = path.resolve(input.repo_root);
    const indexedRoots = input.indexed_roots.length > 0 ? input.indexed_roots : ["."];
    const entries: FileCatalogEntry[] = [];
    const skippedPaths: FileCatalogSkippedPath[] = [];
    const skippedRoots = new Set(input.skipped_roots);
    const gitignoreRules = readRootIgnoreRules(repoRoot);
    let truncated = false;

    for (const indexedRoot of indexedRoots) {
      if (truncated) {
        break;
      }
      const absoluteRoot = path.resolve(repoRoot, indexedRoot);
      if (!isInsideRepo(repoRoot, absoluteRoot) || fs.existsSync(absoluteRoot) === false) {
        continue;
      }

      await this.scanDirectory({
        repoRoot,
        directory: absoluteRoot,
        indexedRoots,
        skippedRoots: input.skipped_roots,
        gitignoreRules,
        recordSkippedRoot: (root) => {
          skippedRoots.add(root);
        },
        recordSkippedPath: skippedPathRecorder(skippedPaths),
        maxFiles: input.max_files,
        entries,
        setTruncated: () => {
          truncated = true;
        }
      });
    }

    entries.sort((left, right) => left.path.localeCompare(right.path));

    return {
      repo_root: repoRoot,
      indexed_roots: indexedRoots,
      skipped_roots: mergeSkippedRoots([...skippedRoots]),
      skipped_paths: skippedPaths,
      files: entries,
      truncated
    };
  }

  private async scanDirectory(input: {
    repoRoot: string;
    directory: string;
    indexedRoots: readonly string[];
    skippedRoots: readonly string[];
    gitignoreRules: readonly GitignoreRule[];
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

    const children = readDirectoryOrSkip({
      repoRoot: input.repoRoot,
      directory: input.directory,
      recordSkippedRoot: input.recordSkippedRoot,
      recordSkippedPath: input.recordSkippedPath
    });
    if (children === null) {
      return;
    }
    children.sort(compareCatalogEntries);

    for (const child of children) {
      if (input.entries.length >= input.maxFiles) {
        input.setTruncated();
        return;
      }

      const absolutePath = path.join(input.directory, child.name);
      const relativePath = normalizeCatalogPath(path.relative(input.repoRoot, absolutePath));
      const skipReason = catalogSkipReason({
        relativePath,
        isDirectory: child.isDirectory(),
        skippedRoots: input.skippedRoots,
        gitignoreRules: input.gitignoreRules,
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
        await this.scanDirectory({ ...input, directory: absolutePath });
        continue;
      }

      if (!child.isFile()) {
        continue;
      }

      const stats = statFileOrSkip({
        repoRoot: input.repoRoot,
        absolutePath,
        recordSkippedRoot: input.recordSkippedRoot,
        recordSkippedPath: input.recordSkippedPath
      });
      if (stats === null) {
        continue;
      }
      const language = await this.fileIdentity.inferLanguage({ path: absolutePath });
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

function skippedPathRecorder(skippedPaths: FileCatalogSkippedPath[]): (skipped: FileCatalogSkippedPath) => void {
  const seen = new Set<string>();
  return (skipped) => {
    if (skipped.path.length === 0 || skipped.path === ".") {
      return;
    }
    const key = `${skipped.reason}:${skipped.path}`;
    if (seen.has(key) || skippedPaths.length >= MAX_SKIPPED_PATHS) {
      return;
    }
    seen.add(key);
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

function relativeCatalogPath(repoRoot: string, absolutePath: string): string {
  const relativePath = normalizeCatalogPath(path.relative(repoRoot, absolutePath));
  return relativePath.length === 0 ? "." : relativePath;
}

function isInsideRepo(repoRoot: string, absolutePath: string): boolean {
  const relative = path.relative(repoRoot, absolutePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isNestedGitRepository(repoRoot: string, absolutePath: string): boolean {
  if (path.resolve(repoRoot) === path.resolve(absolutePath)) {
    return false;
  }
  return fs.existsSync(path.join(absolutePath, ".git"));
}

function compareCatalogEntries(left: fs.Dirent, right: fs.Dirent): number {
  return catalogTraversalPriority(left) - catalogTraversalPriority(right) || left.name.localeCompare(right.name);
}

function readRootIgnoreRules(repoRoot: string): GitignoreRule[] {
  return [".gitignore", ".aiignore"].flatMap((ignoreFileName) => readRootIgnoreFileRules(repoRoot, ignoreFileName));
}

function readRootIgnoreFileRules(repoRoot: string, ignoreFileName: string): GitignoreRule[] {
  const ignoreFilePath = path.join(repoRoot, ignoreFileName);
  if (!fs.existsSync(ignoreFilePath)) return [];
  try {
    return parseGitignoreRules(fs.readFileSync(ignoreFilePath, "utf8"));
  } catch (_error) {
    return [];
  }
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
