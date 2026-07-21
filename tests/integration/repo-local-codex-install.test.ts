/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(".");
const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("repo-local Codex plugin installation", () => {
  it("stages an absolute checkout launch binding without changing tracked plugin config", () => {
    const sourceConfigPath = path.join(repoRoot, "plugins", "agent-workbench", ".mcp.json");
    const sourceBefore = fs.readFileSync(sourceConfigPath, "utf8");
    const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-codex-stage-"));
    temporaryRoots.push(stageRoot);

    const materializeResult = spawnSync(
      process.execPath,
      [
        path.join(repoRoot, "scripts", "materialize-codex-repo-plugin.mjs"),
        "--repo-root",
        repoRoot,
        "--stage-root",
        stageRoot
      ],
      { cwd: repoRoot, encoding: "utf8" }
    );
    expect(materializeResult.status).toBe(0);
    const result = JSON.parse(materializeResult.stdout);
    const stagedConfig = JSON.parse(
      fs.readFileSync(path.join(result.stagedPluginRoot, ".mcp.json"), "utf8")
    );
    const stagedServer = stagedConfig.mcpServers["agent-workbench"];
    const marketplace = JSON.parse(
      fs.readFileSync(path.join(stageRoot, ".agents", "plugins", "marketplace.json"), "utf8")
    );

    expect(stagedServer.args).toEqual([
      path.join(repoRoot, "plugins", "agent-workbench", "mcp-launch.mjs")
    ]);
    expect(stagedServer.env.AGENT_WORKBENCH_INSTALL_ROOT).toBe(repoRoot);
    expect(stagedServer.args[0]).not.toContain("${PLUGIN_ROOT}");
    expect(marketplace.name).toBe("agent-workbench-local");
    expect(marketplace.plugins[0].source.path).toBe("./plugins/agent-workbench");
    expect(fs.existsSync(path.join(result.stagedPluginRoot, "claude-plugin", ".mcp.json"))).toBe(true);

    expect(fs.readFileSync(sourceConfigPath, "utf8")).toBe(sourceBefore);
    expect(JSON.parse(sourceBefore).mcpServers["agent-workbench"].args).toEqual([
      "${PLUGIN_ROOT}/mcp-launch.mjs"
    ]);
  });

  it("reports the staged marketplace registration in dry-run mode", () => {
    const stageRoot = path.join(os.tmpdir(), "agent-workbench-dry-run-stage");
    const result = spawnSync(
      "bash",
      [
        path.join(repoRoot, "scripts", "install-agent-workbench-repo-local.sh"),
        "--stage-root",
        stageRoot,
        "--codex-home",
        "/tmp/codex-home",
        "--dry-run"
      ],
      { cwd: repoRoot, encoding: "utf8" }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("materialize-codex-repo-plugin.mjs");
    expect(result.stdout).toContain(
      "install-codex-hooks.mjs --package-root"
    );
    expect(result.stdout).toContain("--codex-home /tmp/codex-home --dry-run");
    expect(result.stdout).toContain(
      "codex plugin remove agent-workbench@agent-workbench-local (when installed)"
    );
    expect(result.stdout).toContain(
      "codex plugin marketplace remove agent-workbench-local (when configured)"
    );
    expect(result.stdout).toContain(`codex plugin marketplace add ${stageRoot}`);
    expect(result.stdout).toContain(
      "codex plugin add agent-workbench@agent-workbench-local"
    );
    expect(fs.existsSync(stageRoot)).toBe(false);
  });

  it("clears the installed selector cache before registering and adding the staged artifact", () => {
    const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-codex-install-"));
    temporaryRoots.push(testRoot);
    const fakeBin = path.join(testRoot, "bin");
    const stageRoot = path.join(testRoot, "stage");
    const codexHome = path.join(testRoot, "codex-home");
    const commandLog = path.join(testRoot, "codex-commands.log");
    fs.mkdirSync(fakeBin, { recursive: true });
    const fakeCodex = path.join(fakeBin, "codex");
    fs.writeFileSync(
      fakeCodex,
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        "printf '%s\\n' \"$*\" >> \"$FAKE_CODEX_COMMAND_LOG\"",
        "if [[ \"$*\" == \"plugin marketplace list\" ]]; then",
        "  printf '%s\\n' 'agent-workbench-local /old/package/marketplace'",
        "fi",
        "if [[ \"$*\" == \"plugin list\" ]]; then",
        "  printf '%s\\n' 'agent-workbench@agent-workbench-local installed, enabled 0.6.1 /old/package/plugin'",
        "fi"
      ].join("\n"),
      "utf8"
    );
    fs.chmodSync(fakeCodex, 0o755);

    const result = spawnSync(
      "bash",
      [
        path.join(repoRoot, "scripts", "install-agent-workbench-repo-local.sh"),
        "--stage-root",
        stageRoot,
        "--codex-home",
        codexHome
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
          FAKE_CODEX_COMMAND_LOG: commandLog
        }
      }
    );

    expect(result.status).toBe(0);
    expect(fs.readFileSync(commandLog, "utf8").trim().split("\n")).toEqual([
      "plugin list",
      "plugin remove agent-workbench@agent-workbench-local",
      "plugin marketplace list",
      "plugin marketplace remove agent-workbench-local",
      `plugin marketplace add ${stageRoot}`,
      "plugin add agent-workbench@agent-workbench-local"
    ]);
    const stagedConfig = JSON.parse(
      fs.readFileSync(path.join(stageRoot, "plugins", "agent-workbench", ".mcp.json"), "utf8")
    );
    expect(stagedConfig.mcpServers["agent-workbench"].args).toEqual([
      path.join(repoRoot, "plugins", "agent-workbench", "mcp-launch.mjs")
    ]);
    const installedHooks = JSON.parse(
      fs.readFileSync(path.join(codexHome, "hooks.json"), "utf8")
    );
    expect(installedHooks.hooks.SessionStart).toEqual([
      expect.objectContaining({
        matcher: "startup",
        hooks: [
          expect.objectContaining({
            command: expect.stringContaining(
              path.join(repoRoot, "plugins", "agent-workbench", "hooks", "session-start.js")
            )
          })
        ]
      })
    ]);
    expect(installedHooks.hooks.PostToolUse).toEqual([
      expect.objectContaining({
        hooks: [
          expect.objectContaining({
            command: expect.stringContaining(
              path.join(repoRoot, "plugins", "agent-workbench", "hooks", "post-edit-feedback.js")
            )
          })
        ]
      })
    ]);
  });
});
