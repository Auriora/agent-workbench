/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";

export function isNestedGitRepository(repoRoot: string, absolutePath: string): boolean {
  if (path.resolve(repoRoot) === path.resolve(absolutePath)) {
    return false;
  }

  const gitMetadataPath = path.join(absolutePath, ".git");
  const marker = statPathOrNull(gitMetadataPath);
  if (marker === null) {
    return false;
  }

  if (marker.isDirectory()) {
    return hasHeadEvidence(gitMetadataPath);
  }

  if (marker.isFile()) {
    return hasValidGitdirFile(absolutePath, gitMetadataPath);
  }

  return false;
}

function hasValidGitdirFile(repoRoot: string, gitMetadataPath: string): boolean {
  const gitdir = readGitdirPointer(gitMetadataPath);
  if (gitdir === null) {
    return false;
  }

  return hasHeadEvidence(path.resolve(repoRoot, gitdir));
}

function readGitdirPointer(gitMetadataPath: string): string | null {
  try {
    const contents = fs.readFileSync(gitMetadataPath, "utf8");
    const match = /^\s*gitdir:\s*(.+?)\s*$/u.exec(contents);
    if (match === null) {
      return null;
    }
    const gitdir = match[1].trim();
    return gitdir.length > 0 ? gitdir : null;
  } catch {
    return null;
  }
}

function hasHeadEvidence(gitDirectory: string): boolean {
  const headPath = path.join(gitDirectory, "HEAD");
  const stats = statPathOrNull(headPath);
  return stats?.isFile() === true;
}

function statPathOrNull(absolutePath: string): fs.Stats | null {
  try {
    return fs.statSync(absolutePath);
  } catch {
    return null;
  }
}
