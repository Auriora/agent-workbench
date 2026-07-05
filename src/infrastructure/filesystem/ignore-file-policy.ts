/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import {
  parseRootIgnoreFileRules,
  ROOT_IGNORE_FILE_NAMES,
  type GitignoreRule,
  type RootIgnoreFileContent
} from "../../domain/policies/index.js";

export function readRootIgnoreRules(repoRoot: string): GitignoreRule[] {
  const ignoreFiles: RootIgnoreFileContent[] = [];
  for (const ignoreFileName of ROOT_IGNORE_FILE_NAMES) {
    const content = readRootIgnoreFile(repoRoot, ignoreFileName);
    if (content !== null) {
      ignoreFiles.push({ name: ignoreFileName, content });
    }
  }
  return parseRootIgnoreFileRules(ignoreFiles);
}

function readRootIgnoreFile(repoRoot: string, ignoreFileName: string): string | null {
  const ignoreFilePath = path.join(repoRoot, ignoreFileName);
  if (!fs.existsSync(ignoreFilePath)) {
    return null;
  }
  try {
    return fs.readFileSync(ignoreFilePath, "utf8");
  } catch (_error) {
    return null;
  }
}
