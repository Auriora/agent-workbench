import { z } from "zod";
import {
  capabilityLevelSchema,
  contextCompletenessSchema,
  contextRiskSchema,
  documentReferenceSchema,
  evidenceKindSchema,
  fileReferenceSchema,
  nextActionSchema,
  skippedPathSchema,
  skippedWorkSchema,
  validationHintSchema
} from "./runtime-core-contracts.js";
import { symbolReferenceSchema } from "./runtime-graph-contracts.js";

export const rankedSymbolCandidateSchema = z
  .object({
    rank: z.number().int().positive(),
    score: z.number().nonnegative(),
    symbol: z.lazy(() => symbolReferenceSchema),
    reason: z.string()
  })
  .strict();
export type RankedSymbolCandidate = z.infer<typeof rankedSymbolCandidateSchema>;

export const taskContextRequestSchema = z
  .object({
    task: z.string().min(1),
    repo_root: z.string().optional(),
    files: z.array(z.string()).default([]),
    symbols: z.array(z.string()).default([]),
    lifecycle_context: z
      .object({
        source: z.string().default("caller"),
        state: z.enum(["provided", "callable", "unavailable", "unknown"]).default("provided"),
        spec_path: z.string().optional(),
        task_id: z.string().optional(),
        outputs: z
          .array(
            z
              .object({
                kind: z.enum([
                  "preflight",
                  "task_detail",
                  "validation_plan",
                  "evidence_quality",
                  "task_state_audit",
                  "closure_risk",
                  "task_context",
                  "traceability"
                ]),
                status: z.enum(["provided", "callable", "unavailable", "unknown", "blocked"]).default("provided"),
                summary: z.string(),
                files: z.array(z.string()).default([]),
                validation_hints: z.array(validationHintSchema).default([]),
                next_actions: z.array(nextActionSchema).default([])
              })
              .strict()
          )
          .default([])
      })
      .strict()
      .optional(),
    max_files: z.number().int().positive().max(50).default(10),
    max_docs: z.number().int().positive().max(20).default(5)
  })
  .strict();
export type TaskContextRequest = z.infer<typeof taskContextRequestSchema>;

export const lifecycleEvidenceSchema = z
  .object({
    source: z.string(),
    kind: z.enum([
      "preflight",
      "task_detail",
      "validation_plan",
      "evidence_quality",
      "task_state_audit",
      "closure_risk",
      "task_context",
      "traceability",
      "local_spec_routing"
    ]),
    status: z.enum(["provided", "callable", "unavailable", "unknown", "blocked", "non_authoritative"]),
    summary: z.string(),
    files: z.array(z.string()).default([]),
    validation_hints: z.array(validationHintSchema).default([]),
    next_actions: z.array(nextActionSchema).default([])
  })
  .strict();
export type LifecycleEvidence = z.infer<typeof lifecycleEvidenceSchema>;

export const taskContextSchema = z
  .object({
    task: z.string(),
    repo_root: z.string(),
    summary: z.string(),
    requested_files: z.array(fileReferenceSchema),
    related_files: z.array(fileReferenceSchema),
    ranked_symbols: z.array(rankedSymbolCandidateSchema),
    governing_docs: z.array(documentReferenceSchema),
    lifecycle_evidence: z.array(lifecycleEvidenceSchema).default([]),
    validation_hints: z.array(validationHintSchema),
    skipped_work: z.array(skippedWorkSchema),
    completeness: contextCompletenessSchema,
    risks: z.array(contextRiskSchema),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type TaskContext = z.infer<typeof taskContextSchema>;

export const repoScopeSchema = z
  .object({
    repo_root: z.string(),
    indexed_roots: z.array(z.string()),
    skipped_roots: z.array(z.string()),
    languages: z.array(z.string()),
    file_counts: z.record(z.string(), z.number().int().nonnegative()),
    capability_counts: z.record(capabilityLevelSchema, z.number().int().nonnegative()),
    generated_or_vendor_roots: z.array(z.string()),
    skipped_paths: z.array(skippedPathSchema).optional()
  })
  .strict();
export type RepoScope = z.infer<typeof repoScopeSchema>;

export const repoOverviewSchema = z
  .object({
    repo_root: z.string(),
    summary: z.string(),
    languages: z.array(z.string()),
    platforms: z.array(z.string()),
    key_files: z.array(fileReferenceSchema),
    key_docs: z.array(documentReferenceSchema),
    validation_hints: z.array(validationHintSchema),
    skipped_paths: z.array(skippedPathSchema).optional(),
    recommended_first_calls: z.array(nextActionSchema)
  })
  .strict();
export type RepoOverview = z.infer<typeof repoOverviewSchema>;
