/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findReferences } from "../../src/application/use-cases/find-references.js";
import type { FileCatalogEntry, GraphNode } from "../../src/domain/models/index.js";
import { createReferenceCursorCodec } from "../../src/infrastructure/runtime/index.js";
import { permissiveWorkspaceSafety } from "../helpers/permissive-workspace-safety.js";
import type {
  FileCatalogPort,
  GraphQueryPort,
  SnapshotPort,
  SnapshotPublicationPort,
  WorkspaceFilePort
} from "../../src/ports/index.js";

const FIXTURE_ROOT = path.resolve("tests/fixtures/fixture-reference-completeness");
const SNAPSHOT_ID = "reference-completeness-phase-1";
const TARGET_NAME = "buildSessionStartContext";

const hookPaths = [
  "catalog/001-codex-session-start.js",
  "catalog/002-claude-session-start.js"
] as const;
const consumerPath = "catalog/101-session-start-consumers.fixture.ts";

describe("SessionStart reference-completeness reproduction", () => {
  it("keeps the compact fixture at nine early and three post-window occurrences", () => {
    expect(countFixtureOccurrences(hookPaths, TARGET_NAME)).toBe(9);
    expect(countFixtureOccurrences([consumerPath], TARGET_NAME)).toBe(3);
    expect(countFixtureOccurrences([...hookPaths, consumerPath], TARGET_NAME)).toBe(12);
  });

  it("proves a healthy complete evidence universe contains all twelve lexical occurrences", async () => {
    const catalog = createHealthyFixtureCatalog();
    const result = await findReferences({
      request: {
        node_id: "fixture:codex-session-start",
        repo_root: FIXTURE_ROOT,
        max_depth: 1,
        max_results: 20
      },
      graph: createEmptyReferenceGraph(TARGET_NAME, hookPaths[0]),
      snapshots: createPublishedSnapshots(),
      catalog,
      workspace: new FixtureWorkspace(catalog),
      workspace_safety: permissiveWorkspaceSafety,
      cursor_codec: createReferenceCursorCodec({ key: Buffer.alloc(32, 74), key_epoch: "fixture-healthy" }),
      reference_limits: {
        max_files: 200,
        max_declared_bytes: 1_000_000,
        max_file_bytes: 128_000,
        time_ms: 1_000
      },
      monotonic_now_ms: () => 0,
      snapshot_validity: validSnapshotReceipt(101),
      default_repo_root: FIXTURE_ROOT
    });

    expect(result.references.references).toHaveLength(12);
    expect(result.references.references.filter((reference) => reference.source_file_path === consumerPath)).toHaveLength(3);
    expect(result.references.references.every((reference) =>
      reference.status === "unresolved" && reference.provenance === "bounded_lexical_identifier_scan"
    )).toBe(true);
    expect(result.references).toMatchObject({ result_count: 12, cursor: undefined });
    expect(result.references.coverage_status).toBe("evidence_backed");
    if (result.references.coverage_status !== "evidence_backed") throw new Error("Expected evidence-backed coverage.");
    expect(result.references.coverage).toMatchObject({
      state: "complete",
      catalog_exhausted: true,
      page_matches: 12,
      matched_so_far: 12,
      complete_matches: 12,
      unresolved_searchable_candidates: { sequence: [] }
    });
    expect(result.meta).toMatchObject({ analysis_validity: "valid", truncated: false });
  });

  it("reaches the three TypeScript occurrences beyond the first catalog window", async () => {
    const catalog = createFixtureCatalog();
    const workspace = new FixtureWorkspace(catalog);
    const result = await findReferences({
      request: {
        node_id: "fixture:codex-session-start",
        repo_root: FIXTURE_ROOT,
        max_depth: 1,
        max_results: 20
      },
      graph: createEmptyReferenceGraph(TARGET_NAME, hookPaths[0]),
      snapshots: createPublishedSnapshots(),
      catalog,
      workspace,
      workspace_safety: permissiveWorkspaceSafety,
      cursor_codec: createReferenceCursorCodec({ key: Buffer.alloc(32, 76), key_epoch: "fixture-direct" }),
      reference_limits: {
        max_files: 200,
        max_declared_bytes: 1_000_000,
        max_file_bytes: 128_000,
        time_ms: 1_000
      },
      monotonic_now_ms: () => 0,
      default_repo_root: FIXTURE_ROOT
    });

    expect(result.references.references).toHaveLength(12);
    expect(result.references.references.every((reference) => reference.status === "unresolved")).toBe(true);
    expect(result.references.references.every(
      (reference) => reference.provenance === "bounded_lexical_identifier_scan"
    )).toBe(true);
    expect(result.references.references.filter((reference) => reference.source_file_path === consumerPath)).toHaveLength(3);
    expect(result.references.result_count).toBe(12);
    expect(result.references.coverage_status).toBe("evidence_backed");
    expect(result.references.cursor).toBeUndefined();
    expect(result.meta.truncated).toBe(true);
    expect(result.meta.analysis_validity).toBe("partial");
  });

  it("keeps two same-line occurrences as distinct column records", async () => {
    const sameLinePath = "catalog/103-same-line-double.ts";
    const catalog = new DeterministicCatalog([catalogEntry(sameLinePath)]);
    const result = await findReferences({
      request: {
        node_id: "fixture:same-line",
        repo_root: FIXTURE_ROOT,
        max_depth: 1,
        max_results: 5
      },
      graph: createEmptyReferenceGraph("sameLineTarget", sameLinePath),
      snapshots: createPublishedSnapshots(),
      catalog,
      workspace: new FixtureWorkspace(catalog),
      workspace_safety: permissiveWorkspaceSafety,
      cursor_codec: createReferenceCursorCodec({ key: Buffer.alloc(32, 75), key_epoch: "fixture-same-line" }),
      default_repo_root: FIXTURE_ROOT
    });

    expect(countFixtureOccurrences([sameLinePath], "sameLineTarget")).toBe(2);
    expect(result.references.references).toHaveLength(2);
    expect(result.references.references.map((reference) => reference.source_range?.start_column)).toEqual([20, 58]);
  });

  it("returns callable bounded continuations that reach row 101", async () => {
    const fixture = evidenceFixture();
    const references = [];
    let cursor: string | undefined;
    let sawContinuation = false;
    for (let page = 0; page < 20; page += 1) {
      const result = await evidenceQuery(fixture, cursor, { max_files: 10 });
      references.push(...result.references.references);
      cursor = result.references.cursor;
      sawContinuation ||= cursor !== undefined;
      if (cursor === undefined) break;
    }

    expect(sawContinuation).toBe(true);
    expect(references.filter((reference) => reference.source_file_path === consumerPath)).toHaveLength(3);
    expect(references.filter((reference) =>
      hookPaths.includes(reference.source_file_path as typeof hookPaths[number]) ||
      reference.source_file_path === consumerPath
    )).toHaveLength(12);
  });

  it("keeps missing, unreadable, oversized, and changed candidates in partial evidence", async () => {
    const fixture = evidenceFixture();
    const result = await evidenceQuery(fixture, undefined, { max_files: 200 });

    expect(result.references.coverage_status).toBe("evidence_backed");
    if (result.references.coverage_status !== "evidence_backed") throw new Error("Expected evidence-backed result.");
    expect(result.references.coverage).toMatchObject({
      state: "partial",
      catalog_exhausted: true,
      unresolved_searchable_candidates: {
        page: [
          { reason: "missing", count: 1 },
          { reason: "oversized", count: 1 },
          { reason: "read_failure", count: 1 },
          { reason: "changed", count: 1 }
        ],
        sequence: [
          { reason: "missing", count: 1 },
          { reason: "oversized", count: 1 },
          { reason: "read_failure", count: 1 },
          { reason: "changed", count: 1 }
        ]
      }
    });
    expect(result.references.coverage.complete_matches).toBeUndefined();
    expect(result.meta).toMatchObject({ analysis_validity: "partial", truncated: true });
  });

  it("keeps generated policy exclusions outside the searchable evidence universe", async () => {
    const fixture = evidenceFixture();
    const result = await evidenceQuery(fixture, undefined, { max_files: 200 });

    expect(result.references.coverage_status).toBe("evidence_backed");
    if (result.references.coverage_status !== "evidence_backed") throw new Error("Expected evidence-backed result.");
    expect(result.references.coverage.policy_exclusions).toEqual({
      page: [{ reason: "generated_or_vendor", count: 1 }],
      sequence: [{ reason: "generated_or_vendor", count: 1 }]
    });
    expect(result.references.coverage.unresolved_searchable_candidates.sequence).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: "generated_or_vendor" })])
    );
    expect(result.references.coverage.searchable_candidates_classified.sequence).toBe(106);
  });
});

function evidenceFixture() {
  const catalog = createFixtureCatalog();
  return {
    catalog,
    workspace: new FixtureWorkspace(catalog),
    graph: createEmptyReferenceGraph(TARGET_NAME, hookPaths[0]),
    snapshots: createPublishedSnapshots(),
    codec: createReferenceCursorCodec({ key: Buffer.alloc(32, 77), key_epoch: "fixture-epoch" })
  };
}

async function evidenceQuery(
  fixture: ReturnType<typeof evidenceFixture>,
  cursor: string | undefined,
  limits: { max_files: number }
) {
  return findReferences({
    request: {
      node_id: "fixture:codex-session-start",
      repo_root: FIXTURE_ROOT,
      max_depth: 1,
      max_results: 20,
      cursor
    },
    graph: fixture.graph,
    snapshots: fixture.snapshots,
    catalog: fixture.catalog,
    workspace: fixture.workspace,
    workspace_safety: permissiveWorkspaceSafety,
    cursor_codec: fixture.codec,
    reference_limits: {
      max_files: limits.max_files,
      max_declared_bytes: 1_000_000,
      max_file_bytes: 128_000,
      time_ms: 1_000
    },
    monotonic_now_ms: () => 0,
    default_repo_root: FIXTURE_ROOT
  });
}

function countFixtureOccurrences(paths: readonly string[], identifier: string): number {
  const pattern = new RegExp(`\\b${identifier}\\b`, "gu");
  return paths.reduce((count, relativePath) => {
    const content = fs.readFileSync(path.join(FIXTURE_ROOT, relativePath), "utf8");
    return count + [...content.matchAll(pattern)].length;
  }, 0);
}

function createFixtureCatalog(): DeterministicCatalog {
  const entries: FileCatalogEntry[] = [
    catalogEntry(hookPaths[0], "javascript"),
    catalogEntry(hookPaths[1], "javascript")
  ];
  for (let row = 3; row <= 100; row += 1) {
    entries.push(catalogEntry(`catalog/${String(row).padStart(3, "0")}-virtual-filler.txt`, "text", 0));
  }
  entries.push(
    catalogEntry(consumerPath, "typescript"),
    catalogEntry("catalog/102-missing-after-row-100.ts", "typescript"),
    catalogEntry("catalog/103-same-line-double.ts", "typescript"),
    catalogEntry("catalog/104-oversized-reference.ts", "typescript", 128_001),
    catalogEntry("catalog/105-unreadable-reference.ts", "typescript"),
    catalogEntry("catalog/106-changed-reference.ts", "typescript", undefined, "pre-change-identity"),
    {
      ...catalogEntry("generated/107-policy-excluded-reference.ts", "typescript"),
      indexed: false,
      skipped_reason: "generated_or_vendor"
    }
  );
  return new DeterministicCatalog(entries);
}

function createHealthyFixtureCatalog(): DeterministicCatalog {
  const entries: FileCatalogEntry[] = [
    catalogEntry(hookPaths[0], "javascript"),
    catalogEntry(hookPaths[1], "javascript")
  ];
  for (let row = 3; row <= 100; row += 1) {
    entries.push(catalogEntry(`catalog/${String(row).padStart(3, "0")}-virtual-filler.txt`, "text", 0));
  }
  entries.push(catalogEntry(consumerPath, "typescript"));
  return new DeterministicCatalog(entries);
}

function validSnapshotReceipt(pathCount: number) {
  return {
    snapshot_id: SNAPSHOT_ID,
    state: "valid" as const,
    complete: true,
    checked_path_count: pathCount,
    observed_path_count: pathCount,
    missing_paths: [],
    inaccessible_paths: [],
    refresh_required: false
  };
}

function catalogEntry(
  relativePath: string,
  language = "typescript",
  declaredSize?: number,
  contentHash?: string
): FileCatalogEntry {
  const absolutePath = path.join(FIXTURE_ROOT, relativePath);
  const size = declaredSize ?? (fs.existsSync(absolutePath) ? fs.statSync(absolutePath).size : 0);
  return {
    path: relativePath,
    indexed: true,
    file_identity: {
      path: relativePath,
      language,
      content_hash: contentHash ?? `sha256:${createHash("sha256").update(
        fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath) : Buffer.alloc(0)
      ).digest("hex")}`,
      size_bytes: size,
      mtime_ms: 1,
      indexed_at: "2026-07-21T00:00:00.000Z"
    }
  };
}

class DeterministicCatalog implements FileCatalogPort {
  readonly entries: readonly FileCatalogEntry[];

  constructor(entries: readonly FileCatalogEntry[]) {
    this.entries = [...entries].sort((left, right) => left.path.localeCompare(right.path));
  }

  async listFiles(input: { after_path?: string; max_rows?: number }): Promise<readonly FileCatalogEntry[]> {
    const start = input.after_path === undefined
      ? 0
      : this.entries.findIndex((entry) => entry.path > input.after_path!);
    if (start < 0) {
      return [];
    }
    return this.entries.slice(start, start + (input.max_rows ?? this.entries.length));
  }

  async getFile(input: { path: string }): Promise<FileCatalogEntry | null> {
    return this.entries.find((entry) => entry.path === input.path) ?? null;
  }

  async upsertEntry(): Promise<void> {
    throw new Error("Fixture catalog is read-only.");
  }

  async removeEntry(): Promise<void> {
    throw new Error("Fixture catalog is read-only.");
  }
}

class FixtureWorkspace implements WorkspaceFilePort {
  constructor(private readonly catalog: DeterministicCatalog) {}

  async readText(input: { path: string }): Promise<string> {
    if (input.path === "catalog/102-missing-after-row-100.ts") {
      throw new Error("fixture missing candidate");
    }
    if (input.path === "catalog/105-unreadable-reference.ts") {
      throw new Error("fixture unreadable candidate");
    }
    const absolutePath = path.join(FIXTURE_ROOT, input.path);
    return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
  }

  async readBinary(input: { path: string }): Promise<Uint8Array> {
    return Buffer.from(await this.readText(input), "utf8");
  }

  async stat(input: { path: string }) {
    if (input.path === "catalog/102-missing-after-row-100.ts") {
      return { exists: false, is_file: false, size_bytes: 0, mtime_ms: 0 };
    }
    const entry = await this.catalog.getFile({ path: input.path });
    if (input.path === "catalog/106-changed-reference.ts" && entry !== null) {
      return {
        exists: true,
        is_file: true,
        size_bytes: entry.file_identity.size_bytes + 1,
        mtime_ms: entry.file_identity.mtime_ms
      };
    }
    return {
      exists: entry !== null,
      is_file: entry !== null,
      size_bytes: entry?.file_identity.size_bytes ?? 0,
      mtime_ms: entry?.file_identity.mtime_ms ?? 0
    };
  }

  async writeText(): Promise<void> { throw new Error("Fixture workspace is read-only."); }
  async writeBinary(): Promise<void> { throw new Error("Fixture workspace is read-only."); }
  async deletePath(): Promise<void> { throw new Error("Fixture workspace is read-only."); }
  async ensureDirectory(): Promise<void> { throw new Error("Fixture workspace is read-only."); }
}

function createEmptyReferenceGraph(name: string, filePath: string): GraphQueryPort {
  const target: GraphNode = {
    id: `fixture:${name}`,
    kind: "function",
    name,
    qualified_name: name,
    file_path: filePath,
    language: "typescript",
    source_range: { start_line: 1, start_column: 0, end_line: 1, end_column: name.length },
    metadata: {}
  };
  return {
    getNode: async () => target,
    findNodesByName: async () => [target],
    findNodesByQualifiedName: async () => [target],
    searchNodes: async () => [target],
    getNodesInRange: async () => [target],
    getOutgoingEdges: async () => [],
    getIncomingEdges: async () => [],
    getReferences: async () => [],
    getUnresolvedReferences: async () => [],
    traverse: async () => ({
      start_node_ids: [target.id],
      nodes: [target],
      edges: [],
      reached_depth: 0,
      truncated: false
    })
  };
}

function createPublishedSnapshots(): SnapshotPort & SnapshotPublicationPort {
  const snapshot = {
    id: SNAPSHOT_ID,
    repo_root: FIXTURE_ROOT,
    workspace_root: FIXTURE_ROOT,
    repo_identity: FIXTURE_ROOT,
    config_identity: "fixture",
    schema_version: 1,
    freshness: "fresh" as const,
    owner_state: "owner" as const,
    created_at: "2026-07-21T00:00:00.000Z",
    updated_at: "2026-07-21T00:00:00.000Z"
  };
  const selected = {
    status: "selected" as const,
    snapshot,
    publication: {
      repo_root: FIXTURE_ROOT,
      snapshot_id: SNAPSHOT_ID,
      controller_generation: 1,
      invalidation_generation: 1,
      state: "published" as const,
      updated_at: snapshot.updated_at
    }
  };
  return {
    getSnapshot: async () => snapshot,
    listSnapshots: async () => [snapshot],
    upsertSnapshot: async () => undefined,
    markSnapshotFreshness: async () => undefined,
    allocateBuildSnapshotId: async () => SNAPSHOT_ID,
    transitionBuild: async (input) => ({ ...input, state: input.to }),
    getLatestPublished: async () => selected,
    readExplicit: async () => selected
  };
}
