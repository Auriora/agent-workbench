import { makeEnvelope, type ResponseEnvelope, type TaskContext } from "../contracts/index.js";
import type { GetTaskContextResult } from "../application/use-cases/get-task-context.js";

export function buildTaskContextEnvelope(
  result: GetTaskContextResult
): ResponseEnvelope<TaskContext> {
  return makeEnvelope({
    data: result.context,
    meta: result.meta
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
      governing_docs: [],
      validation_hints: [],
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
