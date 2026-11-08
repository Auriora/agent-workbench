/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  classifyPathPolicy,
  parseGitignoreRules,
  parseRootIgnoreFileRules
} from "../../src/domain/policies/path-policy.js";
import { FileCatalogScannerAdapter } from "../../src/infrastructure/filesystem/file-catalog-scanner.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("compiled path matchers", () => {
  it("prepares duplicate wildcard rules once and freezes the policy set", () => {
    let compilations = 0;
    const rules = parseGitignoreRules("*.blocked\n*.blocked\n!keep.blocked\n", () => { compilations += 1; });

    expect(compilations).toBe(1);
    expect(Object.isFrozen(rules)).toBe(true);
    expect(Object.isFrozen(rules[0])).toBe(true);
    expect(classifyPathPolicy({ relativePath: "discard.blocked", isDirectory: false, gitignoreRules: rules }).reason)
      .toBe("gitignore");
    expect(classifyPathPolicy({ relativePath: "keep.blocked", isDirectory: false, gitignoreRules: rules }).reason)
      .toBe("source");

    expect(Reflect.set(rules[0] as object, "pattern", "changed.blocked")).toBe(false);
    expect(classifyPathPolicy({ relativePath: "discard.blocked", isDirectory: false, gitignoreRules: rules }).reason)
      .toBe("gitignore");
  });

  it("keeps exact question marks literal and preserves old immutable-set semantics", () => {
    const oldRules = parseGitignoreRules("a?b\n");
    const newRules = parseGitignoreRules("other.txt\n");

    expect(classifyPathPolicy({ relativePath: "a?b", isDirectory: false, gitignoreRules: oldRules }).reason)
      .toBe("gitignore");
    expect(classifyPathPolicy({ relativePath: "acb", isDirectory: false, gitignoreRules: oldRules }).reason)
      .toBe("source");
    expect(classifyPathPolicy({ relativePath: "a?b", isDirectory: false, gitignoreRules: oldRules }).reason)
      .toBe("gitignore");
    expect(classifyPathPolicy({ relativePath: "other.txt", isDirectory: false, gitignoreRules: newRules }).reason)
      .toBe("gitignore");
  });

  it("combines root ignore files into one ordered preparation set", () => {
    let compilations = 0;
    const rules = parseRootIgnoreFileRules([
      { name: ".gitignore", content: "*.blocked\n" },
      { name: ".aiignore", content: "!keep.blocked\n*.blocked\n" }
    ], () => { compilations += 1; });

    expect(compilations).toBe(1);
    expect(Object.isFrozen(rules)).toBe(true);
    expect(classifyPathPolicy({ relativePath: "keep.blocked", isDirectory: false, gitignoreRules: rules }).reason)
      .toBe("gitignore");
  });

  it("reloads root and admitted-child policies on the same scanner while matching priority question marks", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-compiled-matchers-"));
    roots.push(root);
    const child = path.join(root, "child");
    fs.mkdirSync(child, { recursive: true });
    fs.writeFileSync(path.join(root, ".gitignore"), "root-ignore*.blocked\n");
    fs.writeFileSync(path.join(root, ".aiignore"), "root-ai-ignore*.blocked\n");
    fs.writeFileSync(path.join(root, "root-ignore.blocked"), "ignored\n");
    fs.writeFileSync(path.join(root, "root-ai-ignore.blocked"), "ignored\n");
    fs.writeFileSync(path.join(child, ".gitignore"), "child-ignore*.blocked\n");
    fs.writeFileSync(path.join(child, ".aiignore"), "child-ai-ignore*.blocked\n");
    fs.writeFileSync(path.join(child, "child-ignore.blocked"), "ignored\n");
    fs.writeFileSync(path.join(child, "child-ai-ignore.blocked"), "ignored\n");
    fs.writeFileSync(path.join(child, "ab.ts"), "export const ab = true;\n");
    fs.writeFileSync(path.join(child, "a😀.ts"), "export const emoji = true;\n");

    for (const directory of [root, child]) {
      fs.writeFileSync(path.join(directory, "next-git.blocked"), "next policy\n");
      fs.writeFileSync(path.join(directory, "next-ai.blocked"), "next policy\n");
    }
    let compilations = 0;
    const scanner = new FileCatalogScannerAdapter({
      observe: event => { if (event === "wildcard_regex_compilations") compilations += 1; }
    });
    const input = {
      repo_root: root,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 100,
      priority_path_patterns: ["child/a?.ts"],
      repository_composition: {
        repositories: [
          { path_prefix: ".", state: "superproject", source_available: true },
          {
            path_prefix: "child",
            state: "initialized",
            source_available: true,
            declaration_path: ".gitmodules",
            head_gitlink_oid: "abc123"
          }
        ]
      }
    } as const;

    const first = await scanner.scan(input);
    const firstPaths = first.files.map((file) => file.path);
    expect(compilations).toBe(6); // Four policy wildcards plus two priority segments.
    expect(firstPaths).toEqual(expect.arrayContaining(["next-git.blocked", "next-ai.blocked", "child/next-git.blocked", "child/next-ai.blocked"]));
    expect(firstPaths).toContain("child/ab.ts");
    expect(firstPaths).toContain("child/a😀.ts");
    expect(firstPaths.indexOf("child/ab.ts")).toBeLessThan(firstPaths.indexOf("child/a😀.ts"));
    expect(firstPaths).not.toContain("root-ignore.blocked");
    expect(firstPaths).not.toContain("root-ai-ignore.blocked");
    expect(firstPaths).not.toContain("child/child-ignore.blocked");
    expect(firstPaths).not.toContain("child/child-ai-ignore.blocked");

    fs.writeFileSync(path.join(root, ".gitignore"), "next-git*.blocked\n");
    fs.writeFileSync(path.join(root, ".aiignore"), "next-ai*.blocked\n");
    fs.writeFileSync(path.join(child, ".gitignore"), "next-git*.blocked\n");
    fs.writeFileSync(path.join(child, ".aiignore"), "next-ai*.blocked\n");
    const second = await scanner.scan(input);
    expect(compilations).toBe(12); // New root/child sets, even with equal next-policy patterns.
    for (const file of ["next-git.blocked", "next-ai.blocked", "child/next-git.blocked", "child/next-ai.blocked"]) {
      expect(second.files.map(entry => entry.path)).not.toContain(file);
    }
    expect(second.files.map((file) => file.path)).toContain("root-ignore.blocked");
    expect(second.files.map((file) => file.path)).toContain("root-ai-ignore.blocked");
    expect(second.files.map((file) => file.path)).toContain("child/child-ignore.blocked");
    expect(second.files.map((file) => file.path)).toContain("child/child-ai-ignore.blocked");
  });

  it("shares priority segment compilation across matching patterns", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-priority-matchers-"));
    roots.push(root);
    fs.mkdirSync(path.join(root, "app", "config", "routes"), { recursive: true });
    fs.writeFileSync(path.join(root, "app", "config", "routes.rb"), "routes\n");
    fs.writeFileSync(path.join(root, "app", "config", "routes", "admin.rb"), "admin\n");
    fs.writeFileSync(path.join(root, "app", "config", "routes.txt"), "other\n");
    let compilations = 0;
    const result = await new FileCatalogScannerAdapter({
      observe: (event) => { if (event === "wildcard_regex_compilations") compilations += 1; }
    }).scan({
      repo_root: root,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 100,
      priority_path_patterns: [
        "**/config/routes.rb",
        "**/config/routes/*.rb",
        "**/config/routes.rb"
      ]
    });

    expect(result.files.slice(0, 2).map((file) => file.path)).toEqual([
      "app/config/routes.rb",
      "app/config/routes/admin.rb"
    ]);
    expect(compilations).toBe(4);
  });
});
