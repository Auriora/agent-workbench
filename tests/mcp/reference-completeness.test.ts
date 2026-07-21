/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import {
  responseEnvelopeSchema,
  findReferencesResultSchema,
  type FindReferencesResult,
  type ReferenceCoverageReceipt,
  type ReferenceHit,
  type ResponseEnvelope,
  type ResponseMetadata
} from "../../src/contracts/index.js";
import type { FindReferencesUseCaseResult } from "../../src/application/use-cases/find-references.js";
import { findReferences } from "../../src/application/use-cases/find-references.js";
import type { GraphNode } from "../../src/domain/models/index.js";
import { createReferenceCursorCodec } from "../../src/infrastructure/runtime/index.js";
import { findReferencesTool } from "../../src/interface-adapters/mcp/registries/tools/find-references.js";
import type { FileCatalogPort, GraphQueryPort, SnapshotPort, SnapshotPublicationPort } from "../../src/ports/index.js";
import {
  buildFindReferencesEnvelope,
  buildInvalidFindReferencesInputEnvelope
} from "../../src/presentation/find-references-presenter.js";
import { permissiveWorkspaceSafety } from "../helpers/permissive-workspace-safety.js";
import { parseMcpTextContent, registerMcpTool } from "../helpers/mcp-harness.js";

describe("find_references completeness presentation", () => {
  it("presents exhausted evidence as complete, valid, and untruncated", () => {
    const result = buildFindReferencesEnvelope(useCaseResult({
      result: evidenceBackedResult(completeLexicalCoverage()),
      meta: baseMeta({ analysis_validity: "partial", truncated: true })
    }));

    expect(result.meta).toMatchObject({
      analysis_validity: "valid",
      truncated: false,
      reference_coverage: {
        state: "complete",
        complete_matches: 1,
        catalog_exhausted: true
      },
      scope: { languages: ["typescript"] }
    });
    expect(result.data.cursor).toBeUndefined();
    expect(result.data).toMatchObject({ result_count: 1, result_count_basis: "complete_matches" });
    expect(result.meta.trust?.safe_to_use_for).toContain("navigation");
    expect(responseEnvelopeSchema(findReferencesResultSchema).safeParse(result).success).toBe(true);
  });

  it("presents bounded continuation as partial and truncated with exact page accounting", () => {
    const coverage = partialLexicalCoverage({ continuation: true });
    const result = buildFindReferencesEnvelope(useCaseResult({
      result: evidenceBackedResult(coverage, "opaque-next-page"),
      meta: baseMeta()
    }));

    expect(result.meta).toMatchObject({
      analysis_validity: "partial",
      truncated: true,
      reference_coverage: coverage,
      scope: { languages: ["typescript"] }
    });
    expect(result.data).toMatchObject({
      cursor: "opaque-next-page",
      result_count: 1,
      result_count_basis: "matched_so_far",
      coverage: {
        page_matches: 1,
        matched_so_far: 1
      }
    });
    expect(result.data.coverage_status === "evidence_backed" &&
      result.data.coverage.complete_matches).toBeUndefined();
    expect(result.meta.trust?.not_safe_to_use_for).toContain("whole_program_impact_claim");
    expect(result.meta.trust?.must_verify_by).toEqual(
      expect.arrayContaining(["direct_read_relevant_source", "refresh_runtime_snapshot"])
    );
    expect(responseEnvelopeSchema(findReferencesResultSchema).safeParse(result).success).toBe(true);
  });

  it("blocks an unresolved exhausted candidate when no useful evidence or continuation exists", () => {
    const coverage = partialLexicalCoverage({ continuation: false, unresolved: true });
    const result = buildFindReferencesEnvelope(useCaseResult({
      result: evidenceBackedResult(coverage, undefined, []),
      meta: baseMeta()
    }));

    expect(result.meta).toMatchObject({
      analysis_validity: "partial",
      verification_status: "blocked",
      truncated: true,
      reference_coverage: {
        state: "partial",
        catalog_exhausted: true,
        unresolved_searchable_candidates: {
          sequence: [{ reason: "missing", count: 1 }]
        }
      }
    });
    expect(result.meta.trust?.must_verify_by).toEqual(
      expect.arrayContaining(["resolve_blocked_environment", "direct_read_relevant_source"])
    );
    expect(result.meta.trust?.safe_to_use_for).not.toContain("task_completion_claim");
  });

  it("keeps stale preflight evidence blocked with refresh guidance and no valid absence", async () => {
    const fixture = runtimeFixture();
    const result = buildFindReferencesEnvelope(await findReferences({
      request: { node_id: "target-node", repo_root: "/repo", max_depth: 1, max_results: 5 },
      graph: fixture.graph,
      snapshots: fixture.snapshots,
      catalog: fixture.catalog,
      workspace_safety: permissiveWorkspaceSafety,
      cursor_codec: createReferenceCursorCodec({ key: Buffer.alloc(32, 88), key_epoch: "stale-test" }),
      snapshot_validity: {
        snapshot_id: "snapshot-1",
        state: "stale",
        complete: false,
        checked_path_count: 1,
        observed_path_count: 0,
        missing_paths: ["src/target.ts"],
        inaccessible_paths: [],
        refresh_required: true
      },
      default_repo_root: "/repo"
    }));

    expect(result.meta).toMatchObject({
      analysis_validity: "partial",
      freshness: "stale",
      verification_status: "blocked"
    });
    expect(result.data.coverage_status).toBe("legacy_unverified");
    expect(result.data.references).toEqual([]);
    expect(result.data.next_actions).toEqual([
      expect.objectContaining({ tool: "read_resource", args: { uri: "repo:///status" } })
    ]);
    expect(result.meta.trust?.not_safe_to_use_for).toEqual(
      expect.arrayContaining(["task_completion_claim", "whole_program_impact_claim"])
    );
    expect(result.meta.trust?.must_verify_by).toContain("refresh_runtime_snapshot");
  });

  it("rejects an unknown reference target with typed recovery instead of valid empty evidence", async () => {
    const fixture = runtimeFixture({ targetFound: false });
    const result = buildFindReferencesEnvelope(await findReferences({
      request: { node_id: "does/not/exist", repo_root: "/repo", max_depth: 1, max_results: 5 },
      graph: fixture.graph,
      snapshots: fixture.snapshots,
      catalog: fixture.catalog,
      workspace_safety: permissiveWorkspaceSafety,
      cursor_codec: createReferenceCursorCodec({ key: Buffer.alloc(32, 89), key_epoch: "unknown-target-test" }),
      snapshot_validity: {
        snapshot_id: "snapshot-1",
        state: "valid",
        complete: true,
        checked_path_count: 1,
        observed_path_count: 1,
        missing_paths: [],
        inaccessible_paths: [],
        refresh_required: false
      },
      default_repo_root: "/repo"
    }));

    expect(result.data).toMatchObject({
      coverage_status: "legacy_unverified",
      references: [],
      result_count: 0,
      result_count_basis: "page_matches",
      next_actions: [{
        tool: "symbol_search",
        args: {
          query: "does/not/exist",
          exact: false,
          max_results: 20,
          snapshot_id: "snapshot-1"
        }
      }]
    });
    expect(result.meta).toMatchObject({ analysis_validity: "invalid", verification_status: "blocked" });
    expect(result.errors).toEqual([expect.objectContaining({
      code: "reference_target_not_found",
      retryable: false,
      next_action: expect.objectContaining({ tool: "symbol_search" })
    })]);
    expect(result.meta.trust?.safe_to_use_for).toContain("navigation");
    expect(result.meta.trust?.safe_to_use_for).not.toContain("local_structure_reference");
    expect(result.meta.trust?.not_safe_to_use_for).toContain("task_completion_claim");
  });

  it("keeps invalid cursor input invalid and non-retryable", () => {
    const result = buildInvalidFindReferencesInputEnvelope({
      repoRoot: "/repo",
      message: "The reference cursor authentication tag is invalid."
    });

    expect(result.meta).toMatchObject({
      analysis_validity: "invalid",
      verification_status: "blocked",
      truncated: false
    });
    expect(result.errors).toEqual([{
      code: "invalid_input",
      message: "The reference cursor authentication tag is invalid.",
      retryable: false
    }]);
    expect(result.meta.trust?.safe_to_use_for).not.toContain("task_completion_claim");
  });

  it("executes the exact presented find_references next action through the registered MCP tool", async () => {
    const calls: unknown[] = [];
    const registered = registerMcpTool(findReferencesTool, {
      findReferences: ({ request }) => {
        calls.push(request);
        if (request.cursor === undefined) {
          return useCaseResult({
            result: evidenceBackedResult(partialLexicalCoverage({ continuation: true }), "opaque-next-page"),
            meta: baseMeta()
          });
        }
        return useCaseResult({ result: evidenceBackedResult(completeLexicalCoverage(), undefined), meta: baseMeta() });
      }
    });

    const first = parseMcpTextContent<ResponseEnvelope<FindReferencesResult>>(
      await registered.handler({ node_id: "target-node", max_depth: 1, max_results: 1 })
    );
    const continuation = first.data.next_actions.find((action) => action.tool === "find_references");
    expect(continuation).toEqual({
      tool: "find_references",
      args: { node_id: "target-node", snapshot_id: "snapshot-1", max_depth: 1, max_results: 1, cursor: "opaque-next-page" }
    });

    const terminal = parseMcpTextContent<ResponseEnvelope<FindReferencesResult>>(
      await registered.handler(continuation!.args)
    );
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject(continuation!.args);
    expect(terminal.data).toMatchObject({ coverage: { state: "complete", complete_matches: 1 } });
    expect(terminal.data).not.toHaveProperty("cursor");
    expect(terminal.meta).toMatchObject({ analysis_validity: "valid", truncated: false });
  });
});

function useCaseResult(input: {
  result: FindReferencesResult;
  meta: ResponseMetadata;
}): FindReferencesUseCaseResult {
  return { references: input.result, meta: input.meta };
}

function evidenceBackedResult(
  coverage: ReferenceCoverageReceipt,
  cursor?: string,
  references: FindReferencesResult["references"] = [referenceHit()]
): FindReferencesResult {
  return {
    repo_root: "/repo",
    snapshot_id: "snapshot-1",
    coverage_status: "evidence_backed",
    references,
    ...(cursor === undefined ? {} : { cursor }),
    result_count: coverage.matched_so_far,
    result_count_basis: coverage.state === "complete" ? "complete_matches" : "matched_so_far",
    coverage,
    next_actions: cursor === undefined
      ? []
      : [{
          tool: "find_references",
          args: { node_id: "target-node", snapshot_id: "snapshot-1", max_depth: 1, max_results: 1, cursor }
        }]
  };
}

function referenceHit(): ReferenceHit {
  return {
    source_file_path: "tests/example.test.ts",
    source_range: {
      start_line: 10,
      start_column: 4,
      end_line: 10,
      end_column: 11
    },
    target_node_id: "src/example.ts::target",
    reference_name: "target",
    reference_kind: "lexical",
    confidence: 0.2,
    evidence_kinds: ["text_fallback", "heuristic"],
    provenance: "bounded_lexical_identifier_scan",
    status: "unresolved" as const
  };
}

function completeLexicalCoverage(): ReferenceCoverageReceipt {
  return {
    state: "complete",
    route: "lexical",
    catalog_exhausted: true,
    page: accounting({ unique: 1, reads: 1, declared: 120, actual: 120, occurrences: 1 }),
    sequence: accounting({ unique: 1, reads: 1, declared: 120, actual: 120, occurrences: 1 }),
    searchable_candidates_classified: { page: 1, sequence: 1 },
    languages_inspected: ["typescript"],
    page_matches: 1,
    matched_so_far: 1,
    complete_matches: 1,
    policy_exclusions: { page: [], sequence: [] },
    unresolved_searchable_candidates: { page: [], sequence: [] },
    stop_reason: "catalog_exhausted"
  };
}

function partialLexicalCoverage(input: {
  continuation: boolean;
  unresolved?: boolean;
}): ReferenceCoverageReceipt {
  const unresolved = input.unresolved === true
    ? [{ reason: "missing" as const, count: 1 }]
    : [];
  const occurrences = input.unresolved === true ? 0 : 1;
  const inspected = input.unresolved === true ? 0 : 1;
  return {
    state: "partial",
    route: "lexical",
    catalog_exhausted: !input.continuation,
    page: accounting({
      unique: inspected,
      reads: inspected,
      declared: inspected * 120,
      actual: inspected * 120,
      occurrences
    }),
    sequence: accounting({
      unique: inspected,
      reads: inspected,
      declared: inspected * 120,
      actual: inspected * 120,
      occurrences
    }),
    searchable_candidates_classified: {
      page: inspected + unresolved.length,
      sequence: inspected + unresolved.length
    },
    languages_inspected: inspected === 0 ? [] : ["typescript"],
    page_matches: occurrences,
    matched_so_far: occurrences,
    policy_exclusions: { page: [], sequence: [] },
    unresolved_searchable_candidates: { page: unresolved, sequence: unresolved },
    stop_reason: input.continuation ? "result" : "missing",
    ...(input.continuation ? { continuation_kind: "lexical_scan" as const } : {})
  };
}

function accounting(input: {
  unique: number;
  reads: number;
  declared: number;
  actual: number;
  occurrences: number;
}) {
  return {
    unique_files_inspected: input.unique,
    file_read_attempts: input.reads,
    replay_reads: 0,
    declared_bytes_admitted: input.declared,
    actual_bytes_observed: input.actual,
    elapsed_admission_ms: 5,
    occurrences: input.occurrences
  };
}

function baseMeta(overrides: Partial<ResponseMetadata> = {}): ResponseMetadata {
  return {
    analysis_validity: "valid",
    freshness: "fresh",
    scope: {
      repo_root: "/repo",
      indexed_roots: ["."],
      skipped_roots: [],
      languages: ["typescript"]
    },
    capability_level: "partial_semantic",
    evidence_kinds: ["parser", "text_fallback", "heuristic"],
    verification_status: "needed",
    truncated: false,
    ...overrides
  };
}

function runtimeFixture(options: { targetFound?: boolean } = {}): {
  graph: GraphQueryPort;
  catalog: FileCatalogPort;
  snapshots: SnapshotPort & SnapshotPublicationPort;
} {
  const target: GraphNode = {
    id: "target-node",
    kind: "function",
    name: "target",
    qualified_name: "target",
    file_path: "src/target.ts",
    language: "typescript",
    source_range: { start_line: 1, start_column: 0, end_line: 1, end_column: 6 },
    metadata: {}
  };
  const snapshot = {
    id: "snapshot-1",
    repo_root: "/repo",
    workspace_root: "/repo",
    repo_identity: "/repo",
    config_identity: "fixture",
    schema_version: 1,
    freshness: "fresh" as const,
    owner_state: "owner" as const,
    created_at: "2026-07-21T00:00:00.000Z",
    updated_at: "2026-07-21T00:00:00.000Z"
  };
  const selected = {
    status: "selected" as const,
    snapshot,
    publication: { repo_root: "/repo", snapshot_id: "snapshot-1", controller_generation: 1,
      invalidation_generation: 1, state: "published" as const, updated_at: snapshot.updated_at }
  };
  return {
    graph: {
      getNode: async () => options.targetFound === false ? null : target,
      findNodesByName: async () => options.targetFound === false ? [] : [target],
      findNodesByQualifiedName: async () => [target],
      searchNodes: async () => [target],
      getNodesInRange: async () => [target],
      getOutgoingEdges: async () => [],
      getIncomingEdges: async () => [],
      getReferences: async () => [],
      getUnresolvedReferences: async () => [],
      traverse: async () => ({ start_node_ids: [target.id], nodes: [target], edges: [], reached_depth: 0, truncated: false })
    },
    catalog: {
      listFiles: async () => [],
      getFile: async () => null,
      upsertEntry: async () => undefined,
      removeEntry: async () => undefined
    },
    snapshots: {
      getSnapshot: async () => snapshot,
      listSnapshots: async () => [snapshot],
      upsertSnapshot: async () => undefined,
      markSnapshotFreshness: async () => undefined,
      allocateBuildSnapshotId: async () => snapshot.id,
      transitionBuild: async (input) => ({ ...input, state: input.to }),
      getLatestPublished: async () => selected,
      readExplicit: async () => selected
    }
  };
}
