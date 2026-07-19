/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Codex hook installation", () => {
  let tempRoot: string;
  let codexHome: string;
  let repoRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-codex-hooks-"));
    codexHome = path.join(tempRoot, "codex");
    repoRoot = path.join(tempRoot, "repo-without-hooks-dir");
    fs.mkdirSync(codexHome, { recursive: true });
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "README.md"), "# Fixture\n");
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("replaces stale relative hooks with absolute installed package hook paths", () => {
    const hooksPath = path.join(codexHome, "hooks.json");
    fs.writeFileSync(
      hooksPath,
      `${JSON.stringify(
        {
          hooks: {
            SessionStart: [
              {
                matcher: "startup",
                hooks: [
                  {
                    type: "command",
                    command: "node",
                    cwd: ".",
                    args: ["./hooks/session-start.js"]
                  }
                ]
              }
            ],
            PostToolUse: [
              {
                matcher: "Write",
                hooks: [
                  {
                    type: "command",
                    command: "node",
                    cwd: ".",
                    args: ["./hooks/post-edit-feedback.js"]
                  }
                ]
              }
            ]
          }
        },
        null,
        2
      )}\n`
    );

    const script = path.resolve("scripts/install-codex-hooks.mjs");
    const packageRoot = path.resolve(".");
    for (let index = 0; index < 2; index += 1) {
      execFileSync(process.execPath, [script, "--package-root", packageRoot, "--codex-home", codexHome], {
        encoding: "utf8"
      });
    }

    const installed = JSON.parse(fs.readFileSync(hooksPath, "utf8")) as {
      hooks: Record<string, Array<{ matcher?: string; hooks: Array<{ command: string; cwd?: string; args?: string[] }> }>>;
    };
    const sessionHook = installed.hooks.SessionStart[0].hooks[0];
    const postEditHook = installed.hooks.PostToolUse[0].hooks[0];
    const sessionHookScript = path.join(packageRoot, "plugins/agent-workbench/hooks/session-start.js");
    const postEditHookScript = path.join(packageRoot, "plugins/agent-workbench/hooks/post-edit-feedback.js");

    expect(installed.hooks.SessionStart).toHaveLength(1);
    expect(installed.hooks.SessionStart[0].matcher).toBe("startup");
    expect(installed.hooks.PostToolUse).toHaveLength(1);
    expect(sessionHook.command).toContain(process.execPath);
    expect(sessionHook.command).toContain(sessionHookScript);
    expect(sessionHook.args).toBeUndefined();
    expect(sessionHook.cwd).toBeUndefined();
    expect(postEditHook.command).toContain(process.execPath);
    expect(postEditHook.command).toContain(postEditHookScript);
    expect(postEditHook.args).toBeUndefined();
    expect(postEditHook.cwd).toBeUndefined();

    const result = spawnSync(sessionHook.command, {
      shell: true,
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
    expect(parsed.hookSpecificOutput).toEqual({
      hookEventName: "SessionStart",
      additionalContext:
        "For non-trivial repository investigation, change evidence, or validation planning, invoke the packaged Agent Workbench skill; skip it for trivial tasks."
    });
    expect(parsed.hookSpecificOutput?.additionalContext).not.toContain("repo:///");
    expect(parsed.hookSpecificOutput?.additionalContext).not.toContain("context_for_task");
    expect(parsed.hookSpecificOutput?.additionalContext).not.toContain("MCP");

    for (const source of ["resume", "clear", "compact"]) {
      const suppressed = spawnSync(sessionHook.command, {
        shell: true,
        cwd: repoRoot,
        input: JSON.stringify({ hook_event_name: "SessionStart", source, cwd: repoRoot }),
        encoding: "utf8"
      });

      expect(suppressed.status).toBe(0);
      expect(suppressed.stderr).toBe("");
      expect(suppressed.stdout).toBe("");
    }
  });
});
