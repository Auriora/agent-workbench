/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  DOCS_RANKING_POLICY_VERSION,
  type DocsCandidateSource,
  type DocsFinalRankComponents,
  type DocsGoverningOwnerTier,
  type DocsRankingCandidate,
  type DocsRelevanceBand,
  type DocumentAuthority,
  type DocumentCurrencyState,
  type DocumentationConcernOwnerEvidence,
  type DocumentationConcernOwnerState,
  type RankedDocsSearchHit
} from "../../contracts/index.js";
import {
  normalizeDocumentationConcern,
  type DocumentationConcernResolution
} from "./document-concern.js";

export type DocsRankingPolicyCandidate = Omit<DocsRankingCandidate, "hit"> & {
  hit: DocsRankingCandidate["hit"] & {
    authority: DocumentAuthority;
    currency_state: DocumentCurrencyState;
  };
};

const RELEVANCE_ORDER: Record<DocsRelevanceBand, number> = {
  exact_document_phrase: 0,
  all_query_tokens_title_or_heading: 1,
  all_query_tokens_body: 2,
  intent_owner_match: 3,
  partial_fts_match: 4
};

const OWNER_ORDER: Record<DocsGoverningOwnerTier, number> = {
  valid_owner: 0,
  non_owner: 1,
  invalid_owner: 2,
  invalid_conflicting_owner: 3
};

const AUTHORITY_ORDER: Record<DocumentAuthority, number> = {
  canonical: 0,
  supporting: 1,
  non_authoritative: 2
};

const CURRENCY_ORDER: Record<DocumentCurrencyState, number> = {
  current: 0,
  unknown: 1,
  stale: 2,
  historical: 3,
  superseded: 4
};

export function rankDocumentationCandidates(input: {
  query: string;
  concern_resolution: DocumentationConcernResolution;
  candidates: readonly DocsRankingPolicyCandidate[];
}): RankedDocsSearchHit[] {
  const normalizedQuery = normalizeDocumentationConcern(input.query);
  if (normalizedQuery !== input.concern_resolution.normalized_query) {
    throw new Error("Ranking query must match the concern resolver's normalized query.");
  }
  const queryTokens = input.concern_resolution.query_tokens;
  return input.candidates.map((candidate) => rankCandidate({
    candidate,
    resolution: input.concern_resolution,
    normalizedQuery,
    queryTokens
  })).sort((left, right) => compareDocsFinalRankComponents(
    left.final_rank_components,
    right.final_rank_components
  ));
}

export function compareDocsFinalRankComponents(
  left: DocsFinalRankComponents,
  right: DocsFinalRankComponents
): number {
  return RELEVANCE_ORDER[left.relevance_band] - RELEVANCE_ORDER[right.relevance_band] ||
    OWNER_ORDER[left.governing_owner_tier] - OWNER_ORDER[right.governing_owner_tier] ||
    AUTHORITY_ORDER[left.authority_tier] - AUTHORITY_ORDER[right.authority_tier] ||
    CURRENCY_ORDER[left.currency_tier] - CURRENCY_ORDER[right.currency_tier] ||
    compareOptionalDescending(left.lexical_score, right.lexical_score) ||
    compareOrdinal(left.normalized_path, right.normalized_path) ||
    compareOrdinal(left.stable_document_id, right.stable_document_id);
}

export function governingOwnerTierForStates(
  states: readonly DocumentationConcernOwnerState[]
): DocsGoverningOwnerTier {
  if (states.some((state) => state === "valid" || state === "draft")) return "valid_owner";
  if (states.includes("conflicting")) return "invalid_conflicting_owner";
  if (states.length > 0) return "invalid_owner";
  return "non_owner";
}

export function ownershipCaveat(owner: DocumentationConcernOwnerEvidence): string | undefined {
  switch (owner.state) {
    case "valid":
      return undefined;
    case "draft":
      return `Mapped owner ${owner.path} is draft; direct-read and verify accepted direction.`;
    case "missing":
      return `Mapped owner ${owner.path} is missing from the selected snapshot.`;
    case "archived":
      return `Mapped owner ${owner.path} is archived and is not valid governing authority.`;
    case "superseded":
      if (owner.superseded_by === undefined) {
        throw new Error(`Superseded owner ${owner.path} lacks superseded_by evidence.`);
      }
      return `Mapped owner ${owner.path} is superseded by ${owner.superseded_by}.`;
    case "conflicting":
      if (owner.declared_canonical_owner === undefined) {
        throw new Error(`Conflicting owner ${owner.path} lacks declared canonical-owner evidence.`);
      }
      return `Mapped owner ${owner.path} conflicts with declared canonical owner ${owner.declared_canonical_owner}.`;
  }
}

function rankCandidate(input: {
  candidate: DocsRankingPolicyCandidate;
  resolution: DocumentationConcernResolution;
  normalizedQuery: string;
  queryTokens: readonly string[];
}): RankedDocsSearchHit {
  const candidate = input.candidate;
  const relatedOwners = input.resolution.matches.flatMap((match) =>
    match.owners.filter((owner) =>
      owner.document_id === candidate.stable_document_id && owner.path === candidate.stable_document_id
    )
  );
  const ownedConcernKeys = [...new Set(input.resolution.matches
    .filter((match) => match.owners.some((owner) =>
      owner.document_id === candidate.stable_document_id && owner.path === candidate.stable_document_id
    ))
    .map(({ concern_key }) => concern_key))].sort(compareOrdinal);
  const isMatchedOwner = relatedOwners.length > 0;
  const isFts = candidate.lexical_score !== undefined;
  if (candidate.lexical_score !== undefined && !Number.isFinite(candidate.lexical_score)) {
    throw new Error(`Ranking candidate ${candidate.stable_document_id} has a non-finite lexical score.`);
  }
  if (!isMatchedOwner && !isFts) {
    throw new Error(`Ranking candidate ${candidate.stable_document_id} has neither FTS nor matched-owner evidence.`);
  }
  const candidateSource: DocsCandidateSource = isFts
    ? isMatchedOwner ? "fts_and_matched_owner" : "fts"
    : "matched_owner";
  const ownerTier = governingOwnerTierForStates(relatedOwners.map(({ state }) => state));
  const relevanceBand = relevanceBandForCandidate({
    queryTokens: input.queryTokens,
    titleHeadingText: candidate.title_heading_text,
    bodyText: candidate.body_text,
    isFts,
    isMatchedOwner
  });
  const finalRankComponents: DocsFinalRankComponents = {
    relevance_band: relevanceBand,
    governing_owner_tier: ownerTier,
    authority_tier: candidate.hit.authority,
    currency_tier: candidate.hit.currency_state,
    ...(candidate.lexical_score === undefined ? {} : { lexical_score: candidate.lexical_score }),
    normalized_path: candidate.hit.path,
    stable_document_id: candidate.stable_document_id
  };
  return {
    ...candidate.hit,
    ...(candidate.lexical_score === undefined ? {} : { lexical_score: candidate.lexical_score }),
    candidate_source: candidateSource,
    concern_match_state: input.resolution.concern_match_state,
    matched_concerns: input.resolution.matches,
    governing_owner_tier: ownerTier,
    final_rank_components: finalRankComponents,
    ranking_policy_version: DOCS_RANKING_POLICY_VERSION,
    ranking_reasons: rankingReasons({
      normalizedQuery: input.normalizedQuery,
      matches: input.resolution.matches,
      relatedOwners,
      ownedConcernKeys,
      candidateSource,
      relevanceBand,
      authority: candidate.hit.authority,
      currency: candidate.hit.currency_state,
      legacyScore: candidate.hit.score,
      lexicalScore: candidate.lexical_score,
      normalizedPath: candidate.hit.path,
      stableDocumentId: candidate.stable_document_id
    })
  };
}

function relevanceBandForCandidate(input: {
  queryTokens: readonly string[];
  titleHeadingText: string;
  bodyText: string;
  isFts: boolean;
  isMatchedOwner: boolean;
}): DocsRelevanceBand {
  const titleHeadingTokens = normalizedTokens(input.titleHeadingText);
  const bodyTokens = normalizedTokens(input.bodyText);
  if (input.isFts && input.queryTokens.length > 0 && containsPhrase(titleHeadingTokens, input.queryTokens)) {
    return "exact_document_phrase";
  }
  if (input.isFts && allTokensPresent(input.queryTokens, titleHeadingTokens)) {
    return "all_query_tokens_title_or_heading";
  }
  if (input.isFts && allTokensPresent(input.queryTokens, bodyTokens)) {
    return "all_query_tokens_body";
  }
  if (input.isMatchedOwner) return "intent_owner_match";
  return "partial_fts_match";
}

function rankingReasons(input: {
  normalizedQuery: string;
  matches: DocumentationConcernResolution["matches"];
  relatedOwners: readonly DocumentationConcernOwnerEvidence[];
  ownedConcernKeys: readonly string[];
  candidateSource: DocsCandidateSource;
  relevanceBand: DocsRelevanceBand;
  authority: DocumentAuthority;
  currency: DocumentCurrencyState;
  legacyScore: number;
  lexicalScore?: number;
  normalizedPath: string;
  stableDocumentId: string;
}): string[] {
  const matchedTerms = [...new Set(input.matches.map((match) =>
    `${match.concern_key}:${match.normalized_term}[${match.query_token_start},${match.query_token_end_exclusive})`
  ))];
  const caveats = input.relatedOwners.map(ownershipCaveat).filter((value): value is string => value !== undefined);
  return [
    input.matches.length === 0
      ? `Exact concern resolution found no match for normalized query '${input.normalizedQuery}'.`
      : `Exact concern matches: ${summarize(matchedTerms)}.`,
    `Candidate source: ${input.candidateSource}.`,
    input.relatedOwners.length === 0
      ? "Governing owner tier: non_owner; no matched concern owns this document."
      : `Governing owner evidence: ${summarize(input.relatedOwners.map(({ path, state }) => `${path}:${state}`))}.`,
    ...(input.ownedConcernKeys.length === 0
      ? []
      : [`Owned matched concerns: ${summarize(input.ownedConcernKeys)}.`]),
    ...(caveats.length === 0 ? [] : [`Ownership caveats: ${summarize(caveats)}`]),
    `Relevance band: ${input.relevanceBand}.`,
    `Authority tier: ${input.authority}.`,
    `Currency tier: ${input.currency}.`,
    `Legacy aggregate score preserved: ${input.legacyScore}.`,
    input.lexicalScore === undefined
      ? "Lexical score: absent for matched-owner-only candidate."
      : `Raw FTS lexical score: ${input.lexicalScore}.`,
    `Stable tie-breakers: normalized path '${input.normalizedPath}', stable document id '${input.stableDocumentId}'.`
  ];
}

function summarize(values: readonly string[], limit = 8): string {
  const shown = values.slice(0, limit).join(", ");
  return values.length <= limit ? shown : `${shown}, plus ${values.length - limit} more`;
}

function normalizedTokens(value: string): string[] {
  const normalized = normalizeDocumentationConcern(value);
  return normalized.length === 0 ? [] : normalized.split(" ");
}

function allTokensPresent(queryTokens: readonly string[], evidenceTokens: readonly string[]): boolean {
  if (queryTokens.length === 0) return false;
  const evidence = new Set(evidenceTokens);
  return queryTokens.every((token) => evidence.has(token));
}

function containsPhrase(haystack: readonly string[], needle: readonly string[]): boolean {
  if (needle.length === 0) return false;
  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    if (needle.every((token, offset) => haystack[start + offset] === token)) return true;
  }
  return false;
}

function compareOptionalDescending(left: number | undefined, right: number | undefined): number {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return right - left;
}

function compareOrdinal(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
