/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeImpact } from "../../src/application/use-cases/compute-impact.js";
import { findReferences } from "../../src/application/use-cases/find-references.js";
import { getTaskContext } from "../../src/application/use-cases/get-task-context.js";
import { indexRepositoryGraph } from "../../src/application/use-cases/index-repository-graph.js";
import { searchSymbols } from "../../src/application/use-cases/search-symbols.js";
import type { ClockPort } from "../../src/ports/index.js";
import { ExtractorRegistryAdapter, ResourceExtractorAdapter } from "../../src/infrastructure/extraction/index.js";
import { FileCatalogScannerAdapter, WorkspaceFileAdapter } from "../../src/infrastructure/filesystem/index.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/index.js";
import {
  CppDeclarationExtractorAdapter,
  GoDeclarationExtractorAdapter,
  JavaScriptTypeScriptTreeSitterExtractorAdapter,
  PythonTreeSitterExtractorAdapter
} from "../../src/infrastructure/tree-sitter/index.js";

const clock: ClockPort = {
  now: () => new Date("2026-05-31T12:00:00.000Z"),
  nowIso8601: () => "2026-05-31T12:00:00.000Z",
  nowUnixMs: () => 201
};

describe("graph query use cases", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-query-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("searches symbols with stable budgets and optional source sections", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-basic-python", "201");
    try {
      const result = await searchSymbols({
        request: {
          query: "Runner",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: ["python"],
          max_results: 5,
          source_byte_limit: 40
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(result.symbols.symbols).toEqual([
        expect.objectContaining({
          name: "Runner",
          language: "python",
          capability_level: "partial_semantic",
          evidence_kinds: ["parser"],
          source_section: expect.objectContaining({
            path: "src/sample_pkg/service.py",
            byte_count: expect.any(Number),
            truncated: true
          })
        })
      ]);
      expect(result.meta.budget).toMatchObject({
        row_limit: 5,
        source_byte_limit: 40
      });
      expect(result.meta.scope.languages).toContain("python");
      expect(result.symbols.next_actions).toEqual([
        expect.objectContaining({
          tool: "find_references"
        })
      ]);
    } finally {
      fixture.store.close();
    }
  });

  it("includes returned symbol languages in metadata even when catalog budget is narrower", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-basic-python", "209");
    try {
      const result = await searchSymbols({
        request: {
          query: "Runner",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: [],
          max_results: 1,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(result.symbols.symbols).toEqual([
        expect.objectContaining({
          name: "Runner",
          language: "python"
        })
      ]);
      expect(result.meta.scope.languages).toContain("python");
    } finally {
      fixture.store.close();
    }
  });

  it("surfaces JS/TS parser-backed symbols, references, impact caveats, and ranked context", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-js-ts-monorepo", "210", {
      registerPython: false,
      registerJsTs: true
    });
    try {
      const symbols = await searchSymbols({
        request: {
          query: "Login",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: ["typescript"],
          max_results: 5,
          source_byte_limit: 80
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });
      const loginModule = symbols.symbols.symbols.find((symbol) => symbol.kind === "module");

      expect(symbols.symbols.symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "function",
            name: "Login",
            path: "apps/web/src/Login.tsx",
            language: "typescript",
            capability_level: "partial_semantic",
            evidence_kinds: ["parser"],
            source_section: expect.objectContaining({
              path: "apps/web/src/Login.tsx",
              truncated: true
            })
          })
        ])
      );
      expect(symbols.meta.scope.languages).toContain("typescript");
      expect(symbols.symbols.next_actions).toEqual([
        expect.objectContaining({ tool: "find_references" })
      ]);

      const references = await findReferences({
        request: {
          node_id: loginModule?.node_id ?? "",
          repo_root: fixture.repoRoot,
          max_depth: 1,
          max_results: 10
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(references.references.references).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target_file_path: "services/api/src/auth-controller.ts",
            reference_kind: "resolved",
            evidence_kinds: ["parser"],
            provenance: "tree-sitter-js-ts-import",
            status: "resolved"
          })
        ])
      );
      expect(references.references.next_actions).toEqual([
        expect.objectContaining({ tool: "impact" })
      ]);

      const impact = await computeImpact({
        request: {
          node_id: loginModule?.node_id ?? "",
          repo_root: fixture.repoRoot,
          max_depth: 1,
          max_nodes: 10,
          direction: "outgoing"
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(impact.impact.affected_symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "module",
            path: "apps/web/src/Login.tsx",
            capability_level: "partial_semantic"
          }),
          expect.objectContaining({
            kind: "class",
            name: "AuthController",
            path: "services/api/src/auth-controller.ts",
            capability_level: "partial_semantic"
          })
        ])
      );
      expect(impact.impact.confidence).toEqual(
        expect.objectContaining({
          level: "low",
          scope: "graph",
          evidence_kinds: ["parser"]
        })
      );
      expect(impact.impact.confidence.reason).toContain("low-confidence parser-backed edges");

      const context = await getTaskContext({
        request: {
          task: "Update Login flow",
          repo_root: fixture.repoRoot,
          files: ["apps/web/src/Login.tsx"],
          symbols: ["Login"],
          max_files: 6,
          max_docs: 2
        },
        scanner: new FileCatalogScannerAdapter(),
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(context.context.ranked_symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            symbol: expect.objectContaining({
              name: "Login",
              language: "typescript",
              capability_level: "partial_semantic",
              evidence_kinds: ["parser"]
            })
          })
        ])
      );
      expect(context.context.next_actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tool: "find_references" }),
          expect.objectContaining({ tool: "impact" })
        ])
      );
    } finally {
      fixture.store.close();
    }
  });

  it("searches SAM logical IDs and Lambda handler strings as resource-backed routing symbols", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-sam-lambda-repo", "219");
    try {
      const logicalId = await searchSymbols({
        request: {
          query: "OrdersFunction",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: [],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });
      const handler = await searchSymbols({
        request: {
          query: "src/orders/app.handler",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: [],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(logicalId.symbols.symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "lambda_function",
            name: "OrdersFunction",
            path: "infra/sam/orders/template.yaml",
            capability_level: "resource_backed",
            evidence_kinds: expect.arrayContaining(["config", "infra_parser"])
          })
        ])
      );
      expect(handler.symbols.symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "lambda_handler_binding",
            name: "src/orders/app.handler",
            path: "infra/sam/orders/template.yaml",
            capability_level: "resource_backed"
          })
        ])
      );
    } finally {
      fixture.store.close();
    }
  });

  it("treats Lambda handler string suffix queries as exact resource-backed matches", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-sam-lambda-repo", "220");
    try {
      const result = await searchSymbols({
        request: {
          query: "app.handler",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: [],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(result.symbols.symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "lambda_handler_binding",
            name: "src/orders/app.handler",
            capability_level: "resource_backed"
          }),
          expect.objectContaining({
            kind: "lambda_handler_file",
            path: "src/orders/app.py",
            capability_level: "resource_backed"
          })
        ])
      );
      expect(result.symbols.next_actions).toEqual([
        expect.objectContaining({
          tool: "find_references"
        })
      ]);
    } finally {
      fixture.store.close();
    }
  });

  it("routes SAM handler bindings to resolved handler files with low-confidence impact", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-sam-lambda-repo", "222");
    try {
      const symbols = await searchSymbols({
        request: {
          query: "src/orders/app.handler",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: [],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });
      const nodeId = symbols.symbols.symbols.find((symbol) => symbol.kind === "lambda_handler_binding")?.node_id ?? "";
      const impact = await computeImpact({
        request: {
          node_id: nodeId,
          max_depth: 1,
          max_nodes: 10,
          direction: "outgoing"
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });
      const unresolved = await fixture.store.getUnresolvedReferences({
        snapshot_id: "222",
        file_path: "infra/sam/orders/template.yaml"
      });

      expect(impact.impact.edge_count).toBeGreaterThan(0);
      expect(impact.impact.affected_symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "lambda_handler_file",
            path: "src/orders/app.py",
            capability_level: "resource_backed"
          })
        ])
      );
      expect(impact.impact.affected_files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "infra/sam/orders/template.yaml"
          }),
          expect.objectContaining({
            path: "src/orders/app.py"
          })
        ])
      );
      expect(impact.impact.confidence).toEqual(
        expect.objectContaining({
          level: "low",
          scope: "graph",
          evidence_kinds: expect.arrayContaining(["config", "infra_parser"])
        })
      );
      expect(unresolved).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reference_kind: "lambda_handler_file",
            reference_name: "src/missing/app.py",
            candidate_metadata: expect.objectContaining({
              resolution: "unresolved",
              confidence: "low"
            })
          })
        ])
      );
    } finally {
      fixture.store.close();
    }
  });

  it("groups generic Lambda handler results by logical ID, template, and handler file evidence", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-sam-lambda-heavy-repo", "223");
    try {
      const result = await searchSymbols({
        request: {
          query: "app.handler",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: [],
          max_results: 10,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(result.symbols.symbols.map((symbol) => ({
        kind: symbol.kind,
        name: symbol.name,
        signature: symbol.signature,
        path: symbol.path
      }))).toEqual([
        {
          kind: "lambda_handler_binding",
          name: "src/billing/webhook/app.handler",
          signature: "BillingWebhookFunction -> src/billing/webhook/app.handler (template infra/sam/billing/template.yaml, handler file src/billing/webhook/app.py, events Api:Api)",
          path: "infra/sam/billing/template.yaml"
        },
        {
          kind: "lambda_handler_file",
          name: "src/billing/webhook/app.py",
          signature: "BillingWebhookFunction -> src/billing/webhook/app.py#handler (template infra/sam/billing/template.yaml, events Api:Api)",
          path: "src/billing/webhook/app.py"
        },
        {
          kind: "lambda_handler_binding",
          name: "src/orders/cancel/app.handler",
          signature: "OrdersCancelFunction -> src/orders/cancel/app.handler (template infra/sam/orders/template.yaml, handler file src/orders/cancel/app.py, events Api:Api)",
          path: "infra/sam/orders/template.yaml"
        },
        {
          kind: "lambda_handler_file",
          name: "src/orders/cancel/app.py",
          signature: "OrdersCancelFunction -> src/orders/cancel/app.py#handler (template infra/sam/orders/template.yaml, events Api:Api)",
          path: "src/orders/cancel/app.py"
        },
        {
          kind: "lambda_handler_binding",
          name: "src/orders/create/app.handler",
          signature: "OrdersCreateFunction -> src/orders/create/app.handler (template infra/sam/orders/template.yaml, handler file src/orders/create/app.py, events Api:Api)",
          path: "infra/sam/orders/template.yaml"
        },
        {
          kind: "lambda_handler_file",
          name: "src/orders/create/app.py",
          signature: "OrdersCreateFunction -> src/orders/create/app.py#handler (template infra/sam/orders/template.yaml, events Api:Api)",
          path: "src/orders/create/app.py"
        }
      ]);
      expect(result.symbols.symbols.every((symbol) => symbol.capability_level === "resource_backed")).toBe(true);
    } finally {
      fixture.store.close();
    }
  });

  it("surfaces SAM event-source evidence in handler grouping and symbol lookup", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-sam-intrinsic-repo", "224");
    try {
      const handler = await searchSymbols({
        request: {
          query: "src/orders/app.handler",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: [],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });
      expect(handler.symbols.symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "lambda_handler_binding",
            name: "src/orders/app.handler",
            signature: "OrdersFunction -> src/orders/app.handler (template infra/orders/template.yaml, handler file src/orders/app.py, events ApiCreateOrder:Api, QueueOrders:SQS, StreamOrders:DynamoDB)"
          }),
          expect.objectContaining({
            kind: "lambda_handler_file",
            path: "src/orders/app.py",
            signature: "OrdersFunction -> src/orders/app.py#handler (template infra/orders/template.yaml, events ApiCreateOrder:Api, QueueOrders:SQS, StreamOrders:DynamoDB)"
          })
        ])
      );

      const event = await searchSymbols({
        request: {
          query: "QueueOrders",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: [],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });
      expect(event.symbols.symbols).toEqual([
        expect.objectContaining({
          kind: "lambda_event_source",
          name: "QueueOrders",
          signature: "QueueOrders:SQS",
          path: "infra/orders/template.yaml",
          capability_level: "resource_backed",
          evidence_kinds: expect.arrayContaining(["config", "infra_parser"])
        })
      ]);
    } finally {
      fixture.store.close();
    }
  });

  it("returns template-aware references and impact for SAM intrinsic resources", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-sam-intrinsic-repo", "225");
    try {
      const ordersTable = await searchSymbols({
        request: {
          query: "OrdersTable",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: [],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });
      const ordersTableId = ordersTable.symbols.symbols[0]?.node_id ?? "";
      const references = await findReferences({
        request: {
          node_id: ordersTableId,
          repo_root: fixture.repoRoot,
          max_results: 10,
          max_depth: 1
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(references.references.references).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reference_kind: "cloudformation_depends_on",
            reference_name: "OrdersTable",
            confidence: 0.85,
            evidence_kinds: ["config", "infra_parser"],
            provenance: "cloudformation_intrinsic_scan",
            status: "resolved"
          }),
          expect.objectContaining({
            reference_kind: "cloudformation_getatt",
            reference_name: "OrdersTable",
            confidence: 0.75,
            evidence_kinds: ["config", "infra_parser"],
            status: "resolved"
          })
        ])
      );

      const handler = await searchSymbols({
        request: {
          query: "src/orders/app.handler",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: [],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });
      const handlerId = handler.symbols.symbols.find((symbol) => symbol.kind === "lambda_handler_binding")?.node_id ?? "";
      const impact = await computeImpact({
        request: {
          node_id: handlerId,
          repo_root: fixture.repoRoot,
          max_depth: 2,
          max_nodes: 20,
          direction: "both"
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(impact.impact.affected_symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "lambda_handler_binding",
            name: "src/orders/app.handler"
          }),
          expect.objectContaining({
            kind: "lambda_handler_file",
            path: "src/orders/app.py"
          }),
          expect.objectContaining({
            kind: "lambda_event_source",
            name: "QueueOrders"
          }),
          expect.objectContaining({
            kind: "cloudformation_resource",
            name: "OrdersQueue"
          })
        ])
      );
      expect(impact.impact.confidence).toEqual(
        expect.objectContaining({
          level: "low",
          scope: "graph",
          evidence_kinds: ["config", "infra_parser"]
        })
      );
    } finally {
      fixture.store.close();
    }
  });

  it("falls back when exact matches exist only outside the requested languages", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-sam-lambda-repo", "221");
    try {
      const result = await searchSymbols({
        request: {
          query: "OrdersTable",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: ["python"],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(result.symbols.symbols).toEqual([]);
      expect(result.symbols.next_actions).toEqual([
        expect.objectContaining({
          tool: "context_for_task",
          args: expect.objectContaining({
            symbols: ["OrdersTable"]
          })
        })
      ]);
    } finally {
      fixture.store.close();
    }
  });

  it("resolves exact qualified symbol queries before fuzzy fallback", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-basic-python", "205");
    try {
      const result = await searchSymbols({
        request: {
          query: "Runner.run",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: ["python"],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(result.symbols.symbols).toEqual([
        expect.objectContaining({
          name: "run",
          qualified_name: "Runner.run",
          language: "python"
        })
      ]);
    } finally {
      fixture.store.close();
    }
  });

  it("routes exact symbol misses to context instead of reference follow-up", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-basic-python", "208");
    try {
      const result = await searchSymbols({
        request: {
          query: "ConfigValidationService",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: ["python"],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(result.symbols.symbols).toEqual([]);
      expect(result.symbols.next_actions).toEqual([
        expect.objectContaining({
          tool: "context_for_task",
          args: expect.objectContaining({
            symbols: ["ConfigValidationService"],
            task: expect.stringContaining("Exact symbol 'ConfigValidationService' was not found")
          })
        })
      ]);
      expect(result.symbols.next_actions).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tool: "find_references"
          })
        ])
      );
    } finally {
      fixture.store.close();
    }
  });

  it("distinguishes cold graph from warm no-symbol graph query output", async () => {
    const coldStore = openGraphStore(path.join(dir, "cold.sqlite"));
    try {
      const cold = await searchSymbols({
        request: {
          query: "Runner",
          repo_root: path.resolve("tests/fixtures/fixture-basic-python"),
          exact: true,
          languages: ["python"],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: coldStore,
        snapshots: coldStore,
        catalog: coldStore,
        default_repo_root: path.resolve("tests/fixtures/fixture-basic-python")
      });

      expect(cold.symbols.symbols).toEqual([]);
      expect(cold.meta).toMatchObject({
        analysis_validity: "valid",
        verification_status: "blocked",
        capability_level: "unsupported"
      });
      expect(cold.symbols.next_actions).toEqual([]);
    } finally {
      coldStore.close();
    }

    const fixture = await indexedFixture("tests/fixtures/fixture-basic-python", "215");
    try {
      const missing = await searchSymbols({
        request: {
          query: "MissingSymbol",
          repo_root: fixture.repoRoot,
          exact: true,
          languages: ["python"],
          max_results: 5,
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(missing.symbols.symbols).toEqual([]);
      expect(missing.meta).toMatchObject({
        analysis_validity: "valid",
        verification_status: "needed"
      });
      expect(missing.symbols.next_actions).toEqual([
        expect.objectContaining({
          tool: "context_for_task",
          args: expect.objectContaining({
            task: expect.stringContaining("Exact symbol 'MissingSymbol' was not found"),
            symbols: ["MissingSymbol"]
          })
        })
      ]);
    } finally {
      fixture.store.close();
    }
  });

  it("finds resolved references and routes to impact", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-basic-python", "202");
    try {
      const run = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "202",
        qualified_name: "Runner.run"
      });
      const helper = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "202",
        qualified_name: "helper"
      });
      const result = await findReferences({
        request: {
          node_id: run[0]?.id,
          max_depth: 1,
          max_results: 10
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(result.references.references).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source_node_id: run[0]?.id,
            target_node_id: helper[0]?.id,
            status: "resolved"
          })
        ])
      );
      expect(result.references.next_actions).toEqual([
        expect.objectContaining({
          tool: "impact"
        })
      ]);
    } finally {
      fixture.store.close();
    }
  });

  it("surfaces cross-file incoming parser references within the budget", async () => {
    const repoRoot = path.join(dir, "cross-file-repo");
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "lib.py"), "def helper() -> str:\n    return 'ok'\n");
    fs.writeFileSync(path.join(repoRoot, "main.py"), "def run() -> str:\n    return helper()\n");
    const fixture = await indexedFixture(repoRoot, "206");
    try {
      const helper = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "206",
        qualified_name: "helper"
      });
      const result = await findReferences({
        request: {
          node_id: helper[0]?.id,
          max_depth: 1,
          max_results: 5
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: repoRoot
      });

      expect(result.references.references).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source_file_path: "main.py",
            target_file_path: "lib.py",
            reference_name: "helper",
            status: "resolved",
            evidence_kinds: ["parser"]
          })
        ])
      );
    } finally {
      fixture.store.close();
    }
  });

  it("labels bounded lexical references as low-confidence fallback evidence", async () => {
    const repoRoot = path.join(dir, "lexical-repo");
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "target.py"), "def target() -> str:\n    return 'ok'\n");
    fs.writeFileSync(path.join(repoRoot, "notes.md"), "Call target from the runtime adapter later.\n");
    const fixture = await indexedFixture(repoRoot, "207");
    try {
      const target = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "207",
        qualified_name: "target"
      });
      const result = await findReferences({
        request: {
          node_id: target[0]?.id,
          max_depth: 1,
          max_results: 5
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: repoRoot
      });

      expect(result.references.references).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source_file_path: "notes.md",
            reference_name: "target",
            reference_kind: "lexical",
            confidence: 0.2,
            evidence_kinds: ["text_fallback", "heuristic"],
            provenance: "bounded_lexical_identifier_scan",
            status: "unresolved"
          })
        ])
      );
    } finally {
      fixture.store.close();
    }
  });

  it("returns bounded stale evidence when a lexical reference path was deleted after indexing", async () => {
    const repoRoot = path.join(dir, "deleted-lexical-repo");
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "target.py"), "def target() -> str:\n    return 'ok'\n");
    fs.writeFileSync(path.join(repoRoot, "notes.md"), "Call target from the runtime adapter later.\n");
    const fixture = await indexedFixture(repoRoot, "208");
    try {
      const target = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "208",
        qualified_name: "target"
      });
      fs.rmSync(path.join(repoRoot, "notes.md"));

      const result = await findReferences({
        request: {
          node_id: target[0]?.id,
          max_depth: 1,
          max_results: 5
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: repoRoot
      });

      expect(result.references.references).toEqual([]);
      expect(result.references.result_count).toBe(0);
      expect(result.meta).toMatchObject({
        freshness: "stale",
        verification_status: "blocked"
      });
      expect(result.references.next_actions).toEqual([
        expect.objectContaining({
          reason: expect.stringMatching(/refresh/i)
        })
      ]);
      expect(JSON.stringify(result)).not.toContain("ENOENT");
      expect(JSON.stringify(result)).not.toContain("no such file or directory");
    } finally {
      fixture.store.close();
    }
  });

  it("gates symbol and impact queries on the shared snapshot validity receipt", async () => {
    const repoRoot = path.join(dir, "shared-validity-graph-repo");
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "target.py"), "def target() -> str:\n    return 'ok'\n");
    const fixture = await indexedFixture(repoRoot, "209");
    try {
      const target = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "209",
        qualified_name: "target"
      });
      const snapshotValidity = {
        snapshot_id: "209",
        state: "stale" as const,
        complete: true,
        checked_path_count: 1,
        observed_path_count: 1,
        missing_paths: ["target.py"],
        inaccessible_paths: [],
        refresh_required: true
      };
      const symbols = await searchSymbols({
        request: { query: "target", exact: true, max_results: 5, languages: [], source_byte_limit: 0 },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        snapshot_validity: snapshotValidity,
        default_repo_root: repoRoot
      });
      const impact = await computeImpact({
        request: { node_id: target[0]?.id ?? "", max_depth: 1, max_nodes: 5, direction: "both" },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        snapshot_validity: snapshotValidity,
        default_repo_root: repoRoot
      });

      expect(symbols.symbols.symbols).toEqual([]);
      expect(symbols.meta).toMatchObject({ freshness: "stale", verification_status: "blocked" });
      expect(impact.impact.affected_symbols).toEqual([]);
      expect(impact.impact.affected_files).toEqual([]);
      expect(impact.meta).toMatchObject({ freshness: "stale", verification_status: "blocked" });
    } finally {
      fixture.store.close();
    }
  });

  it("does not apply validity evidence from a different selected snapshot", async () => {
    const repoRoot = path.join(dir, "mismatched-validity-graph-repo");
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "target.py"), "def target() -> str:\n    return 'ok'\n");
    const fixture = await indexedFixture(repoRoot, "210");
    try {
      const result = await searchSymbols({
        request: {
          snapshot_id: "210",
          query: "target",
          exact: true,
          max_results: 5,
          languages: [],
          source_byte_limit: 0
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        snapshot_validity: {
          snapshot_id: "209",
          state: "valid",
          complete: true,
          checked_path_count: 1,
          observed_path_count: 1,
          missing_paths: [],
          inaccessible_paths: [],
          refresh_required: false
        },
        default_repo_root: repoRoot
      });

      expect(result.symbols.symbols).toEqual([]);
      expect(result.meta).toMatchObject({
        freshness: "unknown",
        verification_status: "blocked"
      });
      expect(result.meta.caveats).toEqual([
        expect.objectContaining({ kind: "degraded_snapshot_path_validity" })
      ]);
    } finally {
      fixture.store.close();
    }
  });

  it("keeps duplicate-name references ambiguous and bounded", async () => {
    const repoRoot = path.join(dir, "ambiguous-repo");
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "a.py"), "def helper() -> str:\n    return 'a'\n");
    fs.writeFileSync(path.join(repoRoot, "b.py"), "def helper() -> str:\n    return 'b'\n");
    fs.writeFileSync(path.join(repoRoot, "main.py"), "def run() -> str:\n    return helper()\n");
    const fixture = await indexedFixture(repoRoot, "203");
    try {
      const run = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "203",
        qualified_name: "run"
      });
      const result = await findReferences({
        request: {
          node_id: run[0]?.id,
          max_depth: 1,
          max_results: 1
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: repoRoot
      });

      expect(result.references.references).toEqual([
        expect.objectContaining({
          reference_name: "helper",
          status: "ambiguous"
        })
      ]);
      expect(result.meta.budget).toMatchObject({
        row_limit: 1,
        traversal_depth: 1
      });
    } finally {
      fixture.store.close();
    }
  });

  it("does not mark below-limit lexical reference results as truncated", async () => {
    const repoRoot = path.join(dir, "empty-reference-repo");
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "lonely.py"), "def lonely() -> str:\n    return 'alone'\n");
    const fixture = await indexedFixture(repoRoot, "213");
    try {
      const lonely = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "213",
        qualified_name: "lonely"
      });
      const result = await findReferences({
        request: {
          node_id: lonely[0]?.id,
          max_depth: 1,
          max_results: 10
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: repoRoot
      });

      expect(result.references.references).toEqual([
        expect.objectContaining({
          reference_name: "lonely",
          reference_kind: "lexical"
        })
      ]);
      expect(result.references.cursor).toBeUndefined();
      expect(result.references.result_count).toBe(1);
      expect(result.meta.truncated).toBe(false);
      expect(result.meta.analysis_validity).toBe("valid");
    } finally {
      fixture.store.close();
    }
  });

  it("does not mark exact-budget snapshot metadata as truncated", async () => {
    const repoRoot = path.join(dir, "exact-budget-repo");
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "only.py"), "def only() -> str:\n    return 'only'\n");
    const fixture = await indexedFixture(repoRoot, "214");
    try {
      const result = await findReferences({
        request: {
          symbol: "missing",
          max_depth: 1,
          max_results: 1
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: repoRoot
      });

      expect(result.meta.budget?.row_limit).toBe(1);
      expect(result.meta.truncated).toBe(false);
    } finally {
      fixture.store.close();
    }
  });

  it("computes bounded impact without broad source scans", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-basic-python", "204");
    try {
      const run = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "204",
        qualified_name: "Runner.run"
      });
      const result = await computeImpact({
        request: {
          node_id: run[0]?.id ?? "",
          max_depth: 1,
          max_nodes: 2,
          direction: "outgoing"
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(result.impact.affected_symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ qualified_name: "Runner.run" }),
          expect.objectContaining({ qualified_name: "helper" })
        ])
      );
      expect(result.impact.affected_files).toEqual([
        expect.objectContaining({
          path: "src/sample_pkg/service.py"
        })
      ]);
      expect(result.meta.budget).toMatchObject({
        row_limit: 2,
        traversal_depth: 1
      });
      expect(result.impact.confidence).toMatchObject({
        level: "low",
        scope: "local_only"
      });
    } finally {
      fixture.store.close();
    }
  });

  it("returns blocked metadata instead of scanning when no snapshot exists", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-basic-python");
    const store = openGraphStore(path.join(dir, "empty.sqlite"));
    try {
      const result = await searchSymbols({
        request: {
          query: "Runner",
          max_results: 5,
          source_byte_limit: 0,
          exact: false,
          languages: []
        },
        graph: store,
        snapshots: store,
        catalog: store,
        default_repo_root: repoRoot
      });

      expect(result.meta).toMatchObject({
        analysis_validity: "valid",
        freshness: "cold",
        verification_status: "blocked"
      });
      expect(result.symbols.next_actions).toEqual([]);
    } finally {
      store.close();
    }
  });

  it("returns Go parser-backed symbols and low-confidence impact edges", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-go-service-repo", "209", {
      registerGo: true,
      registerPython: false
    });
    try {
      const symbols = await searchSymbols({
        request: {
          query: "NewResponseCache",
          max_results: 5,
          source_byte_limit: 0,
          exact: true,
          languages: ["go"]
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(symbols.symbols.symbols).toEqual([
        expect.objectContaining({
          name: "NewResponseCache",
          language: "go",
          capability_level: "partial_semantic",
          evidence_kinds: ["parser"]
        })
      ]);

      const nodeId = symbols.symbols.symbols[0]?.node_id ?? "";
      const references = await findReferences({
        request: {
          node_id: nodeId,
          max_depth: 1,
          max_results: 10
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(references.references.references).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source_file_path: "cmd/service/main.go",
            target_file_path: "internal/graph/response_cache.go",
            evidence_kinds: ["parser"],
            provenance: "tree-sitter-go",
            status: "resolved"
          })
        ])
      );

      const impact = await computeImpact({
        request: {
          node_id: nodeId,
          max_depth: 2,
          max_nodes: 10,
          direction: "both"
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(impact.impact.confidence).toEqual(
        expect.objectContaining({
          level: "low",
          scope: "local_only"
        })
      );
      expect(impact.impact.edge_count).toBeGreaterThan(0);
    } finally {
      fixture.store.close();
    }
  });

  it("returns C++ routing symbols while impact remains low confidence without edges", async () => {
    const fixture = await indexedFixture("tests/fixtures/fixture-cmake-cpp-repo", "210", {
      registerCpp: true,
      registerPython: true
    });
    try {
      const symbols = await searchSymbols({
        request: {
          query: "mustExecute",
          max_results: 5,
          source_byte_limit: 0,
          exact: true,
          languages: ["cpp"]
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(symbols.symbols.symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "mustExecute",
            language: "cpp",
            capability_level: "resource_backed",
            evidence_kinds: ["heuristic"]
          })
        ])
      );

      const nodeId = symbols.symbols.symbols[0]?.node_id ?? "";
      const impact = await computeImpact({
        request: {
          node_id: nodeId,
          max_depth: 2,
          max_nodes: 10,
          direction: "both"
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        workspace: fixture.workspace,
        default_repo_root: fixture.repoRoot
      });

      expect(impact.impact.confidence).toEqual(
        expect.objectContaining({
          level: "low",
          scope: "empty"
        })
      );
      expect(impact.impact.edge_count).toBe(0);
    } finally {
      fixture.store.close();
    }
  });

  async function indexedFixture(
    repoRootInput: string,
    snapshotId: string,
    options: { registerPython?: boolean; registerGo?: boolean; registerCpp?: boolean; registerJsTs?: boolean } = {}
  ) {
    const repoRoot = path.resolve(repoRootInput);
    const store = openGraphStore(path.join(dir, `${snapshotId}.sqlite`));
    const registry = new ExtractorRegistryAdapter();
    if (options.registerPython ?? true) {
      registry.register(new PythonTreeSitterExtractorAdapter());
    }
    if (options.registerGo ?? false) {
      registry.register(new GoDeclarationExtractorAdapter());
    }
    if (options.registerCpp ?? false) {
      registry.register(new CppDeclarationExtractorAdapter({ language: "cpp" }));
    }
    if (options.registerJsTs ?? false) {
      registry.register(new JavaScriptTypeScriptTreeSitterExtractorAdapter({ language: "javascript" }));
      registry.register(new JavaScriptTypeScriptTreeSitterExtractorAdapter({ language: "typescript" }));
    }
    const workspace = new WorkspaceFileAdapter({ repoRoot });
    await indexRepositoryGraph({
      repo_root: repoRoot,
      scanner: new FileCatalogScannerAdapter(),
      workspace,
      extractors: registry,
      resource_extractor: new ResourceExtractorAdapter(),
      graph: store,
      catalog: store,
      snapshots: store,
      clock,
      schema_version: SCHEMA_VERSION,
      snapshot_id: snapshotId
    });
    return { repoRoot, store, workspace };
  }
});
