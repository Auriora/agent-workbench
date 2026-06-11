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
import {
  mcpPrompts,
  mcpResources,
  mcpTools
} from "../../src/interface-adapters/mcp/registries/index.js";
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
          name: "integration-health",
          uri: "integration:///health/agent-workbench",
          kind: "resource",
          capability_class: "read_only"
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

  it("documents plugin-owned runtime update semantics for source and dependency changes", () => {
    const profile = codexIntegrationProfileSchema.parse(describeCodexIntegrationProfile());
    const mcpSurface = profile.active_surfaces.find((entry) => entry.surface === "mcp");
    const sourceDependencyArtifact = profile.artifacts.find(
      (artifact) => artifact.surface === "mcp" && artifact.path === "src/mcp/stdio.ts"
    );

    expect(profile.runtime_source).toBe("repository_checkout");
    expect(profile.plugin.runtime_source).toBe("repository_checkout_or_installed_package");
    expect(profile.plugin.packaging_model).toBe(
      "plugin_bundled_skill_hooks_and_mcp_plus_install_package"
    );
    expect(profile.plugin.mcp_binding_model).toBe("plugin_bundled_mcp_config");
    expect(profile.plugin.mcp_config_path).toBe("plugins/agent-workbench/.mcp.json");
    expect(profile.plugin.update_model.source_changes).toMatch(/package containing the updated runtime source/i);
    expect(profile.plugin.update_model.source_changes).toMatch(/reinstall the Codex plugin/i);
    expect(profile.plugin.update_model.dependency_changes).toMatch(/restart Codex/i);
    expect(profile.plugin.update_model.dependency_changes).toMatch(/rebuilt dependencies/i);
    expect(profile.install_package).toMatchObject({
      registry: "ghcr.io",
      image: "ghcr.io/bcherrington/agent-workbench",
      containerfile_path: "packaging/agent-workbench/Containerfile",
      installer_path: "scripts/install-agent-workbench-package.sh",
      release_workflow_path: ".github/workflows/release-ghcr.yml"
    });
    expect(profile.install_package.dependency_install_model).toContain(
      "pnpm install --frozen-lockfile"
    );
    expect(profile.install_package.dependency_install_model).toContain("pnpm rebuild:native");
    expect(profile.install_package.installed_components).toEqual(
      expect.arrayContaining([
        "src",
        "docs",
        "plugins/agent-workbench",
        "plugins/agent-workbench/hooks",
        "plugins/agent-workbench/skills",
        "package.json",
        "pnpm-lock.yaml",
        "tsconfig.json",
        "AGENTS.md"
      ])
    );
    expect(profile.install_package.mcp_install_model).toMatch(/plugin-bundled \.mcp\.json/);
    expect(profile.install_package.hook_install_model).toMatch(/plugin-bundled hooks\/hooks\.json/);
    expect(profile.guardrails).toEqual(
      expect.arrayContaining([
        "Source edits require package reinstall, plugin reinstall, and Codex restart to reload MCP source behavior.",
        "The GHCR package must include runtime source, docs, plugin manifest, plugin MCP config, skills, hooks, installer, and release metadata."
      ])
    );
    expect(profile.runtime_version).toBe("0.1.0");
    expect(mcpSurface?.constraints).toEqual(
      expect.arrayContaining(["Source edits are picked up after package reinstall and Codex restart."])
    );
    expect(mcpSurface?.behavior).toEqual(
      expect.arrayContaining([
        "Launches the production MCP server through the installed package launcher.",
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
      "integration:///health/agent-workbench",
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

  it("ships a valid plugin manifest, MCP config, skill, and hook config", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pluginRoot, ".codex-plugin/plugin.json"), "utf8")
    ) as {
      name: string;
      skills: string;
      mcpServers: string;
      hooks?: string;
    };
    const mcpConfig = JSON.parse(fs.readFileSync(path.join(pluginRoot, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, { command: string; args: string[]; startup_timeout_sec: number }>;
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
      skills: "./skills/",
      mcpServers: "./.mcp.json"
    });
    expect(manifest.hooks).toBeUndefined();
    expect(mcpConfig.mcpServers["agent-workbench"]).toMatchObject({
      command: "bash",
      startup_timeout_sec: 30.0,
      args: expect.arrayContaining([
        "exec \"${AGENT_WORKBENCH_INSTALL_ROOT:-$HOME/.local/share/agent-workbench}/bin/agent-workbench-mcp\""
      ])
    });
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

  it("keeps MCP launch owned by plugin config without using the plugin cache as runtime", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pluginRoot, ".codex-plugin/plugin.json"), "utf8")
    ) as {
      mcpServers: string;
    };
    const mcpConfig = JSON.parse(fs.readFileSync(path.join(pluginRoot, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, { command: string; args: string[]; startup_timeout_sec: number }>;
    };
    const profile = codexIntegrationProfileSchema.parse(describeCodexIntegrationProfile());
    const mcpSurface = profile.active_surfaces.find((entry) => entry.surface === "mcp");
    const pluginSurface = profile.active_surfaces.find((entry) => entry.surface === "plugins");

    expect(manifest.mcpServers).toBe("./.mcp.json");
    expect(mcpConfig.mcpServers["agent-workbench"].args.join(" ")).toContain(
      "/bin/agent-workbench-mcp"
    );
    expect(mcpConfig.mcpServers["agent-workbench"].args.join(" ")).not.toContain(
      "plugins/cache"
    );
    expect(mcpConfig.mcpServers["agent-workbench"].startup_timeout_sec).toBe(30.0);
    expect(mcpSurface).toEqual(
      expect.objectContaining({
        artifact_path: "plugins/agent-workbench/.mcp.json"
      })
    );
    expect(pluginSurface?.behavior).toEqual(
      expect.arrayContaining([
        "Registers the Agent Workbench MCP server through plugin-bundled .mcp.json.",
        "Loads lifecycle hooks from plugin-bundled hooks/hooks.json.",
        "Launches the installed package entrypoint instead of runtime code copied into the plugin cache."
      ])
    );
    expect(profile.plugin.mcp_config_path).toBe("plugins/agent-workbench/.mcp.json");
    expect(profile.plugin.mcp_binding_model).toBe("plugin_bundled_mcp_config");
  });

  it("ships GHCR package metadata and an installer that covers runtime, plugin, skills, and hooks", () => {
    const manifestPath = path.resolve("packaging/agent-workbench/package-manifest.json");
    const containerfilePath = path.resolve("packaging/agent-workbench/Containerfile");
    const installerPath = path.resolve("scripts/install-agent-workbench-package.sh");
    const workflowPath = path.resolve(".github/workflows/release-ghcr.yml");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      registry: string;
      image: string;
      containerfile: string;
      installer: string;
      dependency_install: {
        package_manager: string;
        node: string;
        install_command: string;
        native_rebuild_command: string;
        native_build_tools: string[];
        runtime_dependencies: string[];
        dev_dependencies: string[];
        native_build_script_dependencies: string[];
      };
      components: string[];
      excluded_components: string[];
      codex: {
        plugin_mcp_config: string;
        plugin_hooks: string;
        plugin_install_model: string;
      };
    };
    const packageJson = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      pnpm: {
        onlyBuiltDependencies: string[];
      };
    };
    const containerfile = fs.readFileSync(containerfilePath, "utf8");
    const installer = fs.readFileSync(installerPath, "utf8");
    const workflow = fs.readFileSync(workflowPath, "utf8");

    expect(manifest).toMatchObject({
      registry: "ghcr.io",
      image: "ghcr.io/bcherrington/agent-workbench",
      containerfile: "packaging/agent-workbench/Containerfile",
      installer: "scripts/install-agent-workbench-package.sh"
    });
    expect(manifest.dependency_install).toMatchObject({
      package_manager: "pnpm@10.18.1",
      node: ">=22",
      install_command: "pnpm install --frozen-lockfile",
      native_rebuild_command: "pnpm rebuild:native"
    });
    expect(manifest.dependency_install.runtime_dependencies.sort()).toEqual(
      Object.keys(packageJson.dependencies).sort()
    );
    expect(manifest.dependency_install.dev_dependencies.sort()).toEqual(
      Object.keys(packageJson.devDependencies).sort()
    );
    expect(manifest.dependency_install.native_build_script_dependencies.sort()).toEqual(
      [...packageJson.pnpm.onlyBuiltDependencies].sort()
    );
    expect(manifest.dependency_install.native_build_tools).toEqual(["python3", "make", "c++"]);
    expect(packageJson.dependencies).toHaveProperty("tsx");
    expect(manifest.components).toEqual(
      expect.arrayContaining([
        "src",
        "docs",
        "plugins/agent-workbench",
        "plugins/agent-workbench/hooks",
        "plugins/agent-workbench/skills",
        "package.json",
        "pnpm-lock.yaml",
        "tsconfig.json",
        "AGENTS.md"
      ])
    );
    expect(manifest.excluded_components).toEqual(
      expect.arrayContaining(["docs/specs", "src/debug", "package.json scripts matching debug:*"])
    );
    expect(manifest.codex.plugin_mcp_config).toBe("plugins/agent-workbench/.mcp.json");
    expect(manifest.codex.plugin_hooks).toBe("plugins/agent-workbench/hooks/hooks.json");
    expect(manifest.codex.plugin_install_model).toBe("scripts/install-agent-workbench-package.sh");
    expect(containerfile).toContain("FROM node:24-bookworm-slim");
    expect(containerfile).toContain("COPY src ./src");
    expect(containerfile).toContain("rm -rf src/debug");
    expect(containerfile).toContain("docs/specs");
    expect(containerfile).toContain('k.startsWith("debug:")');
    expect(containerfile).toContain("COPY docs ./docs");
    expect(containerfile).toContain("COPY plugins ./plugins");
    expect(containerfile).toContain("pnpm install --frozen-lockfile");
    expect(containerfile).toContain("/opt/agent-workbench/src/mcp/stdio.ts");
    expect(installer).toContain("plugins/agent-workbench/.mcp.json");
    expect(installer).toContain("plugins/agent-workbench/hooks/hooks.json");
    expect(installer).toContain("Node.js 22 or newer is required");
    expect(installer).toContain("pnpm 10.18.1 is required");
    expect(installer).toContain("ensure_native_build_prerequisites");
    expect(installer).toContain("sanitize_deployed_runtime");
    expect(installer).toContain('rm -rf "$INSTALL_ROOT/src/debug"');
    expect(installer).toContain('rm -rf "$INSTALL_ROOT/docs/specs"');
    expect(installer).toContain('name.startsWith("debug:")');
    expect(installer).toContain("install_codex_plugin");
    expect(installer).toContain("codex plugin add");
    expect(installer).toContain("remove_legacy_agent_workbench_mcp_block");
    expect(installer).toContain('if [ -z "\\${AGENT_WORKBENCH_DEFAULT_REPO_ROOT:-}" ]; then');
    expect(installer).toContain('export AGENT_WORKBENCH_DEFAULT_REPO_ROOT="\\$PWD"');
    expect(installer.indexOf('export AGENT_WORKBENCH_DEFAULT_REPO_ROOT="\\$PWD"')).toBeLessThan(
      installer.indexOf('cd "$INSTALL_ROOT"')
    );
    expect(installer).not.toContain("write_user_hooks_json");
    expect(installer).not.toContain("$CODEX_HOME/hooks.json");
    expect(installer).not.toContain("[mcp_servers.agent-workbench]");
    expect(installer).not.toContain("[[hooks.SessionStart]]");
    expect(installer).not.toContain("[[hooks.PostToolUse]]");
    expect(workflow).toContain("registry: ghcr.io");
    expect(workflow).toContain("packaging/agent-workbench/Containerfile");
  });

  it("keeps cross-repo debug harnesses checkout-only", () => {
    const containerfile = fs.readFileSync(path.resolve("packaging/agent-workbench/Containerfile"), "utf8");
    const installer = fs.readFileSync(path.resolve("scripts/install-agent-workbench-package.sh"), "utf8");
    const packageJson = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const publicSurfaceNames = [...mcpResources, ...mcpTools, ...mcpPrompts].map((surface) => surface.name);

    expect(packageJson.scripts["debug:mcp-tool-sweep"]).toBe("tsx src/debug/mcp-tool-sweep.ts");
    expect(publicSurfaceNames).not.toContain("debug:mcp-tool-sweep");
    expect(publicSurfaceNames).not.toContain("mcp_tool_sweep");
    expect(containerfile).toContain("rm -rf src/debug");
    expect(containerfile).toContain("docs/specs");
    expect(containerfile).toContain('k.startsWith("debug:")');
    expect(installer).toContain('rm -rf "$INSTALL_ROOT/src/debug"');
    expect(installer).toContain('rm -rf "$INSTALL_ROOT/docs/specs"');
    expect(installer).toContain('name.startsWith("debug:")');
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
