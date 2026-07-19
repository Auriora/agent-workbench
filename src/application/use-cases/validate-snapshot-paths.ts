/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from "node:path";
import type { SnapshotState, SnapshotValidityReceipt } from "../../domain/models/runtime.js";
import type {
  FileCatalogPort,
  SnapshotPathValidationOutcome,
  SnapshotPathInventoryPort,
  SnapshotPathValidationPort,
  SnapshotValidityPort
} from "../../ports/index.js";

export const DEFAULT_SNAPSHOT_VALIDITY_MAX_PATHS = 2_000;

export class SnapshotValidityService implements SnapshotValidityPort {
  public constructor(
    private readonly catalog: FileCatalogPort,
    private readonly pathValidation: SnapshotPathValidationPort,
    private readonly inventory?: SnapshotPathInventoryPort
  ) {}

  public async validate(input: {
    snapshot: SnapshotState;
    max_paths: number;
  }): Promise<SnapshotValidityReceipt> {
    if (this.inventory !== undefined) {
      const observedPaths = await this.inventory.listIndexedPaths({
        snapshot_id: input.snapshot.id,
        max_rows: input.max_paths + 1
      });
      return validateObservedPaths({
        snapshot: input.snapshot,
        observed_paths: observedPaths,
        path_validation: this.pathValidation,
        max_paths: input.max_paths
      });
    }
    return validateSnapshotPaths({
      snapshot: input.snapshot,
      catalog: this.catalog,
      path_validation: this.pathValidation,
      max_paths: input.max_paths
    });
  }
}

export async function validateSnapshotPaths(input: {
  snapshot: SnapshotState;
  catalog: FileCatalogPort;
  path_validation: SnapshotPathValidationPort;
  max_paths?: number;
}): Promise<SnapshotValidityReceipt> {
  const maxPaths = input.max_paths ?? DEFAULT_SNAPSHOT_VALIDITY_MAX_PATHS;
  if (!Number.isInteger(maxPaths) || maxPaths < 1) {
    throw new Error("Snapshot path validation max_paths must be a positive integer.");
  }

  const observed = await input.catalog.listFiles({
    snapshot_id: input.snapshot.id,
    max_rows: maxPaths + 1
  });
  return validateObservedPaths({
    snapshot: input.snapshot,
    observed_paths: observed.map((file) => file.path),
    path_validation: input.path_validation,
    max_paths: maxPaths
  });
}

async function validateObservedPaths(input: {
  snapshot: SnapshotState;
  observed_paths: readonly string[];
  path_validation: SnapshotPathValidationPort;
  max_paths: number;
}): Promise<SnapshotValidityReceipt> {
  const complete = input.observed_paths.length <= input.max_paths;
  const paths = input.observed_paths.slice(0, input.max_paths);
  const outcomes = await input.path_validation.validatePaths({
    repo_root: input.snapshot.repo_root,
    paths
  });
  const normalized = normalizeOutcomes(paths, outcomes);
  const missingPaths = pathsForStatus(normalized, "missing");
  const inaccessiblePaths = pathsForStatus(normalized, "inaccessible");
  const publicMissingPaths = publicEvidencePaths(input.snapshot.repo_root, missingPaths);
  const publicInaccessiblePaths = publicEvidencePaths(input.snapshot.repo_root, inaccessiblePaths);

  if (missingPaths.length > 0) {
    return receipt({
      snapshotId: input.snapshot.id,
      state: "stale",
      complete,
      checkedPathCount: normalized.length,
      observedPathCount: input.observed_paths.length,
      missingPaths: publicMissingPaths,
      inaccessiblePaths: publicInaccessiblePaths,
      refreshRequired: true,
      reason: `${missingPaths.length} indexed path(s) are no longer present in the workspace.`
    });
  }

  if (!complete || inaccessiblePaths.length > 0) {
    const reasons = [
      ...(!complete ? [`Validation exceeded the ${input.max_paths}-path budget.`] : []),
      ...(inaccessiblePaths.length > 0
        ? [`${inaccessiblePaths.length} indexed path(s) could not be validated.`]
        : [])
    ];
    return receipt({
      snapshotId: input.snapshot.id,
      state: "degraded",
      complete,
      checkedPathCount: normalized.length,
      observedPathCount: input.observed_paths.length,
      missingPaths: [],
      inaccessiblePaths: publicInaccessiblePaths,
      refreshRequired: false,
      reason: reasons.join(" ")
    });
  }

  return receipt({
    snapshotId: input.snapshot.id,
    state: "valid",
    complete: true,
    checkedPathCount: normalized.length,
    observedPathCount: input.observed_paths.length,
    missingPaths: [],
    inaccessiblePaths: [],
    refreshRequired: false
  });
}

function publicEvidencePaths(repoRoot: string, paths: readonly string[]): string[] {
  return paths.map((candidate) => {
    if (!path.isAbsolute(candidate)) {
      return candidate.split(path.sep).join("/");
    }
    const relative = path.relative(repoRoot, candidate);
    if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
      return relative.split(path.sep).join("/") || ".";
    }
    return "<outside-repository-path>";
  });
}

function normalizeOutcomes(
  paths: readonly string[],
  outcomes: readonly SnapshotPathValidationOutcome[]
): SnapshotPathValidationOutcome[] {
  const byPath = new Map(outcomes.map((outcome) => [outcome.path, outcome]));
  return paths.map((path) => byPath.get(path) ?? {
    path,
    status: "inaccessible",
    reason: "The path validator did not return evidence for this indexed path."
  });
}

function pathsForStatus(
  outcomes: readonly SnapshotPathValidationOutcome[],
  status: SnapshotPathValidationOutcome["status"]
): string[] {
  return outcomes
    .filter((outcome) => outcome.status === status)
    .map((outcome) => outcome.path)
    .sort();
}

function receipt(input: {
  snapshotId: string;
  state: SnapshotValidityReceipt["state"];
  complete: boolean;
  checkedPathCount: number;
  observedPathCount: number;
  missingPaths: readonly string[];
  inaccessiblePaths: readonly string[];
  refreshRequired: boolean;
  reason?: string;
}): SnapshotValidityReceipt {
  return {
    snapshot_id: input.snapshotId,
    state: input.state,
    complete: input.complete,
    checked_path_count: input.checkedPathCount,
    observed_path_count: input.observedPathCount,
    missing_paths: [...input.missingPaths],
    inaccessible_paths: [...input.inaccessiblePaths],
    refresh_required: input.refreshRequired,
    ...(input.reason === undefined ? {} : { reason: input.reason })
  };
}
