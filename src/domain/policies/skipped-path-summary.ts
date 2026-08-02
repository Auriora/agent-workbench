/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const SKIPPED_PATH_SAMPLE_LIMIT = 3;

export type SkippedPathPopulationGroup<Reason extends string = string> = {
  reason: Reason;
  count: number;
  sample_paths: readonly string[];
  sample_truncated: boolean;
};

export type SkippedPathPopulation<Reason extends string = string> = {
  total_count: number;
  groups: readonly SkippedPathPopulationGroup<Reason>[];
};

export function createSkippedPathPopulationAccumulator<Reason extends string>() {
  const observed = new Set<string>();
  const groups = new Map<Reason, { count: number; sample_paths: string[] }>();

  return {
    record(input: { path: string; reason: Reason }): boolean {
      const normalizedPath = normalizeSkippedPath(input.path);
      if (normalizedPath.length === 0 || normalizedPath === ".") {
        return false;
      }
      const key = `${input.reason}:${normalizedPath}`;
      if (observed.has(key)) {
        return false;
      }
      observed.add(key);
      const current = groups.get(input.reason) ?? { count: 0, sample_paths: [] };
      current.count += 1;
      current.sample_paths = [...current.sample_paths, normalizedPath]
        .sort((left, right) => left.localeCompare(right))
        .slice(0, SKIPPED_PATH_SAMPLE_LIMIT);
      groups.set(input.reason, current);
      return true;
    },

    finalize(): SkippedPathPopulation<Reason> {
      const finalizedGroups = [...groups.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([reason, group]) => ({
          reason,
          count: group.count,
          sample_paths: [...group.sample_paths],
          sample_truncated: group.count > group.sample_paths.length
        }));
      const totalCount = finalizedGroups.reduce((sum, group) => sum + group.count, 0);
      if (totalCount !== observed.size) {
        throw new Error("Skipped-path population conservation failed.");
      }
      return { total_count: totalCount, groups: finalizedGroups };
    }
  };
}

function normalizeSkippedPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/u, "").replace(/\/+$/u, "");
}
