---
title: Doc currency routing verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-07-02
---

# Verification

## Evidence Log

- 2026-07-02 Phase 1 model and classification: `pnpm typecheck`; focused
  document-currency and Git-history Vitest tests; no `ctime`/`birthtime`
  matches under `src` or `tests`.
- 2026-07-02 Phase 2 runtime surfaces: `pnpm typecheck`; targeted
  docs/MCP/contract Vitest suite; full `pnpm test` passed after a transient
  stdio warm-up retry; spec lifecycle lint/preflight passed.
- 2026-07-02 Phase 3 durable promotion: `pnpm typecheck`, targeted
  docs/MCP/contract Vitest suite, `git diff --check`, no-`ctime` scan, and
  lifecycle lint passed after durable docs were updated in MCP surface design,
  graph store design, runtime contracts, documentation map, and the
  spec-lifecycle-manager handoff.

## Quality Gates

- `context_for_task` ranks current governing docs ahead of superseded docs for
  implementation prompts.
- `docs_search`, `repo:///docs/overview`, and `repo:///docs/map` expose
  currency labels and caveats.
- `docs_current_for_task` provides the task-focused current-docs verifier.
- `mtime_ms` is used only as modified-time evidence.
- Git history evidence remains optional and non-blocking.
- Filesystem `ctime` is not used as lifecycle or document-currency evidence.

## Closure Readiness

The implementation and durable documentation are ready for closure review once
the final validation commands in T010 pass and a final spec commit records the
complete package. `closure_check` reports ready with no blockers, and
`closure_risk_review` reports low risk with no findings.

Closing the spec should follow the repository lifecycle policy: preserve a final
spec commit, add closure-log/archive-index breadcrumbs as needed, then remove or
archive the active package according to the chosen closure action.

## Residual Risks

- `docs_current_for_task` is an executable MCP tool rather than a packaged
  skill/prompt. A future skill can wrap the tool, but no separate prompt is
  required for this implementation.
- Broad `docs_search` does not walk Git history. Git recency evidence should be
  reserved for bounded final candidates or future explicit enrichment.
- Full `pnpm test` currently flakes in
  `tests/mcp/stdio-entrypoint.test.ts` during startup graph warm-up when run
  with the full suite; the same test file passes standalone. This is recorded
  as an existing warm-up/test-environment race, not a document-currency
  regression.
