/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRefreshBaselineFixture } from "../../src/debug/fixtures/refresh-baseline-fixture.js";
import { FileCatalogScannerAdapter } from "../../src/infrastructure/filesystem/index.js";

const roots: string[] = [];
const privateParent = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-baseline-generator-test-"));
  roots.push(root);
  return root;
};

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("refresh baseline fixture", () => {
  it("refuses an unrelated working directory before creating any fixture", () => {
    const parent = privateParent();
    const unrelatedCwd = privateParent();
    const child = spawnSync(process.execPath, [
      "--import", import.meta.resolve("tsx"),
      path.resolve("src/debug/fixtures/refresh-baseline-fixture.ts"),
      "--parent", parent, "--python-files", "1"
    ], { cwd: unrelatedCwd, encoding: "utf8" });
    expect(child.status).not.toBe(0);
    expect(child.stderr).toContain("must be run from the owning Agent Workbench checkout");
    expect(fs.readdirSync(parent)).toEqual([]);
    expect(fs.readdirSync(unrelatedCwd)).toEqual([]);
  });

  it("freezes identical content and Git revisions across independent private roots", () => {
    const left = createRefreshBaselineFixture({ parent_root: privateParent(), python_files: 3 });
    const right = createRefreshBaselineFixture({ parent_root: privateParent(), python_files: 3 });
    expect(left.repo_root).not.toBe(right.repo_root);
    expect(left.manifest).toEqual(right.manifest);
    expect(left.content_fingerprint).toBe(right.content_fingerprint);
    expect(left.revision).toBe(right.revision);
    expect(left.revision).toMatch(/^[a-f0-9]{40}$/u);
    expect(left.source_timestamp).toBe("2001-01-01T00:00:00Z");
    expect(right.source_timestamp).toBe("2001-01-01T00:00:00Z");
    for (const file of left.manifest) {
      for (const fixture of [left, right]) {
        const stats = fs.statSync(path.join(fixture.repo_root, file.path));
        expect(stats.mtimeMs).toBe(978307200000);
        expect(stats.atimeMs).toBe(978307200000);
      }
    }
    expect(fs.statSync(left.repo_root).mode & 0o777).toBe(0o700);
    expect(execFileSync("git", ["status", "--porcelain"], { cwd: left.repo_root, encoding: "utf8" })).toBe("");
    expect(left.manifest.every((file) => file.sha256.length === 64 && file.bytes > 0)).toBe(true);
  });

  it("generates enough cross-slice work and independent expected file-format evidence", () => {
    const fixture = createRefreshBaselineFixture({ parent_root: privateParent() });
    expect(fixture.revision).toBe("b8bf06687190d3b09280f3b37c11e914bce0577e");
    expect(fixture.content_fingerprint).toBe("d10935fcb3d0c1e8ca95e877c08644aec625f2a787b20d7395790b1d0f6eefd4");
    expect(fixture.counts.files).toBe(336);
    expect(fixture.source_timestamp).toBe("2001-01-01T00:00:00Z");
    for (const file of fixture.manifest) {
      const stats = fs.statSync(path.join(fixture.repo_root, file.path));
      expect(stats.mtimeMs).toBe(978307200000);
      expect(stats.atimeMs).toBe(978307200000);
    }
    expect(fixture.counts.python_files).toBeGreaterThan(250);
    expect(fixture.counts.python_call_references).toBeGreaterThan(5_000);
    expect(fixture.counts.files).toBe(fixture.manifest.length);
    const callerPaths = fixture.manifest.filter((entry) => entry.path.startsWith("src/callers/")).map((entry) => entry.path);
    expect(callerPaths).toHaveLength(320);
    const calls = callerPaths.reduce((sum, p) => sum + (fs.readFileSync(path.join(fixture.repo_root, p), "utf8").match(/final_helper\(\)/gu)?.length ?? 0), 0);
    expect(calls).toBe(fixture.counts.python_call_references);
    expect(fs.readFileSync(path.join(fixture.repo_root, "z_final_helper.py"), "utf8")).toContain("def final_helper()");
    for (const p of fixture.expected_positive_qt_paths) {
      const prefix = fs.readFileSync(path.join(fixture.repo_root, p)).subarray(0, 16_384).toString("utf8");
      expect(prefix).toContain('<?xml version="1.0"');
      expect(prefix).toContain('<TS version="2.1"');
    }
    const beyond = fs.readFileSync(path.join(fixture.repo_root, fixture.expected_inconclusive_qt_paths[0]));
    expect(beyond.subarray(0, 16_384).toString("utf8")).not.toContain("<TS");
    expect(beyond.toString("utf8")).toContain("<TS");
    expect(fs.readFileSync(path.join(fixture.repo_root, fixture.expected_typescript_paths[0]), "utf8")).toContain("export function realCode()");
    expect(fs.readFileSync(path.join(fixture.repo_root, fixture.expected_typescript_paths[1]), "utf8").indexOf("*/")).toBeGreaterThan(16_384);
  });

  it("retains the negated ignore exception while excluding declared wildcard/root fixtures", async () => {
    const fixture = createRefreshBaselineFixture({ parent_root: privateParent(), python_files: 1 });
    const result = await new FileCatalogScannerAdapter().scan({ repo_root: fixture.repo_root, indexed_roots: ["."], skipped_roots: [], max_files: 2000 });
    const admitted = new Set(result.files.map((file) => file.path));
    expect(admitted.has("ignored-kept.py")).toBe(true);
    for (const p of fixture.expected_ignored_paths) expect(admitted.has(p)).toBe(false);
    expect(fixture.expected_positive_qt_paths.every((p) => admitted.has(p))).toBe(true);
  });

  it("never overwrites existing parent contents and rejects symlink or invalid-size requests", () => {
    const parent = privateParent();
    const sentinel = path.join(parent, "keep.txt");
    fs.writeFileSync(sentinel, "untouched");
    const first = createRefreshBaselineFixture({ parent_root: parent, python_files: 1 });
    const second = createRefreshBaselineFixture({ parent_root: parent, python_files: 1 });
    expect(first.repo_root).not.toBe(second.repo_root);
    expect(fs.readFileSync(sentinel, "utf8")).toBe("untouched");
    const link = path.join(parent, "parent-link");
    fs.symlinkSync(parent, link, "dir");
    expect(() => createRefreshBaselineFixture({ parent_root: link, python_files: 1 })).toThrow("non-symlink");
    for (const count of [0, -1, 1.5, 10_001, Number.NaN]) expect(() => createRefreshBaselineFixture({ parent_root: parent, python_files: count })).toThrow("python_files");
  });
});
