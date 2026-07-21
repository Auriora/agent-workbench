/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { findReferences } from "../../src/application/use-cases/find-references.js";
import type { FileCatalogEntry, GraphNode } from "../../src/domain/models/index.js";
import { createReferenceCursorCodec } from "../../src/infrastructure/runtime/index.js";
import { permissiveWorkspaceSafety } from "../helpers/permissive-workspace-safety.js";
import type {
  FileCatalogPort,
  GraphQueryPort,
  SnapshotPort,
  SnapshotPublicationPort,
  WorkspaceFilePort,
  WorkspaceSafetyPort
} from "../../src/ports/index.js";

const REPO_ROOT = "/fixture-reference-budget";
const SNAPSHOT_ID = "reference-budget-snapshot";
const TARGET_NAME = "budgetTarget";

describe("reference query budgets", () => {
  it("keeps the public occurrence page within max_results", async () => {
    const fixture = fixtureFor([
      ["src/a.ts", `${TARGET_NAME}; ${TARGET_NAME}; ${TARGET_NAME};`],
      ["src/b.ts", `${TARGET_NAME}; ${TARGET_NAME};`]
    ]);
    const result = await runQuery(fixture, 2);

    expect(result.references.references).toHaveLength(2);
    expect(result.references.cursor).toEqual(expect.any(String));
    expect(result.meta.truncated).toBe(true);
  });

  it("prechecks the per-file declared-size ceiling before read admission", async () => {
    const fixture = fixtureFor([
      ["src/a-oversized.ts", TARGET_NAME, 128_001],
      ["src/b-readable.ts", TARGET_NAME]
    ]);
    const result = await runQuery(fixture, 10);

    expect(fixture.workspace.readPaths).not.toContain("src/a-oversized.ts");
    expect(fixture.workspace.readPaths).toContain("src/b-readable.ts");
    expect(result.references.references).toEqual([
      expect.objectContaining({ source_file_path: "src/b-readable.ts" })
    ]);
    expect(result.references.coverage_status).toBe("evidence_backed");
    if (result.references.coverage_status === "evidence_backed") {
      expect(result.references.coverage).toMatchObject({
        state: "partial",
        searchable_candidates_classified: { page: 2, sequence: 2 },
        unresolved_searchable_candidates: {
          page: [{ reason: "oversized", count: 1 }],
          sequence: [{ reason: "oversized", count: 1 }]
        }
      });
      expect(result.references.coverage.page.unique_files_inspected).toBe(1);
    }
  });

  it("rechecks live workspace read policy before trusting a catalog entry", async () => {
    const fixture = fixtureFor([["src/secret.env", TARGET_NAME]]);
    const workspaceSafety: WorkspaceSafetyPort = {
      ...permissiveWorkspaceSafety,
      resolveWorkspacePath(requestedPath) {
        return {
          allowed: true,
          absolutePath: requestedPath,
          relativePath: requestedPath,
          readOnly: true
        };
      },
      isReadOnlyPath() {
        return true;
      }
    };

    const result = await runQuery(fixture, 10, { workspaceSafety });

    expect(fixture.workspace.readPaths).toEqual([]);
    expect(coverage(result)).toMatchObject({
      state: "complete",
      catalog_exhausted: true,
      page: { file_read_attempts: 0, unique_files_inspected: 0 },
      policy_exclusions: {
        page: [{ reason: "configured_skip", count: 1 }],
        sequence: [{ reason: "configured_skip", count: 1 }]
      }
    });
  });

  it("uses an injected monotonic clock to admit no file at or after the page deadline", async () => {
    const fixture = fixtureFor([["src/a.ts", TARGET_NAME]]);
    const result = await runQuery(fixture, 10, {
      limits: limits({ time_ms: 10 }),
      clock: sequenceClock([0, 10, 10])
    });

    expect(fixture.workspace.readPaths).toEqual([]);
    expect(coverage(result)).toMatchObject({
      state: "partial",
      stop_reason: "time",
      page: { file_read_attempts: 0, unique_files_inspected: 0 }
    });
  });

  it("finishes an admitted file atomically, reports time overrun, and admits no later file", async () => {
    const fixture = fixtureFor([
      ["src/a.ts", TARGET_NAME],
      ["src/b.ts", TARGET_NAME]
    ]);
    const result = await runQuery(fixture, 10, {
      limits: limits({ time_ms: 10 }),
      clock: sequenceClock([0, 0, 0, 15, 15])
    });

    expect(fixture.workspace.readPaths).toEqual(["src/a.ts"]);
    expect(coverage(result)).toMatchObject({
      stop_reason: "time",
      page: { file_read_attempts: 1, unique_files_inspected: 1, elapsed_admission_ms: 15 }
    });
  });

  it("enforces the per-page searchable-file limit independently of catalog page size", async () => {
    const fixture = fixtureFor([
      ["src/a.ts", TARGET_NAME],
      ["src/b.ts", TARGET_NAME]
    ]);
    const result = await runQuery(fixture, 10, { limits: limits({ max_files: 1 }) });

    expect(fixture.workspace.readPaths).toEqual(["src/a.ts"]);
    expect(coverage(result)).toMatchObject({
      stop_reason: "file",
      page: { file_read_attempts: 1, unique_files_inspected: 1 }
    });
  });

  it("enforces declared-byte admission while reporting actual UTF-8 bytes separately", async () => {
    const first = `${TARGET_NAME};`;
    const fixture = fixtureFor([
      ["src/a.ts", first],
      ["src/b.ts", `${TARGET_NAME};`]
    ]);
    const firstBytes = Buffer.byteLength(first);
    const result = await runQuery(fixture, 10, {
      limits: limits({ max_declared_bytes: firstBytes })
    });

    expect(fixture.workspace.readPaths).toEqual(["src/a.ts"]);
    expect(coverage(result)).toMatchObject({
      stop_reason: "byte",
      page: { declared_bytes_admitted: firstBytes, actual_bytes_observed: firstBytes }
    });
  });

  it("advances an oversized candidate once without inflating unique inspected files", async () => {
    const fixture = fixtureFor([
      ["src/a-oversized.ts", TARGET_NAME, 128_001],
      ["src/b.ts", TARGET_NAME]
    ]);
    const result = await runQuery(fixture, 10);

    expect(coverage(result)).toMatchObject({
      searchable_candidates_classified: { page: 2, sequence: 2 },
      page: { unique_files_inspected: 1, file_read_attempts: 1 },
      unresolved_searchable_candidates: {
        page: [{ reason: "oversized", count: 1 }],
        sequence: [{ reason: "oversized", count: 1 }]
      }
    });
  });

  it("classifies an unknown indexed content-hash format as changed instead of certifying it", async () => {
    const fixture = fixtureFor([["src/a.ts", TARGET_NAME, undefined, "unknown:same-size"]]);
    const result = await runQuery(fixture, 10);

    expect(coverage(result)).toMatchObject({
      state: "partial",
      page: { unique_files_inspected: 0, file_read_attempts: 1 },
      unresolved_searchable_candidates: {
        page: [{ reason: "changed", count: 1 }],
        sequence: [{ reason: "changed", count: 1 }]
      }
    });
  });

  it("classifies stat failures as unresolved and continues after the failed candidate", async () => {
    const fixture = fixtureFor([
      ["src/a-inaccessible.ts", TARGET_NAME],
      ["src/b-readable.ts", TARGET_NAME]
    ]);
    fixture.workspace.statFailures.add("src/a-inaccessible.ts");

    const result = await runQuery(fixture, 10);

    expect(result.references.references).toEqual([
      expect.objectContaining({ source_file_path: "src/b-readable.ts" })
    ]);
    expect(coverage(result)).toMatchObject({
      state: "partial",
      searchable_candidates_classified: { page: 2, sequence: 2 },
      unresolved_searchable_candidates: {
        page: [{ reason: "read_failure", count: 1 }],
        sequence: [{ reason: "read_failure", count: 1 }]
      }
    });
  });

  it("checks the deadline before classifying every excluded catalog entry", async () => {
    const fixture = fixtureFor([
      ["src/a.json", TARGET_NAME],
      ["src/b.json", TARGET_NAME],
      ["src/c.ts", TARGET_NAME]
    ]);
    fixture.catalog.entries[0]!.file_identity.language = "json";
    fixture.catalog.entries[1]!.file_identity.language = "json";

    const result = await runQuery(fixture, 10, {
      limits: limits({ time_ms: 10 }),
      clock: sequenceClock([0, 0, 10, 10])
    });

    expect(fixture.workspace.readPaths).toEqual([]);
    expect(coverage(result)).toMatchObject({
      state: "partial",
      stop_reason: "time",
      policy_exclusions: {
        page: [{ reason: "unsupported_language", count: 1 }]
      },
      continuation_kind: "lexical_scan"
    });
    expect(result.references.cursor).toEqual(expect.any(String));
  });

  it("classifies an unknown skipped reason as unresolved rather than policy-excluded", async () => {
    const fixture = fixtureFor([["src/a.ts", TARGET_NAME]]);
    fixture.catalog.entries[0]!.skipped_reason = "future-unrecognized-reason";

    const result = await runQuery(fixture, 10);

    expect(fixture.workspace.readPaths).toEqual([]);
    expect(coverage(result)).toMatchObject({
      state: "partial",
      policy_exclusions: { page: [], sequence: [] },
      unresolved_searchable_candidates: {
        page: [{ reason: "read_failure", count: 1 }],
        sequence: [{ reason: "read_failure", count: 1 }]
      }
    });
    expect(result.references.next_actions).toEqual([
      expect.objectContaining({
        tool: "read_resource",
        args: { uri: "repo:///status", repo_root: REPO_ROOT }
      })
    ]);
  });

  it("advances a file that can never fit the configured total byte budget", async () => {
    const fixture = fixtureFor([
      ["src/a-too-large-for-page.ts", TARGET_NAME],
      ["src/b-readable.ts", TARGET_NAME]
    ]);
    const result = await runQuery(fixture, 10, {
      limits: limits({ max_declared_bytes: 8 })
    });

    expect(fixture.workspace.readPaths).toEqual([]);
    expect(coverage(result)).toMatchObject({
      state: "partial",
      catalog_exhausted: true,
      unresolved_searchable_candidates: {
        page: [{ reason: "oversized", count: 2 }]
      }
    });
  });

  it("short-circuits a failed result-cursor replay without scanning later files", async () => {
    const fixture = fixtureFor([
      ["src/a.ts", `${TARGET_NAME}; ${TARGET_NAME}; ${TARGET_NAME};`],
      ["src/b.ts", TARGET_NAME]
    ]);
    const first = await runQuery(fixture, 1);
    expect(first.references.cursor).toEqual(expect.any(String));
    fixture.workspace.readFailures.add("src/a.ts");
    fixture.workspace.readPaths.length = 0;

    const replay = await runQuery(fixture, 1, { cursor: first.references.cursor });

    expect(fixture.workspace.readPaths).toEqual(["src/a.ts"]);
    expect(replay.references.references).toEqual([]);
    expect(replay.references.cursor).toBeUndefined();
    expect(replay.meta.verification_status).toBe("blocked");
    expect(coverage(replay)).toMatchObject({
      state: "partial",
      stop_reason: "read_failure"
    });
  });

  it("does not certify complete evidence without snapshot-validity evidence", async () => {
    const fixture = fixtureFor([["src/a.ts", TARGET_NAME]]);
    const result = await runQuery(fixture, 10, { omitValidity: true });

    expect(coverage(result)).toMatchObject({ state: "partial", catalog_exhausted: true });
    expect(result.meta).toMatchObject({ analysis_validity: "partial", verification_status: "blocked" });
    expect(result.meta.caveats).toEqual([
      expect.objectContaining({ kind: "degraded_snapshot_path_validity" })
    ]);
  });
});

type BudgetFixture = {
  catalog: BudgetCatalog;
  graph: GraphQueryPort;
  snapshots: SnapshotPort & SnapshotPublicationPort;
  workspace: BudgetWorkspace;
  cursorCodec: ReturnType<typeof createReferenceCursorCodec>;
};

function fixtureFor(rows: readonly [path: string, content: string, declaredSize?: number, contentHash?: string][]): BudgetFixture {
  const contents = new Map(rows.map(([path, content]) => [path, content]));
  const entries = rows.map(([path, content, declaredSize, contentHash]) => ({
    path,
    indexed: true,
    file_identity: {
      path,
      language: "typescript",
      content_hash: contentHash ?? `sha256:${createHash("sha256").update(content).digest("hex")}`,
      size_bytes: declaredSize ?? Buffer.byteLength(content, "utf8"),
      mtime_ms: 1
    }
  }));
  return {
    catalog: new BudgetCatalog(entries),
    graph: emptyGraph(entries[0]?.path ?? "src/target.ts"),
    snapshots: publishedSnapshots(),
    workspace: new BudgetWorkspace(contents, entries),
    cursorCodec: createReferenceCursorCodec({ key: Buffer.alloc(32, 61), key_epoch: "budget-epoch" })
  };
}

async function runQuery(fixture: BudgetFixture, maxResults: number, options: {
  limits?: { max_files: number; max_declared_bytes: number; max_file_bytes: number; time_ms: number };
  clock?: () => number;
  cursor?: string;
  omitValidity?: boolean;
  workspaceSafety?: WorkspaceSafetyPort;
} = {}) {
  return findReferences({
    request: {
      node_id: "budget-target-node",
      repo_root: REPO_ROOT,
      max_depth: 1,
      max_results: maxResults,
      cursor: options.cursor
    },
    graph: fixture.graph,
    snapshots: fixture.snapshots,
    catalog: fixture.catalog,
    workspace: fixture.workspace,
    workspace_safety: options.workspaceSafety ?? permissiveWorkspaceSafety,
    cursor_codec: fixture.cursorCodec,
    reference_limits: options.limits,
    monotonic_now_ms: options.clock,
    snapshot_validity: options.omitValidity ? undefined : {
      snapshot_id: SNAPSHOT_ID,
      state: "valid",
      complete: true,
      checked_path_count: fixture.catalog.entries.length,
      observed_path_count: fixture.catalog.entries.length,
      missing_paths: [],
      inaccessible_paths: [],
      refresh_required: false
    },
    default_repo_root: REPO_ROOT
  });
}

function coverage(result: Awaited<ReturnType<typeof runQuery>>) {
  expect(result.references.coverage_status).toBe("evidence_backed");
  if (result.references.coverage_status !== "evidence_backed") throw new Error("Expected evidence-backed coverage.");
  return result.references.coverage;
}

function limits(overrides: Partial<{ max_files: number; max_declared_bytes: number; max_file_bytes: number; time_ms: number }> = {}) {
  return { max_files: 100, max_declared_bytes: 1_000_000, max_file_bytes: 128_000, time_ms: 100, ...overrides };
}

function sequenceClock(values: readonly number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)]!;
}

class BudgetCatalog implements FileCatalogPort {
  readonly entries: readonly FileCatalogEntry[];
  constructor(entries: readonly FileCatalogEntry[]) {
    this.entries = [...entries].sort((left, right) => left.path.localeCompare(right.path));
  }
  async listFiles(input: { after_path?: string; max_rows?: number }) {
    const candidates = input.after_path === undefined
      ? this.entries
      : this.entries.filter((entry) => entry.path > input.after_path!);
    return candidates.slice(0, input.max_rows ?? candidates.length);
  }
  async getFile(input: { path: string }) {
    return this.entries.find((entry) => entry.path === input.path) ?? null;
  }
  async upsertEntry(): Promise<void> { throw new Error("read-only fixture"); }
  async removeEntry(): Promise<void> { throw new Error("read-only fixture"); }
}

class BudgetWorkspace implements WorkspaceFilePort {
  readonly readPaths: string[] = [];
  readonly statFailures = new Set<string>();
  readonly readFailures = new Set<string>();
  constructor(
    private readonly contents: ReadonlyMap<string, string>,
    private readonly entries: readonly FileCatalogEntry[]
  ) {}
  async readText(input: { path: string }) {
    this.readPaths.push(input.path);
    if (this.readFailures.has(input.path)) throw new Error("fixture read failure");
    return this.contents.get(input.path) ?? "";
  }
  async readBinary(input: { path: string }) { return Buffer.from(await this.readText(input)); }
  async stat(input: { path: string }) {
    if (this.statFailures.has(input.path)) throw new Error("fixture stat failure");
    const entry = this.entries.find((candidate) => candidate.path === input.path);
    return {
      exists: entry !== undefined,
      is_file: entry !== undefined,
      size_bytes: entry?.file_identity.size_bytes ?? 0,
      mtime_ms: entry?.file_identity.mtime_ms ?? 0
    };
  }
  async writeText(): Promise<void> { throw new Error("read-only fixture"); }
  async writeBinary(): Promise<void> { throw new Error("read-only fixture"); }
  async deletePath(): Promise<void> { throw new Error("read-only fixture"); }
  async ensureDirectory(): Promise<void> { throw new Error("read-only fixture"); }
}

function emptyGraph(targetPath: string): GraphQueryPort {
  const target: GraphNode = {
    id: "budget-target-node",
    kind: "function",
    name: TARGET_NAME,
    qualified_name: TARGET_NAME,
    file_path: targetPath,
    language: "typescript",
    source_range: { start_line: 1, start_column: 0, end_line: 1, end_column: TARGET_NAME.length },
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
    traverse: async () => ({ start_node_ids: [target.id], nodes: [target], edges: [], reached_depth: 0, truncated: false })
  };
}

function publishedSnapshots(): SnapshotPort & SnapshotPublicationPort {
  const snapshot = {
    id: SNAPSHOT_ID,
    repo_root: REPO_ROOT,
    workspace_root: REPO_ROOT,
    repo_identity: REPO_ROOT,
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
      repo_root: REPO_ROOT,
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
