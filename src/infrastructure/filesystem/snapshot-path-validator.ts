/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import type {
  SnapshotPathValidationOutcome,
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
  }): Promise<readonly SnapshotPathValidationOutcome[]> {
    const outcomes: SnapshotPathValidationOutcome[] = [];
    for (let offset = 0; offset < input.paths.length; offset += this.maxConcurrency) {
      outcomes.push(...await Promise.all(
        input.paths.slice(offset, offset + this.maxConcurrency).map((path) => this.validatePath(path))
      ));
    }
    return outcomes;
  }

  private async validatePath(path: string): Promise<SnapshotPathValidationOutcome> {
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
