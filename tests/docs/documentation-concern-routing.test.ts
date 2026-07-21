/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractDocumentationMapOwners } from "../../src/application/use-cases/markdown-docs.js";

const FIXTURE_ROOT = path.resolve("tests/fixtures/fixture-docs-authority-ranking");

type RankingOracle = {
  normalization: Array<{ input: string; normalized: string }>;
  queries: Array<{
    query: string;
    normalized_tokens: string[];
    matched_concerns: string[];
  }>;
  owner_states: Array<{
    path: string;
    state: string;
    tier: string;
    declared_canonical_owner?: string;
  }>;
  stable_document_ids: string[];
};

describe("documentation concern routing fixture", () => {
  it("locks normalization, exact-token, owner-state, and stable-id oracles", () => {
    const oracle = readJson<RankingOracle>("ranking-oracle.json");

    for (const example of oracle.normalization) {
      expect(referenceNormalize(example.input)).toBe(example.normalized);
    }
    for (const example of oracle.queries) {
      expect(referenceNormalize(example.query).split(" ")).toEqual(example.normalized_tokens);
    }
    expect(oracle.queries.find(({ query }) => query.includes("SessionStart behavior"))?.matched_concerns)
      .toEqual(["coding-agent-integrations"]);
    expect(oracle.queries.find(({ query }) => query === "shared tie")?.matched_concerns)
      .toEqual(["tie-alpha", "tie-beta"]);
    expect(oracle.queries.find(({ query }) => query === "Session startup diagnostics")?.matched_concerns)
      .toEqual([]);
    expect(oracle.queries.find(({ query }) => query.startsWith("sessionstarter"))?.matched_concerns)
      .toEqual([]);

    expect(oracle.owner_states.map(({ state }) => state).sort()).toEqual([
      "archived",
      "conflicting",
      "draft",
      "missing",
      "superseded",
      "valid"
    ]);
    expect(oracle.owner_states.find(({ state }) => state === "conflicting")).toMatchObject({
      path: "docs/design/conflicting-owner.md",
      tier: "invalid_conflicting_owner",
      declared_canonical_owner: "docs/design/current-owner.md"
    });
    for (const stableId of oracle.stable_document_ids) {
      expect(stableId).toBe(canonicalPosixPath(stableId));
      expect(fs.existsSync(path.join(FIXTURE_ROOT, stableId))).toBe(true);
    }
  });

  it("contains one-to-many, many-to-one, missing, and contradictory-owner evidence", () => {
    const map = readText("docs/reference/documentation-map.md");

    expect(map).toContain("| Intent terms |");
    expect(map).toContain("SessionStart; codex; kiro; agent hooks; hook parity");
    expect(map).toContain(
      "[Runtime contracts](runtime-contracts.md) and [Graph store design](../design/graph-store-design.md)"
    );
    expect(map.match(/\[Runtime contracts\]\(runtime-contracts\.md\)/gu)).toHaveLength(4);
    expect(map.match(/\| Tie (?:alpha|beta) \|/gu)).toHaveLength(2);
    expect(fs.existsSync(path.join(FIXTURE_ROOT, "docs/missing/missing-owner.md"))).toBe(false);
    expect(readText("docs/design/conflicting-owner.md")).toContain(
      "canonical_owner: docs/design/current-owner.md"
    );
  });

  it.fails("T003 red proof: extracts every valid owner link from a multi-owner map row", () => {
    const owners = extractDocumentationMapOwners({
      mapPath: "docs/reference/documentation-map.md",
      content: readText("docs/reference/documentation-map.md")
    });

    expect(owners.filter(({ concern }) => concern === "Shared governance")).toEqual([
      {
        concern: "Shared governance",
        owner_path: "docs/reference/runtime-contracts.md",
        source_path: "docs/reference/documentation-map.md"
      },
      {
        concern: "Shared governance",
        owner_path: "docs/design/graph-store-design.md",
        source_path: "docs/reference/documentation-map.md"
      }
    ]);
  });
});

function referenceNormalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\p{Z}]+/gu, " ")
    .replace(/[\t\n\r\f\v ]+/gu, " ")
    .trim();
}

function canonicalPosixPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//u, "");
}

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(FIXTURE_ROOT, relativePath), "utf8");
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}
