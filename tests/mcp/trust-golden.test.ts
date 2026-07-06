/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type {
  ResponseEnvelope,
  ResponseMetadata
} from "../../src/contracts/index.js";
import { codexIntegrationProfileResource } from "../../src/interface-adapters/mcp/registries/resources/codex-integration-profile.js";
import { repoStatusResource } from "../../src/interface-adapters/mcp/registries/resources/repo-status.js";
import { integrationHealthResource } from "../../src/interface-adapters/mcp/registries/resources/integration-health.js";
import { checkMarkdownDocumentTool } from "../../src/interface-adapters/mcp/registries/tools/check-markdown-document.js";
import { contextForTaskTool } from "../../src/interface-adapters/mcp/registries/tools/context-for-task.js";
import { diagnosticsForFilesTool } from "../../src/interface-adapters/mcp/registries/tools/diagnostics-for-files.js";
import { docsReadSectionTool } from "../../src/interface-adapters/mcp/registries/tools/docs-read-section.js";
import { findReferencesTool } from "../../src/interface-adapters/mcp/registries/tools/find-references.js";
import { impactTool } from "../../src/interface-adapters/mcp/registries/tools/impact.js";
import { applyWorkspaceEditTool } from "../../src/interface-adapters/mcp/registries/tools/apply-workspace-edit.js";
import { previewWorkspaceEditTool } from "../../src/interface-adapters/mcp/registries/tools/preview-workspace-edit.js";
import { symbolSearchTool } from "../../src/interface-adapters/mcp/registries/tools/symbol-search.js";
import { verificationPlanTool } from "../../src/interface-adapters/mcp/registries/tools/verification-plan.js";
import {
  parseMcpResourceText,
  parseMcpTextContent,
  registerMcpResource,
  registerMcpTool
} from "../helpers/mcp-harness.js";

const proofLikeUnsafe = [
  "bounded_executed_validation_claim",
  "closure_claim",
  "implementation_claim",
  "passed_validation_claim",
  "safe_mutation_claim",
  "security_or_vulnerability_claim",
  "task_completion_claim",
  "whole_program_impact_claim"
];

const graphUnsafe = [
  "closure_claim",
  "passed_validation_claim",
  "safe_mutation_claim",
  "security_or_vulnerability_claim",
  "task_completion_claim",
  "whole_program_impact_claim"
];

const failureVerify = [
  "direct_read_relevant_source",
  "inspect_ranked_evidence",
  "refresh_runtime_snapshot",
  "resolve_blocked_environment",
  "run_planned_validation"
];

describe("public MCP trust golden responses", () => {
  it("keeps repository and integration health as runtime routing evidence", async () => {
    const status = registerMcpResource(repoStatusResource, {
      repoRoot: "/repo",
      getRepoStatus: ({ repo_root }) => ({
        status: {
          repo_root,
          runtime_state: "fresh",
          freshness: "fresh",
          indexed_roots: ["."],
          skipped_roots: [],
          adapter_coverage: []
        },
        meta: meta({
          repoRoot: repo_root,
          capabilityLevel: "resource_backed",
          evidenceKinds: ["config"],
          languages: ["typescript"],
          verificationStatus: "needed"
        })
      })
    });
    const integration = registerMcpResource(integrationHealthResource, {
      repoRoot: "/repo",
      getIntegrationHealth: ({ request }) => ({
        health: integrationHealthFixture(request),
        meta: meta({
          repoRoot: request.repo_root ?? "/repo",
          capabilityLevel: "resource_backed",
          evidenceKinds: ["config"],
          languages: ["typescript"],
          verificationStatus: "needed"
        })
      })
    });

    expectTrust(
      parseMcpResourceText<ResponseEnvelope<unknown>>(await status.handler({})),
      {
        safe_to_use_for: ["navigation", "next_read_selection", "runtime_availability"],
        not_safe_to_use_for: proofLikeUnsafe,
        must_verify_by: [
          "direct_read_relevant_source",
          "inspect_ranked_evidence",
          "run_planned_validation"
        ]
      }
    );
    expectTrust(
      parseMcpResourceText<ResponseEnvelope<unknown>>(await integration.handler({ client: "codex" })),
      {
        safe_to_use_for: ["navigation", "next_read_selection", "runtime_availability"],
        not_safe_to_use_for: proofLikeUnsafe,
        must_verify_by: [
          "direct_read_relevant_source",
          "inspect_ranked_evidence",
          "run_planned_validation"
        ]
      }
    );
  });

  it("keeps static integration profiles distinct from live integration health", async () => {
    const profile = registerMcpResource(codexIntegrationProfileResource, {});

    expectTrust(
      parseMcpResourceText<ResponseEnvelope<unknown>>(await profile.handler({})),
      {
        safe_to_use_for: ["navigation", "next_read_selection"],
        not_safe_to_use_for: [
          ...proofLikeUnsafe,
          "runtime_availability"
        ].sort(),
        must_verify_by: [
          "direct_read_relevant_source",
          "inspect_ranked_evidence",
          "run_planned_validation"
        ]
      }
    );
  });

  it("keeps context routing and graph parser evidence scoped to navigation and local structure", async () => {
    const context = registerMcpTool(contextForTaskTool, {
      getTaskContext: ({ request }) => ({
        context: {
          task: request.task,
          repo_root: request.repo_root ?? "/repo",
          summary: "Fixture context.",
          requested_files: [],
          related_files: [],
          ranked_symbols: [],
          governing_docs: [],
          lifecycle_evidence: [],
          validation_hints: [],
          skipped_work: [],
          completeness: {
            complete_enough: false,
            markers: ["source_candidates_ranked"],
            caveats: []
          },
          risks: [],
          next_actions: []
        },
        meta: meta({
          repoRoot: request.repo_root ?? "/repo",
          capabilityLevel: "partial_semantic",
          evidenceKinds: ["config", "parser"],
          languages: ["python"],
          verificationStatus: "needed"
        })
      })
    });
    const symbol = registerMcpTool(symbolSearchTool, {
      searchSymbols: ({ request }) => ({
        symbols: {
          repo_root: request.repo_root ?? "/repo",
          query: request.query,
          snapshot_id: "snapshot-1",
          symbols: [],
          next_actions: []
        },
        meta: meta({
          repoRoot: request.repo_root ?? "/repo",
          capabilityLevel: "partial_semantic",
          evidenceKinds: ["parser"],
          languages: ["python"],
          verificationStatus: "needed"
        })
      })
    });
    const references = registerMcpTool(findReferencesTool, {
      findReferences: ({ request }) => ({
        references: {
          repo_root: request.repo_root ?? "/repo",
          snapshot_id: "snapshot-1",
          references: [],
          next_actions: []
        },
        meta: meta({
          repoRoot: request.repo_root ?? "/repo",
          capabilityLevel: "partial_semantic",
          evidenceKinds: ["parser"],
          languages: ["python"],
          verificationStatus: "needed"
        })
      })
    });

    const expected = {
      safe_to_use_for: ["local_structure_reference", "navigation", "next_read_selection"],
      not_safe_to_use_for: graphUnsafe,
      must_verify_by: ["direct_read_relevant_source", "run_planned_validation"]
    };

    expectTrust(parseMcpTextContent<ResponseEnvelope<unknown>>(await context.handler({ task: "Plan edit" })), {
      safe_to_use_for: ["local_structure_reference", "navigation", "next_read_selection"],
      not_safe_to_use_for: proofLikeUnsafe,
      must_verify_by: [
        "direct_read_relevant_source",
        "inspect_ranked_evidence",
        "run_planned_validation"
      ]
    });
    expectTrust(parseMcpTextContent<ResponseEnvelope<unknown>>(await symbol.handler({ query: "handler" })), expected);
    expectTrust(parseMcpTextContent<ResponseEnvelope<unknown>>(await references.handler({ symbol: "handler" })), expected);
  });

  it("keeps impact confidence as routing and never whole-program proof", async () => {
    const impact = registerMcpTool(impactTool, {
      computeImpact: ({ request }) => ({
        impact: {
          repo_root: request.repo_root ?? "/repo",
          snapshot_id: "snapshot-1",
          start_node_ids: [request.node_id],
          affected_symbols: [],
          affected_files: [],
          edge_count: 0,
          reached_depth: 0,
          traversal_truncated: false,
          confidence: {
            level: "low",
            scope: "empty",
            reason: "Fixture impact result has no graph evidence.",
            evidence_kinds: []
          },
          next_actions: []
        },
        meta: meta({
          repoRoot: request.repo_root ?? "/repo",
          capabilityLevel: "resource_backed",
          evidenceKinds: ["heuristic"],
          languages: ["python"],
          verificationStatus: "needed"
        })
      })
    });

    expectTrust(parseMcpTextContent<ResponseEnvelope<unknown>>(await impact.handler({ node_id: "node-1" })), {
      safe_to_use_for: ["navigation", "next_read_selection"],
      not_safe_to_use_for: graphUnsafe,
      must_verify_by: ["direct_read_relevant_source", "run_planned_validation"]
    });
  });

  it("bounds direct-read docs and Markdown quality evidence to precise/static claims", async () => {
    const docsRead = registerMcpTool(docsReadSectionTool, {
      readDocsSection: ({ request }) => ({
        read: {
          repo_root: request.repo_root ?? "/repo",
          path: request.path,
          heading_id: request.heading_id,
          status: "done",
          heading: { id: request.heading_id, text: "Setup", depth: 2, line: 3 },
          section: {
            path: request.path,
            start_line: 3,
            end_line: 5,
            byte_count: 40,
            truncated: false,
            text: "## Setup\nUse direct evidence.",
            caveat: "Direct-read evidence for precise documentation claims."
          },
          warnings: [],
          next_actions: []
        },
        meta: meta({
          repoRoot: request.repo_root ?? "/repo",
          capabilityLevel: "resource_backed",
          evidenceKinds: ["docs", "direct_read"],
          languages: ["markdown"],
          verificationStatus: "done"
        })
      })
    });
    const markdown = registerMcpTool(checkMarkdownDocumentTool, {
      checkMarkdownDocument: ({ request }) => ({
        check: {
          repo_root: request.repo_root ?? "/repo",
          path: request.path,
          status: "done",
          summary: "Markdown document has 1 quality finding.",
          findings: [
            {
              category: "heading_structure",
              severity: "warning",
              rule_id: "markdown.heading.skipped_level",
              code: "markdown.heading.skipped_level",
              path: request.path,
              start_line: 4,
              start_column: 0,
              end_line: 4,
              end_column: 12,
              message: "Heading jumps from level 2 to level 4.",
              evidence: "#### Details",
              suggested_action: "Insert the missing intermediate heading level.",
              evidence_kinds: ["docs", "direct_read"]
            }
          ],
          warnings: [],
          truncated: false,
          next_actions: []
        },
        meta: meta({
          repoRoot: request.repo_root ?? "/repo",
          capabilityLevel: "resource_backed",
          evidenceKinds: ["docs", "direct_read"],
          languages: ["markdown"],
          verificationStatus: "done"
        })
      })
    });

    expectTrust(
      parseMcpTextContent<ResponseEnvelope<unknown>>(
        await docsRead.handler({ path: "docs/guide.md", heading_id: "setup" })
      ),
      {
        safe_to_use_for: ["precise_direct_read_claim"],
        not_safe_to_use_for: proofLikeUnsafe,
        must_verify_by: ["direct_read_relevant_source", "run_planned_validation"]
      }
    );
    expectTrust(
      parseMcpTextContent<ResponseEnvelope<unknown>>(await markdown.handler({ path: "docs/guide.md" })),
      {
        safe_to_use_for: ["navigation", "precise_direct_read_claim"],
        not_safe_to_use_for: [
          "closure_claim",
          "passed_validation_claim",
          "safe_mutation_claim",
          "security_or_vulnerability_claim",
          "task_completion_claim",
          "whole_program_impact_claim"
        ],
        must_verify_by: [
          "direct_read_relevant_source",
          "review_diagnostics_output",
          "run_planned_validation"
        ]
      }
    );
  });

  it("keeps static diagnostics and planned validation distinct from executed checks", async () => {
    const diagnostics = registerMcpTool(diagnosticsForFilesTool, {
      diagnoseChangedFiles: ({ request }) => ({
        diagnostics: {
          repo_root: request.repo_root ?? "/repo",
          status: "needed",
          summary: "Fixture diagnostics.",
          checked_files: request.files,
          findings: [],
          provider_statuses: [],
          next_actions: []
        },
        meta: meta({
          repoRoot: request.repo_root ?? "/repo",
          capabilityLevel: "resource_backed",
          evidenceKinds: ["config"],
          languages: ["json"],
          verificationStatus: "needed"
        })
      })
    });
    const validation = registerMcpTool(verificationPlanTool, {
      planVerification: ({ request }) => ({
        plan: {
          repo_root: request.repo_root ?? "/repo",
          status: "planned",
          summary: "Fixture validation plan.",
          planned_commands: [],
          risks: [],
          next_actions: []
        },
        meta: meta({
          repoRoot: request.repo_root ?? "/repo",
          capabilityLevel: "resource_backed",
          evidenceKinds: ["config"],
          languages: ["typescript"],
          verificationStatus: "planned"
        })
      })
    });

    expectTrust(parseMcpTextContent<ResponseEnvelope<unknown>>(await diagnostics.handler({ files: ["package.json"] })), {
      safe_to_use_for: ["navigation"],
      not_safe_to_use_for: [
        "closure_claim",
        "passed_validation_claim",
        "safe_mutation_claim",
        "security_or_vulnerability_claim",
        "task_completion_claim",
        "whole_program_impact_claim"
      ],
      must_verify_by: [
        "direct_read_relevant_source",
        "review_diagnostics_output",
        "run_planned_validation"
      ]
    });
    expectTrust(parseMcpTextContent<ResponseEnvelope<unknown>>(await validation.handler({ files: ["src/app.ts"] })), {
      safe_to_use_for: ["validation_planning"],
      not_safe_to_use_for: proofLikeUnsafe,
      must_verify_by: [
        "direct_read_relevant_source",
        "obtain_executed_validation_evidence",
        "refresh_runtime_snapshot",
        "resolve_blocked_environment",
        "run_planned_validation"
      ]
    });
  });

  it("separates edit preview review from applied edit observation", async () => {
    const preview = registerMcpTool(previewWorkspaceEditTool, {
      previewWorkspaceEdit: ({ request }) => ({
        preview: {
          repo_root: request.repo_root ?? "/repo",
          preview: {
            preview_token: "preview-1",
            created_at: "2026-05-31T12:00:00.000Z",
            expires_at: "2026-05-31T12:10:00.000Z",
            files: [],
            operation: "bounded_text_edit",
            mutation_class: "workspace_write"
          },
          changed_files: [],
          next_actions: []
        },
        meta: meta({
          repoRoot: request.repo_root ?? "/repo",
          capabilityLevel: "unsupported",
          evidenceKinds: ["direct_read"],
          languages: [],
          verificationStatus: "planned"
        })
      })
    });
    const apply = registerMcpTool(applyWorkspaceEditTool, {
      applyWorkspaceEdit: ({ request }) => ({
        result: {
          repo_root: request.repo_root ?? "/repo",
          preview_token: request.preview_token,
          applied_files: [],
          status: "applied",
          next_actions: []
        },
        meta: meta({
          repoRoot: request.repo_root ?? "/repo",
          capabilityLevel: "unsupported",
          evidenceKinds: ["direct_read"],
          languages: [],
          verificationStatus: "done"
        })
      })
    });

    expectTrust(
      parseMcpTextContent<ResponseEnvelope<unknown>>(
        await preview.handler({ edits: [{ path: "src/app.ts", replacement_text: "export {};\n" }] })
      ),
      {
        safe_to_use_for: ["edit_preview_review", "validation_planning"],
        not_safe_to_use_for: [
          "applied_edit_observation",
          "bounded_executed_validation_claim",
          "closure_claim",
          "implementation_claim",
          "passed_validation_claim",
          "safe_mutation_claim",
          "security_or_vulnerability_claim",
          "task_completion_claim",
          "whole_program_impact_claim"
        ],
        must_verify_by: [
          "direct_read_relevant_source",
          "refresh_runtime_snapshot",
          "resolve_blocked_environment",
          "review_generated_diff",
          "run_planned_validation"
        ]
      }
    );
    expectTrust(
      parseMcpTextContent<ResponseEnvelope<unknown>>(
        await apply.handler({
          preview_token: "preview-1",
          edits: [{ path: "src/app.ts", replacement_text: "export {};\n" }]
        })
      ),
      {
        safe_to_use_for: ["applied_edit_observation"],
        not_safe_to_use_for: [
          "closure_claim",
          "passed_validation_claim",
          "safe_mutation_claim",
          "security_or_vulnerability_claim",
          "task_completion_claim",
          "whole_program_impact_claim"
        ],
        must_verify_by: ["review_generated_diff", "run_planned_validation"]
      }
    );
  });

  it("keeps structured invalid, stale, and environment-failure states unsafe for proof", async () => {
    const invalid = registerMcpTool(contextForTaskTool, {
      getTaskContext: () => {
        throw new Error("provider should not run");
      }
    });
    const stale = registerMcpTool(applyWorkspaceEditTool, {
      applyWorkspaceEdit: () => {
        throw new Error("Preview is stale because the current file hash changed.");
      }
    });
    const environment = registerMcpResource(repoStatusResource, {
      repoRoot: "/repo",
      getRepoStatus: () => {
        throw new Error("database is locked");
      }
    });

    expectTrust(parseMcpTextContent<ResponseEnvelope<unknown>>(await invalid.handler({ task: "" })), {
      safe_to_use_for: ["navigation", "next_read_selection"],
      not_safe_to_use_for: proofLikeUnsafe,
      must_verify_by: failureVerify
    });
    expectTrust(
      parseMcpTextContent<ResponseEnvelope<unknown>>(
        await stale.handler({
          preview_token: "preview-1",
          edits: [{ path: "src/app.ts", replacement_text: "export {};\n" }]
        })
      ),
      {
        safe_to_use_for: [],
        not_safe_to_use_for: [
          "applied_edit_observation",
          "bounded_executed_validation_claim",
          "closure_claim",
          "implementation_claim",
          "passed_validation_claim",
          "safe_mutation_claim",
          "security_or_vulnerability_claim",
          "task_completion_claim",
          "whole_program_impact_claim"
        ],
        must_verify_by: [
          "direct_read_relevant_source",
          "refresh_runtime_snapshot",
          "resolve_blocked_environment",
          "review_generated_diff",
          "run_planned_validation"
        ]
      }
    );
    expectTrust(parseMcpResourceText<ResponseEnvelope<unknown>>(await environment.handler({})), {
      safe_to_use_for: ["navigation", "next_read_selection", "runtime_availability"],
      not_safe_to_use_for: proofLikeUnsafe,
      must_verify_by: failureVerify
    });
  });
});

function expectTrust(
  envelope: ResponseEnvelope<unknown>,
  expected: {
    safe_to_use_for: string[];
    not_safe_to_use_for: string[];
    must_verify_by: string[];
  }
): void {
  expect(envelope.meta.trust).toEqual(expected);
}

function integrationHealthFixture(request: {
  repo_root?: string;
  client?: string;
  discovery_state: "unknown" | "provided";
  discovered_tools: string[];
  discovered_resources: string[];
  discovered_prompts: string[];
}) {
  return {
    repo_root: request.repo_root ?? "/repo",
    runtime_version: "0.1.0",
    profile: "codex",
    session: {
      client: request.client,
      discovery_state: request.discovery_state,
      discovered_tools: request.discovered_tools,
      discovered_resources: request.discovered_resources,
      discovered_prompts: request.discovered_prompts
    },
    surfaces: [
      {
        name: "context_for_task",
        kind: "tool" as const,
        configured: true,
        registered: true,
        advertised: true,
        caller_discovery: "discovered" as const,
        callable: "callable" as const,
        status: "available" as const,
        reason: "The active client session discovered this registered MCP surface.",
        evidence_kinds: ["config" as const],
        capability_class: "read_only" as const
      }
    ],
    counts: {
      available: 1,
      unavailable: 0,
      blocked: 0,
      hidden: 0,
      unknown: 0
    },
    next_actions: []
  };
}

function meta(input: {
  repoRoot: string;
  capabilityLevel: ResponseMetadata["capability_level"];
  evidenceKinds: ResponseMetadata["evidence_kinds"];
  languages: string[];
  verificationStatus: ResponseMetadata["verification_status"];
}): ResponseMetadata {
  return {
    analysis_validity: "valid",
    freshness: "fresh",
    scope: {
      repo_root: input.repoRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      languages: input.languages
    },
    capability_level: input.capabilityLevel,
    evidence_kinds: input.evidenceKinds,
    verification_status: input.verificationStatus,
    truncated: false
  };
}
