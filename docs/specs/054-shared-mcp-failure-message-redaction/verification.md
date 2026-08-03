---
title: Shared MCP failure-message redaction verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Scope

This record covers Requirements 1 through 5, CP-001 through CP-005, and tasks
T001 through T005. It separates specification/readiness evidence from future
implementation, validation, promotion, and closure evidence.

## Quality Gates

| Gate | Required? | Status | Evidence |
| --- | --- | --- | --- |
| Requirements, design, tasks, and traceability reviewed | yes | pending | T001 |
| Public failure-sink inventory complete | yes | pending | T002 |
| Hostile-message tests fail before and pass after implementation | yes | pending | T003, T004 |
| Structural failure semantics remain compatible | yes | pending | T003, T004 |
| Security and implementation reviews resolved | yes | pending | T001, T005 |
| Automated repository gates pass | yes | pending | T004, T005 |
| Durable documentation promoted | yes | pending | T005 |
| Spec cleanup decision recorded | yes | pending | closure check |

## Validation Commands

| Command | Purpose | Result | Evidence |
| --- | --- | --- | --- |
| `pnpm typecheck` | TypeScript and contract compatibility | pending | T004, T005 |
| `pnpm exec vitest run tests/presentation/redaction-boundary.test.ts tests/mcp/error-envelope-consistency.test.ts tests/mcp/diagnostics-for-files-tool.test.ts tests/mcp/repo-status-resource.test.ts tests/mcp/docs-ranking-tool.test.ts tests/mcp/workspace-edit-tools.test.ts tests/mcp/query-tools.test.ts --maxWorkers=4` | Representative redaction and failure-envelope parity | pending | T003, T004 |
| `pnpm exec vitest run --maxWorkers=4` | Full regression suite | pending | T005 |
| `pnpm validate:plugin` | Packaged MCP/plugin bindings | pending | T005 |
| `pnpm validate:skills` | Packaged Agent Skills | pending | T005 |
| `pnpm pack:dry-run` | Distribution contents | pending | T005 |
| `git diff --check` | Patch hygiene | pending | T005 |
| `lint_spec_package` | Spec structure | pending | T001, T005 |
| `closure_check` | Promotion and cleanup readiness | pending | T005 |

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
| --- | --- | --- | --- |
| Requirement 1: Redact And Bound Public Failure Text | AC1-AC5 | pending T003/T004 hostile-message tests | sink inventory may expand the focused suite |
| Requirement 2: Preserve Typed Failure Semantics | AC1-AC5 | pending exact structural golden tests | typed surface-specific data needs direct review |
| Requirement 3: One Policy Across Public MCP Failure Sinks | AC1-AC5 | pending T002/T004 pre/post inventory | manual adapters can bypass the wrapper |
| Requirement 4: Cross-Surface Regression Evidence | AC1-AC5 | pending focused and full suites | fixture representativeness |
| Requirement 5: Compatibility And Promotion | AC1-AC4 | pending contract tests and durable promotion | none expected after review |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
| --- | --- | --- | --- |
| CP-001 no unsafe sentinel | serialized response assertions | pending | nested fields require full-envelope inspection |
| CP-002 idempotent 512-byte UTF-8 output | redaction table/boundary tests | pending | none expected |
| CP-003 structural invariance | exact golden envelope assertions | pending | free-text wording is intentionally hardened |
| CP-004 every public sink classified | T002 and T004 inventory | pending | debug/public boundary must be explicit |
| CP-005 cause code precedes redaction | impact-domain regression | pending | none expected |

## Scope Reconciliation Before Closure

| Broad requirement, design target, or review finding | Implemented in this spec | Coverage state | Deferred or rejected work | Destination | Blocks closure? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Every public MCP failure sink uses one sanitizer or fixed-safe text | none | not-covered | implementation pending | T002-T004 | yes | pending |
| Public contract `0.1` remains structurally compatible | none | not-covered | validation pending | T003-T005 | yes | pending |
| Hostile-message parity across tool/resource/manual paths | none | not-covered | tests pending | T003-T005 | yes | pending |
| Debug-only CLI, telemetry, and process stderr | none | out-of-scope | revisit only if a public MCP path is proven | EB009 or new backlog evidence | no | design slice boundary |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
| --- | --- | --- |
| Scope and out-of-scope files | requirements Non-Goals and design Slice Boundary | T002 may refine exact presenter/test files |
| Must-read context | requirements Durable Source Baseline and design Components | direct reads required before implementation |
| Permissions and approval points | repository instructions; source edits authorized only by a later implementation request | none for specification stage |
| Validation commands and expected signals | Validation Commands above | focused file list may expand after inventory |
| Review needs | security, public contract, implementation, final QA | reviews pending |
| Durable-doc or closure impact | requirements Durable Impact | promotion pending |
| Optional repo-evidence provider caveats | Agent Workbench routing is not implementation or validation proof | direct reads and commands required |

## Task Evidence

| Task ID | Status | Evidence | Notes |
| --- | --- | --- | --- |
| T001 | pending | none | readiness review not yet run |
| T002 | pending | none | sink inventory not yet recorded |
| T003 | pending | none | failing hostile-message tests not yet added |
| T004 | pending | none | implementation not started |
| T005 | pending | none | validation, review, promotion, and closure pending |

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-02 | Spec creation plan and direct source review | specification only | Spec 054 allocated for backlog EB063; no implementation claim. |

## Manual Or External Verification

None. Future security review must inspect serialized hostile-message responses.

## Residual Risks

- A manual adapter or presenter may interpolate provider text outside the
  shared wrapper; T002 and the post-implementation inventory own this risk.
- Regex fixtures cannot prove arbitrary secret detection; acceptance is bounded
  to the canonical presentation redactor's documented categories.
- Over-broad replacement with generic messages could remove recovery context;
  golden tests must assert safe phrase retention and typed structure.

## Durable Promotion And Cleanup

| Spec content | Durable destination or deferral | Status | Evidence |
| --- | --- | --- | --- |
| Public failure-message contract | `docs/reference/runtime-contracts.md` | pending | T005 |
| Shared MCP surface responsibility | `docs/design/mcp-surface-design.md` | pending | T005 |
| Redaction safety coverage | `docs/reference/workspace-safety-contract.md` | pending | T005 |
| Fixture and acceptance evidence | `docs/reference/mvp-proof-matrix.md` | pending | T005 |
| EB063 disposition | `docs/backlog/README.md` | pending | T005 |

### Spec Cleanup Decision

- **Cleanup action:** remove after promotion and closure checks, following the
  repository's recent spec policy
- **Reason:** active specs are temporary delivery scaffolding
- **Final spec commit:** pending
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Closure log entry updated:** no
- **Closure cleanup commit:** pending
- **Active indexes updated:** no
- **Durable docs linked back to evidence where useful:** no
- **Residual spec-only content:** none expected

## Ship Or Closure Risk

- **Risk level:** medium
- **Breaking change:** no
- **Blast radius checked:** no; T002 pending
- **Rollback path:** revert the shared sanitizer and migrated call sites; no
  stored data or schema migration
- **Requires human review:** yes, security and public contract
- **Release notes needed:** assess after implementation
- **Follow-up issue or spec needed:** no current evidence

### Risk Rationale

The code change should be small, but the public security boundary spans shared
tools, resources, presenters, and manual adapters. Incorrect placement can
leave a bypass or alter typed recovery semantics, so focused hostile fixtures,
an explicit inventory, and security review are required.

## Readiness Decision

- **Ready for promotion:** no
- **Ready for release:** no
- **Ready for closure:** no

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
