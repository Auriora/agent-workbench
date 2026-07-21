/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { findReferences } from "../../src/application/use-cases/find-references.js";
import type { ReferenceCursorPayload } from "../../src/contracts/index.js";
import type { FileCatalogEntry, GraphNode } from "../../src/domain/models/index.js";
import { createReferenceCursorCodec } from "../../src/infrastructure/runtime/index.js";
import { buildFindReferencesEnvelope } from "../../src/presentation/find-references-presenter.js";
import { permissiveWorkspaceSafety } from "../helpers/permissive-workspace-safety.js";
import type {
  FileCatalogPort,
  GraphQueryPort,
  SnapshotPort,
  SnapshotPublicationPort,
  WorkspaceFilePort
} from "../../src/ports/index.js";

const REPO_ROOT = "/fixture-reference-pagination";
const SNAPSHOT_ID = "reference-pagination-snapshot";
const TARGET_NAME = "referenceTarget";

describe("reference lexical pagination properties", () => {
  for (const seed of [1, 7, 19, 41, 73]) {
    it(`concatenates seeded pages without omissions or duplicates (seed ${seed})`, async () => {
      const fixture = seededFixture(seed);
      const complete = await query(fixture, 100);
      const paged = await collectPages(fixture, 1 + (seed % 4));

      expect(keys(paged)).toEqual(keys(complete.references.references));
      expect(new Set(keys(paged)).size).toBe(paged.length);
      expect(keys(paged)).toEqual([...keys(paged)].sort(compareOccurrenceKeys));
    });
  }

  it("replays the same continuation deterministically", async () => {
    const fixture = seededFixture(97);
    const first = await query(fixture, 2);
    expect(first.references.cursor).toEqual(expect.any(String));

    const left = await query(fixture, 2, first.references.cursor);
    const right = await query(fixture, 2, first.references.cursor);

    expect(right.references).toEqual(left.references);
    expect(right.meta).toEqual(left.meta);
  });

  it("reconciles every page and sequence counter across a result replay through the public envelope", async () => {
    const firstText = `${TARGET_NAME}; ${TARGET_NAME}; ${TARGET_NAME};`;
    const secondText = `${TARGET_NAME};`;
    const contents = new Map([
      ["src/00.ts", firstText],
      ["src/01.ts", secondText]
    ]);
    const fixture = fixtureFromContents(contents);

    const limits = { max_files: 5, max_declared_bytes: 10_000, max_file_bytes: 2_000, time_ms: 10 };
    const first = buildFindReferencesEnvelope(await query(fixture, 2, undefined, { clock: () => 0, limits }));
    expect(first.data.coverage_status).toBe("evidence_backed");
    if (first.data.coverage_status !== "evidence_backed") throw new Error("Expected evidence-backed coverage.");
    expect(first.data.coverage).toMatchObject({
      state: "partial",
      page: accountingReceipt(1, 1, 0, Buffer.byteLength(firstText), Buffer.byteLength(firstText), 2),
      sequence: accountingReceipt(1, 1, 0, Buffer.byteLength(firstText), Buffer.byteLength(firstText), 2),
      searchable_candidates_classified: { page: 1, sequence: 1 },
      page_matches: 2,
      matched_so_far: 2,
      continuation_kind: "lexical_result"
    });
    expect(first.data.coverage.complete_matches).toBeUndefined();

    const second = buildFindReferencesEnvelope(await query(fixture, 2, first.data.cursor, { clock: () => 0, limits }));
    expect(second.data.coverage_status).toBe("evidence_backed");
    if (second.data.coverage_status !== "evidence_backed") throw new Error("Expected evidence-backed coverage.");
    expect(second.data.coverage).toMatchObject({
      state: "complete",
      page: accountingReceipt(
        1, 2, 1,
        Buffer.byteLength(firstText) + Buffer.byteLength(secondText),
        Buffer.byteLength(firstText) + Buffer.byteLength(secondText),
        2
      ),
      sequence: accountingReceipt(
        2, 3, 1,
        (2 * Buffer.byteLength(firstText)) + Buffer.byteLength(secondText),
        (2 * Buffer.byteLength(firstText)) + Buffer.byteLength(secondText),
        4
      ),
      searchable_candidates_classified: { page: 1, sequence: 2 },
      languages_inspected: ["typescript"],
      page_matches: 2,
      matched_so_far: 4,
      complete_matches: 4,
      policy_exclusions: { page: [], sequence: [] },
      unresolved_searchable_candidates: { page: [], sequence: [] },
      stop_reason: "catalog_exhausted"
    });
    expect(second.data.cursor).toBeUndefined();
    expect(second.meta).toMatchObject({ analysis_validity: "valid", truncated: false });
  });

  it.each(["missing", "read_failure", "oversized", "changed"] as const)(
    "advances a %s candidate once and carries unresolved evidence onto the next page",
    async (reason) => {
      const fixture = failedCandidateFixture(reason);
      const limits = { max_files: 5, max_declared_bytes: 10_000, max_file_bytes: 2_000, time_ms: 10 };
      const first = await query(fixture, 10, undefined, { clock: failureClock(reason), limits });
      expect(first.references.coverage_status).toBe("evidence_backed");
      if (first.references.coverage_status !== "evidence_backed") throw new Error("Expected evidence-backed coverage.");
      expect(first.references.coverage).toMatchObject({
        state: "partial",
        searchable_candidates_classified: { page: 1, sequence: 1 },
        page: {
          unique_files_inspected: 0,
          file_read_attempts: reason === "missing" || reason === "oversized" ? 0 : 1
        },
        unresolved_searchable_candidates: {
          page: [{ reason, count: 1 }],
          sequence: [{ reason, count: 1 }]
        },
        stop_reason: "time"
      });
      const decoded = fixture.cursorCodec.decode(first.references.cursor!);
      expect(decoded).toMatchObject({ ok: true, payload: { kind: "lexical_scan", after_path: "src/00.ts" } });

      const second = await query(fixture, 10, first.references.cursor, { clock: () => 0, limits });
      expect(second.references.coverage_status).toBe("evidence_backed");
      if (second.references.coverage_status !== "evidence_backed") throw new Error("Expected evidence-backed coverage.");
      expect(second.references.coverage).toMatchObject({
        state: "partial",
        catalog_exhausted: true,
        searchable_candidates_classified: { page: 1, sequence: 2 },
        page: { unique_files_inspected: 1, file_read_attempts: 1 },
        sequence: { unique_files_inspected: 1 },
        unresolved_searchable_candidates: {
          page: [],
          sequence: [{ reason, count: 1 }]
        }
      });
      expect(second.references.cursor).toBeUndefined();
      expect(second.references.references).toHaveLength(1);
    }
  );
});

describe("authenticated reference cursor properties", () => {
  it("round-trips seeded result-cursor states deterministically", () => {
    const codec = createReferenceCursorCodec({ key: Buffer.alloc(32, 42), key_epoch: "epoch-a" });
    for (const seed of [2, 11, 23, 47, 89]) {
      const payload = lexicalResultPayload(seed);
      const cursor = codec.encode(payload);
      expect(codec.encode(payload)).toBe(cursor);
      expect(codec.decode(cursor)).toEqual({ ok: true, payload });
    }
  });

  it("rejects authenticated ordinal, counter, route-state, and tag tampering", () => {
    const codec = createReferenceCursorCodec({ key: Buffer.alloc(32, 43), key_epoch: "epoch-a" });
    const resultCursor = codec.encode(lexicalResultPayload(5));
    expect(codec.decode(tamperPayload(resultCursor, (payload) => {
      payload.next_occurrence_ordinal = 99;
    }))).toEqual({ ok: false, code: "invalid_cursor" });
    expect(codec.decode(tamperPayload(resultCursor, (payload) => {
      payload.totals.matched_so_far = 99;
    }))).toEqual({ ok: false, code: "invalid_cursor" });

    const parserCursor = codec.encode(parserPayload());
    expect(codec.decode(tamperPayload(parserCursor, (payload) => {
      payload.current_route = "unresolved";
    }))).toEqual({ ok: false, code: "invalid_cursor" });
    expect(codec.decode(tamperTag(parserCursor))).toEqual({ ok: false, code: "invalid_cursor" });
  });

  it("expires a cursor after a daemon key-epoch restart", () => {
    const original = createReferenceCursorCodec({ key: Buffer.alloc(32, 44), key_epoch: "epoch-a" });
    const restarted = createReferenceCursorCodec({ key: Buffer.alloc(32, 45), key_epoch: "epoch-b" });
    expect(restarted.decode(original.encode(lexicalResultPayload(3)))).toEqual({
      ok: false,
      code: "cursor_expired"
    });
  });

  it("routes authenticated lexical scan and result cursors through findReferences without legacy offset fallback", async () => {
    const fixture = seededFixture(97);
    const kinds = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < 100; page += 1) {
      const result = await query(fixture, 3, cursor);
      cursor = result.references.cursor;
      if (cursor === undefined) break;
      const decoded = fixture.cursorCodec.decode(cursor);
      expect(decoded.ok).toBe(true);
      if (decoded.ok) kinds.add(decoded.payload.kind);
    }
    expect(kinds).toContain("lexical_result");
    expect(kinds).toContain("lexical_scan");
  });

  it("rejects a query cursor when request bounds differ from its authenticated identity", async () => {
    const fixture = seededFixture(97);
    const first = await query(fixture, 2);
    const mismatched = await query(fixture, 3, first.references.cursor);

    expect(mismatched.references.references).toEqual([]);
    expect(mismatched.references.cursor).toBeUndefined();
    expect(mismatched.meta).toMatchObject({ analysis_validity: "invalid", verification_status: "blocked" });
    expect(mismatched.errors).toEqual([expect.objectContaining({ code: "invalid_cursor", retryable: false })]);
  });

  it.each([
    ["snapshot", (payload: any) => { payload.snapshot_id = "other-snapshot"; }],
    ["target", (payload: any) => { payload.target_node_id = "other-target"; }],
    ["counter", (payload: any) => { payload.totals.matched_so_far = 99; }],
    ["route", (payload: any) => { payload.current_route = "unresolved"; }]
  ] as const)("rejects a validly authenticated mismatched %s payload", async (_label, mutate) => {
    const fixture = seededFixture(97);
    const payload = _label === "route" ? parserPayload() : lexicalResultPayload(5);
    const cursor = resignPayload(fixture.cursorKey, fixture.cursorCodec.key_epoch, payload, mutate);
    const result = await query(fixture, 3, cursor);
    expect(result.references.references).toEqual([]);
    expect(result.meta).toMatchObject({ analysis_validity: "invalid", verification_status: "blocked" });
    expect(result.errors).toEqual([expect.objectContaining({ code: "invalid_cursor", retryable: false })]);
  });

  it.each(["changed", "deleted"] as const)("blocks a %s result file replay without restarting", async (mode) => {
    const contents = new Map([["src/00.ts", `${TARGET_NAME}; ${TARGET_NAME}; ${TARGET_NAME};`]]);
    const fixture = fixtureFromContents(contents);
    const first = await query(fixture, 2);
    expect(first.references.cursor).toEqual(expect.any(String));
    if (mode === "deleted") contents.delete("src/00.ts");
    else contents.set("src/00.ts", `${TARGET_NAME}; changed____; ${TARGET_NAME};`);

    const replay = buildFindReferencesEnvelope(await query(fixture, 2, first.references.cursor));
    expect(replay.data.references).toEqual([]);
    expect(replay.data.cursor).toBeUndefined();
    expect(replay.meta).toMatchObject({ analysis_validity: "partial", verification_status: "blocked", truncated: true });
    expect(replay.data.coverage_status === "evidence_backed" &&
      replay.data.coverage.unresolved_searchable_candidates.sequence).toEqual([
      { reason: mode === "deleted" ? "missing" : "changed", count: 1 }
    ]);
  });
});

type Fixture = {
  catalog: FileCatalogPort;
  graph: GraphQueryPort;
  snapshots: SnapshotPort & SnapshotPublicationPort;
  workspace: WorkspaceFilePort;
  cursorCodec: ReturnType<typeof createReferenceCursorCodec>;
  cursorKey: Buffer;
};

function seededFixture(seed: number): Fixture {
  let state = seed >>> 0;
  const next = (): number => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state;
  };
  const contents = new Map<string, string>();
  const fileCount = 3 + (next() % 5);
  for (let fileIndex = 0; fileIndex < fileCount; fileIndex += 1) {
    const path = `src/${String(fileIndex).padStart(2, "0")}.ts`;
    const lineCount = 1 + (next() % 4);
    const lines = Array.from({ length: lineCount }, (_, lineIndex) => {
      const occurrenceCount = 1 + (next() % 3);
      return Array.from(
        { length: occurrenceCount },
        (_, ordinal) => `const value_${lineIndex}_${ordinal} = ${TARGET_NAME};`
      ).join(" ");
    });
    contents.set(path, lines.join("\n"));
  }
  const catalog = new DeterministicCatalog(contents);
  const cursorKey = Buffer.alloc(32, 46);
  return {
    catalog,
    graph: emptyGraph(),
    snapshots: publishedSnapshots(),
    workspace: new DeterministicWorkspace(contents),
    cursorCodec: createReferenceCursorCodec({ key: cursorKey, key_epoch: "epoch-a" }),
    cursorKey
  };
}

function fixtureFromContents(contents: Map<string, string>): Fixture {
  const cursorKey = Buffer.alloc(32, 46);
  return {
    catalog: new DeterministicCatalog(contents),
    graph: emptyGraph(),
    snapshots: publishedSnapshots(),
    workspace: new DeterministicWorkspace(contents),
    cursorCodec: createReferenceCursorCodec({ key: cursorKey, key_epoch: "epoch-a" }),
    cursorKey
  };
}

function failedCandidateFixture(reason: "missing" | "read_failure" | "oversized" | "changed"): Fixture {
  const safeText = `${TARGET_NAME};`;
  const failureText = reason === "changed" ? "changedTargetXX" : TARGET_NAME;
  const entries: FileCatalogEntry[] = [
    {
      path: "src/00.ts",
      indexed: true,
      file_identity: {
        path: "src/00.ts",
        language: "typescript",
        content_hash: reason === "changed" ? sha256("originalTarget") : sha256(failureText),
        size_bytes: reason === "oversized" ? 2_001 : Buffer.byteLength(failureText),
        mtime_ms: 1
      }
    },
    {
      path: "src/01.ts",
      indexed: true,
      file_identity: {
        path: "src/01.ts",
        language: "typescript",
        content_hash: sha256(safeText),
        size_bytes: Buffer.byteLength(safeText),
        mtime_ms: 1
      }
    }
  ];
  const contents = new Map([["src/00.ts", failureText], ["src/01.ts", safeText]]);
  const cursorKey = Buffer.alloc(32, 46);
  return {
    catalog: new ExplicitCatalog(entries),
    graph: emptyGraph(),
    snapshots: publishedSnapshots(),
    workspace: new FailureWorkspace(contents, reason),
    cursorCodec: createReferenceCursorCodec({ key: cursorKey, key_epoch: "epoch-a" }),
    cursorKey
  };
}

function failureClock(reason: "missing" | "read_failure" | "oversized" | "changed"): () => number {
  const values = reason === "oversized" ? [0, 0, 10] : [0, 0, 0, 10];
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)]!;
}

async function query(
  fixture: Fixture,
  maxResults: number,
  cursor?: string,
  options: {
    clock?: () => number;
    limits?: { max_files: number; max_declared_bytes: number; max_file_bytes: number; time_ms: number };
  } = {}
) {
  return findReferences({
    request: {
      node_id: "target-node",
      repo_root: REPO_ROOT,
      max_depth: 1,
      max_results: maxResults,
      cursor
    },
    graph: fixture.graph,
    snapshots: fixture.snapshots,
    catalog: fixture.catalog,
    workspace: fixture.workspace,
    workspace_safety: permissiveWorkspaceSafety,
    cursor_codec: fixture.cursorCodec,
    monotonic_now_ms: options.clock,
    reference_limits: options.limits,
    snapshot_validity: {
      snapshot_id: SNAPSHOT_ID,
      state: "valid",
      complete: true,
      checked_path_count: 1,
      observed_path_count: 1,
      missing_paths: [],
      inaccessible_paths: [],
      refresh_required: false
    },
    default_repo_root: REPO_ROOT
  });
}

function accountingReceipt(unique: number, reads: number, replay: number, declared: number, actual: number, occurrences: number) {
  return { unique_files_inspected: unique, file_read_attempts: reads, replay_reads: replay,
    declared_bytes_admitted: declared, actual_bytes_observed: actual, elapsed_admission_ms: 0, occurrences };
}

async function collectPages(fixture: Fixture, maxResults: number) {
  const references = [];
  let cursor: string | undefined;
  for (let page = 0; page < 100; page += 1) {
    const result = await query(fixture, maxResults, cursor);
    references.push(...result.references.references);
    if (result.references.cursor === undefined) {
      return references;
    }
    cursor = result.references.cursor;
  }
  throw new Error("Reference pagination did not terminate within 100 pages.");
}

function keys(references: readonly { source_file_path?: string; source_range?: { start_line: number; start_column: number } }[]) {
  return references.map((reference) =>
    `${reference.source_file_path}:${reference.source_range?.start_line}:${reference.source_range?.start_column}`
  );
}

function compareOccurrenceKeys(left: string, right: string): number {
  const [leftPath, leftLine, leftColumn] = left.split(":");
  const [rightPath, rightLine, rightColumn] = right.split(":");
  return leftPath!.localeCompare(rightPath!) || Number(leftLine) - Number(rightLine) ||
    Number(leftColumn) - Number(rightColumn);
}

class DeterministicCatalog implements FileCatalogPort {
  readonly entries: readonly FileCatalogEntry[];

  constructor(contents: ReadonlyMap<string, string>) {
    this.entries = [...contents.entries()].map(([path, content]) => ({
      path,
      indexed: true,
      file_identity: {
        path,
        language: "typescript",
        content_hash: sha256(content),
        size_bytes: Buffer.byteLength(content, "utf8"),
        mtime_ms: 1
      }
    })).sort((left, right) => left.path.localeCompare(right.path));
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

class ExplicitCatalog implements FileCatalogPort {
  constructor(private readonly entries: readonly FileCatalogEntry[]) {}
  async listFiles(input: { after_path?: string; max_rows?: number }) {
    const candidates = input.after_path === undefined
      ? this.entries
      : this.entries.filter((entry) => entry.path > input.after_path!);
    return candidates.slice(0, input.max_rows ?? candidates.length);
  }
  async getFile(input: { path: string }) { return this.entries.find((entry) => entry.path === input.path) ?? null; }
  async upsertEntry(): Promise<void> { throw new Error("read-only fixture"); }
  async removeEntry(): Promise<void> { throw new Error("read-only fixture"); }
}

function sha256(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

class DeterministicWorkspace implements WorkspaceFilePort {
  constructor(private readonly contents: ReadonlyMap<string, string>) {}
  async readText(input: { path: string }) { return this.contents.get(input.path) ?? ""; }
  async readBinary(input: { path: string }) { return Buffer.from(await this.readText(input)); }
  async stat(input: { path: string }) {
    const content = this.contents.get(input.path);
    return { exists: content !== undefined, is_file: content !== undefined, size_bytes: Buffer.byteLength(content ?? ""), mtime_ms: 1 };
  }
  async writeText(): Promise<void> { throw new Error("read-only fixture"); }
  async writeBinary(): Promise<void> { throw new Error("read-only fixture"); }
  async deletePath(): Promise<void> { throw new Error("read-only fixture"); }
  async ensureDirectory(): Promise<void> { throw new Error("read-only fixture"); }
}

class FailureWorkspace extends DeterministicWorkspace {
  constructor(contents: ReadonlyMap<string, string>, private readonly reason: "missing" | "read_failure" | "oversized" | "changed") {
    super(contents);
  }
  override async stat(input: { path: string }) {
    if (input.path === "src/00.ts" && this.reason === "missing") {
      return { exists: false, is_file: false, size_bytes: 0, mtime_ms: 0 };
    }
    return super.stat(input);
  }
  override async readText(input: { path: string }) {
    if (input.path === "src/00.ts" && this.reason === "read_failure") throw new Error("fixture unreadable");
    return super.readText(input);
  }
}

function emptyGraph(): GraphQueryPort {
  const target: GraphNode = {
    id: "target-node",
    kind: "function",
    name: TARGET_NAME,
    qualified_name: TARGET_NAME,
    file_path: "src/00.ts",
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

function cursorIdentity() {
  return {
    version: 1 as const,
    key_epoch: "epoch-a",
    snapshot_id: SNAPSHOT_ID,
    target_node_id: "target-node",
    target_name: TARGET_NAME,
    bounds: {
      max_depth: 1,
      max_results: 3,
      max_files: 100,
      max_declared_bytes: 1_000_000,
      max_file_bytes: 128_000,
      time_ms: 100
    }
  };
}

function lexicalResultPayload(seed: number): ReferenceCursorPayload {
  return {
    ...cursorIdentity(),
    kind: "lexical_result",
    after_path: `src/${seed}.ts`,
    result_path: `src/${seed}.ts`,
    result_file_identity: { content_hash: `hash-${seed}`, size_bytes: seed + 10, language: "typescript" },
    next_occurrence_ordinal: 1 + (seed % 7),
    totals: {
      accounting: {
        unique_files_inspected: 1,
        file_read_attempts: 1,
        replay_reads: 0,
        declared_bytes_admitted: seed + 10,
        actual_bytes_observed: seed + 10,
        elapsed_admission_ms: seed % 20,
        occurrences: seed % 5
      },
      matched_so_far: seed % 5,
      searchable_candidates_classified: 1,
      policy_exclusions: [],
      unresolved_searchable_candidates: [],
      languages_inspected: ["typescript"]
    }
  };
}

function parserPayload(): ReferenceCursorPayload {
  return {
    ...cursorIdentity(),
    kind: "parser_composite",
    current_route: "incoming",
    route_offsets: { outgoing: 2, incoming: 1, unresolved: 0 },
    route_exhaustion: { outgoing: true, incoming: false, unresolved: false },
    combined_rows_returned: 3
  };
}

function tamperPayload(cursor: string, mutate: (payload: Record<string, any>) => void): string {
  const envelope = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(envelope.payload, "base64url").toString("utf8"));
  mutate(payload);
  envelope.payload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
}

function tamperTag(cursor: string): string {
  const envelope = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  envelope.tag = `${envelope.tag.slice(0, -1)}${envelope.tag.endsWith("A") ? "B" : "A"}`;
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
}

function resignPayload(
  key: Buffer,
  keyEpoch: string,
  original: ReferenceCursorPayload,
  mutate: (payload: any) => void
): string {
  const payload = structuredClone(original) as any;
  payload.key_epoch = keyEpoch;
  mutate(payload);
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const tag = createHmac("sha256", key)
    .update("reference-cursor-v1\n", "utf8")
    .update(keyEpoch, "utf8")
    .update("\n", "utf8")
    .update(encodedPayload, "utf8")
    .digest("base64url");
  return Buffer.from(JSON.stringify({ version: 1, key_epoch: keyEpoch, payload: encodedPayload, tag }), "utf8")
    .toString("base64url");
}
