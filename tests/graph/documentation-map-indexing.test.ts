/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { indexRepositoryGraph } from "../../src/application/use-cases/index-repository-graph.js";
import type { ClockPort, DocumentationConcernIndexPort } from "../../src/ports/index.js";
import { ExtractorRegistryAdapter, ResourceExtractorAdapter } from "../../src/infrastructure/extraction/index.js";
import { FileCatalogScannerAdapter, WorkspaceFileAdapter } from "../../src/infrastructure/filesystem/index.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/index.js";

const FIXTURE_ROOT = path.resolve("tests/fixtures/fixture-docs-authority-ranking");
const clock: ClockPort = {
  now: () => new Date("2026-07-21T12:00:00.000Z"),
  nowIso8601: () => "2026-07-21T12:00:00.000Z",
  nowUnixMs: () => 9401
};

describe("documentation map indexing", () => {
  it("publishes normalized one-to-many concern evidence with the graph snapshot", async () => {
    const fixture = createFixture();
    const store = openGraphStore(path.join(fixture.temp_root, "concerns.sqlite"));
    try {
      await indexFixture({ root: fixture.repo_root, store, snapshotId: "9401" });

      await expect(store.getDocumentationConcernIndexState({ snapshot_id: "9401" })).resolves.toMatchObject({
        status: "ready",
        state: "complete",
        source_path: "docs/reference/documentation-map.md",
        source_content_hash: expect.stringMatching(/^[a-f0-9]{64}$/u)
      });
      const terms = await store.listDocumentationConcernTerms({ snapshot_id: "9401", max_rows: 501 });
      expect(terms.status).toBe("ready");
      if (terms.status !== "ready") throw new Error(terms.reason);
      expect(terms.rows).toEqual(expect.arrayContaining([
        { concern_key: "coding-agent-integrations", normalized_term: "coding agent integrations", token_count: 3 },
        { concern_key: "coding-agent-integrations", normalized_term: "sessionstart", token_count: 1 },
        { concern_key: "graph-schema", normalized_term: "graph schema", token_count: 2 }
      ]));
      const owners = await store.listDocumentationConcernOwners({ snapshot_id: "9401", max_rows: 501 });
      expect(owners.status).toBe("ready");
      if (owners.status !== "ready") throw new Error(owners.reason);
      expect(owners.rows.filter(({ concern_key }) => concern_key === "shared-governance")).toEqual([
        expect.objectContaining({ mapped_owner_path: "docs/design/graph-store-design.md", owner_state: "valid" }),
        expect.objectContaining({ mapped_owner_path: "docs/reference/runtime-contracts.md", owner_state: "valid" })
      ]);
      expect(owners.rows).toEqual(expect.arrayContaining([
        expect.objectContaining({ mapped_owner_path: "docs/missing/missing-owner.md", owner_state: "missing", document_id: undefined }),
        expect.objectContaining({ mapped_owner_path: "docs/drafts/draft-owner.md", owner_state: "draft" }),
        expect.objectContaining({ mapped_owner_path: "docs/history/archived-owner.md", owner_state: "archived" }),
        expect.objectContaining({ mapped_owner_path: "docs/design/superseded-owner.md", owner_state: "superseded" }),
        expect.objectContaining({ mapped_owner_path: "docs/design/conflicting-owner.md", owner_state: "conflicting" })
      ]));
    } finally {
      store.close();
      fixture.dispose();
    }
  });

  it("discovers and reads the exact map even when both bounded scans truncate before it", async () => {
    const fixture = createFixture();
    const store = openGraphStore(path.join(fixture.temp_root, "truncated.sqlite"));
    try {
      await indexFixture({ root: fixture.repo_root, store, snapshotId: "9402", maxFiles: 1 });
      await expect(store.getDocumentationConcernIndexState({ snapshot_id: "9402" })).resolves.toMatchObject({
        status: "ready",
        state: "complete"
      });
      const owners = await store.listDocumentationConcernOwners({ snapshot_id: "9402", max_rows: 501 });
      expect(owners.status).toBe("ready");
      if (owners.status === "ready") {
        expect(owners.rows.some(({ mapped_owner_path }) =>
          mapped_owner_path === "docs/design/coding-agent-integration-design.md")).toBe(true);
      }
    } finally {
      store.close();
      fixture.dispose();
    }
  });

  it("publishes malformed map evidence as invalid zero rows but fails the build on persistence errors", async () => {
    const fixture = createFixture();
    fs.writeFileSync(path.join(fixture.repo_root, "docs/reference/documentation-map.md"), [
      "| Concern | Canonical owner | Intent terms |",
      "| --- | --- | --- |",
      "| Runtime | [Runtime](runtime-contracts.md) | runtime;;contract |"
    ].join("\n"));
    const store = openGraphStore(path.join(fixture.temp_root, "invalid.sqlite"));
    try {
      await indexFixture({ root: fixture.repo_root, store, snapshotId: "9403" });
      await expect(store.getDocumentationConcernIndexState({ snapshot_id: "9403" })).resolves.toMatchObject({
        status: "ready",
        state: "invalid",
        source_path: "docs/reference/documentation-map.md",
        source_content_hash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        failure_reason: expect.stringContaining("empty element")
      });
      expect(countRows(store, "documentation_concerns", 9403)).toBe(0);
      expect(countRows(store, "documentation_concern_terms", 9403)).toBe(0);
      expect(countRows(store, "documentation_concern_owners", 9403)).toBe(0);

      await store.upsertSnapshot({ snapshot: snapshot(fixture.repo_root, "9410") });
      const failingConcerns = new Proxy(store, {
        get(target, property, receiver) {
          if (property === "replaceSnapshotDocumentationConcerns") {
            return async () => { throw new Error("induced concern persistence failure"); };
          }
          const value = Reflect.get(target, property, receiver) as unknown;
          return typeof value === "function" ? value.bind(target) : value;
        }
      }) as DocumentationConcernIndexPort;
      await expect(indexFixture({
        root: fixture.repo_root,
        store,
        snapshotId: "9411",
        concerns: failingConcerns
      })).rejects.toThrow("induced concern persistence failure");
      await expect(store.getSnapshot({ repo_root: fixture.repo_root })).resolves.toMatchObject({ id: "9410" });
      await expect(store.readExplicit({ repo_root: fixture.repo_root, snapshot_id: "9411" })).resolves.toMatchObject({
        status: "blocked",
        publication_state: "failed"
      });
    } finally {
      store.close();
      fixture.dispose();
    }
  });
});

function createFixture(): { repo_root: string; temp_root: string; dispose: () => void } {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-concerns-"));
  const repoRoot = path.join(tempRoot, "repo");
  fs.cpSync(FIXTURE_ROOT, repoRoot, { recursive: true });
  return {
    repo_root: repoRoot,
    temp_root: tempRoot,
    dispose: () => fs.rmSync(tempRoot, { recursive: true, force: true })
  };
}

async function indexFixture(input: {
  root: string;
  store: ReturnType<typeof openGraphStore>;
  snapshotId: string;
  maxFiles?: number;
  concerns?: DocumentationConcernIndexPort;
}) {
  return indexRepositoryGraph({
    repo_root: input.root,
    scanner: new FileCatalogScannerAdapter(),
    workspace: new WorkspaceFileAdapter({ repoRoot: input.root }),
    extractors: new ExtractorRegistryAdapter(),
    resource_extractor: new ResourceExtractorAdapter(),
    graph: input.store,
    catalog: input.store,
    docs_index: input.store,
    documentation_concerns: input.concerns ?? input.store,
    snapshots: input.store,
    clock,
    schema_version: SCHEMA_VERSION,
    snapshot_id: input.snapshotId,
    max_files: input.maxFiles
  });
}

function countRows(store: ReturnType<typeof openGraphStore>, table: string, snapshotId: number): number {
  return (store.db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE snapshot_id = ?`)
    .get(snapshotId) as { count: number }).count;
}

function snapshot(repoRoot: string, id: string) {
  return {
    id,
    repo_root: repoRoot,
    workspace_root: repoRoot,
    repo_identity: repoRoot,
    config_identity: "default",
    schema_version: SCHEMA_VERSION,
    freshness: "fresh" as const,
    owner_state: "owner" as const,
    created_at: "2026-07-21T11:00:00.000Z",
    updated_at: "2026-07-21T11:00:00.000Z"
  };
}
