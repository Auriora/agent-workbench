/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SnapshotState } from "../../src/domain/models/runtime.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/graph-store.js";

describe("documentation concern publication", () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "awb-doc-owner-publication-"));
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("keeps concern evidence private until the coordinated snapshot publishes", async () => {
    const store = openGraphStore(path.join(directory, "publication.sqlite"));
    try {
      await createBuildingSnapshot(store, snapshot("4301"));
      await writeDocument(store, "4301", "docs/design/runtime-contracts.md");
      await writeCompleteConcernIndex(store, "4301");

      await expect(store.getDocumentationConcernIndexState({ snapshot_id: "4301" })).resolves.toEqual({
        status: "unavailable",
        snapshot_id: "4301",
        reason: "snapshot_not_published"
      });

      await publishSnapshot(store, "4301");
      await expect(store.getDocumentationConcernIndexState({ snapshot_id: "4301" })).resolves.toEqual({
        status: "ready",
        snapshot_id: "4301",
        state: "complete",
        source_path: "docs/reference/documentation-map.md",
        source_content_hash: "map-hash"
      });
      await expect(store.listDocumentationConcernOwners({ snapshot_id: "4301" })).resolves.toEqual({
        status: "ready",
        snapshot_id: "4301",
        rows: [{
          concern_key: "runtime-contracts",
          mapped_owner_path: "docs/design/runtime-contracts.md",
          document_id: "docs/design/runtime-contracts.md",
          owner_state: "valid",
          source_line: 19
        }]
      });
      await expect(store.listDocumentationConcernTerms({ snapshot_id: "4301", max_rows: 0 }))
        .rejects.toThrow("integer from 1 to 501");
      await expect(store.listDocumentationConcernOwners({ snapshot_id: "4301", max_rows: 502 }))
        .rejects.toThrow("integer from 1 to 501");
    } finally {
      store.close();
    }
  });

  it("reports v2 and missing v3 concern state as distinct incompatibilities", async () => {
    const store = openGraphStore(path.join(directory, "compatibility.sqlite"));
    try {
      await createBuildingSnapshot(store, { ...snapshot("4302"), schema_version: 2 });
      await publishSnapshot(store, "4302");
      await createBuildingSnapshot(store, snapshot("4303"));
      await publishSnapshot(store, "4303");

      await expect(store.getDocumentationConcernIndexState({ snapshot_id: "4302" })).resolves.toEqual({
        status: "unavailable",
        snapshot_id: "4302",
        reason: "snapshot_schema_incompatible",
        observed_schema_version: 2,
        required_schema_version: 3
      });
      await expect(store.getDocumentationConcernIndexState({ snapshot_id: "4303" })).resolves.toEqual({
        status: "unavailable",
        snapshot_id: "4303",
        reason: "concern_index_state_missing"
      });
    } finally {
      store.close();
    }
  });

  it("publishes bounded feature-local invalid state without partial concern rows", async () => {
    const store = openGraphStore(path.join(directory, "invalid.sqlite"));
    try {
      await createBuildingSnapshot(store, snapshot("4304"));
      await store.replaceSnapshotDocumentationConcerns({
        snapshot_id: "4304",
        state: "invalid",
        failure_reason: "Contradictory owner rows at documentation-map line 22.",
        concerns: [],
        terms: [],
        owners: []
      });
      await publishSnapshot(store, "4304");

      await expect(store.getDocumentationConcernIndexState({ snapshot_id: "4304" })).resolves.toEqual({
        status: "ready",
        snapshot_id: "4304",
        state: "invalid",
        failure_reason: "Contradictory owner rows at documentation-map line 22."
      });
      await expect(store.listDocumentationConcernTerms({ snapshot_id: "4304" })).resolves.toEqual({
        status: "unavailable",
        snapshot_id: "4304",
        reason: "concern_index_invalid",
        failure_reason: "Contradictory owner rows at documentation-map line 22."
      });
    } finally {
      store.close();
    }
  });

  it("rolls back a contradictory replacement and collapses duplicate owner links to the first line", async () => {
    const store = openGraphStore(path.join(directory, "rollback.sqlite"));
    try {
      await createBuildingSnapshot(store, snapshot("4305"));
      await writeDocument(store, "4305", "docs/design/runtime-contracts.md");
      await store.replaceSnapshotDocumentationConcerns({
        ...completeConcernInput("4305"),
        owners: [
          ownerAtLine(25, "valid"),
          ownerAtLine(19, "valid")
        ]
      });
      await expect(store.replaceSnapshotDocumentationConcerns({
        ...completeConcernInput("4305"),
        owners: [
          ownerAtLine(19, "valid"),
          ownerAtLine(20, "draft")
        ]
      })).rejects.toThrow("Contradictory documentation owner rows");
      await publishSnapshot(store, "4305");

      await expect(store.listDocumentationConcernOwners({ snapshot_id: "4305" })).resolves.toMatchObject({
        status: "ready",
        rows: [{ source_line: 19, owner_state: "valid" }]
      });
    } finally {
      store.close();
    }
  });

  it("enforces snapshot-scoped foreign keys and bounded state and owner constraints", async () => {
    const store = openGraphStore(path.join(directory, "constraints.sqlite"));
    try {
      await createBuildingSnapshot(store, snapshot("4307"));
      await writeDocument(store, "4307", "docs/design/runtime-contracts.md");

      await expect(store.replaceSnapshotDocumentationConcerns({
        snapshot_id: "4307",
        state: "invalid",
        concerns: [],
        terms: [],
        owners: []
      })).rejects.toThrow("CHECK constraint failed");
      await expect(store.replaceSnapshotDocumentationConcerns({
        ...completeConcernInput("4307"),
        state: "no_map",
        source_path: undefined,
        source_content_hash: undefined,
        owners: [ownerAtLine(19, "valid")]
      })).rejects.toThrow("cannot publish concern rows");
      await expect(store.replaceSnapshotDocumentationConcerns({
        ...completeConcernInput("4307"),
        concerns: [],
        owners: [],
        terms: [{ concern_key: "unknown", normalized_term: "unknown", token_count: 1 }]
      })).rejects.toThrow("FOREIGN KEY constraint failed");
      await expect(store.replaceSnapshotDocumentationConcerns({
        ...completeConcernInput("4307"),
        owners: [{ ...ownerAtLine(19, "valid"), source_line: 0 }]
      })).rejects.toThrow("CHECK constraint failed");

      expect(store.db.prepare("SELECT COUNT(*) AS count FROM documentation_concern_index_state").get())
        .toEqual({ count: 0 });
      const indexes = new Set((store.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'index' AND name LIKE 'idx_documentation_concern_%'
      `).all() as Array<{ name: string }>).map((row) => row.name));
      expect(indexes).toEqual(new Set([
        "idx_documentation_concern_owners_snapshot_concern",
        "idx_documentation_concern_owners_snapshot_document",
        "idx_documentation_concern_owners_snapshot_state",
        "idx_documentation_concern_terms_snapshot_term"
      ]));
    } finally {
      store.close();
    }
  });

  it("removes every concern relation when a building snapshot is cleared", async () => {
    const store = openGraphStore(path.join(directory, "cleanup.sqlite"));
    try {
      await createBuildingSnapshot(store, snapshot("4306"));
      await writeDocument(store, "4306", "docs/design/runtime-contracts.md");
      await writeCompleteConcernIndex(store, "4306");
      await store.clearSnapshot({ snapshot_id: "4306" });

      for (const table of [
        "documentation_concern_index_state",
        "documentation_concerns",
        "documentation_concern_terms",
        "documentation_concern_owners"
      ]) {
        expect(store.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()).toEqual({ count: 0 });
      }
    } finally {
      store.close();
    }
  });
});

function snapshot(id: string): SnapshotState {
  return {
    id,
    repo_root: "/tmp/spec-043-repo",
    workspace_root: "/tmp/spec-043-repo",
    repo_identity: "/tmp/spec-043-repo",
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
  state: SnapshotState
): Promise<void> {
  await store.createBuildSnapshot({
    snapshot: state,
    controller_generation: 0,
    invalidation_generation: 0,
    created_at: state.created_at
  });
}

async function publishSnapshot(store: ReturnType<typeof openGraphStore>, snapshotId: string): Promise<void> {
  await store.markSnapshotFreshness({ snapshot_id: snapshotId, freshness: "fresh" });
  await store.transitionBuild({
    repo_root: "/tmp/spec-043-repo",
    snapshot_id: snapshotId,
    from: "building",
    to: "published",
    controller_generation: 0,
    invalidation_generation: 0,
    updated_at: "2026-07-21T00:01:00.000Z"
  });
}

async function writeDocument(
  store: ReturnType<typeof openGraphStore>,
  snapshotId: string,
  documentPath: string
): Promise<void> {
  await store.replaceSnapshotDocs({
    snapshot_id: snapshotId,
    repo_root: "/tmp/spec-043-repo",
    documents: [{
      path: documentPath,
      title: "Runtime contracts",
      headings: [{ id: "runtime-contracts", text: "Runtime contracts", depth: 1, line: 1 }],
      selected_text: "Runtime response envelope and graph schema.",
      content_hash: "owner-hash",
      byte_count: 44,
      indexed_at: "2026-07-21T00:00:00.000Z",
      truncated: false
    }]
  });
}

function completeConcernInput(snapshotId: string) {
  return {
    snapshot_id: snapshotId,
    state: "complete" as const,
    source_path: "docs/reference/documentation-map.md",
    source_content_hash: "map-hash",
    concerns: [{
      concern_key: "runtime-contracts",
      label: "Runtime contracts",
      normalized_label: "runtime contracts"
    }],
    terms: [{
      concern_key: "runtime-contracts",
      normalized_term: "graph schema",
      token_count: 2
    }]
  };
}

function ownerAtLine(sourceLine: number, ownerState: "valid" | "draft") {
  return {
    concern_key: "runtime-contracts",
    mapped_owner_path: "docs/design/runtime-contracts.md",
    document_id: "docs/design/runtime-contracts.md",
    owner_state: ownerState,
    source_line: sourceLine
  } as const;
}

async function writeCompleteConcernIndex(
  store: ReturnType<typeof openGraphStore>,
  snapshotId: string
): Promise<void> {
  await store.replaceSnapshotDocumentationConcerns({
    ...completeConcernInput(snapshotId),
    owners: [ownerAtLine(19, "valid")]
  });
}
