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
| V001 | Requirement 6 AC1-AC3; CP-006 | Owned worker-isolate harness, fixed baseline/revision and five-run scenarios; bounded recognizer, expected-difference comparator, final freshness protocol and manifest seal/recovery checkpoint | pending T001 |
| V002 | Requirement 1; CP-001/CP-002 | Qt XML and real/malformed/unknown TypeScript, misleading directories/strings, BOM/whitespace, root beyond the 16,384-byte bound, long TypeScript comments, inconclusive/read-error outcomes; positive-Qt parser invocation counts | pending T002 |
| V003 | Requirement 2; CP-001; SC-001 | Negation/anchor/directory/segment parity, child ignore invalidation, finite matcher lifetime, distinct compilation counts and CPU benchmark | pending T003 |
| V004 | Requirement 3; CP-001/CP-003/CP-005; SC-002 | Multi-slice single discovery, docs priority, worker exit/restart, create/delete/rename/content/ignore/config/composition invalidation, manifest migration, incomplete/sealed state, death before/during construction, at seal and before consumption, and mutations not yet admitted by watcher | pending T004 |
| V005 | Requirement 4; CP-004/CP-005 | Cross-language/Ruby/lambda graph and ambiguity parity, candidate-count scaling and final-page cursor/transaction proof | pending T005 |
| V006 | Requirement 5; CP-003/CP-005 | Budget/long-file overrun, settlement, cancellation/supersession/shutdown, unique versus visit counters and legacy unknown/rebuild behavior | pending T006 |
| V007 | Requirement 6; SC-001-SC-004; CP-006 | Comparable complete-generation five-run baseline/candidate CPU, wall, RSS, phase costs, frozen permitted Qt/counter corrections, normalized unaffected-evidence parity; source and isolated compiled acceptance | pending T007 |
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

## MoE Review Dispositions

The four independent reviews of commit 406e536 covered requirements/QA,
architecture/performance, operations/persistence safety and lifecycle/evidence.
All judged T001 ready with warnings; no production implementation was reviewed.
The following are specification dispositions, not implementation completion.

- W001, lifecycle context: replace unsupported task/design matrix columns with
  the lifecycle reader's recognized fields; validate T001-T008 task contexts and
  D001-D006 reverse-design lookups. Authoring validation result is recorded below.
- W002, parity versus corrections: D006 now freezes explicit expected Qt/counter
  differences and normalized semantic identities; unaffected evidence remains
  exact. T001 must produce the independent expected-difference manifest/comparator.
- W003, bounded Qt guarantee: Requirement 1/D001 fix a 16,384-byte positive-signature
  boundary, readable-inconclusive extension admission and structured read failure.
  CP-002/SC-002 apply to positive signatures only. V002 tests roots beyond the bound
  and real TypeScript with long comments. No universal Qt detection is claimed.
- W004, final freshness authority: D003 no longer claims an existing filesystem
  validation guarantee. T001 must document and review publication authority,
  evidence/drain ordering, incomplete watcher outcomes and late-mutation cases;
  it must prove compatibility with the single-discovery requirement before T004.
- W005, construction versus complete catalog: D003/T001 require explicit
  incomplete/sealed state, atomic seal/cursor/counter relationships, recovery and
  crash-boundary fixtures before T004 can consume any persisted manifest.

W004/W005 remain mandatory T001 design outputs, owned by platform and inside this
spec; they are not backlog deferrals or completed runtime protocols. All downstream
implementation stays gated until the documented decisions pass QA/architecture/
operations review. B014 remains the separate scheduling-policy question.

## Authoring Validation and Follow-Up Review

Executed on 2026-11-08 against the specification revisions after commit 406e536:

- Lifecycle package lint: zero errors, warnings or informational findings.
- Authoritative task_context for T001-T008: all eight returned no gaps and
  populated requirements, acceptance, design, verification and durable targets.
- Authoritative reverse-design traceability for D001-D006: all six returned their
  intended rows without gaps.
- Direct document checks: all seven spec documents have the required metadata;
  96 Markdown links and code-formatted document references resolve, including
  heading anchors. All eight implementation tasks remain pending.
- Markdown set check of the five revised documents: all examined, with no
  structure/link/frontmatter findings. Thirty-six plain-text table-readability
  advisories remain; long machine-readable traceability rows are retained to
  preserve the lifecycle reader contract. This is not a claim of warning-free
  Markdown quality.
- git diff --check: passed. Runtime typecheck, tests, profiling and installed
  acceptance were not run for these documentation-only revisions.

Independent focused follow-up reviewed the revised five-file diff against 406e536:
requirements/QA accepted the bounded-detection and comparison contracts;
operations accepted W004/W005 as mandatory T001 design outputs; lifecycle/evidence
independently confirmed representative task and reverse-design lookups. Its minor
missing-authoring-record observation is addressed by this section. All three
reviewers judged T001 ready to begin, with downstream implementation still gated.
No reviewer claimed delivered runtime fixes or accepted the as-yet-undesigned
freshness/sealing protocols. The remaining implementation and T001 decision
acceptance must be proved through V001-V008.
