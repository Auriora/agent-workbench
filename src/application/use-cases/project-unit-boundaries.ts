/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ProjectUnitBlocker, ProjectUnitBoundaryState } from "../../contracts/index.js";
import type { FileCatalogSkippedPath, WorkspaceFilePort } from "../../ports/index.js";
import { normalizeRepoPath, uniqueSorted } from "./validation-utils.js";

const MAX_GITMODULES_BYTES = 32_000;
const MAX_BOUNDARIES = 20;

export type RepositoryBoundaryEvidence = {
  path: string;
  boundary: Exclude<ProjectUnitBoundaryState, "same_repository">;
  availability: "uninitialized" | "initialized" | "incomplete";
  evidence_paths: string[];
  blocker: ProjectUnitBlocker;
};

export type RepositoryBoundaryDiscovery = {
  boundaries: RepositoryBoundaryEvidence[];
  limitations: Array<{ kind: "gitmodules_unreadable" | "gitmodules_oversized" | "gitmodules_malformed" | "boundary_cap_exceeded"; message: string }>;
};

export async function discoverRepositoryBoundaries(input: {
  workspace: WorkspaceFilePort;
  skipped_paths?: readonly FileCatalogSkippedPath[];
  max_boundaries?: number;
}): Promise<RepositoryBoundaryDiscovery> {
  const limit = input.max_boundaries ?? MAX_BOUNDARIES;
  const limitations: RepositoryBoundaryDiscovery["limitations"] = [];
  const declared = new Set<string>();
  try {
    const stat = await input.workspace.stat({ path: ".gitmodules" });
    if (stat.exists && stat.is_file) {
      if (stat.size_bytes > MAX_GITMODULES_BYTES) {
        limitations.push({ kind: "gitmodules_oversized", message: ".gitmodules exceeded the bounded read limit." });
      } else {
        const content = input.workspace.readTextPrefix === undefined
          ? await input.workspace.readText({ path: ".gitmodules" })
          : await input.workspace.readTextPrefix({ path: ".gitmodules", max_bytes: MAX_GITMODULES_BYTES });
        for (const line of content.split(/\r?\n/u)) {
          const match = /^\s*path\s*=\s*(.+?)\s*$/u.exec(line);
          if (match === null) continue;
          const boundaryPath = safePath(match[1] ?? "");
          if (boundaryPath === undefined || boundaryPath === ".") {
            limitations.push({ kind: "gitmodules_malformed", message: ".gitmodules contained an invalid repo-relative submodule path." });
          } else {
            declared.add(boundaryPath);
          }
        }
      }
    }
  } catch {
    limitations.push({ kind: "gitmodules_unreadable", message: ".gitmodules could not be read through the bounded workspace port." });
  }

  const boundaries: RepositoryBoundaryEvidence[] = [];
  for (const boundaryPath of [...declared].sort()) {
    const initialized = await exists(input.workspace, `${boundaryPath}/.git`);
    boundaries.push(boundaryEvidence(boundaryPath, "declared_submodule", initialized ? "initialized" : "uninitialized", [".gitmodules"]));
  }
  for (const skipped of input.skipped_paths ?? []) {
    if (skipped.reason !== "nested_git_repository") continue;
    const boundaryPath = safePath(skipped.path);
    if (boundaryPath === undefined || [...declared].some((path) => containsPath(path, boundaryPath))) continue;
    boundaries.push(boundaryEvidence(boundaryPath, "repository_boundary_unknown", "incomplete", [boundaryPath]));
  }
  const unique = [...new Map(boundaries.map((item) => [item.path, item])).values()].sort((left, right) => left.path.localeCompare(right.path));
  if (unique.length > limit) limitations.push({ kind: "boundary_cap_exceeded", message: `Repository-boundary evidence was capped at ${limit} paths.` });
  return { boundaries: unique.slice(0, limit), limitations };
}

export function boundaryForPath(path: string, boundaries: readonly RepositoryBoundaryEvidence[]): RepositoryBoundaryEvidence | undefined {
  const normalized = safePath(path);
  if (normalized === undefined) return undefined;
  return [...boundaries]
    .filter((boundary) => containsPath(boundary.path, normalized))
    .sort((left, right) => right.path.length - left.path.length || left.path.localeCompare(right.path))[0];
}

export function pathIsOutsideRepositoryBoundaries(path: string, boundaries: readonly RepositoryBoundaryEvidence[]): boolean {
  return boundaryForPath(path, boundaries) === undefined;
}

function boundaryEvidence(path: string, boundary: RepositoryBoundaryEvidence["boundary"], availability: RepositoryBoundaryEvidence["availability"], evidencePaths: string[]): RepositoryBoundaryEvidence {
  return {
    path,
    boundary,
    availability,
    evidence_paths: uniqueSorted(evidencePaths),
    blocker: {
      kind: boundary === "declared_submodule" ? "submodule_unavailable" : "repository_boundary_unknown",
      unit_root: path,
      evidence_paths: uniqueSorted(evidencePaths),
      message: boundary === "declared_submodule"
        ? `Repository boundary ${path} is ${availability}; recursive submodule validation planning is unavailable in this capability.`
        : `Repository boundary ${path} lacks complete .gitmodules authority evidence and was not traversed.`,
      blocked_claims: ["repository_traversal"]
    }
  };
}

async function exists(workspace: WorkspaceFilePort, path: string): Promise<boolean> {
  try { return (await workspace.stat({ path })).exists; } catch { return false; }
}

function safePath(value: string): string | undefined {
  const normalized = normalizeRepoPath(value);
  if (normalized.startsWith("/") || normalized.includes("\\") || normalized.includes("\0")) return undefined;
  if (normalized.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")) return undefined;
  return normalized;
}

function containsPath(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}/`);
}
