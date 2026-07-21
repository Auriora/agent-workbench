/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { searchRankedDocs } from "../../src/application/use-cases/query-docs.js";
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
  DocumentationConcernIndexPort,
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
    it(`candidate budget blocks ${scenario.id} with no hits or cursor`, async () => {
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
        documentation_concerns: noConcernIndex(),
        ranking_candidates: dependencies.ranking_candidates,
        ranking_cursor_codec: dependencies.ranking_cursor_codec,
        ranked_universes: dependencies.ranked_universes,
        selected_snapshot_id: "snapshot-043",
        default_repo_root: ".",
        now_iso8601: "2026-07-21T12:00:00.000Z",
        universe_id: `universe-${scenario.id}`
      });

      expect(candidates.calls).toEqual([
        { source: "fts", snapshot_id: "snapshot-043", max_rows: 501 },
        { source: "owner", snapshot_id: "snapshot-043", max_rows: 501 }
      ]);
      expect(result).toMatchObject({
        status: "blocked",
        hits: [],
        blocker: "candidate_universe_exceeds_limit",
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
      expect("cursor" in result).toBe(false);
      expect(result.next_actions[0]).toMatchObject({
        tool: "docs_search",
        args: { scope_path: "docs" }
      });
    });
  }

  for (const candidateCount of [0, 499, 500]) {
    it(`candidate budget completes a distinct union of ${candidateCount}`, async () => {
      const paths = Array.from({ length: candidateCount }, (_, index) => virtualId("budget", index));
      const harness = rankedUniverseProofHarness({ paths, seed: 23, equalLexicalScore: 5 });
      if (candidateCount > 0) configureOwnerUnion(harness, paths);
      const result = await runPagedSearch(harness, "frozen query", undefined, 50);
      expect(result.status).toBe(candidateCount === 0 ? "not_applicable" : "done");
      if (result.status === "blocked") throw new Error(`Unexpected candidate-budget block: ${result.blocker}`);
      expect(result.counts).toMatchObject({
        fts_candidate_documents_count: candidateCount === 0 ? 0 : candidateCount - 1,
        matched_owner_candidate_documents_count: candidateCount === 0 ? 0 : 2,
        candidate_union_documents_count: candidateCount,
        ranked_candidate_universe_count: candidateCount
      });
      expect(result.universe_id).toBe("universe-043");
      expect(harness.candidate_calls.map(({ source }) => source)).toEqual(["fts", "owner"]);
    });
  }

  it("cursor pages concatenate to the frozen first-page order", async () => {
    const harness = rankedUniverseProofHarness();
    const first = await runPagedSearch(harness, "frozen query");
    if (first.status === "blocked") throw new Error("Expected a complete first ranked page.");
    expect(first.cursor).toEqual(expect.any(String));
    const firstPageReads = {
      candidates: [...harness.candidate_calls],
      counts: [...harness.candidate_count_calls],
      concerns: [...harness.concern_calls],
      docs: [...harness.docs_state_calls]
    };
    const second = await runPagedSearch(harness, "frozen query", first.cursor);

    expect(harness.candidate_calls.map(({ source }) => source)).toEqual(["fts", "owner"]);
    expect(harness.universe_calls.map(({ operation }) => operation)).toEqual(["put", "get"]);
    expect(harness.codec_calls.map(({ operation }) => operation)).toEqual(["encode", "decode"]);
    expect(harness.candidate_calls).toEqual(firstPageReads.candidates);
    expect(harness.candidate_count_calls).toEqual(firstPageReads.counts);
    expect(harness.concern_calls).toEqual(firstPageReads.concerns);
    expect(harness.docs_state_calls).toEqual(firstPageReads.docs);
    expect([...first.hits, ...second.hits].map(({ path: hitPath }) => hitPath)).toEqual(
      harness.expected_frozen_order
    );
  });

  it("applies include_snippets independently on first and continuation pages without requerying", async () => {
    const includedFirstHarness = rankedUniverseProofHarness();
    const includedFirst = await runPagedSearch(includedFirstHarness, "frozen query", undefined, 2, true);
    if (includedFirst.status === "blocked") throw new Error("Expected complete first page.");
    expect(includedFirst.hits.every((hit) => hit.snippet !== undefined)).toBe(true);
    const excludedContinuation = await runPagedSearch(
      includedFirstHarness, "frozen query", includedFirst.cursor, 2, false
    );
    expect(excludedContinuation.hits.every((hit) => hit.snippet === undefined)).toBe(true);
    expect(includedFirstHarness.candidate_calls).toHaveLength(2);

    const excludedFirstHarness = rankedUniverseProofHarness();
    const excludedFirst = await runPagedSearch(excludedFirstHarness, "frozen query", undefined, 2, false);
    if (excludedFirst.status === "blocked") throw new Error("Expected complete first page.");
    expect(excludedFirst.hits.every((hit) => hit.snippet === undefined)).toBe(true);
    const includedContinuation = await runPagedSearch(
      excludedFirstHarness, "frozen query", excludedFirst.cursor, 2, true
    );
    expect(includedContinuation.hits.every((hit) => hit.snippet !== undefined)).toBe(true);
    expect(excludedFirstHarness.candidate_calls).toHaveLength(2);
  });

  it("rejects a cursor when normalized query identity changes", async () => {
    const harness = rankedUniverseProofHarness();
    const first = await runPagedSearch(harness, "frozen query");
    if (first.status === "blocked") throw new Error("Expected a complete first ranked page.");
    expect(first.cursor).toEqual(expect.any(String));
    const changed = await runPagedSearch(harness, "different query", first.cursor);

    expect(harness.codec_calls.map(({ operation }) => operation)).toEqual(["encode", "decode"]);
    expect(harness.universe_calls.map(({ operation }) => operation)).toEqual(["put"]);
    expect(changed).toMatchObject({
      status: "blocked",
      hits: []
    });
    expect("cursor" in changed).toBe(false);
  });

  it("rejects every rebound cursor identity component before universe access", async () => {
    const changes: Array<Partial<DocsRankingCursorPayload>> = [
      { snapshot_id: "snapshot-other" },
      { normalized_scope_path: "docs/other" },
      { retrieval_bound: 499 as 500 },
      { ranking_schema_version: 2 as 1 },
      { ranking_policy_version: "future-policy" as typeof DOCS_RANKING_POLICY_VERSION }
    ];
    for (const [index, change] of changes.entries()) {
      const harness = rankedUniverseProofHarness();
      const cursor = harness.ranking_cursor_codec.encode({
        ...cursorPayload(`tampered-${index}`),
        ...change
      });
      const result = await runPagedSearch(harness, "frozen query", cursor);
      expect(result).toMatchObject({ status: "blocked", blocker: "ranking_cursor_invalid", hits: [] });
      expect(result.next_actions[0]).toMatchObject({ tool: "docs_search", args: { query: "frozen query" } });
      expect(harness.universe_calls).toEqual([]);
      expect(harness.candidate_calls).toEqual([]);
      expect(harness.concern_calls).toEqual([]);
      expect(harness.docs_state_calls).toEqual([]);
    }
  });

  it("rejects an expired frozen-universe cursor without restarting", async () => {
    const harness = rankedUniverseProofHarness();
    const expiredCursor = harness.ranking_cursor_codec.encode(cursorPayload("expired-universe-043"));
    const expired = await runPagedSearch(harness, "frozen query", expiredCursor);

    expect(harness.codec_calls.map(({ operation }) => operation)).toEqual(["encode", "decode"]);
    expect(harness.universe_calls).toEqual([
      { operation: "get", universe_id: "expired-universe-043" }
    ]);
    expect(harness.candidate_calls).toEqual([]);
    expect(expired).toMatchObject({
      status: "blocked",
      hits: []
    });
    expect(expired.next_actions[0]).toMatchObject({ tool: "docs_search", args: { query: "frozen query" } });
    expect("cursor" in expired).toBe(false);
  });

  it("routes unavailable ranking evidence through repository status", async () => {
    const harness = rankedUniverseProofHarness();
    harness.documentation_concerns = {
      ...noConcernIndex(),
      async getDocumentationConcernIndexState({ snapshot_id }) {
        return { status: "ready", snapshot_id, state: "invalid", failure_reason: "map invalid" };
      }
    };
    const result = await runPagedSearch(harness, "frozen query");
    expect(result).toMatchObject({
      status: "blocked",
      trust_state: "blocked_ranking_unavailable",
      next_actions: [{ tool: "read_resource", args: { uri: "repo:///status" } }]
    });
  });

  it.each([
    { status: "ready", snapshot_id: "snapshot-043", state: "invalid", failure_reason: "map invalid" } as const,
    ...([
      "snapshot_not_found",
      "snapshot_not_published",
      "snapshot_schema_incompatible",
      "concern_index_state_missing",
      "concern_index_invalid"
    ] as const).map((reason) => ({ status: "unavailable" as const, snapshot_id: "snapshot-043", reason }))
  ])("blocks every unusable concern-index state without candidate results ($status)", async (concernState) => {
    const harness = rankedUniverseProofHarness();
    const calls: string[] = [];
    harness.documentation_concerns = {
      ...noConcernIndex(),
      async getDocumentationConcernIndexState() {
        calls.push("state");
        return concernState;
      },
      async listDocumentationConcernTerms() {
        calls.push("terms");
        return { status: "ready", snapshot_id: "snapshot-043", rows: [] };
      },
      async listDocumentationConcernOwners() {
        calls.push("owners");
        return { status: "ready", snapshot_id: "snapshot-043", rows: [] };
      }
    };

    const result = await runPagedSearch(harness, "frozen query");
    expect(result).toMatchObject({
      status: "blocked",
      blocker: "ranking_unavailable",
      trust_state: "blocked_ranking_unavailable",
      hits: []
    });
    expect(calls).toEqual(["state"]);
    expect(harness.candidate_calls).toEqual([]);
  });

  it.each(["state", "terms", "owners"] as const)(
    "blocks a %s snapshot mismatch before ranking candidates execute",
    async (mismatchAt) => {
      const harness = rankedUniverseProofHarness();
      const calls: string[] = [];
      harness.documentation_concerns = {
        ...noConcernIndex(),
        async getDocumentationConcernIndexState() {
          calls.push("state");
          return {
            status: "ready",
            snapshot_id: mismatchAt === "state" ? "snapshot-other" : "snapshot-043",
            state: "complete"
          };
        },
        async listDocumentationConcernTerms() {
          calls.push("terms");
          return {
            status: "ready",
            snapshot_id: mismatchAt === "terms" ? "snapshot-other" : "snapshot-043",
            rows: [{ concern_key: "frozen", normalized_term: "frozen query", token_count: 2 }]
          };
        },
        async listDocumentationConcernOwners() {
          calls.push("owners");
          return {
            status: "ready",
            snapshot_id: mismatchAt === "owners" ? "snapshot-other" : "snapshot-043",
            rows: []
          };
        }
      };

      const result = await runPagedSearch(harness, "frozen query");
      expect(result).toMatchObject({
        status: "blocked",
        blocker: "ranking_unavailable",
        trust_state: "blocked_ranking_unavailable",
        hits: []
      });
      expect(calls).toEqual(
        mismatchAt === "state" ? ["state"] : mismatchAt === "terms" ? ["state", "terms"] : ["state", "terms", "owners"]
      );
      expect(harness.candidate_calls).toEqual([]);
    }
  );

  it("keeps a same-snapshot no-map state usable", async () => {
    const harness = rankedUniverseProofHarness({ paths: [] });
    const calls: string[] = [];
    harness.documentation_concerns = noConcernIndex(calls);
    const result = await runPagedSearch(harness, "frozen query");

    expect(result.status).toBe("not_applicable");
    expect(calls).toEqual(["state", "terms", "owners"]);
    expect(harness.candidate_calls.map(({ source }) => source)).toEqual(["fts", "owner"]);
  });

  it("resolves a late term across more than 501 terms and loads only its owners from a larger global relation set", async () => {
    const harness = rankedUniverseProofHarness();
    const concernCalls: string[] = [];
    harness.documentation_concerns = largeConcernIndex(concernCalls);
    harness.ranking_candidates = {
      async countSearchableDocuments() {
        return { searchable_snapshot_documents_count: 1, searchable_scope_documents_count: 1 };
      },
      async findFtsCandidates() {
        return { status: "exact", candidates: [] };
      },
      async findMatchedOwnerCandidates(input) {
        expect(input.concern_keys).toEqual(["zz-late"]);
        const hit = docsHit("docs/late-owner.md");
        return {
          status: "exact",
          candidates: [{
            stable_document_id: hit.path,
            hit: { ...hit, evidence_kinds: ["docs"] },
            title_heading_text: hit.title,
            body_text: "governing behavior"
          }]
        };
      }
    };
    const result = await runPagedSearch(harness, "frozen query");
    expect(result.status).toBe("done");
    if (result.status === "blocked") throw new Error(`Unexpected large concern-index block: ${result.blocker}`);
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]).toMatchObject({
      path: "docs/late-owner.md",
      candidate_source: "matched_owner",
      governing_owner_tier: "valid_owner"
    });
    expect(concernCalls).toEqual(["state", "terms:all", "owners:zz-late"]);
  });

  for (const seed of [3, 17, 29]) {
    it(`preserves equal-tuple total order across insertion order, page sizes, and cursor positions (seed ${seed})`, async () => {
      const paths = Array.from({ length: 37 }, (_, index) => virtualId("property", 36 - index));
      for (const pageSize of [1, 7, 50]) {
        const harness = rankedUniverseProofHarness({ paths, seed, equalLexicalScore: 5 });
        const collected: string[] = [];
        let cursor: string | undefined;
        do {
          const page = await runPagedSearch(harness, "frozen query", cursor, pageSize);
          if (page.status === "blocked") throw new Error(`Unexpected blocked property page: ${page.blocker}`);
          collected.push(...page.hits.map(({ path: hitPath }) => hitPath));
          cursor = page.cursor;
        } while (cursor !== undefined);

        expect(collected).toEqual([...paths].sort());
        expect(new Set(collected).size).toBe(paths.length);
        expect(harness.candidate_calls.map(({ source }) => source)).toEqual(["fts", "owner"]);
        expect(harness.universe_calls[0]).toEqual({ operation: "put", universe_id: "universe-043" });
      }
    });
  }
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
  documentation_concerns: DocumentationConcernIndexPort;
  ranking_candidates: DocsRankingCandidateQueryPort;
  ranking_cursor_codec: DocsRankingCursorCodecPort;
  ranked_universes: RankedDocsUniversePort;
};

type FutureRankedSearchInput = Parameters<typeof searchRankedDocs>[0];

type RankedUniverseHarness = RankingDependencies & {
  docs_index: DocsIndexPort;
  expected_frozen_order: string[];
  candidate_calls: CandidateCall[];
  codec_calls: Array<{ operation: "encode" | "decode"; cursor?: string }>;
  universe_calls: Array<{ operation: "put" | "get"; universe_id: string }>;
  docs_state_calls: number[];
  candidate_count_calls: number[];
  concern_calls: string[];
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
          ...(source === "fts" ? { lexical_score: 1 } : {}),
          title_heading_text: stableDocumentId,
          body_text: stableDocumentId
        }))
      };
  return {
    calls,
    port: {
      async countSearchableDocuments() {
        return { searchable_snapshot_documents_count: 501, searchable_scope_documents_count: 501 };
      },
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

function rankedUniverseProofHarness(options: {
  paths?: string[];
  seed?: number;
  equalLexicalScore?: number;
} = {}): RankedUniverseHarness {
  const defaultPaths = [
    "docs/virtual/page-0001.md",
    "docs/virtual/page-0002.md",
    "docs/virtual/page-0003.md",
    "docs/virtual/page-0004.md"
  ];
  const sourcePaths = options.paths ?? defaultPaths;
  const expectedFrozenOrder = options.equalLexicalScore === undefined
    ? [...sourcePaths]
    : [...sourcePaths].sort();
  const candidateCalls: CandidateCall[] = [];
  const codecCalls: RankedUniverseHarness["codec_calls"] = [];
  const universeCalls: RankedUniverseHarness["universe_calls"] = [];
  const docsStateCalls: number[] = [];
  const candidateCountCalls: number[] = [];
  const concernCalls: string[] = [];
  const encoded = new Map<string, DocsRankingCursorPayload>();
  const universes = new Map<string, RankedDocsUniverseRecord>();
  const rankedHits = sourcePaths.map((hitPath, index) =>
    rankedDocsHit(hitPath, index, options.equalLexicalScore));
  const rankingCandidates: DocsRankingCandidateQueryPort = {
    async countSearchableDocuments() {
      candidateCountCalls.push(1);
      return {
        searchable_snapshot_documents_count: expectedFrozenOrder.length,
        searchable_scope_documents_count: expectedFrozenOrder.length
      };
    },
    async findFtsCandidates(input) {
      candidateCalls.push({ source: "fts", snapshot_id: input.snapshot_id, max_rows: input.max_rows });
      return {
        status: "exact" as const,
        candidates: seededShuffle(rankedHits, options.seed ?? 1).map((hit) => ({
          stable_document_id: hit.path,
          hit,
          lexical_score: hit.lexical_score,
          title_heading_text: hit.title,
          body_text: hit.path
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
    documentation_concerns: noConcernIndex(concernCalls),
    ranking_candidates: rankingCandidates,
    ranking_cursor_codec: rankingCursorCodec,
    ranked_universes: rankedUniverses,
    candidate_calls: candidateCalls,
    codec_calls: codecCalls,
    universe_calls: universeCalls,
    docs_state_calls: docsStateCalls,
    candidate_count_calls: candidateCountCalls,
    concern_calls: concernCalls,
    docs_index: {
      async replaceSnapshotDocs() {},
      async getState() {
        docsStateCalls.push(1);
        return {
          repo_root: "/fixture-docs-authority-ranking",
          snapshot_id: "snapshot-043",
          freshness: "fresh" as const,
          status: "usable" as const,
          document_count: expectedFrozenOrder.length
        };
      },
      async search(input) {
        throw new Error(`Legacy docs search must not run for frozen pagination: ${input.query}`);
      }
    }
  };
}

async function runPagedSearch(
  harness: RankedUniverseHarness,
  query: string,
  cursor?: string,
  pageSize = 2,
  includeSnippets = false
) {
  return searchDocsWithRankingDependencies({
    request: {
      repo_root: "/fixture-docs-authority-ranking",
      query,
      max_results: pageSize,
      include_snippets: includeSnippets,
      cursor
    },
    docs_index: harness.docs_index,
    documentation_concerns: harness.documentation_concerns,
    ranking_candidates: harness.ranking_candidates,
    ranking_cursor_codec: harness.ranking_cursor_codec,
    ranked_universes: harness.ranked_universes,
    selected_snapshot_id: "snapshot-043",
    default_repo_root: ".",
    now_iso8601: "2026-07-21T12:00:00.000Z",
    universe_id: "universe-043"
  });
}

function searchDocsWithRankingDependencies(input: FutureRankedSearchInput) {
  return searchRankedDocs(input);
}

function rankingDependencies(input: { candidates: CandidateQueryHarness }): RankingDependencies {
  const harness = rankedUniverseProofHarness();
  return {
    documentation_concerns: noConcernIndex(),
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
    normalized_query: "overflow",
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
    snippet: `Bounded snippet for ${hitPath}.`,
    score: 1,
    evidence_kinds: ["docs", "fts"],
    direct_read_caveat: "Fixture routing evidence.",
    doc_status: "current",
    authority: "canonical",
    currency_state: "current",
    currency_caveats: []
  };
}

function noConcernIndex(calls: string[] = []): DocumentationConcernIndexPort {
  return {
    async replaceSnapshotDocumentationConcerns() {},
    async getDocumentationConcernIndexState({ snapshot_id }) {
      calls.push("state");
      return { status: "ready", snapshot_id, state: "no_map" };
    },
    async listDocumentationConcernTerms({ snapshot_id }) {
      calls.push("terms");
      return { status: "ready", snapshot_id, rows: [] };
    },
    async listDocumentationConcernOwners({ snapshot_id }) {
      calls.push("owners");
      return { status: "ready", snapshot_id, rows: [] };
    }
  };
}

function largeConcernIndex(calls: string[]): DocumentationConcernIndexPort {
  const unrelatedTerms = Array.from({ length: 501 }, (_, index) => ({
    concern_key: `unrelated-${String(index).padStart(3, "0")}`,
    normalized_term: `unrelated ${index}`,
    token_count: 2
  }));
  const globalOwners = [
    ...unrelatedTerms.map((term, index) => ({
      concern_key: term.concern_key,
      mapped_owner_path: `docs/unrelated/${index}.md`,
      document_id: `docs/unrelated/${index}.md`,
      owner_state: "valid" as const,
      source_line: index + 1
    })),
    {
      concern_key: "zz-late",
      mapped_owner_path: "docs/late-owner.md",
      document_id: "docs/late-owner.md",
      owner_state: "valid" as const,
      source_line: 700
    }
  ];
  return {
    async replaceSnapshotDocumentationConcerns() {},
    async getDocumentationConcernIndexState({ snapshot_id }) {
      calls.push("state");
      return { status: "ready", snapshot_id, state: "complete" };
    },
    async listDocumentationConcernTerms({ snapshot_id, max_rows }) {
      calls.push(`terms:${max_rows === undefined ? "all" : max_rows}`);
      return {
        status: "ready",
        snapshot_id,
        rows: [...unrelatedTerms, { concern_key: "zz-late", normalized_term: "frozen query", token_count: 2 }]
      };
    },
    async listDocumentationConcernOwners({ snapshot_id, concern_keys, max_rows }) {
      calls.push(`owners:${(concern_keys ?? []).join(",")}${max_rows === undefined ? "" : `:${max_rows}`}`);
      const selected = concern_keys === undefined
        ? globalOwners
        : globalOwners.filter(({ concern_key }) => concern_keys.includes(concern_key));
      return { status: "ready", snapshot_id, rows: selected };
    }
  };
}

function configureOwnerUnion(harness: RankedUniverseHarness, paths: readonly string[]): void {
  const ftsPaths = paths.slice(0, -1);
  const ownerPaths = [ftsPaths[0]!, paths.at(-1)!];
  harness.documentation_concerns = {
    async replaceSnapshotDocumentationConcerns() {},
    async getDocumentationConcernIndexState({ snapshot_id }) {
      return { status: "ready", snapshot_id, state: "complete" };
    },
    async listDocumentationConcernTerms({ snapshot_id }) {
      return {
        status: "ready",
        snapshot_id,
        rows: [{ concern_key: "frozen", normalized_term: "frozen query", token_count: 2 }]
      };
    },
    async listDocumentationConcernOwners({ snapshot_id, concern_keys }) {
      expect(concern_keys).toEqual(["frozen"]);
      return {
        status: "ready",
        snapshot_id,
        rows: ownerPaths.map((document_id, index) => ({
          concern_key: "frozen",
          mapped_owner_path: document_id,
          document_id,
          owner_state: "valid" as const,
          source_line: index + 1
        }))
      };
    }
  };
  harness.ranking_candidates = {
    async countSearchableDocuments() {
      return {
        searchable_snapshot_documents_count: paths.length,
        searchable_scope_documents_count: paths.length
      };
    },
    async findFtsCandidates(input) {
      harness.candidate_calls.push({ source: "fts", snapshot_id: input.snapshot_id, max_rows: input.max_rows });
      return {
        status: "exact",
        candidates: seededShuffle(ftsPaths, 71).map((stable_document_id) => ({
          stable_document_id,
          hit: docsHit(stable_document_id),
          lexical_score: 5,
          title_heading_text: stable_document_id,
          body_text: stable_document_id
        }))
      };
    },
    async findMatchedOwnerCandidates(input) {
      harness.candidate_calls.push({ source: "owner", snapshot_id: input.snapshot_id, max_rows: input.max_rows });
      return {
        status: "exact",
        candidates: [...ownerPaths].reverse().map((stable_document_id) => ({
          stable_document_id,
          hit: { ...docsHit(stable_document_id), evidence_kinds: ["docs"] },
          title_heading_text: stable_document_id,
          body_text: stable_document_id
        }))
      };
    }
  };
}

function rankedDocsHit(hitPath: string, index: number, lexicalScore = 10 - index): RankedDocsSearchHit {
  return {
    ...docsHit(hitPath),
    doc_status: "current",
    authority: "canonical",
    authority_caveat: "Current fixture authority.",
    currency_state: "current",
    currency_caveats: [],
    lexical_score: lexicalScore,
    candidate_source: "fts",
    concern_match_state: "no_match",
    matched_concerns: [],
    governing_owner_tier: "non_owner",
    final_rank_components: {
      relevance_band: "all_query_tokens_body",
      governing_owner_tier: "non_owner",
      authority_tier: "canonical",
      currency_tier: "current",
      lexical_score: lexicalScore,
      normalized_path: hitPath,
      stable_document_id: hitPath
    },
    ranking_policy_version: DOCS_RANKING_POLICY_VERSION,
    ranking_reasons: ["Fixture final rank order."]
  };
}
