/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as contractBarrel from "../../src/contracts/index.js";
import {
  applicationContracts,
  domainContracts,
  presentationContracts,
  adapterEvidenceSchema,
  capabilityLevelSchema,
  CONTRACT_VERSION,
  runtimeStatusCaveatSchema,
  workspaceWatcherConfigSchema,
  DEFAULT_WORKSPACE_WATCHER_DEBOUNCE_MS,
  DEFAULT_WORKSPACE_WATCHER_ENABLED,
  DEFAULT_WORKSPACE_WATCHER_EVENT_BUDGET,
  makeEnvelope,
  applyWorkspaceEditRequestSchema,
  applyWorkspaceEditResultSchema,
  findReferencesRequestSchema,
  findReferencesResultSchema,
  impactRequestSchema,
  impactResultSchema,
  integrationHealthSchema,
  previewWorkspaceEditRequestSchema,
  previewWorkspaceEditResultSchema,
  repoOverviewSchema,
  repoScopeSchema,
  responseMetadataSchema,
  responseEnvelopeSchema,
  symbolSearchRequestSchema,
  symbolSearchResultSchema,
  taskContextRequestSchema,
  taskContextSchema,
  trustCalibrationSchema,
  trustUseSchema,
  trustVerificationRequirementSchema,
  verificationPlanRequestSchema,
  verificationPlanSchema
} from "../../src/contracts/index.js";
import { capabilityLevelSchema as domainCapabilityLevelSchema } from "../../src/contracts/domain-contracts.js";
import * as runtimeContracts from "../../src/contracts/runtime-contracts.js";
import { resolveWorkspaceWatcherConfig } from "../../src/domain/models/index.js";

describe("runtime contract categories", () => {
  it("re-export canonical contracts by category", () => {
    expect(applicationContracts.responseMetadataSchema).toBeDefined();
    expect(domainContracts.capabilityLevelSchema).toBeDefined();
    expect(domainContracts.capabilityLevelSchema).toBe(capabilityLevelSchema);
    expect(presentationContracts.attentionItemSchema).toBeDefined();
  });

  it("keeps the runtime and top-level contract barrels compatible", () => {
    const representativeContextExports = [
      "capabilityLevelSchema",
      "CONTRACT_VERSION",
      "taskContextSchema",
      "repoOverviewSchema",
      "docsSearchResultSchema",
      "symbolSearchResultSchema",
      "findReferencesResultSchema",
      "verificationPlanSchema",
      "diagnosticsForFilesResultSchema",
      "previewWorkspaceEditResultSchema",
      "responseMetadataSchema",
      "responseEnvelopeSchema",
      "integrationHealthSchema",
      "codexIntegrationProfileSchema",
      "checkMarkdownDocumentResultSchema",
      "markdownFormatPlanSchema",
      "trustCalibrationSchema",
      "trustUseSchema",
      "trustVerificationRequirementSchema",
      "makeEnvelope"
    ] as const;

    expect(Object.keys(runtimeContracts).sort()).toEqual(
      expect.arrayContaining([...representativeContextExports])
    );

    for (const exportName of Object.keys(runtimeContracts) as Array<
      keyof typeof runtimeContracts
    >) {
      expect(contractBarrel[exportName as keyof typeof contractBarrel]).toBe(
        runtimeContracts[exportName]
      );
    }
  });

  it("keeps capability levels canonical in the domain contracts", () => {
    expect(domainContracts.capabilityLevelSchema.parse("partial_semantic")).toBe(
      "partial_semantic"
    );
    expect(domainContracts.capabilityLevelSchema.parse("unsupported")).toBe("unsupported");
    expect(() => domainCapabilityLevelSchema.parse("resource_only")).toThrow();
    expect(() => domainCapabilityLevelSchema.parse("routing_evidence")).toThrow();
  });
});

describe("runtime contracts", () => {
  it("accepts only canonical capability levels", () => {
    expect(capabilityLevelSchema.parse("partial_semantic")).toBe("partial_semantic");
    expect(() => capabilityLevelSchema.parse("resource_only")).toThrow();
    expect(() => capabilityLevelSchema.parse("routing_evidence")).toThrow();
  });

  it("models adapter evidence without language-specific contract fields", () => {
    const parsed = adapterEvidenceSchema.parse({
      domain: "language",
      name: "typescript",
      capability_level: "unsupported",
      evidence_kinds: [],
      paths: ["src/app.ts"],
      provenance: "file_identity",
      confidence: "high",
      metadata: {
        adapter: "future-typescript"
      }
    });

    expect(parsed).toEqual({
      domain: "language",
      name: "typescript",
      capability_level: "unsupported",
      evidence_kinds: [],
      paths: ["src/app.ts"],
      provenance: "file_identity",
      confidence: "high",
      metadata: {
        adapter: "future-typescript"
      }
    });
    expect(() =>
      adapterEvidenceSchema.parse({
        ...parsed,
        python_module: "src.app"
      })
    ).toThrow();
  });

  it("builds the shared response envelope", () => {
    const envelope = makeEnvelope({
      data: { ok: true },
      meta: {
        analysis_validity: "valid",
        freshness: "fresh",
        scope: {
          repo_root: "/repo",
          indexed_roots: ["src"],
          skipped_roots: ["node_modules"],
          languages: ["python"]
        },
        capability_level: "partial_semantic",
        evidence_kinds: ["parser", "sqlite"],
        verification_status: "planned",
        truncated: false,
        budget: {
          time_ms: 100,
          row_limit: 100
        }
      }
    });

    expect(envelope.contract_version).toBe(CONTRACT_VERSION);
    expect(responseEnvelopeSchema(z.object({ ok: z.literal(true) })).parse(envelope)).toEqual(
      envelope
    );
  });

  it("accepts additive trust calibration while preserving older metadata", () => {
    const legacyMetadata = {
      analysis_validity: "valid",
      freshness: "fresh",
      scope: {
        repo_root: "/repo",
        indexed_roots: ["src"],
        skipped_roots: [],
        languages: ["typescript"]
      },
      capability_level: "resource_backed",
      evidence_kinds: ["docs"],
      verification_status: "needed",
      truncated: false
    };

    expect(responseMetadataSchema.parse(legacyMetadata)).toEqual(legacyMetadata);
    expect(
      responseMetadataSchema.parse({
        ...legacyMetadata,
        trust: {
          safe_to_use_for: ["navigation"],
          not_safe_to_use_for: ["task_completion_claim"],
          must_verify_by: ["direct_read_relevant_source"]
        }
      })
    ).toMatchObject({
      trust: {
        safe_to_use_for: ["navigation"],
        not_safe_to_use_for: ["task_completion_claim"],
        must_verify_by: ["direct_read_relevant_source"]
      }
    });
  });

  it("rejects unknown trust vocabulary and contradictory trust uses", () => {
    expect(trustUseSchema.parse("navigation")).toBe("navigation");
    expect(trustVerificationRequirementSchema.parse("run_planned_validation")).toBe(
      "run_planned_validation"
    );
    expect(() => trustUseSchema.parse("proof")).toThrow();
    expect(() => trustVerificationRequirementSchema.parse("run_any_command")).toThrow();
    expect(() =>
      trustCalibrationSchema.parse({
        safe_to_use_for: ["navigation"],
        not_safe_to_use_for: ["navigation"],
        must_verify_by: []
      })
    ).toThrow();
  });

  it("models structured runtime status caveats for degraded and blocked states", () => {
    const caveat = runtimeStatusCaveatSchema.parse({
      kind: "parser_timeout",
      severity: "blocker",
      message: "Parser workers exceeded the analysis timeout.",
      evidence_kinds: ["parser"]
    });

    const envelope = makeEnvelope({
      data: { ok: true },
      meta: {
        analysis_validity: "partial",
        freshness: "fresh",
        scope: {
          repo_root: "/repo",
          indexed_roots: ["src"],
          skipped_roots: [],
          languages: ["python"]
        },
        capability_level: "partial_semantic",
        evidence_kinds: ["parser"],
        verification_status: "needed",
        truncated: false,
        caveats: [caveat]
      }
    });

    expect(envelope.meta).toMatchObject({
      caveats: [caveat]
    });
    expect(responseEnvelopeSchema(z.object({ ok: z.literal(true) })).parse(envelope)).toEqual(
      envelope
    );
  });

  it("models workspace watcher defaults through contract and domain surfaces", () => {
    expect(workspaceWatcherConfigSchema.parse({})).toEqual({
      enabled: DEFAULT_WORKSPACE_WATCHER_ENABLED,
      debounce_ms: DEFAULT_WORKSPACE_WATCHER_DEBOUNCE_MS,
      event_budget: DEFAULT_WORKSPACE_WATCHER_EVENT_BUDGET
    });
    expect(resolveWorkspaceWatcherConfig()).toEqual(workspaceWatcherConfigSchema.parse({}));
    expect(
      workspaceWatcherConfigSchema.parse({
        enabled: true,
        debounce_ms: 500,
        event_budget: 250
      })
    ).toEqual({
      enabled: true,
      debounce_ms: 500,
      event_budget: 250
    });
    expect(resolveWorkspaceWatcherConfig({ debounce_ms: 750 })).toEqual({
      enabled: DEFAULT_WORKSPACE_WATCHER_ENABLED,
      debounce_ms: 750,
      event_budget: DEFAULT_WORKSPACE_WATCHER_EVENT_BUDGET
    });
    expect(() => workspaceWatcherConfigSchema.parse({ debounce_ms: -1 })).toThrow();
    expect(() => workspaceWatcherConfigSchema.parse({ event_budget: 0 })).toThrow();
    expect(() => workspaceWatcherConfigSchema.parse({ unexpected: true })).toThrow();
  });

  it("models integration health with explicit session callability states", () => {
    const health = integrationHealthSchema.parse({
      repo_root: "/repo",
      runtime_version: "0.1.0",
      profile: "codex",
      session: {
        client: "codex",
        discovery_state: "provided",
        discovered_tools: ["context_for_task"],
        discovered_resources: ["repo:///status"]
      },
      surfaces: [
        {
          name: "context_for_task",
          kind: "tool",
          configured: true,
          registered: true,
          advertised: true,
          caller_discovery: "discovered",
          callable: "callable",
          status: "available",
          reason: "The active client session discovered this registered tool.",
          evidence_kinds: ["config"],
          capability_class: "read_only"
        },
        {
          name: "impact",
          kind: "tool",
          configured: true,
          registered: true,
          advertised: true,
          caller_discovery: "not_discovered",
          callable: "not_callable",
          status: "unavailable",
          reason: "The configured tool was not discovered by the active client session.",
          evidence_kinds: ["config"],
          capability_class: "read_only",
          discovery_action: {
            tool: "context_for_task",
            args: { task: "Check available Agent Workbench tools" }
          }
        },
        {
          name: "find_references",
          kind: "tool",
          configured: true,
          registered: true,
          advertised: true,
          caller_discovery: "unknown",
          callable: "unknown",
          status: "unknown",
          reason: "Caller-discovered tool evidence was not provided.",
          evidence_kinds: ["config"],
          capability_class: "read_only"
        },
        {
          name: "apply_workspace_edit",
          kind: "tool",
          configured: true,
          registered: true,
          advertised: true,
          caller_discovery: "discovered",
          callable: "not_callable",
          status: "blocked",
          reason: "Workspace mutation is blocked until a matching preview token is supplied.",
          evidence_kinds: ["config"],
          capability_class: "workspace_write",
          replacement_action: {
            tool: "preview_workspace_edit",
            args: { edits: [] }
          }
        },
        {
          name: "dynamic",
          kind: "tool",
          configured: false,
          registered: false,
          advertised: false,
          caller_discovery: "unknown",
          callable: "not_callable",
          status: "hidden",
          reason: "Generic dynamic invocation is intentionally deferred.",
          evidence_kinds: ["docs"]
        }
      ],
      counts: {
        available: 1,
        unavailable: 1,
        blocked: 1,
        hidden: 1,
        unknown: 1
      },
      next_actions: [{ tool: "context_for_task", args: { task: "Inspect repository" } }]
    });

    expect(health.session.discovered_prompts).toEqual([]);
    expect(health.surfaces.map((surface) => surface.status).sort()).toEqual([
      "available",
      "blocked",
      "hidden",
      "unavailable",
      "unknown"
    ]);
    expect(() =>
      integrationHealthSchema.parse({
        ...health,
        surfaces: [
          {
            ...health.surfaces[0],
            caller_discovery: "discovered",
            callable: "maybe"
          }
        ]
      })
    ).toThrow();
  });

  it("models bounded task context requests and responses", () => {
    const request = taskContextRequestSchema.parse({
      task: "Update the Codex MCP profile",
      files: ["src/server.ts"]
    });

    expect(request).toEqual({
      task: "Update the Codex MCP profile",
      files: ["src/server.ts"],
      symbols: [],
      max_files: 10,
      max_docs: 5
    });
    expect(() =>
      taskContextRequestSchema.parse({
        task: "too broad",
        max_files: 500
      })
    ).toThrow();

    expect(
      taskContextSchema.parse({
        task: request.task,
        repo_root: "/repo",
        summary: "Task context found local evidence.",
        requested_files: [
          {
            path: "src/server.ts",
            language: "typescript",
            exists: true,
            capability_level: "unsupported",
            evidence_kinds: [],
            reason: "Requested explicitly by the caller."
          }
        ],
        related_files: [],
        ranked_symbols: [],
        governing_docs: [],
        validation_hints: [
          {
            command: "pnpm test",
            reason: "package.json indicates a testable TypeScript/JavaScript project.",
            status: "needed"
          }
        ],
        skipped_work: [],
        completeness: {
          complete_enough: true,
          markers: ["source_candidates_ranked", "validation_hints_available"],
          caveats: ["Related files and governing docs are routing evidence; directly read source before editing."]
        },
        risks: [],
        next_actions: [
          {
            tool: "verification_plan",
            args: {
              files: ["src/server.ts"]
            }
          }
        ]
      })
    ).toMatchObject({
      task: "Update the Codex MCP profile",
      requested_files: [expect.objectContaining({ path: "src/server.ts" })]
    });
  });

  it("models repo scope and overview resources", () => {
    expect(
      repoScopeSchema.parse({
        repo_root: "/repo",
        indexed_roots: ["."],
        skipped_roots: ["node_modules"],
        languages: ["python", "typescript"],
        file_counts: {
          python: 1,
          typescript: 2
        },
        capability_counts: {
          semantic: 0,
          partial_semantic: 1,
          resource_backed: 1,
          unsupported: 1
        },
        generated_or_vendor_roots: ["node_modules"]
      })
    ).toMatchObject({
      languages: ["python", "typescript"],
      capability_counts: {
        partial_semantic: 1
      }
    });

    expect(
      repoOverviewSchema.parse({
        repo_root: "/repo",
        summary: "Repository has indexed files.",
        languages: ["python", "typescript"],
        platforms: ["node"],
        key_files: [
          {
            path: "src/app.ts",
            language: "typescript",
            exists: true,
            capability_level: "unsupported",
            evidence_kinds: [],
            reason: "Recognized source file."
          }
        ],
        key_docs: [],
        validation_hints: [
          {
            command: "pnpm test",
            reason: "package.json indicates tests may be available.",
            status: "needed"
          }
        ],
        recommended_first_calls: [
          {
            tool: "read_resource",
            args: {
              uri: "repo:///status"
            }
          }
        ]
      })
    ).toMatchObject({
      platforms: ["node"],
      key_files: [expect.objectContaining({ path: "src/app.ts" })]
    });
  });

  it("models verification plans as planned, not executed, validation", () => {
    const request = verificationPlanRequestSchema.parse({
      files: ["src/server.ts"],
      changed_files: ["src/server.ts"]
    });

    expect(request).toEqual({
      files: ["src/server.ts"],
      changed_files: ["src/server.ts"],
      include_static_feedback: true,
      max_commands: 10
    });
    expect(() =>
      verificationPlanRequestSchema.parse({
        max_commands: 100
      })
    ).toThrow();

    expect(
      verificationPlanSchema.parse({
        repo_root: "/repo",
        status: "planned",
        summary: "Planned 1 validation command.",
        planned_commands: [
          {
            command: "pnpm",
            args: ["test"],
            display: "pnpm test",
            reason: "package.json indicates tests are available.",
            status: "planned",
            execution: "not_executed"
          }
        ],
        risks: [],
        next_actions: [
          {
            tool: "manual_command",
            args: {
              command: "pnpm test"
            }
          }
        ]
      })
    ).toMatchObject({
      status: "planned",
      planned_commands: [
        expect.objectContaining({
          execution: "not_executed"
        })
      ]
    });
  });

  it("models graph query requests and bounded responses", () => {
    expect(symbolSearchRequestSchema.parse({ query: "Runner" })).toMatchObject({
      query: "Runner",
      exact: false,
      languages: [],
      max_results: 20,
      source_byte_limit: 0
    });
    expect(() => symbolSearchRequestSchema.parse({ query: "", max_results: 500 })).toThrow();

    expect(
      symbolSearchResultSchema.parse({
        query: "Runner",
        repo_root: "/repo",
        snapshot_id: "1",
        symbols: [
          {
            node_id: "node-1",
            kind: "class",
            name: "Runner",
            qualified_name: "Runner",
            path: "src/service.py",
            language: "python",
            source_range: {
              start_line: 1,
              start_column: 0,
              end_line: 3,
              end_column: 0
            },
            capability_level: "partial_semantic",
            evidence_kinds: ["parser"],
            source_section: {
              path: "src/service.py",
              start_line: 1,
              end_line: 3,
              byte_count: 20,
              truncated: false,
              text: "class Runner:"
            }
          }
        ],
        next_actions: [{ tool: "find_references", args: { symbol: "Runner" } }]
      })
    ).toMatchObject({
      symbols: [expect.objectContaining({ name: "Runner" })]
    });

    expect(findReferencesRequestSchema.parse({ symbol: "Runner" })).toMatchObject({
      symbol: "Runner",
      max_depth: 1,
      max_results: 50
    });
    expect(() => findReferencesRequestSchema.parse({ max_results: 200 })).toThrow();
    expect(
      findReferencesResultSchema.parse({
        repo_root: "/repo",
        snapshot_id: "1",
        references: [
          {
            source_node_id: "a",
            target_node_id: "b",
            target_file_path: "src/service.py",
            reference_kind: "call",
            confidence: 0.8,
            evidence_kinds: ["parser"],
            provenance: "tree-sitter-reference-resolution",
            status: "resolved"
          }
        ],
        next_actions: [{ tool: "impact", args: { node_id: "a" } }]
      })
    ).toMatchObject({
      references: [expect.objectContaining({ status: "resolved" })]
    });

    expect(impactRequestSchema.parse({ node_id: "node-1" })).toMatchObject({
      node_id: "node-1",
      max_depth: 2,
      max_nodes: 50,
      direction: "both"
    });
    expect(
      impactResultSchema.parse({
        repo_root: "/repo",
        snapshot_id: "1",
        start_node_ids: ["node-1"],
        affected_symbols: [],
        affected_files: [],
        edge_count: 0,
        reached_depth: 0,
        traversal_truncated: false,
        confidence: {
          level: "low",
          scope: "empty",
          reason: "No graph edges were found.",
          evidence_kinds: ["parser"]
        },
        next_actions: []
      })
    ).toMatchObject({
      start_node_ids: ["node-1"]
    });
  });

  it("models bounded workspace edit preview and apply contracts", () => {
    expect(
      previewWorkspaceEditRequestSchema.parse({
        edits: [
          {
            path: "src/app.ts",
            replacement_text: "export const value = 1;\n"
          }
        ]
      })
    ).toMatchObject({
      edits: [
        {
          path: "src/app.ts",
          replacement_text: "export const value = 1;\n"
        }
      ],
      expires_in_ms: 600_000
    });
    expect(() => previewWorkspaceEditRequestSchema.parse({ edits: [] })).toThrow();
    expect(() =>
      previewWorkspaceEditRequestSchema.parse({
        edits: Array.from({ length: 21 }, (_, index) => ({
          path: `src/file-${index}.ts`,
          replacement_text: ""
        }))
      })
    ).toThrow();

    expect(
      previewWorkspaceEditResultSchema.parse({
        repo_root: "/repo",
        preview: {
          preview_token: "token",
          created_at: "2026-05-31T00:00:00.000Z",
          expires_at: "2026-05-31T00:10:00.000Z",
          files: [
            {
              path: "src/app.ts",
              base_exists: true,
              base_hash: "base",
              after_hash: "after",
              change_count: 1
            }
          ],
          operation: "bounded_text_edit",
          mutation_class: "workspace_write"
        },
        changed_files: [
          {
            path: "src/app.ts",
            language: "typescript",
            exists: true,
            capability_level: "unsupported",
            evidence_kinds: [],
            reason: "Edit preview requested."
          }
        ],
        next_actions: [
          {
            tool: "apply_workspace_edit",
            args: {
              preview_token: "token"
            }
          }
        ]
      })
    ).toMatchObject({
      preview: {
        operation: "bounded_text_edit",
        mutation_class: "workspace_write"
      }
    });

    expect(
      applyWorkspaceEditRequestSchema.parse({
        preview_token: "token",
        edits: [
          {
            path: "src/app.ts",
            replacement_text: "export const value = 2;\n"
          }
        ]
      })
    ).toMatchObject({
      preview_token: "token",
      edits: [
        {
          path: "src/app.ts",
          replacement_text: "export const value = 2;\n"
        }
      ]
    });
    expect(() => applyWorkspaceEditRequestSchema.parse({ preview_token: "", edits: [] })).toThrow();

    expect(
      applyWorkspaceEditResultSchema.parse({
        repo_root: "/repo",
        preview_token: "token",
        applied_files: [
          {
            path: "src/app.ts",
            language: "typescript",
            exists: true,
            capability_level: "unsupported",
            evidence_kinds: [],
            reason: "Edit applied."
          }
        ],
        status: "applied",
        next_actions: [
          {
            tool: "verification_plan",
            args: {
              changed_files: ["src/app.ts"]
            }
          }
        ]
      })
    ).toMatchObject({
      status: "applied",
      next_actions: [expect.objectContaining({ tool: "verification_plan" })]
    });
  });
});
