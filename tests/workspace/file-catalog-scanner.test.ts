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
    expect(result.skipped_roots).toEqual([...DEFAULT_SKIPPED_ROOTS].sort());
    expect(result.files.map((file) => file.path)).toEqual([
      ".github/workflows/ci.yml",
      "Dockerfile",
      "package.json",
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
        "src/WebApi/obj/Debug/net8.0/WebApi.AssemblyInfo.cs",
        "TestResults/abc/results.trx"
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
