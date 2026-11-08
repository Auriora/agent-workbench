/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureGraphBuildRepositoryInputs,
  FileCatalogScannerAdapter,
  readGraphBuildPathIdentity
} from "../../src/infrastructure/filesystem/index.js";
import type { GraphBuildCatalogCapturePort } from "../../src/ports/index.js";

describe("graph build catalog capture", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-manifest-capture-"));
    fs.mkdirSync(path.join(repoRoot, "src"));
    fs.writeFileSync(path.join(repoRoot, "src", "app.ts"), "export const app = true;\n");
  });

  afterEach(() => fs.rmSync(repoRoot, { recursive: true, force: true }));

  it("arms and records each admitted directory before its one enumeration", async () => {
    const trace: string[] = [];
    const capture: GraphBuildCatalogCapturePort = {
      beforeDirectory: async ({ path: directory }) => {
        trace.push(`before:${directory}`);
        return { epoch: "epoch-1", sequence: trace.length, healthy: true, pending_events: 0, covered_directories: [directory] };
      },
      directory: async ({ identity }) => { trace.push(`directory:${identity.path}`); },
      file: async ({ entry }) => { trace.push(`file:${entry.path}`); }
    };
    const scanner = new FileCatalogScannerAdapter({ capture });

    const result = await scanner.scan({ repo_root: repoRoot, indexed_roots: ["."], skipped_roots: [], max_files: 20 });

    expect(result.files.map(entry => entry.path)).toEqual(["src/app.ts"]);
    expect(trace).toEqual(["before:.", "directory:.", "before:src", "directory:src", "file:src/app.ts"]);
  });

  it("fails rather than accepting a directory changed after watcher acknowledgement", async () => {
    const scanner = new FileCatalogScannerAdapter({
      capture: {
        beforeDirectory: async ({ path: directory }) => {
          if (directory === ".") fs.writeFileSync(path.join(repoRoot, "changed-after-arm.txt"), "changed\n");
          return { epoch: "epoch-1", sequence: 1, healthy: true, pending_events: 0, covered_directories: [directory] };
        },
        directory: async () => undefined,
        file: async () => undefined
      }
    });

    await expect(scanner.scan({ repo_root: repoRoot, indexed_roots: ["."], skipped_roots: [], max_files: 20 }))
      .rejects.toThrow("Directory changed before catalog enumeration");
  });

  it("does not enumerate directories while reading one identity", () => {
    const readdir = vi.spyOn(fs, "readdirSync");
    try {
      expect(readGraphBuildPathIdentity(repoRoot, "src/app.ts").kind).toBe("file");
      expect(readdir).not.toHaveBeenCalled();
    } finally {
      readdir.mockRestore();
    }
  });

  it("captures Git metadata for a gitfile worktree without walking metadata directories", () => {
    const metadata = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-git-metadata-"));
    try {
      fs.mkdirSync(path.join(metadata, "refs", "heads"), { recursive: true });
      fs.writeFileSync(path.join(metadata, "HEAD"), "ref: refs/heads/main\n");
      fs.writeFileSync(path.join(metadata, "refs", "heads", "main"), "0123456789012345678901234567890123456789\n");
      fs.writeFileSync(path.join(repoRoot, ".git"), `gitdir: ${metadata}\n`);
      const identities = captureGraphBuildRepositoryInputs(repoRoot, "");

      expect(identities.some(identity => identity.scope === "git" && identity.path === "HEAD")).toBe(true);
      expect(identities.some(identity => identity.scope === "git" && identity.path === "refs/heads/main")).toBe(true);
    } finally {
      fs.rmSync(metadata, { recursive: true, force: true });
    }
  });

  it("fails explicitly for an unsupported Git marker rather than recording partial metadata", () => {
    fs.writeFileSync(path.join(repoRoot, ".git"), "not a gitdir marker\n");
    expect(() => captureGraphBuildRepositoryInputs(repoRoot, "")).toThrow("Git metadata is unavailable");
  });
});
