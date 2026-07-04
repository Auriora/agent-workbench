/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { integrationProfileSchema } from "../../src/contracts/index.js";
import { buildCommonIntegrationProfile } from "../../src/integration/common/index.js";

describe("common integration profile", () => {
  it("describes every MVP target agent through common MCP metadata", () => {
    const profile = integrationProfileSchema.parse(buildCommonIntegrationProfile());

    expect(profile.target_agents).toEqual([
      "codex",
      "claude_code",
      "kiro",
      "augment",
      "gemini",
      "junie"
    ]);
    expect(profile.mcp_bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "context_for_task",
          kind: "tool",
          capability_class: "read_only"
        }),
        expect.objectContaining({
          name: "verification_plan",
          kind: "tool",
          capability_class: "planning"
        }),
        expect.objectContaining({
          name: "diagnostics_for_files",
          kind: "tool",
          capability_class: "read_only"
        }),
        expect.objectContaining({
          name: "apply_workspace_edit",
          kind: "tool",
          capability_class: "workspace_write"
        })
      ])
    );

    expect(profile.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target_agent: "codex",
          surface: "mcp",
          status: "supported",
          provenance: "runtime_source",
          path: "plugins/agent-workbench/.mcp.json",
          regeneration_safe: true
        })
      ])
    );

    for (const target of profile.target_agents.filter((agent) => agent !== "codex")) {
      expect(profile.artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target_agent: target,
            surface: "mcp",
            status: "supported",
            provenance: "mcp_binding_metadata",
            regeneration_safe: true
          })
        ])
      );
    }

    expect(profile.unsupported_surfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target_agent: "augment",
          surface: "plugins"
        }),
        expect.objectContaining({
          target_agent: "gemini",
          surface: "extensions"
        }),
        expect.objectContaining({
          target_agent: "junie",
          surface: "acp"
        })
      ])
    );
  });

  it("keeps common integration code independent from runtime infrastructure and vendor emitters", () => {
    const integrationFiles = listFiles(path.resolve("src/integration"));

    for (const file of integrationFiles) {
      const text = fs.readFileSync(file, "utf8");
      expect(text, path.relative(process.cwd(), file)).not.toMatch(
        /src\/(?:application|domain|infrastructure|interface-adapters|presentation)|better-sqlite3|tree-sitter/u
      );
      expect(text, path.relative(process.cwd(), file)).not.toMatch(
        /from\s+["'][^"']*(?:codex|claude|kiro|augment|gemini|junie)[^"']*["']/u
      );
    }
  });
});

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}
