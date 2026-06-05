import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { describe, expect, it } from "vitest";
import packageJson from "../../package.json" with { type: "json" };
import {
  resolveDebugMcpUseCaseConfig,
  resolveProfileOutputPath,
  runDebugMcpUseCase
} from "../../src/debug/mcp-use-case.js";
import {
  resolveSampleSmokeConfig,
  runSampleSmoke,
  writeSampleSmokeReport
} from "../../src/debug/sample-smoke.js";
import {
  mcpPrompts,
  mcpResources,
  mcpTools
} from "../../src/interface-adapters/mcp/registries/index.js";

describe("repo-local MCP debug harness", () => {
  it("is exposed only through package scripts", () => {
    expect(packageJson.scripts["debug:mcp-status"]).toBe("tsx src/debug/mcp-status.ts");
    expect(packageJson.scripts["debug:mcp-use-case"]).toBe("tsx src/debug/mcp-use-case.ts");
    expect(packageJson.scripts["debug:mcp-profile"]).toBe("tsx src/debug/mcp-use-case.ts --profile");
    expect(packageJson.scripts["debug:sample-smoke"]).toBe("tsx src/debug/sample-smoke.ts");

    const publicSurfaceNames = [...mcpResources, ...mcpTools, ...mcpPrompts].map((surface) => surface.name);
    expect(publicSurfaceNames).not.toContain("debug:mcp-status");
    expect(publicSurfaceNames).not.toContain("debug:mcp-use-case");
    expect(publicSurfaceNames).not.toContain("debug:mcp-profile");
    expect(publicSurfaceNames).not.toContain("debug:sample-smoke");
    expect(publicSurfaceNames).not.toContain("mcp_use_case");
  });

  it("refuses to resolve outside this repository checkout", () => {
    expect(() =>
      resolveDebugMcpUseCaseConfig({
        argv: ["status", "."],
        cwd: path.resolve("tests/fixtures/fixture-basic-python")
      })
    ).toThrow("Debug MCP harness must be run from the agent-workbench repository.");
  });

  it("resolves CPU profile output without changing public MCP contracts", () => {
    const targetRepo = path.resolve("tests/fixtures/fixture-mixed-language-platform");
    const config = resolveDebugMcpUseCaseConfig({
      argv: ["context", targetRepo, "--task", "Profile context", "--file", "package.json", "--profile"],
      cwd: process.cwd()
    });

    expect(config).toMatchObject({
      useCase: "context",
      targetRepo,
      task: "Profile context",
      files: ["package.json"],
      profile: true
    });
    expect(resolveProfileOutputPath(config)).toContain(path.join(".tmp", "profiles", "context-"));
  });

  it("runs bounded MCP-adjacent use cases against arbitrary target repos", async () => {
    const targetRepo = path.resolve("tests/fixtures/fixture-mixed-language-platform");
    const status = await runDebugMcpUseCase({
      useCase: "status",
      targetRepo,
      task: "Inspect repository status.",
      files: []
    });
    const scope = await runDebugMcpUseCase({
      useCase: "scope",
      targetRepo,
      task: "Inspect repository scope.",
      files: []
    });
    const context = await runDebugMcpUseCase({
      useCase: "context",
      targetRepo,
      task: "Update package validation",
      files: ["package.json"]
    });
    const verification = await runDebugMcpUseCase({
      useCase: "verification",
      targetRepo,
      task: "Validate package change",
      files: ["package.json"]
    });

    expect(status.contract_version).toBe("0.1");
    expect(status.meta.scope.repo_root).toBe(targetRepo);
    expect(scope.meta.scope.repo_root).toBe(targetRepo);
    expect(context.meta.scope.repo_root).toBe(targetRepo);
    expect(verification.meta.scope.repo_root).toBe(targetRepo);
    expect(JSON.stringify(status)).toContain("adapter_coverage");
    expect(JSON.stringify(scope)).toContain("capability_counts");
    expect(JSON.stringify(context)).toContain("requested_files");
    expect(JSON.stringify(verification)).toContain("planned_commands");
  });

  it("runs sample smoke reports into .tmp without modifying target repos", async () => {
    const outputDir = path.resolve(".tmp", "test-sample-smoke", String(Date.now()));
    const targetRepo = path.resolve("tests/fixtures/fixture-mixed-language-platform");
    const before = snapshotDirectory(targetRepo);
    try {
      const config = resolveSampleSmokeConfig({
        argv: ["--repo", targetRepo, "--output-dir", outputDir, "--context"],
        cwd: process.cwd()
      });
      expect(config.outputDir).toBe(outputDir);
      expect(config.repos).toEqual([targetRepo]);

      const report = await runSampleSmoke(config);
      const outputPath = writeSampleSmokeReport({ report, outputDir });
      const parsed = JSON.parse(fs.readFileSync(outputPath, "utf8")) as {
        repo_count: number;
        passed: number;
        results: Array<{ repo_root: string; status: string; envelopes?: Record<string, unknown> }>;
      };

      expect(outputPath.startsWith(outputDir)).toBe(true);
      expect(parsed.repo_count).toBe(1);
      expect(parsed.passed).toBe(1);
      expect(parsed.results[0]).toMatchObject({
        repo_root: targetRepo,
        status: "passed"
      });
      expect(parsed.results[0]?.envelopes).toHaveProperty("status");
      expect(parsed.results[0]?.envelopes).toHaveProperty("scope");
      expect(parsed.results[0]?.envelopes).toHaveProperty("overview");
      expect(parsed.results[0]?.envelopes).toHaveProperty("context");
      expect(snapshotDirectory(targetRepo)).toEqual(before);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("discovers git repos below an explicit sample root with a bounded max", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-sample-root-"));
    try {
      fs.mkdirSync(path.join(root, "one", ".git"), { recursive: true });
      fs.mkdirSync(path.join(root, "two", ".git"), { recursive: true });
      fs.writeFileSync(path.join(root, "one", ".git", "HEAD"), "ref: refs/heads/main\n");
      fs.writeFileSync(path.join(root, "two", ".git", "HEAD"), "ref: refs/heads/main\n");

      const config = resolveSampleSmokeConfig({
        argv: ["--root", root, "--max", "1"],
        cwd: process.cwd(),
        homeDir: root
      });
      const report = await runSampleSmoke(config);

      expect(report.repo_count).toBe(1);
      expect(report.results[0]?.repo_root.startsWith(root)).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

function snapshotDirectory(directory: string): string[] {
  return fs
    .readdirSync(directory, { recursive: true, withFileTypes: true })
    .map((entry) => path.relative(directory, path.join(entry.parentPath, entry.name)))
    .sort();
}
