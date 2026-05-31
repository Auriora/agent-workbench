import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  applicationContracts,
  domainContracts,
  presentationContracts,
  adapterEvidenceSchema,
  capabilityLevelSchema,
  CONTRACT_VERSION,
  makeEnvelope,
  applyWorkspaceEditRequestSchema,
  applyWorkspaceEditResultSchema,
  findReferencesRequestSchema,
  findReferencesResultSchema,
  impactRequestSchema,
  impactResultSchema,
  previewWorkspaceEditRequestSchema,
  previewWorkspaceEditResultSchema,
  repoOverviewSchema,
  repoScopeSchema,
  responseEnvelopeSchema,
  symbolSearchRequestSchema,
  symbolSearchResultSchema,
  taskContextRequestSchema,
  taskContextSchema,
  verificationPlanRequestSchema,
  verificationPlanSchema
} from "../../src/contracts/index.js";
import { capabilityLevelSchema as domainCapabilityLevelSchema } from "../../src/contracts/domain-contracts.js";

describe("runtime contract categories", () => {
  it("re-export canonical contracts by category", () => {
    expect(applicationContracts.responseMetadataSchema).toBeDefined();
    expect(domainContracts.capabilityLevelSchema).toBeDefined();
    expect(domainContracts.capabilityLevelSchema).toBe(capabilityLevelSchema);
    expect(presentationContracts.attentionItemSchema).toBeDefined();
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
        governing_docs: [],
        validation_hints: [
          {
            command: "pnpm test",
            reason: "package.json indicates a testable TypeScript/JavaScript project.",
            status: "needed"
          }
        ],
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
