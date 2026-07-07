/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

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
import {
  parseMcpResourceText,
  registeredResourceUris,
  registerMcpResource
} from "../helpers/mcp-harness.js";

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
          default_mode: "basic_feedback",
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
      verification_status: "done",
      trust: {
        safe_to_use_for: expect.arrayContaining(["navigation", "next_read_selection"]),
        not_safe_to_use_for: expect.arrayContaining(["runtime_availability", "task_completion_claim"])
      }
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
    expect(profile.install_package.hook_install_model).toMatch(/CODEX_HOME\/hooks\.json/);
    expect(profile.install_package.hook_install_model).toMatch(/absolute paths/);
    expect(profile.guardrails).toEqual(
      expect.arrayContaining([
        "Source edits require package reinstall, plugin reinstall, and Codex restart to reload MCP source behavior.",
        "The GHCR package must include runtime source, docs, plugin manifest, plugin MCP config, skills, hooks, installer, and release metadata."
      ])
    );
    expect(profile.runtime_version).toBe("0.1.0");
    expect(mcpSurface?.constraints).toEqual(
      expect.arrayContaining([
        "Plugin cache cwd must not be used as the default workspace root.",
        "Source edits are picked up after package reinstall and Codex restart."
      ])
    );
    expect(mcpSurface?.behavior).toEqual(
      expect.arrayContaining([
        "Launches the production MCP server through the installed package launcher.",
        "Preserves Codex's session cwd as the default repo root by materializing the installed MCP config to an absolute shim path without overriding cwd.",
        "Supports explicit repo roots through arguments or AGENT_WORKBENCH_DEFAULT_REPO_ROOT for fixed-target launches."
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
    const registered = registerMcpResource(codexIntegrationProfileResource, {
      repoRoot: "/repo"
    });

    expect(registered).toMatchObject({
      name: "codex-integration-profile",
      uri: "integration:///profiles/codex"
    });

    const response = await registered.readCallback({});
    const parsed = parseMcpResourceText<{
      data: { plugin: { update_model: { copied_runtime_allowed: boolean } } };
    }>(response);

    expect(parsed.data.plugin.update_model.copied_runtime_allowed).toBe(false);
  });

  it("is exposed by the composed server alongside repo resources", () => {
    const server = createAgentWorkbenchServer(".", { startGraphWarmup: false });

    expect(registeredResourceUris(server)).toEqual([
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
      mcpServers: Record<string, { command: string; cwd?: string; args: string[]; startup_timeout_sec: number }>;
    };
    const pluginRunbook = fs.readFileSync(path.resolve("docs/runbooks/codex-agent-workbench-plugin.md"), "utf8");
    const hooksConfig = JSON.parse(
      fs.readFileSync(path.join(pluginRoot, "hooks/hooks.json"), "utf8")
    ) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string; cwd?: string; args?: string[] }> }>>;
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
    // Spec 033: shell-free exec-form launch via the portable MCP shim.
    expect(mcpConfig.mcpServers["agent-workbench"]).toMatchObject({
      command: "node",
      startup_timeout_sec: 30.0,
      args: ["${PLUGIN_ROOT}/mcp-launch.mjs"]
    });
    expect(mcpConfig.mcpServers["agent-workbench"].cwd).toBeUndefined();
    expect(pluginRunbook).toContain("RCA checklist for this failure mode");
    expect(pluginRunbook).toContain("leaves `cwd` unset");
    expect(pluginRunbook).toContain("rejects a Codex MCP `cwd`");
    expect(hooksConfig.hooks).toEqual({});
    expect(JSON.stringify(hooksConfig)).not.toContain("${PLUGIN_ROOT}");
    expect(skill).toContain("Agent Workbench is the executable runtime.");
    expect(skill).toContain("Do not add primary-plus-fallback routes");
  });

  it("ships repo-level marketplace metadata for the checked-in Codex plugin", () => {
    const marketplace = JSON.parse(
      fs.readFileSync(path.resolve(".agents/plugins/marketplace.json"), "utf8")
    ) as {
      name: string;
      interface: { displayName: string };
      plugins: Array<{
        name: string;
        source: { source: string; path: string };
        policy: { installation: string; authentication: string };
        category: string;
      }>;
    };
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pluginRoot, ".codex-plugin/plugin.json"), "utf8")
    ) as { name: string; interface: { category: string } };

    expect(marketplace.name).toBe("auriora-local");
    expect(marketplace.interface.displayName).toBe("Auriora Local");
    expect(marketplace.plugins).toHaveLength(1);
    expect(marketplace.plugins[0]).toEqual({
      name: manifest.name,
      source: {
        source: "local",
        path: "./plugins/agent-workbench"
      },
      policy: {
        installation: "AVAILABLE",
        authentication: "ON_INSTALL"
      },
      category: manifest.interface.category
    });
    expect(fs.existsSync(path.resolve(marketplace.plugins[0].source.path))).toBe(true);
  });

  it("ships a package-scoped Codex marketplace inside the plugin for turnkey npm registration", () => {
    // The npm package ships a package-scoped marketplace at
    // plugins/agent-workbench/.agents/plugins/marketplace.json so that
    // `codex plugin marketplace add <pkg>/plugins/agent-workbench` registers
    // `agent-workbench-local` clone-free, mirroring the Claude marketplace.
    // The repo-root `.agents/plugins/marketplace.json` (auriora-local) stays
    // for the checkout dev workflow; this one is named differently so the two
    // never collide.
    const marketplacePath = path.join(pluginRoot, ".agents/plugins/marketplace.json");
    expect(fs.existsSync(marketplacePath)).toBe(true);
    const marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8")) as {
      name: string;
      plugins: Array<{
        name: string;
        source: { source: string; path: string };
        policy: { installation: string; authentication: string };
        category: string;
      }>;
    };
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pluginRoot, ".codex-plugin/plugin.json"), "utf8")
    ) as { name: string; interface: { category: string } };

    expect(marketplace.name).toBe("agent-workbench-local");
    expect(marketplace.name).not.toBe("auriora-local");
    expect(marketplace.plugins).toHaveLength(1);
    expect(marketplace.plugins[0]).toEqual({
      name: manifest.name,
      source: {
        source: "local",
        path: "."
      },
      policy: {
        installation: "AVAILABLE",
        authentication: "ON_INSTALL"
      },
      category: manifest.interface.category
    });
    // source "." must resolve to the Codex plugin root (the dir with .codex-plugin/plugin.json).
    expect(fs.existsSync(path.join(pluginRoot, ".codex-plugin/plugin.json"))).toBe(true);
  });

  it("keeps MCP server-card metadata synchronized with registered resources and tools", () => {
    const serverCard = JSON.parse(
      fs.readFileSync(path.resolve(".well-known/mcp/server-card.json"), "utf8")
    ) as {
      id: string;
      version: string;
      transport: { type: string; local: boolean; command: string };
      privacy: { local_first: boolean; network_required: boolean; data_leaves_machine: boolean };
      setup: { codex_plugin: string; mcp_config: string; runbook: string };
      resources: Array<{
        name: string;
        uri: string;
        description: string;
        capability_class: string;
        mutation_class: string;
        budget_policy: string;
      }>;
      tools: Array<{
        name: string;
        description: string;
        capability_class: string;
        mutation_class: string;
        budget_policy: string;
      }>;
    };
    const packageJson = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8")) as {
      version: string;
    };

    expect(serverCard.id).toBe("agent-workbench");
    expect(serverCard.version).toBe(packageJson.version);
    expect(serverCard.transport).toMatchObject({
      type: "stdio",
      local: true,
      command: "agent-workbench-mcp"
    });
    expect(serverCard.privacy).toMatchObject({
      local_first: true,
      network_required: false,
      data_leaves_machine: false
    });
    expect(serverCard.setup).toMatchObject({
      codex_plugin: "plugins/agent-workbench",
      mcp_config: "plugins/agent-workbench/.mcp.json",
      runbook: "docs/runbooks/codex-agent-workbench-plugin.md"
    });

    expect(serverCard.resources).toEqual(
      mcpResources.map((resource) => ({
        name: resource.name,
        uri: resource.uri,
        description: resource.metadata.description,
        capability_class: resource.metadata.capability_class,
        mutation_class: resource.metadata.mutation_class,
        budget_policy: resource.metadata.budget_policy
      }))
    );
    expect(serverCard.tools).toEqual(
      mcpTools.map((tool) => ({
        name: tool.name,
        description: tool.metadata.description,
        capability_class: tool.metadata.capability_class,
        mutation_class: tool.metadata.mutation_class,
        budget_policy: tool.metadata.budget_policy
      }))
    );
  });

  it("keeps the Codex integration profile bound to registered MCP resources and tools", () => {
    const profile = codexIntegrationProfileSchema.parse(describeCodexIntegrationProfile());
    const expectedBindings = [
      ...mcpResources.map((resource) => ({
        name: resource.name,
        uri: resource.uri,
        kind: "resource",
        capability_class: resource.metadata.capability_class
      })),
      ...mcpTools.map((tool) => ({
        name: tool.name,
        uri: undefined,
        kind: "tool",
        capability_class: tool.metadata.capability_class
      }))
    ].sort(compareBindings);
    const actualBindings = profile.mcp_bindings
      .map((binding) => ({
        name: binding.name,
        uri: binding.uri,
        kind: binding.kind,
        capability_class: binding.capability_class
      }))
      .sort(compareBindings);

    expect(actualBindings).toEqual(expectedBindings);
  });

  it("maps plugin default prompts to registered MCP surfaces or documented workflows", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pluginRoot, ".codex-plugin/plugin.json"), "utf8")
    ) as {
      interface: { defaultPrompt: string[] };
    };
    const registeredNames = new Set([
      ...mcpResources.map((resource) => resource.name),
      ...mcpTools.map((tool) => tool.name),
      ...mcpPrompts.map((prompt) => prompt.name)
    ]);
    const registeredUris = new Set(mcpResources.map((resource) => resource.uri));
    const defaultPromptBindings: Record<
      string,
      { resources?: string[]; tools?: string[]; workflows?: string[] }
    > = {
      "Check Agent Workbench status for this repo.": {
        resources: ["repo:///status", "repo:///scope", "repo:///overview"]
      },
      "Plan context and validation with Agent Workbench.": {
        tools: ["context_for_task", "verification_plan"]
      },
      "Show the Codex integration profile.": {
        resources: ["integration:///profiles/codex"]
      }
    };

    expect(manifest.interface.defaultPrompt).toEqual(Object.keys(defaultPromptBindings));

    for (const [prompt, bindings] of Object.entries(defaultPromptBindings)) {
      expect(manifest.interface.defaultPrompt).toContain(prompt);

      for (const resourceUri of bindings.resources ?? []) {
        expect(registeredUris, `${prompt} -> ${resourceUri}`).toContain(resourceUri);
      }

      for (const toolName of bindings.tools ?? []) {
        expect(registeredNames, `${prompt} -> ${toolName}`).toContain(toolName);
      }
    }
  });

  it("keeps skill guidance aligned with supported MCP workflows and install boundaries", () => {
    const skill = fs.readFileSync(
      path.join(pluginRoot, "skills/agent-workbench/SKILL.md"),
      "utf8"
    );

    expect(skill).toContain("repo:///status");
    expect(skill).toContain("repo:///scope");
    expect(skill).toContain("repo:///overview");
    expect(skill).toContain("context_for_task");
    expect(skill).toContain("verification_plan");
    expect(skill).toContain("integration:///profiles/codex");
    expect(skill).toContain("spec-lifecycle-manager");
    expect(skill).toContain("Do not add primary-plus-fallback routes");
    expect(skill).not.toMatch(/\borient_repo\b/);
    expect(skill).not.toMatch(/\brepo_preflight\b/);
    expect(skill).not.toMatch(/\bmcp_tool_sweep\b/);
    expect(skill).not.toContain("debug:mcp-tool-sweep");
    expect(skill).not.toMatch(/SessionStart[^.\n]*(?:install|update|repair)/i);
    expect(skill).not.toMatch(/(?:auto|automatically)[ -]?(?:install|update|repair)/i);
    expect(skill).not.toContain("~/.codex/hooks.json");
    expect(skill).not.toContain("plugins/cache");
  });

  it("keeps durable docs from naming stale core MCP surfaces", () => {
    const runbook = fs.readFileSync(
      path.resolve("docs/runbooks/codex-agent-workbench-plugin.md"),
      "utf8"
    );
    const pluginReadme = fs.readFileSync(path.join(pluginRoot, "README.md"), "utf8");
    const documentationMap = fs.readFileSync(
      path.resolve("docs/reference/documentation-map.md"),
      "utf8"
    );
    const durableDocs = `${runbook}\n${pluginReadme}\n${documentationMap}`;

    for (const name of [
      "context_for_task",
      "verification_plan",
      "codex-integration-profile",
      "integration-health"
    ]) {
      expect(durableDocs, name).toContain(name);
    }

    for (const uri of [
      "repo:///status",
      "repo:///scope",
      "repo:///overview",
      "integration:///profiles/codex",
      "integration:///health/agent-workbench"
    ]) {
      expect(durableDocs, uri).toContain(uri);
    }

    expect(durableDocs).toContain(".well-known/mcp/server-card.json");
    expect(durableDocs).not.toMatch(/\borient_repo\b/);
    expect(durableDocs).not.toMatch(/\brepo_preflight\b/);
    expect(durableDocs).not.toMatch(/\bmcp_tool_sweep\b/);
    expect(durableDocs).not.toContain("[mcp_servers.agent-workbench]");
  });

  it("keeps hooks quiet by default and allows explicit silent opt-out", async () => {
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
        {}
      )
    ).toBe("Generated/local artifact changed: generated/out.txt.");
    expect(
      postEdit.buildPostEditContext(
        {
          cwd: "/repo",
          tool_name: "write_file",
          tool_input: { path: "generated/out.txt" }
        },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "silent" }
      )
    ).toBeUndefined();
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
    const sessionContext = sessionStart.buildSessionStartContext(
      { cwd: "/repo" },
      {}
    );
    expect(sessionStart.buildSessionStartContext(
      { cwd: "/repo" },
      { AGENT_WORKBENCH_HOOK_FEEDBACK: "silent" }
    )).toBeUndefined();
    for (const source of ["resume", "clear", "compact"]) {
      expect(sessionStart.buildSessionStartContext(
        { cwd: "/repo", hook_event_name: "SessionStart", source },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )).toBeUndefined();
    }
    expect(sessionContext).toContain("Agent Workbench MCP is available.\nRepo orientation:");
    expect(sessionContext).toContain("- root: /repo");
    expect(sessionContext).toContain("dirty state not inspected");
    expect(sessionContext).toContain("tool_search");
    expect(sessionContext).toContain("context_for_task verification_plan diagnostics_for_files docs_search");

    const sessionFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-session-"));
    fs.mkdirSync(path.join(sessionFixtureRoot, "src"), { recursive: true });
    fs.mkdirSync(path.join(sessionFixtureRoot, "tests"), { recursive: true });
    fs.mkdirSync(path.join(sessionFixtureRoot, "docs/specs/034-session-context"), {
      recursive: true
    });
    fs.mkdirSync(path.join(sessionFixtureRoot, ".git"), { recursive: true });
    fs.writeFileSync(path.join(sessionFixtureRoot, "package.json"), "{\"type\":\"module\"}\n");
    fs.writeFileSync(
      path.join(sessionFixtureRoot, ".git/HEAD"),
      "ref: refs/heads/feature/session-context\n"
    );
    const fixtureSessionContext = sessionStart.buildSessionStartContext(
      { cwd: sessionFixtureRoot },
      { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
    );
    expect(fixtureSessionContext).toContain("- roots: src, tests, docs");
    expect(fixtureSessionContext).toContain("- config: package.json");
    expect(fixtureSessionContext).toContain("- specs: 1 package(s): 034-session-context");
    expect(fixtureSessionContext).toContain("- git: branch feature/session-context");
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
      mcpServers: Record<string, { command: string; cwd?: string; args: string[]; startup_timeout_sec: number }>;
    };
    const profile = codexIntegrationProfileSchema.parse(describeCodexIntegrationProfile());
    const mcpSurface = profile.active_surfaces.find((entry) => entry.surface === "mcp");
    const pluginSurface = profile.active_surfaces.find((entry) => entry.surface === "plugins");

    expect(manifest.mcpServers).toBe("./.mcp.json");
    // Spec 033: shell-free exec-form launch via the portable shim. The .mcp.json
    // names the plugin-root shim without overriding cwd; the shim resolves the
    // install prefix and runtime internals (src/mcp, tsx, node_modules) at launch
    // — none of those leak here.
    expect(mcpConfig.mcpServers["agent-workbench"].command).toBe("node");
    expect(mcpConfig.mcpServers["agent-workbench"].cwd).toBeUndefined();
    expect(mcpConfig.mcpServers["agent-workbench"].args).toEqual(["${PLUGIN_ROOT}/mcp-launch.mjs"]);
    expect(mcpConfig.mcpServers["agent-workbench"].startup_timeout_sec).toBe(30.0);
    const codexMcpArgs = mcpConfig.mcpServers["agent-workbench"].args.join(" ");
    expect(codexMcpArgs).not.toContain("plugins/cache");
    expect(codexMcpArgs).not.toContain("-lc");
    expect(codexMcpArgs).not.toContain("${VAR:-");
    expect(codexMcpArgs).not.toContain("src/mcp");
    expect(codexMcpArgs).not.toContain("tsx");
    expect(codexMcpArgs).not.toContain("node_modules");
    expect(mcpSurface).toEqual(
      expect.objectContaining({
        artifact_path: "plugins/agent-workbench/.mcp.json"
      })
    );
    expect(pluginSurface?.behavior).toEqual(
      expect.arrayContaining([
        "Registers the Agent Workbench MCP server through plugin-bundled .mcp.json.",
        "Installs lifecycle hooks into CODEX_HOME/hooks.json with absolute package paths.",
        "Launches the installed package entrypoint instead of runtime code copied into the plugin cache."
      ])
    );
    expect(profile.plugin.mcp_config_path).toBe("plugins/agent-workbench/.mcp.json");
    expect(profile.plugin.mcp_binding_model).toBe("plugin_bundled_mcp_config");
  });

  it("ships GHCR container metadata plus npm install metadata covering runtime, plugin, skills, and hooks", () => {
    const manifestPath = path.resolve("packaging/agent-workbench/package-manifest.json");
    const containerfilePath = path.resolve("packaging/agent-workbench/Containerfile");
    const workflowPath = path.resolve(".github/workflows/release-ghcr.yml");
    const ciWorkflowPath = path.resolve(".github/workflows/ci.yml");
    const pluginValidatorPath = path.resolve("scripts/validate-agent-workbench-plugin.mjs");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      registry: string;
      image: string;
      version: string;
      containerfile: string;
      install_command: string;
      npm_bin: string;
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
        hook_installer: string;
        plugin_install_model: string;
      };
    };
    const packageJson = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8")) as {
      bin: Record<string, string>;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      pnpm: {
        onlyBuiltDependencies: string[];
      };
    };
    const containerfile = fs.readFileSync(containerfilePath, "utf8");
    const workflow = fs.readFileSync(workflowPath, "utf8");
    const ciWorkflow = fs.readFileSync(ciWorkflowPath, "utf8");
    const pluginValidator = fs.readFileSync(pluginValidatorPath, "utf8");
    const expectedInstallCommand = `npm install -g https://github.com/Auriora/agent-workbench/releases/download/v${manifest.version}/auriora-agent-workbench-${manifest.version}.tgz`;

    expect(manifest).toMatchObject({
      registry: "ghcr.io",
      image: "ghcr.io/bcherrington/agent-workbench",
      containerfile: "packaging/agent-workbench/Containerfile",
      install_command: expectedInstallCommand,
      npm_bin: "packaging/agent-workbench/mcp-bin.mjs"
    });
    // The container build still uses pnpm; the manifest's dependency_install
    // describes that build, not the npm consumer install.
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
    expect(manifest.codex.hook_installer).toBe("scripts/install-codex-hooks.mjs");
    expect(manifest.codex.plugin_install_model).toBe(expectedInstallCommand);
    expect(containerfile).toContain("FROM node:24-bookworm-slim");
    expect(containerfile).toContain("COPY src ./src");
    expect(containerfile).toContain("rm -rf src/debug");
    expect(containerfile).toContain("docs/specs");
    expect(containerfile).toContain('k.startsWith("debug:")');
    expect(containerfile).toContain("COPY docs ./docs");
    expect(containerfile).toContain("COPY plugins ./plugins");
    expect(containerfile).toContain("pnpm install --frozen-lockfile");
    expect(containerfile).toContain("/opt/agent-workbench/src/mcp/stdio.ts");
    // Spec 033 (npm model): the package is launched in place — no copy-to-prefix
    // installer. The `agent-workbench-mcp` bin self-locates the runtime, and a
    // postinstall records the pointer the plugin launcher reads.
    expect(packageJson.bin["agent-workbench-mcp"]).toBe("packaging/agent-workbench/mcp-bin.mjs");
    expect(packageJson.scripts.postinstall).toBe("node scripts/postinstall.mjs");
    expect(workflow).toContain("registry: ghcr.io");
    expect(workflow).toContain("packaging/agent-workbench/Containerfile");
    expect(packageJson.scripts["validate:plugin"]).toBe(
      "node scripts/validate-agent-workbench-plugin.mjs"
    );
    expect(pluginValidator).toContain("Agent Workbench plugin/package validation passed.");
    expect(pluginValidator).toContain("plugins/agent-workbench/.codex-plugin/plugin.json");
    expect(pluginValidator).toContain(".well-known/mcp/server-card.json");
    expect(pluginValidator).toContain(".agents/plugins/marketplace.json");
    expect(pluginValidator).toContain("manifest.dependency_install.runtime_dependencies");
    expect(ciWorkflow).toContain("pnpm install --frozen-lockfile");
    expect(ciWorkflow).toContain("pnpm typecheck");
    expect(ciWorkflow).toContain("pnpm test");
    expect(ciWorkflow).toContain("pnpm run validate:plugin");
    expect(ciWorkflow).toContain("node scripts/ci/install-smoke.mjs");
    expect(ciWorkflow).toContain("node scripts/ci/mcp-launch-smoke.mjs");
    expect(ciWorkflow).toContain("pnpm pack:dry-run");
  });

  it("keeps cross-repo debug harnesses checkout-only", () => {
    const containerfile = fs.readFileSync(path.resolve("packaging/agent-workbench/Containerfile"), "utf8");
    const packageJson = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const publicSurfaceNames = [...mcpResources, ...mcpTools, ...mcpPrompts].map((surface) => surface.name);

    expect(packageJson.scripts["debug:mcp-tool-sweep"]).toBe("tsx src/debug/mcp-tool-sweep.ts");
    expect(publicSurfaceNames).not.toContain("debug:mcp-tool-sweep");
    expect(publicSurfaceNames).not.toContain("mcp_tool_sweep");
    // Spec 033 (npm model): the GHCR container is the only build that copies and
    // sanitizes a runtime tree, so the strip rules live in the Containerfile.
    expect(containerfile).toContain("rm -rf src/debug");
    expect(containerfile).toContain("docs/specs");
    expect(containerfile).toContain('k.startsWith("debug:")');
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

function compareBindings(
  left: { kind: string; name: string; uri?: string },
  right: { kind: string; name: string; uri?: string }
): number {
  return `${left.kind}:${left.name}:${left.uri ?? ""}`.localeCompare(
    `${right.kind}:${right.name}:${right.uri ?? ""}`
  );
}
