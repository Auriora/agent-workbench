import type {
  CheckMarkdownDocumentResult,
  CheckMarkdownSetResult,
  ResponseEnvelope
} from "../contracts/index.js";
import {
  checkMarkdownDocumentResultSchema,
  checkMarkdownSetResultSchema,
  makeEnvelope,
  markdownQualityFindingSchema,
  nextActionSchema,
  responseMetadataSchema
} from "../contracts/index.js";
import type {
  CheckMarkdownDocumentUseCaseResult,
  CheckMarkdownSetUseCaseResult
} from "../application/use-cases/check-markdown-quality.js";
import {
  invalidResponseMeta,
  presentNextActions,
  type PresentationSessionContext
} from "./metadata.js";
import { redactPresentationText } from "./redaction.js";

export function buildCheckMarkdownDocumentEnvelope(
  result: CheckMarkdownDocumentUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<CheckMarkdownDocumentResult> {
  return makeEnvelope({
    data: sanitizeCheckMarkdownDocument(result.check, context),
    meta: responseMetadataSchema.strip().parse(result.meta)
  });
}

export function buildCheckMarkdownSetEnvelope(
  result: CheckMarkdownSetUseCaseResult,
  context: PresentationSessionContext = {}
): ResponseEnvelope<CheckMarkdownSetResult> {
  return makeEnvelope({
    data: sanitizeCheckMarkdownSet(result.check, context),
    meta: responseMetadataSchema.strip().parse(result.meta)
  });
}

export function buildInvalidCheckMarkdownDocumentInputEnvelope(input: {
  repoRoot: string;
  path?: string;
  message: string;
}): ResponseEnvelope<CheckMarkdownDocumentResult> {
  return makeEnvelope({
    data: {
      repo_root: input.repoRoot,
      path: input.path ?? "",
      status: "blocked",
      summary: "Markdown quality check input was invalid.",
      findings: [],
      warnings: [],
      truncated: false,
      next_actions: []
    },
    meta: invalidResponseMeta({ repoRoot: input.repoRoot }),
    errors: [
      {
        code: "invalid_input",
        message: input.message,
        retryable: false
      }
    ]
  });
}

export function buildInvalidCheckMarkdownSetInputEnvelope(input: {
  repoRoot: string;
  message: string;
}): ResponseEnvelope<CheckMarkdownSetResult> {
  return makeEnvelope({
    data: {
      repo_root: input.repoRoot,
      status: "blocked",
      summary: "Markdown set quality check input was invalid.",
      checked_documents: [],
      skipped_documents: [],
      findings: [],
      warnings: [],
      truncated: false,
      next_actions: []
    },
    meta: invalidResponseMeta({ repoRoot: input.repoRoot }),
    errors: [
      {
        code: "invalid_input",
        message: input.message,
        retryable: false
      }
    ]
  });
}

function sanitizeCheckMarkdownDocument(
  input: CheckMarkdownDocumentResult,
  context: PresentationSessionContext
): CheckMarkdownDocumentResult {
  return checkMarkdownDocumentResultSchema.parse({
    repo_root: input.repo_root,
    path: normalizeRepoPath(input.path),
    status: input.status,
    summary: redactPresentationText(input.summary, { context: "message" }),
    findings: [...input.findings]
      .sort((left, right) =>
        left.path.localeCompare(right.path) ||
        left.start_line - right.start_line ||
        left.rule_id.localeCompare(right.rule_id)
      )
      .map((finding) =>
        markdownQualityFindingSchema.parse({
          ...finding,
          path: normalizeRepoPath(finding.path),
          message: redactPresentationText(finding.message, { context: "message" }),
          evidence: finding.evidence === undefined
            ? undefined
            : redactPresentationText(finding.evidence, { context: "source" }),
          evidence_kinds: [...finding.evidence_kinds].sort()
        })
      ),
    warnings: [...input.warnings].sort((left, right) => (left.path ?? "").localeCompare(right.path ?? "")),
    truncated: input.truncated,
    next_actions: presentNextActions(input.next_actions, context).map((action) => nextActionSchema.parse(action))
  });
}

function sanitizeCheckMarkdownSet(
  input: CheckMarkdownSetResult,
  context: PresentationSessionContext
): CheckMarkdownSetResult {
  return checkMarkdownSetResultSchema.parse({
    repo_root: input.repo_root,
    status: input.status,
    summary: redactPresentationText(input.summary, { context: "message" }),
    checked_documents: [...input.checked_documents].sort().map(normalizeRepoPath),
    skipped_documents: [...input.skipped_documents].sort().map(normalizeRepoPath),
    findings: [...input.findings]
      .sort((left, right) =>
        left.path.localeCompare(right.path) ||
        left.start_line - right.start_line ||
        left.rule_id.localeCompare(right.rule_id)
      )
      .map((finding) =>
        markdownQualityFindingSchema.parse({
          ...finding,
          path: normalizeRepoPath(finding.path),
          message: redactPresentationText(finding.message, { context: "message" }),
          evidence: finding.evidence === undefined
            ? undefined
            : redactPresentationText(finding.evidence, { context: "source" }),
          evidence_kinds: [...finding.evidence_kinds].sort()
        })
      ),
    warnings: [...input.warnings].sort((left, right) => (left.path ?? "").localeCompare(right.path ?? "")),
    truncated: input.truncated,
    next_actions: presentNextActions(input.next_actions, context).map((action) => nextActionSchema.parse(action))
  });
}

function normalizeRepoPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}
