---
title: Daemon-owned refresh convergence traceability
doc_type: spec
artifact_type: traceability
status: draft
owner: platform
last_reviewed: 2026-07-20
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability

## Requirement To Delivery Matrix

Planning coverage records whether design, bounded tasks, verification, and
durable destinations are sufficient for implementation. It is not implementation
evidence. Implementation and property rows remain `not-covered` until code and
executed evidence exist. Parent task rows express lifecycle sequencing; the
explicit child tasks in `tasks.md` are the bounded implementation handoffs.

| Requirement | Priority | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Requirement 1 | must-have | AC1.1-AC1.6 | Daemon-Scoped Refresh Controller; Canonical Execution State Machine; Connection Composition | T001-T002, T004-T005, T008-T009 | V001-V004, V011, V021 | `docs/design/runtime-operations-design.md`; `docs/requirements/runtime-requirements.md`; `docs/reference/mvp-proof-matrix.md` | complete | none |
| Requirement 2 | must-have | AC2.1-AC2.6 | Lifetime And Disconnects; Connection Composition | T001, T004-T005, T008-T009 | V002-V004, V007, V021 | `docs/design/runtime-operations-design.md`; `docs/requirements/runtime-requirements.md`; `docs/reference/mvp-proof-matrix.md` | complete | none |
| Requirement 3 | must-have | AC3.1-AC3.6 | Authoritative Diagnostics; Failure Behavior | T001, T006-T009 | V005-V006, V010, V021 | `docs/reference/runtime-contracts.md`; `docs/design/mcp-surface-design.md`; `docs/reference/mvp-proof-matrix.md` | complete | none |
| Requirement 4 | must-have | AC4.1-AC4.6 | Publication Lifecycle; Snapshot Publication; Failure Behavior | T001-T003, T007-T009 | V007-V010, V021 | `docs/design/graph-store-design.md`; `docs/reference/runtime-contracts.md`; `docs/reference/mvp-proof-matrix.md` | complete | none |
| Requirement 5 | must-have | AC5.1-AC5.6 | Failure Behavior; Repository Ownership And Crash Reconciliation; Lifetime And Disconnects | T001-T004, T006-T009 | V001, V003-V005, V008, V010-V011, V021 | `docs/design/runtime-operations-design.md`; `docs/design/graph-store-design.md`; `docs/reference/runtime-contracts.md`; `docs/reference/mvp-proof-matrix.md` | complete | none |
| Requirement 6 | must-have | AC6.1-AC6.6 | Connection Composition; Low-Level Design; Resolved Decisions; Validation Strategy | T001-T009 | V011-V021 | `docs/design/layered-runtime-architecture.md`; `docs/requirements/runtime-requirements.md`; `docs/reference/agent-readable-changelog.md`; `docs/runbooks/install-agent-workbench.md`; `docs/runbooks/codex-agent-workbench-plugin.md`; `packaging/agent-workbench/README.md` | complete | none |

## Correctness Property Mapping

| Property | Design Sections | Tasks | Verification | Coverage |
| --- | --- | --- | --- | --- |
| CP-001 | linearized shared controller admission | T001-T002, T004-T005, T008 | V001-V003, V011, V021 | covered: Phase 4 installed acceptance confirms one daemon and one replacement worker |
| CP-002 | daemon-scoped lifecycle plus generation-triggered convergence | T001-T002, T004-T005, T008 | V002-V004, V007, V021 | covered: Phase 4 source, crash, and installed receipts confirm convergence across disconnects |
| CP-003 | activity lease independent of requester socket | T001, T004, T007-T008 | V004, V010, V021 | covered: Phase 4 crash, pre-build failure, disconnect, and cleanup receipts release ownership correctly |
| CP-004 | explicit atomic publication and exact query recovery | T001-T003, T007-T008 | V007-V010, V021 | covered: Phase 4 crash barriers and installed exact-query receipt preserve atomic visibility |
| CP-005 | one awaited canonical diagnostics receipt | T001, T006, T008 | V005-V006, V021 | covered: Phase 4 source and installed receipts expose the canonical identities and trust state |
| CP-006 | terminal structured failure with no retry/fallback | T001-T003, T006-T008 | V001, V003, V005-V006, V010-V011, V021 | covered: Phase 4 recovery fixtures prove bounded failure, no automatic retry, and one later successor |
| CP-007 | monotonic accepted invalidation generations and coalesced catch-up | T001-T002, T005, T008 | V001, V003, V007, V021 | covered: Phase 4 installed receipt confirms one generation and one replacement invocation |
| CP-008 | publication independent of freshness and coverage | T001, T003, T007-T008 | V007-V010, V021 | covered: Phase 4 crash and exact-query receipts retain prior visibility until replacement publication |
| CP-009 | execution, ownership, activity, publication, and diagnostics identity agreement | T001-T002, T004-T008 | V001-V011, V021 | covered: Phase 4 recovery and installed receipts reconcile all runtime identities |

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Properties | Design Sections | Change Impact | Verification | Durable Targets | Encoded Constraints |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T001 | Requirement 1; Requirement 2; Requirement 3; Requirement 4; Requirement 5; Requirement 6 | AC1.1-AC1.6; AC2.1-AC2.6; AC3.1-AC3.6; AC4.1-AC4.6; AC5.1-AC5.6; AC6.1-AC6.6 | CP-001-CP-009 | Confirmed Root Cause; all contract-bearing design sections | Code And Contract Impact | V001-V011 | `docs/reference/runtime-contracts.md`; `docs/reference/mvp-proof-matrix.md` | deterministic barriers; contracts before implementation |
| T002 | Requirement 1; Requirement 4; Requirement 5; Requirement 6 | AC1.1-AC1.2, AC1.5-AC1.6; AC4.6; AC5.2-AC5.3, AC5.5-AC5.6; AC6.2-AC6.4, AC6.6 | CP-001, CP-004, CP-006-CP-007, CP-009 | Daemon-Scoped Refresh Controller; Publication Lifecycle; Failure Behavior | runtime coordination | V001, V003, V010-V011 | `docs/design/runtime-operations-design.md`; `docs/design/layered-runtime-architecture.md` | one linearized controller; one executor; no automatic retry |
| T003 | Requirement 4; Requirement 5; Requirement 6 | AC4.1-AC4.6; AC5.3-AC5.5; AC6.4, AC6.6 | CP-004, CP-006, CP-008 | Publication Lifecycle; Snapshot Publication; Persistence Migration And Rollback | graph publication | V007-V011 | `docs/design/graph-store-design.md`; `docs/reference/runtime-contracts.md` | publication state is not freshness or coverage; unpublished rows stay invisible; older runtimes block after migration |
| T004 | Requirement 1; Requirement 2; Requirement 5; Requirement 6 | AC1.1, AC1.3, AC1.5; AC2.3-AC2.6; AC5.4; AC6.1-AC6.5 | CP-001-CP-003, CP-009 | Connection Composition; Lifetime And Disconnects | daemon/standalone composition | V002, V004, V011 | `docs/design/runtime-operations-design.md`; `docs/design/layered-runtime-architecture.md`; `docs/requirements/runtime-requirements.md` | activity lease belongs to controller; terminal notification drives idle grace |
| T005 | Requirement 1; Requirement 2; Requirement 5; Requirement 6 | AC1.4, AC1.6; AC2.1-AC2.2; AC5.2, AC5.6; AC6.5 | CP-001-CP-002, CP-007, CP-009 | Daemon-Scoped Refresh Controller; Connection Composition; Data Flow | watcher/first-read triggers | V003, V007, V011 | `docs/design/runtime-operations-design.md`; `docs/design/mcp-surface-design.md` | one daemon watcher/queue; one local standalone equivalent; sequential catch-up |
| T006 | Requirement 3; Requirement 5; Requirement 6 | AC3.1-AC3.6; AC5.1, AC5.5; AC6.1-AC6.3, AC6.5 | CP-005-CP-006, CP-009 | Authoritative Diagnostics; Failure Behavior | integration health and security | V005-V006, V010-V011 | `docs/reference/runtime-contracts.md`; `docs/design/mcp-surface-design.md` | one awaited receipt; exact state matrix; structured bounded redaction |
| T007 | Requirement 3; Requirement 4; Requirement 5; Requirement 6 | AC3.4-AC3.6; AC4.4-AC4.6; AC5.1-AC5.6; AC6.4-AC6.6 | CP-003, CP-006, CP-008-CP-009 | Failure Behavior; Repository Ownership And Crash Reconciliation; Snapshot Publication | crash/resource recovery | V004, V008, V010-V011 | `docs/design/runtime-operations-design.md`; `docs/design/graph-store-design.md`; `docs/reference/runtime-contracts.md` | positive dead-owner evidence; invisible orphan builds; cleanup exactly once |
| T008 | Requirement 1; Requirement 2; Requirement 3; Requirement 4; Requirement 5; Requirement 6 | AC1.1-AC1.6; AC2.1-AC2.6; AC3.1-AC3.6; AC4.1-AC4.6; AC5.1-AC5.6; AC6.1-AC6.6 | CP-001-CP-009 | Validation Strategy; Data Flow | source and installed-package acceptance | V002, V007-V010, V019-V021 | `docs/reference/mvp-proof-matrix.md`; `docs/runbooks/install-agent-workbench.md`; `docs/runbooks/codex-agent-workbench-plugin.md`; `packaging/agent-workbench/README.md` | installed bin proof is distinct from source entrypoint and real CLI proof |
| T009 | Requirement 1; Requirement 2; Requirement 3; Requirement 4; Requirement 5; Requirement 6 | AC1.1-AC1.6; AC2.1-AC2.6; AC3.1-AC3.6; AC4.1-AC4.6; AC5.1-AC5.6; AC6.1-AC6.6 | CP-001-CP-009 | Durable Promotion Targets; Validation Strategy | Promotion Targets; Out-Of-Scope Destinations | V012-V021 plus completed focused evidence | exact paths in Promotion Trace | no closure with unpromoted truth, unowned residual, or EB014 scope absorption |

## Design To Implementation Matrix

| Design target | Implementation boundary | Tasks | Coverage |
| --- | --- | --- | --- |
| controller generations and sole executor | refresh controller, coordination use case, runtime port | T002 | covered by Phase 2 implementation receipt |
| publication/current selection and migration independent of freshness | graph index use case, graph store, snapshot port | T003 | covered by Phase 2 implementation receipt |
| daemon/standalone ownership and activity lease | daemon and server composition roots | T004 | covered by Phase 3 implementation receipt |
| daemon watcher and shared trigger generations | daemon watcher/queue, first-read and queue use cases | T005 | covered by Phase 3 implementation receipt |
| authoritative diagnostics and redaction | contracts, health use case, presenter, daemon binding | T006 | covered by Phase 3 implementation receipt |
| crash/orphan/resource recovery | daemon owner recovery, controller, worker/store cleanup | T007 | covered by Phase 4 recovery receipt |
| source and installed-package acceptance | MCP entrypoint fixtures and CI smoke scripts | T008 | covered by Phase 4 installed acceptance receipt |
| durable promotion and closure | exact destinations below | T009 | not-covered |

## Open Decision Impact

No open decision remains. The requirements and design encode the controller state machine, invalidation
generation authority, publication lifecycle, activity and ownership leases,
watcher ownership, diagnostics state matrix, failure/retry policy, and evidence
boundaries. Task execution may choose names and private module decomposition, but
must not reopen or weaken those constraints. A genuine contradiction discovered
during implementation requires requirements/design reconciliation before code,
not an implicit alternate path.

## Task Dependencies

```text
T001 -> T002
T001 -> T003
T002 + T003 -> T004
T004 -> T005
T004 -> T006
T003 + T004 + T006 -> T007
T005 + T006 + T007 -> T008
T008 -> T009
```

## Promotion Trace

T009 must reconcile every `not-covered` row, record exact command/artifact
evidence in `verification.md`, and promote verified truth to the applicable
exact destinations:

- `docs/design/runtime-operations-design.md`
- `docs/design/graph-store-design.md`
- `docs/design/layered-runtime-architecture.md`
- `docs/reference/runtime-contracts.md`
- `docs/design/mcp-surface-design.md`
- `docs/requirements/runtime-requirements.md`
- `docs/reference/mvp-proof-matrix.md`
- `docs/reference/agent-readable-changelog.md`
- `docs/runbooks/install-agent-workbench.md`
- `docs/runbooks/codex-agent-workbench-plugin.md`
- `packaging/agent-workbench/README.md`
- `docs/backlog/README.md`
- `docs/history/spec-closure-log.md`
- `docs/history/spec-archive-index.md`

If implementation does not change one candidate document, T009 must record the
reasoned no-op instead of silently omitting it. CI workflow and smoke-script
changes remain executable validation artifacts, not substitutes for durable
behavior or support documentation.
