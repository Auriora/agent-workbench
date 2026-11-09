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
import type { FileIdentityPort, GraphBuildCatalogCapturePort } from "../../src/ports/index.js";

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

  it("accepts an unchanged file whose nanosecond mtime rounds up in Node Stats.mtimeMs", async () => {
    const filePath = path.join(repoRoot, "src", "rounded.js");
    fs.writeFileSync(filePath, "export const rounded = true;\n");
    const mtimeNs = 1_784_614_764_942_999_929n;
    const expectedMtimeMs = 1_784_614_764_943;
    const originalStatSync = fs.statSync;
    const statSync = vi.spyOn(fs, "statSync").mockImplementation(((target, options) => {
      const stats = originalStatSync(target, options) as fs.Stats | fs.BigIntStats;
      if (path.resolve(String(target)) !== filePath) return stats;
      if (options !== undefined && typeof options === "object" && options.bigint === true) {
        return Object.create(stats, { mtimeNs: { value: mtimeNs } });
      }
      return Object.create(stats, { mtimeMs: { value: expectedMtimeMs } });
    }) as typeof fs.statSync);
    try {
      const result = await new FileCatalogScannerAdapter({ capture: recordingCapture() }).scan({
        repo_root: repoRoot, indexed_roots: ["."], skipped_roots: [], max_files: 20
      });

      expect(result.files.find(entry => entry.path === "src/rounded.js")?.file_identity.mtime_ms).toBe(expectedMtimeMs);
    } finally {
      statSync.mockRestore();
    }
  });

  it("rejects a file whose metadata changes between catalog stat and manifest capture", async () => {
    const filePath = path.join(repoRoot, "src", "changed.js");
    fs.writeFileSync(filePath, "export const changed = true;\n");
    fs.utimesSync(filePath, new Date("2026-07-21T06:19:24.000Z"), new Date("2026-07-21T06:19:24.000Z"));
    const fileIdentity: FileIdentityPort = {
      compute: async () => { throw new Error("not used by catalog scan"); },
      inferLanguage: async ({ path: candidatePath }) => {
        if (candidatePath === filePath) {
          fs.utimesSync(filePath, new Date("2026-07-21T06:19:26.000Z"), new Date("2026-07-21T06:19:26.000Z"));
        }
        return "javascript";
      },
      isSkipped: async () => false
    };

    await expect(new FileCatalogScannerAdapter({ capture: recordingCapture(), fileIdentity }).scan({
      repo_root: repoRoot, indexed_roots: ["."], skipped_roots: [], max_files: 20
    })).rejects.toThrow("Graph build manifest file metadata changed during catalog preparation: src/changed.js");
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

function recordingCapture(): GraphBuildCatalogCapturePort {
  return {
    beforeDirectory: async ({ path: directory }) => ({
      epoch: "epoch-1", sequence: 1, healthy: true, pending_events: 0, covered_directories: [directory]
    }),
    directory: async () => undefined,
    file: async () => undefined
  };
}
