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
| Requirement 1 | D001 | T001; T002; T007; T008 | V002; V007; V008 | not implemented |
| Requirement 2 | D002 | T001; T003; T007; T008 | V003; V007; V008 | not implemented |
| Requirement 3 | D003 | T001; T004; T007; T008 | V004; V007; V008 | not implemented |
| Requirement 4 | D004 | T001; T005; T007; T008 | V005; V007; V008 | not implemented |
| Requirement 5 | D003; D005 | T001; T004; T006; T007; T008 | V004; V006; V007; V008 | not implemented |
| Requirement 6 | D006 | T001; T007; T008 | V001; V007; V008 | exploratory evidence only |

All acceptance criteria are covered by the ranges in design.md. Every correctness
property maps to explicit task and validation gates there and in verification.md.

## Evidence and Scope

[Research](research.md) maps each measured/source-inspected mechanism to an owned
requirement/task. B013 in the [backlog](../../backlog/README.md#b013-deliver-daemon-cpu-efficiency)
is promoted to this package; it is not done. The only deliberately deferred
operational policy is [B014](../../backlog/README.md#b014-assess-background-indexing-cpu-duty-cycle).

T008 must promote durable truth and record semantic dispositions before closure.
No source implementation, schema migration, live deployment or performance gate
is complete. T001 is the next planning-to-implementation checkpoint.

## Task To Context Matrix

| Task | Design | Properties | Evidence |
| --- | --- | --- | --- |
| T001 | D001; D003; D005; D006 | CP-003; CP-005; CP-006 | V001 |
| T002 | D001 | CP-001; CP-002 | V002 |
| T003 | D002 | CP-001 | V003 |
| T004 | D003 | CP-001; CP-003; CP-005 | V004 |
| T005 | D004 | CP-004; CP-005 | V005 |
| T006 | D005 | CP-003; CP-005 | V006 |
| T007 | D001-D006 | CP-001-CP-006 | V007 |
| T008 | Promotion and residuals | CP-001-CP-006 | V008 |

## Design To Implementation Matrix

| Design | Owning boundary | Delivery task | State |
| --- | --- | --- | --- |
| D001 | Filesystem classification and extraction admission | T002 | pending |
| D002 | Policy preparation and matching | T003 | pending |
| D003 | Application, catalog ports and SQLite | T004 | pending |
| D004 | Application reference resolution | T005 | pending |
| D005 | Worker/controller budget and progress | T006 | pending |
| D006 | Checkout debug harness and worker profiler | T001; T007 | pending |

## Open Decision Impact

The manifest/migration and classification/budget checkpoints in T001 block their
dependent implementation tasks. No open question authorizes an alternate parser,
hidden scan fallback or deadline increase. B014 is a separately owned policy
question. [Canonical context](canonical-context.md) separates proposed slice
behavior from current durable contracts and exploratory evidence.
