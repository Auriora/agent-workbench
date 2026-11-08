---
title: Daemon CPU efficiency verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-11-08
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Evidence Log

Planning only. No production code changes, delivered fixes, implementation test
passes or complete-generation performance improvements are claimed. Exploratory
measurements are preserved in [research](research.md); all delivery gates are pending.

## Quality Gates

| Gate | Coverage | Required evidence | State |
| --- | --- | --- | --- |
| V001 | Requirement 6 AC1-AC3; CP-006 | Owned worker-isolate harness, fixed baseline/revision and five-run scenarios; D001/D003/D005 design checkpoint | pending T001 |
| V002 | Requirement 1; CP-001/CP-002 | Qt XML and real/malformed/unknown TypeScript, misleading directories/strings, BOM/whitespace, bounded/unreadable prefixes; parser invocation counts | pending T002 |
| V003 | Requirement 2; CP-001; SC-001 | Negation/anchor/directory/segment parity, child ignore invalidation, finite matcher lifetime, distinct compilation counts and CPU benchmark | pending T003 |
| V004 | Requirement 3; CP-001/CP-003/CP-005; SC-002 | Multi-slice single discovery, docs priority, worker exit/restart, create/delete/rename/content/ignore/config/composition invalidation, manifest migration | pending T004 |
| V005 | Requirement 4; CP-004/CP-005 | Cross-language/Ruby/lambda graph and ambiguity parity, candidate-count scaling and final-page cursor/transaction proof | pending T005 |
| V006 | Requirement 5; CP-003/CP-005 | Budget/long-file overrun, settlement, cancellation/supersession/shutdown, unique versus visit counters and legacy unknown/rebuild behavior | pending T006 |
| V007 | Requirement 6; SC-001-SC-004; CP-006 | Comparable complete-generation five-run baseline/candidate CPU, wall, RSS, phase costs and complete evidence; source and isolated compiled acceptance | pending T007 |
| V008 | All requirements; CP-001-CP-006 | Independent architecture/data/operational review, durable promotion, backlog reconciliation, evidence/closure checks | pending T008 |

Use deterministic Vitest assertions for the correctness properties. No new
property-test library is needed. Performance timings belong in controlled harness
runs; compilation/traversal/lookup counts provide non-flaky regression assertions.

## Implementation Commands

These are planned, not executed delivery results. Extend focused paths when the
new Qt and profiling fixtures exist.

```bash
pnpm typecheck
pnpm exec vitest run tests/workspace/file-catalog-scanner.test.ts tests/workspace/path-policy-consistency.test.ts tests/graph/graph-build-continuation.test.ts tests/graph/ruby-semantic-extraction.test.ts tests/graph/reference-completeness.test.ts tests/runtime/operations.test.ts tests/architecture/layer-boundaries.test.ts
pnpm test
pnpm build-runtime
pnpm build-runtime:check
git diff --check
```

T001 documents the stable checkout harness command, parameters, profiler scope,
revision and result schema. T007 exercises the compiled production worker and
MCP convergence using an isolated store, never a live external cache. Do not
substitute query-only main-thread profiling for worker CPU evidence.

## Review and Promotion

Review the actual changes for layering, bounded classification reads, manifest
invalidation/migration, reference parity and hard-deadline/ownership preservation.
Record reviewer findings and dispositions, exact commands/results and source/build
identity. Promotion targets are the existing owners in requirements.md.

Every criterion needs complete evidence or a formally recorded scope revision and
owned follow-up. A pending required performance gate blocks closure. B014 does
not absorb incomplete measured fixes implicitly. Release/installation is separate.

## Residual Risks

Exploratory scan timings varied substantially and did not measure total generation
completion or final-resolution cost. Classification prefixes can be inconclusive;
manifest reuse can retain stale evidence without complete invalidation; candidate
indexes can increase RSS or accidentally resolve ambiguity. V001-V007 must test
these risks before any performance claim or closure. Current planning checks do
not establish implementation readiness or delivered fixes.
