import { describe, expect, it } from "vitest";
import type { AdapterEvidence } from "../../src/contracts/index.js";
import type { SnapshotState, WarmupExecution } from "../../src/domain/models/runtime.js";
import {
  capNextActions,
  buildRuntimeResponseMeta,
  classifyRuntimeTrust,
  deriveRuntimeStatusCaveats,
  sessionAwareNextActions
} from "../../src/presentation/metadata.js";

describe("presentation metadata helpers", () => {
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
