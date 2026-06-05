import { describe, expect, it } from "vitest";
import type { AdapterEvidence } from "../../src/contracts/index.js";
import type { SnapshotState, WarmupExecution } from "../../src/domain/models/runtime.js";
import {
  buildRuntimeResponseMeta,
  classifyRuntimeTrust,
  deriveRuntimeStatusCaveats
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
