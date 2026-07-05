/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import {
  catalogSkipReason,
  normalizeCatalogPath,
  type CatalogSkipReason
} from "../../domain/policies/index.js";
import { readRootIgnoreRules } from "./ignore-file-policy.js";

export type WorkspaceEventPathDecision =
  | {
      included: true;
      absolutePath: string;
      relativePath: string;
      exists: boolean;
      isDirectory: boolean;
    }
  | {
      included: false;
      absolutePath: string;
      relativePath: string;
      reason: CatalogSkipReason | "outside_repo" | "outside_indexed_roots";
    };

export function classifyWorkspaceEventPath(input: {
  repoRoot: string;
  path: string;
  indexedRoots: readonly string[];
  skippedRoots: readonly string[];
}): WorkspaceEventPathDecision {
  const repoRoot = path.resolve(input.repoRoot);
  const absolutePath = path.resolve(repoRoot, input.path);
  const relative = path.relative(repoRoot, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return {
      included: false,
      absolutePath,
      relativePath: normalizeCatalogPath(relative),
      reason: "outside_repo"
    };
  }

  const relativePath = normalizeCatalogPath(relative.length === 0 ? "." : relative);
  const indexedRoots = input.indexedRoots.length === 0 ? ["."] : input.indexedRoots;
  if (!isUnderIndexedRoot(relativePath, indexedRoots)) {
    return {
      included: false,
      absolutePath,
      relativePath,
      reason: "outside_indexed_roots"
    };
  }

  const stats = statPath(absolutePath);
  if (stats !== null && realPathIsInsideRepo(repoRoot, absolutePath) === false) {
    return {
      included: false,
      absolutePath,
      relativePath,
      reason: "outside_repo"
    };
  }
  const reason = catalogSkipReason({
    relativePath,
    isDirectory: stats?.isDirectory() ?? false,
    skippedRoots: input.skippedRoots,
    gitignoreRules: readRootIgnoreRules(repoRoot),
    hasNestedGitRepository: stats?.isDirectory() === true && isNestedGitRepository(repoRoot, absolutePath)
  });
  if (reason !== null) {
    return {
      included: false,
      absolutePath,
      relativePath,
      reason
    };
  }

  return {
    included: true,
    absolutePath,
    relativePath,
    exists: stats !== null,
    isDirectory: stats?.isDirectory() ?? false
  };
}

function isUnderIndexedRoot(relativePath: string, indexedRoots: readonly string[]): boolean {
  return indexedRoots.some((root) => {
    const normalizedRoot = normalizeCatalogPath(root).replace(/^\/+|\/+$/g, "");
    return (
      normalizedRoot === "." ||
      relativePath === normalizedRoot ||
      relativePath.startsWith(`${normalizedRoot}/`)
    );
  });
}

function statPath(absolutePath: string): fs.Stats | null {
  try {
    return fs.statSync(absolutePath);
  } catch (_error) {
    return null;
  }
}

function realPathIsInsideRepo(repoRoot: string, absolutePath: string): boolean {
  try {
    const realRepoRoot = fs.realpathSync.native(repoRoot);
    const realPath = fs.realpathSync.native(absolutePath);
    const relative = path.relative(realRepoRoot, realPath);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  } catch (_error) {
    return false;
  }
}

function isNestedGitRepository(repoRoot: string, absolutePath: string): boolean {
  if (path.resolve(repoRoot) === path.resolve(absolutePath)) {
    return false;
  }
  return fs.existsSync(path.join(absolutePath, ".git"));
}
