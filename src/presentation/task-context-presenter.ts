import {
  makeEnvelope,
  contextRiskSchema,
  contextCompletenessSchema,
  fileReferenceSchema,
  rankedSymbolCandidateSchema,
  skippedWorkSchema,
  sourceSectionSchema,
  symbolReferenceSchema,
  validationHintSchema,
  documentReferenceSchema,
  responseMetadataSchema,
  taskContextSchema,
  nextActionSchema,
  type ResponseEnvelope,
  type TaskContext
} from "../contracts/index.js";
import type { GetTaskContextResult } from "../application/use-cases/get-task-context.js";

export function buildTaskContextEnvelope(
  result: GetTaskContextResult
): ResponseEnvelope<TaskContext> {
  const data = sanitizeTaskContext(result.context);
  const meta = responseMetadataSchema.strip().parse(result.meta);
  return makeEnvelope({
    data,
    meta
  });
}

export function buildInvalidTaskContextInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<TaskContext> {
  return makeEnvelope({
    data: {
      task: "",
      repo_root: input.repoRoot,
      summary: "Task context input was invalid.",
      requested_files: [],
      related_files: [],
      ranked_symbols: [],
      governing_docs: [],
      validation_hints: [],
      skipped_work: [],
      completeness: {
        complete_enough: false,
        markers: ["invalid_input"],
        caveats: ["Fix the input and retry context_for_task."]
      },
      risks: [],
      next_actions: []
    },
    meta: {
      analysis_validity: "invalid",
      freshness: "unknown",
      scope: {
        repo_root: input.repoRoot,
        indexed_roots: [],
        skipped_roots: [],
        languages: []
      },
      capability_level: "unsupported",
      evidence_kinds: [],
      verification_status: "blocked",
      truncated: false
    },
    errors: [
      {
        code: "invalid_input",
        message: input.message,
        retryable: false
      }
    ]
  });
}

function sanitizeTaskContext(context: GetTaskContextResult["context"]): TaskContext {
  return taskContextSchema.parse({
    task: context.task,
    repo_root: context.repo_root,
    summary: context.summary,
    requested_files: context.requested_files.map(sanitizeFileReference),
    related_files: context.related_files.map(sanitizeFileReference),
    ranked_symbols: context.ranked_symbols.map(sanitizeRankedSymbol),
    governing_docs: context.governing_docs.map(sanitizeDocumentReference),
    validation_hints: context.validation_hints.map(sanitizeValidationHint),
    skipped_work: context.skipped_work.map(sanitizeSkippedWork),
    completeness: sanitizeCompleteness(context.completeness),
    risks: context.risks.map(sanitizeRisk),
    next_actions: context.next_actions.map(sanitizeNextAction)
  });
}

function sanitizeFileReference(input: GetTaskContextResult["context"]["requested_files"][number]) {
  return fileReferenceSchema.parse({
    path: input.path,
    language: input.language,
    exists: input.exists,
    capability_level: input.capability_level,
    evidence_kinds: input.evidence_kinds,
    reason: input.reason
  });
}

function sanitizeDocumentReference(input: GetTaskContextResult["context"]["governing_docs"][number]) {
  return documentReferenceSchema.parse({
    path: input.path,
    title: input.title,
    reason: input.reason,
    evidence_kinds: input.evidence_kinds
  });
}

function sanitizeValidationHint(input: GetTaskContextResult["context"]["validation_hints"][number]) {
  return validationHintSchema.parse({
    command: input.command,
    reason: input.reason,
    status: input.status
  });
}

function sanitizeSkippedWork(input: GetTaskContextResult["context"]["skipped_work"][number]) {
  return skippedWorkSchema.parse({
    kind: input.kind,
    reason: input.reason,
    next_action: input.next_action
  });
}

function sanitizeCompleteness(input: GetTaskContextResult["context"]["completeness"]) {
  return contextCompletenessSchema.parse({
    complete_enough: input.complete_enough,
    markers: input.markers,
    caveats: input.caveats
  });
}

function sanitizeRisk(input: GetTaskContextResult["context"]["risks"][number]) {
  return contextRiskSchema.parse({
    severity: input.severity,
    message: input.message,
    why_this_matters: input.why_this_matters
  });
}

function sanitizeNextAction(input: GetTaskContextResult["context"]["next_actions"][number]) {
  return nextActionSchema.parse({
    tool: input.tool,
    args: input.args
  });
}

function sanitizeSourceSection(
  input: NonNullable<
    Exclude<
      GetTaskContextResult["context"]["ranked_symbols"][number]["symbol"],
      undefined
    >["source_section"]
  >
) {
  return sourceSectionSchema.parse({
    path: input.path,
    start_line: input.start_line,
    end_line: input.end_line,
    byte_count: input.byte_count,
    truncated: input.truncated,
    text: input.text,
    caveat: input.caveat
  });
}

function sanitizeSymbol(input: GetTaskContextResult["context"]["ranked_symbols"][number]["symbol"]) {
  return symbolReferenceSchema.parse({
    node_id: input.node_id,
    kind: input.kind,
    name: input.name,
    qualified_name: input.qualified_name,
    path: input.path,
    language: input.language,
    source_range: {
      start_line: input.source_range.start_line,
      start_column: input.source_range.start_column,
      end_line: input.source_range.end_line,
      end_column: input.source_range.end_column
    },
    signature: input.signature,
    docstring: input.docstring,
    capability_level: input.capability_level,
    evidence_kinds: input.evidence_kinds,
    source_section: input.source_section === undefined ? undefined : sanitizeSourceSection(input.source_section)
  });
}

function sanitizeRankedSymbol(input: GetTaskContextResult["context"]["ranked_symbols"][number]) {
  return rankedSymbolCandidateSchema.parse({
    rank: input.rank,
    score: input.score,
    symbol: sanitizeSymbol(input.symbol),
    reason: input.reason
  });
}
