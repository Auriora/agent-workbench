/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SnapshotState } from "../../src/domain/models/runtime.js";
import type { RankedDocsUniverseRecord } from "../../src/ports/index.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/graph-store.js";
import { DOCS_RANKING_POLICY_VERSION, type RankedDocsSearchHit } from "../../src/contracts/index.js";

const REPO_ROOT = "/tmp/spec-043-ranked-universe";

describe("ranked documentation universe store", () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "awb-ranked-docs-"));
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("retrieves one bounded FTS source with no offset and treats row 501 as a sentinel", async () => {
    const store = openGraphStore(path.join(directory, "fts.sqlite"));
    try {
      await createBuildingSnapshot(store, "5101");
      await writeDocuments(store, "5101", 501);
      await publishSnapshot(store, "5101");

      await expect(store.findFtsCandidates({
        snapshot_id: "5101",
        normalized_query: "sessionstart",
        max_rows: 501
      })).resolves.toEqual({ status: "overflow", candidates: [], candidate_count_lower_bound: 501 });

      const scoped = await store.findFtsCandidates({
        snapshot_id: "5101",
        normalized_query: "sessionstart",
        normalized_scope_path: "docs/virtual/0001",
        max_rows: 501
      });
      expect(scoped.status).toBe("exact");
      if (scoped.status === "exact") {
        expect(scoped.candidates.map(({ stable_document_id }) => stable_document_id)).toEqual([
          "docs/virtual/0001/sessionstart.md"
        ]);
        expect(scoped.candidates[0]).toMatchObject({
          title_heading_text: expect.stringContaining("SessionStart"),
          body_text: expect.stringContaining("SessionStart"),
          hit: { snippet: expect.stringContaining("SessionStart") }
        });
        const legacy = await store.search({
          repo_root: REPO_ROOT,
          snapshot_id: "5101",
          scope_path: "docs/virtual/0001",
          query: "sessionstart",
          max_results: 10,
          include_snippets: false
        });
        expect(legacy.status).toBe("done");
        if (legacy.status === "done") {
          expect(scoped.candidates[0]!.hit.score).toBe(legacy.hits[0]!.score);
          expect(scoped.candidates[0]!.lexical_score).toBeGreaterThan(0);
        }
      }
    } finally {
      store.close();
    }
  });

  it("treats underscore and percent scope segments literally across candidates and counts", async () => {
    const store = openGraphStore(path.join(directory, "literal-scope.sqlite"));
    try {
      await createBuildingSnapshot(store, "5109");
      const paths = [
        "docs/team_one/a.md",
        "docs/teamXone/b.md",
        "docs/100%/c.md",
        "docs/100x/d.md"
      ];
      await writeDocumentPaths(store, "5109", paths);
      await store.replaceSnapshotDocumentationConcerns({
        snapshot_id: "5109",
        state: "complete",
        source_path: "docs/reference/documentation-map.md",
        source_content_hash: "map-hash",
        concerns: [{ concern_key: "hooks", label: "Hooks", normalized_label: "hooks" }],
        terms: [{ concern_key: "hooks", normalized_term: "sessionstart", token_count: 1 }],
        owners: paths.map((document_id, index) => ({
          concern_key: "hooks",
          mapped_owner_path: document_id,
          document_id,
          owner_state: "valid" as const,
          source_line: index + 1
        }))
      });
      await publishSnapshot(store, "5109");

      for (const [scope, expectedPath] of [
        ["docs/team_one", "docs/team_one/a.md"],
        ["docs/100%", "docs/100%/c.md"]
      ] as const) {
        const fts = await store.findFtsCandidates({
          snapshot_id: "5109", normalized_query: "sessionstart", normalized_scope_path: scope, max_rows: 501
        });
        const owners = await store.findMatchedOwnerCandidates({
          snapshot_id: "5109", concern_keys: ["hooks"], normalized_query: "sessionstart",
          normalized_scope_path: scope, max_rows: 501
        });
        await expect(store.countSearchableDocuments({
          snapshot_id: "5109", normalized_scope_path: scope
        })).resolves.toEqual({
          searchable_snapshot_documents_count: 4,
          searchable_scope_documents_count: 1
        });
        expect(fts.status === "exact" ? fts.candidates.map(({ stable_document_id }) => stable_document_id) : [])
          .toEqual([expectedPath]);
        expect(owners.status === "exact" ? owners.candidates.map(({ stable_document_id }) => stable_document_id) : [])
          .toEqual([expectedPath]);
      }
    } finally {
      store.close();
    }
  });

  it("deduplicates matched-owner document ids before the bound and preserves stable id order", async () => {
    const store = openGraphStore(path.join(directory, "owners.sqlite"));
    try {
      await createBuildingSnapshot(store, "5102");
      await writeDocuments(store, "5102", 300);
      const paths = documentPaths(300);
      await store.replaceSnapshotDocumentationConcerns({
        snapshot_id: "5102",
        state: "complete",
        source_path: "docs/reference/documentation-map.md",
        source_content_hash: "map-hash",
        concerns: ["alpha", "beta"].map((concern_key) => ({
          concern_key,
          label: concern_key,
          normalized_label: concern_key
        })),
        terms: ["alpha", "beta"].map((concern_key) => ({
          concern_key,
          normalized_term: concern_key,
          token_count: 1
        })),
        owners: ["alpha", "beta"].flatMap((concern_key) => paths.map((document_id, index) => ({
          concern_key,
          mapped_owner_path: document_id,
          document_id,
          owner_state: "valid" as const,
          source_line: index + 1
        })))
      });
      await publishSnapshot(store, "5102");

      const result = await store.findMatchedOwnerCandidates({
        snapshot_id: "5102",
        concern_keys: ["beta", "alpha", "alpha"],
        normalized_query: "alpha",
        max_rows: 501
      });
      expect(result.status).toBe("exact");
      if (result.status === "exact") {
        expect(result.candidates).toHaveLength(300);
        expect(result.candidates.map(({ stable_document_id }) => stable_document_id)).toEqual(paths);
        expect(new Set(result.candidates.map(({ stable_document_id }) => stable_document_id))).toHaveLength(300);
        expect(result.candidates.every(({ lexical_score }) => lexical_score === undefined)).toBe(true);
      }
    } finally {
      store.close();
    }
  });

  it("treats distinct matched-owner row 501 as its own overflow sentinel", async () => {
    const store = openGraphStore(path.join(directory, "owner-overflow.sqlite"));
    try {
      await createBuildingSnapshot(store, "5106");
      await writeDocuments(store, "5106", 501);
      const paths = documentPaths(501);
      await store.replaceSnapshotDocumentationConcerns({
        snapshot_id: "5106",
        state: "complete",
        source_path: "docs/reference/documentation-map.md",
        source_content_hash: "map-hash",
        concerns: [{ concern_key: "hooks", label: "Hooks", normalized_label: "hooks" }],
        terms: [{ concern_key: "hooks", normalized_term: "sessionstart", token_count: 1 }],
        owners: paths.map((document_id, index) => ({
          concern_key: "hooks",
          mapped_owner_path: document_id,
          document_id,
          owner_state: "valid" as const,
          source_line: index + 1
        }))
      });
      await publishSnapshot(store, "5106");

      await expect(store.findMatchedOwnerCandidates({
        snapshot_id: "5106",
        concern_keys: ["hooks"],
        normalized_query: "sessionstart",
        max_rows: 501
      })).resolves.toEqual({ status: "overflow", candidates: [], candidate_count_lower_bound: 501 });
    } finally {
      store.close();
    }
  });

  it("persists an immutable ordered universe and purges expired records", async () => {
    const store = openGraphStore(path.join(directory, "universe.sqlite"));
    try {
      await createBuildingSnapshot(store, "5103");
      await writeDocuments(store, "5103", 2);
      await publishSnapshot(store, "5103");
      const universe = rankedUniverse("5103", "universe-5103");

      await store.put({ universe });
      await expect(store.get({ universe_id: universe.universe_id, snapshot_id: "5103" }))
        .resolves.toEqual(universe);
      await expect(store.put({ universe })).rejects.toThrow();
      await expect(store.put({
        universe: { ...universe, universe_id: "duplicate-5103", hits: [universe.hits[0]!, universe.hits[0]!] }
      })).rejects.toThrow("duplicate stable document ids");
      await expect(store.put({
        universe: {
          ...universe,
          universe_id: "count-mismatch-5103",
          counts: {
            ...universe.counts,
            fts_candidate_documents_count: 1,
            candidate_union_documents_count: 1,
            ranked_candidate_universe_count: 1
          }
        }
      })).rejects.toThrow("hit count must equal its ranked candidate count");
      await expect(store.put({
        universe: {
          ...universe,
          universe_id: "offset-time-5103",
          created_at: "2026-07-21T13:00:00+01:00"
        }
      })).rejects.toThrow("canonical UTC ISO-8601");
      await store.put({ universe: { ...universe, universe_id: "delete-5103" } });
      await store.delete({ universe_id: "delete-5103" });
      await expect(store.get({ universe_id: "delete-5103", snapshot_id: "5103" })).resolves.toBeNull();
      await expect(store.purgeExpired({ now_iso8601: "2026-07-21T12:14:59.999Z" })).resolves.toBe(0);
      await expect(store.purgeExpired({ now_iso8601: "2026-07-21T13:15:00+01:00" }))
        .rejects.toThrow("canonical UTC ISO-8601");
      await expect(store.purgeExpired({ now_iso8601: "2026-07-21T12:15:00.000Z" })).resolves.toBe(1);
      await expect(store.get({ universe_id: universe.universe_id, snapshot_id: "5103" })).resolves.toBeNull();
    } finally {
      store.close();
    }
  });

  it("atomically purges legacy universes and child hits before adding admission trust", async () => {
    const databasePath = path.join(directory, "legacy-universe.sqlite");
    const initial = openGraphStore(databasePath, { enforceForeignKeys: false });
    try {
      await createBuildingSnapshot(initial, "5110");
      await writeDocuments(initial, "5110", 2);
      await publishSnapshot(initial, "5110");
      await initial.put({ universe: rankedUniverse("5110", "legacy-universe-5110") });
    } finally {
      initial.close();
    }

    const legacy = new Database(databasePath);
    try {
      legacy.pragma("foreign_keys = OFF");
      legacy.exec("ALTER TABLE ranked_docs_universes DROP COLUMN admitted_authority_map");
      expect(legacy.prepare("SELECT COUNT(*) AS count FROM ranked_docs_universes").get()).toEqual({ count: 1 });
      expect(legacy.prepare("SELECT COUNT(*) AS count FROM ranked_docs_universe_hits").get()).toEqual({ count: 2 });
    } finally {
      legacy.close();
    }

    const migrated = openGraphStore(databasePath, { enforceForeignKeys: false });
    try {
      expect(migrated.db.prepare("SELECT COUNT(*) AS count FROM ranked_docs_universes").get()).toEqual({ count: 0 });
      expect(migrated.db.prepare("SELECT COUNT(*) AS count FROM ranked_docs_universe_hits").get()).toEqual({ count: 0 });
      expect(migrated.db.prepare("PRAGMA table_info(ranked_docs_universes)").all())
        .toContainEqual(expect.objectContaining({ name: "admitted_authority_map", notnull: 1 }));
    } finally {
      migrated.close();
    }

    const reopened = openGraphStore(databasePath, { enforceForeignKeys: false });
    try {
      expect(reopened.db.prepare("SELECT COUNT(*) AS count FROM ranked_docs_universes").get()).toEqual({ count: 0 });
      expect(reopened.db.prepare("SELECT COUNT(*) AS count FROM ranked_docs_universe_hits").get()).toEqual({ count: 0 });
    } finally {
      reopened.close();
    }
  });

  it("rejects a persisted header whose valid counts disagree with its item cardinality", async () => {
    const store = openGraphStore(path.join(directory, "cardinality.sqlite"));
    try {
      await createBuildingSnapshot(store, "5108");
      await writeDocuments(store, "5108", 2);
      await publishSnapshot(store, "5108");
      const universe = rankedUniverse("5108", "universe-5108");
      await store.put({ universe });
      store.db.prepare("UPDATE ranked_docs_universes SET counts_json = ? WHERE universe_id = ?").run(
        JSON.stringify({
          ...universe.counts,
          fts_candidate_documents_count: 1,
          candidate_union_documents_count: 1,
          ranked_candidate_universe_count: 1
        }),
        universe.universe_id
      );

      await expect(store.get({ universe_id: universe.universe_id, snapshot_id: "5108" }))
        .rejects.toThrow("cardinality is inconsistent");
    } finally {
      store.close();
    }
  });

  it("rejects malformed persisted hit JSON instead of returning partial frozen state", async () => {
    const store = openGraphStore(path.join(directory, "malformed.sqlite"));
    try {
      await createBuildingSnapshot(store, "5107");
      await writeDocuments(store, "5107", 2);
      await publishSnapshot(store, "5107");
      const universe = rankedUniverse("5107", "universe-5107");
      await store.put({ universe });
      store.db.prepare(`
        UPDATE ranked_docs_universe_hits SET hit_json = '{"path":"incomplete"}'
        WHERE universe_id = ? AND position = 0
      `).run(universe.universe_id);

      await expect(store.get({ universe_id: universe.universe_id, snapshot_id: "5107" })).rejects.toThrow();
    } finally {
      store.close();
    }
  });

  it("removes universe rows during snapshot pruning even when foreign keys are disabled", async () => {
    const store = openGraphStore(path.join(directory, "cleanup.sqlite"), { enforceForeignKeys: false });
    try {
      await createBuildingSnapshot(store, "5104");
      await writeDocuments(store, "5104", 2);
      await publishSnapshot(store, "5104");
      await store.put({ universe: rankedUniverse("5104", "universe-5104") });
      await createBuildingSnapshot(store, "5105");
      await writeDocuments(store, "5105", 1);
      await publishSnapshot(store, "5105");

      await store.pruneRepositorySnapshots({
        repo_root: REPO_ROOT,
        retain_latest_snapshots: 1,
        retain_latest_fresh_snapshots: 0,
        vacuum: false
      });

      expect(store.db.prepare("SELECT COUNT(*) AS count FROM ranked_docs_universes").get()).toEqual({ count: 0 });
      expect(store.db.prepare("SELECT COUNT(*) AS count FROM ranked_docs_universe_hits").get()).toEqual({ count: 0 });
    } finally {
      store.close();
    }
  });

  it("rejects unavailable snapshots instead of returning an exact empty candidate set", async () => {
    const store = openGraphStore(path.join(directory, "unavailable.sqlite"));
    try {
      await expect(store.findFtsCandidates({
        snapshot_id: "9999",
        normalized_query: "sessionstart",
        max_rows: 501
      })).rejects.toThrow("Published graph snapshot is unavailable");
      await expect(store.get({ universe_id: "missing", snapshot_id: "9999" }))
        .rejects.toThrow("Published graph snapshot is unavailable");
    } finally {
      store.close();
    }
  });
});

function snapshot(id: string): SnapshotState {
  return {
    id,
    repo_root: REPO_ROOT,
    workspace_root: REPO_ROOT,
    repo_identity: REPO_ROOT,
    config_identity: "default",
    schema_version: SCHEMA_VERSION,
    freshness: "refreshing",
    owner_state: "owner",
    created_at: "2026-07-21T00:00:00.000Z",
    updated_at: "2026-07-21T00:00:00.000Z"
  };
}

async function createBuildingSnapshot(
  store: ReturnType<typeof openGraphStore>,
  snapshotId: string
): Promise<void> {
  await store.createBuildSnapshot({
    snapshot: snapshot(snapshotId),
    controller_generation: 0,
    invalidation_generation: 0,
    created_at: "2026-07-21T00:00:00.000Z"
  });
}

async function publishSnapshot(
  store: ReturnType<typeof openGraphStore>,
  snapshotId: string
): Promise<void> {
  await store.markSnapshotFreshness({ snapshot_id: snapshotId, freshness: "fresh" });
  await store.transitionBuild({
    repo_root: REPO_ROOT,
    snapshot_id: snapshotId,
    from: "building",
    to: "published",
    controller_generation: 0,
    invalidation_generation: 0,
    updated_at: "2026-07-21T00:01:00.000Z"
  });
}

function documentPaths(count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    `docs/virtual/${String(index + 1).padStart(4, "0")}/sessionstart.md`);
}

async function writeDocuments(
  store: ReturnType<typeof openGraphStore>,
  snapshotId: string,
  count: number
): Promise<void> {
  await store.replaceSnapshotDocs({
    snapshot_id: snapshotId,
    repo_root: REPO_ROOT,
    documents: documentPaths(count).map((documentPath, index) => ({
      path: documentPath,
      title: `SessionStart ${String(index + 1).padStart(4, "0")}`,
      headings: [{ id: "sessionstart", text: "SessionStart", depth: 1, line: 1 }],
      selected_text: "---\nstatus: current\n---\nSessionStart behavior and hook rules.",
      content_hash: `hash-${index}`,
      byte_count: 64,
      indexed_at: "2026-07-21T00:00:00.000Z",
      truncated: false
    }))
  });
}

async function writeDocumentPaths(
  store: ReturnType<typeof openGraphStore>,
  snapshotId: string,
  paths: readonly string[]
): Promise<void> {
  await store.replaceSnapshotDocs({
    snapshot_id: snapshotId,
    repo_root: REPO_ROOT,
    documents: paths.map((documentPath, index) => ({
      path: documentPath,
      title: `SessionStart ${index}`,
      headings: [{ id: "sessionstart", text: "SessionStart", depth: 1, line: 1 }],
      selected_text: "---\nstatus: current\n---\nSessionStart behavior.",
      content_hash: `literal-${index}`,
      byte_count: 48,
      indexed_at: "2026-07-21T00:00:00.000Z",
      truncated: false
    }))
  });
}

function rankedUniverse(snapshotId: string, universeId: string): RankedDocsUniverseRecord {
  const hits: RankedDocsSearchHit[] = documentPaths(2).map((documentPath, index) => ({
    path: documentPath,
    title: `SessionStart ${index + 1}`,
    score: 10 - index,
    evidence_kinds: ["docs", "fts"],
    direct_read_caveat: "Fixture routing evidence.",
    doc_status: "current" as const,
    authority: "canonical" as const,
    currency_state: "current" as const,
    currency_caveats: [],
    lexical_score: 10 - index,
    candidate_source: "fts" as const,
    concern_match_state: "no_match" as const,
    matched_concerns: [],
    governing_owner_tier: "non_owner" as const,
    final_rank_components: {
      relevance_band: "all_query_tokens_body" as const,
      governing_owner_tier: "non_owner" as const,
      authority_tier: "canonical" as const,
      currency_tier: "current" as const,
      lexical_score: 10 - index,
      normalized_path: documentPath,
      stable_document_id: documentPath
    },
    ranking_policy_version: DOCS_RANKING_POLICY_VERSION,
    ranking_reasons: ["Fixture final rank order."]
  }));
  return {
    universe_id: universeId,
    admitted_authority_map: "absent",
    identity: {
      snapshot_id: snapshotId,
      normalized_query: "sessionstart",
      retrieval_bound: 500,
      ranking_schema_version: 1,
      ranking_policy_version: DOCS_RANKING_POLICY_VERSION
    },
    hits,
    counts: {
      searchable_snapshot_documents_count: 2,
      searchable_scope_documents_count: 2,
      fts_candidate_documents_count: 2,
      matched_owner_candidate_documents_count: 0,
      candidate_union_documents_count: 2,
      ranked_candidate_universe_count: 2,
      priority_scan_eligible_markdown_files_count: 2,
      priority_scan_indexed_markdown_files_count: 2,
    priority_scan_skipped_markdown_files_count: 0,
    priority_scan_coverage_state: "complete",
    priority_scan_truncated: false,
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
    },
    created_at: "2026-07-21T12:00:00.000Z",
    expires_at: "2026-07-21T12:15:00.000Z"
  };
}
