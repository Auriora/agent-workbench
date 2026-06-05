import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SKIPPED_ROOTS,
  FileCatalogScannerAdapter
} from "../../src/infrastructure/filesystem/index.js";

describe("file catalog scanner", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-scan-"));
    fs.mkdirSync(path.join(repoRoot, "src"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".github", "workflows"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".claude", "commands"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".codex", ".tmp"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".gocache"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".local"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".mypy_cache", "3.12"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".nuxt"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".pixi", "envs"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "cmake-build-debug"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "node_modules", "pkg"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "src", "__pycache__"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "src", "service.py"), "def handler():\n    return 'ok'\n");
    fs.writeFileSync(path.join(repoRoot, "src", "__pycache__", "service.cpython-312.pyc"), "compiled\n");
    fs.writeFileSync(path.join(repoRoot, "src", "app.ts"), "export const value = 'ok';\n");
    fs.writeFileSync(path.join(repoRoot, "package.json"), "{\"name\":\"fixture\"}\n");
    fs.writeFileSync(path.join(repoRoot, ".github", "workflows", "ci.yml"), "name: ci\n");
    fs.writeFileSync(path.join(repoRoot, ".claude", "commands", "review.md"), "local agent guidance\n");
    fs.writeFileSync(path.join(repoRoot, ".codex", ".tmp", "plugin.md"), "local plugin cache\n");
    fs.writeFileSync(path.join(repoRoot, ".gocache", "cache-a"), "generated go cache\n");
    fs.writeFileSync(path.join(repoRoot, ".local", "sample.json"), "{}\n");
    fs.writeFileSync(path.join(repoRoot, ".mypy_cache", "3.12", "service.data.json"), "{}\n");
    fs.writeFileSync(path.join(repoRoot, ".nuxt", "manifest.json"), "{}\n");
    fs.writeFileSync(path.join(repoRoot, ".pixi", "envs", "lock.json"), "{}\n");
    fs.writeFileSync(path.join(repoRoot, "cmake-build-debug", "CMakeCache.txt"), "generated\n");
    fs.writeFileSync(path.join(repoRoot, "Dockerfile"), "FROM node:24-alpine\n");
    fs.writeFileSync(path.join(repoRoot, "node_modules", "pkg", "index.js"), "module.exports = {};\n");
  });

  afterEach(() => {
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
    expect(result.skipped_roots).toEqual([...DEFAULT_SKIPPED_ROOTS].sort());
    expect(result.files.map((file) => file.path)).toEqual([
      ".github/workflows/ci.yml",
      "Dockerfile",
      "package.json",
      "src/app.ts",
      "src/service.py"
    ]);
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
            capability_level: "unsupported"
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
});
