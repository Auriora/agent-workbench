---
title: Daemon CPU efficiency tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-11-08
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

Input: [requirements](requirements.md), [design](design.md), [research](research.md),
[traceability](traceability.md) and [verification](verification.md). T001-T004 are complete; T005-T008 remain pending. Obtain fresh lifecycle task context and mark the selected task in
progress before coding; preserve unrelated release notes and Spec 065 work.

## Task Dependency Graph

```text
T001 -> T002; T003; T004; T005
T004 -> T006
T002 + T003 + T004 + T005 + T006 -> T007 -> T008
```

## Implementation

- [x] T001 - Establish reproducible worker baseline and design checkpoint
  - Depends on: none.
  - Requirements: Requirement 1 AC1-AC5; Requirement 3 AC2-AC3;
    Requirement 5 AC5; Requirement 6 AC1-AC3.
  - Properties: CP-002; CP-003; CP-005; CP-006.
  - Files: src/debug/; src/infrastructure/workers/; optional observation callbacks
    in src/domain/policies/path-policy.ts, filesystem/file-catalog-scanner.ts and
    application/use-cases/index-repository-graph.ts; focused tests; this package's
    design.md and verification.md. Observers preserve the canonical algorithms.
  - Acceptance: create isolated worker profiling harness; freeze representative
    revision/runtime/scenarios; capture complete-generation baseline including
    resolution, five-run metrics and graph comparison method. Record bounded
    Qt recognizer grammar and boundary fixtures under Requirement 1, and freeze
    D006's independently expected Qt/counter differences and semantic comparison
    rules. Record exact manifest/schema/counter migration design and safety
    review before downstream implementation. No live-source edits or live DB writes.
  - Mandatory exit criteria: identify the final freshness-validation owner,
    evidence, publication linearization and watcher-drain ordering; define queued,
    missing, overflow and disabled-watcher outcomes and late-mutation fixtures.
    Prove compatibility with the single-discovery target. Define incomplete and
    sealed manifest states, atomic seal/cursor/counter relationships, and recovery
    outcomes for death before/during construction, at seal and before consumption.
    Independent QA/architecture/operations review must accept these documented
    decisions; otherwise T001 remains pending and T002-T006 cannot start.
  - Validation: V001; pnpm typecheck and harness fixture tests.
  - Evidence: Completed reproducible six-scenario baseline: five repetitions, 30 measurements and 80 sampled worker profiles; exact operation counts and phase sums audited; full semantic evidence stable, five >=60 s idle windows used zero workers, and committed continuation cursors restored. Final frozen source passes typecheck, nine focused Vitest files/69 tests, runtime build and build receipt checks. Independent QA, architecture/operations and comparator reviews accepted the bounded T001 baseline/design gate. See verification.md sections Complete Scenario Baseline, Final Validation and Review, and T001 Disposition and Remaining Delivery. T002-T008 delivery remains pending; no optimisation gain or final R6/SC acceptance claimed.

  - Evidence mode: validation
- [x] T002 - Route Qt translation XML outside the TypeScript parser
  - Depends on: T001.
  - Requirements: Requirement 1 AC1-AC5.
  - Properties: CP-001; CP-002.
  - Files: src/infrastructure/filesystem/file-identity.ts; file-catalog-scanner.ts;
    src/infrastructure/extraction/; tests/workspace/; new owned Qt/TypeScript fixtures.
  - Acceptance: bounded positive format classification, consistent identities and
    coverage; positive supported Qt signatures invoke no TypeScript parser,
    readable inconclusive prefixes retain extension admission, and genuine
    TypeScript retains its canonical parser. Include Qt roots beyond the bound
    and TypeScript with long leading comments, strings and misleading directories.
  - Validation: V002; typecheck and focused Vitest fixtures.
  - Evidence: Implemented shared 16,384-byte positive Qt signature recognition and canonical containment-checked scanner reads; XML uses existing unsupported coverage, genuine/inconclusive TS and TSX retain canonical routing, and local profiling labels unconfirmed admissions. V002 passes: 42 new tests including zero positive-Qt TS parser calls, exact boundaries/encoding/malformed prolog/read failures. Final integrated validation: typecheck, 12 Vitest files/126 tests, runtime build/receipt all passed. Independent review accepted with no blockers. Four-pass final production-worker probe exactly matched all 9,341 independently expected semantic records with eight predicted Qt/accounting corrections and no extra differences. See verification.md#t002-qt-translation-admission. Durable runtime operations updated; no criterion deferred. Comparative performance remains T007; T003-T008 pending.

  - Evidence mode: validation
- [x] T003 - Compile immutable ignore matchers once
  - Depends on: T001.
  - Requirements: Requirement 2 AC1-AC3; SC-001.
  - Properties: CP-001.
  - Files: src/domain/policies/path-policy.ts; src/infrastructure/filesystem/ignore-file-policy.ts;
    file-catalog-scanner.ts; workspace-safety.ts; src/debug/refresh-scan-benchmark.ts;
    tests/workspace/; tests/mcp/refresh-scan-benchmark.test.ts; frozen policy fixture;
    existing runtime-operations and observability design owners.
  - Acceptance: policy-scoped bounded matcher lifetime, current/child policy
    invalidation and equivalent output; compilation and CPU targets pass.
  - Validation: V003; typecheck, focused Vitest and controlled scan benchmark.
  - Evidence: R2 AC1-AC3, CP-001, V003 and SC-001 pass. Immutable policy-owned ignore matchers and scan-owned priority matchers preserve 500 frozen policy outcomes and all 9,341 worker semantic records. Five-run identical-harness comparison: median scan CPU 3.338694 s to 0.514173 s (84.60% lower); constructions 1,299,336 to 62 = 2 x (27 + 4); all full scanner outputs byte-identical. Root/child wildcard invalidation covers both ignore files with exact fresh-preparation counts. Typecheck, 145 integrated tests, six strengthened matcher/golden tests, runtime build/receipt and independent source/evidence review pass. Durable owners updated; see verification.md#t003-compiled-path-matchers. No T003 deferral; T004-T008 remain pending.

  - Evidence mode: validation
- [x] T004 - Persist and reuse generation catalog and project shape
  - Depends on: T001.
  - Requirements: Requirement 3 AC1-AC4; Requirement 5 AC3-AC5.
  - Properties: CP-001; CP-003; CP-005.
  - Files: src/ports/; src/contracts/; src/application/use-cases/index-repository-graph.ts;
    src/infrastructure/sqlite/; src/infrastructure/filesystem/; src/server.ts;
    src/infrastructure/runtime/refresh-controller.ts; repository-refresh-triggers.ts;
    startup-graph-warmup-worker.ts; tests/graph/graph-build-continuation.test.ts;
    tests/workspace/; watcher/controller/migration boundary fixtures.
  - Acceptance: one broad discovery per unchanged generation across worker exits;
    correct priority/docs views, no repeated shape probe, safe invalidation and
    restart, tested migration and truthful distinct identity counts. Consume only
    sealed manifests; verify construction/seal crash cases and the T001-defined
    final freshness protocol, including edits not yet admitted by the watcher.
  - Validation: V004; typecheck, continuation/store/workspace/architecture suites.
  - Evidence: V004 and SC-002 pass: sealed inventory reused across worker isolates; documentation and shape reuse; atomic unique counters/cursors; receipt-gated seed/final publication; watcher handshake; dead-generation recovery; owned empty-v4 migration. Final typecheck, full suite (172 files; 1766 passed; one skipped), runtime build/receipt, plugin validation and compiled MCP smoke pass. Four-pass worker enumerates six directories in pass 1 and zero thereafter; all 9341 semantic records match after three independently expected corrections. Independent architecture/operations/security reviews accepted; durable owners and operator runbook updated. See verification.md#t004-sealed-inventory-and-publication for commands, metrics and limits. An earlier unattributed intermittent profiling failure remains an explicit T007 validation risk with retained diagnostics; no causal repair claimed. No T004 criterion deferred; T005-T008 and B014 remain separate.

  - Evidence mode: validation
- [ ] T005 - Reuse indexed reference candidate pools
  - Depends on: T001.
  - Requirements: Requirement 4 AC1-AC3.
  - Properties: CP-004; CP-005.
  - Files: src/application/use-cases/index-repository-graph.ts; relevant domain services;
    tests/graph/graph-build-continuation.test.ts; ruby-semantic-extraction.test.ts;
    reference-completeness.test.ts; owned cross-language/lambda fixtures.
  - Acceptance: name/count and special-form lookup avoid repeated whole-node
    filtering with graph/ambiguity parity and final-resolution cursor safety.
  - Validation: V005; typecheck, focused Vitest and operation-count scaling checks.
  - Evidence: Pending.

- [ ] T006 - Verify phase budgets and unique progress accounting
  - Depends on: T004.
  - Requirements: Requirement 5 AC1-AC5.
  - Properties: CP-003; CP-005.
  - Files: src/infrastructure/workers/startup-graph-warmup-worker.ts;
    src/infrastructure/runtime/refresh-controller.ts; src/contracts/; src/ports/;
    src/infrastructure/sqlite/; tests/runtime/operations.test.ts; tests/graph/.
  - Acceptance: explicit feasible phase allocation inside unchanged hard deadlines,
    tested native-overrun failure and settlement, unique versus work counters,
    versioned legacy handling, cancellation/supersession/shutdown safety.
  - Validation: V006; typecheck, focused runtime/continuation/shutdown suites.
  - Evidence: Pending.

## Integration and promotion

- [ ] T007 - Prove end-to-end performance and graph equivalence
  - Depends on: T002; T003; T004; T005; T006.
  - Requirements: Requirement 6 AC1-AC4; SC-001-SC-004.
  - Properties: CP-001-CP-006.
  - Files: src/debug/; tests/fixtures/; this package's verification.md.
  - Acceptance: five-run comparable scenarios include complete final resolution,
    cold/warm/edit/idle/resume cases, CPU/wall/RSS spread and operation counts;
    D006's frozen allowed-difference manifest/comparator, unaffected-file parity,
    intended Qt/counter corrections and all success criteria pass. If blocked, retain
    pending state and record exact missing evidence instead of partial success.
  - Validation: V007; pnpm typecheck; pnpm test; compiled isolated worker/MCP smoke.
  - Validation risk: Attribute any recurrence of the earlier intermittent manifest_validation_failed profiling outcome using retained failure-evidence.json; reject failed repetitions without retry or discarded evidence. Final T004 frozen suite/probe pass, but no causal repair of the earlier unattributed condition is claimed.
  - Evidence: Pending.

- [ ] T008 - Review, promote durable behavior and reconcile residuals
  - Depends on: T007.
  - Requirements: Requirement 6 AC4; all requirement dispositions.
  - Properties: CP-001-CP-006.
  - Files: existing durable owners listed in requirements.md; docs/backlog/README.md;
    this package; docs/history/spec-closure-log.md and spec-archive-index.md at closure.
  - Acceptance: independent architecture/operational/data-boundary review;
    resolve findings; promote actual behavior and benchmark guidance; mark B013
    done only after proof; retain B014 separately. Any newly deferred criterion
    requires a named owned backlog destination and explicit scope revision.
    Record closure/archival metadata only when their gates are satisfied.
  - Validation: V008; lifecycle traceability, evidence, promotion and closure checks;
    Markdown quality checks and git diff --check.
  - Evidence: Pending.
