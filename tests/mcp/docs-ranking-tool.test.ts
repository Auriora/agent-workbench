/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type { DocsSearchRequest, RankedDocsSearchResult } from "../../src/contracts/index.js";
import { rankedDocsSnapshotUnavailable } from "../../src/application/use-cases/query-docs.js";
import { docsSearchTool } from "../../src/interface-adapters/mcp/registries/tools/docs-search.js";
import { createDocsRankingCursorCodec, createReferenceCursorCodec } from "../../src/infrastructure/runtime/index.js";
import { registerMcpTool } from "../helpers/mcp-harness.js";
import { rankedDocsTelemetryAttributes } from "../../src/server.js";

describe("ranked docs_search MCP tool", () => {
  it("delegates once with explicit scope taking precedence over session scope", async () => {
    let seen: DocsSearchRequest | undefined;
    const registered = registerMcpTool(docsSearchTool, {
      repoRoot: "/repo",
      docsSessionScope: { scope_path: "docs/session" },
      searchRankedDocs: ({ request }) => {
        seen = request;
        return emptyResult(request);
      }
    });
    const response = await registered.handler({ query: "runtime", scope_path: "docs/explicit" });
    const envelope = JSON.parse(response.content[0]!.text);
    expect(seen).toMatchObject({
      repo_root: "/repo", query: "runtime", scope_path: "docs/explicit",
      max_results: 10, include_snippets: true
    });
    expect(envelope.data).toMatchObject({
      status: "not_applicable", trust_state: "complete_ranked_universe",
      result_count: 0, result_count_basis: "page"
    });
  });

  it("applies session scope when the request omits scope_path", async () => {
    let scope: string | undefined;
    const registered = registerMcpTool(docsSearchTool, {
      repoRoot: "/repo",
      docsSessionScope: { scope_path: "docs/session" },
      searchRankedDocs: ({ request }) => {
        scope = request.scope_path;
        return emptyResult(request);
      }
    });
    await registered.handler({ query: "runtime" });
    expect(scope).toBe("docs/session");
  });

  it("rejects invalid input without invoking the ranked provider", async () => {
    let called = false;
    const registered = registerMcpTool(docsSearchTool, {
      repoRoot: "/repo",
      searchRankedDocs: () => { called = true; return emptyResult({ query: "x", max_results: 10, include_snippets: true }); }
    });
    const response = await registered.handler({ query: "" });
    const envelope = JSON.parse(response.content[0]!.text);
    expect(called).toBe(false);
    expect(envelope).toMatchObject({
      data: { status: "blocked", hits: [] },
      meta: { analysis_validity: "invalid", verification_status: "blocked" },
      errors: [{ code: "invalid_input", retryable: false }]
    });
  });

  it("returns a structured provider-not-configured envelope", async () => {
    const registered = registerMcpTool(docsSearchTool, { repoRoot: "/repo" });
    const response = await registered.handler({ query: "runtime" });
    const envelope = JSON.parse(response.content[0]!.text);
    expect(envelope).toMatchObject({
      data: { status: "blocked", hits: [] },
      meta: { analysis_validity: "invalid_due_to_environment", verification_status: "blocked" },
      errors: [{ code: "provider_unavailable" }]
    });
  });

  it("presents valid snapshot selection unavailability without fabricating identity", async () => {
    const registered = registerMcpTool(docsSearchTool, {
      repoRoot: "/repo",
      searchRankedDocs: ({ request }) => rankedDocsSnapshotUnavailable({
        request,
        default_repo_root: "/repo",
        message: "No selected snapshot."
      })
    });
    const response = await registered.handler({ query: "runtime" });
    const envelope = JSON.parse(response.content[0]!.text);
    expect(envelope).toMatchObject({
      data: {
        status: "blocked",
        trust_state: "blocked_snapshot_unavailable",
        blocker: "selected_snapshot_unavailable",
        hits: []
      },
      meta: { freshness: "unknown", verification_status: "blocked" }
    });
    expect(envelope.data).not.toHaveProperty("snapshot_id");
  });

  it("classifies unexpected provider failure at the generic envelope boundary", async () => {
    const registered = registerMcpTool(docsSearchTool, {
      repoRoot: "/repo",
      searchRankedDocs: () => { throw new Error("database exploded"); }
    });
    const response = await registered.handler({ query: "runtime" });
    const envelope = JSON.parse(response.content[0]!.text);
    expect(envelope).toMatchObject({
      data: { status: "blocked", hits: [] },
      meta: { freshness: "unknown", verification_status: "blocked" },
      errors: [{ code: "internal_error" }]
    });
  });

  it("advertises frozen authority-aware ranked semantics", () => {
    expect(docsSearchTool.metadata).toMatchObject({
      returns: "ResponseEnvelope<RankedDocsSearchResult>",
      mutation_class: "none"
    });
    expect(docsSearchTool.metadata.description).toContain("authority-aware complete ranked universe");
    expect(docsSearchTool.metadata.budget_policy).toContain("blocks incomplete unions above 500");
  });

  it("authenticates ranked cursors with a distinct domain and expires foreign key epochs", () => {
    const key = Buffer.alloc(32, 7);
    const codec = createDocsRankingCursorCodec({ key, key_epoch: "epoch-a" });
    const cursor = codec.encode({
      version: 1, universe_id: "universe-043", next_position: 10,
      snapshot_id: "snapshot-043", normalized_query: "runtime",
      retrieval_bound: 500, ranking_schema_version: 1,
      ranking_policy_version: "authority-aware-v1"
    });
    expect(codec.decode(cursor)).toMatchObject({ ok: true, payload: { next_position: 10 } });
    expect(createDocsRankingCursorCodec({ key, key_epoch: "epoch-b" }).decode(cursor))
      .toEqual({ ok: false, code: "cursor_expired" });
    expect(createReferenceCursorCodec({ key, key_epoch: "epoch-a" }).decode(cursor))
      .toEqual({ ok: false, code: "invalid_cursor" });
    const tampered = `${cursor.slice(0, -1)}${cursor.endsWith("A") ? "B" : "A"}`;
    expect(codec.decode(tampered)).toEqual({ ok: false, code: "invalid_cursor" });
  });

  it("emits aggregate-only success, expiry, and invalid-cursor telemetry attributes", () => {
    const successAttributes = rankedDocsTelemetryAttributes(emptyResult({
      query: "secret raw query", max_results: 10, include_snippets: true
    }));
    expect(successAttributes).toMatchObject({
      outcome: "complete_ranked_universe",
      returned_page_documents_count: 0,
      fts_candidate_documents_count: 0,
      candidate_union_documents_count: 0,
      ranked_candidate_universe_count: 0,
      page_truncated: false
    });
    expect(successAttributes).not.toHaveProperty("query");
    for (const [blocker, trustState] of [
      ["ranked_universe_expired", "blocked_cursor_stale"],
      ["ranking_cursor_invalid", "blocked_cursor_invalid"]
    ] as const) {
      expect(rankedDocsTelemetryAttributes({
        ranking_contract_version: 1,
        repo_root: "/repo",
        snapshot_id: "snapshot-043",
        query: "secret raw query",
        normalized_query: "secret raw query",
        ranking_schema_version: 1,
        ranking_policy_version: "authority-aware-v1",
        status: "blocked",
        trust_state: trustState,
        blocker,
        hits: [],
        warnings: [],
        next_actions: [],
        truncated: false
      })).toMatchObject({ outcome: trustState, blocker, returned_page_documents_count: 0 });
    }
  });
});

function emptyResult(request: DocsSearchRequest): RankedDocsSearchResult {
  return {
    ranking_contract_version: 1, repo_root: request.repo_root ?? "/repo", snapshot_id: "snapshot-043",
    query: request.query, normalized_query: request.query, ranking_schema_version: 1,
    ranking_policy_version: "authority-aware-v1", status: "not_applicable",
    trust_state: "complete_ranked_universe", universe_id: "universe-043", hits: [],
    counts: {
      searchable_snapshot_documents_count: 1, searchable_scope_documents_count: 1,
      fts_candidate_documents_count: 0, matched_owner_candidate_documents_count: 0,
      candidate_union_documents_count: 0, ranked_candidate_universe_count: 0,
      returned_page_documents_count: 0, priority_scan_eligible_markdown_files_count: 1,
      priority_scan_indexed_markdown_files_count: 1, priority_scan_skipped_markdown_files_count: 0,
      priority_scan_coverage_state: "complete", priority_scan_truncated: false,
      searchable_filter_basis: "merged_graph_and_priority_markdown", scope_filter_basis: "repo_root",
      query_filter_basis: {
        fts_candidate_documents_count: "normalized_fts_match_within_scope",
        matched_owner_candidate_documents_count: "exact_matched_concern_owners_within_scope",
        candidate_union_documents_count: "distinct_fts_and_exact_owner_union_within_scope",
        ranked_candidate_universe_count: "distinct_fts_and_exact_owner_union_within_scope"
      },
      page_filter_basis: "frozen_universe_position_and_requested_page_size",
      priority_scan_filter_basis: "configured_priority_roots"
    },
    result_count: 0, result_count_basis: "page", indexed_docs_count: 1,
    docs_index_state: "complete", docs_scan_truncated: false,
    warnings: [], next_actions: [], truncated: false
  };
}
