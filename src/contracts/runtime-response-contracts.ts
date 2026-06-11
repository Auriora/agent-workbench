import { z } from "zod";
import {
  adapterDomainSchema,
  analysisValiditySchema,
  attentionKindSchema,
  attentionSeveritySchema,
  capabilityLevelSchema,
  CONTRACT_VERSION,
  evidenceKindSchema,
  freshnessSchema,
  nextActionSchema,
  type RuntimeError,
  runtimeErrorSchema,
  runtimeStatusCaveatSchema,
  verificationStatusSchema
} from "./runtime-core-contracts.js";

export const scopeMetadataSchema = z.object({
  repo_root: z.string(),
  indexed_roots: z.array(z.string()),
  skipped_roots: z.array(z.string()),
  languages: z.array(z.string())
});
export type ScopeMetadata = z.infer<typeof scopeMetadataSchema>;

export const adapterEvidenceSchema = z
  .object({
    domain: adapterDomainSchema,
    name: z.string(),
    capability_level: capabilityLevelSchema,
    evidence_kinds: z.array(evidenceKindSchema),
    paths: z.array(z.string()),
    provenance: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
    metadata: z.record(z.string(), z.unknown()).default({})
  })
  .strict();
export type AdapterEvidence = z.infer<typeof adapterEvidenceSchema>;

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
  budget: budgetMetadataSchema.optional(),
  caveats: z.array(runtimeStatusCaveatSchema).optional()
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
