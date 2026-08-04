/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { EvidenceRepositoryReference } from "../../contracts/index.js";
import type { SnapshotRepositoryComposition } from "../../domain/models/runtime.js";

export function repositoryReferenceForPath(
  composition: SnapshotRepositoryComposition | undefined,
  filePath: string
): EvidenceRepositoryReference | undefined {
  if (composition === undefined) return undefined;
  const normalizedPath = normalizePath(filePath);
  const unit = [...composition.repositories, ...composition.skipped_or_blocked]
    .filter((candidate) => containsPath(candidate.path_prefix, normalizedPath))
    .sort((left, right) => depth(right.path_prefix) - depth(left.path_prefix) ||
      left.repository_key.localeCompare(right.repository_key))[0];
  if (unit === undefined || unit.repository_key === "superproject") return undefined;
  return {
    repository_key: unit.repository_key,
    path_prefix: unit.path_prefix,
    state: unit.state
  };
}

function containsPath(prefix: string, filePath: string): boolean {
  const normalizedPrefix = normalizePath(prefix);
  return normalizedPrefix === "." || filePath === normalizedPrefix || filePath.startsWith(`${normalizedPrefix}/`);
}

function normalizePath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//u, "").replace(/\/$/u, "");
  return normalized.length === 0 ? "." : normalized;
}

function depth(prefix: string): number {
  return normalizePath(prefix) === "." ? 0 : normalizePath(prefix).split("/").length;
}
