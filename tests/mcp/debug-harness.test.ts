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
  resolveToolSweepConfig,
  runMcpToolSweep,
  writeToolSweepReport
} from "../../src/debug/mcp-tool-sweep.js";
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
    expect(packageJson.scripts["debug:mcp-tool-sweep"]).toBe("tsx src/debug/mcp-tool-sweep.ts");

    const publicSurfaceNames = [...mcpResources, ...mcpTools, ...mcpPrompts].map((surface) => surface.name);
    expect(publicSurfaceNames).not.toContain("debug:mcp-status");
    expect(publicSurfaceNames).not.toContain("debug:mcp-use-case");
    expect(publicSurfaceNames).not.toContain("debug:mcp-profile");
    expect(publicSurfaceNames).not.toContain("debug:sample-smoke");
    expect(publicSurfaceNames).not.toContain("debug:mcp-tool-sweep");
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

  it("plans and runs the MCP tool sweep across every registered resource and tool", async () => {
    const outputDir = path.resolve(".tmp", "test-mcp-tool-sweep", String(Date.now()));
    const targetRepo = path.resolve("tests/fixtures/fixture-mcp-tool-sweep");
    const before = fileContentSnapshot(targetRepo);
    try {
      const config = resolveToolSweepConfig({
        argv: ["--repo", targetRepo, "--output-dir", outputDir, "--start-graph-warmup"],
        cwd: process.cwd()
      });
      expect(config).toMatchObject({
        repos: [targetRepo],
        output_dir: outputDir,
        start_graph_warmup: true
      });

      const report = await runMcpToolSweep(config);
      const outputPath = writeToolSweepReport({ report, outputDir });
      const parsed = JSON.parse(fs.readFileSync(outputPath, "utf8")) as typeof report;
      const resultsBySurface = new Map(parsed.results.map((result) => [`${result.kind}:${result.name}`, result]));

      expect(parsed.repo_count).toBe(1);
      expect(resultsBySurface.get("discovery:resources/list")).toMatchObject({ quality: "full" });
      expect(resultsBySurface.get("discovery:tools/list")).toMatchObject({ quality: "full" });
      for (const resource of mcpResources) {
        expect(resultsBySurface.get(`resource:${resource.name}`), resource.name).toBeDefined();
      }
      for (const tool of mcpTools) {
        expect(resultsBySurface.get(`tool:${tool.name}`), tool.name).toBeDefined();
      }
      expect(resultsBySurface.get("tool:preview_workspace_edit")).toMatchObject({
        status: "ok"
      });
      expect(resultsBySurface.get("tool:apply_workspace_edit")).toMatchObject({
        status: "ok"
      });
      expect(fileContentSnapshot(targetRepo)).toEqual(before);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("records skipped prerequisites as findings instead of omitting surfaces", async () => {
    const outputDir = path.resolve(".tmp", "test-mcp-tool-sweep-degraded", String(Date.now()));
    const targetRepo = path.resolve("tests/fixtures/fixture-degraded-tools");
    try {
      const report = await runMcpToolSweep({
        repos: [targetRepo],
        output_dir: outputDir,
        call_timeout_ms: 30_000,
        include_raw: false,
        start_graph_warmup: false
      });
      const symbolSearch = report.results.find((result) => result.kind === "tool" && result.name === "symbol_search");
      const docsSearch = report.results.find((result) => result.kind === "tool" && result.name === "docs_search");

      expect(symbolSearch).toBeDefined();
      expect(docsSearch).toBeDefined();
      expect(report.results.filter((result) => result.status === "failed")).toEqual([]);
      expect(report.results).toHaveLength(mcpResources.length + mcpTools.length + 2);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("skips workspace-write sweep calls for original external repositories", async () => {
    const outputDir = path.resolve(".tmp", "test-mcp-tool-sweep-external", String(Date.now()));
    const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-external-original-"));
    try {
      fs.writeFileSync(path.join(externalRoot, "README.md"), "# External Original\n");
      const report = await runMcpToolSweep({
        repos: [externalRoot],
        output_dir: outputDir,
        call_timeout_ms: 30_000,
        include_raw: false,
        start_graph_warmup: false
      });
      const preview = report.results.find((result) => result.kind === "tool" && result.name === "preview_workspace_edit");
      const apply = report.results.find((result) => result.kind === "tool" && result.name === "apply_workspace_edit");

      expect(preview).toMatchObject({
        status: "skipped",
        quality: "degraded"
      });
      expect(apply).toMatchObject({
        status: "skipped",
        quality: "degraded"
      });
      expect(JSON.stringify([preview, apply])).toContain("Agent Workbench-named /tmp sandbox");
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
      fs.rmSync(externalRoot, { recursive: true, force: true });
    }
  });

  it("selects sweep inputs from scanner-visible files instead of hidden or generated paths", async () => {
    const outputDir = path.resolve(".tmp", "test-mcp-tool-sweep-visible-inputs", String(Date.now()));
    const targetRepo = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-visible-inputs-"));
    try {
      fs.mkdirSync(path.join(targetRepo, ".codex", "skills", "hidden"), { recursive: true });
      fs.mkdirSync(path.join(targetRepo, "docs"), { recursive: true });
      fs.writeFileSync(path.join(targetRepo, ".codex", "skills", "hidden", "SKILL.md"), "# Hidden Skill\n");
      fs.writeFileSync(path.join(targetRepo, "docs", "guide.md"), "# Visible Guide\n\nBody.\n");
      fs.writeFileSync(path.join(targetRepo, "package.json"), "{\"name\":\"visible-inputs\"}\n");

      const report = await runMcpToolSweep({
        repos: [targetRepo],
        output_dir: outputDir,
        call_timeout_ms: 30_000,
        include_raw: true,
        start_graph_warmup: false
      });

      const markdownDocument = report.results.find(
        (result) => result.kind === "tool" && result.name === "check_markdown_document"
      );
      const verificationPlan = report.results.find(
        (result) => result.kind === "tool" && result.name === "verification_plan"
      );
      const rawMarkdown = markdownDocument?.raw_envelope as { data?: { path?: string } } | undefined;
      const rawVerification = verificationPlan?.raw_envelope as {
        data?: { planned_commands?: Array<{ args?: string[] }> };
      } | undefined;

      expect(rawMarkdown?.data?.path).toBe("docs/guide.md");
      expect(JSON.stringify(markdownDocument)).not.toContain(".codex");
      expect(JSON.stringify(verificationPlan)).not.toContain("not found in the scanned repository");
      expect(rawVerification?.data?.planned_commands?.flatMap((command) => command.args ?? [])).toContain("docs/guide.md");
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
      fs.rmSync(targetRepo, { recursive: true, force: true });
    }
  });

  it("does not classify successful findings as degraded sweep quality", async () => {
    const outputDir = path.resolve(".tmp", "test-mcp-tool-sweep-findings-quality", String(Date.now()));
    const targetRepo = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-findings-quality-"));
    try {
      fs.writeFileSync(path.join(targetRepo, "README.md"), "# Missing Frontmatter\n\nBody.\n");

      const report = await runMcpToolSweep({
        repos: [targetRepo],
        output_dir: outputDir,
        call_timeout_ms: 30_000,
        include_raw: true,
        start_graph_warmup: false
      });
      const markdownDocument = report.results.find(
        (result) => result.kind === "tool" && result.name === "check_markdown_document"
      );
      const rawMarkdown = markdownDocument?.raw_envelope as {
        data?: { status?: string; findings?: unknown[] };
        meta?: { verification_status?: string };
      } | undefined;

      expect(rawMarkdown?.data?.status).toBe("done");
      expect(rawMarkdown?.data?.findings?.length).toBeGreaterThan(0);
      expect(rawMarkdown?.meta?.verification_status).toBe("needed");
      expect(markdownDocument).toMatchObject({
        status: "ok",
        quality: "full"
      });
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
      fs.rmSync(targetRepo, { recursive: true, force: true });
    }
  });

  it("does not classify cursor-backed paginated results as partial sweep quality", async () => {
    const outputDir = path.resolve(".tmp", "test-mcp-tool-sweep-pagination-quality", String(Date.now()));
    const targetRepo = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-pagination-quality-"));
    try {
      fs.mkdirSync(path.join(targetRepo, "docs"), { recursive: true });
      for (let index = 0; index < 220; index += 1) {
        fs.writeFileSync(
          path.join(targetRepo, "docs", `page-${String(index).padStart(3, "0")}.md`),
          `# Page ${index}\n\nBody.\n`
        );
      }

      const report = await runMcpToolSweep({
        repos: [targetRepo],
        output_dir: outputDir,
        call_timeout_ms: 30_000,
        include_raw: true,
        start_graph_warmup: false
      });
      const docsMap = report.results.find(
        (result) => result.kind === "resource" && result.name === "docs-map"
      );
      const rawDocsMap = docsMap?.raw_envelope as {
        data?: { truncated?: boolean; cursor?: string };
      } | undefined;

      expect(rawDocsMap?.data?.truncated).toBe(true);
      expect(rawDocsMap?.data?.cursor).toEqual(expect.any(String));
      expect(docsMap).toMatchObject({
        status: "ok",
        quality: "full"
      });
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
      fs.rmSync(targetRepo, { recursive: true, force: true });
    }
  });
});

function snapshotDirectory(directory: string): string[] {
  return fs
    .readdirSync(directory, { recursive: true, withFileTypes: true })
    .map((entry) => path.relative(directory, path.join(entry.parentPath, entry.name)))
    .sort();
}

function fileContentSnapshot(directory: string): Record<string, string> {
  return Object.fromEntries(
    fs
      .readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const relative = path.relative(directory, path.join(entry.parentPath, entry.name));
        return [relative, fs.readFileSync(path.join(directory, relative), "utf8")];
      })
      .sort(([left], [right]) => left.localeCompare(right))
  );
}
