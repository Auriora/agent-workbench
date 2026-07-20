/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getTaskContext } from "../../src/application/use-cases/get-task-context.js";
import {
  detectCodingAgentIntegrationIntent,
  integrationPathEvidence
} from "../../src/application/use-cases/coding-agent-integration-routing.js";
import { indexRepositoryGraph } from "../../src/application/use-cases/index-repository-graph.js";
import { planVerification } from "../../src/application/use-cases/plan-verification.js";
import { describeCodexIntegrationProfile } from "../../src/application/use-cases/describe-codex-integration-profile.js";
import { ExtractorRegistryAdapter, ResourceExtractorAdapter } from "../../src/infrastructure/extraction/index.js";
import {
  FileCatalogScannerAdapter,
  WorkspaceFileAdapter
} from "../../src/infrastructure/filesystem/index.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/index.js";
import {
  JavaScriptTypeScriptTreeSitterExtractorAdapter,
  PythonTreeSitterExtractorAdapter
} from "../../src/infrastructure/tree-sitter/index.js";
import type { ClockPort } from "../../src/ports/index.js";

const scanner = new FileCatalogScannerAdapter();
const clock: ClockPort = {
  now: () => new Date("2026-06-03T00:00:00.000Z"),
  nowIso8601: () => "2026-06-03T00:00:00.000Z",
  nowUnixMs: () => 0
};

const integrationRoutingTask =
  "Change SessionStart hook payload construction in the Claude plugin while keeping Codex and Kiro hooks consistent.";

async function withIntegrationRoutingFixture(
  run: (query: (maxFiles: number, task?: string) => ReturnType<typeof getTaskContext>) => Promise<void>
): Promise<void> {
  const repoRoot = path.resolve("tests/fixtures/fixture-agent-integration-routing");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-integration-routing-"));
  const store = openGraphStore(path.join(tempDir, "graph.sqlite"));
  const registry = new ExtractorRegistryAdapter();
  registry.register(new JavaScriptTypeScriptTreeSitterExtractorAdapter({ language: "javascript" }));
  registry.register(new JavaScriptTypeScriptTreeSitterExtractorAdapter({ language: "typescript" }));
  registry.register(new PythonTreeSitterExtractorAdapter());
  const workspace = new WorkspaceFileAdapter({ repoRoot });
  try {
    await indexRepositoryGraph({
      repo_root: repoRoot,
      scanner,
      workspace,
      extractors: registry,
      resource_extractor: new ResourceExtractorAdapter(),
      graph: store,
      catalog: store,
      snapshots: store,
      clock,
      schema_version: SCHEMA_VERSION,
      snapshot_id: "2028"
    });
    await run((maxFiles, task = integrationRoutingTask) => getTaskContext({
      request: {
        task,
        repo_root: repoRoot,
        files: [],
        symbols: [],
        max_files: maxFiles,
        max_docs: 2
      },
      scanner,
      graph: store,
      snapshots: store,
      catalog: store,
      workspace,
      default_repo_root: repoRoot
    }));
  } finally {
    store.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

describe("usage-informed MVP validation", () => {
  it("routes broad prompts to expected implementation files without high-frequency drift", async () => {
    const result = await getTaskContext({
      request: {
        task: "Update service behavior",
        repo_root: "tests/fixtures/fixture-basic-python",
        files: [],
        symbols: [],
        max_files: 5,
        max_docs: 5
      },
      scanner,
      default_repo_root: "."
    });

    expect(result.context.related_files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "src/sample_pkg/service.py",
          capability_level: "partial_semantic"
        })
      ])
    );
    expect(result.context.related_files).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "pyproject.toml" }),
        expect.objectContaining({ path: "tests/test_service.py" })
      ])
    );
  });

  it("returns compact first-pass context without hidden broad-work surfaces", async () => {
    const recordingScanner = {
      calls: [] as Array<{ max_files: number }>,
      async scan(input: Parameters<FileCatalogScannerAdapter["scan"]>[0]) {
        this.calls.push({ max_files: input.max_files });
        return scanner.scan(input);
      }
    };

    const result = await getTaskContext({
      request: {
        task: "Review validation setup",
        repo_root: "tests/fixtures/fixture-markdown-config",
        files: [],
        symbols: [],
        max_files: 3,
        max_docs: 3
      },
      scanner: recordingScanner,
      default_repo_root: "."
    });
    const serialized = JSON.stringify(result.context);

    expect(recordingScanner.calls).toEqual([{ max_files: 15000 }]);
    expect(result.context.related_files.length).toBeLessThanOrEqual(3);
    expect(result.context.governing_docs.length).toBeLessThanOrEqual(3);
    expect(result.context.skipped_work).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ranked_symbols"
        })
      ])
    );
    expect(serialized).not.toMatch(
      /full_topology|diagnostics_execution|run_nearest_tests|high_cardinality_cache_validation/u
    );
  });

  it("surfaces targeted symbol, reference, and impact follow-up from graph-backed context", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-basic-python");
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-usage-"));
    const store = openGraphStore(path.join(tempDir, "graph.sqlite"));
    const registry = new ExtractorRegistryAdapter();
    registry.register(new PythonTreeSitterExtractorAdapter());
    try {
      await indexRepositoryGraph({
        repo_root: repoRoot,
        scanner,
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(),
        graph: store,
        catalog: store,
        snapshots: store,
        clock,
        schema_version: SCHEMA_VERSION,
        snapshot_id: "2026"
      });

      const result = await getTaskContext({
        request: {
          task: "Change Runner behavior",
          repo_root: repoRoot,
          files: ["src/sample_pkg/service.py"],
          symbols: ["Runner"],
          max_files: 5,
          max_docs: 5
        },
        scanner,
        graph: store,
        snapshots: store,
        catalog: store,
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: repoRoot
      });

      expect(result.context.completeness).toEqual(
        expect.objectContaining({
          complete_enough: true,
          markers: expect.arrayContaining(["source_candidates_ranked", "symbols_ranked"])
        })
      );
      expect(result.context.next_actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tool: "find_references",
            args: expect.objectContaining({ node_id: expect.any(String) })
          }),
          expect.objectContaining({
            tool: "impact",
            args: expect.objectContaining({ node_id: expect.any(String) })
          })
        ])
      );
    } finally {
      store.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("ranks symbols from explicit implementation files ahead of matching tests", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-validation-rank-"));
    fs.mkdirSync(path.join(repoRoot, "src"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "tests"), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, "src", "validation_service.py"),
      "class ValidationService:\n    def validate_repository_uri(self, uri: str) -> bool:\n        return uri.startswith('repo://')\n"
    );
    fs.writeFileSync(
      path.join(repoRoot, "tests", "test_validation_service.py"),
      "class TestValidationService:\n    def test_validate_repository_uri(self):\n        assert True\n"
    );
    const store = openGraphStore(path.join(repoRoot, "graph.sqlite"));
    const registry = new ExtractorRegistryAdapter();
    registry.register(new PythonTreeSitterExtractorAdapter());
    try {
      await indexRepositoryGraph({
        repo_root: repoRoot,
        scanner,
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        extractors: registry,
        resource_extractor: new ResourceExtractorAdapter(),
        graph: store,
        catalog: store,
        snapshots: store,
        clock,
        schema_version: SCHEMA_VERSION,
        snapshot_id: "2027"
      });

      const result = await getTaskContext({
        request: {
          task: "Update validation service repository URI handling",
          repo_root: repoRoot,
          files: ["src/validation_service.py"],
          symbols: ["ValidationService", "validate_repository_uri"],
          max_files: 5,
          max_docs: 5
        },
        scanner,
        graph: store,
        snapshots: store,
        catalog: store,
        workspace: new WorkspaceFileAdapter({ repoRoot }),
        default_repo_root: repoRoot
      });

      expect(result.context.ranked_symbols[0]).toEqual(
        expect.objectContaining({
          symbol: expect.objectContaining({
            path: "src/validation_service.py"
          }),
          reason: "Matched task terms in a caller-supplied implementation file."
        })
      );
      expect(result.context.ranked_symbols.findIndex((candidate) => candidate.symbol.path.startsWith("src/"))).toBeLessThan(
        result.context.ranked_symbols.findIndex((candidate) => candidate.symbol.path.startsWith("tests/"))
      );
    } finally {
      store.close();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("covers every explicitly named coding-agent hook scope and verified source-sync path", async () => {
    await withIntegrationRoutingFixture(async (query) => {
      const result = await query(8);
      const relatedPaths = result.context.related_files.map((file) => file.path);

      expect(relatedPaths).toEqual(expect.arrayContaining([
        "plugins/agent-workbench/claude-plugin/hooks/session-start.js",
        "plugins/agent-workbench/hooks/session-start.core.js",
        "plugins/agent-workbench/kiro-power/hooks/session-start.js",
        "scripts/sync-claude-plugin-hooks.mjs"
      ]));
      expect(result.context.related_files.find((file) => file.path === "scripts/sync-claude-plugin-hooks.mjs")?.reason)
        .toContain("source-sync relationship");
    });
  });

  it("ranks explicitly named provider hook symbols ahead of generic lexical noise", async () => {
    await withIntegrationRoutingFixture(async (query) => {
      const result = await query(8);
      const rankedPaths = result.context.ranked_symbols.map((candidate) => candidate.symbol.path);
      const firstNoiseIndex = rankedPaths.findIndex((candidatePath) =>
        candidatePath === "tools/devcli/src/auriora_dev/plugin.py" ||
        candidatePath === "src/daemon/claude-monitor.ts"
      );
      const providerSymbolIndexes = [
        "plugins/agent-workbench/claude-plugin/hooks/session-start.js",
        "plugins/agent-workbench/hooks/session-start.js",
        "plugins/agent-workbench/kiro-power/hooks/session-start.js"
      ].map((candidatePath) => rankedPaths.indexOf(candidatePath));
      expect(providerSymbolIndexes.every((index) => index >= 0)).toBe(true);
      expect(firstNoiseIndex === -1 || providerSymbolIndexes.every((index) => index < firstNoiseIndex)).toBe(true);
    });
  });

  it("reports provider and source-sync evidence omitted by tight file bounds", async () => {
    await withIntegrationRoutingFixture(async (query) => {
      const allProviders = await query(3);
      expect(allProviders.context.related_files.map((file) => file.path)).toEqual(expect.arrayContaining([
        "plugins/agent-workbench/claude-plugin/hooks/session-start.js",
        "plugins/agent-workbench/hooks/session-start.core.js",
        "plugins/agent-workbench/kiro-power/hooks/session-start.js"
      ]));
      expect(allProviders.context.related_files.map((file) => file.path))
        .not.toContain("scripts/sync-claude-plugin-hooks.mjs");
      expect(allProviders.context.skipped_work).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: "integration_source_sync",
          reason: expect.stringContaining("scripts/sync-claude-plugin-hooks.mjs")
        })
      ]));

      const missingProvider = await query(2);
      expect(missingProvider.context.skipped_work).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: "named_integration_scope",
          reason: expect.stringContaining("Kiro was explicitly named but omitted because max_files=2")
        })
      ]));
    });
  });

  it("does not activate hook routing for generic provider integrations or misleading paths", () => {
    for (const task of [
      "Update the Claude integration authentication flow",
      "Review Codex integrations and configuration"
    ]) {
      const intent = detectCodingAgentIntegrationIntent(task);
      expect(intent.provider_integration_intent).toBe(true);
      expect(intent.hook_intent).toBe(false);
      expect(integrationPathEvidence("plugins/agent-workbench/hooks/session-start.js", intent)).toBeUndefined();
    }

    const hookIntent = detectCodingAgentIntegrationIntent(integrationRoutingTask);
    expect(integrationPathEvidence("plugins/foo/hooks/session-start.js", hookIntent)).toBeUndefined();
    expect(integrationPathEvidence("scripts/sync-webhook.mjs", hookIntent)).toBeUndefined();
    expect(integrationPathEvidence("tools/sync-githooks.mjs", hookIntent)).toBeUndefined();
  });

  it("does not emit hook-scope omissions for a generic provider integration task", async () => {
    await withIntegrationRoutingFixture(async (query) => {
      const result = await query(2, "Review Codex integrations and configuration");

      expect(result.context.skipped_work).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: "named_integration_scope" }),
        expect.objectContaining({ kind: "integration_source_sync" })
      ]));
    });
  });

  it("keeps docs/config and non-Python evidence as routing metadata with direct-read caveats", async () => {
    const docsContext = await getTaskContext({
      request: {
        task: "Update architecture docs and package validation",
        repo_root: "tests/fixtures/fixture-markdown-config",
        files: ["README.md", "package.json"],
        symbols: [],
        max_files: 5,
        max_docs: 5
      },
      scanner,
      default_repo_root: "."
    });
    const mixedContext = await getTaskContext({
      request: {
        task: "Update TypeScript app entrypoint and workflow",
        repo_root: "tests/fixtures/fixture-mixed-language-platform",
        files: ["src/app.ts", ".github/workflows/ci.yml", "Dockerfile"],
        symbols: [],
        max_files: 5,
        max_docs: 5
      },
      scanner,
      default_repo_root: "."
    });

    expect(docsContext.context.governing_docs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "README.md", evidence_kinds: ["docs"] }),
        expect.objectContaining({ path: "docs/architecture.md", evidence_kinds: ["docs"] })
      ])
    );
    expect(docsContext.context.completeness.caveats).toContain(
      "Related files and governing docs are routing evidence; directly read source before editing."
    );
    expect(mixedContext.context.requested_files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "src/app.ts",
          language: "typescript",
          capability_level: "partial_semantic"
        }),
        expect.objectContaining({
          path: ".github/workflows/ci.yml",
          language: "yaml",
          capability_level: "resource_backed"
        }),
        expect.objectContaining({
          path: "Dockerfile",
          language: "infrastructure",
          capability_level: "resource_backed"
        })
      ])
    );
  });

  it("keeps Codex replacement workflows discoverable without predecessor names or backend pass-throughs", async () => {
    const root = "tests/fixtures/fixture-mixed-language-platform";
    const plan = await planVerification({
      request: {
        task: "Validate app change",
        repo_root: root,
        files: ["src/app.ts", "package.json"],
        changed_files: ["src/app.ts"],
        include_static_feedback: true,
        max_commands: 10
      },
      scanner,
      workspace: new WorkspaceFileAdapter({ repoRoot: root }),
      default_repo_root: "."
    });
    const profile = describeCodexIntegrationProfile();
    const serialized = JSON.stringify({ plan: plan.plan, profile });

    expect(plan.plan.planned_commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ display: "pnpm run typecheck" }),
        expect.objectContaining({ display: "pnpm run test" })
      ])
    );
    expect(profile.mcp_bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "context_for_task" }),
        expect.objectContaining({ name: "diagnostics_for_files" }),
        expect.objectContaining({ name: "verification_plan" })
      ])
    );
    expect(serialized).not.toMatch(/python-agent-ide|agent-ide|backend_payload|raw_worker/u);
  });
});
