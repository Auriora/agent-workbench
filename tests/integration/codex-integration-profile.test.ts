import fs from "node:fs";
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
          capability_class: "read_only"
        })
      ])
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

  it("is exposed by the composed server alongside repo status", () => {
    const server = createAgentWorkbenchServer(".") as unknown as {
      _registeredResources: Record<string, unknown>;
    };

    expect(Object.keys(server._registeredResources).sort()).toEqual([
      "integration:///profiles/codex",
      "repo:///status"
    ]);
  });
});

describe("Codex plugin artifacts", () => {
  const pluginRoot = path.resolve("plugins/agent-workbench");

  it("ships a valid wrapper manifest, MCP config, skill, and hook config", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pluginRoot, ".codex-plugin/plugin.json"), "utf8")
    ) as {
      name: string;
      skills: string;
      mcpServers: string;
      hooks?: string;
    };
    const mcpConfig = JSON.parse(fs.readFileSync(path.join(pluginRoot, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, { args: string[] }>;
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
    expect(mcpConfig.mcpServers["agent-workbench"].args).toEqual([
      "--import",
      "tsx",
      "../../src/mcp/stdio.ts"
    ]);
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
    ).toContain("The hook did not run analysis and did not produce partial results.");
    expect(
      sessionStart.buildSessionStartContext(
        { cwd: "/repo" },
        { AGENT_WORKBENCH_HOOK_FEEDBACK: "basic" }
      )
    ).toContain("repo:///status");
  });

  it("keeps plugin wrappers out of concrete runtime implementation paths", () => {
    const files = listFiles(pluginRoot);
    const checkedFiles = files.filter((file) => !file.endsWith(".mcp.json"));

    for (const file of checkedFiles) {
      const text = fs.readFileSync(file, "utf8");
      expect(text, path.relative(pluginRoot, file)).not.toMatch(/src\/(?:application|domain|infrastructure|presentation|interface-adapters)/);
      expect(text, path.relative(pluginRoot, file)).not.toContain("tree-sitter");
      expect(text, path.relative(pluginRoot, file)).not.toContain("better-sqlite3");
    }

    const mcpConfig = fs.readFileSync(path.join(pluginRoot, ".mcp.json"), "utf8");
    expect(mcpConfig).toContain("../../src/mcp/stdio.ts");
    expect(mcpConfig).not.toContain("src/infrastructure");
  });
});

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}
