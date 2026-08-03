---
title: Shared MCP failure-message redaction traceability
doc_type: spec
artifact_type: traceability
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability Matrix

## Purpose

Map Spec 054 requirements, design sections, tasks, validation evidence, and
durable promotion targets. Read the complete linked artifact before
implementation; this matrix is a routing index, not a substitute for the spec.

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Verification | Durable Targets | Open Decisions |
| --- | --- | --- | --- | --- | --- | --- |
| T001 | Requirement 1 through Requirement 5 | all | all | lifecycle lint, readiness, task audit, review packet | none | none |
| T002 | Requirement 1, Requirement 3, Requirement 5 | Requirement 1 AC1-AC5; Requirement 3 AC1-AC5; Requirement 5 AC1-AC3 | Components And Changes; Security; Slice Boundary | bounded inventory and direct reads | MCP surface design | none |
| T003 | Requirement 1, Requirement 2, Requirement 4, Requirement 5 | all Requirement 1, Requirement 2, and Requirement 4 criteria; Requirement 5 AC1-AC3 | Correctness Property Coverage; Validation Strategy | hostile-message focused Vitest slice | proof matrix | none |
| T004 | Requirement 1 through Requirement 5 | all | Algorithm; Error Handling; Security; Migration And Compatibility | typecheck, focused Vitest, repeated sink inventory | runtime contracts; MCP surface design; workspace safety | none |
| T005 | Requirement 1 through Requirement 5 | Requirement 4 AC1-AC5; Requirement 5 AC1-AC4 | Validation Strategy; Operational Considerations | full repository gates and resolved reviews | all named durable targets | none |

## Requirement To Delivery Matrix

| Requirement | Priority | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Requirement 1: Redact And Bound Public Failure Text | must-have | Requirement 1 AC1, Requirement 1 AC2, Requirement 1 AC3, Requirement 1 AC4, Requirement 1 AC5 | Overview; Algorithm; Error Handling | T002-T005 | redaction and serialized-envelope tests | runtime contracts; workspace safety | complete | none |
| Requirement 2: Preserve Typed Failure Semantics | must-have | Requirement 2 AC1, Requirement 2 AC2, Requirement 2 AC3, Requirement 2 AC4, Requirement 2 AC5 | Data Flow; Error Handling; Migration And Compatibility | T003-T005 | structure golden tests and contract regressions | runtime contracts; MCP surface design | complete | none |
| Requirement 3: One Policy Across Public MCP Failure Sinks | must-have | Requirement 3 AC1, Requirement 3 AC2, Requirement 3 AC3, Requirement 3 AC4, Requirement 3 AC5 | Components And Changes; Slice Boundary | T002, T004, T005 | sink inventory and parity tests | MCP surface design; workspace safety | complete | none |
| Requirement 4: Cross-Surface Regression Evidence | must-have | Requirement 4 AC1, Requirement 4 AC2, Requirement 4 AC3, Requirement 4 AC4, Requirement 4 AC5 | Correctness Property Coverage; Validation Strategy | T003-T005 | focused/full Vitest and reviews | proof matrix | complete | none |
| Requirement 5: Compatibility And Promotion | must-have | Requirement 5 AC1, Requirement 5 AC2, Requirement 5 AC3, Requirement 5 AC4 | Migration And Compatibility; Operational Considerations | T001, T004, T005 | contract `0.1`, package gates, promotion review | all named durable targets | complete | none |

## Correctness Property Coverage

| Property | Requirements | Design Sections | Tasks | Tests Or Verification | Residual Risk |
| --- | --- | --- | --- | --- | --- |
| CP-001 no unsafe sentinel in public MCP responses | Requirement 1, Requirement 3, Requirement 4 | Data Flow; Validation Strategy | T002-T005 | serialized hostile-message fixtures | sink inventory may reveal additional tests |
| CP-002 idempotent, 512-byte UTF-8 output | Requirement 1, Requirement 4 | Algorithm | T003-T005 | table and multi-byte boundary tests | none expected |
| CP-003 structural failure invariance | Requirement 2, Requirement 4, Requirement 5 | Data Flow; Migration And Compatibility | T003-T005 | exact code/retry/meta/trust/data/next-action golden tests | none expected |
| CP-004 every public sink classified | Requirement 1, Requirement 3 | Components And Changes; Slice Boundary | T002, T004, T005 | pre/post `rg` inventory and direct reads | non-public debug paths require explicit classification |
| CP-005 cause-code behavior precedes redaction | Requirement 2, Requirement 4 | Data Flow; Error Handling | T003-T005 | unknown-impact cause-code regression | none expected |

## Design To Implementation Matrix

| Design Section | Requirements | Tasks | Interfaces Or Files | Verification | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- | --- |
| Components And Changes | Requirement 1, Requirement 3, Requirement 5 | T002, T004 | redaction helper, shared envelope, resources, presenters, diagnostics | sink inventory and focused tests | complete | none |
| Algorithm | Requirement 1, Requirement 4 | T003, T004 | `src/presentation/redaction.ts` | table, idempotence, and UTF-8 tests | complete | none |
| Error Handling | Requirement 1, Requirement 2 | T003, T004 | shared envelope and typed builders | failure-class and cause-code golden tests | complete | none |
| Security, Trust, And Access | Requirement 1 through Requirement 4 | T002-T005 | serialized public response boundary | security review and hostile sentinels | complete | none |
| Migration And Compatibility | Requirement 2, Requirement 5 | T001, T003-T005 | runtime contracts and current schemas | typecheck, contract tests, review | complete | none |
| Validation Strategy | Requirement 1 through Requirement 5 | T003-T005 | representative tests and repository gates | recorded task evidence | complete | none |

## Open Decision Impact

No open product or architecture decision currently blocks implementation. Any
proposal for a new public field, error class, contract version, fallback
redactor, or feature flag is a design deviation and must reopen readiness
review rather than being treated as an implementation detail.

## Maintenance Notes

- Update coverage states as task evidence is recorded.
- `not-covered` rows block closure until implemented, rejected with rationale,
  or routed to exactly one durable destination.
- Keep public sink inventory results linked to T002 and T004 evidence.
- Reconcile this matrix before implementation, promotion, and closure.
