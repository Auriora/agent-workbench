import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

describe("Claude Code plugin artifacts", () => {
  const pluginRoot = path.resolve("plugins/agent-workbench/claude-plugin");

  it("ships plugin manifest, MCP, skill, and hook config files", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pluginRoot, ".claude-plugin/plugin.json"), "utf8")
    ) as {
      name: string;
      displayName: string;
      skills: string;
      hooks: string;
      mcpServers: string;
    };
    const mcpConfig = JSON.parse(fs.readFileSync(path.join(pluginRoot, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    const hooksConfig = JSON.parse(
      fs.readFileSync(path.join(pluginRoot, "hooks/hooks.json"), "utf8")
    ) as {
      hooks: Record<string, unknown>;
    };
    const skill = fs.readFileSync(
      path.join(pluginRoot, "skills/agent-workbench/SKILL.md"),
      "utf8"
    );

    expect(manifest).toMatchObject({
      name: "agent-workbench",
      displayName: "Agent Workbench",
      skills: "./skills/",
      hooks: "./hooks/hooks.json",
      mcpServers: "./.mcp.json"
    });
    expect(mcpConfig.mcpServers["agent-workbench"]).toMatchObject({
      command: "bash",
      args: expect.arrayContaining([
        "exec \"${AGENT_WORKBENCH_INSTALL_ROOT:-$HOME/.local/share/agent-workbench}/bin/agent-workbench-mcp\""
      ])
    });
    expect(Object.keys(hooksConfig.hooks).sort()).toEqual(["PostToolUse", "SessionStart"]);
    expect(skill).toContain("description: Use Agent Workbench as the MCP-backed IDE runtime");
    expect(skill).toContain("Claude Code Integration");
  });

  it("adapts Claude Code hook payloads to quiet Agent Workbench feedback", async () => {
    const sessionStart = await import(
      pathToFileURL(path.join(pluginRoot, "hooks/session-start.js")).href
    );
    const postEdit = await import(
      pathToFileURL(path.join(pluginRoot, "hooks/post-edit-feedback.js")).href
    );
    const common = await import(pathToFileURL(path.resolve("plugins/agent-workbench/hooks/hook-common.js")).href);

    const sessionContext = sessionStart.buildClaudeSessionStartContext(
      { hook_event_name: "SessionStart" },
      { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
    );
    expect(sessionContext).toContain("Agent Workbench MCP is available.");
    expect(common.buildAdditionalContextOutput("SessionStart", sessionContext)).toMatchObject({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: expect.stringContaining("repo:///status")
      }
    });

    expect(
      postEdit.buildClaudePostEditContext(
        {
          cwd: "/repo",
          tool_name: "Write",
          tool_input: { file_path: "generated/out.txt" }
        },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).toBe("Generated/local artifact changed: generated/out.txt.");

    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-claude-hook-"));
    fs.mkdirSync(path.join(fixtureRoot, "src"), { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, "src", "bad.json"), "{\"ok\": \n");

    expect(
      postEdit.buildClaudePostEditContext(
        {
          cwd: fixtureRoot,
          tool_name: "Write",
          tool_input: { file_path: "src/bad.json" }
        },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).toContain("JSON syntax error in src/bad.json");
  });

  it("records Kiro and Claude packages in the package manifest report", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve("packaging/agent-workbench/package-manifest.json"), "utf8")
    ) as {
      components: string[];
      kiro: {
        power_root: string;
        power_mcp_config: string;
        power_hooks: string[];
      };
      claude_code: {
        plugin_root: string;
        plugin_manifest: string;
        plugin_mcp_config: string;
        plugin_hooks: string;
        plugin_hook_scripts: string[];
      };
    };

    expect(manifest.components).toEqual(
      expect.arrayContaining([
        "plugins/agent-workbench/kiro-power",
        "plugins/agent-workbench/claude-plugin"
      ])
    );
    expect(manifest.kiro).toMatchObject({
      power_root: "plugins/agent-workbench/kiro-power",
      power_mcp_config: "plugins/agent-workbench/kiro-power/mcp.json"
    });
    expect(manifest.kiro.power_hooks).toEqual([
      "plugins/agent-workbench/kiro-power/.kiro/hooks/agent-workbench-ready-check.kiro.hook",
      "plugins/agent-workbench/kiro-power/.kiro/hooks/agent-workbench-post-write-feedback.kiro.hook",
      "plugins/agent-workbench/kiro-power/hooks/session-start.js",
      "plugins/agent-workbench/kiro-power/hooks/post-edit-feedback.js"
    ]);
    expect(manifest.claude_code).toMatchObject({
      plugin_root: "plugins/agent-workbench/claude-plugin",
      plugin_manifest: "plugins/agent-workbench/claude-plugin/.claude-plugin/plugin.json",
      plugin_mcp_config: "plugins/agent-workbench/claude-plugin/.mcp.json",
      plugin_hooks: "plugins/agent-workbench/claude-plugin/hooks/hooks.json"
    });
    expect(manifest.claude_code.plugin_hook_scripts).toEqual([
      "plugins/agent-workbench/claude-plugin/hooks/session-start.js",
      "plugins/agent-workbench/claude-plugin/hooks/post-edit-feedback.js"
    ]);
  });
});
