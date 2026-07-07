/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type { AdapterEvidence } from "../../src/contracts/index.js";
import type { SnapshotState, WarmupExecution } from "../../src/domain/models/runtime.js";
import {
  buildResponseMeta,
  capNextActions,
  buildTrustCalibration,
  buildRuntimeResponseMeta,
  classifyRuntimeTrust,
  deriveRuntimeStatusCaveats,
  makeTrustedEnvelope,
  presentNextActions,
  sessionAwareNextActions,
  type TrustSurfacePolicy,
  type WatcherFreshnessState
} from "../../src/application/use-cases/response-metadata.js";

describe("response metadata helpers", () => {
  it("classifies fresh snapshot evidence without conflicting trust labels", () => {
    const result = buildRuntimeResponseMeta({
      repoRoot: "/repo",
      indexedRoots: ["."],
      skippedRoots: [".git"],
      languages: ["python"],
      coverage: [pythonCoverage()],
      snapshot: snapshot({ freshness: "fresh" })
    });

    expect(result.classification).toEqual({
      runtime_state: "fresh",
      freshness: "fresh",
      analysis_validity: "valid"
    });
    expect(result.meta).toMatchObject({
      analysis_validity: "valid",
      freshness: "fresh",
      capability_level: "partial_semantic",
      evidence_kinds: ["parser"],
      verification_status: "needed",
      truncated: false,
      scope: {
        repo_root: "/repo",
        indexed_roots: ["."],
        skipped_roots: [".git"],
        languages: ["python"]
      }
    });
  });

  it("classifies running warmup as refreshing while preserving valid evidence", () => {
    expect(
      classifyRuntimeTrust({
        snapshot: snapshot({ freshness: "fresh" }),
        warmup: warmup("running"),
        freshness: "fresh",
        hasEvidence: true
      })
    ).toEqual({
      runtime_state: "refreshing",
      freshness: "refreshing",
      analysis_validity: "valid"
    });
  });

  it("requires synchronized watcher freshness before preserving fresh status", () => {
    expect(
      classifyRuntimeTrust({
        snapshot: snapshot({ freshness: "fresh" }),
        freshness: "fresh",
        hasEvidence: true,
        watcher: watcherFreshness({
          status: "fresh",
          queue_state: "drained",
          scope_status: "synchronized",
          ignore_rules_status: "synchronized"
        })
      })
    ).toEqual({
      runtime_state: "fresh",
      freshness: "fresh",
      analysis_validity: "valid"
    });

    expect(
      classifyRuntimeTrust({
        snapshot: snapshot({ freshness: "fresh" }),
        freshness: "fresh",
        hasEvidence: true,
        watcher: watcherFreshness({
          status: "stale",
          queue_state: "drained",
          scope_status: "changed",
          ignore_rules_status: "synchronized"
        })
      })
    ).toEqual({
      runtime_state: "stale",
      freshness: "stale",
      analysis_validity: "valid"
    });
  });

  it("classifies watcher processing and watcher failures as visible freshness states", () => {
    expect(
      classifyRuntimeTrust({
        snapshot: snapshot({ freshness: "fresh" }),
        freshness: "fresh",
        hasEvidence: true,
        watcher: watcherFreshness({
          status: "refreshing",
          queue_state: "pending",
          scope_status: "synchronized",
          ignore_rules_status: "synchronized"
        })
      })
    ).toEqual({
      runtime_state: "refreshing",
      freshness: "refreshing",
      analysis_validity: "valid"
    });

    expect(
      classifyRuntimeTrust({
        snapshot: snapshot({ freshness: "fresh" }),
        freshness: "fresh",
        hasEvidence: true,
        watcher: watcherFreshness({
          status: "degraded",
          queue_state: "failed",
          scope_status: "unknown",
          ignore_rules_status: "unknown"
        })
      })
    ).toEqual({
      runtime_state: "degraded",
      freshness: "stale",
      analysis_validity: "partial"
    });
  });

  it("classifies missing snapshot as cold invalid evidence", () => {
    expect(
      classifyRuntimeTrust({
        snapshot: null,
        freshness: "cold",
        hasEvidence: false
      })
    ).toEqual({
      runtime_state: "cold",
      freshness: "cold",
      analysis_validity: "invalid"
    });
  });

  it("adds shared caveats for unsupported language coverage", () => {
    const caveats = deriveRuntimeStatusCaveats({
      coverage: [
        {
          domain: "language",
          name: "go",
          capability_level: "unsupported",
          evidence_kinds: [],
          paths: ["cmd/service/main.go"],
          provenance: "file_identity",
          confidence: "high",
          metadata: {}
        }
      ],
      snapshot: snapshot({ freshness: "fresh" })
    });

    expect(caveats).toEqual([
      expect.objectContaining({
        kind: "unsupported_language_or_platform",
        severity: "warning",
        evidence_kinds: []
      })
    ]);
  });

  it("adds structured caveats for watcher refreshing, stale, and degraded states", () => {
    const cases = [
      {
        watcher: watcherFreshness({
          status: "refreshing",
          queue_state: "pending",
          scope_status: "synchronized",
          ignore_rules_status: "synchronized"
        }),
        expectedKind: "watcher_refreshing"
      },
      {
        watcher: watcherFreshness({
          status: "stale",
          queue_state: "overflowed",
          scope_status: "synchronized",
          ignore_rules_status: "synchronized"
        }),
        expectedKind: "stale_watcher_snapshot"
      },
      {
        watcher: watcherFreshness({
          status: "degraded",
          queue_state: "failed",
          scope_status: "unknown",
          ignore_rules_status: "unknown"
        }),
        expectedKind: "degraded_watcher_freshness"
      }
    ];

    for (const testCase of cases) {
      expect(
        deriveRuntimeStatusCaveats({
          coverage: [pythonCoverage()],
          snapshot: snapshot({ freshness: "fresh" }),
          watcher: testCase.watcher
        })
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: testCase.expectedKind
          })
        ])
      );
    }
  });

  it("filters next actions to public MCP tools only", () => {
    expect(
      capNextActions([
        { tool: "prewarm_graph", args: { repo_root: "/repo" } },
        { tool: "manual_command", args: { command: "pnpm test" } },
        { tool: "verification_plan", args: { files: ["src/service.py"] } },
        { tool: "symbol_search", args: { query: "Service" } }
      ])
    ).toEqual([
      { tool: "verification_plan", args: { files: ["src/service.py"] } },
      { tool: "symbol_search", args: { query: "Service" } }
    ]);
  });

  it("removes repo_root from public next action arguments", () => {
    expect(
      presentNextActions([
        {
          tool: "verification_plan",
          args: {
            repo_root: "/repo",
            files: ["src/app.ts"]
          }
        }
      ])
    ).toEqual([
      {
        tool: "verification_plan",
        args: {
          files: ["src/app.ts"]
        }
      }
    ]);
  });

  it("allows docs map resource reads while hiding nonexistent docs_map tools", () => {
    expect(
      presentNextActions([
        {
          tool: "read_resource",
          args: {
            repo_root: "/repo",
            uri: "repo:///docs/map",
            max_docs: 50
          }
        },
        {
          tool: "docs_map",
          args: {
            repo_root: "/repo",
            max_docs: 50
          }
        }
      ])
    ).toEqual([
      {
        tool: "read_resource",
        args: {
          uri: "repo:///docs/map",
          max_docs: 50
        }
      }
    ]);
  });

  it("filters session-aware next actions to callable tools when discovery is provided", () => {
    const result = sessionAwareNextActions(
      [
        { tool: "context_for_task", args: { task: "Inspect" } },
        { tool: "impact", args: { node_id: "node-1" } },
        { tool: "verification_plan", args: { changed_files: ["src/app.ts"] } },
        { tool: "prewarm_graph", args: {} }
      ],
      {
        integrationHealth: integrationHealth({
          discovery_state: "provided",
          surfaces: [
            surface("context_for_task", {
              caller_discovery: "discovered",
              callable: "callable",
              status: "available",
              reason: "Discovered by active client session."
            }),
            surface("impact", {
              caller_discovery: "not_discovered",
              callable: "not_callable",
              status: "unavailable",
              reason: "Not discovered by active client session."
            }),
            surface("verification_plan", {
              caller_discovery: "discovered",
              callable: "not_callable",
              status: "blocked",
              reason: "Validation planning is blocked by missing repo policy evidence."
            })
          ]
        })
      }
    );

    expect(result.next_actions).toEqual([
      { tool: "context_for_task", args: { task: "Inspect" } }
    ]);
    expect(result.unavailable_actions).toEqual([
      {
        action: { tool: "impact", args: { node_id: "node-1" } },
        status: "unavailable",
        reason: "Not discovered by active client session.",
        evidence_kinds: ["config"]
      },
      {
        action: { tool: "verification_plan", args: { changed_files: ["src/app.ts"] } },
        status: "blocked",
        reason: "Validation planning is blocked by missing repo policy evidence.",
        evidence_kinds: ["config"]
      }
    ]);
    expect(result.assumptions).toEqual([]);
  });

  it("preserves public next actions with assumptions when caller discovery is unknown", () => {
    const result = sessionAwareNextActions(
      [
        { tool: "context_for_task", args: { task: "Inspect" } },
        { tool: "symbol_search", args: { query: "Runner" } }
      ],
      {
        integrationHealth: integrationHealth({
          discovery_state: "unknown",
          surfaces: [
            surface("context_for_task", {
              caller_discovery: "unknown",
              callable: "unknown",
              status: "unknown",
              reason: "Caller discovery evidence was not provided."
            }),
            surface("symbol_search", {
              caller_discovery: "unknown",
              callable: "unknown",
              status: "unknown",
              reason: "Caller discovery evidence was not provided."
            })
          ]
        })
      }
    );

    expect(result.next_actions).toEqual([
      { tool: "context_for_task", args: { task: "Inspect" } },
      { tool: "symbol_search", args: { query: "Runner" } }
    ]);
    expect(result.unavailable_actions).toEqual([]);
    expect(result.assumptions).toEqual([
      "Callable state for context_for_task is unknown because caller discovery evidence was not provided.",
      "Callable state for symbol_search is unknown because caller discovery evidence was not provided."
    ]);
  });

  it("labels public actions absent from known health evidence as unavailable", () => {
    const result = sessionAwareNextActions(
      [
        { tool: "context_for_task", args: { task: "Inspect" } },
        { tool: "docs_search", args: { query: "setup" } }
      ],
      {
        integrationHealth: integrationHealth({
          discovery_state: "provided",
          surfaces: [
            surface("context_for_task", {
              caller_discovery: "discovered",
              callable: "callable",
              status: "available",
              reason: "Discovered by active client session."
            })
          ]
        })
      }
    );

    expect(result.next_actions).toEqual([
      { tool: "context_for_task", args: { task: "Inspect" } }
    ]);
    expect(result.unavailable_actions).toEqual([
      {
        action: { tool: "docs_search", args: { query: "setup" } },
        status: "unavailable",
        reason: "The MCP tool is public but was not present in integration health evidence.",
        evidence_kinds: ["config"]
      }
    ]);
  });

  it("calibrates routing evidence as navigation rather than proof", () => {
    const trust = buildTrustCalibration({
      policy: { surface_kind: "context_routing" },
      meta: baseMeta({
        evidence_kinds: ["docs"],
        verification_status: "needed"
      })
    });

    expect(trust.safe_to_use_for).toEqual(["navigation", "next_read_selection"]);
    expect(trust.not_safe_to_use_for).toEqual(
      expect.arrayContaining([
        "implementation_claim",
        "passed_validation_claim",
        "task_completion_claim",
        "closure_claim",
        "safe_mutation_claim",
        "whole_program_impact_claim",
        "security_or_vulnerability_claim"
      ])
    );
    expect(trust.must_verify_by).toEqual(
      expect.arrayContaining([
        "direct_read_relevant_source",
        "inspect_ranked_evidence",
        "run_planned_validation"
      ])
    );
  });

  it("keeps planned validation distinct from executed validation", () => {
    const planned = buildTrustCalibration({
      policy: { surface_kind: "validation_plan" },
      meta: baseMeta({
        verification_status: "planned",
        evidence_kinds: ["config"]
      })
    });

    expect(planned.safe_to_use_for).toEqual(["validation_planning"]);
    expect(planned.not_safe_to_use_for).toContain("passed_validation_claim");
    expect(planned.must_verify_by).toEqual(
      expect.arrayContaining(["obtain_executed_validation_evidence", "run_planned_validation"])
    );
    expect(planned.safe_to_use_for).not.toContain("bounded_executed_validation_claim");
  });

  it("allows bounded executed validation only when policy and evidence both say so", () => {
    const trust = buildTrustCalibration({
      policy: {
        surface_kind: "validation_plan",
        includes_executed_validation: true
      },
      meta: baseMeta({
        verification_status: "done",
        evidence_kinds: ["executed_command"]
      })
    });

    expect(trust.safe_to_use_for).toContain("bounded_executed_validation_claim");
    expect(trust.safe_to_use_for).not.toContain("passed_validation_claim");
    expect(trust.not_safe_to_use_for).toEqual(
      expect.arrayContaining(["safe_mutation_claim", "task_completion_claim", "closure_claim"])
    );
  });

  it("bounds direct-read and parser-backed trust to their represented evidence", () => {
    const directReadWithoutEvidence = buildTrustCalibration({
      policy: {
        surface_kind: "docs_direct_read",
        includes_direct_read: true
      },
      meta: baseMeta({
        analysis_validity: "invalid",
        evidence_kinds: ["docs"],
        verification_status: "blocked"
      })
    });
    const directRead = buildTrustCalibration({
      policy: {
        surface_kind: "docs_direct_read",
        includes_direct_read: true
      },
      meta: baseMeta({
        evidence_kinds: ["docs", "direct_read"],
        verification_status: "needed"
      })
    });
    const parserBacked = buildTrustCalibration({
      policy: { surface_kind: "graph_symbol_routing" },
      meta: baseMeta({
        capability_level: "partial_semantic",
        evidence_kinds: ["parser"],
        verification_status: "needed"
      })
    });

    expect(directReadWithoutEvidence.safe_to_use_for).not.toContain("precise_direct_read_claim");
    expect(directReadWithoutEvidence.not_safe_to_use_for).toEqual(
      expect.arrayContaining(["task_completion_claim", "closure_claim"])
    );
    expect(directRead.safe_to_use_for).toContain("precise_direct_read_claim");
    expect(directRead.not_safe_to_use_for).toEqual(
      expect.arrayContaining(["whole_program_impact_claim", "safe_mutation_claim"])
    );
    expect(parserBacked.safe_to_use_for).toEqual([
      "local_structure_reference",
      "navigation",
      "next_read_selection"
    ]);
    expect(parserBacked.not_safe_to_use_for).toContain("whole_program_impact_claim");
  });

  it("only treats apply-edit output as applied when mutation policy confirms it", () => {
    const unapplied = buildTrustCalibration({
      policy: { surface_kind: "edit_apply" },
      meta: baseMeta({ evidence_kinds: ["direct_read"] })
    });
    const applied = buildTrustCalibration({
      policy: { surface_kind: "edit_apply", mutation_applied: true },
      meta: baseMeta({ evidence_kinds: ["direct_read"] })
    });

    expect(unapplied.safe_to_use_for).not.toContain("applied_edit_observation");
    expect(unapplied.not_safe_to_use_for).toContain("applied_edit_observation");
    expect(applied.safe_to_use_for).toContain("applied_edit_observation");
  });

  it("uses unsafe wins when failure states conflict with proof-like evidence", () => {
    const trust = buildTrustCalibration({
      policy: {
        surface_kind: "validation_plan",
        includes_executed_validation: true
      },
      meta: baseMeta({
        analysis_validity: "invalid_due_to_environment",
        evidence_kinds: ["executed_command"],
        verification_status: "done"
      })
    });

    expect(trust.safe_to_use_for).not.toContain("bounded_executed_validation_claim");
    expect(trust.safe_to_use_for).not.toContain("passed_validation_claim");
    expect(trust.not_safe_to_use_for).toEqual(
      expect.arrayContaining([
        "bounded_executed_validation_claim",
        "implementation_claim",
        "passed_validation_claim",
        "task_completion_claim",
        "closure_claim",
        "safe_mutation_claim",
        "whole_program_impact_claim",
        "security_or_vulnerability_claim"
      ])
    );
    expect(trust.must_verify_by).toEqual(
      expect.arrayContaining(["resolve_blocked_environment", "refresh_runtime_snapshot"])
    );
  });

  it("derives envelope trust after top-level warnings and errors are known", () => {
    const warning = {
      severity: "warning" as const,
      kind: "validation_blocked" as const,
      scope: {},
      message: "Validation was not executed.",
      why_this_matters: "A plan is not proof that tests passed.",
      evidence_kinds: ["config" as const],
      freshness: "fresh" as const
    };
    const error = {
      code: "blocked",
      message: "Environment blocked validation.",
      retryable: true
    };
    const envelope = makeTrustedEnvelope({
      data: { ok: false },
      meta: baseMeta({
        evidence_kinds: ["config"],
        verification_status: "blocked"
      }),
      trust_policy: { surface_kind: "generic_error" },
      warnings: [warning],
      errors: [error]
    });

    expect(envelope.warnings).toEqual([warning]);
    expect(envelope.errors).toEqual([error]);
    expect(envelope.meta.trust).toMatchObject({
      safe_to_use_for: ["navigation"],
      not_safe_to_use_for: expect.arrayContaining(["task_completion_claim", "passed_validation_claim"]),
      must_verify_by: expect.arrayContaining([
        "direct_read_relevant_source",
        "refresh_runtime_snapshot",
        "resolve_blocked_environment",
        "run_planned_validation"
      ])
    });
  });
});

function pythonCoverage(): AdapterEvidence {
  return {
    domain: "language",
    name: "python",
    capability_level: "partial_semantic",
    evidence_kinds: ["parser"],
    paths: ["src/service.py"],
    provenance: "tree_sitter",
    confidence: "high",
    metadata: {}
  };
}

function watcherFreshness(input: WatcherFreshnessState): WatcherFreshnessState {
  return {
    ...input,
    reason: input.reason ?? "test watcher state"
  };
}

function snapshot(input: {
  freshness: SnapshotState["freshness"];
  analysis_validity?: SnapshotState["analysis_validity"];
  reason?: string;
}): SnapshotState {
  return {
    id: "snap-1",
    repo_root: "/repo",
    workspace_root: "/repo",
    repo_identity: "repo",
    config_identity: "config",
    schema_version: 1,
    freshness: input.freshness,
    analysis_validity: input.analysis_validity ?? "valid",
    owner_state: "owner",
    created_at: "2026-06-05T12:00:00.000Z",
    updated_at: "2026-06-05T12:00:00.000Z",
    reason: input.reason
  };
}

function warmup(state: WarmupExecution["state"]): WarmupExecution {
  return {
    execution_id: "warm-1",
    repo_root: "/repo",
    snapshot_id: "snap-1",
    state,
    owner_id: "owner",
    queued_jobs: state === "running" ? 1 : 0,
    started_at: "2026-06-05T12:00:00.000Z",
    updated_at: "2026-06-05T12:00:00.000Z"
  };
}

function integrationHealth(input: {
  discovery_state: "provided" | "unknown";
  surfaces: ReturnType<typeof surface>[];
}) {
  return {
    repo_root: "/repo",
    runtime_version: "0.1.0",
    profile: "codex",
    session: {
      discovery_state: input.discovery_state,
      discovered_tools: [],
      discovered_resources: [],
      discovered_prompts: []
    },
    surfaces: input.surfaces,
    counts: {
      available: input.surfaces.filter((entry) => entry.status === "available").length,
      unavailable: input.surfaces.filter((entry) => entry.status === "unavailable").length,
      blocked: input.surfaces.filter((entry) => entry.status === "blocked").length,
      hidden: input.surfaces.filter((entry) => entry.status === "hidden").length,
      unknown: input.surfaces.filter((entry) => entry.status === "unknown").length
    },
    next_actions: []
  };
}

function surface(
  name: string,
  state: {
    caller_discovery: "discovered" | "not_discovered" | "unknown";
    callable: "callable" | "not_callable" | "unknown";
    status: "available" | "unavailable" | "blocked" | "hidden" | "unknown";
    reason: string;
  }
) {
  return {
    name,
    kind: "tool" as const,
    configured: true,
    registered: true,
    advertised: true,
    caller_discovery: state.caller_discovery,
    callable: state.callable,
    status: state.status,
    reason: state.reason,
    evidence_kinds: ["config" as const],
    capability_class: "read_only" as const
  };
}

function baseMeta(input: {
  analysis_validity?: ReturnType<typeof buildResponseMeta>["analysis_validity"];
  freshness?: ReturnType<typeof buildResponseMeta>["freshness"];
  capability_level?: ReturnType<typeof buildResponseMeta>["capability_level"];
  evidence_kinds?: ReturnType<typeof buildResponseMeta>["evidence_kinds"];
  verification_status?: ReturnType<typeof buildResponseMeta>["verification_status"];
  trust_policy?: TrustSurfacePolicy;
}) {
  void input.trust_policy;
  return buildResponseMeta({
    analysis_validity: input.analysis_validity ?? "valid",
    freshness: input.freshness ?? "fresh",
    scope: {
      repo_root: "/repo",
      indexed_roots: ["src"],
      skipped_roots: [],
      languages: ["typescript"]
    },
    capability_level: input.capability_level ?? "resource_backed",
    evidence_kinds: input.evidence_kinds ?? ["docs"],
    verification_status: input.verification_status ?? "needed",
    truncated: false
  });
}
