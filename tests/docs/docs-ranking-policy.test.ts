/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { searchDocs } from "../../src/application/use-cases/query-docs.js";
import {
  markdownTitleFromPath,
  parseMarkdownHeadings,
  selectedMarkdownText
} from "../../src/application/use-cases/markdown-docs.js";
import {
  FileCatalogScannerAdapter,
  WorkspaceFileAdapter
} from "../../src/infrastructure/filesystem/index.js";
import { openGraphStore, SCHEMA_VERSION, type GraphStore } from "../../src/infrastructure/sqlite/index.js";

const FIXTURE_ROOT = path.resolve("tests/fixtures/fixture-docs-authority-ranking");
const SCANNER = new FileCatalogScannerAdapter();

type RankCandidate = {
  id: string;
  relevance: number;
  owner: number;
  authority: number;
  currency: number;
  lexical?: number;
};

describe("documentation ranking policy fixture", () => {
  for (const seed of [1, 7, 19, 41, 73]) {
    it(`keeps the explicit tuple total and insertion-order independent (seed ${seed})`, () => {
      const candidates: RankCandidate[] = [
        { id: "docs/design/coding-agent-integration-design.md", relevance: 2, owner: 0, authority: 0, currency: 0, lexical: 4 },
        { id: "docs/runbooks/install-agent-workbench.md", relevance: 2, owner: 1, authority: 1, currency: 2, lexical: 400 },
        { id: "docs/guides/sessionstart-troubleshooting.md", relevance: 0, owner: 1, authority: 0, currency: 0, lexical: 8 },
        { id: "docs/design/conflicting-owner.md", relevance: 3, owner: 3, authority: 0, currency: 0 }
      ];
      const shuffled = seededShuffle(candidates, seed);

      expect(shuffled.sort(compareRankTuple).map(({ id }) => id)).toEqual([
        "docs/guides/sessionstart-troubleshooting.md",
        "docs/design/coding-agent-integration-design.md",
        "docs/runbooks/install-agent-workbench.md",
        "docs/design/conflicting-owner.md"
      ]);
    });
  }

  it.fails("T004 red proof: admits and explains an exact matched owner outside the FTS result", async () => {
    const fixture = copyFixture();
    const store = await indexFixtureDocs(fixture.root);
    try {
      const result = await searchDocs({
        request: {
          repo_root: fixture.root,
          query: "hook parity",
          max_results: 10,
          include_snippets: false
        },
        docs_index: store,
        default_repo_root: "."
      });
      const owner = result.search.hits.find(
        ({ path: hitPath }) => hitPath === "docs/design/coding-agent-integration-design.md"
      ) as Record<string, unknown> | undefined;

      expect(owner).toMatchObject({
        candidate_source: "matched_owner",
        concern_match_state: "matched",
        governing_owner_tier: "valid_owner",
        ranking_policy_version: "authority-aware-v1"
      });
    } finally {
      store.close();
      fixture.dispose();
    }
  });

  it.fails("T004 red proof: exposes tuple evidence instead of making legacy score authoritative", async () => {
    const fixture = copyFixture();
    const store = await indexFixtureDocs(fixture.root);
    try {
      const result = await searchDocs({
        request: {
          repo_root: fixture.root,
          query: "SessionStart behavior",
          max_results: 10,
          include_snippets: false
        },
        docs_index: store,
        default_repo_root: "."
      });
      const hits = result.search.hits as Array<Record<string, unknown>>;

      expect(hits.map(({ path: hitPath }) => hitPath).slice(0, 2)).toEqual([
        "docs/design/coding-agent-integration-design.md",
        "docs/runbooks/install-agent-workbench.md"
      ]);
      expect(hits[0]).toMatchObject({
        candidate_source: "fts_and_matched_owner",
        lexical_score: expect.any(Number),
        final_rank_components: {
          governing_owner_tier: "valid_owner",
          stable_document_id: "docs/design/coding-agent-integration-design.md"
        },
        ranking_reasons: expect.any(Array)
      });
    } finally {
      store.close();
      fixture.dispose();
    }
  });
});

function compareRankTuple(left: RankCandidate, right: RankCandidate): number {
  return left.relevance - right.relevance ||
    left.owner - right.owner ||
    left.authority - right.authority ||
    left.currency - right.currency ||
    compareOptionalDescending(left.lexical, right.lexical) ||
    left.id.localeCompare(right.id);
}

function compareOptionalDescending(left: number | undefined, right: number | undefined): number {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return right - left;
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

function copyFixture(): { root: string; dispose: () => void } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-docs-ranking-"));
  fs.cpSync(FIXTURE_ROOT, root, { recursive: true });
  return {
    root,
    dispose: () => fs.rmSync(root, { recursive: true, force: true })
  };
}

async function indexFixtureDocs(root: string): Promise<GraphStore> {
  const store = openGraphStore(path.join(root, "ranking.sqlite"));
  const snapshotId = "9301";
  const indexedAt = "2026-07-21T00:00:00.000Z";
  await store.createBuildSnapshot({
    snapshot: {
      id: snapshotId,
      repo_root: root,
      workspace_root: root,
      repo_identity: root,
      config_identity: "spec-043-fixture",
      schema_version: SCHEMA_VERSION,
      freshness: "refreshing",
      owner_state: "owner",
      created_at: indexedAt,
      updated_at: indexedAt
    },
    controller_generation: 0,
    invalidation_generation: 0,
    created_at: indexedAt
  });
  const scanned = await SCANNER.scan({
    repo_root: root,
    indexed_roots: ["."],
    skipped_roots: [],
    max_files: 2000
  });
  const workspace = new WorkspaceFileAdapter({ repoRoot: root });
  const documents = [];
  for (const file of scanned.files.filter(({ file_identity }) => file_identity.language === "markdown")) {
    const content = await workspace.readText({ path: file.path });
    const headings = parseMarkdownHeadings(content);
    const selected = selectedMarkdownText({ content, max_bytes: 120_000 });
    documents.push({
      path: file.path,
      title: headings[0]?.text ?? markdownTitleFromPath(file.path),
      headings,
      selected_text: selected.text,
      content_hash: file.file_identity.content_hash,
      byte_count: file.file_identity.size_bytes,
      indexed_at: indexedAt,
      truncated: selected.truncated
    });
  }
  await store.replaceSnapshotDocs({ snapshot_id: snapshotId, repo_root: root, documents });
  await store.markSnapshotFreshness({ snapshot_id: snapshotId, freshness: "fresh" });
  await store.transitionBuild({
    repo_root: root,
    snapshot_id: snapshotId,
    from: "building",
    to: "published",
    controller_generation: 0,
    invalidation_generation: 0,
    updated_at: indexedAt
  });
  return store;
}
