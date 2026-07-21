/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import {
  findReferencesResultSchema,
  lexicalResultCursorPayloadSchema,
  lexicalScanCursorPayloadSchema,
  parserCompositeCursorPayloadSchema,
  referenceCoverageReceiptSchema,
  referenceStopReasonSchema,
  responseMetadataSchema,
  type ReferenceCoverageReceipt,
  type ReferenceCursorPayload
} from "../../src/contracts/index.js";
import { createReferenceCursorCodec } from "../../src/infrastructure/runtime/index.js";

describe("reference completeness contracts", () => {
  it("accepts only exhausted, unresolved-free evidence as complete", () => {
    expect(referenceCoverageReceiptSchema.parse(completeLexicalCoverage())).toEqual(
      completeLexicalCoverage()
    );
    expect(referenceCoverageReceiptSchema.safeParse({
      ...completeLexicalCoverage(),
      catalog_exhausted: false
    }).success).toBe(false);
    expect(referenceCoverageReceiptSchema.safeParse({
      ...completeLexicalCoverage(),
      searchable_candidates_classified: { page: 2, sequence: 2 },
      unresolved_searchable_candidates: {
        page: [{ reason: "missing", count: 1 }],
        sequence: [{ reason: "missing", count: 1 }]
      }
    }).success).toBe(false);
    expect(referenceCoverageReceiptSchema.safeParse({
      ...completeLexicalCoverage(),
      continuation_kind: "lexical_scan"
    }).success).toBe(false);
  });

  it("requires independent parser-route exhaustion before complete evidence", () => {
    const parserCoverage: ReferenceCoverageReceipt = {
      ...completeLexicalCoverage(),
      route: "parser",
      catalog_exhausted: undefined,
      route_exhaustion: { outgoing: true, incoming: true, unresolved: true },
      stop_reason: "route_exhausted"
    };
    expect(referenceCoverageReceiptSchema.parse(parserCoverage)).toEqual(parserCoverage);
    expect(referenceCoverageReceiptSchema.safeParse({
      ...parserCoverage,
      route_exhaustion: { outgoing: true, incoming: false, unresolved: true }
    }).success).toBe(false);
  });

  it("rejects contradictory page and sequence accounting or missing language evidence", () => {
    expect(referenceCoverageReceiptSchema.safeParse({
      ...completeLexicalCoverage(),
      page_matches: 2
    }).success).toBe(false);
    expect(referenceCoverageReceiptSchema.safeParse({
      ...completeLexicalCoverage(),
      page: { ...accounting(), unique_files_inspected: 2 },
      sequence: accounting()
    }).success).toBe(false);
    expect(referenceCoverageReceiptSchema.safeParse({
      ...completeLexicalCoverage(),
      languages_inspected: []
    }).success).toBe(false);
  });

  it("locks every bounded stop reason and separates exclusions from unresolved candidates", () => {
    const reasons = [
      "catalog_exhausted",
      "route_exhausted",
      "time",
      "file",
      "byte",
      "result",
      "path_policy",
      "oversized",
      "missing",
      "changed",
      "read_failure"
    ];
    expect(reasons.map((reason) => referenceStopReasonSchema.parse(reason))).toEqual(reasons);
    expect(referenceCoverageReceiptSchema.parse({
      ...completeLexicalCoverage(),
      state: "partial",
      catalog_exhausted: false,
      complete_matches: undefined,
      searchable_candidates_classified: { page: 2, sequence: 2 },
      policy_exclusions: {
        page: [{ reason: "generated_or_vendor", count: 2 }],
        sequence: [{ reason: "generated_or_vendor", count: 2 }]
      },
      unresolved_searchable_candidates: {
        page: [{ reason: "oversized", count: 1 }],
        sequence: [{ reason: "oversized", count: 1 }]
      },
      stop_reason: "byte",
      continuation_kind: "lexical_scan"
    })).toMatchObject({
      state: "partial",
      policy_exclusions: { sequence: [{ reason: "generated_or_vendor", count: 2 }] },
      unresolved_searchable_candidates: { sequence: [{ reason: "oversized", count: 1 }] }
    });
  });

  it("keeps public counts, cursor, and response trust consistent with coverage", () => {
    const result = {
      repo_root: "/repo",
      snapshot_id: "snapshot-1",
      coverage_status: "evidence_backed",
      references: [referenceHit()],
      coverage: completeLexicalCoverage(),
      next_actions: []
    };
    expect(findReferencesResultSchema.parse(result)).toEqual(result);
    expect(findReferencesResultSchema.safeParse({
      repo_root: "/repo",
      snapshot_id: "snapshot-1",
      references: [],
      next_actions: []
    }).success).toBe(false);
    expect(findReferencesResultSchema.parse({
      repo_root: "/repo",
      snapshot_id: "snapshot-1",
      coverage_status: "legacy_unverified",
      references: [],
      next_actions: []
    })).toMatchObject({ coverage_status: "legacy_unverified" });
    expect(findReferencesResultSchema.safeParse({
      ...result,
      references: []
    }).success).toBe(false);
    expect(findReferencesResultSchema.safeParse({
      ...result,
      cursor: "opaque"
    }).success).toBe(false);

    const partialCoverage = {
      ...completeLexicalCoverage(),
      state: "partial" as const,
      catalog_exhausted: false,
      complete_matches: undefined,
      stop_reason: "result" as const,
      continuation_kind: "lexical_scan" as const
    };
    expect(responseMetadataSchema.safeParse(metadata({
      analysis_validity: "valid",
      truncated: false,
      reference_coverage: partialCoverage
    })).success).toBe(false);
    expect(responseMetadataSchema.safeParse(metadata({
      analysis_validity: "partial",
      truncated: true,
      scope: { repo_root: "/repo", indexed_roots: ["."], skipped_roots: [], languages: [] },
      reference_coverage: partialCoverage
    })).success).toBe(false);
    expect(responseMetadataSchema.parse(metadata({
      analysis_validity: "partial",
      truncated: true,
      reference_coverage: partialCoverage
    }))).toMatchObject({ analysis_validity: "partial", truncated: true });
  });
});

describe("authenticated reference cursor", () => {
  it("round-trips each distinct cursor payload kind", () => {
    const codec = createReferenceCursorCodec({
      key: Buffer.alloc(32, 7),
      key_epoch: "epoch-1"
    });
    const payloads: ReferenceCursorPayload[] = [
      lexicalScanPayload(),
      {
        ...lexicalScanPayload(),
        kind: "lexical_result",
        result_path: "src/app.ts",
        result_file_identity: {
          content_hash: "hash-1",
          size_bytes: 123,
          language: "typescript"
        },
        next_occurrence_ordinal: 2
      },
      {
        ...cursorIdentity(),
        kind: "parser_composite",
        current_route: "incoming",
        route_offsets: { outgoing: 2, incoming: 1, unresolved: 0 },
        route_exhaustion: { outgoing: true, incoming: false, unresolved: false },
        combined_rows_returned: 3
      }
    ];

    expect(lexicalScanCursorPayloadSchema.parse(payloads[0])).toEqual(payloads[0]);
    expect(lexicalResultCursorPayloadSchema.parse(payloads[1])).toEqual(payloads[1]);
    expect(parserCompositeCursorPayloadSchema.parse(payloads[2])).toEqual(payloads[2]);
    for (const payload of payloads) {
      expect(codec.decode(codec.encode(payload))).toEqual({ ok: true, payload });
    }
  });

  it("rejects malformed and tampered cursor state instead of restarting", () => {
    const codec = createReferenceCursorCodec({ key: Buffer.alloc(32, 8), key_epoch: "epoch-1" });
    expect(codec.decode("not-a-cursor")).toEqual({ ok: false, code: "invalid_cursor" });

    const cursor = codec.encode(lexicalScanPayload());
    const envelope = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(envelope.payload, "base64url").toString("utf8"));
    payload.target_node_id = "tampered-target";
    payload.totals.matched_so_far = 999;
    envelope.payload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const tampered = Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
    expect(codec.decode(tampered)).toEqual({ ok: false, code: "invalid_cursor" });
  });

  it("rejects impossible parser route order, totals, and continuation kinds", () => {
    expect(parserCompositeCursorPayloadSchema.safeParse({
      ...cursorIdentity(),
      kind: "parser_composite",
      current_route: "incoming",
      route_offsets: { outgoing: 1, incoming: 1, unresolved: 0 },
      route_exhaustion: { outgoing: false, incoming: false, unresolved: false },
      combined_rows_returned: 2
    }).success).toBe(false);
    expect(parserCompositeCursorPayloadSchema.safeParse({
      ...cursorIdentity(),
      kind: "parser_composite",
      current_route: "unresolved",
      route_offsets: { outgoing: 1, incoming: 1, unresolved: 1 },
      route_exhaustion: { outgoing: true, incoming: true, unresolved: false },
      combined_rows_returned: 2
    }).success).toBe(false);
    expect(referenceCoverageReceiptSchema.safeParse({
      ...completeLexicalCoverage(),
      state: "partial",
      catalog_exhausted: false,
      complete_matches: undefined,
      stop_reason: "result",
      continuation_kind: "parser_composite"
    }).success).toBe(false);
  });

  it("rejects contradictory read accounting and classification categories", () => {
    expect(referenceCoverageReceiptSchema.safeParse({
      ...completeLexicalCoverage(),
      page: { ...accounting(), replay_reads: 1 },
      sequence: { ...accounting(), replay_reads: 1 }
    }).success).toBe(false);
    expect(referenceCoverageReceiptSchema.safeParse({
      ...completeLexicalCoverage(),
      policy_exclusions: {
        page: [{ reason: "missing", count: 1 }],
        sequence: [{ reason: "missing", count: 1 }]
      }
    }).success).toBe(false);
    expect(referenceCoverageReceiptSchema.safeParse({
      ...completeLexicalCoverage(),
      unresolved_searchable_candidates: {
        page: [{ reason: "configured_skip", count: 1 }],
        sequence: [{ reason: "configured_skip", count: 1 }]
      }
    }).success).toBe(false);
    expect(referenceCoverageReceiptSchema.safeParse({
      ...completeLexicalCoverage(),
      searchable_candidates_classified: { page: 3, sequence: 3 },
      unresolved_searchable_candidates: {
        page: [{ reason: "missing", count: 1 }, { reason: "missing", count: 1 }],
        sequence: [{ reason: "missing", count: 1 }, { reason: "oversized", count: 1 }]
      }
    }).success).toBe(false);
  });

  it("expires a valid cursor after key-epoch rotation", () => {
    const first = createReferenceCursorCodec({ key: Buffer.alloc(32, 9), key_epoch: "epoch-1" });
    const restarted = createReferenceCursorCodec({ key: Buffer.alloc(32, 10), key_epoch: "epoch-2" });
    expect(restarted.decode(first.encode(lexicalScanPayload()))).toEqual({
      ok: false,
      code: "cursor_expired"
    });
  });
});

function accounting() {
  return {
    unique_files_inspected: 1,
    file_read_attempts: 1,
    replay_reads: 0,
    declared_bytes_admitted: 100,
    actual_bytes_observed: 98,
    elapsed_admission_ms: 2,
    occurrences: 1
  };
}

function completeLexicalCoverage(): ReferenceCoverageReceipt {
  return {
    state: "complete",
    route: "lexical",
    catalog_exhausted: true,
    page: accounting(),
    sequence: accounting(),
    searchable_candidates_classified: { page: 1, sequence: 1 },
    languages_inspected: ["typescript"],
    page_matches: 1,
    matched_so_far: 1,
    complete_matches: 1,
    policy_exclusions: { page: [], sequence: [] },
    unresolved_searchable_candidates: { page: [], sequence: [] },
    stop_reason: "catalog_exhausted"
  };
}

function cursorIdentity() {
  return {
    version: 1 as const,
    key_epoch: "epoch-1",
    snapshot_id: "snapshot-1",
    target_node_id: "target-1",
    target_name: "buildSessionStartContext",
    bounds: {
      max_depth: 1,
      max_results: 50,
      max_files: 100,
      max_declared_bytes: 1_000_000,
      max_file_bytes: 128_000,
      time_ms: 100
    }
  };
}

function lexicalScanPayload() {
  return {
    ...cursorIdentity(),
    kind: "lexical_scan" as const,
    after_path: "src/a.ts",
    totals: {
      accounting: accounting(),
      matched_so_far: 1,
      searchable_candidates_classified: 1,
      policy_exclusions: [],
      unresolved_searchable_candidates: [],
      languages_inspected: ["typescript"]
    }
  };
}

function referenceHit() {
  return {
    source_file_path: "src/app.ts",
    source_range: { start_line: 1, start_column: 0, end_line: 1, end_column: 24 },
    target_node_id: "target-1",
    reference_name: "buildSessionStartContext",
    reference_kind: "lexical",
    evidence_kinds: ["text_fallback" as const, "heuristic" as const],
    provenance: "bounded_lexical_identifier_scan",
    status: "unresolved" as const
  };
}

function metadata(overrides: Record<string, unknown>) {
  return {
    analysis_validity: "valid",
    freshness: "fresh",
    scope: {
      repo_root: "/repo",
      indexed_roots: ["."],
      skipped_roots: [],
      languages: ["typescript"]
    },
    capability_level: "partial_semantic",
    evidence_kinds: ["text_fallback"],
    verification_status: "needed",
    truncated: false,
    ...overrides
  };
}
