/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type {
  SymbolSearchRequest
} from "../../src/contracts/index.js";
import type { ComputeImpactResult } from "../../src/application/use-cases/compute-impact.js";
import type { FindReferencesUseCaseResult } from "../../src/application/use-cases/find-references.js";
import type { SearchSymbolsResult } from "../../src/application/use-cases/search-symbols.js";
import { findReferencesTool } from "../../src/interface-adapters/mcp/registries/tools/find-references.js";
import { impactTool } from "../../src/interface-adapters/mcp/registries/tools/impact.js";
import { symbolSearchTool } from "../../src/interface-adapters/mcp/registries/tools/symbol-search.js";
import { createRootAuthorityPolicy } from "../../src/interface-adapters/mcp/registries/root-authority.js";
import { buildFileCatalogEntry } from "../../src/domain/policies/index.js";
import { FilesystemSnapshotPathValidatorAdapter } from "../../src/infrastructure/filesystem/index.js";
import { InMemoryRuntimeOperationsAdapter } from "../../src/infrastructure/runtime/index.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/index.js";
import { createAgentWorkbenchServer, graphStorePath } from "../../src/server.js";
import {
  getRegisteredTool,
  parseMcpTextContent,
  registerMcpTool as registerTool,
  registeredToolNames
} from "../helpers/mcp-harness.js";

describe("graph query MCP tools", () => {
  it.each([
    { tool: "find_references", request: { symbol: "target" } },
    { tool: "impact", request: { node_id: "missing-node" } }
  ])("pins $tool validity and graph work to one snapshot per call", async ({ tool, request }) => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-graph-snapshot-pin-"));
    const sourcePath = path.join(repoRoot, "target.ts");
    fs.writeFileSync(sourcePath, "export const target = true;\n");
    const databasePath = graphStorePath(repoRoot);
    const store = openGraphStore(databasePath);
    try {
      await seedPublishedFileSnapshot(store, repoRoot, "1000", sourcePath);
    } finally {
      store.close();
    }
    fs.rmSync(sourcePath);

    const originalRequestWarmup = InMemoryRuntimeOperationsAdapter.prototype.requestWarmup;
    const warmupSpy = vi
      .spyOn(InMemoryRuntimeOperationsAdapter.prototype, "requestWarmup")
      .mockImplementation(async function (this: InMemoryRuntimeOperationsAdapter, input) {
        const executionId = await originalRequestWarmup.call(this, input);
        const concurrent = openGraphStore(databasePath);
        try {
          await concurrent.upsertSnapshot({ snapshot: testSnapshot("2000", repoRoot) });
        } finally {
          concurrent.close();
        }
        return executionId;
      });

    try {
      const server = createAgentWorkbenchServer(repoRoot, { startupRefreshDelayMs: 60_000 });
      const result = parseMcpTextContent<{
        data: { snapshot_id: string };
        meta: { freshness: string; verification_status: string; caveats?: Array<{ kind: string }> };
      }>(await getRegisteredTool(server, tool).handler(request));

      expect(result.data.snapshot_id).toBe("1000");
      expect(result.meta).toMatchObject({ freshness: "stale", verification_status: "blocked" });
      expect(result.meta.caveats).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: "stale_snapshot_paths" })])
      );
    } finally {
      warmupSpy.mockRestore();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("pins symbol_search validity and graph work to one snapshot per call", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-symbol-snapshot-pin-"));
    const sourcePath = path.join(repoRoot, "target.ts");
    fs.writeFileSync(sourcePath, "export const target = true;\n");
    const databasePath = graphStorePath(repoRoot);
    const store = openGraphStore(databasePath);
    try {
      await seedPublishedFileSnapshot(store, repoRoot, "1000", sourcePath);
    } finally {
      store.close();
    }
    fs.rmSync(sourcePath);

    const originalRequestWarmup = InMemoryRuntimeOperationsAdapter.prototype.requestWarmup;
    const warmupSpy = vi
      .spyOn(InMemoryRuntimeOperationsAdapter.prototype, "requestWarmup")
      .mockImplementation(async function (this: InMemoryRuntimeOperationsAdapter, input) {
        const executionId = await originalRequestWarmup.call(this, input);
        const concurrent = openGraphStore(databasePath);
        try {
          await concurrent.upsertSnapshot({ snapshot: testSnapshot("2000", repoRoot) });
        } finally {
          concurrent.close();
        }
        return executionId;
      });

    try {
      const server = createAgentWorkbenchServer(repoRoot, { startupRefreshDelayMs: 60_000 });
      const result = parseMcpTextContent<{
        data: SearchSymbolsResult["symbols"];
        meta: SearchSymbolsResult["meta"];
      }>(await getRegisteredTool(server, "symbol_search").handler({ query: "target" }));

      expect(result.data.snapshot_id).toBe("1000");
      expect(result.data.symbols).toEqual([]);
      expect(result.meta).toMatchObject({ freshness: "stale", verification_status: "blocked" });
      expect(result.meta.caveats).toEqual([
        expect.objectContaining({ kind: "stale_snapshot_paths" })
      ]);
    } finally {
      warmupSpy.mockRestore();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("preserves an explicit historical snapshot while latest advances", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-explicit-snapshot-pin-"));
    const sourcePath = path.join(repoRoot, "target.ts");
    fs.writeFileSync(sourcePath, "export const target = true;\n");
    const databasePath = graphStorePath(repoRoot);
    const store = openGraphStore(databasePath);
    try {
      await seedPublishedFileSnapshot(store, repoRoot, "1000", sourcePath);
    } finally {
      store.close();
    }

    const originalValidate = FilesystemSnapshotPathValidatorAdapter.prototype.validatePaths;
    const validateSpy = vi
      .spyOn(FilesystemSnapshotPathValidatorAdapter.prototype, "validatePaths")
      .mockImplementation(async function (this: FilesystemSnapshotPathValidatorAdapter, input) {
        const outcome = await originalValidate.call(this, input);
        const concurrent = openGraphStore(databasePath);
        try {
          await concurrent.upsertSnapshot({ snapshot: testSnapshot("2000", repoRoot) });
        } finally {
          concurrent.close();
        }
        return outcome;
      });

    try {
      const server = createAgentWorkbenchServer(repoRoot, { startupRefreshDelayMs: 60_000 });
      const result = parseMcpTextContent<{
        data: SearchSymbolsResult["symbols"];
      }>(await getRegisteredTool(server, "symbol_search").handler({
        query: "target",
        snapshot_id: "1000"
      }));

      expect(result.data.snapshot_id).toBe("1000");
    } finally {
      validateSpy.mockRestore();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("preserves an explicit nonexistent snapshot instead of resolving latest", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-explicit-missing-snapshot-"));
    const store = openGraphStore(graphStorePath(repoRoot));
    try {
      await store.upsertSnapshot({ snapshot: testSnapshot("2000", repoRoot) });
    } finally {
      store.close();
    }

    try {
      const server = createAgentWorkbenchServer(repoRoot, { startupRefreshDelayMs: 60_000 });
      const result = parseMcpTextContent<{
        data: SearchSymbolsResult["symbols"];
        meta: SearchSymbolsResult["meta"];
      }>(await getRegisteredTool(server, "symbol_search").handler({
        query: "target",
        snapshot_id: "1000"
      }));

      expect(result.data.snapshot_id).toBe("1000");
      expect(result.data.symbols).toEqual([]);
      expect(result.meta).toMatchObject({ verification_status: "blocked" });
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("uses the injected symbol_search provider", async () => {
    const registered = registerTool(symbolSearchTool, {
      searchSymbols: ({ request }: { request: SymbolSearchRequest }) => ({
        symbols: {
          query: request.query,
          repo_root: "/fixture",
          snapshot_id: "1",
          symbols: [],
          next_actions: []
        },
        meta: meta()
      })
    });

    expect(registered).toMatchObject({
      name: "symbol_search",
      description: expect.stringContaining("Use this before broad grep")
    });
    const response = await registered.handler({ query: "Runner" });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: SearchSymbolsResult["symbols"];
    };
    expect(parsed.data.query).toBe("Runner");
  });

  it("redacts unsafe tokens in symbol source sections while preserving route snippets", async () => {
    const registered = registerTool(symbolSearchTool, {
      searchSymbols: ({ request }: { request: SymbolSearchRequest }) => ({
        symbols: {
          query: request.query,
          repo_root: "/fixture",
          snapshot_id: "1",
          symbols: [
            {
              node_id: "node-1",
              kind: "function",
              name: "handler",
              qualified_name: "orders.handler",
              path: "src/routes/orders.py",
              language: "python",
              source_range: {
                start_line: 1,
                start_column: 0,
                end_line: 3,
                end_column: 1
              },
              signature: "handler(path='../outside/secrets.txt', route='/api/orders', token='TOKEN=abc123')",
              docstring: "Reads C:\\Users\\example\\secret.txt and /home/example/.ssh/id_rsa",
              capability_level: "partial_semantic",
              evidence_kinds: ["parser"],
              source_section: {
                path: "src/routes/orders.py",
                start_line: 1,
                end_line: 3,
                byte_count: 120,
                truncated: false,
                text: "route = '/api/orders'\nkey = 'TOKEN=abc123'\npath = '/home/example/.ssh/id_rsa'"
              }
            }
          ],
          next_actions: []
        },
        meta: meta()
      })
    });

    const response = await registered.handler({ query: "handler", source_byte_limit: 200 });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: SearchSymbolsResult["symbols"];
    };
    const text = parsed.data.symbols[0]?.source_section?.text ?? "";
    const symbol = parsed.data.symbols[0];

    expect(text).toContain("/api/orders");
    expect(text).toContain("TOKEN=[REDACTED]");
    expect(text).toContain("[REDACTED_ABSOLUTE_PATH]");
    expect(text).not.toContain("/home/example");
    expect(symbol?.signature).toContain("[REDACTED_WORKSPACE_ESCAPE]");
    expect(symbol?.signature).toContain("/api/orders");
    expect(symbol?.signature).toContain("TOKEN=[REDACTED]");
    expect(symbol?.docstring).toContain("[REDACTED_ABSOLUTE_PATH]");
    expect(JSON.stringify(symbol)).not.toContain("../outside/secrets.txt");
    expect(JSON.stringify(symbol)).not.toContain("C:\\Users\\example\\secret.txt");
  });

  it("uses the injected find_references provider", async () => {
    const registered = registerTool(findReferencesTool, {
      findReferences: () => ({
        references: {
          repo_root: "/fixture",
          snapshot_id: "1",
          target: unsafeSymbolReference(),
          references: [
            {
              source_node_id: "a",
              target_node_id: "b",
              target_file_path: "src/service.py",
              reference_kind: "call",
              confidence: 0.8,
              evidence_kinds: ["parser"],
              provenance: "unit",
              status: "resolved"
            }
          ],
          next_actions: []
        },
        meta: meta()
      })
    });

    expect(registered.name).toBe("find_references");
    const response = await registered.handler({ symbol: "Runner" });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: FindReferencesUseCaseResult["references"];
      meta: { trust?: { safe_to_use_for: string[]; not_safe_to_use_for: string[] } };
    };
    expect(parsed.data.references[0]).toMatchObject({ status: "resolved" });
    expect(parsed.data.target?.signature).toContain("[REDACTED_WORKSPACE_ESCAPE]");
    expect(parsed.data.target?.docstring).toContain("[REDACTED_ABSOLUTE_PATH]");
    expect(JSON.stringify(parsed.data.target)).not.toContain("../outside/secrets.txt");
    expect(parsed.meta.trust).toMatchObject({
      safe_to_use_for: expect.arrayContaining(["navigation", "next_read_selection"]),
      not_safe_to_use_for: expect.arrayContaining(["whole_program_impact_claim"])
    });
  });

  it("uses the injected impact provider", async () => {
    const registered = registerTool(impactTool, {
      computeImpact: () => ({
        impact: {
          repo_root: "/fixture",
          snapshot_id: "1",
          start_node_ids: ["a"],
          affected_symbols: [unsafeSymbolReference()],
          affected_files: [{
            path: "src/routes/orders.ts",
            language: "typescript",
            exists: true,
            capability_level: "partial_semantic",
            evidence_kinds: ["parser"],
            reason: "Contains the affected symbol."
          }],
          edge_count: 0,
          reached_depth: 0,
          traversal_truncated: false,
          confidence: {
            level: "low",
            scope: "empty",
            reason: "fixture",
            evidence_kinds: []
          },
          next_actions: []
        },
        meta: meta()
      })
    });

    expect(registered.name).toBe("impact");
    const response = await registered.handler({ node_id: "a" });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: ComputeImpactResult["impact"];
    };
    expect(parsed.data.start_node_ids).toEqual(["a"]);
    expect(parsed.data.affected_symbols[0]?.path).toBe("src/routes/orders.ts");
    expect(parsed.data.affected_symbols[0]?.signature).toContain("[REDACTED_WORKSPACE_ESCAPE]");
    expect(parsed.data.affected_symbols[0]?.docstring).toContain("[REDACTED_ABSOLUTE_PATH]");
    expect(parsed.data.affected_symbols[0]?.source_section?.text).toContain("TOKEN=[REDACTED]");
    expect(parsed.data.affected_symbols[0]?.source_section?.text).toContain("/api/orders");
    expect(JSON.stringify(parsed.data.affected_symbols[0])).not.toContain("abc123");
  });

  it("returns structured invalid input before provider execution", async () => {
    let providerCalled = false;
    const registered = registerTool(symbolSearchTool, {
      searchSymbols: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const response = await registered.handler({ query: "" });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string; retryable: boolean }>;
    };

    expect(providerCalled).toBe(false);
    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid",
      verification_status: "blocked",
      trust: {
        safe_to_use_for: expect.arrayContaining(["navigation"]),
        not_safe_to_use_for: expect.arrayContaining(["whole_program_impact_claim"])
      }
    });
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        code: "invalid_input",
        retryable: false
      })
    ]);
  });

  it("parses symbol_search defaults and schema types before provider execution", async () => {
    let parsedRequest: SymbolSearchRequest | undefined;
    const registered = registerTool(symbolSearchTool, {
      searchSymbols: ({ request }) => {
        parsedRequest = request;
        return {
          symbols: {
            query: request.query,
            repo_root: request.repo_root ?? "/fixture",
            snapshot_id: request.snapshot_id ?? "snapshot-1",
            symbols: [],
            next_actions: []
          },
          meta: meta()
        };
      }
    });

    expect(registered.name).toBe("symbol_search");
    const response = await registered.handler({ query: "Runner" });

    expect(parsedRequest).toMatchObject({
      query: "Runner",
      repo_root: "/repo",
      exact: false,
      languages: [],
      max_results: 20,
      source_byte_limit: 0
    });
    expect(parsedRequest?.snapshot_id).toBeUndefined();

    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: SearchSymbolsResult["symbols"];
    };
    expect(parsed.data.query).toBe("Runner");
  });

  it("blocks explicit repo_root overrides for graph query tools in normal mode", async () => {
    let parsedRequest: SymbolSearchRequest | undefined;
    const registered = registerTool(symbolSearchTool, {
      searchSymbols: ({ request }) => {
        parsedRequest = request;
        return {
          symbols: {
            query: request.query,
            repo_root: request.repo_root ?? "missing-default",
            snapshot_id: "snapshot-1",
            symbols: [],
            next_actions: []
          },
          meta: meta()
        };
      }
    });

    const response = await registered.handler({
      query: "Runner",
      repo_root: "/other/repo"
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      errors: Array<{ code: string; message: string }>;
    };

    expect(parsedRequest).toBeUndefined();
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        code: "invalid_input",
        message: expect.stringContaining("repo_root override is blocked")
      })
    ]);
  });

  it("allows explicit repo_root overrides for graph query tools in debug mode", async () => {
    let parsedRequest: SymbolSearchRequest | undefined;
    const registered = registerTool(symbolSearchTool, {
      rootAuthorityPolicy: createRootAuthorityPolicy({
        launchRoot: "/repo",
        debugRepoRootOverride: true
      }),
      searchSymbols: ({ request }) => {
        parsedRequest = request;
        return {
          symbols: {
            query: request.query,
            repo_root: request.repo_root ?? "missing-default",
            snapshot_id: "snapshot-1",
            symbols: [],
            next_actions: []
          },
          meta: meta()
        };
      }
    });

    await registered.handler({
      query: "Runner",
      repo_root: "/other/repo"
    });

    expect(parsedRequest?.repo_root).toBe("/other/repo");
  });

  it("returns structured invalid input for find_references before provider execution", async () => {
    let providerCalled = false;
    const registered = registerTool(findReferencesTool, {
      findReferences: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const response = await registered.handler({ node_id: 42 } as unknown as { node_id: unknown });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string; retryable: boolean }>;
    };

    expect(providerCalled).toBe(false);
    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid",
      verification_status: "blocked"
    });
    expect(parsed.errors).toEqual([expect.objectContaining({ code: "invalid_input", retryable: false })]);
  });

  it("returns structured invalid input for impact before provider execution", async () => {
    let providerCalled = false;
    const registered = registerTool(impactTool, {
      computeImpact: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const response = await registered.handler({ node_id: "", max_depth: "2" } as unknown as { node_id: unknown });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string; retryable: boolean }>;
    };

    expect(providerCalled).toBe(false);
    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid",
      verification_status: "blocked"
    });
    expect(parsed.errors).toEqual([expect.objectContaining({ code: "invalid_input", retryable: false })]);
  });

  it("is registered by the composed server", () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-query-registration-"));
    try {
      const server = createAgentWorkbenchServer(repoRoot, {
        startupRefreshDelayMs: 60_000
      });

      expect(registeredToolNames(server)).toEqual([
      "apply_workspace_edit",
      "check_markdown_document",
      "check_markdown_set",
      "context_for_task",
      "diagnostics_for_files",
      "docs_current_for_task",
      "docs_outline",
      "docs_read_section",
      "docs_scope",
      "docs_search",
      "find_references",
      "impact",
      "integration_health",
      "preview_workspace_edit",
      "symbol_search",
      "verification_plan"
      ]);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});

function meta() {
  return {
    analysis_validity: "valid" as const,
    freshness: "fresh" as const,
    scope: {
      repo_root: "/fixture",
      indexed_roots: ["."],
      skipped_roots: [],
      languages: ["python"]
    },
    capability_level: "partial_semantic" as const,
    evidence_kinds: ["parser" as const],
    verification_status: "needed" as const,
    truncated: false
  };
}

function unsafeSymbolReference() {
  return {
    node_id: "unsafe-symbol",
    kind: "function",
    name: "handler",
    qualified_name: "orders.handler",
    path: "src/routes/orders.ts",
    language: "typescript",
    source_range: { start_line: 1, start_column: 0, end_line: 3, end_column: 1 },
    signature: "handler(path='../outside/secrets.txt', route='/api/orders', token='TOKEN=abc123')",
    docstring: "Reads /home/example/.ssh/id_rsa and C:\\Users\\example\\secret.txt",
    capability_level: "partial_semantic" as const,
    evidence_kinds: ["parser" as const],
    source_section: {
      path: "src/routes/orders.ts",
      start_line: 1,
      end_line: 3,
      byte_count: 120,
      truncated: false,
      text: "route = '/api/orders'\nkey = 'TOKEN=abc123'\npath = '../outside/secrets.txt'"
    }
  };
}

function testSnapshot(id: string, repoRoot: string) {
  return {
    id,
    repo_root: repoRoot,
    workspace_root: repoRoot,
    repo_identity: repoRoot,
    config_identity: "default",
    schema_version: SCHEMA_VERSION,
    freshness: "fresh" as const,
    owner_state: "owner" as const,
    created_at: "2026-07-19T12:00:00.000Z",
    updated_at: "2026-07-19T12:00:00.000Z"
  };
}

async function seedPublishedFileSnapshot(
  store: ReturnType<typeof openGraphStore>,
  repoRoot: string,
  snapshotId: string,
  sourcePath: string
): Promise<void> {
  const snapshot = testSnapshot(snapshotId, repoRoot);
  await store.createBuildSnapshot({
    snapshot,
    controller_generation: 0,
    invalidation_generation: 0,
    created_at: snapshot.created_at
  });
  await store.upsertEntry({
    snapshot_id: snapshotId,
    entry: buildFileCatalogEntry({
      file_identity: {
        path: "target.ts",
        language: "typescript",
        content_hash: "sha256:before",
        size_bytes: fs.statSync(sourcePath).size,
        mtime_ms: fs.statSync(sourcePath).mtimeMs
      }
    })
  });
  await store.transitionBuild({
    repo_root: repoRoot,
    snapshot_id: snapshotId,
    controller_generation: 0,
    invalidation_generation: 0,
    from: "building",
    to: "published",
    updated_at: snapshot.updated_at
  });
}
