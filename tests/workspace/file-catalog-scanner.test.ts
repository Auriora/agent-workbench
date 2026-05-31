import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileCatalogScannerAdapter } from "../../src/infrastructure/filesystem/index.js";

describe("file catalog scanner", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-scan-"));
    fs.mkdirSync(path.join(repoRoot, "src"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".github", "workflows"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "node_modules", "pkg"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "src", "__pycache__"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "src", "service.py"), "def handler():\n    return 'ok'\n");
    fs.writeFileSync(path.join(repoRoot, "src", "__pycache__", "service.cpython-312.pyc"), "compiled\n");
    fs.writeFileSync(path.join(repoRoot, "src", "app.ts"), "export const value = 'ok';\n");
    fs.writeFileSync(path.join(repoRoot, "package.json"), "{\"name\":\"fixture\"}\n");
    fs.writeFileSync(path.join(repoRoot, ".github", "workflows", "ci.yml"), "name: ci\n");
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
    expect(result.skipped_roots).toEqual([
      ".cache",
      ".git",
      ".pytest_cache",
      ".ruff_cache",
      "__pycache__",
      "coverage",
      "dist",
      "node_modules"
    ]);
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
