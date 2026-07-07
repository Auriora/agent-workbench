/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("agent CLI hook compatibility", () => {
  let tempRoot: string;
  let repoRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-hook-cli-"));
    repoRoot = path.join(tempRoot, "repo");
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "README.md"), "# Fixture\n");
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("runs Codex user hooks as single command strings with no args field", () => {
    const codexHome = path.join(tempRoot, "codex");
    const installScript = path.resolve("scripts/install-codex-hooks.mjs");
    const packageRoot = path.resolve(".");

    execFileSync(process.execPath, [
      installScript,
      "--package-root",
      packageRoot,
      "--codex-home",
      codexHome
    ]);

    const hooksConfig = JSON.parse(
      fs.readFileSync(path.join(codexHome, "hooks.json"), "utf8")
    ) as {
      hooks: Record<string, Array<{ matcher?: string; hooks: Array<{ command: string; args?: string[] }> }>>;
    };
    const hook = hooksConfig.hooks.SessionStart[0].hooks[0];

    expect(hooksConfig.hooks.SessionStart[0].matcher).toBe("startup");
    expect(hook.command).toContain(process.execPath);
    expect(hook.command).toContain("plugins/agent-workbench/hooks/session-start.js");
    expect(hook.args).toBeUndefined();

    const result = spawnSync(hook.command, {
      shell: true,
      cwd: repoRoot,
      input: JSON.stringify({ hook_event_name: "SessionStart", cwd: repoRoot }),
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Agent Workbench MCP is available.");
    expect(result.stdout).toContain(`- root: ${repoRoot}`);
    expect(result.stdout).toContain("tool_search");
    expect(result.stdout).toContain("context_for_task verification_plan diagnostics_for_files docs_search");
  });

  it("passes PostToolUse stdin through the Codex shell command shape", () => {
    const logPath = path.join(tempRoot, "post-edit-debug.jsonl");
    const hookScript = path.resolve("plugins/agent-workbench/hooks/post-edit-feedback.js");
    const command = `AGENT_WORKBENCH_HOOK_DEBUG=1 AGENT_WORKBENCH_HOOK_LOG_PATH='${logPath}' '${process.execPath}' '${hookScript}'`;

    const result = spawnSync(command, {
      shell: true,
      cwd: repoRoot,
      input: JSON.stringify({
        hook_event_name: "PostToolUse",
        cwd: repoRoot,
        tool_name: "apply_patch",
        tool_input: {
          file_path: "README.md"
        },
        tool_response: {
          code: 0
        }
      }),
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("");

    const records = fs
      .readFileSync(logPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(records).toEqual([
      expect.objectContaining({
        status: "payload_summary",
        hook_event_name: "PostToolUse",
        tool_name: "apply_patch",
        extracted_files: ["README.md"],
        checked_files: ["README.md"],
        outcome: "checked"
      })
    ]);
  });

  it("runs Claude plugin hooks as command plus args with Claude-shaped JSON output", () => {
    const pluginRoot = path.resolve("plugins/agent-workbench/claude-plugin");
    const hooksConfig = JSON.parse(
      fs.readFileSync(path.join(pluginRoot, "hooks/hooks.json"), "utf8")
    ) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string; args: string[] }> }>>;
    };
    const hook = hooksConfig.hooks.SessionStart[0].hooks[0];
    const args = hook.args.map((arg) => arg.replace("${CLAUDE_PLUGIN_ROOT}", pluginRoot));

    expect(hook.command).toBe("node");
    expect(args).toEqual([path.join(pluginRoot, "hooks/session-start.js")]);

    const result = spawnSync(hook.command, args, {
      cwd: repoRoot,
      input: JSON.stringify({ hook_event_name: "SessionStart", cwd: repoRoot }),
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput?: {
        hookEventName?: string;
        additionalContext?: string;
      };
    };
    expect(parsed.hookSpecificOutput).toMatchObject({
      hookEventName: "SessionStart",
      additionalContext: expect.stringContaining("Agent Workbench MCP is available.")
    });
    expect(parsed.hookSpecificOutput?.additionalContext).toContain("tool_search");
    expect(parsed.hookSpecificOutput?.additionalContext).toContain(
      "context_for_task verification_plan diagnostics_for_files docs_search"
    );
  });

  it("runs Kiro custom-agent hooks as shell command strings with plain text output", () => {
    const powerRoot = path.resolve("plugins/agent-workbench/kiro-power");
    const agentConfig = JSON.parse(
      fs.readFileSync(path.join(powerRoot, "agents/agent-workbench.json"), "utf8")
    ) as {
      hooks: Record<string, Array<{ command: string }>>;
    };
    const hook = agentConfig.hooks.agentSpawn[0];

    expect(hook.command).toContain("AGENT_WORKBENCH_HOOK_FEEDBACK=basic");
    expect(hook.command).toContain("kiro-power/hooks/session-start.js");

    const result = spawnSync(hook.command, {
      shell: true,
      cwd: repoRoot,
      env: {
        ...process.env,
        AGENT_WORKBENCH_INSTALL_ROOT: path.resolve(".")
      },
      input: JSON.stringify({ hook_event_name: "agentSpawn", cwd: repoRoot }),
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Agent Workbench MCP is available.");
    expect(result.stdout).toContain("repo:///status");
    expect(result.stdout).toContain("tool_search");
    expect(result.stdout).toContain("context_for_task verification_plan diagnostics_for_files docs_search");
  });
});
