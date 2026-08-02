---
title: Spec 049 Traceability
doc_type: spec
artifact_type: traceability
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability Matrix

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Change Impact | Verification | Durable Targets | Open Decisions |
|---|---|---|---|---|---|---|---|
| T001 | N/A | Package creation and scope completeness | `requirements.md`; `design.md`; `verification.md` | `change-impact.md` | `verification.md` | none | none |
| T002 | Requirement 1, 2, 4 | AC1, AC2 | `design.md` singleton and scope sections | `change-impact.md` (in-package) | `verification.md` | `docs/design/language-adapter-design.md`; `docs/reference/language-capability-matrix.md` | D002 |
| T003 | Requirement 5, 6, 7 | AC1, AC2 | `design.md` routing sections | `change-impact.md` | `verification.md` | `docs/reference/agent-readable-changelog.md`; `docs/reference/language-capability-matrix.md` | D002 |
| T004 | Requirement 3 | AC1, AC2 | `design.md` association sections | `change-impact.md` | `verification.md` | `docs/reference/language-capability-matrix.md` | D002 |
| T005 | Requirement 8 | AC1, AC2 | `design.md` metadata section | `change-impact.md` | `verification.md` | `docs/design/language-adapter-design.md` | D002 |
| T006 | Requirement 4 | AC1, AC2 | `design.md` overview validation wording | `change-impact.md` | `verification.md` | `docs/reference/agent-readable-changelog.md` | none |
| T007 | Requirement 1-8 | all AC | all design sections | `change-impact.md` | `verification.md` | none | D001 |
| T008 | N/A | promotion readiness | changelog and design deltas | `change-impact.md` | `verification.md` | `docs/design/language-adapter-design.md`; `docs/reference/language-capability-matrix.md`; `docs/reference/agent-readable-changelog.md`; `docs/backlog/README.md`; `docs/reference/dogfood-evidence-ledger.md` | D001 |
| T009 | N/A | closure and cleanup | all sections | `change-impact.md` | `verification.md` | `docs/history/spec-closure-log.md`; `docs/history/spec-archive-index.md` | D001 |

## Requirement To Delivery Matrix

| Requirement | Priority | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
|---|---|---|---|---|---|---|---|---|
| Requirement 1 | must-have | AC1, AC2 | `design.md#singleton` | T002 | `verification.md` | none | covered | none |
| Requirement 2 | must-have | AC1, AC2 | `design.md#system-architecture`; `design.md#low-level-design` | T002 | `verification.md` | none | covered | none |
| Requirement 3 | must-have | AC1, AC2 | `design.md#scope`; `design.md#association` | T004 | `verification.md` | `docs/reference/language-capability-matrix.md` | covered | none |
| Requirement 4 | should-have | AC1, AC2 | `design.md#components-and-changes` | T002, T006 | `verification.md` | `docs/design/language-adapter-design.md`; `docs/reference/agent-readable-changelog.md` | covered | none |
| Requirement 5 | must-have | AC1, AC2 | `design.md#routing` | T003 | `verification.md` | `docs/reference/agent-readable-changelog.md` | covered | none |
| Requirement 6 | should-have | AC1, AC2 | `design.md#routing` | T003 | `verification.md` | none | covered | none |
| Requirement 7 | should-have | AC1, AC2 | `design.md#routing` | T003 | `verification.md` | `docs/reference/language-capability-matrix.md` | covered | none |
| Requirement 8 | could-have | AC1, AC2 | `design.md#security-trust-access` | T005 | `verification.md` | none | covered | none |

## Correctness Property Coverage

| Property | Requirements | Design Sections | Tasks | Tests Or Verification | Residual Risk |
|---|---|---|---|---|---|
| CP-001 | Requirement 1 | `design.md#requirement-coverage` | T002 | `verification.md` | covered; dynamic receivers remain out of scope |
| CP-002 | Requirement 2 | `design.md#high-level-design` | T002 | `verification.md` | covered; runtime route composition remains out of scope |
| CP-003 | Requirement 3 | `design.md#design-to-implementation-matrix` | T004 | `verification.md` | covered; dynamic association options remain unresolved |
| CP-004 | Requirement 5, 6, 7 | `design.md#low-level-design` | T003 | `verification.md` | covered; dynamic route forms remain unresolved |
| CP-005 | Requirements 1-8 | `requirements.md`; `design.md` | T009 | `verification.md` | covered; unsupported runtime forms remain non-goals |

## Design To Implementation Matrix

| Design Section | Requirements | Tasks | Interfaces Or Files | Verification | Coverage State | Residual Destination |
|---|---|---|---|---|---|---|
| Singleton identity canonicalization | Requirement 1 | T002 | `src/adapters/tree-sitter-ruby.ts`; `src/adapters/ruby-parser.ts` | `verification.md` | covered | none |
| Scope-aware resolution | Requirement 2 | T002 | `src/adapters/tree-sitter-ruby.ts`; `src/graph/reference-resolver.ts` | `verification.md` | covered | none |
| Association classifier | Requirement 3 | T004 | `src/adapters/tree-sitter-ruby.ts`; `src/graph/reference-resolver.ts` | `verification.md` | covered | none |
| Validation-environment blocking reason | Requirement 4 | T006 | `src/application/use-cases/get-repo-overview.ts` | `verification.md` | covered | none |
| Resource and action routing | Requirement 5, 6, 7 | T003 | `src/adapters/tree-sitter-ruby.ts`; `src/graph/reference-resolver.ts` | `verification.md` | covered | EB010 for concern identity |
| Advisory metadata for load/autoload | Requirement 8 | T005 | `src/adapters/tree-sitter-ruby.ts`; `src/adapters/ruby-parser.ts` | `verification.md` | covered | none |
| Durable promotion and cleanup | N/A | T008, T009 | `change-impact.md`; `verification.md` | `verification.md` | covered | closure metadata only |

## Open Decision Impact

| Decision ID | Blocks | Affected Requirements | Affected Tasks | Resolution Needed |
|---|---|---|---|---|
| D001 | closure and clean-up | all | T008, T009 | resolved: remove after recording closure metadata |
| D002 | requirement-to-task routing clarity | requirements 1-8 | T002, T003, T004, T005, T006 | resolved by the final traceability and verification matrices |

The task and requirement mappings above were reviewed after implementation and
verification. `covered` means that implementation ownership and passing
verification evidence are both mapped.
