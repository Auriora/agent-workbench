/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findReferences } from "../../src/application/use-cases/find-references.js";
import type { GraphNode } from "../../src/domain/models/index.js";
import { createReferenceCursorCodec } from "../../src/infrastructure/runtime/index.js";
import { permissiveWorkspaceSafety } from "../helpers/permissive-workspace-safety.js";
import type {
  FileCatalogPort,
  GraphQueryPort,
  ReferenceCursorCodecPort,
  SnapshotPort,
  SnapshotPublicationPort
} from "../../src/ports/index.js";

const FIXTURE_ROOT = path.resolve("tests/fixtures/fixture-reference-completeness");

describe("reference-completeness boundary fixtures", () => {
  it("models row 101 and each file-atomic classification without materializing filler files", () => {
    const catalogPaths = [
      "catalog/001-codex-session-start.js",
      "catalog/002-claude-session-start.js",
      ...Array.from(
        { length: 98 },
        (_, index) => `catalog/${String(index + 3).padStart(3, "0")}-virtual-filler.txt`
      ),
      "catalog/101-session-start-consumers.fixture.ts",
      "catalog/102-missing-after-row-100.ts",
      "catalog/103-same-line-double.ts",
      "catalog/104-oversized-reference.ts",
      "catalog/105-unreadable-reference.ts",
      "catalog/106-changed-reference.ts",
      "generated/107-policy-excluded-reference.ts"
    ];

    expect(catalogPaths).toHaveLength(107);
    expect(catalogPaths[99]).toBe("catalog/100-virtual-filler.txt");
    expect(catalogPaths[100]).toBe("catalog/101-session-start-consumers.fixture.ts");
    expect(catalogPaths[101]).toBe("catalog/102-missing-after-row-100.ts");

    expect(fs.existsSync(path.join(FIXTURE_ROOT, catalogPaths[100]!))).toBe(true);
    expect(fs.existsSync(path.join(FIXTURE_ROOT, catalogPaths[101]!))).toBe(false);
    expect(fs.existsSync(path.join(FIXTURE_ROOT, catalogPaths[102]!))).toBe(true);
    expect(fs.existsSync(path.join(FIXTURE_ROOT, catalogPaths[103]!))).toBe(true);
    expect(fs.existsSync(path.join(FIXTURE_ROOT, catalogPaths[104]!))).toBe(true);
    expect(fs.existsSync(path.join(FIXTURE_ROOT, catalogPaths[105]!))).toBe(true);
    expect(fs.existsSync(path.join(FIXTURE_ROOT, catalogPaths[106]!))).toBe(true);

    const firstWindow = catalogPaths.slice(0, 100);
    const continuation = catalogPaths.filter((candidate) => candidate > firstWindow.at(-1)!);
    expect(firstWindow).toHaveLength(100);
    expect(continuation[0]).toBe("catalog/101-session-start-consumers.fixture.ts");
    expect(continuation).toContain("generated/107-policy-excluded-reference.ts");
  });

  it("locks the configured boundary identity and classification evidence", () => {
    const boundaries = JSON.parse(
      fs.readFileSync(path.join(FIXTURE_ROOT, "catalog-boundaries.json"), "utf8")
    );

    expect(boundaries.missing_after_row_100).toEqual({
      path: "catalog/102-missing-after-row-100.ts",
      catalog_row: 102,
      read_outcome: "missing"
    });
    expect(boundaries.oversized).toMatchObject({
      declared_size_bytes: 128_001,
      classification: "searchable_unresolved"
    });
    expect(boundaries.oversized.declared_size_bytes).toBeGreaterThan(128_000);
    expect(boundaries.unreadable).toMatchObject({
      read_outcome: "read_failure",
      classification: "searchable_unresolved"
    });
    expect(boundaries.changed.indexed_content_hash).not.toBe(
      boundaries.changed.observed_content_hash
    );
    expect(boundaries.changed.classification).toBe("searchable_unresolved");
    expect(boundaries.policy_excluded).toEqual({
      path: "generated/107-policy-excluded-reference.ts",
      indexed: false,
      reason: "generated_or_vendor",
      classification: "outside_evidence_universe"
    });
  });

  for (const route of ["outgoing", "incoming", "unresolved"] as const) {
    it(`${route} parser references prove zero, exact-limit, limit-plus-one, and multi-page exhaustion`, async () => {
      for (const count of [0, 2, 3, 7]) {
        const fixture = parserFixture(route, count);
        const pages = await collectParserPages(fixture);
        const routeHits = pages.references.filter((reference) => parserRoute(reference) === route);
        expect(routeHits).toHaveLength(count);
        expectParserPageBoundaries(fixture, pages.pages);
        expect(pages.coverage).toMatchObject({
          state: "complete",
          route: "parser",
          route_exhaustion: { outgoing: true, incoming: true, unresolved: true },
          stop_reason: "route_exhausted"
        });
      }
    });
  }

  it("drains mixed parser routes outgoing, incoming, then unresolved without lexical fallback", async () => {
    const fixture = parserFixture("mixed", 2);
    const pages = await collectParserPages(fixture);

    expect(pages.references.map(parserRoute)).toEqual([
      "outgoing", "outgoing", "incoming", "incoming", "unresolved", "unresolved"
    ]);
    expect(pages.references.every((reference) => reference.provenance !== "bounded_lexical_identifier_scan")).toBe(true);
    expectParserPageBoundaries(fixture, pages.pages);
    expect(fixture.calls.map(({ route }) => route)).toEqual(["outgoing", "incoming", "unresolved"]);
    expect(pages.pages.map((page) => page.references.references.map(parserRoute))).toEqual([
      ["outgoing", "outgoing"],
      ["incoming", "incoming"],
      ["unresolved", "unresolved"]
    ]);
    expect(pages.pages.map((page) => coverageFor(page).route_exhaustion)).toEqual([
      { outgoing: true, incoming: false, unresolved: false },
      { outgoing: true, incoming: true, unresolved: false },
      { outgoing: true, incoming: true, unresolved: true }
    ]);
  });

  it("preserves disjoint composite progress, deterministic replay, and key-epoch expiry", async () => {
    const fixture = parserFixture("mixed", 2);
    const first = await parserQuery(fixture);
    expect(first.references.coverage_status).toBe("evidence_backed");
    expect(first.references.cursor).toEqual(expect.any(String));
    const decoded = fixture.codec.decode(first.references.cursor!);
    expect(decoded).toMatchObject({
      ok: true,
      payload: {
        kind: "parser_composite",
        current_route: "incoming",
        route_offsets: { outgoing: 2, incoming: 0, unresolved: 0 },
        route_exhaustion: { outgoing: true, incoming: false, unresolved: false }
      }
    });

    const replayLeft = await parserQuery(fixture, first.references.cursor);
    const replayRight = await parserQuery(fixture, first.references.cursor);
    expect(replayRight.references).toEqual(replayLeft.references);

    const restarted = { ...fixture, codec: createReferenceCursorCodec({ key: Buffer.alloc(32, 92), key_epoch: "epoch-b" }) };
    const expired = await parserQuery(restarted, first.references.cursor);
    expect(expired.meta).toMatchObject({ analysis_validity: "invalid", verification_status: "blocked" });
    expect(expired.references.references).toEqual([]);
    expect(expired.errors).toEqual([expect.objectContaining({ code: "cursor_expired", retryable: false })]);
  });
});

type ParserRoute = "outgoing" | "incoming" | "unresolved";
type ParserCounts = Record<ParserRoute, number>;
type ParserCall = {
  page: number;
  route: ParserRoute;
  max_rows: number;
  offset: number;
  exclude_source_node_id?: string;
};
type ParserFixture = {
  graph: GraphQueryPort;
  catalog: FileCatalogPort;
  snapshots: SnapshotPort & SnapshotPublicationPort;
  codec: ReferenceCursorCodecPort;
  calls: ParserCall[];
  counts: ParserCounts;
  pageState: { active: number };
};

function parserFixture(route: ParserRoute | "mixed", count: number): ParserFixture {
  const counts: ParserCounts = route === "mixed"
    ? { outgoing: count, incoming: count, unresolved: count }
    : count > 0
      ? {
          outgoing: route === "outgoing" ? count : 0,
          incoming: route === "incoming" ? count : 0,
          unresolved: route === "unresolved" ? count : 0
        }
      : route === "outgoing"
        ? { outgoing: 0, incoming: 1, unresolved: 0 }
        : route === "incoming"
          ? { outgoing: 0, incoming: 0, unresolved: 1 }
          : { outgoing: 0, incoming: 1, unresolved: 0 };
  const target = parserNode("target", "src/target.ts");
  const calls: ParserCall[] = [];
  const pageState = { active: 0 };
  const sourceNodes = Array.from({ length: counts.incoming }, (_, index) => parserNode(`incoming-${index}`, `src/in-${index}.ts`));
  const graph: GraphQueryPort = {
    getNode: async ({ node_id }) => node_id === target.id ? target : sourceNodes.find((node) => node.id === node_id) ?? null,
    findNodesByName: async () => [target],
    findNodesByQualifiedName: async () => [target],
    searchNodes: async () => [target],
    getNodesInRange: async () => [target],
    getOutgoingEdges: async () => [],
    getReferences: async ({ max_rows, offset }) => {
      calls.push({ page: pageState.active, route: "outgoing", max_rows: max_rows ?? 50, offset: offset ?? 0 });
      return Array.from({ length: counts.outgoing }, (_, index) => ({
      source_node_id: target.id,
      target_node_id: `outgoing-${index}`,
      target_file_path: `src/out-${index}.ts`,
      edge_id: `out-edge-${index}`,
      confidence: 0.9,
      provenance: "tree-sitter-typescript"
      })).slice(offset ?? 0, (offset ?? 0) + (max_rows ?? counts.outgoing));
    },
    getIncomingEdges: async ({ max_rows, offset, exclude_source_node_id }) => {
      calls.push({ page: pageState.active, route: "incoming", max_rows: max_rows ?? 50,
        offset: offset ?? 0, exclude_source_node_id });
      return sourceNodes.map((source, index) => ({
      id: `in-edge-${index}`,
      source_node_id: source.id,
      target_node_id: target.id,
      kind: "call",
      source_range: { start_line: index + 1, start_column: 0, end_line: index + 1, end_column: 1 },
      provenance: "tree-sitter-typescript",
      confidence: 0.9,
      metadata: { reference_name: target.name }
      })).slice(offset ?? 0, (offset ?? 0) + (max_rows ?? counts.incoming));
    },
    getUnresolvedReferences: async ({ max_rows, offset }) => {
      calls.push({ page: pageState.active, route: "unresolved", max_rows: max_rows ?? 50, offset: offset ?? 0 });
      return Array.from({ length: counts.unresolved }, (_, index) => ({
      id: `unresolved-${index}`,
      source_node_id: `unresolved-source-${index}`,
      source_file_path: `src/unresolved-${index}.ts`,
      reference_name: target.name,
      reference_kind: "call",
      source_range: { start_line: index + 1, start_column: 0, end_line: index + 1, end_column: 1 },
      candidate_metadata: { resolution: "missing" }
      })).slice(offset ?? 0, (offset ?? 0) + (max_rows ?? counts.unresolved));
    },
    traverse: async () => ({ start_node_ids: [target.id], nodes: [target], edges: [], reached_depth: 0, truncated: false })
  };
  return {
    graph,
    catalog: emptyCatalog(),
    snapshots: parserSnapshots(),
    codec: createReferenceCursorCodec({ key: Buffer.alloc(32, 91), key_epoch: "epoch-a" }),
    calls,
    counts,
    pageState
  };
}

async function parserQuery(fixture: ParserFixture, cursor?: string) {
  fixture.pageState.active += 1;
  return findReferences({
    request: { node_id: "target", repo_root: "/parser-fixture", max_depth: 1, max_results: 2, cursor },
    graph: fixture.graph,
    snapshots: fixture.snapshots,
    catalog: fixture.catalog,
    workspace_safety: permissiveWorkspaceSafety,
    cursor_codec: fixture.codec,
    snapshot_validity: {
      snapshot_id: "parser-snapshot",
      state: "valid",
      complete: true,
      checked_path_count: 1,
      observed_path_count: 1,
      missing_paths: [],
      inaccessible_paths: [],
      refresh_required: false
    },
    default_repo_root: "/parser-fixture"
  });
}

async function collectParserPages(fixture: ParserFixture) {
  const references = [];
  const pages: Awaited<ReturnType<typeof parserQuery>>[] = [];
  let cursor: string | undefined;
  let coverage;
  for (let page = 0; page < 20; page += 1) {
    const result = await parserQuery(fixture, cursor);
    pages.push(result);
    references.push(...result.references.references);
    if (result.references.coverage_status === "evidence_backed") coverage = result.references.coverage;
    cursor = result.references.cursor;
    if (cursor === undefined) return { references, coverage, pages };
  }
  throw new Error("Parser pagination did not terminate.");
}

function coverageFor(result: Awaited<ReturnType<typeof parserQuery>>) {
  expect(result.references.coverage_status).toBe("evidence_backed");
  if (result.references.coverage_status !== "evidence_backed") throw new Error("Expected evidence-backed coverage.");
  return result.references.coverage;
}

function expectParserPageBoundaries(
  fixture: ParserFixture,
  pages: readonly Awaited<ReturnType<typeof parserQuery>>[]
): void {
  expect(pages.length).toBeGreaterThan(0);
  const routeOrder = ["outgoing", "incoming", "unresolved"] as const;
  const globalRouteIndices = fixture.calls.map((call) => routeOrder.indexOf(call.route));
  expect(globalRouteIndices).toEqual([...globalRouteIndices].sort((left, right) => left - right));
  for (const [index, page] of pages.entries()) {
    const pageNumber = index + 1;
    const coverage = coverageFor(page);
    const calls = fixture.calls.filter((call) => call.page === pageNumber);
    let emittedBeforeCall = 0;
    let priorRouteIndex = -1;
    for (const [callIndex, call] of calls.entries()) {
      const routeIndex = routeOrder.indexOf(call.route);
      expect(routeIndex).toBeGreaterThanOrEqual(priorRouteIndex);
      priorRouteIndex = routeIndex;
      expect(call.max_rows).toBe(2 - emittedBeforeCall + 1);
      if (call.route === "incoming") expect(call.exclude_source_node_id).toBe("target");
      const available = Math.max(0, fixture.counts[call.route] - call.offset);
      const returned = Math.min(available, call.max_rows);
      emittedBeforeCall += Math.min(returned, 2 - emittedBeforeCall);
      if (returned === call.max_rows) expect(callIndex).toBe(calls.length - 1);
    }
    expect(page.references.references).toHaveLength(emittedBeforeCall);
    expect(page.references.references.length).toBeLessThanOrEqual(2);
    expect(coverage.page_matches).toBe(page.references.references.length);
    expect(coverage.matched_so_far).toBe(
      pages.slice(0, pageNumber).reduce((total, candidate) => total + candidate.references.references.length, 0)
    );

    if (index < pages.length - 1) {
      expect(coverage).toMatchObject({ state: "partial", route: "parser", stop_reason: "result" });
      expect(page.references.cursor).toEqual(expect.any(String));
      const decoded = fixture.codec.decode(page.references.cursor!);
      expect(decoded.ok).toBe(true);
      if (decoded.ok) {
        expect(decoded.payload.kind).toBe("parser_composite");
        if (decoded.payload.kind === "parser_composite") {
          expect(decoded.payload.combined_rows_returned).toBe(coverage.matched_so_far);
          expect(decoded.payload.route_offsets).toEqual({
            outgoing: pages.slice(0, pageNumber).flatMap((candidate) => candidate.references.references)
              .filter((reference) => parserRoute(reference) === "outgoing").length,
            incoming: pages.slice(0, pageNumber).flatMap((candidate) => candidate.references.references)
              .filter((reference) => parserRoute(reference) === "incoming").length,
            unresolved: pages.slice(0, pageNumber).flatMap((candidate) => candidate.references.references)
              .filter((reference) => parserRoute(reference) === "unresolved").length
          });
          expect(decoded.payload.route_exhaustion).toEqual(coverage.route_exhaustion);
        }
      }
    } else {
      expect(page.references.cursor).toBeUndefined();
      expect(coverage).toMatchObject({
        state: "complete",
        route: "parser",
        route_exhaustion: { outgoing: true, incoming: true, unresolved: true },
        stop_reason: "route_exhausted"
      });
    }
  }
}

function parserRoute(reference: { provenance: string; source_file_path?: string }): ParserRoute {
  if (reference.provenance === "unresolved_reference") return "unresolved";
  if (reference.source_file_path?.startsWith("src/in-")) return "incoming";
  return "outgoing";
}

function parserNode(id: string, filePath: string): GraphNode {
  return {
    id,
    kind: "function",
    name: id === "target" ? "targetSymbol" : id,
    qualified_name: id,
    file_path: filePath,
    language: "typescript",
    source_range: { start_line: 1, start_column: 0, end_line: 1, end_column: 1 },
    metadata: {}
  };
}

function emptyCatalog(): FileCatalogPort {
  return {
    listFiles: async () => [],
    getFile: async () => null,
    upsertEntry: async () => undefined,
    removeEntry: async () => undefined
  };
}

function parserSnapshots(): SnapshotPort & SnapshotPublicationPort {
  const snapshot = {
    id: "parser-snapshot",
    repo_root: "/parser-fixture",
    workspace_root: "/parser-fixture",
    repo_identity: "/parser-fixture",
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
    publication: { repo_root: snapshot.repo_root, snapshot_id: snapshot.id, controller_generation: 1,
      invalidation_generation: 1, state: "published" as const, updated_at: snapshot.updated_at }
  };
  return {
    getSnapshot: async () => snapshot,
    listSnapshots: async () => [snapshot],
    upsertSnapshot: async () => undefined,
    markSnapshotFreshness: async () => undefined,
    allocateBuildSnapshotId: async () => snapshot.id,
    transitionBuild: async (input) => ({ ...input, state: input.to }),
    getLatestPublished: async () => selected,
    readExplicit: async () => selected
  };
}
