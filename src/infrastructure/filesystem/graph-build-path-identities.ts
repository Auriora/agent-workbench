/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import type { GraphBuildPathIdentity } from "../../ports/index.js";

const MISSING_IDENTITY = {
  device: "0",
  inode: "0",
  size_bytes: "0",
  mtime_ns: "0",
  ctime_ns: "0"
} as const;
const MAX_GIT_METADATA_BYTES = 4096;

/**
 * Reads only metadata for one contained workspace path. This deliberately does
 * not enumerate directories: callers use it around their one canonical walk.
 */
export function readGraphBuildPathIdentity(
  repoRoot: string,
  relativePath: string,
  options: { allow_missing?: boolean } = {}
): GraphBuildPathIdentity {
  const canonicalRoot = canonicalDirectory(repoRoot);
  const normalizedPath = normalizeRelativePath(relativePath);
  const candidate = path.resolve(canonicalRoot, normalizedPath);
  if (!isContained(canonicalRoot, candidate)) {
    throw new Error(`Graph build identity path escapes repository root: ${relativePath}`);
  }

  try {
    const canonicalPath = fs.realpathSync(candidate);
    if (!isContained(canonicalRoot, canonicalPath)) {
      throw new Error(`Graph build identity path escapes repository root after symlink resolution: ${relativePath}`);
    }
    return identityFromStat(normalizedPath, fs.statSync(canonicalPath, { bigint: true }));
  } catch (error) {
    if (isMissing(error) && options.allow_missing === true) {
      return missingIdentity(normalizedPath);
    }
    throw error;
  }
}

/** Re-read a recorded identity in its explicitly authorized root. */
export function readCapturedGraphBuildPathIdentity(
  repoRoot: string,
  expected: GraphBuildPathIdentity
): GraphBuildPathIdentity {
  if (expected.scope === "git") {
    if (expected.root === undefined || expected.root.length === 0) {
      throw new Error("Captured Git identity is missing its authorized metadata root.");
    }
    return readGitMetadataIdentity(expected.root, expected.path, expected.kind === "missing");
  }
  if (expected.scope !== undefined || expected.root !== undefined) {
    throw new Error("Only explicitly scoped Git metadata may use a separate identity root.");
  }
  return readGraphBuildPathIdentity(repoRoot, expected.path, { allow_missing: expected.kind === "missing" });
}

/**
 * Captures policy and Git metadata inputs without walking a Git directory.
 * Paths rooted in external Git storage are represented with `scope: "git"`.
 */
export function captureGraphBuildRepositoryInputs(
  repoRoot: string,
  repositoryPrefix = ""
): readonly GraphBuildPathIdentity[] {
  const canonicalRepoRoot = canonicalDirectory(repoRoot);
  const prefix = normalizePrefix(repositoryPrefix);
  const workspace = (name: string): GraphBuildPathIdentity =>
    readGraphBuildPathIdentity(canonicalRepoRoot, joinPrefix(prefix, name), { allow_missing: true });
  const identities: GraphBuildPathIdentity[] = [
    workspace(".gitignore"),
    workspace(".aiignore"),
    workspace(".gitmodules"),
    workspace(".git")
  ];
  const gitMarker = identities[3];
  if (gitMarker.kind === "missing") return identities;

  const worktreeRoot = path.resolve(canonicalRepoRoot, prefix || ".");
  let gitRoot: string;
  try {
    const resolved = resolveGitMetadataRoot(worktreeRoot, gitMarker);
    if (resolved === null) throw new Error("Git marker has an unsupported file kind.");
    gitRoot = resolved;
  } catch (error) {
    throw new Error(`Graph build Git metadata is unavailable for ${joinPrefix(prefix, ".git")}`, { cause: error });
  }

  const addGit = (relative: string, allowMissing = true): GraphBuildPathIdentity => {
    const identity = readGitMetadataIdentity(gitRoot, relative, allowMissing);
    identities.push(identity);
    return identity;
  };
  const head = addGit("HEAD");
  addGit("index");
  addGit("config");
  addGit("packed-refs");
  const commonDir = addGit("commondir");

  let metadataRoot = gitRoot;
  if (commonDir.kind === "file") {
    const declared = readBoundedText(path.join(gitRoot, "commondir"));
    const candidate = declared === undefined ? null : resolveContainedMetadataRoot(gitRoot, declared);
    if (candidate === null) {
      throw new Error(`Graph build Git metadata is unavailable for ${joinPrefix(prefix, ".git/commondir")}`);
    }
    metadataRoot = candidate;
    // The linked common directory is itself a durable input.
    identities.push(readGitMetadataIdentity(metadataRoot, ".", false));
    for (const name of ["config", "packed-refs", "refs"]) {
      identities.push(readGitMetadataIdentity(metadataRoot, name, true));
    }
  }

  if (head.kind === "file") {
    const headText = readBoundedText(path.join(gitRoot, "HEAD"));
    const ref = symbolicHeadReference(headText);
    if (ref !== null) {
      for (const ancestor of gitReferenceAncestors(ref)) {
        identities.push(readGitMetadataIdentity(metadataRoot, ancestor, true));
      }
      identities.push(readGitMetadataIdentity(metadataRoot, ref, true));
    }
  }
  return deduplicateIdentities(identities);
}

function resolveGitMetadataRoot(worktreeRoot: string, marker: GraphBuildPathIdentity): string | null {
  const markerPath = path.resolve(worktreeRoot, ".git");
  if (marker.kind === "directory") return canonicalDirectory(markerPath);
  if (marker.kind !== "file") return null;
  const declared = readBoundedText(markerPath);
  if (declared === undefined) throw new Error("Git marker file could not be read during identity capture.");
  const match = /^gitdir:\s*(.+)\s*$/mu.exec(declared);
  if (match === null) throw new Error("Git marker file did not declare a Git metadata directory.");
  const candidate = path.resolve(worktreeRoot, match[1]);
  return canonicalDirectory(candidate);
}

function resolveContainedMetadataRoot(baseRoot: string, declared: string): string | null {
  if (declared.length === 0 || declared.includes("\0")) return null;
  const candidate = path.resolve(baseRoot, declared.trim());
  try {
    return canonicalDirectory(candidate);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

function readGitMetadataIdentity(root: string, relativePath: string, allowMissing: boolean): GraphBuildPathIdentity {
  const canonicalRoot = canonicalDirectory(root);
  const normalizedPath = normalizeRelativePath(relativePath);
  const candidate = path.resolve(canonicalRoot, normalizedPath);
  if (!isContained(canonicalRoot, candidate)) {
    throw new Error(`Git metadata identity escapes its authorized root: ${relativePath}`);
  }
  try {
    const canonicalPath = fs.realpathSync(candidate);
    if (!isContained(canonicalRoot, canonicalPath)) {
      throw new Error(`Git metadata identity escapes its authorized root after symlink resolution: ${relativePath}`);
    }
    return { ...identityFromStat(normalizedPath, fs.statSync(canonicalPath, { bigint: true })), scope: "git", root: canonicalRoot };
  } catch (error) {
    if (isMissing(error) && allowMissing) {
      return { ...missingIdentity(normalizedPath), scope: "git", root: canonicalRoot };
    }
    throw error;
  }
}

function identityFromStat(relativePath: string, stats: fs.BigIntStats): GraphBuildPathIdentity {
  let kind: GraphBuildPathIdentity["kind"];
  if (stats.isFile()) kind = "file";
  else if (stats.isDirectory()) kind = "directory";
  else throw new Error(`Graph build identity path is neither file nor directory: ${relativePath}`);
  return {
    path: relativePath,
    kind,
    device: stats.dev.toString(),
    inode: stats.ino.toString(),
    size_bytes: stats.size.toString(),
    mtime_ns: stats.mtimeNs.toString(),
    ctime_ns: stats.ctimeNs.toString()
  };
}

function missingIdentity(relativePath: string): GraphBuildPathIdentity {
  return { path: relativePath, kind: "missing", ...MISSING_IDENTITY };
}

function canonicalDirectory(value: string): string {
  const canonical = fs.realpathSync(path.resolve(value));
  if (!fs.statSync(canonical, { bigint: true }).isDirectory()) {
    throw new Error(`Expected directory for graph build identity: ${value}`);
  }
  return canonical;
}

function normalizeRelativePath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/\/+$/, "") || ".";
  if (path.posix.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`Graph build identity path must be repository-relative: ${value}`);
  }
  return normalized;
}

function normalizePrefix(value: string): string {
  const normalized = normalizeRelativePath(value);
  return normalized === "." ? "" : normalized;
}

function joinPrefix(prefix: string, value: string): string {
  return prefix.length === 0 ? value : `${prefix}/${value}`;
}

function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && ["ENOENT", "ENOTDIR"].includes(String(error.code));
}

function readBoundedText(filePath: string): string | undefined {
  try {
    const handle = fs.openSync(filePath, "r");
    try {
      const buffer = Buffer.alloc(MAX_GIT_METADATA_BYTES);
      const bytes = fs.readSync(handle, buffer, 0, buffer.length, 0);
      return buffer.subarray(0, bytes).toString("utf8");
    } finally {
      fs.closeSync(handle);
    }
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

function symbolicHeadReference(value: string | undefined): string | null {
  if (value === undefined) return null;
  const match = /^ref:\s*(refs\/[A-Za-z0-9._/-]+)\s*$/mu.exec(value);
  if (match === null || match[1].includes("//") || match[1].includes("..")) return null;
  return match[1];
}

function gitReferenceAncestors(reference: string): readonly string[] {
  const segments = reference.split("/");
  const ancestors: string[] = [];
  for (let index = 1; index < segments.length; index += 1) ancestors.push(segments.slice(0, index).join("/"));
  return ancestors;
}

function deduplicateIdentities(identities: readonly GraphBuildPathIdentity[]): readonly GraphBuildPathIdentity[] {
  const unique = new Map<string, GraphBuildPathIdentity>();
  for (const identity of identities) {
    unique.set(`${identity.scope ?? "workspace"}\0${identity.root ?? ""}\0${identity.path}`, identity);
  }
  return [...unique.values()];
}
