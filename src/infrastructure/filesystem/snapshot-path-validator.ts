/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import type {
  SnapshotPathValidationOutcome,
  SnapshotPathValidationExpectation,
  SnapshotPathValidationPort
} from "../../ports/index.js";
import { WorkspaceSafetyAdapter, type WorkspaceSafetyPolicy } from "./workspace-safety.js";

export class FilesystemSnapshotPathValidatorAdapter implements SnapshotPathValidationPort {
  private readonly safety: WorkspaceSafetyAdapter;
  private readonly maxConcurrency: number;

  public constructor(policy: WorkspaceSafetyPolicy, maxConcurrency = 32) {
    this.safety = new WorkspaceSafetyAdapter(policy);
    this.maxConcurrency = Math.max(1, maxConcurrency);
  }

  public async validatePaths(input: {
    repo_root: string;
    paths: readonly string[];
    expectations?: readonly SnapshotPathValidationExpectation[];
  }): Promise<readonly SnapshotPathValidationOutcome[]> {
    const expectationByPath = expectationMap(input.expectations ?? []);
    const outcomes: SnapshotPathValidationOutcome[] = [];
    for (let offset = 0; offset < input.paths.length; offset += this.maxConcurrency) {
      outcomes.push(...await Promise.all(
        input.paths
          .slice(offset, offset + this.maxConcurrency)
          .map((path) => this.validatePath(path, expectationByPath.get(path)))
      ));
    }
    return outcomes;
  }

  private async validatePath(
    path: string,
    expected: SnapshotPathValidationExpectation | undefined
  ): Promise<SnapshotPathValidationOutcome> {
    const decision = this.safety.resolveWorkspacePath(path);
    if (!decision.allowed) {
      return {
        path,
        status: "inaccessible",
        reason: "The indexed path is outside the allowed workspace read boundary."
      };
    }

    try {
      const stat = await fs.promises.stat(decision.absolutePath);
      if (!stat.isFile()) {
        return {
          path,
          status: "missing",
          reason: "The indexed file path no longer identifies a file."
        };
      }
      if (expected === undefined || expected.size_bytes === undefined || expected.mtime_ms === undefined) {
        return { path, status: "present" };
      }
      if (
        stat.size !== expected.size_bytes ||
        Math.trunc(stat.mtimeMs) !== Math.trunc(expected.mtime_ms ?? NaN)
      ) {
        return {
          path,
          status: "changed",
          reason: "The indexed file identity does not match the snapshot record."
        };
      }
      return { path, status: "present" };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") {
        return { path, status: "missing" };
      }
      return {
        path,
        status: "inaccessible",
        reason: code === undefined
          ? "The indexed path could not be validated."
          : `The indexed path could not be validated (${code}).`
      };
    }
  }
}

function expectationMap(
  expectations: readonly SnapshotPathValidationExpectation[]
): Map<string, SnapshotPathValidationExpectation> {
  const byPath = new Map<string, SnapshotPathValidationExpectation>();
  for (const expectation of expectations) {
    byPath.set(expectation.path, expectation);
  }
  return byPath;
}
