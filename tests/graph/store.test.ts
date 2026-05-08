import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExtractionBatch } from "../../src/domain/models/index.js";
import type { SnapshotState } from "../../src/domain/models/runtime.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/graph-store.js";

describe("graph store", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-db-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("creates and validates the MVP schema", () => {
    const store = openGraphStore(path.join(dir, "index.sqlite"));
    try {
      expect(store.validateSchema()).toBe(true);
      const migration = store.db
        .prepare("SELECT version FROM schema_migrations WHERE version = ?")
        .get(SCHEMA_VERSION);
      expect(migration).toEqual({ version: SCHEMA_VERSION });
    } finally {
      store.close();
    }
  });

  it("supports snapshot upsert and lookup by repo", async () => {
    const store = openGraphStore(path.join(dir, "index.sqlite"));
    const snapshot: SnapshotState = {
      id: "42",
      repo_root: "/tmp/repo",
      workspace_root: "/tmp/repo",
      repo_identity: "/tmp/repo",
      config_identity: "default",
      schema_version: SCHEMA_VERSION,
      freshness: "fresh",
      owner_state: "owner",
      created_at: "2026-05-08T00:00:00.000Z",
      updated_at: "2026-05-08T00:00:00.000Z"
    };

    try {
      await store.upsertSnapshot({ snapshot });
      const listed = await store.listSnapshots({ repo_root: snapshot.repo_root });
      expect(listed).toHaveLength(1);
      expect(listed[0]).toMatchObject({
        id: snapshot.id,
        repo_root: snapshot.repo_root,
        config_identity: snapshot.config_identity,
        freshness: snapshot.freshness,
        schema_version: snapshot.schema_version
      });

      const fetched = await store.getSnapshot({ repo_root: snapshot.repo_root });
      expect(fetched).toMatchObject({
        id: snapshot.id,
        repo_root: snapshot.repo_root,
        config_identity: snapshot.config_identity,
        freshness: snapshot.freshness
      });
    } finally {
      store.close();
    }
  });

  it("supports file catalog upsert/list/get/remove", async () => {
    const store = openGraphStore(path.join(dir, "index.sqlite"));
    const snapshot: SnapshotState = {
      id: "43",
      repo_root: "/tmp/repo",
      workspace_root: "/tmp/repo",
      repo_identity: "/tmp/repo",
      config_identity: "default",
      schema_version: SCHEMA_VERSION,
      freshness: "fresh",
      owner_state: "owner",
      created_at: "2026-05-08T00:00:00.000Z",
      updated_at: "2026-05-08T00:00:00.000Z"
    };

    try {
      await store.upsertSnapshot({ snapshot });
      await store.upsertEntry({
        snapshot_id: snapshot.id,
        entry: {
          path: "/tmp/repo/__init__.py",
          file_identity: {
            path: "/tmp/repo/__init__.py",
            language: "python",
            content_hash: "c1",
            size_bytes: 10,
            mtime_ms: 1000,
            indexed_at: "2026-05-08T00:00:00.000Z"
          },
          indexed: true
        }
      });

      await store.upsertEntry({
        snapshot_id: snapshot.id,
        entry: {
          path: "/tmp/repo/a.py",
          file_identity: {
            path: "/tmp/repo/a.py",
            language: "python",
            content_hash: "c2",
            size_bytes: 20,
            mtime_ms: 1001
          },
          indexed: false,
          skipped_reason: "test"
        }
      });

      const listed = await store.listFiles({ snapshot_id: snapshot.id });
      expect(listed.map((entry) => entry.path)).toEqual(["/tmp/repo/__init__.py", "/tmp/repo/a.py"]);
      expect(listed[0]).toMatchObject({
        path: "/tmp/repo/__init__.py",
        file_identity: {
          indexed_at: "2026-05-08T00:00:00.000Z",
          content_hash: "c1"
        },
        indexed: true
      });

      const byPath = await store.getFile({ snapshot_id: snapshot.id, path: "/tmp/repo/a.py" });
      expect(byPath).toMatchObject({
        path: "/tmp/repo/a.py",
        indexed: false,
        file_identity: { content_hash: "c2" }
      });

      await store.removeEntry({ snapshot_id: snapshot.id, path: "/tmp/repo/a.py" });
      const removed = await store.getFile({ snapshot_id: snapshot.id, path: "/tmp/repo/a.py" });
      expect(removed).toBeNull();

      const remaining = await store.listFiles({ snapshot_id: snapshot.id, after_path: "/tmp/repo/__init__.py" });
      expect(remaining).toHaveLength(0);
    } finally {
      store.close();
    }
  });

  it("supports node write and name-based query", async () => {
    const store = openGraphStore(path.join(dir, "index.sqlite"));

    const snapshot: SnapshotState = {
      id: "44",
      repo_root: "/tmp/repo",
      workspace_root: "/tmp/repo",
      repo_identity: "/tmp/repo",
      config_identity: "default",
      schema_version: SCHEMA_VERSION,
      freshness: "fresh",
      owner_state: "owner",
      created_at: "2026-05-08T00:00:00.000Z",
      updated_at: "2026-05-08T00:00:00.000Z"
    };

    const batch: ExtractionBatch = {
      snapshot_id: snapshot.id,
      source_path: "/tmp/repo/main.py",
      extractor_id: "unit",
      language: "python",
      file_identity: {
        path: "/tmp/repo/main.py",
        language: "python",
        content_hash: "abc123",
        size_bytes: 120,
        mtime_ms: 1234
      },
      nodes: [
        {
          id: "node-1",
          kind: "function",
          name: "MyFunction",
          qualified_name: "MyFunction",
          file_path: "/tmp/repo/main.py",
          language: "python",
          source_range: { start_line: 1, start_column: 0, end_line: 3, end_column: 8 },
          metadata: { type: "symbol" }
        }
      ],
      edges: [],
      unresolved_references: [],
      diagnostics_hints: [],
      test_hints: [],
      extracted_at: "2026-05-08T00:00:00.000Z"
    };

    try {
      await store.upsertSnapshot({ snapshot });
      await store.replaceSnapshotExtraction({ batch, replace: true });

      const exact = await store.findNodesByName({ snapshot_id: snapshot.id, query: "MyFunction", exact: true });
      expect(exact).toHaveLength(1);
      expect(exact[0]).toMatchObject({
        id: "node-1",
        name: "MyFunction",
        file_path: "/tmp/repo/main.py"
      });

      const fuzzy = await store.findNodesByName({ snapshot_id: snapshot.id, query: "MyFun", exact: false });
      expect(fuzzy).toHaveLength(1);

      const byId = await store.getNode({ snapshot_id: snapshot.id, node_id: "node-1" });
      expect(byId).toMatchObject({
        name: "MyFunction",
        source_range: { start_line: 1, start_column: 0 }
      });

      const exactByQualified = await store.findNodesByQualifiedName({
        snapshot_id: snapshot.id,
        qualified_name: "MyFunction"
      });
      expect(exactByQualified).toHaveLength(1);
    } finally {
      store.close();
    }
  });
});
