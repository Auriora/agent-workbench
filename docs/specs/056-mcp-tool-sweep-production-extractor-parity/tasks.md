---
title: MCP tool-sweep production extractor parity tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-08-04
---

# Tasks

## Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005
```

## Implementation

- [x] T001 Validate package readiness and canonical boundaries.
  - Depends on: none
  - Requirements: Requirement 1 to Requirement 4
  - Files: `docs/specs/056-mcp-tool-sweep-production-extractor-parity/`
  - Acceptance: requirements, design, execution tasks, traceability, validation,
    and durable owners describe one bounded implementation path.
  - Evidence: creation-plan fingerprint revalidation selected Spec 056; package
    `lint_spec_package` reported zero errors and one reviewed, waived
    canonical-context advisory; the T001 readiness packet reported ready with
    no blocking traceability or decision gap.

- [x] T002 Introduce and adopt the canonical production extractor registry.
  - Depends on: T001
  - Requirements: Requirement 1; CP-001
  - Files: `src/infrastructure/extraction/`,
    `src/infrastructure/workers/startup-graph-warmup-worker.ts`,
    `src/debug/mcp-tool-sweep.ts`
  - Acceptance: both consumers use one factory containing C, C++, Go,
    JavaScript, TypeScript, Python, and Ruby; no duplicate production list or
    fallback remains.
  - Evidence: `pnpm exec vitest run tests/mcp/debug-harness.test.ts
    tests/graph/query-tools.test.ts tests/mcp/query-tools.test.ts` passed 63
    tests, including the exact seven-language set and both consumer boundaries.

- [x] T003 Add ecosystem-aware Go and C/C++ sweep probes and regressions.
  - Depends on: T002
  - Requirements: Requirement 2, Requirement 3, Requirement 4; CP-002 to CP-004
  - Files: `src/debug/mcp-tool-sweep.ts`, graph query presentation helpers,
    `tests/mcp/debug-harness.test.ts`
  - Acceptance: repository-owned Go and CMake/C++ fixtures warm complete graphs
    and drive symbol, reference, impact, and context probes through indexed
    language evidence with truthful capability/provenance.
  - Evidence: `pnpm exec vitest run tests/mcp/debug-harness.test.ts
    tests/graph/query-tools.test.ts tests/mcp/query-tools.test.ts` passed 63/63,
    including Go and C++ assertions for search, references, impact, ranked task
    context, stored-node capability, and stored-node provenance.

- [x] T004 Promote durable behavior and record real-repository evidence.
  - Depends on: T003
  - Requirements: Requirement 1 to Requirement 4
  - Files: `docs/design/observability-debugging-design.md`,
    `docs/backlog/README.md`, `docs/reference/dogfood-evidence-ledger.md`
  - Acceptance: durable docs identify the canonical registry, proof boundary,
    and successful bounded dogfood without naming private external projects.
  - Evidence: durable design/backlog/ledger updates plus two read-only target
    sweeps: 45 full, 5 bounded partial, 4 intentional degraded, no blocked or
    invalid results; target Git status was unchanged.

- [x] T005 Verify, review, and reconcile completion readiness.
  - Depends on: T004
  - Requirements: Requirement 1 to Requirement 4; CP-001 to CP-004
  - Files: implementation, tests, durable docs, and this package
  - Acceptance: focused, architecture, typecheck, bounded full tests, lifecycle
    checks, and independent correctness review pass or have explicit routed
    dispositions.
  - Evidence: `pnpm typecheck`, 63 focused tests, 9 architecture tests, 10
    documentation tests, `git diff --check`, and the bounded 1,249-test suite
    pass. Independent review found no implementation blocker; its concurrent
    provider-smoke failures were not reproduced by the full run or the isolated
    37-test provider-smoke file.

## Execution Rules

- Read requirements and design with this task index.
- Keep one implementation task in progress.
- Keep MCP adapters thin and do not change public schemas.
- Do not add parser, semantic, validation, retry, or command-execution
  fallbacks.
- Do not execute project commands in dogfood targets.
