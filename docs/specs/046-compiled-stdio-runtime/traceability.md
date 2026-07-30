---
title: Compiled stdio runtime traceability
doc_type: spec
artifact_type: traceability
status: draft
owner: platform
last_reviewed: 2026-07-30
---

# Traceability Matrix

## Task To Context Matrix

| Task | Requirements | Criteria | Design | Verification | Durable targets |
|------|--------------|----------|--------|--------------|-----------------|
| T001 | all | all | decisions and review gates | lifecycle lint and expert review | none |
| T002 | R1, R2 | R1 AC1-AC4; R2 AC1, AC3-AC5 | D001-D003, runtime builder | build, receipt, lifecycle, architecture, compiled daemon/worker/native-failure tests | runtime design |
| T003 | R2, R3 | R2 AC1-AC3, AC5; all R3 | D003-D004, launch surfaces | plugin/package/container/POSIX repo-local tests | integration design and runbook |
| T004 | R4 | all | operational considerations | module/RSS/cardinality observation and docs checks | all three durable owners |
| T005 | all | all | validation and rollback | full validation and independent review | verification record |

## Requirement To Delivery Matrix

| Requirement | Priority | Tasks | Verification | Coverage |
|-------------|----------|-------|--------------|----------|
| Requirement 1 | must-have | T002, T005 | compiled build/lifecycle/architecture tests | covered |
| Requirement 2 | must-have | T002, T003, T005 | stale output, post-build receipt, tarball payload, installer failure tests | covered |
| Requirement 3 | must-have | T003, T005 | launch-surface, bounded-failure, and installed smoke tests | covered |
| Requirement 4 | should-have | T004, T005 | live module/RSS evidence and docs checks | covered |

## Correctness Properties

| Property | Requirements | Tasks | Verification | Residual risk |
|----------|--------------|-------|--------------|---------------|
| CP-001 | R2, R3 | T003 | launch-surface contract tests | provider retains ownership of open stdio transports |
| CP-002 | R1 | T002 | cold compiled daemon and graph-worker smoke | native/platform behavior remains installed-smoke dependent |
| CP-003 | R1, R4 | T002, T004 | artifact scan and module observation | platform RSS varies |
| CP-004 | R2 | T002, T003 | stale/missing build and installer-failure validation | checkout snapshots require reinstall after source changes |

## Design To Implementation Matrix

| Design section | Requirements | Tasks | Interfaces or files | Verification | Coverage |
|----------------|--------------|-------|---------------------|--------------|----------|
| D001 / runtime builder | R1, R2 | T002 | build contract, build script, package metadata, `dist/mcp` receipt | build and stale/missing-output tests | covered |
| D002 / sibling outputs | R1, R3 | T002, T003 | stdio/daemon entrypoints and daemon client | cold-launch smoke | covered |
| D003 / source and distribution authority | R2, R3 | T002, T003 | source tests, package tests, manifests | parity and payload checks | covered |
| D004 / package and local install boundaries | R2, R3 | T003 | prepack, container, repo-local installer | plugin/package/install tests | covered |

## Open Decision Impact

Review resolved the stale-build mechanism as a mandatory deterministic receipt,
narrowed repository-local installation to POSIX, inventoried runtime-root
helpers and overrides, and required missing-artifact and compiled native-load
negative tests. No implementation-blocking decision remains.
