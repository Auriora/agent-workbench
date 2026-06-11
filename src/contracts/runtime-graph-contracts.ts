import { z } from "zod";
import {
  capabilityLevelSchema,
  evidenceKindSchema,
  fileReferenceSchema,
  nextActionSchema
} from "./runtime-core-contracts.js";
import { sourceSectionSchema } from "./runtime-docs-contracts.js";

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
    cursor: z.string().optional()
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

export const findReferencesResultSchema = z
  .object({
    repo_root: z.string(),
    snapshot_id: z.string(),
    target: symbolReferenceSchema.optional(),
    references: z.array(referenceHitSchema),
    cursor: z.string().optional(),
    result_count: z.number().int().nonnegative().optional(),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
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
