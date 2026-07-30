---
title: Stdio bridge resource lifecycle traceability
doc_type: spec
artifact_type: traceability
status: draft
owner: platform
last_reviewed: 2026-07-30
---

# Traceability Matrix

## Task To Context Matrix

| Task | Requirements | Criteria | Design sections | Verification | Durable targets |
|------|--------------|----------|-----------------|--------------|-----------------|
| T001 | Requirement 1 | all requirements | all | package lint and MoE packet | none |
| T002 | Requirement 2 | R2 AC1-AC4; related R3 AC1-AC3 | Lightweight identity, daemon client/server | architecture and daemon tests | runtime design |
| T003 | Requirement 1 | R1 AC1-AC4; related R3 AC4 | Bridge session, error handling | stdio, subprocess, and installed-package tests | integration design |
| T004 | Requirement 4 | R4 AC1-AC3 | Operational considerations | Markdown/docs checks | runtime design, integration design, Codex runbook |
| T005 | Requirement 3 | all requirements | validation strategy and slice boundary | full validation and implementation MoE | verification record |
| T006 | Requirement 3 | R3 AC3-AC6; R2 AC1-AC4; R4 AC4 | daemon client diagnostics, canonical launch entrypoint, migration and compatibility | native failure, profile, architecture, and package tests | integration design, packaging/runbook |
| T007 | Requirement 4 | all requirements | validation strategy and operational considerations | full validation and final implementation MoE | verification and promotion records |
| T008 | Requirement 4 | R1 AC1, R1 AC2, R1 AC3, R1 AC4; R2 AC1, R2 AC2, R2 AC3, R2 AC4; R3 AC1, R3 AC2, R3 AC3, R3 AC4, R3 AC5, R3 AC6; R4 AC1, R4 AC2, R4 AC3, R4 AC4 | requirement coverage, correctness properties, canonical launch entrypoint, migration and compatibility | release/install reconciliation, criterion mapping, promotion evidence, and closure checks | final spec and closure records |

## Requirement To Delivery Matrix

| Requirement | Priority | Tasks | Verification | Durable target | Coverage |
|-------------|----------|-------|--------------|----------------|----------|
| Requirement 1 | must-have | T003, T005, T007 | lifecycle, subprocess, and installed-bin EOF tests | runtime operations design | complete |
| Requirement 2 | must-have | T002, T005, T006, T007 | import-boundary test plus targeted and full regressions | runtime operations design | complete |
| Requirement 3 | must-have | T002, T003, T005, T006, T007, T008 | daemon launch/integration, native failure, profile, package, installed packaging, and release reconciliation | integration design | complete |
| Requirement 4 | should-have | T004, T005, T006, T007, T008 | Markdown/docs, promotion proof, criterion mapping, and evidence consistency checks | design and runbook targets | complete |

## Acceptance Criterion Evidence

| Criterion | Implementation or durable evidence | Executed verification |
|-----------|------------------------------------|-----------------------|
| R1 AC1 | `src/mcp/stdio-launch.ts` stdin teardown | lifecycle tests and installed-bin EOF smoke |
| R1 AC2 | `src/mcp/stdio-launch.ts` socket teardown | lifecycle and daemon-entrypoint subprocess tests |
| R1 AC3 | guarded `StdioBridgeSession` teardown | racing/idempotent lifecycle tests |
| R1 AC4 | transport-owned liveness | open-forwarding lifecycle test |
| R2 AC1 | lightweight stdio-to-daemon-client graph | transitive import-boundary test |
| R2 AC2 | `src/mcp/daemon-client.ts` admission path | daemon launch and integration tests |
| R2 AC3 | `src/mcp/daemon.ts` server composition | daemon-entrypoint integration tests |
| R2 AC4 | forbidden-import architecture contract | transitive import-boundary negative cases |
| R3 AC1 | startup-lock election | simultaneous-client daemon-launch tests |
| R3 AC2 | ready-daemon reuse | daemon convergence and installed-package smoke |
| R3 AC3 | retained protocol, metadata, identity, root, and failure contracts | daemon launch/integration and profile tests |
| R3 AC4 | source wrapper at implementation; compiled wrapper after Spec 046 | plugin validation, launch smoke, and installed-package smoke |
| R3 AC5 | bounded native-loader guidance for owner and waiters | fake-child, real-child, waiter, and cleanup tests |
| R3 AC6 | implementation-time `0.6.2` package truth; `v0.6.3` delivery and Spec 046 supersession recorded | profile/package tests plus release/install reconciliation |
| R4 AC1 | `docs/design/runtime-operations-design.md` Runtime Ownership | direct durable-doc read and Markdown check |
| R4 AC2 | `docs/runbooks/codex-agent-workbench-plugin.md` Bridge process interpretation | direct durable-doc read and Markdown check |
| R4 AC3 | `verification.md` process/module observations and RSS limitation | evidence-quality and direct review |
| R4 AC4 | reconciled design, traceability, tasks, verification, promotion, and release state | lifecycle audit, evidence-quality, and closure checks |

## Correctness Properties

| Property | Requirements | Tasks | Verification | Residual risk |
|----------|--------------|-------|--------------|---------------|
| CP-001 | Requirement 1 | T003 | event-order lifecycle and installed-bin EOF tests | open clients intentionally remain connected |
| CP-002 | Requirement 3 | T002, T005, T007 | existing concurrent startup tests and full regressions | none observed |
| CP-003 | Requirement 2 | T002, T006, T007 | transitive import architecture test and targeted regressions | exact RSS varies by platform |
| CP-004 | Requirement 3 | T006, T007 | fake-child exit-before-close, real-child immediate-exit, actual daemon-entrypoint native failure, and waiter tests | none observed |

## Design To Implementation Matrix

| Design section | Requirements | Tasks | Interfaces or files | Verification | Coverage |
|----------------|--------------|-------|---------------------|--------------|----------|
| Lightweight runtime identity contract | Requirements 2, 3 | T002 | named contract modules and SQLite identity imports | architecture and daemon tests | complete |
| Daemon client module | Requirements 2, 3 | T002 | `src/mcp/` client/server modules | daemon launch tests | complete |
| Bridge session | Requirements 1, 3 | T003 | `src/mcp/stdio*.ts` and canonical launch artifacts | lifecycle, subprocess, installed-package tests | complete |
| Operational considerations | Requirement 4 | T004, T008 | design and runbook targets | Markdown/docs and closure-evidence checks | complete |

## Open Decision Impact

No open decision blocks implementation. T001 resolves the bridge API shape
during expert review.
