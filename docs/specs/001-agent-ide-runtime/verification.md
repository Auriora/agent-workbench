---
title: Agent IDE runtime MVP verification
doc_type: spec
status: archived
owner: platform
last_reviewed: 2026-06-03
---

# Verification

## Closure Record

Spec 001 closed on 2026-06-03 after implementation, durable-documentation
promotion, Codex sub-agent dogfood review, final validation, and explicit
deferral of post-MVP Markdown quality work.

Current behavior is described by the durable docs listed in
[Documentation map](../../reference/documentation-map.md). This spec package is
retained as archived delivery evidence, not active implementation guidance.

## Validation Plan

Use [MVP proof matrix](../../reference/mvp-proof-matrix.md) as the minimum
acceptance gate. Every MVP resource/tool needs contract coverage, fixture
coverage, golden responses, budget tests, degraded-mode behavior, and safety
negative tests where applicable.

Required automated gates:

- `pnpm typecheck`
- `pnpm test`
- Contract tests for shared runtime, domain, application, presentation, graph,
  validation, edit, integration, and MCP response shapes.
- Fixture tests for `fixture-basic-python`, `fixture-markdown-config`,
  `fixture-mixed-language-platform`, `fixture-degraded-tools`, and
  `fixture-workspace-safety`.
- Golden response tests for status, scope, overview, context, symbol search,
  references, impact, preview/apply, validation planning, and Codex integration
  profile responses.
- Budget tests for row counts, traversal depth, source-byte caps, response
  bounds, and compact/default first-pass behavior.
- Runtime operation tests for warm-up, cache invalidation, owner/observer state,
  obsolete-result rejection, concurrency, degraded state, and single-writer
  graph transactions.
- MCP tests for registry metadata, typed argument parsing, malformed inputs,
  transport bindings, schema translation boundaries, and stdio launch.
- Workspace safety tests for traversal, symlink escape, generated/vendor
  mutation, secret-like content, shell injection, output caps, and command
  refusal.
- OTEL tests for disabled-by-default configuration, console export, OTLP HTTP
  export, shutdown/flush handling, and low-impact performance signals.
- Codex readiness checks for host-level MCP config, stdio live-checkout launch,
  repo-local debug CLI, workflow skill guidance, plugin-wrapper boundaries, and
  quiet hook behavior.

## Evidence Log

| Date | Scope | Evidence | Result |
|------|-------|----------|--------|
| 2026-06-02 | Current implementation after migration intake | `pnpm typecheck` | Passed |
| 2026-06-02 | Current implementation after migration intake | `pnpm test` | Passed: 29 test files, 136 tests |
| 2026-06-02 | `T202.1` task-context completion | `pnpm typecheck` | Passed |
| 2026-06-02 | `T202.1` task-context completion | `pnpm test` | Passed: 29 test files, 137 tests |
| 2026-06-02 | `T204.1` runtime status transitions | `pnpm typecheck` | Passed |
| 2026-06-02 | `T204.1` runtime status transitions | `pnpm test` | Passed: 29 test files, 138 tests |
| 2026-06-02 | `T204.5`, `T204.6`, `T204.8B`, `T204.8D`, and `T204.10` runtime batch | `pnpm typecheck` | Passed |
| 2026-06-02 | `T204.5`, `T204.6`, `T204.8B`, `T204.8D`, and `T204.10` runtime batch | `pnpm test` | Passed: 30 test files, 150 tests |
| 2026-06-02 | `T204.3`, `T204.7`, `T204.8C`, `T204.9`, and `T204.11` runtime batch | `pnpm typecheck` | Passed |
| 2026-06-02 | `T204.3`, `T204.7`, `T204.8C`, `T204.9`, and `T204.11` runtime batch | `pnpm test` | Passed: 30 test files, 157 tests |
| 2026-06-02 | `T204.8` and `T204` runtime/degraded behavior completion | `pnpm typecheck` | Passed |
| 2026-06-02 | `T204.8` and `T204` runtime/degraded behavior completion | `pnpm test` | Passed: 31 test files, 159 tests |
| 2026-06-02 | `T205.1`, `T205.2`, `T205.9`, and `T205.10` MCP completion batch | `pnpm exec vitest run tests/mcp/argument-parser.test.ts tests/mcp/malformed-input.test.ts tests/mcp/translation-boundary.test.ts tests/mcp/context-for-task-tool.test.ts tests/mcp/verification-plan-tool.test.ts tests/mcp/stdio-entrypoint.test.ts tests/mcp/workspace-edit-tools.test.ts tests/mcp/registry-metadata.test.ts tests/mcp/query-tools.test.ts` | Passed: 9 test files, 66 tests |
| 2026-06-02 | `T205` MCP bindings completion | `pnpm typecheck` | Passed |
| 2026-06-02 | `T205` MCP bindings completion | `pnpm test` | Passed: 33 test files, 182 tests |
| 2026-06-02 | `T206.5` Codex replacement-readiness checks | `pnpm exec vitest run tests/integration/replacement-readiness.test.ts` | Passed: 1 test file, 2 tests |
| 2026-06-02 | `T206` Codex replacement readiness completion | `pnpm typecheck` | Passed |
| 2026-06-02 | `T206` Codex replacement readiness completion | `pnpm test` | Passed: 34 test files, 184 tests |
| 2026-06-03 | `T088` common integration profile boundary checks | `pnpm exec vitest run tests/integration/common-integration-profile.test.ts` | Passed: 1 test file, 2 tests |
| 2026-06-03 | `T089` documentation link and metadata validation | `pnpm exec vitest run tests/docs/docs-links-metadata.test.ts` | Passed: 1 test file, 2 tests |
| 2026-06-03 | `T080`-`T089` cross-cutting validation completion | `pnpm typecheck` | Passed |
| 2026-06-03 | `T080`-`T089` cross-cutting validation completion | `pnpm test` | Passed: 36 test files, 188 tests |
| 2026-06-03 | `T098`-`T102B` usage-informed MVP validation | `pnpm exec vitest run tests/integration/usage-informed-mvp.test.ts tests/mcp/context-for-task-tool.test.ts` | Passed: 2 test files, 14 tests |
| 2026-06-03 | Usage-informed MVP validation completion | `pnpm typecheck` | Passed |
| 2026-06-03 | Usage-informed MVP validation completion | `pnpm test` | Passed: 37 test files, 193 tests |
| 2026-06-03 | MVP task-ledger reconciliation and post-MVP deferral pass | `docs/specs/001-agent-ide-runtime/tasks.md` review | Passed: no active pending tasks remain; `T079` and `T103`-`T110` are explicitly skipped/deferred |
| 2026-06-03 | Final MVP task-ledger reconciliation validation | `pnpm typecheck` | Passed |
| 2026-06-03 | Final MVP task-ledger reconciliation validation | `pnpm test` | Passed: 37 test files, 193 tests |
| 2026-06-03 | Codex sub-agent dogfood pass | GPT-5.3-Codex-Spark worker review of plugin launch metadata, stdio entrypoint, MCP resources/tools, full workflow coverage, `pnpm typecheck`, `pnpm test`, and repo-local debug CLI | Passed: no code edits; no MVP-blocking MCP workflow gaps found |
| 2026-06-03 | MCP edit negative-path dogfood gap closure | GPT-5.3-Codex-Spark worker audit plus `pnpm exec vitest run tests/mcp/workspace-edit-tools.test.ts tests/edits/workspace-edit.test.ts tests/mcp/malformed-input.test.ts` | Passed: 3 test files, 21 tests; missing-target, expired-token, mismatch, and stale apply failures return stable MCP envelopes without filesystem detail leakage |
| 2026-06-03 | Post-dogfood validation | `pnpm typecheck` | Passed |
| 2026-06-03 | Post-dogfood validation | `pnpm test` | Passed: 37 test files, 195 tests |

## Task Coverage

- `T200` and `T201` are marked complete and covered by orientation, graph,
  extraction, budget, and mixed-language/platform tests.
- `T203` is marked complete and covered by edit, validation-plan,
  static-feedback, and workspace-safety tests.
- `T202` is complete. `BuildTaskContextUseCase` now reports graph-backed ranked
  symbols when graph evidence is available, explicit skipped work when it is
  not, direct-read caveats, and complete-enough markers.
- `T204.1` is complete. Runtime status now exposes explicit snapshot-backed
  cold, refreshing, fresh, stale, partial, invalid, and
  invalid-due-to-environment state transitions while preserving scanner-backed
  compatibility.
- `T204.5`, `T204.6`, `T204.8B`, `T204.8D`, and `T204.10` are complete.
  Runtime cache reads now reject obsolete snapshot/config/file-hash evidence;
  status metadata reports structured degraded caveats without parser or semantic
  fallbacks; MCP instrumentation reports low-impact performance, invalid-input,
  and degraded-runtime signals; telemetry lifecycle/exporter-failure events are
  covered; and repo-local debug harnesses are proven not to register as public
  MCP surfaces.
- `T204.3`, `T204.7`, `T204.8C`, `T204.9`, and `T204.11` are complete.
  Warm-up orchestration now wraps the single graph indexing path with runtime
  state, cache publication, fresh snapshot publication, and failed-state
  handling; runtime tests cover concurrent refresh/read and owner serialization;
  profiling runs through repo-local debug harnesses without MCP schema changes;
  runtime fixtures cover warm-up/cache/owner/parser-timeout metadata; and Codex
  update semantics are fixture-backed.
- `T204.8` and parent `T204` are complete. Runtime telemetry now has
  OTEL-compatible boundary proof for MCP dispatch, use-case, graph/query,
  worker, cache, presentation, degraded-state, and error-boundary
  instrumentation without durable usage records or public MCP schema changes.
- `T205` is complete. MCP bindings now use shared argument parsing and
  invalid-input formatting across resources and tools; malformed input returns
  structured presenter envelopes before use-case execution; stdio fixture tests
  compare MVP resource/tool responses against presenter goldens; handler tests
  prove raw input is not hand-coerced; and translation-boundary tests plus
  presenter sanitization prevent raw parser, diagnostic, validation,
  test-discovery, and worker payloads from leaking into public MCP responses.
- `T206` is complete. Codex replacement-readiness tests now prove predecessor
  high-frequency workflows are discoverable through MVP surfaces: first-pass
  context and docs/config routing through `context_for_task`; validation
  planning, test planning, and post-edit static feedback through
  `verification_plan`; and no predecessor tool names or raw backend payloads in
  the replacement outputs.
- Cross-cutting validation `T080` through `T089` is complete. The suite now
  covers produced-response goldens, every MVP use-case surface, registry and
  parser validation, OTEL boundaries, runtime operation/concurrency behavior,
  workspace safety negatives, degraded-mode behavior, query budgets, common
  integration profiles for Codex/Claude Code/Kiro/Augment/Gemini/Junie, and
  docs frontmatter/link validation.
- Usage-informed MVP validation `T098` through `T102B` is complete. Broad task
  prompts now have regression coverage for expected implementation-file routing,
  compact first-pass budget boundaries, complete-enough/skipped-work markers,
  targeted symbol/reference/impact next actions, docs/config routing caveats,
  non-Python capability metadata, and Codex replacement-readiness without
  predecessor tool names or backend pass-throughs.

## Quality Gates

- No task should move to `done` without evidence in [tasks.md](tasks.md) or this
  verification log.
- No runtime failure should be masked with parser, semantic, validation, or
  command-execution fallbacks.
- No MCP response should expose raw backend parser, diagnostic, validation,
  test-discovery, or worker payloads unless the public schema models the field.
- No Codex wrapper should become a second executable runtime path.
- No generated runtime/cache artifact should be committed.

## Residual Risks

- The migrated task ledger carries mechanically inferred dependencies and
  evidence for old checkbox entries. Remaining work should refine dependencies
  and evidence as tasks are completed.
- Older phase tasks have been reconciled against the completed gap,
  cross-cutting, and usage-informed validation streams. Future changes should
  keep the gap backlog as the commit-sized execution stream and use phase tasks
  as coverage gates.
- Post-MVP Markdown quality tasks remain in the backlog and should not block
  MVP closure unless explicitly promoted.
- The Codex dogfood pass found an MCP-boundary negative-path coverage gap for
  workspace edits. The gap is now covered by focused MCP tests and stable
  missing-target errors; no residual closure blocker remains from that audit.

## Closure Readiness

Spec 001 is ready for closure review when:

- Core gap tasks `T202`, `T204`, `T205`, and `T206` are complete.
- Cross-cutting validation `T080`-`T089` and usage-informed validation
  `T098`-`T102B` are complete.
- Post-MVP Markdown quality work `T103`-`T110` is explicitly deferred.
- `pnpm typecheck` and `pnpm test` pass after the final implementation slice.
- Remaining residual risks are routed to a follow-up spec, backlog item, or
  durable roadmap note.
