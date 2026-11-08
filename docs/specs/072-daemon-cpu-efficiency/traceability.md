---
title: Daemon CPU efficiency traceability
doc_type: spec
artifact_type: traceability
status: draft
owner: platform
last_reviewed: 2026-11-08
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability

## Requirement To Delivery Matrix

| Requirement | Design | Tasks | Verification | State |
| --- | --- | --- | --- | --- |
| Requirement 1 | D001 | T001; T002; T007; T008 | V002; V007; V008 | T002 implemented and V002 verified; comparative gates pending |
| Requirement 2 | D002 | T001; T003; T007; T008 | V003; V007; V008 | not implemented |
| Requirement 3 | D003 | T001; T004; T007; T008 | V004; V007; V008 | not implemented |
| Requirement 4 | D004 | T001; T005; T007; T008 | V005; V007; V008 | not implemented |
| Requirement 5 | D003; D005 | T001; T004; T006; T007; T008 | V004; V006; V007; V008 | not implemented |
| Requirement 6 | D006 | T001; T007; T008 | V001; V007; V008 | T001 baseline verified; candidate and promotion pending |

All acceptance criteria are covered by the ranges in design.md. Every correctness
property maps to explicit task and validation gates there and in verification.md.

## Evidence and Scope

[Research](research.md) maps each measured/source-inspected mechanism to an owned
requirement/task. B013 in the [backlog](../../backlog/README.md#b013-deliver-daemon-cpu-efficiency)
is promoted to this package; it is not done. The only deliberately deferred
operational policy is [B014](../../backlog/README.md#b014-assess-background-indexing-cpu-duty-cycle).

T008 must promote durable truth and record semantic dispositions before closure.
T001 profiling/fixture source, exact observations and a six-scenario five-repetition
baseline passed independent review and integrated checks. T002's format admission,
unsupported coverage, parser routing and local characterization are verified;
current behavior is promoted to runtime operations. T003-T006, schema migration,
live deployment and comparative candidate-performance gates remain pending.

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Change Impact | Verification | Durable Targets | Open Decisions | Properties |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T001 | Requirement 1; Requirement 3; Requirement 5; Requirement 6 | R1 AC1-AC5; R3 AC2-AC3; R5 AC5; R6 AC1-AC3 | `design.md#d001-explicit-qt-translation-admission`; `design.md#d003-durable-catalog-manifest-and-shape`; `design.md#d005-budget-and-accounting`; `design.md#d006-worker-evidence` | `requirements.md#durable-impact` | `verification.md#quality-gates` (V001) | `docs/design/runtime-operations-design.md`; `docs/design/graph-store-design.md`; `docs/design/observability-debugging-design.md` | `design.md#open-questions` | CP-002; CP-003; CP-005; CP-006 |
| T002 | Requirement 1 | R1 AC1-AC5 | `design.md#d001-explicit-qt-translation-admission` | `requirements.md#durable-impact` | `verification.md#quality-gates` (V002) | `docs/design/runtime-operations-design.md` | `design.md#open-questions` | CP-001; CP-002 |
| T003 | Requirement 2 | R2 AC1-AC3; SC-001 | `design.md#d002-compiled-rule-set` | `requirements.md#durable-impact` | `verification.md#quality-gates` (V003) | `docs/design/runtime-operations-design.md` | none | CP-001 |
| T004 | Requirement 3; Requirement 5 | R3 AC1-AC4; R5 AC3-AC5 | `design.md#d003-durable-catalog-manifest-and-shape` | `requirements.md#durable-impact` | `verification.md#quality-gates` (V004) | `docs/design/runtime-operations-design.md`; `docs/design/graph-store-design.md` | `design.md#open-questions` | CP-001; CP-003; CP-005 |
| T005 | Requirement 4 | R4 AC1-AC3 | `design.md#d004-candidate-indexes` | `requirements.md#durable-impact` | `verification.md#quality-gates` (V005) | `docs/design/graph-store-design.md` | none | CP-004; CP-005 |
| T006 | Requirement 5 | R5 AC1-AC5 | `design.md#d003-durable-catalog-manifest-and-shape`; `design.md#d005-budget-and-accounting` | `requirements.md#durable-impact` | `verification.md#quality-gates` (V006) | `docs/design/runtime-operations-design.md`; `docs/design/graph-store-design.md`; `docs/reference/runtime-contracts.md` | `design.md#open-questions` | CP-003; CP-005 |
| T007 | All requirements | All acceptance criteria; SC-001-SC-004 | `design.md#d001-explicit-qt-translation-admission`; `design.md#d002-compiled-rule-set`; `design.md#d003-durable-catalog-manifest-and-shape`; `design.md#d004-candidate-indexes`; `design.md#d005-budget-and-accounting`; `design.md#d006-worker-evidence` | `requirements.md#durable-impact` | `verification.md#quality-gates` (V007) | `docs/design/observability-debugging-design.md` | `design.md#open-questions` | CP-001; CP-002; CP-003; CP-004; CP-005; CP-006 |
| T008 | All requirements | All criteria dispositions; R6 AC4 | `design.md#validation-strategy`; `design.md#migration-and-compatibility` | `requirements.md#durable-impact` | `verification.md#quality-gates` (V008) | `docs/design/runtime-operations-design.md`; `docs/design/graph-store-design.md`; `docs/design/observability-debugging-design.md`; `docs/reference/runtime-contracts.md` | none | CP-001; CP-002; CP-003; CP-004; CP-005; CP-006 |

## Design To Implementation Matrix

| Design Section | Requirements | Owning boundary | Tasks | Verification | Coverage State |
| --- | --- | --- | --- | --- | --- |
| D001; `design.md#d001-explicit-qt-translation-admission` | Requirement 1 | Filesystem classification and extraction admission | T002 | `verification.md#quality-gates` | covered |
| D002; `design.md#d002-compiled-rule-set` | Requirement 2 | Policy preparation and matching | T003 | `verification.md#quality-gates` | not-covered |
| D003; `design.md#d003-durable-catalog-manifest-and-shape` | Requirement 3 | Application, catalog ports and SQLite | T004 | `verification.md#quality-gates` | not-covered |
| D004; `design.md#d004-candidate-indexes` | Requirement 4 | Application reference resolution | T005 | `verification.md#quality-gates` | not-covered |
| D005; `design.md#d005-budget-and-accounting` | Requirement 5 | Worker/controller budget and progress | T006 | `verification.md#quality-gates` | not-covered |
| D006; `design.md#d006-worker-evidence` | Requirement 6 | Checkout debug harness and worker profiler | T001; T007 | `verification.md#quality-gates` | partial-blocking |

## Open Decision Impact

The manifest sealing/recovery, final freshness, comparison, migration and
classification/budget checkpoints passed T001's independent design review.
Downstream tasks own implementation and runtime proof. No open question authorizes an alternate parser,
hidden scan fallback or deadline increase. B014 is a separately owned policy
question. [Canonical context](canonical-context.md) separates proposed slice
behavior from current durable contracts and exploratory evidence.
