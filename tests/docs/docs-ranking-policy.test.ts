/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import {
  rankedDocsSearchHitSchema,
  type DocsFinalRankComponents,
  type DocsSearchHit
} from "../../src/contracts/index.js";
import {
  compareDocsFinalRankComponents,
  governingOwnerTierForStates,
  ownershipCaveat,
  rankDocumentationCandidates,
  resolveDocumentationConcerns,
  type DocsRankingPolicyCandidate
} from "../../src/domain/policies/index.js";

describe("documentation ranking policy fixture", () => {
  for (const seed of [1, 7, 19, 41, 73]) {
    it(`orders every relevance band through the production ranker independent of insertion order (seed ${seed})`, () => {
      const resolution = resolveDocumentationConcerns({
        query: "runtime contract",
        terms: [{ concern_key: "runtime", normalized_term: "runtime", token_count: 1 }],
        owners: [ownerRow("runtime", "docs/4-intent.md", "valid")]
      });
      const candidates = [
        candidate({ path: "docs/1-exact.md", score: 1, lexicalScore: 1, titleHeadingText: "runtime contract", bodyText: "", authority: "canonical", currency: "current" }),
        candidate({ path: "docs/2-title.md", score: 1, lexicalScore: 1, titleHeadingText: "contract for runtime", bodyText: "", authority: "canonical", currency: "current" }),
        candidate({ path: "docs/3-body.md", score: 1, lexicalScore: 1, titleHeadingText: "other", bodyText: "contract for runtime", authority: "canonical", currency: "current" }),
        candidate({ path: "docs/4-intent.md", score: 1, titleHeadingText: "other", bodyText: "other", authority: "canonical", currency: "current" }),
        candidate({ path: "docs/5-partial.md", score: 1, lexicalScore: 1, titleHeadingText: "runtime", bodyText: "runtime", authority: "canonical", currency: "current" })
      ];

      const ranked = rankDocumentationCandidates({
        query: "runtime contract",
        concern_resolution: resolution,
        candidates: seededShuffle(candidates, seed)
      });
      expect(ranked.map(({ final_rank_components }) => final_rank_components.relevance_band)).toEqual([
        "exact_document_phrase",
        "all_query_tokens_title_or_heading",
        "all_query_tokens_body",
        "intent_owner_match",
        "partial_fts_match"
      ]);
      expect(ranked.map(({ path: hitPath }) => hitPath)).toEqual([
        "docs/1-exact.md",
        "docs/2-title.md",
        "docs/3-body.md",
        "docs/4-intent.md",
        "docs/5-partial.md"
      ]);
    });
  }

  it("exhausts the remaining production tuple tiers in their fixed comparison order", () => {
    const base = rankComponents();
    expect(sortedComponentValues([
      { ...base, governing_owner_tier: "invalid_conflicting_owner" },
      { ...base, governing_owner_tier: "non_owner" },
      { ...base, governing_owner_tier: "valid_owner" },
      { ...base, governing_owner_tier: "invalid_owner" }
    ], "governing_owner_tier")).toEqual([
      "valid_owner", "non_owner", "invalid_owner", "invalid_conflicting_owner"
    ]);
    expect(sortedComponentValues([
      { ...base, authority_tier: "non_authoritative" },
      { ...base, authority_tier: "canonical" },
      { ...base, authority_tier: "supporting" }
    ], "authority_tier")).toEqual(["canonical", "supporting", "non_authoritative"]);
    expect(sortedComponentValues([
      { ...base, currency_tier: "superseded" },
      { ...base, currency_tier: "stale" },
      { ...base, currency_tier: "current" },
      { ...base, currency_tier: "historical" },
      { ...base, currency_tier: "unknown" }
    ], "currency_tier")).toEqual(["current", "unknown", "stale", "historical", "superseded"]);
    expect([
      { ...base, lexical_score: undefined, stable_document_id: "absent" },
      { ...base, lexical_score: 1, stable_document_id: "low" },
      { ...base, lexical_score: 8, stable_document_id: "high" }
    ].sort(compareDocsFinalRankComponents).map(({ stable_document_id }) => stable_document_id))
      .toEqual(["high", "low", "absent"]);
  });

  it("resolves all exact concerns and admits an owner-only candidate with truthful evidence", () => {
    const resolution = resolveDocumentationConcerns({
      query: "SessionStart behavior and graph schema",
      terms: [
        { concern_key: "graph-schema", normalized_term: "graph schema", token_count: 2 },
        { concern_key: "coding-agent-integrations", normalized_term: "sessionstart", token_count: 1 }
      ],
      owners: [
        ownerRow("coding-agent-integrations", "docs/design/coding-agent-integration-design.md", "valid"),
        ownerRow("graph-schema", "docs/design/graph-store-design.md", "draft")
      ]
    });
    const [ranked] = rankDocumentationCandidates({
      query: "SessionStart behavior and graph schema",
      concern_resolution: resolution,
      candidates: [candidate({
        path: "docs/design/coding-agent-integration-design.md",
        score: 7,
        titleHeadingText: "Coding-agent integration design",
        bodyText: "Session hooks",
        authority: "canonical",
        currency: "current"
      })]
    });

    expect(rankedDocsSearchHitSchema.parse(ranked)).toMatchObject({
      score: 7,
      candidate_source: "matched_owner",
      concern_match_state: "matched",
      governing_owner_tier: "valid_owner",
      final_rank_components: {
        relevance_band: "intent_owner_match",
        stable_document_id: "docs/design/coding-agent-integration-design.md"
      },
      ranking_policy_version: "authority-aware-v1"
    });
    expect(ranked).not.toHaveProperty("lexical_score");
    expect(ranked?.matched_concerns.map(({ concern_key }) => concern_key)).toEqual([
      "graph-schema",
      "coding-agent-integrations"
    ]);
    expect(ranked?.ranking_reasons.join(" ")).toContain("Legacy aggregate score preserved: 7");
    expect(ranked?.ranking_reasons.join(" ")).toContain("Lexical score: absent");
  });

  it("applies relevance before ownership and authority, then preserves raw lexical ordering", () => {
    const resolution = resolveDocumentationConcerns({
      query: "sessionstart behavior",
      terms: [{ concern_key: "integrations", normalized_term: "sessionstart", token_count: 1 }],
      owners: [ownerRow("integrations", "docs/design/owner.md", "valid")]
    });
    const ranked = rankDocumentationCandidates({
      query: "sessionstart behavior",
      concern_resolution: resolution,
      candidates: [
        candidate({
          path: "docs/design/owner.md",
          score: 1,
          lexicalScore: 4,
          titleHeadingText: "Integration design",
          bodyText: "sessionstart",
          authority: "canonical",
          currency: "current"
        }),
        candidate({
          path: "docs/runbooks/exact.md",
          score: 999,
          lexicalScore: 2,
          titleHeadingText: "SessionStart behavior",
          bodyText: "",
          authority: "supporting",
          currency: "stale"
        }),
        candidate({
          path: "docs/runbooks/body-high.md",
          score: 999,
          lexicalScore: 40,
          titleHeadingText: "Runbook",
          bodyText: "sessionstart behavior",
          authority: "supporting",
          currency: "current"
        }),
        candidate({
          path: "docs/runbooks/body-low.md",
          score: 1,
          lexicalScore: 3,
          titleHeadingText: "Runbook",
          bodyText: "behavior around sessionstart",
          authority: "supporting",
          currency: "current"
        })
      ]
    });

    expect(ranked.map(({ path: hitPath }) => hitPath)).toEqual([
      "docs/runbooks/exact.md",
      "docs/runbooks/body-high.md",
      "docs/runbooks/body-low.md",
      "docs/design/owner.md"
    ]);
    expect(ranked[1]?.score).toBe(999);
    expect(ranked[1]?.lexical_score).toBe(40);
    expect(ranked[3]?.candidate_source).toBe("fts_and_matched_owner");
    expect(ranked[3]?.final_rank_components.relevance_band).toBe("intent_owner_match");
  });

  it("lets ownership and authority govern only within an established relevance band", () => {
    const resolution = resolveDocumentationConcerns({
      query: "sessionstart behavior",
      terms: [{ concern_key: "integrations", normalized_term: "sessionstart", token_count: 1 }],
      owners: [ownerRow("integrations", "docs/design/owner.md", "valid")]
    });
    const ranked = rankDocumentationCandidates({
      query: "sessionstart behavior",
      concern_resolution: resolution,
      candidates: [
        candidate({
          path: "docs/design/owner.md",
          score: 1,
          lexicalScore: 1,
          titleHeadingText: "SessionStart behavior",
          bodyText: "",
          authority: "canonical",
          currency: "current"
        }),
        candidate({
          path: "docs/runbooks/high-lexical.md",
          score: 999,
          lexicalScore: 999,
          titleHeadingText: "SessionStart behavior",
          bodyText: "",
          authority: "supporting",
          currency: "current"
        }),
        candidate({
          path: "docs/design/canonical-non-owner.md",
          score: 2,
          lexicalScore: 2,
          titleHeadingText: "SessionStart behavior",
          bodyText: "",
          authority: "canonical",
          currency: "current"
        })
      ]
    });

    expect(ranked.map(({ path: hitPath }) => hitPath)).toEqual([
      "docs/design/owner.md",
      "docs/design/canonical-non-owner.md",
      "docs/runbooks/high-lexical.md"
    ]);
  });

  it("maps every owner state to its fixed tier and bounded governance caveat", () => {
    expect(governingOwnerTierForStates(["valid"])).toBe("valid_owner");
    expect(governingOwnerTierForStates(["draft"])).toBe("valid_owner");
    expect(governingOwnerTierForStates(["archived"])).toBe("invalid_owner");
    expect(governingOwnerTierForStates(["superseded"])).toBe("invalid_owner");
    expect(governingOwnerTierForStates(["missing"])).toBe("invalid_owner");
    expect(governingOwnerTierForStates(["conflicting"])).toBe("invalid_conflicting_owner");
    expect(governingOwnerTierForStates(["conflicting", "valid"])).toBe("valid_owner");
    expect(governingOwnerTierForStates([])).toBe("non_owner");

    const evidence = [
      { path: "valid.md", state: "valid" as const, document_id: "valid.md" },
      { path: "draft.md", state: "draft" as const, document_id: "draft.md" },
      { path: "missing.md", state: "missing" as const },
      { path: "archived.md", state: "archived" as const, document_id: "archived.md" },
      {
        path: "superseded.md",
        state: "superseded" as const,
        document_id: "superseded.md",
        superseded_by: "current.md"
      },
      {
        path: "conflicting.md",
        state: "conflicting" as const,
        document_id: "conflicting.md",
        declared_canonical_owner: "current.md"
      }
    ];
    expect(evidence.map(ownershipCaveat)).toEqual([
      undefined,
      expect.stringContaining("draft"),
      expect.stringContaining("missing"),
      expect.stringContaining("archived"),
      expect.stringContaining("current.md"),
      expect.stringContaining("current.md")
    ]);
  });

  it("uses normalized path and stable identity as the final deterministic tie breakers", () => {
    const base = {
      relevance_band: "partial_fts_match" as const,
      governing_owner_tier: "non_owner" as const,
      authority_tier: "supporting" as const,
      currency_tier: "unknown" as const,
      lexical_score: 1
    };
    const left = { ...base, normalized_path: "docs/a.md", stable_document_id: "docs/z.md" };
    const right = { ...base, normalized_path: "docs/b.md", stable_document_id: "docs/a.md" };
    expect(compareDocsFinalRankComponents(left, right)).toBeLessThan(0);
    expect(compareDocsFinalRankComponents(
      { ...left, normalized_path: "docs/a.md", stable_document_id: "docs/a.md" },
      { ...left, normalized_path: "docs/a.md", stable_document_id: "docs/b.md" }
    )).toBeLessThan(0);
  });

  it("totally orders canonically equivalent Unicode path spellings independent of insertion order", () => {
    const resolution = resolveDocumentationConcerns({ query: "runtime", terms: [], owners: [] });
    const decomposed = candidate({
      path: "docs/e\u0301.md",
      score: 1,
      lexicalScore: 1,
      titleHeadingText: "runtime",
      bodyText: "",
      authority: "canonical",
      currency: "current"
    });
    const composed = candidate({
      path: "docs/é.md",
      score: 1,
      lexicalScore: 1,
      titleHeadingText: "runtime",
      bodyText: "",
      authority: "canonical",
      currency: "current"
    });
    const expected = ["docs/e\u0301.md", "docs/é.md"];

    expect(rankDocumentationCandidates({
      query: "runtime",
      concern_resolution: resolution,
      candidates: [decomposed, composed]
    }).map(({ path: hitPath }) => hitPath)).toEqual(expected);
    expect(rankDocumentationCandidates({
      query: "runtime",
      concern_resolution: resolution,
      candidates: [composed, decomposed]
    }).map(({ path: hitPath }) => hitPath)).toEqual(expected);
    expect(compareDocsFinalRankComponents(
      rankDocumentationCandidates({ query: "runtime", concern_resolution: resolution, candidates: [decomposed] })[0]!
        .final_rank_components,
      rankDocumentationCandidates({ query: "runtime", concern_resolution: resolution, candidates: [composed] })[0]!
        .final_rank_components
    )).not.toBe(0);
  });

});

function candidate(input: {
  path: string;
  score: number;
  lexicalScore?: number;
  titleHeadingText: string;
  bodyText: string;
  authority: "canonical" | "supporting" | "non_authoritative";
  currency: "current" | "stale" | "superseded" | "historical" | "unknown";
}): DocsRankingPolicyCandidate {
  const hit: DocsSearchHit & {
    authority: typeof input.authority;
    currency_state: typeof input.currency;
  } = {
    path: input.path,
    title: input.path,
    score: input.score,
    evidence_kinds: input.lexicalScore === undefined ? ["docs"] : ["docs", "fts"],
    direct_read_caveat: "Routing evidence only.",
    doc_status: input.authority === "canonical" ? "current" : "draft",
    authority: input.authority,
    currency_state: input.currency
  };
  return {
    stable_document_id: input.path,
    hit,
    ...(input.lexicalScore === undefined ? {} : { lexical_score: input.lexicalScore }),
    title_heading_text: input.titleHeadingText,
    body_text: input.bodyText
  };
}

function ownerRow(
  concernKey: string,
  ownerPath: string,
  state: "valid" | "draft" | "missing" | "archived" | "superseded" | "conflicting"
) {
  return {
    concern_key: concernKey,
    mapped_owner_path: ownerPath,
    ...(state === "missing" ? {} : { document_id: ownerPath }),
    owner_state: state
  };
}

function rankComponents(): DocsFinalRankComponents {
  return {
    relevance_band: "exact_document_phrase",
    governing_owner_tier: "valid_owner",
    authority_tier: "canonical",
    currency_tier: "current",
    lexical_score: 1,
    normalized_path: "docs/same.md",
    stable_document_id: "docs/same.md"
  };
}

function sortedComponentValues<Key extends keyof DocsFinalRankComponents>(
  values: DocsFinalRankComponents[],
  key: Key
): Array<DocsFinalRankComponents[Key]> {
  return values.sort(compareDocsFinalRankComponents).map((value) => value[key]);
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
