import path from "node:path";
import { describe, expect, it } from "vitest";
import packageJson from "../../package.json" with { type: "json" };
import {
  resolveDebugMcpUseCaseConfig,
  resolveProfileOutputPath,
  runDebugMcpUseCase
} from "../../src/debug/mcp-use-case.js";
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

    const publicSurfaceNames = [...mcpResources, ...mcpTools, ...mcpPrompts].map((surface) => surface.name);
    expect(publicSurfaceNames).not.toContain("debug:mcp-status");
    expect(publicSurfaceNames).not.toContain("debug:mcp-use-case");
    expect(publicSurfaceNames).not.toContain("debug:mcp-profile");
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
    expect(resolveProfileOutputPath(config)).toContain(path.join(".cache", "profiles", "context-"));
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

    expect(status.contract_version).toBe("0.1");
    expect(status.meta.scope.repo_root).toBe(targetRepo);
    expect(scope.meta.scope.repo_root).toBe(targetRepo);
    expect(context.meta.scope.repo_root).toBe(targetRepo);
    expect(JSON.stringify(status)).toContain("adapter_coverage");
    expect(JSON.stringify(scope)).toContain("capability_counts");
    expect(JSON.stringify(context)).toContain("requested_files");
  });
});
