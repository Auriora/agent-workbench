/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SKIPPED_ROOTS } from "../../src/domain/policies/index.js";
import { FileCatalogScannerAdapter } from "../../src/infrastructure/filesystem/index.js";

describe("file catalog scanner", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-scan-"));
    fs.mkdirSync(path.join(repoRoot, "src"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".github", "workflows"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".claude", "commands"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".codex", ".tmp"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".direnv"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".gocache"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".gradle", "caches"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".home", ".onemount-tests"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".local"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".nox", "unit"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".mypy_cache", "3.12"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".nuxt"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".pixi", "envs"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".sandbox", "home", ".onemount-tests"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".onemount-tests"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "cmake-build-debug"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "node_modules", "pkg"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "vendor", "dep"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "src", "3rdParty", "dep"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "libs", "nested-repo", ".git"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "test-artifacts", "logs"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "src", "__pycache__"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "src", "service.py"), "def handler():\n    return 'ok'\n");
    fs.writeFileSync(path.join(repoRoot, "src", "__pycache__", "service.cpython-312.pyc"), "compiled\n");
    fs.writeFileSync(path.join(repoRoot, "src", "app.ts"), "export const value = 'ok';\n");
    fs.writeFileSync(path.join(repoRoot, "package.json"), "{\"name\":\"fixture\"}\n");
    fs.writeFileSync(path.join(repoRoot, "Gemfile"), "source 'https://rubygems.org'\n");
    fs.writeFileSync(path.join(repoRoot, "Rakefile"), "task :default\n");
    fs.writeFileSync(path.join(repoRoot, ".ruby-version"), "3.4.0\n");
    fs.writeFileSync(path.join(repoRoot, "config.ru"), "run Application\n");
    fs.writeFileSync(path.join(repoRoot, ".github", "workflows", "ci.yml"), "name: ci\n");
    fs.writeFileSync(path.join(repoRoot, ".claude", "commands", "review.md"), "local agent guidance\n");
    fs.writeFileSync(path.join(repoRoot, ".codex", ".tmp", "plugin.md"), "local plugin cache\n");
    fs.writeFileSync(path.join(repoRoot, ".direnv", "state"), "generated env\n");
    fs.writeFileSync(path.join(repoRoot, ".gocache", "cache-a"), "generated go cache\n");
    fs.writeFileSync(path.join(repoRoot, ".gradle", "caches", "module.bin"), "generated gradle cache\n");
    fs.writeFileSync(path.join(repoRoot, ".home", ".onemount-tests", "state.json"), "{}\n");
    fs.writeFileSync(path.join(repoRoot, ".local", "sample.json"), "{}\n");
    fs.writeFileSync(path.join(repoRoot, ".nox", "unit", "python"), "generated nox env\n");
    fs.writeFileSync(path.join(repoRoot, ".mypy_cache", "3.12", "service.data.json"), "{}\n");
    fs.writeFileSync(path.join(repoRoot, ".nuxt", "manifest.json"), "{}\n");
    fs.writeFileSync(path.join(repoRoot, ".pixi", "envs", "lock.json"), "{}\n");
    fs.writeFileSync(path.join(repoRoot, ".sandbox", "home", ".onemount-tests", "state.json"), "{}\n");
    fs.writeFileSync(path.join(repoRoot, ".onemount-tests", "state.json"), "{}\n");
    fs.writeFileSync(path.join(repoRoot, "cmake-build-debug", "CMakeCache.txt"), "generated\n");
    fs.writeFileSync(path.join(repoRoot, "Dockerfile"), "FROM node:24-alpine\n");
    fs.writeFileSync(path.join(repoRoot, "node_modules", "pkg", "index.js"), "module.exports = {};\n");
    fs.writeFileSync(path.join(repoRoot, "vendor", "dep", "dep.go"), "package dep\n");
    fs.writeFileSync(path.join(repoRoot, "src", "3rdParty", "dep", "dep.cpp"), "int dep = 1;\n");
    fs.writeFileSync(path.join(repoRoot, "libs", "nested-repo", ".git", "HEAD"), "ref: refs/heads/main\n");
    fs.writeFileSync(path.join(repoRoot, "libs", "nested-repo", "foreign.py"), "print('foreign')\n");
    fs.writeFileSync(path.join(repoRoot, "test-artifacts", "logs", "integration.log"), "generated log\n");
  });

  afterEach(() => {
    fs.chmodSync(repoRoot, 0o700);
    for (const directory of [
      path.join(repoRoot, "runtime-data"),
      path.join(repoRoot, "runtime-data", "diagnostic.data")
    ]) {
      if (fs.existsSync(directory)) {
        fs.chmodSync(directory, 0o700);
      }
    }
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("scans repo files into language-neutral capability entries", async () => {
    const scanner = new FileCatalogScannerAdapter();
    const result = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 100
    });

    expect(result.truncated).toBe(false);
    for (const rubyAnchor of ["Gemfile", "Rakefile", ".ruby-version"]) {
      expect(result.files.find((file) => file.path === rubyAnchor)?.adapter_evidence).toMatchObject({
        domain: "package_manager",
        name: "ruby",
        capability_level: "resource_backed"
      });
    }
    expect(result.files.find((file) => file.path === "config.ru")?.adapter_evidence).toMatchObject({
      domain: "framework",
      name: "rails",
      capability_level: "resource_backed"
    });
    expect(result.skipped_roots).toEqual([...DEFAULT_SKIPPED_ROOTS].sort());
    expect(result.files.map((file) => file.path)).toEqual([
      ".github/workflows/ci.yml",
      ".ruby-version",
      "config.ru",
      "Dockerfile",
      "Gemfile",
      "package.json",
      "Rakefile",
      "src/app.ts",
      "src/service.py"
    ]);
    expect(result.files.map((file) => file.path)).not.toEqual(
      expect.arrayContaining([
        ".home/.onemount-tests/state.json",
        ".sandbox/home/.onemount-tests/state.json",
        ".onemount-tests/state.json",
        "test-artifacts/logs/integration.log",
        ".direnv/state",
        ".gradle/caches/module.bin",
        ".nox/unit/python",
        "vendor/dep/dep.go",
        "src/3rdParty/dep/dep.cpp",
        "libs/nested-repo/foreign.py"
      ])
    );
    expect(result.skipped_paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "node_modules",
          reason: "generated_or_vendor"
        }),
        expect.objectContaining({
          path: "vendor",
          reason: "generated_or_vendor"
        }),
        expect.objectContaining({
          path: "libs/nested-repo",
          reason: "nested_git_repository"
        })
      ])
    );
    expect(result.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "src/service.py",
          adapter_evidence: expect.objectContaining({
            domain: "language",
            name: "python",
            capability_level: "partial_semantic"
          })
        }),
        expect.objectContaining({
          path: "src/app.ts",
          adapter_evidence: expect.objectContaining({
            domain: "language",
            name: "typescript",
            capability_level: "partial_semantic",
            evidence_kinds: ["parser"]
          })
        }),
        expect.objectContaining({
          path: ".github/workflows/ci.yml",
          adapter_evidence: expect.objectContaining({
            domain: "infrastructure",
            name: "yaml",
            capability_level: "resource_backed"
          })
        })
      ])
    );
  });

  it("reports truncation without expanding beyond the explicit file budget", async () => {
    const scanner = new FileCatalogScannerAdapter();
    const result = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 2
    });

    expect(result.truncated).toBe(true);
    expect(result.files).toHaveLength(2);
  });

  it("admits explicit priority files before normal scan candidates", async () => {
    const scopedRoot = path.join(repoRoot, "scanner-priority");
    fs.mkdirSync(path.join(scopedRoot, "config"), { recursive: true });
    fs.mkdirSync(path.join(scopedRoot, "noise"), { recursive: true });
    fs.writeFileSync(path.join(scopedRoot, "config", "routes.rb"), "Rails.application.routes.draw do\nend\n");
    fs.writeFileSync(path.join(scopedRoot, "noise", "alpha.md"), "# alpha\n");
    fs.writeFileSync(path.join(scopedRoot, "noise", "beta.md"), "# beta\n");

    const scanner = new FileCatalogScannerAdapter();
    const result = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["scanner-priority"],
      skipped_roots: [],
      max_files: 2,
      priority_paths: ["scanner-priority/config/routes.rb"]
    });

    const paths = result.files.map((file) => file.path);
    expect(paths).toEqual([
      "scanner-priority/config/routes.rb",
      "scanner-priority/noise/alpha.md"
    ]);
    expect(result.truncated).toBe(true);
    expect(result.continuation_cursor).toBe("scanner-priority/noise/alpha.md");
  });

  it("supports deterministic resumable chunks and avoids duplicate admitted paths", async () => {
    const scopedRoot = path.join(repoRoot, "scanner-chunks");
    fs.mkdirSync(path.join(scopedRoot, "config"), { recursive: true });
    fs.writeFileSync(path.join(scopedRoot, "config", "routes.rb"), "Rails.application.routes.draw do\nend\n");
    fs.writeFileSync(path.join(scopedRoot, "config", "database.rb"), "ActiveRecord::Base\n");
    fs.writeFileSync(path.join(scopedRoot, "alpha.rb"), "# alpha\n");
    fs.writeFileSync(path.join(scopedRoot, "beta.rb"), "# beta\n");
    fs.writeFileSync(path.join(scopedRoot, "gamma.rb"), "# gamma\n");

    const scanner = new FileCatalogScannerAdapter();
    const priorityPaths = [
      "scanner-chunks/config/routes.rb",
      "scanner-chunks/config/database.rb"
    ];
    const first = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["scanner-chunks"],
      skipped_roots: [],
      max_files: 2,
      priority_paths: priorityPaths
    });
    expect(first.files.map((file) => file.path)).toEqual([
      "scanner-chunks/config/routes.rb",
      "scanner-chunks/config/database.rb"
    ]);
    expect(first.truncated).toBe(true);
    expect(first.continuation_cursor).toBe("scanner-chunks/config/database.rb");

    const second = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["scanner-chunks"],
      skipped_roots: [],
      max_files: 2,
      priority_paths: priorityPaths,
      after_path: first.continuation_cursor
    });
    expect(second.files.map((file) => file.path)).toEqual([
      "scanner-chunks/alpha.rb",
      "scanner-chunks/beta.rb"
    ]);
    expect(second.truncated).toBe(true);
    expect(second.continuation_cursor).toBe("scanner-chunks/beta.rb");

    const third = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["scanner-chunks"],
      skipped_roots: [],
      max_files: 2,
      priority_paths: priorityPaths,
      after_path: second.continuation_cursor
    });
    expect(third.files.map((file) => file.path)).toEqual(["scanner-chunks/gamma.rb"]);
    expect(third.truncated).toBe(false);
    expect(third.continuation_cursor).toBeUndefined();

    const allFiles = [
      ...first.files.map((file) => file.path),
      ...second.files.map((file) => file.path),
      ...third.files.map((file) => file.path)
    ];
    expect(new Set(allFiles).size).toBe(5);
    expect(allFiles).toEqual(expect.arrayContaining([
      "scanner-chunks/config/routes.rb",
      "scanner-chunks/config/database.rb",
      "scanner-chunks/alpha.rb",
      "scanner-chunks/beta.rb",
      "scanner-chunks/gamma.rb"
    ]));
  });

  it("prioritizes discovered files by caller supplied path patterns before row cap", async () => {
    const scopedRoot = path.join(repoRoot, "scanner-pattern-priority");
    fs.mkdirSync(path.join(scopedRoot, "a", "config", "routes"), { recursive: true });
    fs.mkdirSync(path.join(scopedRoot, "b"), { recursive: true });
    fs.writeFileSync(path.join(scopedRoot, "a", "config", "routes", "admin.rb"), "Rails.application.routes.draw do\nend\n");
    fs.writeFileSync(path.join(scopedRoot, "a", "config", "routes.rb"), "Rails.application.routes.draw do\nend\n");
    fs.writeFileSync(path.join(scopedRoot, "x.txt"), "x\n");
    fs.writeFileSync(path.join(scopedRoot, "y.txt"), "y\n");
    fs.writeFileSync(path.join(scopedRoot, "z.txt"), "z\n");
    fs.writeFileSync(path.join(scopedRoot, "b", "app.rb"), "class App; end\n");

    const scanner = new FileCatalogScannerAdapter();
    const result = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["scanner-pattern-priority"],
      skipped_roots: [],
      max_files: 2,
      priority_path_patterns: ["**/config/routes.rb", "**/config/routes/*.rb"]
    });

    expect(result.files.map((file) => file.path)).toEqual([
      "scanner-pattern-priority/a/config/routes.rb",
      "scanner-pattern-priority/a/config/routes/admin.rb"
    ]);
    expect(result.truncated).toBe(true);
    expect(result.continuation_cursor).toBe("scanner-pattern-priority/a/config/routes/admin.rb");
  });

  it("keeps prioritized route patterns stable across continuation", async () => {
    const scopedRoot = path.join(repoRoot, "scanner-pattern-continuation");
    fs.mkdirSync(path.join(scopedRoot, "engine", "config", "routes"), { recursive: true });
    fs.writeFileSync(path.join(scopedRoot, "engine", "config", "routes.rb"), "Rails.application.routes.draw do\nend\n");
    fs.writeFileSync(path.join(scopedRoot, "engine", "config", "routes", "admin.rb"), "Rails.application.routes.draw do\nend\n");
    fs.writeFileSync(path.join(scopedRoot, "engine", "config", "routes", "api.rb"), "Rails.application.routes.draw do\nend\n");
    fs.writeFileSync(path.join(scopedRoot, "core.rb"), "class Core; end\n");
    fs.writeFileSync(path.join(scopedRoot, "readme.md"), "# Core\n");
    fs.writeFileSync(path.join(scopedRoot, "script.rb"), "script\n");
    fs.writeFileSync(path.join(scopedRoot, "utils.rb"), "utils\n");

    const scanner = new FileCatalogScannerAdapter();
    const first = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["scanner-pattern-continuation"],
      skipped_roots: [],
      max_files: 2,
      priority_path_patterns: ["**/config/routes.rb", "**/config/routes/*.rb"]
    });

    expect(first.files.map((file) => file.path)).toEqual([
      "scanner-pattern-continuation/engine/config/routes.rb",
      "scanner-pattern-continuation/engine/config/routes/admin.rb"
    ]);

    const second = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["scanner-pattern-continuation"],
      skipped_roots: [],
      max_files: 2,
      priority_path_patterns: ["**/config/routes.rb", "**/config/routes/*.rb"],
      after_path: first.continuation_cursor
    });

    const third = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["scanner-pattern-continuation"],
      skipped_roots: [],
      max_files: 2,
      priority_path_patterns: ["**/config/routes.rb", "**/config/routes/*.rb"],
      after_path: second.continuation_cursor
    });
    const fourth = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["scanner-pattern-continuation"],
      skipped_roots: [],
      max_files: 2,
      priority_path_patterns: ["**/config/routes.rb", "**/config/routes/*.rb"],
      after_path: third.continuation_cursor
    });

    expect(second.files.map((file) => file.path)).toEqual([
      "scanner-pattern-continuation/engine/config/routes/api.rb",
      "scanner-pattern-continuation/core.rb"
    ]);
    expect(third.files.map((file) => file.path)).toEqual([
      "scanner-pattern-continuation/script.rb",
      "scanner-pattern-continuation/utils.rb"
    ]);
    expect(fourth.files.map((file) => file.path)).toEqual([
      "scanner-pattern-continuation/readme.md"
    ]);

    expect(fourth.continuation_cursor).toBeUndefined();
    expect(fourth.truncated).toBe(false);

    const allPaths = [
      ...first.files,
      ...second.files,
      ...third.files,
      ...fourth.files
    ].map((file) => file.path);
    const seenPaths = new Set(allPaths);
    expect(allPaths.length).toBe(seenPaths.size);
    expect(allPaths).toEqual(
      expect.arrayContaining([
        "scanner-pattern-continuation/engine/config/routes.rb",
        "scanner-pattern-continuation/engine/config/routes/admin.rb",
        "scanner-pattern-continuation/engine/config/routes/api.rb",
        "scanner-pattern-continuation/core.rb",
        "scanner-pattern-continuation/script.rb",
        "scanner-pattern-continuation/utils.rb",
        "scanner-pattern-continuation/readme.md"
      ])
    );
  });

  it("throws when the continuation cursor is missing from the scan sequence", async () => {
    const scopedRoot = path.join(repoRoot, "scanner-missing-cursor");
    fs.mkdirSync(scopedRoot, { recursive: true });
    fs.writeFileSync(path.join(scopedRoot, "a.rb"), "# a\n");

    const scanner = new FileCatalogScannerAdapter();
    await expect(
      scanner.scan({
        repo_root: repoRoot,
        indexed_roots: ["scanner-missing-cursor"],
        skipped_roots: [],
        max_files: 2,
        after_path: "scanner-missing-cursor/does-not-exist.rb"
      })
    ).rejects.toThrow("continuation cursor");
  });

  it("ignores ignored priority paths and continues normal admission order", async () => {
    const scopedRoot = path.join(repoRoot, "scanner-ignored-priority");
    fs.mkdirSync(scopedRoot, { recursive: true });
    fs.writeFileSync(path.join(scopedRoot, ".env"), "SECRET=redacted\n");
    fs.writeFileSync(path.join(scopedRoot, "app.rb"), "class App; end\n");

    const scanner = new FileCatalogScannerAdapter();
    const result = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["scanner-ignored-priority"],
      skipped_roots: [],
      max_files: 10,
      priority_paths: ["scanner-ignored-priority/.env"]
    });

    expect(result.files.map((file) => file.path)).not.toContain("scanner-ignored-priority/.env");
    expect(result.files.map((file) => file.path)).toContain("scanner-ignored-priority/app.rb");
    expect(result.skipped_paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "scanner-ignored-priority/.env",
          reason: "secret"
        })
      ])
    );
  });

  it("replays the same continuation cursor deterministically", async () => {
    const scopedRoot = path.join(repoRoot, "scanner-stable-replay");
    fs.mkdirSync(scopedRoot, { recursive: true });
    fs.writeFileSync(path.join(scopedRoot, "z.rb"), "# z\n");
    fs.writeFileSync(path.join(scopedRoot, "y.rb"), "# y\n");
    fs.writeFileSync(path.join(scopedRoot, "x.rb"), "# x\n");

    const scanner = new FileCatalogScannerAdapter();
    const first = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["scanner-stable-replay"],
      skipped_roots: [],
      max_files: 1
    });
    const replayed = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["scanner-stable-replay"],
      skipped_roots: [],
      max_files: 1,
      after_path: first.continuation_cursor
    });
    const replayedAgain = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["scanner-stable-replay"],
      skipped_roots: [],
      max_files: 1,
      after_path: first.continuation_cursor
    });

    expect(replayed.files).toEqual(replayedAgain.files);
    expect(replayed.continuation_cursor).toBe(replayedAgain.continuation_cursor);
  });

  it("skips unreadable directories without aborting catalog scans", async () => {
    const unreadableRoot = path.join(repoRoot, "runtime-data", "diagnostic.data");
    fs.mkdirSync(unreadableRoot, { recursive: true });
    fs.writeFileSync(path.join(unreadableRoot, "state.json"), "{}\n");
    fs.chmodSync(unreadableRoot, 0);

    const scanner = new FileCatalogScannerAdapter();
    const result = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 100
    });

    expect(result.files.map((file) => file.path)).toContain("src/service.py");
    expect(result.files.map((file) => file.path)).not.toContain("runtime-data/diagnostic.data/state.json");
    expect(result.skipped_roots).toContain("runtime-data/diagnostic.data");
    expect(result.skipped_paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "runtime-data/diagnostic.data",
          reason: "permission_denied"
        })
      ])
    );
  });

  it("skips hidden paths by default while preserving allowlisted repository config", async () => {
    fs.mkdirSync(path.join(repoRoot, ".devcontainer"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".vscode"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".hidden-runtime"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, ".devcontainer", "devcontainer.json"), "{\"name\":\"fixture\"}\n");
    fs.writeFileSync(path.join(repoRoot, ".editorconfig"), "root = true\n");
    fs.writeFileSync(path.join(repoRoot, ".env"), "TOKEN=secret\n");
    fs.writeFileSync(path.join(repoRoot, ".env.local"), "TOKEN=secret\n");
    fs.writeFileSync(path.join(repoRoot, ".env.example"), "TOKEN=\n");
    fs.writeFileSync(path.join(repoRoot, ".gitignore"), "debug.log\n");
    fs.writeFileSync(path.join(repoRoot, ".vscode", "settings.json"), "{}\n");
    fs.writeFileSync(path.join(repoRoot, ".hidden-runtime", "state.json"), "{}\n");

    const scanner = new FileCatalogScannerAdapter();
    const result = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 100
    });
    const paths = result.files.map((file) => file.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        ".devcontainer/devcontainer.json",
        ".editorconfig",
        ".env.example",
        ".gitignore"
      ])
    );
    expect(paths).not.toEqual(
      expect.arrayContaining([
        ".env",
        ".env.local",
        ".vscode/settings.json",
        ".hidden-runtime/state.json"
      ])
    );
    expect(result.skipped_paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ".env",
          reason: "secret"
        }),
        expect.objectContaining({
          path: ".vscode",
          reason: "hidden_path"
        })
      ])
    );
  });

  it("uses root gitignore as an additional skip signal with negation support", async () => {
    fs.writeFileSync(path.join(repoRoot, ".gitignore"), "*.log\n!keep.log\nignored-dir/\n");
    fs.writeFileSync(path.join(repoRoot, "debug.log"), "debug\n");
    fs.writeFileSync(path.join(repoRoot, "keep.log"), "keep\n");
    fs.mkdirSync(path.join(repoRoot, "ignored-dir"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "ignored-dir", "state.json"), "{}\n");

    const scanner = new FileCatalogScannerAdapter();
    const result = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 100
    });
    const paths = result.files.map((file) => file.path);

    expect(paths).toContain(".gitignore");
    expect(paths).toContain("keep.log");
    expect(paths).not.toContain("debug.log");
    expect(paths).not.toContain("ignored-dir/state.json");
    expect(result.skipped_paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "debug.log",
          reason: "gitignore"
        }),
        expect.objectContaining({
          path: "ignored-dir",
          reason: "gitignore"
        })
      ])
    );
  });

  it("uses root aiignore as an additional skip signal", async () => {
    fs.writeFileSync(path.join(repoRoot, ".aiignore"), "scratch/\n*.prompt.log\n!keep.prompt.log\n");
    fs.mkdirSync(path.join(repoRoot, "scratch"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "scratch", "notes.md"), "# Scratch\n");
    fs.writeFileSync(path.join(repoRoot, "run.prompt.log"), "prompt trace\n");
    fs.writeFileSync(path.join(repoRoot, "keep.prompt.log"), "kept trace\n");

    const scanner = new FileCatalogScannerAdapter();
    const result = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 100
    });
    const paths = result.files.map((file) => file.path);

    expect(paths).toContain(".aiignore");
    expect(paths).toContain("keep.prompt.log");
    expect(paths).not.toContain("scratch/notes.md");
    expect(paths).not.toContain("run.prompt.log");
    expect(result.skipped_paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "scratch",
          reason: "gitignore"
        }),
        expect.objectContaining({
          path: "run.prompt.log",
          reason: "gitignore"
        })
      ])
    );
  });

  it("preserves representative source coverage before docs noise when row-capped", async () => {
    fs.mkdirSync(path.join(repoRoot, "aaa-docs"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "cmd", "service"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "aaa-docs", "000-overview.md"), "# Overview\n");
    fs.writeFileSync(path.join(repoRoot, "aaa-docs", "001-notes.md"), "# Notes\n");
    fs.writeFileSync(path.join(repoRoot, "go.mod"), "module example.com/service\n");
    fs.writeFileSync(path.join(repoRoot, "cmd", "service", "main.go"), "package main\nfunc main() {}\n");

    const scanner = new FileCatalogScannerAdapter();
    const result = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 2
    });

    expect(result.truncated).toBe(true);
    expect(result.files).toHaveLength(2);
    expect(result.files.map((file) => file.path)).toContain("cmd/service/main.go");
    expect(result.files.map((file) => file.file_identity.language)).toContain("go");
  });

  it("classifies first-slice Go, C++ header, and Python stub files while skipping Go cache", async () => {
    fs.writeFileSync(path.join(repoRoot, "go.mod"), "module example.com/onemount\n");
    fs.writeFileSync(path.join(repoRoot, "src", "main.go"), "package main\nfunc main() {}\n");
    fs.writeFileSync(path.join(repoRoot, "src", "DocumentObject.h"), "class DocumentObject {};\n");
    fs.writeFileSync(path.join(repoRoot, "src", "DocumentObject.cpp"), "#include \"DocumentObject.h\"\n");
    fs.writeFileSync(path.join(repoRoot, "src", "DocumentObject.pyi"), "class DocumentObject: ...\n");

    const scanner = new FileCatalogScannerAdapter();
    const result = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 100
    });

    expect(result.files.map((file) => file.path)).not.toContain(".gocache/cache-a");
    expect(result.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "src/main.go",
          file_identity: expect.objectContaining({ language: "go" })
        }),
        expect.objectContaining({
          path: "src/DocumentObject.h",
          file_identity: expect.objectContaining({ language: "cpp" })
        }),
        expect.objectContaining({
          path: "src/DocumentObject.cpp",
          file_identity: expect.objectContaining({ language: "cpp" })
        }),
        expect.objectContaining({
          path: "src/DocumentObject.pyi",
          file_identity: expect.objectContaining({ language: "python" })
        })
      ])
    );
  });

  it("classifies .NET project/source files while skipping generated build outputs", async () => {
    const scanner = new FileCatalogScannerAdapter();
    const result = await scanner.scan({
      repo_root: path.resolve("tests/fixtures/fixture-dotnet-web-repo"),
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 200
    });
    const paths = result.files.map((file) => file.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        "ModenaFixture.sln",
        "src/WebApi/WebApi.csproj",
        "src/WebApi/Program.cs",
        "src/WebApi/Controllers/OrdersController.cs",
        "src/WebApp/Pages/Index.razor",
        "tests/WebApi.Tests/WebApi.Tests.csproj"
      ])
    );
    expect(paths).not.toEqual(
      expect.arrayContaining([
        "src/WebApi/bin/Debug/net8.0/WebApi.dll",
        "src/WebApi/bin/Release/net8.0/publish/WebApi.exe",
        "src/WebApi/obj/Debug/net8.0/WebApi.AssemblyInfo.cs",
        "src/WebApi/obj/Release/net8.0/staticwebassets.build.json",
        "TestResults/abc/results.trx",
        "packages/Foo/Foo.1.0.0.nupkg",
        "publish/wwwroot/site.css.map"
      ])
    );
    expect(result.skipped_paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "TestResults",
          reason: "generated_or_vendor"
        }),
        expect.objectContaining({
          path: "publish",
          reason: "generated_or_vendor"
        }),
        expect.objectContaining({
          path: "packages/Foo/Foo.1.0.0.nupkg",
          reason: "generated_or_vendor"
        })
      ])
    );
    expect(result.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "src/WebApi/Controllers/OrdersController.cs",
          file_identity: expect.objectContaining({ language: "csharp" }),
          adapter_evidence: expect.objectContaining({
            capability_level: "resource_backed"
          })
        }),
        expect.objectContaining({
          path: "src/WebApi/WebApi.csproj",
          adapter_evidence: expect.objectContaining({
            domain: "package_manager",
            name: "dotnet",
            capability_level: "resource_backed"
          })
        })
      ])
    );
  });

  it("covers first-read fixture modes for unsupported, skipped, and budget-truncated evidence", async () => {
    const fixtureRoot = path.resolve("tests/fixtures/fixture-first-read-failure-modes");
    const scanner = new FileCatalogScannerAdapter();
    const full = await scanner.scan({
      repo_root: fixtureRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 100
    });
    const budgeted = await scanner.scan({
      repo_root: fixtureRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 1
    });

    expect(full.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "src/Main.java",
          file_identity: expect.objectContaining({ language: "java" }),
          adapter_evidence: expect.objectContaining({
            domain: "language",
            capability_level: "unsupported"
          })
        })
      ])
    );
    expect(full.skipped_paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "dist",
          reason: "generated_or_vendor"
        }),
        expect.objectContaining({
          path: "vendor",
          reason: "generated_or_vendor"
        })
      ])
    );
    expect(budgeted.truncated).toBe(true);
    expect(budgeted.files).toHaveLength(1);
  });

  it("does not read file contents while building status catalog evidence", async () => {
    const scanner = new FileCatalogScannerAdapter({
      fileIdentity: {
        async compute() {
          throw new Error("content hashing should not run during catalog scan");
        },
        async inferLanguage({ path: filePath }) {
          return filePath.endsWith(".py") ? "python" : "text";
        },
        async isSkipped() {
          return false;
        }
      }
    });

    const result = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["src"],
      skipped_roots: [],
      max_files: 100
    });

    expect(result.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "src/service.py",
          file_identity: expect.objectContaining({
            content_hash: expect.stringMatching(/^stat:/)
          })
        })
      ])
    );
  });

  it("counts exact skipped-path population after raw compatibility retention fills", async () => {
    for (let index = 0; index < 125; index += 1) {
      fs.mkdirSync(path.join(repoRoot, `cmake-build-${String(index).padStart(3, "0")}`));
    }
    const result = await new FileCatalogScannerAdapter().scan({
      repo_root: repoRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 100
    });

    expect(result.skipped_paths).toHaveLength(100);
    const generated = result.skipped_path_population.groups.find(
      (group) => group.reason === "generated_or_vendor"
    );
    expect(generated).toMatchObject({
      count: expect.any(Number),
      sample_paths: [".claude", ".codex", ".direnv"],
      sample_truncated: true
    });
    expect(generated?.count).toBeGreaterThanOrEqual(125);
    expect(result.skipped_path_population.total_count).toBe(
      result.skipped_path_population.groups.reduce((sum, group) => sum + group.count, 0)
    );
  });

  it("federates admitted submodule scans under child-local ignore rules and keeps unrelated nested repos refused", async () => {
    fs.mkdirSync(path.join(repoRoot, "modules", "app", ".git"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "modules", "app", "src"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "modules", "foreign", ".git"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, ".gitignore"), "modules/app/ignored-by-parent.ts\n");
    fs.writeFileSync(path.join(repoRoot, "modules", "app", ".gitignore"), "ignored-by-child.ts\n");
    fs.writeFileSync(path.join(repoRoot, "modules", "app", "ignored-by-parent.ts"), "export const parentIgnored = false;\n");
    fs.writeFileSync(path.join(repoRoot, "modules", "app", "ignored-by-child.ts"), "export const childIgnored = true;\n");
    fs.writeFileSync(path.join(repoRoot, "modules", "app", "src", "keep.ts"), "export const keep = true;\n");
    fs.writeFileSync(path.join(repoRoot, "modules", "foreign", "foreign.ts"), "export const foreign = true;\n");

    const scanner = new FileCatalogScannerAdapter();
    const result = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 100,
      repository_composition: {
        repositories: [
          {
            path_prefix: ".",
            state: "superproject",
            source_available: true
          },
          {
            path_prefix: "modules/app",
            state: "initialized",
            source_available: true,
            declaration_path: ".gitmodules",
            head_gitlink_oid: "abc123"
          }
        ]
      }
    });

    expect(result.files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        "modules/app/.gitignore",
        "modules/app/ignored-by-parent.ts",
        "modules/app/src/keep.ts"
      ])
    );
    expect(result.files.map((file) => file.path)).not.toEqual(
      expect.arrayContaining([
        "modules/app/ignored-by-child.ts",
        "modules/foreign/foreign.ts"
      ])
    );
    expect(result.skipped_paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "modules/app/ignored-by-child.ts",
          reason: "gitignore"
        }),
        expect.objectContaining({
          path: "modules/foreign",
          reason: "nested_git_repository"
        })
      ])
    );
  });
});
