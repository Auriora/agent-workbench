import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  codexIntegrationProfileSchema,
  responseEnvelopeSchema
} from "../../src/contracts/index.js";
import { describeCodexIntegrationProfile } from "../../src/application/use-cases/describe-codex-integration-profile.js";
import { buildCodexIntegrationProfileEnvelope } from "../../src/presentation/integration-profile-presenter.js";
import { codexIntegrationProfileResource } from "../../src/interface-adapters/mcp/registries/resources/codex-integration-profile.js";
import { createAgentWorkbenchServer } from "../../src/server.js";

type RegisteredResource = {
  name: string;
  uri: string;
  handler: () => Promise<{
    contents: Array<{
      uri: string;
      mimeType: string;
      text: string;
    }>;
  }>;
};

describe("Codex integration profile", () => {
  it("describes active MCP, plugin, skill, and hook surfaces without copied runtime behavior", () => {
    const profile = codexIntegrationProfileSchema.parse(describeCodexIntegrationProfile());

    expect(profile.target_agent).toBe("codex");
    expect(profile.mcp_server_id).toBe("agent-workbench");
    expect(profile.plugin.update_model.copied_runtime_allowed).toBe(false);
    expect(profile.guardrails).toEqual(
      expect.arrayContaining([
        "MCP is the only executable runtime surface.",
        "Plugin, skill, and hook artifacts are wrappers around MCP, not parallel implementations.",
        "Timeouts and failures must not produce partial-success evidence."
      ])
    );
    expect(profile.active_surfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ surface: "mcp", status: "active" }),
        expect.objectContaining({ surface: "plugins", status: "available" }),
        expect.objectContaining({ surface: "commands", status: "active" })
      ])
    );
    expect(profile.wrapper_surfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ surface: "skills", status: "available" }),
        expect.objectContaining({ surface: "hooks", status: "available" })
      ])
    );
    expect(profile.hooks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "agent-workbench-post-edit-feedback",
          default_mode: "silent",
          blocks_workflow: false
        })
      ])
    );
    expect(profile.mcp_bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "context_for_task",
          kind: "tool",
          capability_class: "read_only",
          description: expect.stringContaining("Configured")
        }),
        expect.objectContaining({
          name: "verification_plan",
          kind: "tool",
          capability_class: "planning"
        }),
        expect.objectContaining({
          name: "symbol_search",
          kind: "tool",
          capability_class: "read_only"
        }),
        expect.objectContaining({
          name: "find_references",
          kind: "tool",
          capability_class: "read_only"
        }),
        expect.objectContaining({
          name: "impact",
          kind: "tool",
          capability_class: "read_only"
        }),
        expect.objectContaining({
          name: "preview_workspace_edit",
          kind: "tool",
          capability_class: "workspace_write"
        }),
        expect.objectContaining({
          name: "apply_workspace_edit",
          kind: "tool",
          capability_class: "workspace_write"
        }),
        expect.objectContaining({
          name: "scope",
          uri: "repo:///scope",
          kind: "resource",
          capability_class: "read_only"
        }),
        expect.objectContaining({
          name: "overview",
          uri: "repo:///overview",
          kind: "resource",
          capability_class: "read_only"
        })
      ])
    );
    expect(profile.guardrails).toContain(
      "Configured MCP bindings must not be treated as guaranteed client-discovered tools unless the active session exposes them."
    );
  });

  it("wraps the profile in the shared MCP response envelope", () => {
    const envelope = buildCodexIntegrationProfileEnvelope(describeCodexIntegrationProfile());

    expect(responseEnvelopeSchema(codexIntegrationProfileSchema).parse(envelope)).toEqual(envelope);
    expect(envelope.meta).toMatchObject({
      analysis_validity: "valid",
      capability_level: "resource_backed",
      verification_status: "done"
    });
  });

  it("documents host-level runtime update semantics for source and dependency changes", () => {
    const profile = codexIntegrationProfileSchema.parse(describeCodexIntegrationProfile());
    const mcpSurface = profile.active_surfaces.find((entry) => entry.surface === "mcp");
    const sourceDependencyArtifact = profile.artifacts.find(
      (artifact) => artifact.surface === "mcp" && artifact.path === "src/mcp/stdio.ts"
    );

    expect(profile.runtime_source).toBe("repository_checkout");
    expect(profile.plugin.runtime_source).toBe("repository_checkout");
    expect(profile.plugin.packaging_model).toBe("skill_and_hook_wrapper_only");
    expect(profile.plugin.mcp_binding_model).toBe("host_level_config_required");
    expect(profile.plugin.mcp_config_path).toBeUndefined();
    expect(profile.plugin.update_model.source_changes).toMatch(/Restart Codex/i);
    expect(profile.plugin.update_model.source_changes).toContain("updated repository source");
    expect(profile.plugin.update_model.dependency_changes).toMatch(/pnpm install/i);
    expect(profile.plugin.update_model.dependency_changes).toMatch(/restart Codex/i);
    expect(profile.plugin.update_model.dependency_changes).toContain(
      "Plugin/package reinstall is not the update mechanism."
    );
    expect(profile.guardrails).toEqual(
      expect.arrayContaining([
        "Source edits require Codex restart to reload MCP source behavior.",
        "Dependency changes require pnpm install in this repository checkout, then restart Codex."
      ])
    );
    expect(profile.runtime_version).toBe("0.1.0");
    expect(mcpSurface?.constraints).toEqual(
      expect.arrayContaining(["Source edits in this repository are picked up on Codex restart."])
    );
    expect(mcpSurface?.behavior).toEqual(
      expect.arrayContaining([
        "Launches the production MCP server from this repository checkout.",
        "Defaults omitted repo roots to the Codex session working directory."
      ])
    );
    expect(sourceDependencyArtifact).toMatchObject({
      target_agent: "codex",
      surface: "mcp",
      status: "supported",
      provenance: "runtime_source",
      path: "src/mcp/stdio.ts"
    });
  });

  it("registers integration:///profiles/codex as a schema-owned MCP resource", async () => {
    let registered: RegisteredResource | undefined;
    const server = {
      resource(name: string, uri: string, handler: RegisteredResource["handler"]) {
        registered = { name, uri, handler };
      }
    };

    codexIntegrationProfileResource.register(server as never, {
      repoRoot: "/repo"
    });

    expect(registered).toMatchObject({
      name: "codex-integration-profile",
      uri: "integration:///profiles/codex"
    });

    const response = await registered?.handler();
    const parsed = JSON.parse(response?.contents[0]?.text ?? "{}") as {
      data: { plugin: { update_model: { copied_runtime_allowed: boolean } } };
    };

    expect(parsed.data.plugin.update_model.copied_runtime_allowed).toBe(false);
  });

  it("is exposed by the composed server alongside repo resources", () => {
    const server = createAgentWorkbenchServer(".", { startGraphWarmup: false }) as unknown as {
      _registeredResources: Record<string, unknown>;
    };

    expect(Object.keys(server._registeredResources).sort()).toEqual([
      "integration:///profiles/codex",
      "repo:///docs/map",
      "repo:///docs/overview",
      "repo:///overview",
      "repo:///scope",
      "repo:///status"
    ]);
  });
});

describe("Codex plugin artifacts", () => {
  const pluginRoot = path.resolve("plugins/agent-workbench");

  it("ships a valid skill-only wrapper manifest, skill, and hook config", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pluginRoot, ".codex-plugin/plugin.json"), "utf8")
    ) as {
      name: string;
      skills: string;
      mcpServers?: string;
      hooks?: string;
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
      skills: "./skills/"
    });
    expect(manifest.mcpServers).toBeUndefined();
    expect(manifest.hooks).toBeUndefined();
    expect(Object.keys(hooksConfig.hooks).sort()).toEqual(["PostToolUse", "SessionStart"]);
    expect(skill).toContain("Agent Workbench is the executable runtime.");
    expect(skill).toContain("Do not add primary-plus-fallback routes");
  });

  it("keeps hooks silent by default and emits only basic MCP guidance when configured", async () => {
    const postEdit = await import(
      pathToFileURL(path.join(pluginRoot, "hooks/post-edit-feedback.js")).href
    );
    const sessionStart = await import(
      pathToFileURL(path.join(pluginRoot, "hooks/session-start.js")).href
    );
    const common = await import(
      pathToFileURL(path.join(pluginRoot, "hooks/hook-common.js")).href
    );

    expect(
      postEdit.buildPostEditContext(
        {
          tool_name: "write_file",
          tool_input: { path: "src/app.ts" }
        },
        {}
      )
    ).toBeUndefined();
    expect(
      postEdit.buildPostEditContext(
        {
          tool_name: "write_file",
          tool_input: { path: "src/app.ts" }
        },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).toBeUndefined();
    expect(postEdit.extractChangedFiles({ tool_input: { path: "src/app.ts" } })).toEqual([
      "src/app.ts"
    ]);
    expect(
      postEdit.buildPostEditContext(
        {
          cwd: "/repo",
          tool_name: "write_file",
          tool_input: { path: "generated/out.txt" }
        },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).toBe("Generated/local artifact changed: generated/out.txt.");
    expect(
      postEdit.buildPostEditContext(
        {
          cwd: "/repo",
          tool_name: "write_file",
          tool_input: { path: "/repo/.cache/agent-workbench/index.db" }
        },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).toBe("Generated/local artifact changed: .cache/agent-workbench/index.db.");
    expect(
      postEdit.buildPostEditContext(
        {
          cwd: "/repo",
          tool_name: "write_file",
          tool_input: { path: "/outside/file.txt" }
        },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).toBe("Workspace escape path reported: ../outside/file.txt.");

    const hookFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-hook-"));
    fs.mkdirSync(path.join(hookFixtureRoot, "src"), { recursive: true });
    fs.writeFileSync(path.join(hookFixtureRoot, "src", "valid.json"), "{\"ok\": true}\n");
    fs.writeFileSync(path.join(hookFixtureRoot, "src", "invalid.json"), "{\"ok\": \n");
    fs.writeFileSync(path.join(hookFixtureRoot, "src", "bad.py"), "def broken(:\n");
    fs.writeFileSync(path.join(hookFixtureRoot, "src", "bad.js"), "function broken( {\n");
    fs.writeFileSync(path.join(hookFixtureRoot, "src", "bad.sh"), "if true; then\n");
    fs.writeFileSync(path.join(hookFixtureRoot, "src", "bad.toml"), "[tool.\n");
    fs.writeFileSync(
      path.join(hookFixtureRoot, "src", "conflict.md"),
      "<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\n"
    );

    expect(
      postEdit.buildPostEditContext(
        { cwd: hookFixtureRoot, tool_input: { path: "src/valid.json" } },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).toBeUndefined();
    expect(
      postEdit.buildPostEditContext(
        { cwd: hookFixtureRoot, tool_input: { path: "src/invalid.json" } },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).toContain("JSON syntax error in src/invalid.json");
    expect(
      postEdit.buildPostEditContext(
        { cwd: hookFixtureRoot, tool_input: { path: "src/bad.py" } },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).toContain("Python syntax error in src/bad.py");
    expect(
      postEdit.buildPostEditContext(
        { cwd: hookFixtureRoot, tool_input: { path: "src/bad.js" } },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).toContain("JavaScript syntax error in src/bad.js");
    expect(
      postEdit.buildPostEditContext(
        { cwd: hookFixtureRoot, tool_input: { path: "src/bad.sh" } },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).toContain("Shell syntax error in src/bad.sh");
    expect(
      postEdit.buildPostEditContext(
        { cwd: hookFixtureRoot, tool_input: { path: "src/bad.toml" } },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).toContain("TOML syntax error in src/bad.toml");
    expect(
      postEdit.buildPostEditContext(
        { cwd: hookFixtureRoot, tool_input: { path: "src/conflict.md" } },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).toBe("Merge conflict marker in src/conflict.md.");
    expect(
      postEdit.buildPostEditContext(
        {
          cwd: hookFixtureRoot,
          tool_input: { path: "src/invalid.json" },
          tool_response: { code: 1 }
        },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).toBeUndefined();
    expect(
      sessionStart.buildSessionStartContext(
        { cwd: "/repo" },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).toBe("Agent Workbench MCP is available. Use repo:///status, repo:///scope, or repo:///overview when repository context is unclear.");
    expect(
      sessionStart.buildSessionStartContext(
        { cwd: "/repo" },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).not.toContain("/repo");
    expect(common.buildAdditionalContextOutput("SessionStart", "hello")).toEqual({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: "hello"
      }
    });
    expect(common.buildAdditionalContextOutput("PostToolUse", "hello")).toEqual({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: "hello"
      }
    });
  });

  it("keeps MCP launch owned by the host-level repository checkout entrypoint", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pluginRoot, ".codex-plugin/plugin.json"), "utf8")
    ) as {
      mcpServers?: string;
    };
    const profile = codexIntegrationProfileSchema.parse(describeCodexIntegrationProfile());
    const mcpSurface = profile.active_surfaces.find((entry) => entry.surface === "mcp");
    const pluginSurface = profile.active_surfaces.find((entry) => entry.surface === "plugins");

    expect(manifest.mcpServers).toBeUndefined();
    expect(fs.existsSync(path.join(pluginRoot, ".mcp.json"))).toBe(false);
    expect(mcpSurface).toEqual(
      expect.objectContaining({
        artifact_path: "src/mcp/stdio.ts"
      })
    );
    expect(pluginSurface?.behavior).toEqual(
      expect.arrayContaining([
        "Does not register an MCP server for local development.",
        "Relies on host-level Codex MCP configuration to launch the repository checkout runtime."
      ])
    );
    expect(profile.plugin.mcp_config_path).toBeUndefined();
    expect(profile.plugin.mcp_binding_model).toBe("host_level_config_required");
  });

  it("keeps plugin wrappers out of concrete runtime implementation paths", () => {
    const files = listFiles(pluginRoot);

    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      expect(text, path.relative(pluginRoot, file)).not.toMatch(/src\/(?:application|domain|infrastructure|presentation|interface-adapters)/);
      expect(text, path.relative(pluginRoot, file)).not.toContain("tree-sitter");
      expect(text, path.relative(pluginRoot, file)).not.toContain("better-sqlite3");
    }
  });
});

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}
