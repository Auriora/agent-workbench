/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ProjectUnitKind, ProjectUnitMarker } from "../../contracts/index.js";
import { normalizeRepoPath } from "./validation-utils.js";

const DEFAULT_MAX_SELECTED_SCOPE_PATHS = 50;
const DEFAULT_MAX_PROJECT_UNITS = 20;

export type ProjectUnitCandidate = {
  root: string;
  kind: ProjectUnitKind;
  markers: readonly ProjectUnitMarker[];
};

export type ProjectUnitAggregatorRelation = {
  aggregator_root: string;
  unit_root: string;
};

export type ProjectUnitSelection =
  | "containing"
  | "intersects_subtree"
  | "explicit_aggregator"
  | "broad_request_coherent_root";

export type ProjectUnitDiscoveryLimitation =
  | {
      kind: "invalid_scope_path";
      path: string;
      message: string;
    }
  | {
      kind: "selected_scope_path_cap_exceeded";
      limit: number;
      omitted_count: number;
      message: string;
    }
  | {
      kind: "project_unit_cap_exceeded";
      limit: number;
      omitted_count: number;
      message: string;
    }
  | {
      kind: "broad_request_collection";
      unit_count: number;
      message: string;
    };

export type DiscoveredProjectUnit = {
  root: string;
  kind: ProjectUnitKind;
  markers: readonly ProjectUnitMarker[];
  selection: ProjectUnitSelection;
};

export type ProjectUnitDiscoveryResult = {
  units: DiscoveredProjectUnit[];
  limitations: ProjectUnitDiscoveryLimitation[];
};

export function discoverProjectUnits(input: {
  candidates: readonly ProjectUnitCandidate[];
  selected_paths?: readonly string[];
  selected_subtrees?: readonly string[];
  explicit_aggregators?: readonly ProjectUnitAggregatorRelation[];
  max_selected_scope_paths?: number;
  max_units?: number;
}): ProjectUnitDiscoveryResult {
  const maxSelectedScopePaths = input.max_selected_scope_paths ?? DEFAULT_MAX_SELECTED_SCOPE_PATHS;
  const maxUnits = input.max_units ?? DEFAULT_MAX_PROJECT_UNITS;
  const limitations: ProjectUnitDiscoveryLimitation[] = [];
  const candidates = normalizeCandidates(input.candidates);
  const candidatesByRoot = new Map(candidates.map((candidate) => [candidate.root, candidate]));
  const aggregators = normalizeAggregatorRelations(input.explicit_aggregators ?? [], candidatesByRoot);
  const selectedPaths = normalizeScopePaths(input.selected_paths ?? [], maxSelectedScopePaths, limitations);
  const selectedSubtrees = normalizeScopePaths(
    input.selected_subtrees ?? [],
    maxSelectedScopePaths,
    limitations
  );

  const hasExplicitSelection = selectedPaths.length > 0 || selectedSubtrees.length > 0;
  const discoveredByRoot = new Map<string, DiscoveredProjectUnit>();

  if (!hasExplicitSelection) {
    const coherentRoot = findCoherentBroadRoot(candidates, aggregators);
    if (coherentRoot !== undefined) {
      const candidate = candidatesByRoot.get(coherentRoot);
      if (candidate !== undefined) {
        discoveredByRoot.set(coherentRoot, toDiscoveredUnit(candidate, "broad_request_coherent_root"));
      }
    } else {
      for (const candidate of candidates) {
        discoveredByRoot.set(candidate.root, toDiscoveredUnit(candidate, "intersects_subtree"));
      }
      if (candidates.length > 1) {
        limitations.push({
          kind: "broad_request_collection",
          unit_count: candidates.length,
          message:
            "No coherent root project unit was evidenced for the broad request; returning bounded per-unit evidence without merging unrelated units."
        });
      }
    }
  }

  for (const selectedPath of selectedPaths) {
    const nearestRoots = nearestContainingRoots(selectedPath, candidates);
    for (const root of nearestRoots) {
      const candidate = candidatesByRoot.get(root);
      if (candidate !== undefined) {
        mergeUnit(discoveredByRoot, toDiscoveredUnit(candidate, "containing"));
      }
    }
  }

  for (const selectedSubtree of selectedSubtrees) {
    for (const candidate of intersectingSubtreeCandidates(selectedSubtree, candidates)) {
      mergeUnit(discoveredByRoot, toDiscoveredUnit(candidate, "intersects_subtree"));
    }
  }

  for (const root of [...discoveredByRoot.keys()]) {
    for (const aggregatorRoot of aggregatorRootsForUnit(root, aggregators)) {
      const candidate = candidatesByRoot.get(aggregatorRoot);
      if (candidate !== undefined) {
        mergeUnit(discoveredByRoot, toDiscoveredUnit(candidate, "explicit_aggregator"));
      }
    }
  }

  const units = [...discoveredByRoot.values()].sort(compareDiscoveredUnits);
  if (units.length <= maxUnits) {
    return {
      units,
      limitations
    };
  }

  return {
    units: units.slice(0, maxUnits),
    limitations: [
      ...limitations,
      {
        kind: "project_unit_cap_exceeded",
        limit: maxUnits,
        omitted_count: units.length - maxUnits,
        message: `Project-unit discovery was capped at ${maxUnits} units.`
      }
    ]
  };
}

function normalizeCandidates(candidates: readonly ProjectUnitCandidate[]): ProjectUnitCandidate[] {
  const byRoot = new Map<string, ProjectUnitCandidate>();
  for (const candidate of candidates) {
    const root = normalizeSafeRepoPath(candidate.root);
    if (root === undefined) {
      continue;
    }
    if (candidate.markers.length === 0) {
      continue;
    }
    byRoot.set(root, {
      ...candidate,
      root,
      markers: [...candidate.markers].sort(compareMarkers)
    });
  }
  return [...byRoot.values()].sort(compareCandidates);
}

function normalizeAggregatorRelations(
  relations: readonly ProjectUnitAggregatorRelation[],
  candidatesByRoot: ReadonlyMap<string, ProjectUnitCandidate>
): Map<string, Set<string>> {
  const byUnitRoot = new Map<string, Set<string>>();
  for (const relation of relations) {
    const aggregatorRoot = normalizeSafeRepoPath(relation.aggregator_root);
    const unitRoot = normalizeSafeRepoPath(relation.unit_root);
    if (aggregatorRoot === undefined || unitRoot === undefined || aggregatorRoot === unitRoot) {
      continue;
    }
    if (!candidatesByRoot.has(aggregatorRoot) || !candidatesByRoot.has(unitRoot)) {
      continue;
    }
    if (!containsPath(aggregatorRoot, unitRoot)) {
      continue;
    }
    const aggregators = byUnitRoot.get(unitRoot) ?? new Set<string>();
    aggregators.add(aggregatorRoot);
    byUnitRoot.set(unitRoot, aggregators);
  }
  return byUnitRoot;
}

function normalizeScopePaths(
  values: readonly string[],
  limit: number,
  limitations: ProjectUnitDiscoveryLimitation[]
): string[] {
  const accepted = new Set<string>();
  for (const value of values) {
    const normalized = normalizeSafeRepoPath(value);
    if (normalized === undefined) {
      limitations.push({
        kind: "invalid_scope_path",
        path: value,
        message: "Scope paths must be normalized repo-relative paths."
      });
      continue;
    }
    accepted.add(normalized);
  }
  const sorted = [...accepted].sort();
  if (sorted.length <= limit) {
    return sorted;
  }
  limitations.push({
    kind: "selected_scope_path_cap_exceeded",
    limit,
    omitted_count: sorted.length - limit,
    message: `Selected scope was capped at ${limit} normalized paths.`
  });
  return sorted.slice(0, limit);
}

function normalizeSafeRepoPath(value: string): string | undefined {
  const normalized = normalizeRepoPath(value);
  if (normalized === ".") {
    return normalized;
  }
  if (normalized.length === 0 || normalized.endsWith("/") || normalized.startsWith("/") || normalized.includes("\0")) {
    return undefined;
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    return undefined;
  }
  return normalized;
}

function nearestContainingRoots(
  selectedPath: string,
  candidates: readonly ProjectUnitCandidate[]
): string[] {
  let deepestDepth = -1;
  const nearest: string[] = [];
  for (const candidate of candidates) {
    if (!containsPath(candidate.root, selectedPath)) {
      continue;
    }
    const depth = pathDepth(candidate.root);
    if (depth > deepestDepth) {
      deepestDepth = depth;
      nearest.length = 0;
      nearest.push(candidate.root);
      continue;
    }
    if (depth === deepestDepth) {
      nearest.push(candidate.root);
    }
  }
  return nearest.sort(compareRoots);
}

function intersectingSubtreeCandidates(
  selectedSubtree: string,
  candidates: readonly ProjectUnitCandidate[]
): ProjectUnitCandidate[] {
  return candidates.filter((candidate) =>
    containsPath(candidate.root, selectedSubtree) || containsPath(selectedSubtree, candidate.root)
  );
}

function findCoherentBroadRoot(
  candidates: readonly ProjectUnitCandidate[],
  aggregators: ReadonlyMap<string, ReadonlySet<string>>
): string | undefined {
  for (const candidate of [...candidates].sort(compareCandidates)) {
    const otherRoots = candidates
      .map((entry) => entry.root)
      .filter((root) => root !== candidate.root);
    if (otherRoots.length === 0) {
      return candidate.root;
    }
    if (
      otherRoots.every((root) =>
        containsPath(candidate.root, root) && isExplicitAggregatorFor(candidate.root, root, aggregators)
      )
    ) {
      return candidate.root;
    }
  }
  return undefined;
}

function aggregatorRootsForUnit(
  root: string,
  aggregators: ReadonlyMap<string, ReadonlySet<string>>
): string[] {
  const discovered = new Set<string>();
  const queue = [...(aggregators.get(root) ?? [])].sort(compareRoots);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || discovered.has(current)) {
      continue;
    }
    discovered.add(current);
    const next = [...(aggregators.get(current) ?? [])].sort(compareRoots);
    for (const value of next) {
      if (!discovered.has(value)) {
        queue.push(value);
      }
    }
  }
  return [...discovered].sort(compareRoots);
}

function isExplicitAggregatorFor(
  aggregatorRoot: string,
  unitRoot: string,
  aggregators: ReadonlyMap<string, ReadonlySet<string>>
): boolean {
  return aggregatorRootsForUnit(unitRoot, aggregators).includes(aggregatorRoot);
}

function toDiscoveredUnit(
  candidate: ProjectUnitCandidate,
  selection: ProjectUnitSelection
): DiscoveredProjectUnit {
  return {
    root: candidate.root,
    kind: candidate.kind,
    markers: candidate.markers,
    selection
  };
}

function mergeUnit(
  discoveredByRoot: Map<string, DiscoveredProjectUnit>,
  candidate: DiscoveredProjectUnit
): void {
  const current = discoveredByRoot.get(candidate.root);
  if (current === undefined || selectionRank(candidate.selection) > selectionRank(current.selection)) {
    discoveredByRoot.set(candidate.root, candidate);
  }
}

function selectionRank(selection: ProjectUnitSelection): number {
  switch (selection) {
    case "containing":
      return 4;
    case "explicit_aggregator":
      return 3;
    case "intersects_subtree":
      return 2;
    case "broad_request_coherent_root":
      return 1;
  }
}

function compareDiscoveredUnits(left: DiscoveredProjectUnit, right: DiscoveredProjectUnit): number {
  return (
    compareRoots(left.root, right.root) ||
    selectionRank(right.selection) - selectionRank(left.selection) ||
    left.kind.localeCompare(right.kind)
  );
}

function compareCandidates(left: ProjectUnitCandidate, right: ProjectUnitCandidate): number {
  return compareRoots(left.root, right.root) || left.kind.localeCompare(right.kind);
}

function compareRoots(left: string, right: string): number {
  return pathDepth(left) - pathDepth(right) || left.localeCompare(right);
}

function compareMarkers(left: ProjectUnitMarker, right: ProjectUnitMarker): number {
  return left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind);
}

function containsPath(root: string, targetPath: string): boolean {
  if (root === ".") {
    return targetPath === "." || !targetPath.startsWith("../") && !targetPath.startsWith("/");
  }
  return root === targetPath || targetPath.startsWith(`${root}/`);
}

function pathDepth(value: string): number {
  if (value === ".") {
    return 0;
  }
  return value.split("/").length;
}
