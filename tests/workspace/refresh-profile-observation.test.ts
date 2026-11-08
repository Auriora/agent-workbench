/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { catalogSkipReason, parseGitignoreRules } from "../../src/domain/policies/path-policy.js";
import { FileCatalogScannerAdapter, type FileCatalogObservation } from "../../src/infrastructure/filesystem/file-catalog-scanner.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

function fixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-scan-observation-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "nested"));
  fs.writeFileSync(path.join(root, ".gitignore"), "*.skip\n");
  fs.writeFileSync(path.join(root, "a.py"), "pass\n");
  fs.writeFileSync(path.join(root, "b.skip"), "excluded\n");
  fs.writeFileSync(path.join(root, "nested", "c.py"), "pass\n");
  return root;
}

function counts(): Record<FileCatalogObservation, number> {
  return { directory_enumerations: 0, directory_entries_considered: 0, file_stat_attempts: 0, wildcard_regex_compilations: 0 };
}

describe("refresh profiling observations preserve canonical policy", () => {
  it("counts actual wildcard construction without changing exact, negated or segment decisions", () => {
    let compilations = 0;
    const gitignoreRules = parseGitignoreRules("*.py\n!keep.py\n", () => { compilations += 1; });
    expect(compilations).toBe(1);
    const common = { relativePath: "folder/run.py", isDirectory: false, skippedRoots: [], gitignoreRules };
    const plain = catalogSkipReason(common);
    const observed = catalogSkipReason(common);
    expect(observed).toBe(plain);
    expect(observed).toBe("gitignore");
    expect(compilations).toBe(1); // The wildcard is prepared once for this immutable policy set.
    expect(catalogSkipReason({ ...common, relativePath: "keep.py" })).toBeNull();
    expect(compilations).toBe(1); // The exact !keep.py rule constructs no expression.
  });

  it("counts successful enumeration, considered entries and identity-stat attempts exactly", async () => {
    const root = fixture();
    const observedCounts = counts();
    const input = { repo_root: root, indexed_roots: ["."], skipped_roots: [], max_files: 100 };
    const plain = await new FileCatalogScannerAdapter().scan(input);
    const observed = await new FileCatalogScannerAdapter({ observe: event => { observedCounts[event] += 1; } }).scan(input);
    expect(observed).toEqual(plain);
    expect(observed.files.map(file => file.path)).toEqual([".gitignore", "a.py", "nested/c.py"]);
    expect(observedCounts).toEqual({
      directory_enumerations: 2,
      directory_entries_considered: 5,
      file_stat_attempts: 3,
      wildcard_regex_compilations: 1
    });
  });

  it("includes actual priority-glob compilation without changing priority order", async () => {
    const root = fixture();
    const observedCounts = counts();
    const input = { repo_root: root, indexed_roots: ["."], skipped_roots: [], max_files: 100, priority_path_patterns: ["*.py"] };
    const plain = await new FileCatalogScannerAdapter().scan(input);
    const observed = await new FileCatalogScannerAdapter({ observe: event => { observedCounts[event] += 1; } }).scan(input);
    expect(observed).toEqual(plain);
    expect(observed.files[0].path).toBe("a.py");
    expect(observedCounts.wildcard_regex_compilations).toBe(2);
  });
});
