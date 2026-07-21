/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import {
  DOCS_RANKING_CANDIDATE_LIMIT,
  DOCS_RANKING_CONTRACT_VERSION,
  DOCS_RANKING_OVERFLOW_SENTINEL,
  DOCS_RANKING_POLICY_VERSION,
  DOCS_RANKING_SCHEMA_VERSION,
  docsConcernMatchEvidenceSchema,
  docsQueryFilterBasisSchema,
  docsRankingCandidateQueryResultSchema,
  docsRankingCandidateSchema,
  docsRankingCountReceiptSchema,
  docsRankingCursorPayloadSchema,
  docsRankingOverflowCountReceiptSchema,
  rankedDocsSearchHitSchema,
  rankedDocsSearchResultSchema,
  type RankedDocsSearchHit
} from "../../src/contracts/index.js";
import type {
  DocsRankingCandidateQueryPort,
  RankedDocsUniversePort
} from "../../src/ports/index.js";

describe("authority-aware docs ranking contracts", () => {
  it("locks exact concern evidence, owner tiers, finite lexical score, and canonical stable identity", () => {
    const fts = ftsHit({ path: "docs/design/runtime.md", score: 1, lexicalScore: -12.5 });
    expect(rankedDocsSearchHitSchema.parse(fts)).toEqual(fts);

    const owner = ownerOnlyHit();
    expect(rankedDocsSearchHitSchema.parse(owner)).toEqual(owner);
    expect(rankedDocsSearchHitSchema.safeParse({ ...owner, lexical_score: 3 }).success).toBe(false);
    expect(rankedDocsSearchHitSchema.safeParse({
      ...owner,
      final_rank_components: { ...owner.final_rank_components, stable_document_id: "doc-17" }
    }).success).toBe(false);
    expect(rankedDocsSearchHitSchema.safeParse({
      ...fts,
      path: "docs\\design\\runtime.md",
      final_rank_components: {
        ...fts.final_rank_components,
        normalized_path: "docs\\design\\runtime.md",
        stable_document_id: "docs\\design\\runtime.md"
      }
    }).success).toBe(false);
    expect(rankedDocsSearchHitSchema.safeParse({ ...fts, lexical_score: Number.POSITIVE_INFINITY }).success)
      .toBe(false);
  });

  it("distinguishes a contradictory canonical-owner declaration from valid multiple ownership", () => {
    const validOwners = ownerOnlyHit({
      path: "docs/design/a.md",
      owners: [
        ownerEvidence("docs/design/a.md", "valid"),
        ownerEvidence("docs/design/b.md", "draft")
      ]
    });
    expect(rankedDocsSearchHitSchema.parse(validOwners).governing_owner_tier).toBe("valid_owner");

    const conflictOwner = ownerOnlyHit({
      path: "docs/design/a.md",
      ownerTier: "invalid_conflicting_owner",
      owners: [{
        ...ownerEvidence("docs/design/a.md", "conflicting"),
        declared_canonical_owner: "docs/design/b.md"
      }]
    });
    expect(rankedDocsSearchHitSchema.parse(conflictOwner).governing_owner_tier)
      .toBe("invalid_conflicting_owner");
    expect(rankedDocsSearchHitSchema.safeParse(ownerOnlyHit({
      path: "docs/design/a.md",
      ownerTier: "invalid_conflicting_owner",
      owners: [ownerEvidence("docs/design/a.md", "conflicting")]
    })).success).toBe(false);
  });

  it("separates query concern matches from ownership of an FTS-only candidate", () => {
    const candidate = ftsHit({ path: "docs/install-guide.md", score: 50, lexicalScore: 50 });
    const matchedQueryCandidate = {
      ...candidate,
      concern_match_state: "matched" as const,
      matched_concerns: [{
        concern_key: "coding-agent-integrations",
        normalized_term: "sessionstart",
        query_token_start: 0,
        query_token_end_exclusive: 1,
        token_count: 1,
        owners: [ownerEvidence("docs/design/coding-agent-integration-design.md", "valid")]
      }]
    };

    expect(rankedDocsSearchHitSchema.parse(matchedQueryCandidate)).toMatchObject({
      candidate_source: "fts",
      concern_match_state: "matched",
      governing_owner_tier: "non_owner"
    });
    expect(rankedDocsSearchHitSchema.safeParse({
      ...matchedQueryCandidate,
      matched_concerns: [{
        ...matchedQueryCandidate.matched_concerns[0],
        owners: [ownerEvidence("docs/install-guide.md", "valid")]
      }]
    }).success).toBe(false);

    const unrelatedValidAndRelatedConflict = ownerOnlyHit({
      path: "docs/design/a.md",
      ownerTier: "invalid_conflicting_owner",
      owners: [
        ownerEvidence("docs/design/b.md", "valid"),
        {
          ...ownerEvidence("docs/design/a.md", "conflicting"),
          declared_canonical_owner: "docs/design/b.md"
        }
      ]
    });
    expect(rankedDocsSearchHitSchema.parse(unrelatedValidAndRelatedConflict).governing_owner_tier)
      .toBe("invalid_conflicting_owner");
  });

  it("enforces the complete candidate-source and relevance-band matrix with non-empty reasons", () => {
    const fts = ftsHit({ path: "docs/fts.md", score: 1, lexicalScore: 1 });
    expect(rankedDocsSearchHitSchema.safeParse({
      ...fts,
      final_rank_components: { ...fts.final_rank_components, relevance_band: "intent_owner_match" }
    }).success).toBe(false);
    expect(rankedDocsSearchHitSchema.safeParse({ ...fts, ranking_reasons: [] }).success).toBe(false);

    const ownerOnly = ownerOnlyHit();
    expect(rankedDocsSearchHitSchema.safeParse({
      ...ownerOnly,
      final_rank_components: { ...ownerOnly.final_rank_components, relevance_band: "all_query_tokens_body" }
    }).success).toBe(false);

    const ftsAndOwner = {
      ...ownerOnly,
      candidate_source: "fts_and_matched_owner" as const,
      lexical_score: 4,
      final_rank_components: {
        ...ownerOnly.final_rank_components,
        relevance_band: "all_query_tokens_title_or_heading" as const,
        lexical_score: 4
      }
    };
    expect(rankedDocsSearchHitSchema.parse(ftsAndOwner).candidate_source).toBe("fts_and_matched_owner");
    expect(rankedDocsSearchHitSchema.safeParse({
      ...ftsAndOwner,
      final_rank_components: { ...ftsAndOwner.final_rank_components, relevance_band: "partial_fts_match" }
    }).success).toBe(false);
  });

  it("requires exact per-count filter bases and complete 0/499/500 count receipts", () => {
    expect(docsQueryFilterBasisSchema.parse(queryFilterBasis())).toEqual(queryFilterBasis());
    expect(docsQueryFilterBasisSchema.safeParse({
      ...queryFilterBasis(),
      extra_count: "unknown"
    }).success).toBe(false);

    for (const size of [0, 499, 500]) {
      expect(docsRankingCountReceiptSchema.parse(successCounts({
        fts: size,
        owners: 0,
        union: size,
        ranked: size,
        page: Math.min(size, 10)
      })).ranked_candidate_universe_count).toBe(size);
    }
    expect(docsRankingCountReceiptSchema.safeParse(successCounts({
      fts: 500,
      owners: 1,
      union: 501,
      ranked: 501,
      page: 10
    })).success).toBe(false);
  });

  it("locks exact-versus-501 overflow exclusivity for both sources and the union", () => {
    const ftsOverflow = overflowCounts({
      fts_candidate_count_lower_bound: DOCS_RANKING_OVERFLOW_SENTINEL,
      matched_owner_candidate_documents_count: 4
    });
    expect(docsRankingOverflowCountReceiptSchema.parse(ftsOverflow)).toEqual(ftsOverflow);

    const ownerOverflow = overflowCounts({
      fts_candidate_documents_count: 4,
      matched_owner_candidate_count_lower_bound: DOCS_RANKING_OVERFLOW_SENTINEL
    });
    expect(docsRankingOverflowCountReceiptSchema.parse(ownerOverflow)).toEqual(ownerOverflow);

    const unionOverflow = overflowCounts({
      fts_candidate_documents_count: 300,
      matched_owner_candidate_documents_count: 300
    });
    expect(docsRankingOverflowCountReceiptSchema.parse(unionOverflow)).toEqual(unionOverflow);
    expect(docsRankingOverflowCountReceiptSchema.safeParse({
      ...ownerOverflow,
      matched_owner_candidate_documents_count: 500
    }).success).toBe(false);
    expect(docsRankingOverflowCountReceiptSchema.safeParse({
      ...ownerOverflow,
      candidate_union_documents_count: 500
    }).success).toBe(false);

    const blocked = rankedDocsSearchResultSchema.parse({
      ...resultBase(),
      status: "blocked",
      trust_state: "blocked_candidate_overflow",
      blocker: "candidate_universe_exceeds_limit",
      hits: [],
      counts: ownerOverflow,
      truncated: false
    });
    expect(blocked).not.toHaveProperty("cursor");
    expect(blocked).not.toHaveProperty("universe_id");
  });

  it("binds cursor identity to the frozen universe and all ranking inputs", () => {
    const payload = {
      version: DOCS_RANKING_CONTRACT_VERSION,
      universe_id: "docs-universe-1",
      next_position: 10,
      snapshot_id: "snapshot-1",
      normalized_query: "sessionstart behavior",
      normalized_scope_path: "docs",
      retrieval_bound: DOCS_RANKING_CANDIDATE_LIMIT,
      ranking_schema_version: DOCS_RANKING_SCHEMA_VERSION,
      ranking_policy_version: DOCS_RANKING_POLICY_VERSION
    } as const;
    expect(docsRankingCursorPayloadSchema.parse(payload)).toEqual(payload);
    expect(docsRankingCursorPayloadSchema.safeParse({ ...payload, retrieval_bound: 499 }).success).toBe(false);
    expect(docsRankingCursorPayloadSchema.safeParse({ ...payload, ranking_policy_version: "legacy" }).success)
      .toBe(false);
  });

  it("preserves authoritative response order instead of re-sorting by legacy aggregate score", () => {
    const governing = ftsHit({
      path: "docs/design/governing.md",
      score: 1,
      lexicalScore: 1,
      relevanceBand: "exact_document_phrase"
    });
    const lexical = ftsHit({
      path: "docs/install-guide.md",
      score: 999,
      lexicalScore: 999,
      relevanceBand: "partial_fts_match"
    });
    const result = rankedDocsSearchResultSchema.parse({
      ...resultBase(),
      status: "done",
      trust_state: "complete_ranked_universe",
      universe_id: "docs-universe-1",
      hits: [governing, lexical],
      counts: successCounts({ fts: 2, owners: 0, union: 2, ranked: 2, page: 2 }),
      truncated: false
    });

    expect(result.hits.map((hit) => hit.path)).toEqual([
      "docs/design/governing.md",
      "docs/install-guide.md"
    ]);
    expect(result.hits.map((hit) => hit.score)).toEqual([1, 999]);
  });

  it("keeps future candidate and frozen-universe ports separate from the legacy docs index", async () => {
    const candidatePort: DocsRankingCandidateQueryPort = {
      async countSearchableDocuments() {
        return { searchable_snapshot_documents_count: 1, searchable_scope_documents_count: 1 };
      },
      async findFtsCandidates() { return { status: "exact", candidates: [] }; },
      async findMatchedOwnerCandidates() {
        return { status: "overflow", candidates: [], candidate_count_lower_bound: 501 };
      }
    };
    const universePort: RankedDocsUniversePort = {
      async put() {},
      async get() { return null; },
      async delete() {},
      async purgeExpired() { return 0; }
    };

    expect(await candidatePort.findFtsCandidates({
      snapshot_id: "snapshot-1",
      normalized_query: "sessionstart",
      max_rows: DOCS_RANKING_OVERFLOW_SENTINEL
    })).toEqual({ status: "exact", candidates: [] });
    expect(await candidatePort.findMatchedOwnerCandidates({
      snapshot_id: "snapshot-1",
      concern_keys: ["coding-agent-integrations"],
      normalized_query: "sessionstart",
      max_rows: DOCS_RANKING_OVERFLOW_SENTINEL
    })).toEqual({ status: "overflow", candidates: [], candidate_count_lower_bound: 501 });
    expect(await universePort.get({ universe_id: "missing", snapshot_id: "snapshot-1" })).toBeNull();
  });

  it("rejects inconsistent candidate identity and partial overflow payloads", () => {
    const hit = legacyCandidateHit("docs/design/runtime.md");
    expect(docsRankingCandidateSchema.parse({
      stable_document_id: hit.path,
      hit,
      lexical_score: -2,
      title_heading_text: "Runtime design",
      body_text: "SessionStart behavior"
    }).stable_document_id).toBe(hit.path);
    expect(docsRankingCandidateSchema.safeParse({
      stable_document_id: "docs/design/other.md",
      hit,
      title_heading_text: "Runtime design",
      body_text: "SessionStart behavior"
    }).success).toBe(false);
    expect(docsRankingCandidateQueryResultSchema.parse({
      status: "overflow",
      candidates: [],
      candidate_count_lower_bound: DOCS_RANKING_OVERFLOW_SENTINEL
    }).status).toBe("overflow");
    expect(docsRankingCandidateQueryResultSchema.safeParse({
      status: "overflow",
      candidates: [{ stable_document_id: hit.path, hit }],
      candidate_count_lower_bound: DOCS_RANKING_OVERFLOW_SENTINEL
    }).success).toBe(false);
    expect(docsRankingCandidateQueryResultSchema.safeParse({
      status: "exact",
      candidates: [],
      candidate_count_lower_bound: DOCS_RANKING_OVERFLOW_SENTINEL
    }).success).toBe(false);
  });
});

function ftsHit(input: {
  path: string;
  score: number;
  lexicalScore: number;
  relevanceBand?: RankedDocsSearchHit["final_rank_components"]["relevance_band"];
}): RankedDocsSearchHit {
  return {
    path: input.path,
    title: input.path,
    score: input.score,
    lexical_score: input.lexicalScore,
    evidence_kinds: ["docs", "fts"],
    direct_read_caveat: "Routing evidence only.",
    doc_status: "current",
    authority: "canonical",
    currency_state: "current",
    candidate_source: "fts",
    concern_match_state: "no_match",
    matched_concerns: [],
    governing_owner_tier: "non_owner",
    final_rank_components: {
      relevance_band: input.relevanceBand ?? "all_query_tokens_body",
      governing_owner_tier: "non_owner",
      authority_tier: "canonical",
      currency_tier: "current",
      lexical_score: input.lexicalScore,
      normalized_path: input.path,
      stable_document_id: input.path
    },
    ranking_policy_version: DOCS_RANKING_POLICY_VERSION,
    ranking_reasons: ["Exact contract fixture."]
  };
}

function ownerOnlyHit(input: {
  path?: string;
  ownerTier?: RankedDocsSearchHit["governing_owner_tier"];
  owners?: ReturnType<typeof ownerEvidence>[];
} = {}): RankedDocsSearchHit {
  const path = input.path ?? "docs/design/coding-agent-integration-design.md";
  const ownerTier = input.ownerTier ?? "valid_owner";
  const owners = input.owners ?? [ownerEvidence(path, "valid")];
  return {
    path,
    title: "Coding agent integration design",
    score: 7,
    evidence_kinds: ["docs"],
    direct_read_caveat: "Routing evidence only.",
    doc_status: "current",
    authority: "canonical",
    currency_state: "current",
    candidate_source: "matched_owner",
    concern_match_state: "matched",
    matched_concerns: [{
      concern_key: "coding-agent-integrations",
      normalized_term: "sessionstart",
      query_token_start: 0,
      query_token_end_exclusive: 1,
      token_count: 1,
      owners
    }],
    governing_owner_tier: ownerTier,
    final_rank_components: {
      relevance_band: "intent_owner_match",
      governing_owner_tier: ownerTier,
      authority_tier: "canonical",
      currency_tier: "current",
      normalized_path: path,
      stable_document_id: path
    },
    ranking_policy_version: DOCS_RANKING_POLICY_VERSION,
    ranking_reasons: ["Exact matched concern owner."]
  };
}

function ownerEvidence(
  path: string,
  state: "valid" | "draft" | "conflicting"
): {
  document_id: string;
  path: string;
  state: "valid" | "draft" | "conflicting";
  declared_canonical_owner?: string;
} {
  return { document_id: path, path, state };
}

function legacyCandidateHit(path: string) {
  return {
    path,
    title: path,
    score: 1,
    evidence_kinds: ["docs", "fts"] as const,
    direct_read_caveat: "Routing evidence only."
  };
}

function queryFilterBasis() {
  return {
    fts_candidate_documents_count: "normalized_fts_match_within_scope",
    matched_owner_candidate_documents_count: "exact_matched_concern_owners_within_scope",
    candidate_union_documents_count: "distinct_fts_and_exact_owner_union_within_scope",
    ranked_candidate_universe_count: "distinct_fts_and_exact_owner_union_within_scope"
  } as const;
}

function countBase() {
  return {
    searchable_snapshot_documents_count: 600,
    searchable_scope_documents_count: 600,
    priority_scan_eligible_markdown_files_count: 40,
    priority_scan_indexed_markdown_files_count: 39,
    priority_scan_skipped_markdown_files_count: 1,
    searchable_filter_basis: "merged_graph_and_priority_markdown",
    scope_filter_basis: "repo_root",
    query_filter_basis: queryFilterBasis(),
    page_filter_basis: "frozen_universe_position_and_requested_page_size",
    priority_scan_filter_basis: "configured_priority_roots"
  } as const;
}

function successCounts(input: { fts: number; owners: number; union: number; ranked: number; page: number }) {
  return {
    ...countBase(),
    fts_candidate_documents_count: input.fts,
    matched_owner_candidate_documents_count: input.owners,
    candidate_union_documents_count: input.union,
    ranked_candidate_universe_count: input.ranked,
    returned_page_documents_count: input.page
  };
}

function overflowCounts(input: Record<string, number>) {
  return {
    ...countBase(),
    returned_page_documents_count: 0,
    candidate_union_count_lower_bound: DOCS_RANKING_OVERFLOW_SENTINEL,
    ...input
  };
}

function resultBase() {
  return {
    ranking_contract_version: DOCS_RANKING_CONTRACT_VERSION,
    repo_root: "/repo",
    snapshot_id: "snapshot-1",
    query: "SessionStart behavior",
    normalized_query: "sessionstart behavior",
    ranking_schema_version: DOCS_RANKING_SCHEMA_VERSION,
    ranking_policy_version: DOCS_RANKING_POLICY_VERSION,
    warnings: [],
    next_actions: []
  } as const;
}

describe("concern match spans", () => {
  it("uses every normalized token without hidden stopword or minimum-length filtering", () => {
    expect(docsConcernMatchEvidenceSchema.parse({
      concern_key: "short-token",
      normalized_term: "a",
      query_token_start: 1,
      query_token_end_exclusive: 2,
      token_count: 1,
      owners: [ownerEvidence("docs/a.md", "valid")]
    }).normalized_term).toBe("a");
    expect(docsConcernMatchEvidenceSchema.safeParse({
      concern_key: "bad-span",
      normalized_term: "runtime contracts",
      query_token_start: 1,
      query_token_end_exclusive: 2,
      token_count: 2,
      owners: []
    }).success).toBe(false);
  });
});
