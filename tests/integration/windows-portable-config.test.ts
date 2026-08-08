/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// @ts-expect-error -- ESM .mjs shim imported into the TS test via esbuild.
import { runtimePointerPath } from "../../plugins/agent-workbench/install-root.mjs";

describe("portable Windows bundle configuration", () => {
  let tempRoot: string;
  let bundleRoot: string;
  let homeRoot: string;
  let codexHome: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-portable-config-"));
    bundleRoot = path.join(tempRoot, "agent-workbench-v9.8.7-windows-x64");
    homeRoot = path.join(tempRoot, "home");
    codexHome = path.join(tempRoot, "codex");
    fs.mkdirSync(homeRoot, { recursive: true });
    fs.mkdirSync(codexHome, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("writes pointer and portable Codex and Claude commands against the bundled node", () => {
    const packageRoot = createPortableFixture(bundleRoot);
    const result = runConfigure(bundleRoot, homeRoot, codexHome);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Configured portable Agent Workbench bundle");

    const bundledNodePath = path.join(bundleRoot, "node.exe");
    const codexMcp = readJson(path.join(packageRoot, "plugins", "agent-workbench", ".mcp.json")) as {
      mcpServers: Record<string, { command: string; args: string[]; env: Record<string, string> }>;
    };
    expect(codexMcp.mcpServers["agent-workbench"]).toMatchObject({
      command: bundledNodePath,
      args: [path.join(packageRoot, "plugins", "agent-workbench", "mcp-launch.mjs")],
      env: {
        AGENT_WORKBENCH_PROVIDER: "codex",
        AGENT_WORKBENCH_PROVIDER_PLUGIN_NAME: "agent-workbench",
        AGENT_WORKBENCH_PROVIDER_PLUGIN_VERSION: "9.8.7"
      }
    });

    const claudeMcp = readJson(
      path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", ".mcp.json")
    ) as {
      mcpServers: Record<string, { command: string; args: string[]; env: Record<string, string> }>;
    };
    expect(claudeMcp.mcpServers["agent-workbench"]).toMatchObject({
      command: bundledNodePath,
      args: [path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", "mcp-launch.mjs")],
      env: {
        AGENT_WORKBENCH_PROVIDER: "claude_code",
        AGENT_WORKBENCH_PROVIDER_PLUGIN_NAME: "agent-workbench",
        AGENT_WORKBENCH_PROVIDER_PLUGIN_VERSION: "9.8.7"
      }
    });

    const claudeHooks = readJson(
      path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", "hooks", "hooks.json")
    ) as {
      hooks: Record<string, Array<{ matcher: string; hooks: Array<{ command: string; args: string[] }> }>>;
    };
    expect(claudeHooks.hooks.SessionStart[0]).toMatchObject({
      matcher: "startup",
      hooks: [
        {
          command: bundledNodePath,
          args: [path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", "hooks", "session-start.js")]
        }
      ]
    });
    expect(claudeHooks.hooks.PostToolUse[0]).toMatchObject({
      matcher: "Write|Edit|MultiEdit|NotebookEdit",
      hooks: [
        {
          command: bundledNodePath,
          args: [path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", "hooks", "post-edit-feedback.js")]
        }
      ]
    });

    const codexHooks = readJson(path.join(codexHome, "hooks.json")) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string; commandWindows: string }> }>>;
    };
    const sessionHookCommand = codexHooks.hooks.SessionStart[0].hooks[0].command;
    const postEditHookCommand = codexHooks.hooks.PostToolUse[0].hooks[0].command;
    expect(sessionHookCommand).toContain(bundledNodePath);
    expect(sessionHookCommand).toContain(path.join(packageRoot, "plugins", "agent-workbench", "hooks", "session-start.js"));
    expect(postEditHookCommand).toContain(bundledNodePath);
    expect(postEditHookCommand).toContain(path.join(packageRoot, "plugins", "agent-workbench", "hooks", "post-edit-feedback.js"));
    expect(codexHooks.hooks.SessionStart[0].hooks[0].commandWindows).toContain(`"${bundledNodePath}"`);
    expect(codexHooks.hooks.PostToolUse[0].hooks[0].commandWindows).toContain(`"${bundledNodePath}"`);

    const pointerPath = runtimePointerPath({ HOME: homeRoot }, "linux");
    expect(pointerPath).toBe(path.join(homeRoot, ".local", "share", "agent-workbench", "runtime-root"));
    expect(fs.readFileSync(pointerPath, "utf8").trim()).toBe(packageRoot);
  });

  it("uses CODEX_HOME when no explicit portable configuration override is supplied", () => {
    createPortableFixture(bundleRoot);
    const envCodexHome = path.join(tempRoot, "codex-from-env");
    const result = spawnSync(
      process.execPath,
      [path.resolve("scripts/configure-portable.mjs"), "--bundle-root", bundleRoot],
      {
        encoding: "utf8",
        env: { ...process.env, HOME: homeRoot, CODEX_HOME: envCodexHome }
      }
    );

    expect(result.status).toBe(0);
    expect(fs.existsSync(path.join(envCodexHome, "hooks.json"))).toBe(true);
    expect(fs.existsSync(path.join(homeRoot, ".codex", "hooks.json"))).toBe(false);
  });

  it("fails closed when the fixed package path escapes the bundle root", () => {
    const outsidePackageRoot = path.join(tempRoot, "outside-package");
    createPortableFixture(outsidePackageRoot, { bundleRoot: null });
    const packageParent = path.join(bundleRoot, "runtime", "node_modules", "@auriora");
    fs.mkdirSync(packageParent, { recursive: true });
    fs.copyFileSync(process.execPath, path.join(bundleRoot, "node.exe"));
    fs.chmodSync(path.join(bundleRoot, "node.exe"), 0o755);
    fs.symlinkSync(outsidePackageRoot, path.join(packageParent, "agent-workbench"), "dir");

    const result = runConfigure(bundleRoot, homeRoot, codexHome);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/^configure-portable: portable package root escapes the portable bundle root:/u);
    expect(fs.existsSync(path.join(codexHome, "hooks.json"))).toBe(false);
    expect(fs.existsSync(runtimePointerPath({ HOME: homeRoot }, "linux"))).toBe(false);
  });

  it("rolls back pointer and plugin artifacts when Codex hook installation fails downstream", () => {
    const packageRoot = createPortableFixture(bundleRoot);
    const pointerPath = runtimePointerPath({ HOME: homeRoot }, "linux");
    const codexMcpPath = path.join(packageRoot, "plugins", "agent-workbench", ".mcp.json");
    const claudeMcpPath = path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", ".mcp.json");
    const claudeHooksPath = path.join(
      packageRoot,
      "plugins",
      "agent-workbench",
      "claude-plugin",
      "hooks",
      "hooks.json"
    );
    const codexHooksPath = path.join(codexHome, "hooks.json");
    const before = {
      pointer: "previous-pointer\n",
      codexMcp: '{\n  "preexisting": "codex"\n}\n',
      claudeMcp: '{\n  "preexisting": "claude-mcp"\n}\n',
      claudeHooks: '{\n  "preexisting": "claude-hooks"\n}\n',
      codexHooks: '{\n  "preexisting": "codex-hooks"\n}\n'
    };
    fs.mkdirSync(path.dirname(pointerPath), { recursive: true });
    fs.writeFileSync(pointerPath, before.pointer);
    fs.writeFileSync(codexMcpPath, before.codexMcp);
    fs.writeFileSync(claudeMcpPath, before.claudeMcp);
    fs.writeFileSync(claudeHooksPath, before.claudeHooks);
    fs.writeFileSync(codexHooksPath, before.codexHooks);

    const brokenCodexHome = path.join(tempRoot, "broken-codex-home");
    fs.writeFileSync(brokenCodexHome, "not-a-directory\n");
    const result = runConfigure(bundleRoot, homeRoot, brokenCodexHome);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/^configure-portable: Command failed:/u);
    expect(fs.readFileSync(pointerPath, "utf8")).toBe(before.pointer);
    expect(fs.readFileSync(codexMcpPath, "utf8")).toBe(before.codexMcp);
    expect(fs.readFileSync(claudeMcpPath, "utf8")).toBe(before.claudeMcp);
    expect(fs.readFileSync(claudeHooksPath, "utf8")).toBe(before.claudeHooks);
    expect(fs.readFileSync(codexHooksPath, "utf8")).toBe(before.codexHooks);
  });
});

function createPortableFixture(targetRoot: string, options: { bundleRoot?: string | null } = {}) {
  const packageRoot = options.bundleRoot === null
    ? targetRoot
    : path.join(targetRoot, "runtime", "node_modules", "@auriora", "agent-workbench");
  fs.mkdirSync(path.join(packageRoot, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(packageRoot, "plugins", "agent-workbench", "hooks"), { recursive: true });
  fs.mkdirSync(path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", "hooks"), { recursive: true });
  fs.writeFileSync(path.join(packageRoot, "package.json"), '{"version":"9.8.7"}\n');

  if (options.bundleRoot !== null) {
    fs.mkdirSync(targetRoot, { recursive: true });
    fs.copyFileSync(process.execPath, path.join(targetRoot, "node.exe"));
    fs.chmodSync(path.join(targetRoot, "node.exe"), 0o755);
  }

  for (const relativePath of [
    "scripts/install-codex-hooks.mjs",
    "plugins/agent-workbench/mcp-launch.mjs",
    "plugins/agent-workbench/install-root.mjs",
    "plugins/agent-workbench/hooks/session-start.core.js",
    "plugins/agent-workbench/hooks/hook-common.js",
    "plugins/agent-workbench/hooks/session-start.js",
    "plugins/agent-workbench/hooks/post-edit-feedback.js",
    "plugins/agent-workbench/claude-plugin/mcp-launch.mjs",
    "plugins/agent-workbench/claude-plugin/install-root.mjs",
    "plugins/agent-workbench/claude-plugin/hooks/session-start.core.js",
    "plugins/agent-workbench/claude-plugin/hooks/hook-common.js",
    "plugins/agent-workbench/claude-plugin/hooks/session-start.js",
    "plugins/agent-workbench/claude-plugin/hooks/post-edit-feedback.core.js",
    "plugins/agent-workbench/claude-plugin/hooks/post-edit-feedback.js"
  ]) {
    const source = path.resolve(relativePath);
    const destination = path.join(packageRoot, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }

  fs.writeFileSync(path.join(packageRoot, "plugins", "agent-workbench", "hooks", "hooks.json"), "{\n  \"hooks\": {}\n}\n");
  fs.writeFileSync(
    path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", ".mcp.json"),
    "{\n  \"mcpServers\": {}\n}\n"
  );
  fs.writeFileSync(
    path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", "hooks", "hooks.json"),
    "{\n  \"hooks\": {}\n}\n"
  );

  return packageRoot;
}

function runConfigure(bundleRoot: string, homeRoot: string, codexHome: string) {
  return spawnSync(
    process.execPath,
    [path.resolve("scripts/configure-portable.mjs"), "--bundle-root", bundleRoot, "--codex-home", codexHome],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: homeRoot
      }
    }
  );
}

function readJson(target: string) {
  return JSON.parse(fs.readFileSync(target, "utf8"));
}
