/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { buildRankedDocsSearchEnvelope } from "../../src/presentation/docs-presenter.js";
import { rankDocumentationCandidates } from "../../src/domain/policies/docs-ranking.js";
import type {
  DocumentationConcernOwnerState,
  RankedDocsSearchHit,
  RankedDocsSearchResult
} from "../../src/contracts/index.js";

describe("ranked documentation presenter", () => {
  it("preserves frozen response order despite opposed compatibility scores", () => {
    const first = hit("docs/canonical.md", 1, 2);
    const second = hit("docs/lexical.md", 999, 500);
    const envelope = buildRankedDocsSearchEnvelope(success([first, second], {
      priority_scan_coverage_state: "partial",
      priority_scan_truncated: true,
      priority_scan_coverage_note: "Skipped ../outside/secret.txt.",
      priority_scan_indexed_markdown_files_count: 9,
      priority_scan_skipped_markdown_files_count: 1
    }));

    expect(envelope.data.hits.map(({ path }) => path)).toEqual([first.path, second.path]);
    expect(envelope.data.hits.map(({ score }) => score)).toEqual([1, 999]);
    expect(envelope.data.hits.map(({ lexical_score }) => lexical_score)).toEqual([2, 500]);
    expect(envelope.data).toMatchObject({
      result_count: 2,
      result_count_basis: "page",
      indexed_docs_count: 12,
      docs_index_state: "partial",
      docs_scan_truncated: true,
      coverage_note: "Skipped [REDACTED_WORKSPACE_ESCAPE]",
      counts: {
        searchable_snapshot_documents_count: 12,
        searchable_scope_documents_count: 11,
        fts_candidate_documents_count: 2,
        matched_owner_candidate_documents_count: 0,
        candidate_union_documents_count: 2,
        ranked_candidate_universe_count: 2,
        returned_page_documents_count: 2,
        priority_scan_eligible_markdown_files_count: 10,
        priority_scan_indexed_markdown_files_count: 9,
        priority_scan_skipped_markdown_files_count: 1,
        priority_scan_coverage_state: "partial",
        priority_scan_truncated: true,
        searchable_filter_basis: "merged_graph_and_priority_markdown",
        scope_filter_basis: "repo_root",
        query_filter_basis: {
          fts_candidate_documents_count: "normalized_fts_match_within_scope",
          matched_owner_candidate_documents_count: "exact_matched_concern_owners_within_scope",
          candidate_union_documents_count: "distinct_fts_and_exact_owner_union_within_scope",
          ranked_candidate_universe_count: "distinct_fts_and_exact_owner_union_within_scope"
        },
        page_filter_basis: "frozen_universe_position_and_requested_page_size",
        priority_scan_filter_basis: "configured_priority_roots"
      }
    });
    expect(envelope.meta).toMatchObject({ analysis_validity: "partial", freshness: "fresh" });
    expect("counts" in envelope.data && envelope.data.counts.priority_scan_coverage_note)
      .toBe("Skipped [REDACTED_WORKSPACE_ESCAPE]");
    expect(envelope.meta.index_coverage?.[0]?.reason).toBe("Skipped [REDACTED_WORKSPACE_ESCAPE]");
  });

  it("retains owner-only score while omitting lexical_score and redacts every text receipt without dropping reasons", () => {
    const owner = ownerHit();
    const result = success([owner]);
    result.hits[0]!.ranking_reasons = [
      "Owner reason ../outside/secret.txt",
      "Authority reason",
      "Stable tie reason"
    ];
    const envelope = buildRankedDocsSearchEnvelope(result);
    expect(envelope.data.hits[0]).toMatchObject({ score: 7, candidate_source: "matched_owner" });
    expect(envelope.data.hits[0]).not.toHaveProperty("lexical_score");
    expect(envelope.data.hits[0]?.ranking_reasons).toHaveLength(3);
    expect(envelope.data.hits[0]?.ranking_reasons[0]).toContain("[REDACTED_WORKSPACE_ESCAPE]");
    expect(envelope.data.hits[0]).toMatchObject({
      canonical_owner: "[REDACTED_ABSOLUTE_PATH]",
      superseded_by: "[REDACTED_WORKSPACE_ESCAPE]"
    });
  });

  it("redacts an alias-only coverage note and promotes the same value to the canonical receipt", () => {
    const result = success([hit("docs/runtime.md", 1, 1)]);
    delete result.counts.priority_scan_coverage_note;
    result.coverage_note = "Alias points to ../outside/secret.txt.";
    const envelope = buildRankedDocsSearchEnvelope(result);
    expect(envelope.data).toMatchObject({ coverage_note: "Alias points to [REDACTED_WORKSPACE_ESCAPE]" });
    expect("counts" in envelope.data && envelope.data.counts.priority_scan_coverage_note)
      .toBe("Alias points to [REDACTED_WORKSPACE_ESCAPE]");
    expect(envelope.meta.index_coverage?.[0]?.reason).toBe("Alias points to [REDACTED_WORKSPACE_ESCAPE]");
  });

  it("redacts ranked query identity and every nested callable recovery argument consistently", () => {
    const rawQuery = "Find ../outside/secret.txt /home/example/private token=abc";
    const result: RankedDocsSearchResult = {
      ...base(),
      query: rawQuery,
      normalized_query: rawQuery,
      normalized_scope_path: "../outside/scope",
      status: "blocked",
      trust_state: "blocked_cursor_invalid",
      blocker: "ranking_cursor_invalid",
      hits: [],
      next_actions: [{
        tool: "docs_search",
        args: {
          query: rawQuery,
          scope_path: "/home/example/private",
          nested: [{ credential: "token=abc" }]
        },
        reason: "Retry /home/example/private safely."
      }],
      truncated: false
    };
    const envelope = buildRankedDocsSearchEnvelope(result);
    const args = envelope.data.next_actions[0]?.args as {
      query: string;
      scope_path: string;
      nested: Array<{ credential: string }>;
    };
    expect(envelope.data.query).toBe(args.query);
    expect(envelope.data.normalized_query).toBe(args.query);
    expect(args.query).toContain("[REDACTED_WORKSPACE_ESCAPE]");
    expect(args.query).toContain("[REDACTED_ABSOLUTE_PATH]");
    expect(args.query).toContain("token=[REDACTED]");
    expect(envelope.data.normalized_scope_path).toBe("[REDACTED_WORKSPACE_ESCAPE]");
    expect(args.scope_path).toBe("[REDACTED_ABSOLUTE_PATH]");
    expect(args.nested[0]?.credential).toBe("token=[REDACTED]");
    expect(envelope.data.next_actions[0]).toMatchObject({ tool: "docs_search" });
  });

  it.each([
    ["candidate_universe_exceeds_limit", "blocked_candidate_overflow", "fresh"],
    ["ranked_universe_expired", "blocked_cursor_stale", "stale"],
    ["ranking_cursor_invalid", "blocked_cursor_invalid", "fresh"],
    ["ranking_unavailable", "blocked_ranking_unavailable", "unknown"]
  ] as const)("maps %s to honest blocked trust", (blocker, trustState, freshness) => {
    const result: RankedDocsSearchResult = blocker === "candidate_universe_exceeds_limit"
      ? {
          ...base(), status: "blocked", trust_state: trustState, blocker, hits: [],
          counts: overflowCounts(),
          result_count: 0, result_count_basis: "page", indexed_docs_count: 12,
          docs_index_state: "complete", docs_scan_truncated: false, truncated: false
        }
      : { ...base(), status: "blocked", trust_state: trustState, blocker, hits: [], truncated: false };
    const envelope = buildRankedDocsSearchEnvelope(result);
    expect(envelope.data).toMatchObject({ blocker, trust_state: trustState, hits: [], truncated: false });
    expect(envelope.meta.verification_status).toBe("blocked");
    expect(envelope.meta.freshness).toBe(freshness);
    expect(envelope.meta.trust?.not_safe_to_use_for).toContain("task_completion_claim");
  });

  it.each([
    ["valid", "valid_owner"],
    ["draft", "valid_owner"],
    ["missing", "non_owner"],
    ["archived", "invalid_owner"],
    ["superseded", "invalid_owner"],
    ["conflicting", "invalid_conflicting_owner"]
  ] as const)("preserves public %s owner evidence and its exhaustive tier", (state, tier) => {
    const ranked = rankWithOwnerEvidence(state);
    const envelope = buildRankedDocsSearchEnvelope(success(ranked));
    expect(envelope.data.hits[0]).toMatchObject({
      governing_owner_tier: tier,
      matched_concerns: [{ owners: [expect.objectContaining({ state })] }]
    });
    if (state !== "valid" && state !== "missing") {
      expect(envelope.data.hits[0]?.ranking_reasons.join(" ")).toMatch(/draft|archived|superseded|conflict/u);
    }
    if (state === "draft") {
      expect(envelope.data.hits[0]).toMatchObject({
        doc_status: "draft",
        direct_read_caveat: expect.stringContaining("Draft")
      });
    }
  });

  it("preserves multi-owner, owner-multiple-concern, and bounded >8 non-valid caveat summaries", () => {
    const ranked = rankWithOwnerEvidence("archived", 10, true);
    expect(ranked[0]?.matched_concerns).toHaveLength(10);
    expect(ranked[0]?.matched_concerns[0]?.owners).toHaveLength(2);
    const envelope = buildRankedDocsSearchEnvelope(success(ranked));
    expect(envelope.data.hits[0]?.matched_concerns).toHaveLength(10);
    const caveatReason = envelope.data.hits[0]?.ranking_reasons.find((reason) =>
      reason.startsWith("Ownership caveats:")
    );
    expect(caveatReason).toContain("plus 2 more");
    expect(envelope.data.hits[0]?.ranking_reasons).toEqual(ranked[0]?.ranking_reasons);
  });
});

function rankWithOwnerEvidence(
  state: DocumentationConcernOwnerState,
  concernCount = 1,
  includeSecondOwner = false
): RankedDocsSearchHit[] {
  const candidatePath = "docs/owner.md";
  const owner = {
    ...(state === "missing" ? {} : { document_id: candidatePath }),
    path: state === "missing" ? "docs/missing.md" : candidatePath,
    state,
    ...(state === "superseded" ? { superseded_by: "docs/replacement.md" } : {}),
    ...(state === "conflicting" ? { declared_canonical_owner: "docs/other.md" } : {})
  };
  const matches = Array.from({ length: concernCount }, (_, index) => ({
    concern_key: `runtime-${index}`,
    normalized_term: "runtime",
    query_token_start: 0,
    query_token_end_exclusive: 1,
    token_count: 1,
    owners: [
      owner,
      ...(includeSecondOwner ? [{ document_id: "docs/second.md", path: "docs/second.md", state: "draft" as const }] : [])
    ]
  }));
  return rankDocumentationCandidates({
    query: "runtime",
    concern_resolution: {
      normalized_query: "runtime",
      query_tokens: ["runtime"],
      concern_match_state: "matched",
      matches
    },
    candidates: [{
      stable_document_id: candidatePath,
      hit: {
        path: candidatePath,
        title: "Runtime owner",
        score: 5,
        evidence_kinds: ["docs", "fts"],
        direct_read_caveat: state === "draft"
          ? "Draft owner evidence; direct-read and verify accepted direction."
          : "Read source.",
        doc_status: state === "draft" ? "draft" : "current",
        authority: "canonical",
        currency_state: "current",
        currency_caveats: []
      },
      lexical_score: 2,
      title_heading_text: "Runtime owner",
      body_text: "runtime"
    }]
  });
}

function base() {
  return {
    ranking_contract_version: 1 as const,
    repo_root: "/repo",
    snapshot_id: "snapshot-043",
    query: "runtime contracts",
    normalized_query: "runtime contracts",
    ranking_schema_version: 1 as const,
    ranking_policy_version: "authority-aware-v1" as const,
    warnings: [],
    next_actions: []
  };
}

function success(
  hits: RankedDocsSearchHit[],
  coverage: {
    priority_scan_coverage_state?: "complete" | "partial" | "refreshing" | "stale" | "blocked" | "unknown";
    priority_scan_truncated?: boolean;
    priority_scan_coverage_note?: string;
    priority_scan_indexed_markdown_files_count?: number;
    priority_scan_skipped_markdown_files_count?: number;
  } = {}
): Extract<RankedDocsSearchResult, { trust_state: "complete_ranked_universe" }> {
  const counts = { ...countBase(hits.length), ...coverage };
  return {
    ...base(), status: hits.length === 0 ? "not_applicable" : "done",
    trust_state: "complete_ranked_universe", universe_id: "universe-043", hits, counts,
    result_count: hits.length, result_count_basis: "page", indexed_docs_count: 12,
    docs_index_state: counts.priority_scan_coverage_state,
    docs_scan_truncated: counts.priority_scan_truncated,
    coverage_note: counts.priority_scan_coverage_note,
    truncated: false
  };
}

function overflowCounts() {
  const {
    fts_candidate_documents_count: _fts,
    candidate_union_documents_count: _union,
    ranked_candidate_universe_count: _ranked,
    ...common
  } = countBase(0);
  return {
    ...common,
    returned_page_documents_count: 0 as const,
    fts_candidate_count_lower_bound: 501 as const,
    matched_owner_candidate_documents_count: 0,
    candidate_union_count_lower_bound: 501 as const
  };
}

function countBase(page: number) {
  return {
    searchable_snapshot_documents_count: 12, searchable_scope_documents_count: 11,
    fts_candidate_documents_count: page, matched_owner_candidate_documents_count: 0,
    candidate_union_documents_count: page, ranked_candidate_universe_count: page,
    returned_page_documents_count: page,
    priority_scan_eligible_markdown_files_count: 10,
    priority_scan_indexed_markdown_files_count: 10,
    priority_scan_skipped_markdown_files_count: 0,
    priority_scan_coverage_state: "complete" as const,
    priority_scan_truncated: false,
    priority_scan_coverage_note: undefined as string | undefined,
    searchable_filter_basis: "merged_graph_and_priority_markdown" as const,
    scope_filter_basis: "repo_root" as const,
    query_filter_basis: {
      fts_candidate_documents_count: "normalized_fts_match_within_scope" as const,
      matched_owner_candidate_documents_count: "exact_matched_concern_owners_within_scope" as const,
      candidate_union_documents_count: "distinct_fts_and_exact_owner_union_within_scope" as const,
      ranked_candidate_universe_count: "distinct_fts_and_exact_owner_union_within_scope" as const
    },
    page_filter_basis: "frozen_universe_position_and_requested_page_size" as const,
    priority_scan_filter_basis: "configured_priority_roots" as const
  };
}

function hit(path: string, score: number, lexicalScore: number): RankedDocsSearchHit {
  return {
    path, title: path, score, lexical_score: lexicalScore, evidence_kinds: ["docs", "fts"],
    direct_read_caveat: "Read the source section.", authority: "canonical", currency_state: "current",
    currency_caveats: [], candidate_source: "fts", concern_match_state: "no_match",
    matched_concerns: [], governing_owner_tier: "non_owner",
    final_rank_components: {
      relevance_band: "all_query_tokens_body", governing_owner_tier: "non_owner",
      authority_tier: "canonical", currency_tier: "current", lexical_score: lexicalScore,
      normalized_path: path, stable_document_id: path
    },
    ranking_policy_version: "authority-aware-v1", ranking_reasons: ["Frozen rank fixture."]
  };
}

function ownerHit(): RankedDocsSearchHit {
  const path = "docs/owner.md";
  return {
    path, title: "Owner", score: 7, evidence_kinds: ["docs"], direct_read_caveat: "Read source.",
    authority: "canonical", currency_state: "current", currency_caveats: [],
    canonical_owner: "/home/example/private-owner.md", superseded_by: "../outside/old-owner.md",
    candidate_source: "matched_owner", concern_match_state: "matched",
    matched_concerns: [{
      concern_key: "runtime-contracts", normalized_term: "runtime contracts",
      query_token_start: 0, query_token_end_exclusive: 2, token_count: 2,
      owners: [{ document_id: path, path, state: "valid" }]
    }],
    governing_owner_tier: "valid_owner",
    final_rank_components: {
      relevance_band: "intent_owner_match", governing_owner_tier: "valid_owner",
      authority_tier: "canonical", currency_tier: "current", normalized_path: path,
      stable_document_id: path
    },
    ranking_policy_version: "authority-aware-v1", ranking_reasons: ["Owner fixture."]
  };
}
