import { z } from "zod";

export const CONTRACT_VERSION = "0.1" as const;

export const capabilityLevelSchema = z.enum([
  "semantic",
  "partial_semantic",
  "resource_backed",
  "unsupported"
]);
export type CapabilityLevel = z.infer<typeof capabilityLevelSchema>;

export const evidenceKindSchema = z.enum([
  "parser",
  "lsp",
  "compiler_api",
  "sqlite",
  "fts",
  "docs",
  "tests",
  "direct_read",
  "config",
  "infra_parser",
  "heuristic",
  "text_fallback",
  "executed_command"
]);
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;

export const adapterDomainSchema = z.enum([
  "language",
  "config",
  "infrastructure",
  "documentation",
  "test",
  "tooling"
]);
export type AdapterDomain = z.infer<typeof adapterDomainSchema>;

export const freshnessSchema = z.enum([
  "fresh",
  "stale",
  "cold",
  "refreshing",
  "unknown"
]);
export type Freshness = z.infer<typeof freshnessSchema>;

export const analysisValiditySchema = z.enum([
  "valid",
  "partial",
  "invalid",
  "invalid_due_to_environment"
]);
export type AnalysisValidity = z.infer<typeof analysisValiditySchema>;

export const verificationStatusSchema = z.enum([
  "done",
  "planned",
  "needed",
  "blocked",
  "not_applicable"
]);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export const attentionSeveritySchema = z.enum(["blocker", "warning"]);
export type AttentionSeverity = z.infer<typeof attentionSeveritySchema>;

export const attentionKindSchema = z.enum([
  "stale_preview",
  "syntax_error",
  "missing_tool",
  "low_confidence",
  "validation_blocked",
  "path_refused",
  "command_refused"
]);
export type AttentionKind = z.infer<typeof attentionKindSchema>;

export const toolCapabilityClassSchema = z.enum([
  "read_only",
  "planning",
  "workspace_write",
  "process_execute",
  "generated_write"
]);
export type ToolCapabilityClass = z.infer<typeof toolCapabilityClassSchema>;

export const nextActionSchema = z.object({
  tool: z.string(),
  args: z.record(z.string(), z.unknown())
});
export type NextAction = z.infer<typeof nextActionSchema>;

export const runtimeErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  next_action: nextActionSchema.optional()
});
export type RuntimeError = z.infer<typeof runtimeErrorSchema>;

export const scopeMetadataSchema = z.object({
  repo_root: z.string(),
  indexed_roots: z.array(z.string()),
  skipped_roots: z.array(z.string()),
  languages: z.array(z.string())
});
export type ScopeMetadata = z.infer<typeof scopeMetadataSchema>;

export const budgetMetadataSchema = z
  .object({
    time_ms: z.number().int().nonnegative().optional(),
    row_limit: z.number().int().nonnegative().optional(),
    traversal_depth: z.number().int().nonnegative().optional(),
    source_byte_limit: z.number().int().nonnegative().optional()
  })
  .strict();
export type BudgetMetadata = z.infer<typeof budgetMetadataSchema>;

export const responseMetadataSchema = z.object({
  analysis_validity: analysisValiditySchema,
  freshness: freshnessSchema,
  scope: scopeMetadataSchema,
  capability_level: capabilityLevelSchema,
  evidence_kinds: z.array(evidenceKindSchema),
  verification_status: verificationStatusSchema,
  truncated: z.boolean(),
  budget: budgetMetadataSchema.optional()
});
export type ResponseMetadata = z.infer<typeof responseMetadataSchema>;

export const attentionItemSchema = z.object({
  severity: attentionSeveritySchema,
  kind: attentionKindSchema,
  scope: z
    .object({
      files: z.array(z.string()).optional(),
      symbols: z.array(z.string()).optional()
    })
    .default({}),
  message: z.string(),
  why_this_matters: z.string(),
  evidence_kinds: z.array(evidenceKindSchema),
  freshness: freshnessSchema,
  next_action: nextActionSchema.optional(),
  expires_when: z.string().optional()
});
export type AttentionItem = z.infer<typeof attentionItemSchema>;

export const editTokenSchema = z.object({
  preview_token: z.string(),
  created_at: z.string(),
  expires_at: z.string(),
  files: z.array(
    z.object({
      path: z.string(),
      base_hash: z.string(),
      after_hash: z.string(),
      change_count: z.number().int().nonnegative()
    })
  ),
  operation: z.literal("bounded_text_edit"),
  mutation_class: z.literal("workspace_write")
});
export type EditToken = z.infer<typeof editTokenSchema>;

export const responseEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    contract_version: z.literal(CONTRACT_VERSION),
    data: dataSchema,
    meta: responseMetadataSchema,
    warnings: z.array(attentionItemSchema),
    errors: z.array(runtimeErrorSchema)
  });

export type ResponseEnvelope<T> = {
  contract_version: typeof CONTRACT_VERSION;
  data: T;
  meta: ResponseMetadata;
  warnings: AttentionItem[];
  errors: RuntimeError[];
};

export function makeEnvelope<T>(input: {
  data: T;
  meta: ResponseMetadata;
  warnings?: AttentionItem[];
  errors?: RuntimeError[];
}): ResponseEnvelope<T> {
  return {
    contract_version: CONTRACT_VERSION,
    data: input.data,
    meta: input.meta,
    warnings: input.warnings ?? [],
    errors: input.errors ?? []
  };
}
