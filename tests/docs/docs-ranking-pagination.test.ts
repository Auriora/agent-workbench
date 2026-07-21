/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { searchDocs } from "../../src/application/use-cases/query-docs.js";
import {
  DOCS_RANKING_CANDIDATE_LIMIT,
  DOCS_RANKING_CONTRACT_VERSION,
  DOCS_RANKING_POLICY_VERSION,
  DOCS_RANKING_SCHEMA_VERSION,
  type DocsRankingCandidateQueryResult,
  type DocsRankingCursorPayload,
  type DocsSearchHit,
  type RankedDocsSearchHit
} from "../../src/contracts/index.js";
import type {
  DocsIndexPort,
  DocsRankingCandidateQueryPort,
  DocsRankingCursorCodecPort,
  RankedDocsUniversePort,
  RankedDocsUniverseRecord
} from "../../src/ports/index.js";

const FIXTURE_ROOT = path.resolve("tests/fixtures/fixture-docs-authority-ranking");

type CompleteScenario = {
  id: string;
  fts_count: number;
  owner_count: number;
  overlap_count: number;
  distinct_union_count: number;
  outcome: "complete";
};

type OverflowScenario = {
  id: string;
  fts_count?: number;
  fts_count_lower_bound?: 501;
  owner_count?: number;
  owner_count_lower_bound?: 501;
  owner_fts_ordinal?: number;
  overlap_count?: number;
  distinct_union_count_lower_bound: 501;
  outcome: "candidate_universe_exceeds_limit";
};

type BoundaryOracle = {
  candidate_limit: 500;
  sentinel_limit: 501;
  scenarios: Array<CompleteScenario | OverflowScenario>;
};

describe("documentation ranked-universe boundary fixture", () => {
  it("locks exact 0/499/500 and three independent 501 overflow shapes", () => {
    const oracle = readOracle();
    const complete = oracle.scenarios.filter(isComplete);
    const overflow = oracle.scenarios.filter(isOverflow);

    expect(oracle).toMatchObject({ candidate_limit: 500, sentinel_limit: 501 });
    expect(complete.map(({ distinct_union_count }) => distinct_union_count)).toEqual([0, 499, 500]);
    expect(overflow.map(({ id }) => id)).toEqual([
      "fts-owner-row-501",
      "owner-only-union-row-501",
      "matched-owner-source-row-501"
    ]);
    expect(overflow.find(({ id }) => id === "fts-owner-row-501")).toMatchObject({
      fts_count_lower_bound: 501,
      owner_fts_ordinal: 501
    });
    expect(overflow.find(({ id }) => id === "matched-owner-source-row-501")).toMatchObject({
      owner_count_lower_bound: 501,
      overlap_count: 1,
      distinct_union_count_lower_bound: 501
    });
  });

  it("materializes each overflow scenario through discriminated candidate-port results", async () => {
    for (const scenario of readOracle().scenarios.filter(isOverflow)) {
      const sources = overflowSources(scenario);
      const candidates = candidateQueryHarness(scenario, sources);
      const fts = await candidates.port.findFtsCandidates(candidateRequest());
      const owners = await candidates.port.findMatchedOwnerCandidates(ownerRequest());

      expectOverflowSourcePreconditions(scenario, sources);
      expectCandidateResult(fts, sources.fts, scenario.fts_count_lower_bound === 501);
      expectCandidateResult(owners, sources.owners, scenario.owner_count_lower_bound === 501);
    }
  });

  for (const seed of [1, 7, 19, 41, 73]) {
    it(`deduplicates virtual FTS/owner sets before applying the cap (seed ${seed})`, () => {
      const complete = seededShuffle(readOracle().scenarios.filter(isComplete), seed);
      for (const scenario of complete) {
        const sources = virtualSources(scenario);
        const union = new Set([
          ...seededShuffle(sources.fts, seed),
          ...seededShuffle(sources.owners, seed + 101)
        ]);
        const reversedUnion = new Set([
          ...[...sources.owners].reverse(),
          ...[...sources.fts].reverse()
        ]);

        expect(union.size).toBe(scenario.distinct_union_count);
        expect(union.size).toBeLessThanOrEqual(500);
        expect([...union].sort()).toEqual([...reversedUnion].sort());
      }
    });
  }

  it("keeps count universes and the strict keyed query filter basis coherent", () => {
    const coverage = JSON.parse(
      fs.readFileSync(path.join(FIXTURE_ROOT, "coverage-scenarios.json"), "utf8")
    ) as {
      complete: Record<string, number | string>;
      partial: Record<string, number | string>;
      out_of_priority_path: string;
    };
    const ranking = JSON.parse(
      fs.readFileSync(path.join(FIXTURE_ROOT, "ranking-oracle.json"), "utf8")
    ) as { query_filter_basis: Record<string, string> };

    for (const receipt of [coverage.complete, coverage.partial]) {
      expect(receipt.priority_scan_indexed_markdown_files_count as number +
        (receipt.priority_scan_skipped_markdown_files_count as number))
        .toBe(receipt.priority_scan_eligible_markdown_files_count);
      expect(receipt.searchable_snapshot_documents_count).toBeGreaterThan(
        receipt.priority_scan_indexed_markdown_files_count as number
      );
    }
    const markdownPaths = listMarkdownPaths(FIXTURE_ROOT);
    expect(markdownPaths).toHaveLength(13);
    expect(markdownPaths.filter((candidate) => candidate !== coverage.out_of_priority_path)).toHaveLength(12);
    expect(coverage.complete).toMatchObject({
      searchable_snapshot_documents_count: markdownPaths.length,
      priority_scan_eligible_markdown_files_count: markdownPaths.length - 1
    });
    expect(coverage.out_of_priority_path).toBe("notes/out-of-priority.md");
    expect(fs.existsSync(path.join(FIXTURE_ROOT, coverage.out_of_priority_path))).toBe(true);
    expect(ranking.query_filter_basis).toEqual({
      fts_candidate_documents_count: "normalized_fts_match_within_scope",
      matched_owner_candidate_documents_count: "exact_matched_concern_owners_within_scope",
      candidate_union_documents_count: "distinct_fts_and_exact_owner_union_within_scope",
      ranked_candidate_universe_count: "distinct_fts_and_exact_owner_union_within_scope"
    });
  });

  for (const scenario of readOracle().scenarios.filter(isOverflow)) {
    it.fails(`T005 red proof: blocks ${scenario.id} with no hits or cursor`, async () => {
      const sources = overflowSources(scenario);
      const candidates = candidateQueryHarness(scenario, sources);
      const dependencies = rankingDependencies({ candidates });
      expectOverflowSourcePreconditions(scenario, sources);

      const result = await searchDocsWithRankingDependencies({
        request: {
          repo_root: "/fixture-docs-authority-ranking",
          query: scenario.id,
          max_results: 10,
          include_snippets: false
        },
        docs_index: legacyOverflowIndex(scenario),
        ranking_candidates: dependencies.ranking_candidates,
        ranking_cursor_codec: dependencies.ranking_cursor_codec,
        ranked_universes: dependencies.ranked_universes,
        selected_snapshot_id: "snapshot-043",
        default_repo_root: "."
      });

      expect(candidates.calls).toEqual([
        { source: "fts", snapshot_id: "snapshot-043", max_rows: 501 },
        { source: "owner", snapshot_id: "snapshot-043", max_rows: 501 }
      ]);
      expect(result.search).toMatchObject({
        status: "blocked",
        hits: [],
        cursor: undefined,
        result_count: 0,
        overflow_reason: "candidate_universe_exceeds_limit",
        counts: {
          ...(scenario.fts_count_lower_bound === 501
            ? { fts_candidate_count_lower_bound: 501 }
            : { fts_candidate_documents_count: scenario.fts_count }),
          ...(scenario.owner_count_lower_bound === 501
            ? { matched_owner_candidate_count_lower_bound: 501 }
            : { matched_owner_candidate_documents_count: scenario.owner_count }),
          candidate_union_count_lower_bound: 501,
          returned_page_documents_count: 0
        }
      });
    });
  }

  it.fails("T005 red proof: cursor pages concatenate to the frozen first-page order", async () => {
    const harness = rankedUniverseProofHarness();
    const first = await runPagedSearch(harness, "frozen query");
    expect(first.search.cursor).toEqual(expect.any(String));
    const second = await runPagedSearch(harness, "frozen query", first.search.cursor);

    expect(harness.candidate_calls.map(({ source }) => source)).toEqual(["fts", "owner"]);
    expect(harness.universe_calls.map(({ operation }) => operation)).toEqual(["put", "get"]);
    expect(harness.codec_calls.map(({ operation }) => operation)).toEqual(["encode", "decode"]);
    expect([...first.search.hits, ...second.search.hits].map(({ path: hitPath }) => hitPath)).toEqual(
      harness.expected_frozen_order
    );
  });

  it.fails("T005 red proof: rejects a cursor when normalized query identity changes", async () => {
    const harness = rankedUniverseProofHarness();
    const first = await runPagedSearch(harness, "frozen query");
    expect(first.search.cursor).toEqual(expect.any(String));
    const changed = await runPagedSearch(harness, "different query", first.search.cursor);

    expect(harness.codec_calls.map(({ operation }) => operation)).toEqual(["encode", "decode"]);
    expect(harness.universe_calls.map(({ operation }) => operation)).toEqual(["put"]);
    expect(changed.search).toMatchObject({
      status: "blocked",
      hits: [],
      cursor: undefined
    });
  });

  it.fails("T005 red proof: rejects an expired frozen-universe cursor without restarting", async () => {
    const harness = rankedUniverseProofHarness();
    const expiredCursor = harness.ranking_cursor_codec.encode(cursorPayload("expired-universe-043"));
    const expired = await runPagedSearch(harness, "frozen query", expiredCursor);

    expect(harness.codec_calls.map(({ operation }) => operation)).toEqual(["encode", "decode"]);
    expect(harness.universe_calls).toEqual([
      { operation: "get", universe_id: "expired-universe-043" }
    ]);
    expect(harness.candidate_calls).toEqual([]);
    expect(expired.search).toMatchObject({
      status: "blocked",
      hits: [],
      cursor: undefined
    });
  });
});

type CandidateSources = { fts: string[]; owners: string[] };

type CandidateCall = {
  source: "fts" | "owner";
  snapshot_id: string;
  max_rows: 501;
};

type CandidateQueryHarness = {
  port: DocsRankingCandidateQueryPort;
  calls: CandidateCall[];
};

type RankingDependencies = {
  ranking_candidates: DocsRankingCandidateQueryPort;
  ranking_cursor_codec: DocsRankingCursorCodecPort;
  ranked_universes: RankedDocsUniversePort;
};

type FutureRankedSearchInput = Parameters<typeof searchDocs>[0] & RankingDependencies;

type RankedUniverseHarness = RankingDependencies & {
  docs_index: DocsIndexPort;
  expected_frozen_order: string[];
  candidate_calls: CandidateCall[];
  codec_calls: Array<{ operation: "encode" | "decode"; cursor?: string }>;
  universe_calls: Array<{ operation: "put" | "get"; universe_id: string }>;
};

function virtualSources(scenario: CompleteScenario): { fts: string[]; owners: string[] } {
  const fts = Array.from({ length: scenario.fts_count }, (_, index) => virtualId("fts", index));
  const owners = [
    ...fts.slice(0, scenario.overlap_count),
    ...Array.from(
      { length: scenario.owner_count - scenario.overlap_count },
      (_, index) => virtualId("owner", index)
    )
  ];
  return { fts, owners };
}

function overflowSources(scenario: OverflowScenario): CandidateSources {
  const ftsCount = scenario.fts_count_lower_bound ?? scenario.fts_count ?? 0;
  const ownerCount = scenario.owner_count_lower_bound ?? scenario.owner_count ?? 0;
  const fts = Array.from({ length: ftsCount }, (_, index) => virtualId("fts", index));
  const overlappingOwners = scenario.owner_fts_ordinal === undefined
    ? fts.slice(0, scenario.overlap_count ?? 0)
    : [fts[scenario.owner_fts_ordinal - 1]!];
  const owners = [
    ...overlappingOwners,
    ...Array.from(
      { length: ownerCount - overlappingOwners.length },
      (_, index) => virtualId(`owner-${scenario.id}`, index)
    )
  ];
  return { fts, owners };
}

function expectOverflowSourcePreconditions(
  scenario: OverflowScenario,
  sources: CandidateSources
): void {
  const overlap = sources.owners.filter((owner) => sources.fts.includes(owner));
  const union = new Set([...sources.fts, ...sources.owners]);
  if (scenario.fts_count_lower_bound !== undefined) {
    expect(sources.fts.length).toBeGreaterThanOrEqual(scenario.fts_count_lower_bound);
  } else {
    expect(sources.fts).toHaveLength(scenario.fts_count ?? 0);
  }
  if (scenario.owner_count_lower_bound !== undefined) {
    expect(sources.owners.length).toBeGreaterThanOrEqual(scenario.owner_count_lower_bound);
  } else {
    expect(sources.owners).toHaveLength(scenario.owner_count ?? 0);
  }
  expect(overlap).toHaveLength(scenario.overlap_count ?? 0);
  if (scenario.owner_fts_ordinal !== undefined) {
    expect(sources.owners).toContain(sources.fts[scenario.owner_fts_ordinal - 1]);
  }
  expect(union.size).toBeGreaterThanOrEqual(scenario.distinct_union_count_lower_bound);
}

function expectCandidateResult(
  result: DocsRankingCandidateQueryResult,
  expectedIds: readonly string[],
  overflow: boolean
): void {
  if (overflow) {
    expect(result).toEqual({
      status: "overflow",
      candidates: [],
      candidate_count_lower_bound: 501
    });
    return;
  }
  expect(result.status).toBe("exact");
  if (result.status === "exact") {
    expect(result.candidates.map(({ stable_document_id }) => stable_document_id)).toEqual(expectedIds);
  }
}

function listMarkdownPaths(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? listMarkdownPaths(entryPath)
      : entry.name.endsWith(".md")
        ? [path.relative(FIXTURE_ROOT, entryPath).replaceAll("\\", "/")]
        : [];
  });
}

function virtualId(source: string, index: number): string {
  return `docs/virtual/${source}-${String(index + 1).padStart(4, "0")}.md`;
}

function isComplete(scenario: CompleteScenario | OverflowScenario): scenario is CompleteScenario {
  return scenario.outcome === "complete";
}

function isOverflow(scenario: CompleteScenario | OverflowScenario): scenario is OverflowScenario {
  return scenario.outcome === "candidate_universe_exceeds_limit";
}

function readOracle(): BoundaryOracle {
  return JSON.parse(
    fs.readFileSync(path.join(FIXTURE_ROOT, "candidate-boundaries.json"), "utf8")
  ) as BoundaryOracle;
}

function seededShuffle<T>(values: readonly T[], seed: number): T[] {
  let state = seed >>> 0;
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const swap = state % (index + 1);
    [shuffled[index], shuffled[swap]] = [shuffled[swap]!, shuffled[index]!];
  }
  return shuffled;
}

function candidateQueryHarness(
  scenario: OverflowScenario,
  candidateSources: CandidateSources
): CandidateQueryHarness {
  const calls: CandidateCall[] = [];
  const result = (
    source: "fts" | "owner",
    ids: readonly string[],
    overflow: boolean
  ): DocsRankingCandidateQueryResult => overflow
    ? { status: "overflow", candidates: [], candidate_count_lower_bound: 501 }
    : {
        status: "exact",
        candidates: ids.map((stableDocumentId) => ({
          stable_document_id: stableDocumentId,
          hit: docsHit(stableDocumentId),
          lexical_score: source === "fts" ? 1 : undefined
        }))
      };
  return {
    calls,
    port: {
      async findFtsCandidates(input) {
        calls.push({ source: "fts", snapshot_id: input.snapshot_id, max_rows: input.max_rows });
        return result("fts", candidateSources.fts, scenario.fts_count_lower_bound === 501);
      },
      async findMatchedOwnerCandidates(input) {
        calls.push({ source: "owner", snapshot_id: input.snapshot_id, max_rows: input.max_rows });
        return result("owner", candidateSources.owners, scenario.owner_count_lower_bound === 501);
      }
    }
  };
}

function legacyOverflowIndex(scenario: OverflowScenario): DocsIndexPort {
  return {
    async replaceSnapshotDocs() {},
    async getState() {
      return {
        repo_root: "/fixture-docs-authority-ranking",
        snapshot_id: "snapshot-043",
        freshness: "fresh" as const,
        status: "usable" as const,
        document_count: 501
      };
    },
    async search() {
      return {
        status: "done" as const,
        repo_root: "/fixture-docs-authority-ranking",
        snapshot_id: "snapshot-043",
        freshness: "fresh" as const,
        hits: [docsHit(`docs/legacy/incomplete-${scenario.id}.md`)],
        truncated: true,
        cursor: `legacy-incomplete-${scenario.id}`,
        result_count: 1,
        result_count_basis: "page" as const,
        indexed_docs_count: 501
      };
    }
  };
}

function rankedUniverseProofHarness(): RankedUniverseHarness {
  const expectedFrozenOrder = [
    "docs/virtual/page-0001.md",
    "docs/virtual/page-0002.md",
    "docs/virtual/page-0003.md",
    "docs/virtual/page-0004.md"
  ];
  const candidateCalls: CandidateCall[] = [];
  const codecCalls: RankedUniverseHarness["codec_calls"] = [];
  const universeCalls: RankedUniverseHarness["universe_calls"] = [];
  const encoded = new Map<string, DocsRankingCursorPayload>();
  const universes = new Map<string, RankedDocsUniverseRecord>();
  const rankedHits = expectedFrozenOrder.map((hitPath, index) => rankedDocsHit(hitPath, index));
  const rankingCandidates: DocsRankingCandidateQueryPort = {
    async findFtsCandidates(input) {
      candidateCalls.push({ source: "fts", snapshot_id: input.snapshot_id, max_rows: input.max_rows });
      return {
        status: "exact" as const,
        candidates: rankedHits.map((hit) => ({
          stable_document_id: hit.path,
          hit,
          lexical_score: hit.lexical_score
        }))
      };
    },
    async findMatchedOwnerCandidates(input) {
      candidateCalls.push({ source: "owner", snapshot_id: input.snapshot_id, max_rows: input.max_rows });
      return { status: "exact" as const, candidates: [] };
    }
  };
  const rankingCursorCodec: DocsRankingCursorCodecPort = {
    encode(payload) {
      const cursor = `ranked-cursor-${payload.universe_id}-${payload.next_position}`;
      codecCalls.push({ operation: "encode", cursor });
      encoded.set(cursor, payload);
      return cursor;
    },
    decode(cursor) {
      codecCalls.push({ operation: "decode", cursor });
      const payload = encoded.get(cursor);
      return payload === undefined
        ? { ok: false, code: "invalid_cursor" }
        : { ok: true, payload };
    }
  };
  const rankedUniverses: RankedDocsUniversePort = {
    async put({ universe }) {
      universeCalls.push({ operation: "put", universe_id: universe.universe_id });
      universes.set(universe.universe_id, universe);
    },
    async get({ universe_id }) {
      universeCalls.push({ operation: "get", universe_id });
      return universes.get(universe_id) ?? null;
    },
    async delete({ universe_id }) {
      universes.delete(universe_id);
    },
    async purgeExpired() {
      return 0;
    }
  };
  return {
    expected_frozen_order: expectedFrozenOrder,
    ranking_candidates: rankingCandidates,
    ranking_cursor_codec: rankingCursorCodec,
    ranked_universes: rankedUniverses,
    candidate_calls: candidateCalls,
    codec_calls: codecCalls,
    universe_calls: universeCalls,
    docs_index: {
      async replaceSnapshotDocs() {},
      async getState() {
        return {
          repo_root: "/fixture-docs-authority-ranking",
          snapshot_id: "snapshot-043",
          freshness: "fresh" as const,
          status: "usable" as const,
          document_count: expectedFrozenOrder.length
        };
      },
      async search(input) {
        const firstPage = input.cursor === undefined;
        const paths = firstPage
          ? expectedFrozenOrder.slice(0, 2)
          : [expectedFrozenOrder[3]!, expectedFrozenOrder[2]!];
        return {
          status: "done" as const,
          repo_root: "/fixture-docs-authority-ranking",
          snapshot_id: "snapshot-043",
          freshness: "fresh" as const,
          hits: paths.map(docsHit),
          truncated: firstPage,
          cursor: firstPage ? "legacy-page-2" : undefined,
          result_count: paths.length,
          result_count_basis: "page" as const,
          indexed_docs_count: expectedFrozenOrder.length
        };
      }
    }
  };
}

async function runPagedSearch(harness: RankedUniverseHarness, query: string, cursor?: string) {
  return searchDocsWithRankingDependencies({
    request: {
      repo_root: "/fixture-docs-authority-ranking",
      query,
      max_results: 2,
      include_snippets: false,
      cursor
    },
    docs_index: harness.docs_index,
    ranking_candidates: harness.ranking_candidates,
    ranking_cursor_codec: harness.ranking_cursor_codec,
    ranked_universes: harness.ranked_universes,
    selected_snapshot_id: "snapshot-043",
    default_repo_root: "."
  });
}

function searchDocsWithRankingDependencies(input: FutureRankedSearchInput) {
  return searchDocs(input);
}

function rankingDependencies(input: { candidates: CandidateQueryHarness }): RankingDependencies {
  const harness = rankedUniverseProofHarness();
  return {
    ranking_candidates: input.candidates.port,
    ranking_cursor_codec: harness.ranking_cursor_codec,
    ranked_universes: harness.ranked_universes
  };
}

function candidateRequest() {
  return {
    snapshot_id: "snapshot-043",
    normalized_query: "overflow",
    max_rows: 501 as const
  };
}

function ownerRequest() {
  return {
    snapshot_id: "snapshot-043",
    concern_keys: ["overflow"],
    max_rows: 501 as const
  };
}

function cursorPayload(universeId: string): DocsRankingCursorPayload {
  return {
    version: DOCS_RANKING_CONTRACT_VERSION,
    universe_id: universeId,
    next_position: 2,
    snapshot_id: "snapshot-043",
    normalized_query: "frozen query",
    retrieval_bound: DOCS_RANKING_CANDIDATE_LIMIT,
    ranking_schema_version: DOCS_RANKING_SCHEMA_VERSION,
    ranking_policy_version: DOCS_RANKING_POLICY_VERSION
  };
}

function docsHit(hitPath: string): DocsSearchHit {
  return {
    path: hitPath,
    title: path.basename(hitPath, ".md"),
    score: 1,
    evidence_kinds: ["docs", "fts"],
    direct_read_caveat: "Fixture routing evidence."
  };
}

function rankedDocsHit(hitPath: string, index: number): RankedDocsSearchHit {
  return {
    ...docsHit(hitPath),
    doc_status: "current",
    authority: "canonical",
    authority_caveat: "Current fixture authority.",
    currency_state: "current",
    currency_caveats: [],
    lexical_score: 10 - index,
    candidate_source: "fts",
    concern_match_state: "no_match",
    matched_concerns: [],
    governing_owner_tier: "non_owner",
    final_rank_components: {
      relevance_band: "all_query_tokens_body",
      governing_owner_tier: "non_owner",
      authority_tier: "canonical",
      currency_tier: "current",
      lexical_score: 10 - index,
      normalized_path: hitPath,
      stable_document_id: hitPath
    },
    ranking_policy_version: DOCS_RANKING_POLICY_VERSION,
    ranking_reasons: ["Fixture final rank order."]
  };
}
