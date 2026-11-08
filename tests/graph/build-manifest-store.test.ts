/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExtractionBatch } from "../../src/domain/models/index.js";
import type { GraphBuildManifest, GraphBuildProgress, RepositoryOwnershipLease } from "../../src/ports/index.js";
import { graphBuildManifestDigestMaterial } from "../../src/ports/index.js";
import { openExistingCompatibleGraphStore, openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/graph-store.js";

describe("graph build manifest store", () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-manifest-"));
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("requires every v4 manifest table for schema validation", () => {
    const store = openGraphStore(path.join(directory, "schema.sqlite"));
    try {
      expect(store.validateSchema()).toBe(true);
      store.db.exec("DROP TABLE graph_build_validation_receipts");
      expect(store.validateSchema()).toBe(false);
    } finally {
      store.close();
    }
  });

  it("opens only an existing complete v4 store after a read-only validation probe", async () => {
    const databasePath = path.join(directory, "observer.sqlite");
    const owner = openGraphStore(databasePath);
    try {
      await owner.upsertSnapshot({ snapshot: snapshotFixture() });
    } finally {
      owner.close();
    }
    const before = fs.readFileSync(databasePath);
    const observer = openExistingCompatibleGraphStore(databasePath);
    try {
      await expect(observer.getLatestPublished({ repo_root: "/tmp/manifest-repo" })).resolves.toMatchObject({
        status: "selected", snapshot: { id: "701" }
      });
      await observer.markSnapshotFreshness({ snapshot_id: "701", freshness: "stale" });
      await observer.put({
        universe: {
          universe_id: "observer-cache",
          identity: {
            snapshot_id: "701", normalized_query: "none", retrieval_bound: 500,
            ranking_schema_version: 1, ranking_policy_version: "authority-aware-v2"
          },
          admitted_authority_map: "absent",
          hits: [],
          counts: {
            documentation_corpus_policy_version: "production-docs-v1",
            policy_excluded_files: 0,
            policy_exclusions: [],
            searchable_snapshot_documents_count: 0,
            searchable_scope_documents_count: 0,
            fts_candidate_documents_count: 0,
            matched_owner_candidate_documents_count: 0,
            candidate_union_documents_count: 0,
            ranked_candidate_universe_count: 0,
            priority_scan_eligible_markdown_files_count: 0,
            priority_scan_indexed_markdown_files_count: 0,
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
          created_at: "2026-11-08T00:00:00.000Z",
          expires_at: "2026-11-08T00:15:00.000Z"
        }
      });
      await expect(observer.get({ universe_id: "observer-cache", snapshot_id: "701" })).resolves.toMatchObject({
        universe_id: "observer-cache"
      });
    } finally {
      observer.close();
    }
    expect(fs.readFileSync(databasePath)).not.toEqual(before);
    const reopened = openGraphStore(databasePath);
    try {
      await expect(reopened.getSnapshot({ repo_root: "/tmp/manifest-repo", snapshot_id: "701" }))
        .resolves.toMatchObject({ freshness: "stale" });
    } finally {
      reopened.close();
    }
    const absent = path.join(directory, "absent.sqlite");
    expect(() => openExistingCompatibleGraphStore(absent)).toThrow();
    expect(fs.existsSync(absent)).toBe(false);
  });

  it("rejects an observer store with a non-v4 marker or incomplete v4 schema without repair", () => {
    const databasePath = path.join(directory, "incompatible-observer.sqlite");
    const owner = openGraphStore(databasePath);
    owner.close();
    const writable = openGraphStore(databasePath);
    try {
      writable.db.exec("DELETE FROM schema_migrations; INSERT INTO schema_migrations(version) VALUES (3)");
    } finally {
      writable.close();
    }
    const markerBefore = fs.readFileSync(databasePath);
    expect(() => openExistingCompatibleGraphStore(databasePath)).toThrow("schema marker");
    expect(fs.readFileSync(databasePath)).toEqual(markerBefore);

    const incompletePath = path.join(directory, "incomplete-observer.sqlite");
    const incomplete = openGraphStore(incompletePath);
    try {
      incomplete.db.exec("DROP TABLE graph_build_validation_receipts");
    } finally {
      incomplete.close();
    }
    const schemaBefore = fs.readFileSync(incompletePath);
    expect(() => openExistingCompatibleGraphStore(incompletePath)).toThrow("complete v4 schema");
    expect(fs.readFileSync(incompletePath)).toEqual(schemaBefore);
  });

  it("seals only a complete observed inventory and commits an ordinal once", async () => {
    const store = openGraphStore(path.join(directory, "graph.sqlite"));
    const manifest = manifestFixture();
    const progress = progressFixture(manifest.manifest_id);
    try {
      await store.createBuildSnapshot({
        snapshot: snapshotFixture(),
        controller_generation: 3,
        invalidation_generation: 7,
        created_at: "2026-11-08T10:00:00.000Z"
      });
      await store.beginGraphBuildManifest({
        manifest_id: manifest.manifest_id,
        fence: manifest,
        started_at: manifest.started_at
      });
      await store.appendGraphBuildManifestObservation({
        manifest_id: manifest.manifest_id,
        fence: manifest,
        file: {
          repository_key: "superproject",
          entry: manifest.files[0]!.entry,
          identity: manifest.files[0]!.identity
        }
      });
      await store.sealGraphBuildManifest({ manifest, progress });
      await expect(store.appendGraphBuildManifestObservation({
        manifest_id: manifest.manifest_id,
        fence: manifest,
        file: {
          repository_key: "superproject",
          entry: manifest.files[0]!.entry,
          identity: manifest.files[0]!.identity
        }
      })).rejects.toThrow("not preparing");
      await expect(store.getGraphBuildManifest({
        manifest_id: manifest.manifest_id,
        fence: { ...manifest, owner_id: "wrong-owner" }
      })).rejects.toThrow("fence");
      await expect(store.upsertGraphBuildProgress({
        progress: { ...progress, ordinal_cursor: 99 }
      })).rejects.toThrow("ordinal cursor");
      await expect(store.upsertGraphBuildProgress({
        progress: { ...progress, counters: { ...progress.counters, nodes: 1 } }
      })).rejects.toThrow("counters");

      await expect(store.commitGraphBuildFileOutcome({
        manifest_id: manifest.manifest_id, fence: manifest, snapshot_id: "701", ordinal: 1,
        outcome: "unsupported", entry: manifest.files[0]!.entry, updated_at: "2026-11-08T10:00:30.000Z"
      })).rejects.toThrow("does not bind");
      await expect(store.commitGraphBuildFileOutcome({
        manifest_id: manifest.manifest_id, fence: manifest, snapshot_id: "701", ordinal: 0,
        outcome: "extracted", entry: manifest.files[0]!.entry, updated_at: "2026-11-08T10:00:30.000Z"
      })).rejects.toThrow("requires an extraction batch");
      await expect(store.commitGraphBuildFileOutcome({
        manifest_id: manifest.manifest_id, fence: manifest, snapshot_id: "701", ordinal: 0,
        outcome: "unsupported", entry: manifest.files[0]!.entry, batch: extractionBatch(), updated_at: "2026-11-08T10:00:30.000Z"
      })).rejects.toThrow("must not contain");
      await expect(store.commitGraphBuildFileOutcome({
        manifest_id: manifest.manifest_id, fence: manifest, snapshot_id: "701", ordinal: 0,
        outcome: "extracted", entry: manifest.files[0]!.entry,
        batch: { ...extractionBatch(), snapshot_id: "702" }, updated_at: "2026-11-08T10:00:30.000Z"
      })).rejects.toThrow("does not match the target snapshot");
      await expect(store.commitGraphBuildFileOutcome({
        manifest_id: manifest.manifest_id, fence: manifest, snapshot_id: "701", ordinal: 0,
        outcome: "extracted", entry: { ...manifest.files[0]!.entry, path: "wrong.py" },
        batch: extractionBatch(), updated_at: "2026-11-08T10:00:30.000Z"
      })).rejects.toThrow("entry identity");

      await expect(store.commitGraphBuildFileOutcome({
        manifest_id: manifest.manifest_id,
        fence: manifest,
        snapshot_id: "701",
        ordinal: 0,
        outcome: "extracted",
        entry: manifest.files[0]!.entry,
        batch: extractionBatch(),
        updated_at: "2026-11-08T10:01:00.000Z"
      })).resolves.toMatchObject({
        manifest_id: manifest.manifest_id,
        ordinal_cursor: undefined,
        counters: { eligible_files: 1, admitted_files: 1, extracted_files: 1 }
      });
      await expect(store.commitGraphBuildFileOutcome({
        manifest_id: manifest.manifest_id,
        fence: manifest,
        snapshot_id: "701",
        ordinal: 0,
        outcome: "extracted",
        entry: manifest.files[0]!.entry,
        updated_at: "2026-11-08T10:02:00.000Z"
      })).rejects.toThrow("does not bind");
      await expect(store.getGraphBuildManifest({ manifest_id: manifest.manifest_id })).resolves.toMatchObject({
        state: "sealed",
        files: [expect.objectContaining({ ordinal: 0, outcome: "extracted" })]
      });
    } finally {
      store.close();
    }
  });

  it("rejects a digest mismatch without sealing the preparing manifest", async () => {
    const store = openGraphStore(path.join(directory, "digest.sqlite"));
    const manifest = { ...manifestFixture(), digest: "not-a-sha256-digest" };
    try {
      await store.createBuildSnapshot({ snapshot: snapshotFixture(), controller_generation: 3, invalidation_generation: 7, created_at: manifest.started_at });
      await store.beginGraphBuildManifest({ manifest_id: manifest.manifest_id, fence: manifest, started_at: manifest.started_at });
      await store.appendGraphBuildManifestObservation({
        manifest_id: manifest.manifest_id,
        fence: manifest,
        file: { repository_key: "superproject", entry: manifest.files[0]!.entry, identity: manifest.files[0]!.identity }
      });
      await expect(store.sealGraphBuildManifest({ manifest, progress: progressFixture(manifest.manifest_id) })).rejects.toThrow("digest");
      await expect(store.getGraphBuildManifest({ manifest_id: manifest.manifest_id })).resolves.toMatchObject({ state: "preparing" });
    } finally {
      store.close();
    }
  });

  it("does not permit a sealed manifest to replace captured file identity", async () => {
    const store = openGraphStore(path.join(directory, "immutable-observation.sqlite"));
    const captured = manifestFixture();
    const changed: GraphBuildManifest = {
      ...captured,
      files: [{ ...captured.files[0]!, entry: {
        ...captured.files[0]!.entry,
        file_identity: { ...captured.files[0]!.entry.file_identity, content_hash: "changed-after-capture" }
      } }],
      digest: ""
    };
    changed.digest = createHash("sha256").update(graphBuildManifestDigestMaterial(changed)).digest("hex");
    try {
      await store.createBuildSnapshot({ snapshot: snapshotFixture(), controller_generation: 3, invalidation_generation: 7, created_at: captured.started_at });
      await store.beginGraphBuildManifest({ manifest_id: captured.manifest_id, fence: captured, started_at: captured.started_at });
      await store.appendGraphBuildManifestObservation({
        manifest_id: captured.manifest_id, fence: captured,
        file: { repository_key: "superproject", entry: captured.files[0]!.entry, identity: captured.files[0]!.identity }
      });
      await expect(store.sealGraphBuildManifest({ manifest: changed, progress: progressFixture(captured.manifest_id) }))
        .rejects.toThrow("observation changed");
    } finally {
      store.close();
    }
  });

  it("rolls back a late seal failure and a late extraction write failure", async () => {
    const store = openGraphStore(path.join(directory, "manifest-atomicity.sqlite"));
    const manifest = manifestFixture();
    try {
      await store.createBuildSnapshot({ snapshot: snapshotFixture(), controller_generation: 3, invalidation_generation: 7, created_at: manifest.started_at });
      await store.beginGraphBuildManifest({ manifest_id: manifest.manifest_id, fence: manifest, started_at: manifest.started_at });
      await store.appendGraphBuildManifestObservation({
        manifest_id: manifest.manifest_id, fence: manifest,
        file: { repository_key: "superproject", entry: manifest.files[0]!.entry, identity: manifest.files[0]!.identity }
      });
      const invalidProgress = progressFixture(manifest.manifest_id);
      invalidProgress.counters.nodes = 1;
      await expect(store.sealGraphBuildManifest({ manifest, progress: invalidProgress })).rejects.toThrow("Initial sealed");
      await expect(store.getGraphBuildManifest({ manifest_id: manifest.manifest_id })).resolves.toMatchObject({ state: "preparing" });
      await expect(store.getGraphBuildProgress({ snapshot_id: "701" })).resolves.toBeNull();
      await store.sealGraphBuildManifest({ manifest, progress: progressFixture(manifest.manifest_id) });

      const invalidBatch = extractionBatch();
      invalidBatch.nodes = [{ ...invalidBatch.nodes[0]!, source_range: null as never }];
      await expect(store.commitGraphBuildFileOutcome({
        manifest_id: manifest.manifest_id, fence: manifest, snapshot_id: "701", ordinal: 0, outcome: "extracted",
        entry: manifest.files[0]!.entry, batch: invalidBatch, updated_at: "2026-11-08T10:01:00.000Z"
      })).rejects.toThrow();
      await expect(store.getGraphBuildManifest({ manifest_id: manifest.manifest_id })).resolves.toMatchObject({
        files: [expect.objectContaining({ ordinal: 0, outcome: "pending" })]
      });
      await expect(store.getGraphBuildProgress({ snapshot_id: "701" })).resolves.toMatchObject({
        ordinal_cursor: 0,
        counters: { admitted_files: 0, nodes: 0 }
      });
      expect(store.db.prepare("SELECT COUNT(*) AS count FROM files WHERE snapshot_id = 701").get()).toEqual({ count: 0 });
    } finally {
      store.close();
    }
  });

  it("retains same-path Git inputs from distinct metadata roots", async () => {
    const store = openGraphStore(path.join(directory, "nested-git-inputs.sqlite"));
    const base = manifestFixture();
    const manifest: GraphBuildManifest = {
      ...base,
      inputs: [
        { path: "HEAD", scope: "git", root: ".git", kind: "file", device: "1", inode: "11", size_bytes: "20", mtime_ns: "1", ctime_ns: "1" },
        { path: "HEAD", scope: "git", root: "packages/nested/.git", kind: "file", device: "1", inode: "12", size_bytes: "20", mtime_ns: "1", ctime_ns: "1" }
      ],
      digest: ""
    };
    manifest.digest = createHash("sha256").update(graphBuildManifestDigestMaterial(manifest)).digest("hex");
    try {
      await prepareSealedBuild(store, manifest);
      await expect(store.getGraphBuildManifest({ manifest_id: manifest.manifest_id })).resolves.toMatchObject({
        inputs: expect.arrayContaining([
          expect.objectContaining({ path: "HEAD", root: ".git" }),
          expect.objectContaining({ path: "HEAD", root: "packages/nested/.git" })
        ])
      });
    } finally {
      store.close();
    }
  });

  it("prunes unreferenced sealed or invalid manifests but preserves preparing recovery evidence", async () => {
    const store = openGraphStore(path.join(directory, "manifest-prune.sqlite"));
    const invalid = manifestFixture();
    const preparing = { ...manifestFixture(), manifest_id: "manifest-preparing", controller_generation: 4 };
    try {
      await store.upsertSnapshot({ snapshot: { ...snapshotFixture(), id: "699" } });
      await store.upsertSnapshot({ snapshot: { ...snapshotFixture(), id: "700" } });
      await store.beginGraphBuildManifest({ manifest_id: invalid.manifest_id, fence: invalid, started_at: invalid.started_at });
      await store.invalidateGraphBuildManifest({ manifest_id: invalid.manifest_id, owner_id: invalid.owner_id, reason: "test", updated_at: invalid.started_at });
      await store.beginGraphBuildManifest({ manifest_id: preparing.manifest_id, fence: preparing, started_at: preparing.started_at });
      await store.pruneRepositorySnapshots({
        repo_root: invalid.repo_root, retain_latest_snapshots: 1, retain_latest_fresh_snapshots: 0, vacuum: false
      });
      await expect(store.getGraphBuildManifest({ manifest_id: invalid.manifest_id })).resolves.toBeNull();
      await expect(store.getGraphBuildManifest({ manifest_id: preparing.manifest_id })).resolves.toMatchObject({ state: "preparing" });
    } finally {
      store.close();
    }
  });

  it("invalidates a sealed manifest attached to a recovered orphaned building target", async () => {
    const store = openGraphStore(path.join(directory, "orphaned-building.sqlite"));
    const manifest = manifestFixture();
    try {
      await prepareSealedBuild(store, manifest);
      await expect(store.reconcileOrphanedBuilds({
        repo_root: manifest.repo_root,
        current_owner: activeLease("new-owner", 4),
        recovered_owners: [deadLease("dead-daemon-owner", 3)],
        updated_at: "2026-11-08T10:02:00.000Z"
      })).resolves.toMatchObject({ outcome: "reconciled", snapshot_ids: ["701"] });
      await expect(store.getGraphBuildManifest({ manifest_id: manifest.manifest_id })).resolves.toMatchObject({
        state: "invalid", invalid_reason: "owner_recovered_before_build_completion"
      });
      expect(store.db.prepare("SELECT publication_state FROM snapshots WHERE id = 701").get()).toEqual({ publication_state: "failed" });
    } finally {
      store.close();
    }
  });

  it("invalidates an active sealed seed after owner recovery without retracting its published snapshot", async () => {
    const store = openGraphStore(path.join(directory, "orphaned-published-seed.sqlite"));
    const manifest = manifestFixture();
    try {
      await prepareSealedBuild(store, manifest);
      await store.transitionBuild({
        repo_root: manifest.repo_root, snapshot_id: "701", controller_generation: 3, invalidation_generation: 7,
        from: "building", to: "published", updated_at: "2026-11-08T10:02:00.000Z"
      });
      await expect(store.reconcileOrphanedBuilds({
        repo_root: manifest.repo_root,
        current_owner: activeLease("new-owner", 4),
        recovered_owners: [deadLease("dead-daemon-owner", 3)],
        updated_at: "2026-11-08T10:03:00.000Z"
      })).resolves.toMatchObject({ outcome: "reconciled", snapshot_ids: [] });
      await expect(store.getGraphBuildManifest({ manifest_id: manifest.manifest_id })).resolves.toMatchObject({
        state: "invalid", invalid_reason: "owner_recovered_before_build_completion"
      });
      expect(store.db.prepare("SELECT publication_state FROM snapshots WHERE id = 701").get()).toEqual({ publication_state: "published" });
    } finally {
      store.close();
    }
  });

  it("binds a validation receipt to its exact target and consumes it once", async () => {
    const store = openGraphStore(path.join(directory, "receipt.sqlite"));
    const manifest = manifestFixture();
    const receipt = receiptFixture(manifest);
    try {
      await prepareSealedBuild(store, manifest);
      const terminal = await store.commitGraphBuildFileOutcome({
        manifest_id: manifest.manifest_id, fence: manifest, snapshot_id: "701", ordinal: 0,
        outcome: "unsupported", entry: manifest.files[0]!.entry, updated_at: "2026-11-08T10:00:30.000Z"
      });
      await store.upsertGraphBuildProgress({
        progress: { ...terminal, phase: "resolving", ordinal_cursor: undefined, scan_cursor: "resolve:0" }
      });
      await expect(() => store.publishValidatedGraphBuild({
        receipt,
        transition: { repo_root: manifest.repo_root, snapshot_id: "702", controller_generation: 3, invalidation_generation: 7, from: "building", to: "published", updated_at: receipt.observed_at },
        assert_observation: () => undefined
      })).toThrow("does not match validation receipt target");
      await expect(() => store.publishValidatedGraphBuild({
        receipt: { ...receipt, receipt_id: "receipt-wrong-kind", kind: "complete" },
        transition: { repo_root: manifest.repo_root, snapshot_id: "701", controller_generation: 3, invalidation_generation: 7, from: "building", to: "published", updated_at: receipt.observed_at },
        assert_observation: () => undefined
      })).toThrow("target kind");
      await expect(() => store.publishValidatedGraphBuild({
        receipt: { ...receipt, receipt_id: "receipt-wrong-epoch", watcher_epoch: "different-epoch" },
        transition: { repo_root: manifest.repo_root, snapshot_id: "701", controller_generation: 3, invalidation_generation: 7, from: "building", to: "published", updated_at: receipt.observed_at },
        assert_observation: () => undefined
      })).toThrow("sealed manifest evidence");
      await expect(() => store.publishValidatedGraphBuild({
        receipt,
        transition: { repo_root: manifest.repo_root, snapshot_id: "701", controller_generation: 3, invalidation_generation: 7, from: "building", to: "published", updated_at: receipt.observed_at },
        assert_observation: () => { throw new Error("observation changed"); }
      })).toThrow("observation changed");
      expect(store.db.prepare("SELECT COUNT(*) AS count FROM graph_build_validation_receipts").get()).toEqual({ count: 0 });
      expect(store.publishValidatedGraphBuild({
        receipt,
        transition: { repo_root: manifest.repo_root, snapshot_id: "701", controller_generation: 3, invalidation_generation: 7, from: "building", to: "published", updated_at: receipt.observed_at },
        assert_observation: () => undefined
      })).toMatchObject({ state: "published" });
      expect(store.db.prepare("SELECT COUNT(*) AS count FROM graph_build_validation_receipts").get()).toEqual({ count: 1 });
      await expect(() => store.publishValidatedGraphBuild({
        receipt,
        transition: { repo_root: manifest.repo_root, snapshot_id: "701", controller_generation: 3, invalidation_generation: 7, from: "building", to: "published", updated_at: receipt.observed_at },
        assert_observation: () => undefined
      })).toThrow();
    } finally {
      store.close();
    }
  });
});

function manifestFixture(): GraphBuildManifest {
  const base: GraphBuildManifest = {
    manifest_id: "manifest-701",
    repo_root: "/tmp/manifest-repo",
    config_identity: "manifest-config",
    owner_id: "execution-701",
    controller_generation: 3,
    invalidation_generation: 7,
    generation_source_hash: "manifest-generation-701",
    watcher_epoch: "watcher-701",
    watcher_sequence: 7,
    policy_version: "manifest-identities-v1",
    ordering_version: "path-order-v1",
    composition_fingerprint: "composition-701",
    state: "sealed",
    digest: "",
    started_at: "2026-11-08T10:00:00.000Z",
    sealed_at: "2026-11-08T10:00:01.000Z",
    files: [{
      ordinal: 0,
      repository_key: "superproject",
      entry: {
        path: "src/example.py",
        file_identity: { path: "src/example.py", language: "python", content_hash: "hash-701", size_bytes: 17, mtime_ms: 2 },
        indexed: false
      },
      identity: { path: "src/example.py", kind: "file", device: "1", inode: "2", size_bytes: "17", mtime_ns: "3", ctime_ns: "4" },
      docs_eligible: false,
      outcome: "pending"
    }],
    directories: [],
    inputs: [],
    graph_catalog: {} as GraphBuildManifest["graph_catalog"],
    docs_catalog: {} as GraphBuildManifest["docs_catalog"],
    shape: {} as GraphBuildManifest["shape"],
    preparation_wall_ms: 1
  };
  return { ...base, digest: createHash("sha256").update(graphBuildManifestDigestMaterial(base)).digest("hex") };
}

function extractionBatch(): ExtractionBatch {
  return {
    snapshot_id: "701", source_path: "src/example.py", extractor_id: "unit", language: "python",
    file_identity: { path: "src/example.py", language: "python", content_hash: "hash-701", size_bytes: 17, mtime_ms: 2 },
    nodes: [{ id: "node-701", kind: "function", name: "example", file_path: "src/example.py", language: "python", source_range: { start_line: 1, start_column: 0, end_line: 1, end_column: 7 }, metadata: {} }],
    edges: [], unresolved_references: [], diagnostics_hints: [], test_hints: [], extracted_at: "2026-11-08T10:01:00.000Z"
  };
}

function progressFixture(manifestId: string): GraphBuildProgress {
  return {
    snapshot_id: "701", owner_id: "execution-701", phase: "extracting", status: "active",
    max_files: 1, generation_source_hash: "manifest-generation-701", manifest_id: manifestId,
    ordinal_cursor: 0, counters_version: 2,
    counters: { eligible_files: 1, scanned_files: 1, admitted_files: 0, extracted_files: 0, unsupported_files: 0, resource_backed_files: 0, nodes: 0, edges: 0, unresolved_references: 0 },
    controller_generation: 3, invalidation_generation: 7, updated_at: "2026-11-08T10:00:01.000Z"
  };
}

function snapshotFixture() {
  return {
    id: "701", repo_root: "/tmp/manifest-repo", workspace_root: "/tmp/manifest-repo", repo_identity: "/tmp/manifest-repo",
    config_identity: "manifest-config", schema_version: SCHEMA_VERSION, freshness: "fresh" as const,
    owner_state: "owner" as const, created_at: "2026-11-08T10:00:00.000Z", updated_at: "2026-11-08T10:00:00.000Z"
  };
}

async function prepareSealedBuild(store: ReturnType<typeof openGraphStore>, manifest: GraphBuildManifest): Promise<void> {
  await store.createBuildSnapshot({ snapshot: snapshotFixture(), controller_generation: 3, invalidation_generation: 7, created_at: manifest.started_at });
  await store.beginGraphBuildManifest({ manifest_id: manifest.manifest_id, fence: manifest, started_at: manifest.started_at });
  await store.appendGraphBuildManifestObservation({
    manifest_id: manifest.manifest_id, fence: manifest,
    file: { repository_key: "superproject", entry: manifest.files[0]!.entry, identity: manifest.files[0]!.identity }
  });
  await store.sealGraphBuildManifest({ manifest, progress: progressFixture(manifest.manifest_id) });
}

function receiptFixture(manifest: GraphBuildManifest) {
  return {
    receipt_id: "receipt-701", manifest_id: manifest.manifest_id, manifest_digest: manifest.digest,
    repo_root: manifest.repo_root, execution_id: manifest.owner_id, target_snapshot_id: "701",
    controller_generation: 3, invalidation_generation: 7, kind: "seed" as const,
    watcher_epoch: manifest.watcher_epoch, start_sequence: 7, end_sequence: 7,
    checked_files: 1, checked_directories: 0, checked_inputs: 0, validation_wall_ms: 1,
    observed_at: "2026-11-08T10:01:00.000Z", policy_version: "manifest-identities-v1" as const
  };
}

function activeLease(ownerId: string, generation: number): RepositoryOwnershipLease & { state: "active" } {
  return { repo_root: "/tmp/manifest-repo", runtime_identity: "test", schema_version: SCHEMA_VERSION,
    owner_id: ownerId, owner_pid: 1, owner_generation: generation, heartbeat_at: "2026-11-08T10:00:00.000Z", state: "active" };
}

function deadLease(ownerId: string, generation: number): RepositoryOwnershipLease & { state: "dead" } {
  return { ...activeLease(ownerId, generation), state: "dead" };
}
