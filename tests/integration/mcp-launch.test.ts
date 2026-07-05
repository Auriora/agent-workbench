/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// @ts-expect-error -- ESM .mjs shim imported into the TS test via esbuild.
import { planLaunch } from "../../plugins/agent-workbench/mcp-launch.mjs";
import {
  materializeCodexMcpConfig,
  resolveRuntimeRoot,
  runtimePointerPath,
  writeRuntimeRoot
  // @ts-expect-error -- ESM .mjs resolver imported into the TS test via esbuild.
} from "../../plugins/agent-workbench/install-root.mjs";

describe("mcp-launch shim planLaunch (spec 033)", () => {
  const root = "/install/root";
  const baseEnv = { AGENT_WORKBENCH_INSTALL_ROOT: root };
  const entry = path.join(root, "src", "mcp", "stdio-entrypoint.mjs");

  it("spawns node directly against <root>/src/mcp/stdio-entrypoint.mjs", () => {
    const plan = planLaunch(baseEnv, [], "/repo");
    expect(plan.command).toBe(process.execPath);
    expect(plan.args).toEqual([entry]);
    expect(plan.root).toBe(root);
  });

  it("does not force a cwd or use --import tsx (the entrypoint self-resolves tsx)", () => {
    const plan = planLaunch(baseEnv, [], "/repo");
    expect(plan.options.cwd).toBeUndefined();
    expect(plan.args).not.toContain("--import");
    expect(plan.args).not.toContain("tsx");
    expect(plan.options.stdio).toEqual(["pipe", "pipe", "pipe"]);
  });

  it("defaults AGENT_WORKBENCH_DEFAULT_REPO_ROOT to a workspace launch cwd when unset", () => {
    const plan = planLaunch(baseEnv, [], "/repo");
    expect(plan.options.env.AGENT_WORKBENCH_DEFAULT_REPO_ROOT).toBe("/repo");
  });

  it("does not derive the target repo root from PWD", () => {
    const plan = planLaunch({ ...baseEnv, PWD: "/workspace/repo" }, [], "/repo");
    expect(plan.options.env.AGENT_WORKBENCH_DEFAULT_REPO_ROOT).toBe("/repo");
  });

  it("allows plugin-cache launches when a fixed target repo root is explicit", () => {
    const cacheCwd = "/home/user/.codex/plugins/cache/agent-workbench-local/agent-workbench/0.3.0";
    const withEnv = planLaunch({ ...baseEnv, AGENT_WORKBENCH_DEFAULT_REPO_ROOT: "/workspace/repo" }, [], cacheCwd);
    const withArg = planLaunch(baseEnv, ["--repo-root", "/workspace/repo"], cacheCwd);

    expect(withEnv.options.env.AGENT_WORKBENCH_DEFAULT_REPO_ROOT).toBe("/workspace/repo");
    expect(withArg.options.env.AGENT_WORKBENCH_DEFAULT_REPO_ROOT).toBeUndefined();
    expect(withArg.args).toEqual([entry, "--repo-root", "/workspace/repo"]);
  });

  it("preserves an explicit AGENT_WORKBENCH_DEFAULT_REPO_ROOT", () => {
    const env = { ...baseEnv, AGENT_WORKBENCH_DEFAULT_REPO_ROOT: "/explicit/repo" };
    const plan = planLaunch(env, [], "/repo");
    expect(plan.options.env.AGENT_WORKBENCH_DEFAULT_REPO_ROOT).toBe("/explicit/repo");
  });

  it("passes through extra argv after the entry script", () => {
    const plan = planLaunch(baseEnv, ["--flag", "value"], "/repo");
    expect(plan.args).toEqual([entry, "--flag", "value"]);
  });

  it("does not invoke a shell (no bash / -lc anywhere in the plan)", () => {
    const plan = planLaunch(baseEnv, [], "/repo");
    expect(plan.command).not.toContain("bash");
    expect(plan.args).not.toContain("-lc");
  });

  it("throws an actionable error when the runtime root cannot be resolved", () => {
    expect(() => planLaunch({ HOME: "/nonexistent-runtime-root" }, [], "/repo")).toThrow(
      /runtime not found.*GitHub release tarball/s
    );
  });
});

describe("runtime-root pointer resolution (spec 033)", () => {
  let home: string;
  const env = (): NodeJS.ProcessEnv => ({ HOME: home });

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-runtime-root-"));
  });

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  it("writes the pointer under the per-OS state dir and reads it back", () => {
    const pointer = writeRuntimeRoot("/opt/pkg", env(), "linux");
    expect(pointer).toBe(runtimePointerPath(env(), "linux"));
    expect(fs.readFileSync(pointer, "utf8").trim()).toBe("/opt/pkg");
    expect(resolveRuntimeRoot(env(), "linux")).toBe("/opt/pkg");
  });

  it("lets AGENT_WORKBENCH_INSTALL_ROOT override the recorded pointer", () => {
    writeRuntimeRoot("/opt/pkg", env(), "linux");
    expect(resolveRuntimeRoot({ ...env(), AGENT_WORKBENCH_INSTALL_ROOT: "/checkout" }, "linux")).toBe(
      "/checkout"
    );
  });

  it("returns null when no override and no pointer file exist", () => {
    expect(resolveRuntimeRoot(env(), "linux")).toBeNull();
  });
});

describe("installed Codex MCP config materialization", () => {
  let packageRoot: string;

  beforeEach(() => {
    packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-package-root-"));
    fs.mkdirSync(path.join(packageRoot, "plugins", "agent-workbench"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(packageRoot, { recursive: true, force: true });
  });

  it("rewrites installed Codex MCP config to an absolute shim path without binding cwd", () => {
    const configPath = materializeCodexMcpConfig(packageRoot);
    const mcpConfig = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
      mcpServers: Record<string, { command: string; cwd?: string; args: string[]; startup_timeout_sec: number }>;
    };
    const server = mcpConfig.mcpServers["agent-workbench"];

    expect(server.command).toBe("node");
    expect(server.cwd).toBeUndefined();
    expect(server.args).toEqual([path.join(packageRoot, "plugins", "agent-workbench", "mcp-launch.mjs")]);
    expect(path.isAbsolute(server.args[0])).toBe(true);
    expect(server.startup_timeout_sec).toBe(30.0);
  });
});
