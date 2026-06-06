import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  mcpPrompts,
  mcpResources,
  mcpTools
} from "../../src/interface-adapters/mcp/registries/index.js";

describe("MCP registry metadata", () => {
  it("describes every public resource, tool, and prompt with agent-facing metadata", () => {
    const surfaces = [...mcpResources, ...mcpTools, ...mcpPrompts];

    expect(surfaces.map((surface) => `${surface.kind}:${surface.name}`).sort()).toEqual([
      "resource:codex-integration-profile",
      "resource:docs-map",
      "resource:docs-overview",
      "resource:overview",
      "resource:scope",
      "resource:status",
      "tool:apply_workspace_edit",
      "tool:context_for_task",
      "tool:diagnostics_for_files",
      "tool:docs_outline",
      "tool:docs_read_section",
      "tool:docs_search",
      "tool:find_references",
      "tool:impact",
      "tool:preview_workspace_edit",
      "tool:symbol_search",
      "tool:verification_plan"
    ]);

    for (const surface of surfaces) {
      expect(surface.name).toMatch(/^[a-z][a-z0-9_-]*$/);
      expect(surface.metadata.description).toContain(" ");
      expect(surface.metadata.budget_policy.toLowerCase()).toContain("bounded");
      expect(surface.metadata.returns).toMatch(/^ResponseEnvelope<[^>]+>$/);
      expect(surface.metadata.capability_class).toMatch(
        /^(read_only|planning|workspace_write|process_execute|generated_write)$/
      );
      expect(surface.metadata.mutation_class).toMatch(/^(none|planning|workspace_write)$/);

      for (const parameter of surface.metadata.parameters) {
        expect(parameter.name).toMatch(/^[a-z][a-z0-9_]*$/);
        expect(parameter.description).toContain(" ");
        expect(typeof parameter.required).toBe("boolean");
      }
    }
  });

  it("keeps capability and mutation metadata aligned with public behavior", () => {
    const byName = new Map(
      [...mcpResources, ...mcpTools].map((surface) => [surface.name, surface.metadata])
    );

    expect(byName.get("preview_workspace_edit")).toMatchObject({
      capability_class: "workspace_write",
      mutation_class: "planning"
    });
    expect(byName.get("apply_workspace_edit")).toMatchObject({
      capability_class: "workspace_write",
      mutation_class: "workspace_write"
    });
    expect(byName.get("verification_plan")).toMatchObject({
      capability_class: "planning",
      mutation_class: "planning"
    });
    expect(byName.get("diagnostics_for_files")).toMatchObject({
      capability_class: "read_only",
      mutation_class: "none"
    });
    for (const name of [
      "status",
      "scope",
      "overview",
      "docs-overview",
      "docs-map",
      "codex-integration-profile"
    ]) {
      expect(byName.get(name)).toMatchObject({
        capability_class: "read_only",
        mutation_class: "none"
      });
    }
  });

  it("keeps MCP registry adapters free of concrete backend infrastructure imports", () => {
    const registryRoot = path.resolve("src/interface-adapters/mcp/registries");
    const sourceFiles = listTypeScriptFiles(registryRoot);

    for (const file of sourceFiles) {
      const text = fs.readFileSync(file, "utf8");
      expect(text, path.relative(process.cwd(), file)).not.toMatch(
        /infrastructure\/(?:sqlite|tree-sitter|workers|commands)|better-sqlite3|filesystem\/workspace/i
      );
    }
  });
});

function listTypeScriptFiles(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const childPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return listTypeScriptFiles(childPath);
      }
      return entry.isFile() && entry.name.endsWith(".ts") ? [childPath] : [];
    })
    .sort();
}
