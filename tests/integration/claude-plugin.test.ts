import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { VENDORED_HOOK_FILES, VENDORED_PLUGIN_FILES } from "../../scripts/sync-claude-plugin-hooks.mjs";

describe("Claude Code plugin artifacts", () => {
  const pluginRoot = path.resolve("plugins/agent-workbench/claude-plugin");

  it("ships plugin manifest, MCP, skill, and hook config files", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pluginRoot, ".claude-plugin/plugin.json"), "utf8")
    ) as {
      name: string;
      displayName: string;
      skills: string;
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
      mcpServers: "./.mcp.json"
    });
    // Spec 033: shell-free exec-form launch via the portable shim; Claude
    // expands ${CLAUDE_PLUGIN_ROOT} before invocation on every OS.
    expect(mcpConfig.mcpServers["agent-workbench"]).toMatchObject({
      command: "node",
      args: ["${CLAUDE_PLUGIN_ROOT}/mcp-launch.mjs"]
    });
    const claudeMcpArgs = mcpConfig.mcpServers["agent-workbench"].args.join(" ");
    expect(claudeMcpArgs).not.toContain("bash");
    expect(claudeMcpArgs).not.toContain("-lc");
    expect(claudeMcpArgs).not.toContain("${VAR:-");
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

  it("keeps vendored hook modules byte-identical to the shared source", () => {
    const sourceDir = path.resolve("plugins/agent-workbench/hooks");
    for (const [source, target] of Object.entries(VENDORED_HOOK_FILES)) {
      const sourceContent = fs.readFileSync(path.join(sourceDir, source));
      const vendoredContent = fs.readFileSync(path.join(pluginRoot, "hooks", target));
      expect(
        vendoredContent.equals(sourceContent),
        `${target} is out of sync with hooks/${source}; run \`npm run sync:claude-hooks\``
      ).toBe(true);
    }
  });

  it("keeps vendored plugin-root modules byte-identical to the shared source", () => {
    const sourceDir = path.resolve("plugins/agent-workbench");
    for (const [source, target] of Object.entries(VENDORED_PLUGIN_FILES)) {
      const sourceContent = fs.readFileSync(path.join(sourceDir, source));
      const vendoredContent = fs.readFileSync(path.join(pluginRoot, target));
      expect(
        vendoredContent.equals(sourceContent),
        `${target} is out of sync with ${source}; run \`npm run sync:claude-hooks\``
      ).toBe(true);
    }
  });

  it("resolves the MCP launch shim from an isolated plugin copy (no ../.. escape)", async () => {
    // Same Claude copy-only-subtree layout as the hook isolation test: the shim's
    // `import "./install-root.mjs"` must resolve inside the copied plugin root.
    const stage = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-isolated-shim-"));
    const isolatedRoot = path.join(stage, "agent-workbench");
    fs.cpSync(pluginRoot, isolatedRoot, { recursive: true });

    const { planLaunch } = await import(pathToFileURL(path.join(isolatedRoot, "mcp-launch.mjs")).href);
    const plan = planLaunch(
      { AGENT_WORKBENCH_INSTALL_ROOT: "/install/root" },
      [],
      "/repo"
    );
    expect(plan.root).toBe("/install/root");
    expect(plan.args).toEqual(["--import", "tsx", path.join("/install/root", "src", "mcp", "stdio.ts")]);
    expect(plan.options.env.AGENT_WORKBENCH_DEFAULT_REPO_ROOT).toBe("/repo");

    fs.rmSync(stage, { recursive: true, force: true });
  });

  it("runs hooks from an isolated plugin copy (no parent hooks/ directory)", () => {
    // Claude Code installs a plugin by copying only its plugin-root subtree into a
    // per-user cache. Reproduce that layout so a re-introduced ../../ import (which
    // resolves in the repo tree but not the cache) fails loudly here instead of
    // silently disabling the hooks at runtime.
    const stage = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-isolated-plugin-"));
    const isolatedRoot = path.join(stage, "agent-workbench");
    fs.cpSync(pluginRoot, isolatedRoot, { recursive: true });
    expect(fs.existsSync(path.join(stage, "hooks"))).toBe(false);

    const env = { ...process.env, AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" };
    const runHook = (script: string, payload: unknown): string =>
      execFileSync("node", [path.join(isolatedRoot, "hooks", script)], {
        input: JSON.stringify(payload),
        encoding: "utf8",
        env
      });

    const sessionOut = runHook("session-start.js", {
      hook_event_name: "SessionStart",
      source: "startup"
    });
    expect(sessionOut).toContain("Agent Workbench MCP is available.");
    expect(sessionOut).toContain("repo:///status");

    const work = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-isolated-work-"));
    fs.writeFileSync(path.join(work, "bad.json"), "{ bad,,, }\n");
    const editOut = runHook("post-edit-feedback.js", {
      hook_event_name: "PostToolUse",
      tool_name: "Write",
      tool_input: { file_path: "bad.json" },
      cwd: work
    });
    expect(editOut).toContain("JSON syntax error in bad.json");

    fs.writeFileSync(path.join(work, "clean.js"), "const x = 1;\n");
    const cleanOut = runHook("post-edit-feedback.js", {
      hook_event_name: "PostToolUse",
      tool_name: "Write",
      tool_input: { file_path: "clean.js" },
      cwd: work
    });
    expect(cleanOut).toBe("");

    fs.rmSync(stage, { recursive: true, force: true });
    fs.rmSync(work, { recursive: true, force: true });
  });
});
