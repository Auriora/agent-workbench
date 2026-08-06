/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { z } from "zod";
import { nextActionSchema } from "./runtime-core-contracts.js";
import {
  diagnosticsForFilesResultSchema,
  verificationPlanSchema
} from "./runtime-validation-edit-contracts.js";

const changedPathSchema = z.string().min(1).max(500).refine((value) =>
  !value.startsWith("/") && !value.includes("\\") && !value.includes("\0") &&
  value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== ".."),
{ message: "Expected a normalized repo-relative path." });

export const changedFilesLifecycleContextSchema = z.object({
  source: z.string().min(1).max(100).optional(),
  state: z.enum(["provided", "unavailable", "unknown"]),
  summary: z.string().min(1).max(2_000)
}).strict();
export type ChangedFilesLifecycleContext = z.infer<typeof changedFilesLifecycleContextSchema>;

export const changedFilesContextRequestSchema = z.object({
  task: z.string().max(2_000).optional(),
  repo_root: z.string().optional(),
  files: z.array(changedPathSchema).max(50).default([]),
  lifecycle_context: changedFilesLifecycleContextSchema.optional(),
  max_files: z.number().int().positive().max(50).default(20),
  max_commands: z.number().int().positive().max(20).default(10)
}).strict();
export type ChangedFilesContextRequest = z.infer<typeof changedFilesContextRequestSchema>;

export const changedFilesGitEvidenceSchema = z.object({
  state: z.enum(["available", "blocked"]),
  cleanliness: z.enum(["clean", "dirty"]).optional(),
  staged: z.array(changedPathSchema).max(50),
  unstaged: z.array(changedPathSchema).max(50),
  untracked: z.array(changedPathSchema).max(50),
  changed_files: z.array(changedPathSchema).max(50),
  reason: z.string().max(500).optional()
}).strict();
export type ChangedFilesGitEvidence = z.infer<typeof changedFilesGitEvidenceSchema>;

const componentStateSchema = z.enum(["available", "not_applicable", "unavailable", "blocked"]);
const repositoryStatusComponentSchema = z.object({
  state: componentStateSchema,
  value: z.object({
    runtime_state: z.string(),
    freshness: z.string(),
    snapshot_id: z.string().optional()
  }).strict().optional(),
  reason: z.string().max(500).optional()
}).strict();
const diagnosticsComponentSchema = z.object({
  state: componentStateSchema,
  value: diagnosticsForFilesResultSchema.optional(),
  reason: z.string().max(500).optional()
}).strict();
const verificationComponentSchema = z.object({
  state: componentStateSchema,
  value: verificationPlanSchema.optional(),
  reason: z.string().max(500).optional()
}).strict();

export const changedFilesContextResultSchema = z.object({
  repo_root: z.string(),
  state: z.enum(["ready", "no_changes", "degraded", "blocked"]),
  changes: changedFilesGitEvidenceSchema,
  repository_status: repositoryStatusComponentSchema,
  diagnostics: diagnosticsComponentSchema,
  verification: verificationComponentSchema,
  lifecycle_context: changedFilesLifecycleContextSchema.optional(),
  next_actions: z.array(nextActionSchema).max(8)
}).strict();
export type ChangedFilesContextResult = z.infer<typeof changedFilesContextResultSchema>;
