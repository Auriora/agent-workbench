/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { PassThrough } from "node:stream";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

describe("Kiro Power artifacts", () => {
  const powerRoot = path.resolve("plugins/agent-workbench/kiro-power");

  it("ships Power, MCP, skill, agent, IDE hooks, and hook adapter files", () => {
    const power = fs.readFileSync(path.join(powerRoot, "POWER.md"), "utf8");
    const mcpConfig = JSON.parse(fs.readFileSync(path.join(powerRoot, "mcp.json"), "utf8")) as {
      mcpServers: Record<string, { command: string; args: string[]; timeout: number }>;
    };
    const agentConfig = JSON.parse(
      fs.readFileSync(path.join(powerRoot, "agents/agent-workbench.json"), "utf8")
    ) as {
      includeMcpJson: boolean;
      hooks: Record<string, unknown>;
      resources: string[];
    };
    const skill = fs.readFileSync(
      path.join(powerRoot, "skills/agent-workbench/SKILL.md"),
      "utf8"
    );
    const readyCheckHook = JSON.parse(
      fs.readFileSync(
        path.join(powerRoot, ".kiro/hooks/agent-workbench-ready-check.kiro.hook"),
        "utf8"
      )
    ) as {
      enabled: boolean;
      version: string;
      when: { type: string; toolTypes?: string[] };
      then: { type: string; command?: string };
      shortName: string;
    };
    const postWriteHook = JSON.parse(
      fs.readFileSync(
        path.join(powerRoot, ".kiro/hooks/agent-workbench-post-write-feedback.kiro.hook"),
        "utf8"
      )
    ) as {
      enabled: boolean;
      version: string;
      when: { type: string; toolTypes?: string[] };
      then: { type: string; prompt?: string };
      shortName: string;
    };

    expect(power).toContain('name: "agent-workbench"');
    expect(power).toContain("Do not run runtime code from this Power directory.");
    expect(power).toContain("IDE hooks must be workspace files under `.kiro/hooks/`");
    expect(mcpConfig.mcpServers["agent-workbench"]).toMatchObject({
      command: "bash",
      timeout: 120000,
      args: expect.arrayContaining([
        "exec \"${AGENT_WORKBENCH_INSTALL_ROOT:-$HOME/.local/share/agent-workbench}/bin/agent-workbench-mcp\""
      ])
    });
    expect(agentConfig.includeMcpJson).toBe(true);
    expect(agentConfig.resources).toEqual([
      "skill://.kiro/skills/**/SKILL.md",
      "skill://~/.kiro/skills/**/SKILL.md"
    ]);
    expect(Object.keys(agentConfig.hooks).sort()).toEqual(["agentSpawn"]);
    expect(skill).toContain("The MCP server is the only executable runtime surface.");
    expect(skill).toContain("Kiro Integration");
    expect(readyCheckHook).toMatchObject({
      enabled: true,
      version: "1",
      when: { type: "userTriggered" },
      then: { type: "runCommand" },
      shortName: "agent-workbench-ready-check"
    });
    expect(readyCheckHook.then.command).toContain("hooks/session-start.js");
    expect(postWriteHook).toMatchObject({
      enabled: true,
      version: "1",
      when: {
        type: "postToolUse",
        toolTypes: ["write"]
      },
      then: { type: "askAgent" },
      shortName: "agent-workbench-post-write-feedback"
    });
    expect(postWriteHook.then.prompt).toContain("diagnostics_for_files");
  });

  it("adapts Kiro hook payloads to quiet Agent Workbench feedback", async () => {
    const sessionStart = await import(
      pathToFileURL(path.join(powerRoot, "hooks/session-start.js")).href
    );
    const postEdit = await import(
      pathToFileURL(path.join(powerRoot, "hooks/post-edit-feedback.js")).href
    );

    expect(
      sessionStart.buildKiroSessionStartContext(
        { hook_event_name: "agentSpawn" },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).toBe(
      "For non-trivial repository investigation, change evidence, or validation planning, invoke the packaged Agent Workbench skill; skip it for trivial tasks."
    );
    // Kiro adapters keep basic output as their local default, matching Codex's
    // quiet, action-gated default.
    expect(
      sessionStart.buildKiroSessionStartContext(
        { hook_event_name: "agentSpawn" },
        {}
      )
    ).toBe(
      "For non-trivial repository investigation, change evidence, or validation planning, invoke the packaged Agent Workbench skill; skip it for trivial tasks."
    );
    expect(
      sessionStart.buildKiroSessionStartContext(
        { hook_event_name: "agentSpawn" },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "silent" }
      )
    ).toBeUndefined();

    expect(
      postEdit.extractKiroChangedFiles({
        tool_input: {
          operations: [
            { path: "generated/out.txt" },
            { path: "src/app.ts" }
          ]
        }
      })
    ).toEqual(["generated/out.txt", "src/app.ts"]);

    expect(
      postEdit.buildKiroPostEditContext(
        {
          cwd: "/repo",
          tool_name: "write",
          tool_input: {
            operations: [
              { path: "generated/out.txt" },
              { path: "src/app.ts" }
            ]
          }
        },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).toBe("Generated/local artifact changed: generated/out.txt.");

    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-kiro-hook-"));
    fs.mkdirSync(path.join(fixtureRoot, "src"), { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, "src", "bad.json"), "{\"ok\": \n");

    expect(
      postEdit.buildKiroPostEditContext(
        {
          cwd: fixtureRoot,
          tool_name: "write",
          tool_input: {
            operations: [
              { path: "src/bad.json" }
            ]
          }
        },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).toContain("JSON syntax error in src/bad.json");
  });

  it("does not block forever when Kiro runCommand hooks provide no stdin", async () => {
    const common = await import(
      pathToFileURL(path.resolve("plugins/agent-workbench/hooks/hook-common.js")).href
    );
    const stdin = new PassThrough();

    await expect(common.readStdin(stdin, 10)).resolves.toBe("");
  });

  it("exits when command-style Kiro hooks leave stdin open", async () => {
    const hookPath = path.join(powerRoot, "hooks/post-edit-feedback.js");
    const child = spawn(process.execPath, [hookPath], {
      env: {
        ...process.env,
        AGENT_WORKBENCH_HOOK_FEEDBACK: "basic"
      },
      stdio: ["pipe", "pipe", "pipe"]
    });

    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
      (resolve, reject) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error("hook did not exit with open stdin"));
        }, 1_500);
        child.on("exit", (code, signal) => {
          clearTimeout(timer);
          resolve({ code, signal });
        });
      }
    );

    expect(result).toEqual({ code: 0, signal: null });
  });

  it("records Kiro Power packaging in the package manifest", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve("packaging/agent-workbench/package-manifest.json"), "utf8")
    ) as {
      components: string[];
      kiro: {
        power_root: string;
        power_mcp_config: string;
        power_skill: string;
        power_hooks: string[];
      };
    };

    expect(manifest.components).toContain("plugins/agent-workbench/kiro-power");
    expect(manifest.kiro).toMatchObject({
      power_root: "plugins/agent-workbench/kiro-power",
      power_mcp_config: "plugins/agent-workbench/kiro-power/mcp.json",
      power_skill: "plugins/agent-workbench/kiro-power/skills/agent-workbench/SKILL.md"
    });
    expect(manifest.kiro.power_hooks).toEqual([
      "plugins/agent-workbench/kiro-power/.kiro/hooks/agent-workbench-ready-check.kiro.hook",
      "plugins/agent-workbench/kiro-power/.kiro/hooks/agent-workbench-post-write-feedback.kiro.hook",
      "plugins/agent-workbench/kiro-power/hooks/session-start.js",
      "plugins/agent-workbench/kiro-power/hooks/post-edit-feedback.js"
    ]);
  });
});
