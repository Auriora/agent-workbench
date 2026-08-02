---
title: Spec 049 Tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

This task sequence was reviewed against the current design and traceability
matrix. Task markers and evidence fields remain the authority for delivery state.

## Phase 1: Package setup and scope control

- [x] T001 package/reconcile
  - Depends on: none
  - Requirement: N/A
  - Files: `docs/specs/049-ruby-rails-semantic-correctness-and-static-dsl-expansion/README.md`, `requirements.md`, `design.md`, `tasks.md`, `research.md`, `traceability.md`, `verification.md`, `canonical-context.md`, `change-impact.md`
  - Acceptance: Package files reflect current package scope and required lifecycle headings.
  - Evidence: `spec_runtime.py lint docs/specs/049-ruby-rails-semantic-correctness-and-static-dsl-expansion` returned 0 errors/0 warnings, and `task-state-audit` returned status `pass` with 0 findings on 2026-08-02.

## Phase 2: Core static enhancements

- [x] T002 correctness fixes
  - Depends on: T001
  - Requirement: Requirement 1, Requirement 2, Requirement 4
  - Files: `design.md`, `requirements.md`
  - Acceptance: Singleton identity, scope-aware resolution, and label policy are implemented with evidence-first checks in parser fixtures.
  - Evidence: Singleton/parser, route-scope, and overview-label tests passed on 2026-08-02.

- [x] T003 endpoint expansion
  - Depends on: T002
  - Requirement: Requirement 5, Requirement 6, Requirement 7
  - Files: `design.md`, `requirements.md`
  - Acceptance: Resource/module/path options, member/collection/on action inference, and static draw linking are implemented with parser assertions.
  - Evidence: Parser and graph tests prove literal route options, custom actions, scope separation, and `draw` links; concern reuse is explicitly out of scope.

- [x] T004 associations
  - Depends on: T002
  - Requirement: Requirement 3
  - Files: `design.md`, `requirements.md`
  - Acceptance: Association extraction policy is specified for `through`, `source_type`, and HABTM with ambiguity gates.
  - Evidence: Parser and graph tests prove `source_type`, HABTM, and suppression of untyped polymorphic targets.

## Phase 3: Conservative metadata support

- [x] T005 Ruby static enhancements
  - Depends on: T004
  - Requirement: Requirement 8
  - Files: `design.md`, `requirements.md`
  - Acceptance: Advisory/static behavior for `load`, `autoload`, alias, and visibility is implemented with parser assertions.
  - Evidence: `tests/adapters/ruby-parser.test.ts` passed assertions for literal `load`/`autoload`, alias, visibility, and dynamic fail-closed records in the 43-test focused run.

## Phase 4: Validation and release readiness

- [x] T006 validation label
  - Depends on: T002
  - Requirement: Requirement 4
  - Files: `requirements.md`, `verification.md`
  - Acceptance: Verification expectations include a deterministic non-ecosystem label policy with scope-boundary fallbacks.
  - Evidence: Overview test proves Docker blocking uses `generic host repository commands` and not `JavaScript/TypeScript`.

- [x] T007 tests
  - Depends on: T002, T003, T004, T005, T006
  - Requirement: Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6, Requirement 7, Requirement 8
  - Files: `verification.md`, `tasks.md`
  - Acceptance: Static test matrix covers all success and deferred cases.
  - Evidence: Focused 43/43 and broader Ruby/Rails 138/138 passed; full suite 1,173/1,173 passed with `--maxWorkers=4`.

- [x] T008 durable promotion
  - Depends on: T007
  - Requirement: N/A
  - Files: `change-impact.md`, `verification.md`
  - Acceptance: All impacted durable docs and evidence destinations are updated or explicitly deferred.
  - Evidence: Language adapter design, capability matrix, changelog, and backlog updated with delivered and deferred boundaries.

- [x] T009 full validation/review/closure
  - Depends on: T008
  - Requirement: N/A
  - Files: `verification.md`
  - Acceptance: Validation gates are tracked for each required command and residual risk is explicit.
  - Evidence: Typecheck and full suite passed; lifecycle lint is clean and closure check found no implementation-coverage gap.
