/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { z } from "zod";
import {
  capabilityLevelSchema,
  evidenceKindSchema,
  fileReferenceSchema,
  nextActionSchema
} from "./runtime-core-contracts.js";
import { sourceSectionSchema } from "./runtime-docs-contracts.js";

export const MAX_REFERENCE_CURSOR_LENGTH = 16_384;

export const sourceRangeSchema = z
  .object({
    start_line: z.number().int().positive(),
    start_column: z.number().int().nonnegative(),
    end_line: z.number().int().positive(),
    end_column: z.number().int().nonnegative()
  })
  .strict();
export type SourceRangeContract = z.infer<typeof sourceRangeSchema>;

export const symbolReferenceSchema = z
  .object({
    node_id: z.string(),
    kind: z.string(),
    name: z.string(),
    qualified_name: z.string().optional(),
    path: z.string(),
    language: z.string(),
    source_range: sourceRangeSchema,
    signature: z.string().optional(),
    docstring: z.string().optional(),
    capability_level: capabilityLevelSchema,
    evidence_kinds: z.array(evidenceKindSchema),
    source_section: sourceSectionSchema.optional()
  })
  .strict();
export type SymbolReference = z.infer<typeof symbolReferenceSchema>;

export const symbolSearchRequestSchema = z
  .object({
    query: z.string().min(1),
    repo_root: z.string().optional(),
    snapshot_id: z.string().optional(),
    exact: z.boolean().default(false),
    languages: z.array(z.string()).default([]),
    max_results: z.number().int().positive().max(100).default(20),
    source_byte_limit: z.number().int().nonnegative().max(2000).default(0)
  })
  .strict();
export type SymbolSearchRequest = z.infer<typeof symbolSearchRequestSchema>;

export const symbolSearchResultSchema = z
  .object({
    query: z.string(),
    repo_root: z.string(),
    snapshot_id: z.string(),
    symbols: z.array(symbolReferenceSchema),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type SymbolSearchResult = z.infer<typeof symbolSearchResultSchema>;

export const findReferencesRequestSchema = z
  .object({
    node_id: z.string().optional(),
    symbol: z.string().optional(),
    repo_root: z.string().optional(),
    snapshot_id: z.string().optional(),
    max_depth: z.number().int().positive().max(5).default(1),
    max_results: z.number().int().positive().max(100).default(50),
    cursor: z.string().max(MAX_REFERENCE_CURSOR_LENGTH).optional()
  })
  .strict()
  .refine((value) => value.node_id !== undefined || value.symbol !== undefined, {
    message: "Either node_id or symbol is required."
  });
export type FindReferencesRequest = z.infer<typeof findReferencesRequestSchema>;

export const referenceHitSchema = z
  .object({
    source_node_id: z.string().optional(),
    source_file_path: z.string().optional(),
    source_range: sourceRangeSchema.optional(),
    target_node_id: z.string().optional(),
    target_file_path: z.string().optional(),
    reference_name: z.string().optional(),
    reference_kind: z.string(),
    confidence: z.number().min(0).max(1).optional(),
    evidence_kinds: z.array(evidenceKindSchema),
    provenance: z.string(),
    status: z.enum(["resolved", "unresolved", "ambiguous"])
  })
  .strict();
export type ReferenceHit = z.infer<typeof referenceHitSchema>;

export const referenceEvidenceRouteSchema = z.enum([
  "outgoing",
  "incoming",
  "unresolved",
  "lexical"
]);
export type ReferenceEvidenceRoute = z.infer<typeof referenceEvidenceRouteSchema>;

export const referenceCursorKindSchema = z.enum([
  "parser_composite",
  "lexical_scan",
  "lexical_result"
]);
export type ReferenceCursorKind = z.infer<typeof referenceCursorKindSchema>;

export const referenceStopReasonSchema = z.enum([
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
]);
export type ReferenceStopReason = z.infer<typeof referenceStopReasonSchema>;

export const referencePolicyExclusionReasonSchema = z.enum([
  "unsupported_language",
  "generated_or_vendor",
  "secret",
  "configured_skip",
  "unsafe_path"
]);

export const referenceUnresolvedCandidateReasonSchema = z.enum([
  "oversized",
  "missing",
  "changed",
  "read_failure"
]);

export const referencePolicyExclusionCountSchema = z
  .object({
    reason: referencePolicyExclusionReasonSchema,
    count: z.number().int().positive()
  })
  .strict();

export const referenceUnresolvedCandidateCountSchema = z
  .object({
    reason: referenceUnresolvedCandidateReasonSchema,
    count: z.number().int().positive()
  })
  .strict();

const referencePolicyExclusionCountsSchema = z
  .object({
    page: z.array(referencePolicyExclusionCountSchema).max(16),
    sequence: z.array(referencePolicyExclusionCountSchema).max(16)
  })
  .strict();

const referenceUnresolvedCandidateCountsSchema = z
  .object({
    page: z.array(referenceUnresolvedCandidateCountSchema).max(16),
    sequence: z.array(referenceUnresolvedCandidateCountSchema).max(16)
  })
  .strict();

export const referenceAccountingSchema = z
  .object({
    unique_files_inspected: z.number().int().nonnegative(),
    file_read_attempts: z.number().int().nonnegative(),
    replay_reads: z.number().int().nonnegative(),
    declared_bytes_admitted: z.number().int().nonnegative(),
    actual_bytes_observed: z.number().int().nonnegative(),
    elapsed_admission_ms: z.number().int().nonnegative(),
    occurrences: z.number().int().nonnegative()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.unique_files_inspected + value.replay_reads > value.file_read_attempts) {
      context.addIssue({
        code: "custom",
        message: "Unique inspected files plus replay reads cannot exceed file read attempts."
      });
    }
    if (value.replay_reads > value.file_read_attempts) {
      context.addIssue({
        code: "custom",
        message: "Replay reads cannot exceed file read attempts."
      });
    }
    if (value.file_read_attempts === 0 &&
        (value.declared_bytes_admitted !== 0 || value.actual_bytes_observed !== 0)) {
      context.addIssue({
        code: "custom",
        message: "Byte accounting requires at least one file read attempt."
      });
    }
  });
export type ReferenceAccounting = z.infer<typeof referenceAccountingSchema>;

export const referenceRouteExhaustionSchema = z
  .object({
    outgoing: z.boolean(),
    incoming: z.boolean(),
    unresolved: z.boolean()
  })
  .strict();
export type ReferenceRouteExhaustion = z.infer<typeof referenceRouteExhaustionSchema>;

export const referenceCoverageReceiptSchema = z
  .object({
    state: z.enum(["complete", "partial"]),
    route: z.enum(["parser", "lexical"]),
    catalog_exhausted: z.boolean().optional(),
    route_exhaustion: referenceRouteExhaustionSchema.optional(),
    page: referenceAccountingSchema,
    sequence: referenceAccountingSchema,
    searchable_candidates_classified: z
      .object({
        page: z.number().int().nonnegative(),
        sequence: z.number().int().nonnegative()
      })
      .strict(),
    languages_inspected: z.array(z.string()).max(32),
    page_matches: z.number().int().nonnegative(),
    matched_so_far: z.number().int().nonnegative(),
    complete_matches: z.number().int().nonnegative().optional(),
    policy_exclusions: referencePolicyExclusionCountsSchema,
    unresolved_searchable_candidates: referenceUnresolvedCandidateCountsSchema,
    stop_reason: referenceStopReasonSchema,
    continuation_kind: referenceCursorKindSchema.optional()
  })
  .strict()
  .superRefine((value, context) => {
    const issue = (message: string): void => {
      context.addIssue({ code: "custom", message });
    };
    if (value.page_matches !== value.page.occurrences) {
      issue("Page match count must equal page occurrence accounting.");
    }
    if (value.matched_so_far !== value.sequence.occurrences) {
      issue("Matched-so-far must equal sequence occurrence accounting.");
    }
    if (value.page_matches > value.matched_so_far) {
      issue("Page matches cannot exceed matched-so-far.");
    }
    for (const field of [
      "unique_files_inspected",
      "file_read_attempts",
      "replay_reads",
      "declared_bytes_admitted",
      "actual_bytes_observed",
      "elapsed_admission_ms",
      "occurrences"
    ] as const) {
      if (value.page[field] > value.sequence[field]) {
        issue(`Page ${field} cannot exceed sequence ${field}.`);
      }
    }
    if (value.sequence.unique_files_inspected > 0 && value.languages_inspected.length === 0) {
      issue("Inspected files require inspected-language metadata.");
    }
    if (value.sequence.unique_files_inspected === 0 && value.languages_inspected.length > 0) {
      issue("Inspected-language metadata requires at least one uniquely inspected file.");
    }
    if (new Set(value.languages_inspected).size !== value.languages_inspected.length) {
      issue("Inspected languages must be deduplicated.");
    }
    if (value.searchable_candidates_classified.page > value.searchable_candidates_classified.sequence) {
      issue("Page classified candidates cannot exceed sequence classified candidates.");
    }
    const pageUnresolvedCount = value.unresolved_searchable_candidates.page.reduce(
      (total, entry) => total + entry.count,
      0
    );
    const sequenceUnresolvedCount = value.unresolved_searchable_candidates.sequence.reduce(
      (total, entry) => total + entry.count,
      0
    );
    if (value.searchable_candidates_classified.page !== value.page.unique_files_inspected + pageUnresolvedCount) {
      issue("Page classified candidates must equal inspected plus unresolved searchable candidates.");
    }
    if (value.searchable_candidates_classified.sequence !== value.sequence.unique_files_inspected + sequenceUnresolvedCount) {
      issue("Sequence classified candidates must equal inspected plus unresolved searchable candidates.");
    }
    if (!reasonCountsFitWithin(
      value.policy_exclusions.page,
      value.policy_exclusions.sequence
    ) || !reasonCountsFitWithin(
      value.unresolved_searchable_candidates.page,
      value.unresolved_searchable_candidates.sequence
    )) {
      issue("Page reason counts cannot exceed sequence reason counts.");
    }
    if (![value.policy_exclusions.page, value.policy_exclusions.sequence,
          value.unresolved_searchable_candidates.page,
          value.unresolved_searchable_candidates.sequence].every(hasUniqueReasons)) {
      issue("Reference reason counts must contain one entry per reason.");
    }
    if (value.route === "lexical") {
      if (value.catalog_exhausted === undefined || value.route_exhaustion !== undefined) {
        issue("Lexical coverage requires catalog exhaustion and forbids parser route exhaustion.");
      }
    } else if (value.route_exhaustion === undefined || value.catalog_exhausted !== undefined) {
      issue("Parser coverage requires route exhaustion and forbids catalog exhaustion.");
    }
    const unresolvedCount = sequenceUnresolvedCount;
    if (value.route === "lexical" && value.continuation_kind === "parser_composite") {
      issue("Lexical coverage cannot expose a parser continuation.");
    }
    if (value.route === "parser" && value.continuation_kind !== undefined && value.continuation_kind !== "parser_composite") {
      issue("Parser coverage can expose only a composite parser continuation.");
    }
    if (value.route === "parser" && value.continuation_kind === "parser_composite" &&
        value.route_exhaustion?.outgoing === true && value.route_exhaustion.incoming === true &&
        value.route_exhaustion.unresolved === true) {
      issue("Parser continuation requires at least one unexhausted route.");
    }
    if (value.route === "lexical" && value.continuation_kind === "lexical_scan" && value.catalog_exhausted) {
      issue("Lexical scan continuation requires an unexhausted catalog.");
    }
    if (value.state === "complete") {
      const sourceExhausted = value.route === "lexical"
        ? value.catalog_exhausted === true
        : value.route_exhaustion?.outgoing === true &&
          value.route_exhaustion.incoming === true &&
          value.route_exhaustion.unresolved === true;
      if (!sourceExhausted) {
        issue("Complete reference evidence requires source exhaustion.");
      }
      if (unresolvedCount > 0) {
        issue("Complete reference evidence cannot retain unresolved searchable candidates.");
      }
      if (value.continuation_kind !== undefined) {
        issue("Complete reference evidence cannot expose a continuation.");
      }
      const expectedStopReason = value.route === "lexical" ? "catalog_exhausted" : "route_exhausted";
      if (value.stop_reason !== expectedStopReason) {
        issue("Complete reference evidence must stop because its source is exhausted.");
      }
      if (value.complete_matches === undefined || value.complete_matches !== value.matched_so_far) {
        issue("Complete match total is required and must equal matched-so-far after exhaustion.");
      }
    } else if (value.complete_matches !== undefined) {
      issue("Partial reference evidence cannot publish a complete match total.");
    }
  });
export type ReferenceCoverageReceipt = z.infer<typeof referenceCoverageReceiptSchema>;

function reasonCountsFitWithin(
  page: readonly { reason: string; count: number }[],
  sequence: readonly { reason: string; count: number }[]
): boolean {
  const totals = new Map(sequence.map((entry) => [entry.reason, entry.count]));
  return page.every((entry) => entry.count <= (totals.get(entry.reason) ?? 0));
}

function hasUniqueReasons(entries: readonly { reason: string }[]): boolean {
  return new Set(entries.map((entry) => entry.reason)).size === entries.length;
}

export const referenceCursorBoundsSchema = z
  .object({
    max_depth: z.number().int().positive().max(5),
    max_results: z.number().int().positive().max(100),
    max_files: z.number().int().positive(),
    max_declared_bytes: z.number().int().positive(),
    max_file_bytes: z.number().int().positive(),
    time_ms: z.number().int().positive()
  })
  .strict();

const referenceCursorIdentitySchema = z.object({
  version: z.literal(1),
  key_epoch: z.string().min(1),
  snapshot_id: z.string().min(1),
  target_node_id: z.string().min(1),
  target_name: z.string().min(1),
  bounds: referenceCursorBoundsSchema
});

const referenceCursorTotalsSchema = z.object({
  accounting: referenceAccountingSchema,
  matched_so_far: z.number().int().nonnegative(),
  searchable_candidates_classified: z.number().int().nonnegative(),
  policy_exclusions: z.array(referencePolicyExclusionCountSchema).max(16),
  unresolved_searchable_candidates: z.array(referenceUnresolvedCandidateCountSchema).max(16),
  languages_inspected: z.array(z.string()).max(32)
}).superRefine((value, context) => {
  const unresolvedCount = value.unresolved_searchable_candidates.reduce(
    (total, entry) => total + entry.count,
    0
  );
  if (value.accounting.occurrences !== value.matched_so_far) {
    context.addIssue({ code: "custom", message: "Cursor occurrence accounting must equal matched-so-far." });
  }
  if (value.searchable_candidates_classified !== value.accounting.unique_files_inspected + unresolvedCount) {
    context.addIssue({ code: "custom", message: "Cursor classified candidates must equal inspected plus unresolved candidates." });
  }
  if (new Set(value.languages_inspected).size !== value.languages_inspected.length) {
    context.addIssue({ code: "custom", message: "Cursor inspected languages must be deduplicated." });
  }
  if (!hasUniqueReasons(value.policy_exclusions) || !hasUniqueReasons(value.unresolved_searchable_candidates)) {
    context.addIssue({ code: "custom", message: "Cursor reason counts must contain one entry per reason." });
  }
  if ((value.accounting.unique_files_inspected === 0) !== (value.languages_inspected.length === 0)) {
    context.addIssue({ code: "custom", message: "Cursor language evidence must agree with unique inspected files." });
  }
});

export const lexicalScanCursorPayloadSchema = referenceCursorIdentitySchema
  .extend({
    kind: z.literal("lexical_scan"),
    after_path: z.string().min(1),
    totals: referenceCursorTotalsSchema
  })
  .strict();

export const lexicalResultCursorPayloadSchema = referenceCursorIdentitySchema
  .extend({
    kind: z.literal("lexical_result"),
    after_path: z.string().min(1),
    result_path: z.string().min(1),
    result_file_identity: z
      .object({
        content_hash: z.string().min(1),
        size_bytes: z.number().int().nonnegative(),
        language: z.string().min(1)
      })
      .strict(),
    next_occurrence_ordinal: z.number().int().positive(),
    totals: referenceCursorTotalsSchema
  })
  .strict();

export const parserCompositeCursorPayloadSchema = referenceCursorIdentitySchema
  .extend({
    kind: z.literal("parser_composite"),
    current_route: z.enum(["outgoing", "incoming", "unresolved"]),
    route_offsets: z
      .object({
        outgoing: z.number().int().nonnegative(),
        incoming: z.number().int().nonnegative(),
        unresolved: z.number().int().nonnegative()
      })
      .strict(),
    route_exhaustion: referenceRouteExhaustionSchema,
    combined_rows_returned: z.number().int().nonnegative()
  })
  .strict()
  .superRefine((value, context) => {
    const issue = (message: string): void => context.addIssue({ code: "custom", message });
    if (value.combined_rows_returned !==
        value.route_offsets.outgoing + value.route_offsets.incoming + value.route_offsets.unresolved) {
      issue("Combined parser rows must equal the sum of disjoint route offsets.");
    }
    if (value.current_route === "outgoing") {
      if (value.route_exhaustion.outgoing || value.route_offsets.incoming !== 0 ||
          value.route_offsets.unresolved !== 0 || value.route_exhaustion.incoming ||
          value.route_exhaustion.unresolved) {
        issue("Outgoing continuation cannot advance or exhaust later parser routes.");
      }
    } else if (value.current_route === "incoming") {
      if (!value.route_exhaustion.outgoing || value.route_exhaustion.incoming ||
          value.route_offsets.unresolved !== 0 || value.route_exhaustion.unresolved) {
        issue("Incoming continuation requires exhausted outgoing and untouched unresolved routes.");
      }
    } else if (!value.route_exhaustion.outgoing || !value.route_exhaustion.incoming ||
               value.route_exhaustion.unresolved) {
      issue("Unresolved continuation requires exhausted outgoing and incoming routes.");
    }
  });

export const referenceCursorPayloadSchema = z.discriminatedUnion("kind", [
  lexicalScanCursorPayloadSchema,
  lexicalResultCursorPayloadSchema,
  parserCompositeCursorPayloadSchema
]);
export type ReferenceCursorPayload = z.infer<typeof referenceCursorPayloadSchema>;

const findReferencesResultBaseSchema = z
  .object({
    repo_root: z.string(),
    snapshot_id: z.string(),
    target: symbolReferenceSchema.optional(),
    references: z.array(referenceHitSchema),
    cursor: z.string().max(MAX_REFERENCE_CURSOR_LENGTH).optional(),
    result_count: z.number().int().nonnegative().optional(),
    result_count_basis: z.enum(["page_matches", "matched_so_far", "complete_matches"]).optional(),
    next_actions: z.array(nextActionSchema)
  })
  .strict();

export const findReferencesResultSchema = z
  .union([
    findReferencesResultBaseSchema.extend({
      coverage_status: z.literal("legacy_unverified")
    }).strict(),
    findReferencesResultBaseSchema.extend({
      coverage_status: z.literal("evidence_backed"),
      coverage: referenceCoverageReceiptSchema
    }).strict()
  ])
  .superRefine((value, context) => {
    if ((value.result_count === undefined) !== (value.result_count_basis === undefined)) {
      context.addIssue({
        code: "custom",
        message: "Reference result_count and result_count_basis must be returned together."
      });
    }
    if (value.coverage_status === "legacy_unverified") {
      if (value.result_count_basis !== undefined && value.result_count_basis !== "page_matches") {
        context.addIssue({
          code: "custom",
          message: "A reference result without coverage can count only matches on the current page."
        });
      }
      if (value.result_count !== undefined && value.result_count !== value.references.length) {
        context.addIssue({
          code: "custom",
          message: "A page-based reference result count must equal the number of returned references."
        });
      }
      return;
    }
    const expectedBasis = value.coverage.state === "complete" ? "complete_matches" : "matched_so_far";
    const expectedCount = value.coverage.state === "complete"
      ? value.coverage.complete_matches
      : value.coverage.matched_so_far;
    if (value.result_count_basis !== undefined && value.result_count_basis !== expectedBasis) {
      context.addIssue({
        code: "custom",
        message: `Reference result_count_basis must be ${expectedBasis} for ${value.coverage.state} evidence.`
      });
    }
    if (value.result_count !== undefined && value.result_count !== expectedCount) {
      context.addIssue({
        code: "custom",
        message: "Reference result_count must agree with its declared coverage basis."
      });
    }
    if (value.coverage.page_matches !== value.references.length) {
      context.addIssue({
        code: "custom",
        message: "Reference page matches must equal the number of returned references."
      });
    }
    if (value.coverage.state === "complete" && value.cursor !== undefined) {
      context.addIssue({
        code: "custom",
        message: "Complete reference evidence cannot return a cursor."
      });
    }
    if (value.coverage.state === "partial" && value.coverage.continuation_kind !== undefined && value.cursor === undefined) {
      context.addIssue({
        code: "custom",
        message: "A declared reference continuation requires an opaque cursor."
      });
    }
  });
export type FindReferencesResult = z.infer<typeof findReferencesResultSchema>;

export const impactRequestSchema = z
  .object({
    node_id: z.string(),
    repo_root: z.string().optional(),
    snapshot_id: z.string().optional(),
    max_depth: z.number().int().positive().max(5).default(2),
    max_nodes: z.number().int().positive().max(200).default(50),
    direction: z.enum(["incoming", "outgoing", "both"]).default("both")
  })
  .strict();
export type ImpactRequest = z.infer<typeof impactRequestSchema>;

export const impactResultSchema = z
  .object({
    repo_root: z.string(),
    snapshot_id: z.string(),
    start_node_ids: z.array(z.string()),
    affected_symbols: z.array(symbolReferenceSchema),
    affected_files: z.array(fileReferenceSchema),
    edge_count: z.number().int().nonnegative(),
    reached_depth: z.number().int().nonnegative(),
    traversal_truncated: z.boolean(),
    confidence: z
      .object({
        level: z.enum(["high", "medium", "low"]),
        scope: z.enum(["graph", "local_only", "empty"]),
        reason: z.string(),
        evidence_kinds: z.array(evidenceKindSchema)
      })
      .strict(),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type ImpactResult = z.infer<typeof impactResultSchema>;
