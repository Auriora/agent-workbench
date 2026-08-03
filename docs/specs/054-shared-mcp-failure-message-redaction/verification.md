---
title: Shared MCP failure-message redaction verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-08-03
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
| Requirements, design, tasks, and traceability reviewed | yes | complete | T001 lifecycle, contract, and security review on 2026-08-03 |
| Public failure-sink inventory complete | yes | complete | T002 bounded `rg` inventory and direct source review on 2026-08-03 |
| Hostile-message tests fail before and pass after implementation | yes | complete | T003 red: 6 failed/19 passed; T004 green: 148/148 passed |
| Structural failure semantics remain compatible | yes | complete | focused code, retryability, cause-code data, metadata, trust, and next-action assertions |
| Security and implementation reviews resolved | yes | complete | T001 readiness security review plus T005 in-session security/privacy and correctness/regression review found no blocker |
| Automated repository gates pass | yes | complete | typecheck, 148 focused tests, 1,241 full tests, plugin/skill/package gates, and diff check passed |
| Durable documentation promoted | yes | complete | runtime contracts, MCP surface design, workspace safety, proof matrix, and EB063 backlog disposition updated |
| Spec cleanup decision recorded | yes | pending | closure check after T005 completion commit |

## Validation Commands

| Command | Purpose | Result | Evidence |
| --- | --- | --- | --- |
| `pnpm typecheck` | TypeScript and contract compatibility | passed | T004/T005, exit 0 |
| `pnpm exec vitest run tests/presentation/redaction-boundary.test.ts tests/mcp/error-envelope-consistency.test.ts tests/mcp/diagnostics-for-files-tool.test.ts tests/mcp/repo-orientation-resource.test.ts tests/mcp/repo-status-resource.test.ts tests/mcp/repo-scope-overview-resource.test.ts tests/mcp/docs-surfaces.test.ts tests/mcp/docs-ranking-tool.test.ts tests/mcp/integration-health-resource.test.ts tests/mcp/workspace-edit-tools.test.ts tests/mcp/query-tools.test.ts --maxWorkers=4` | Representative redaction and failure-envelope parity across known tool, resource, presenter, and manual-adapter seams | passed | 11 files, 148 tests |
| `pnpm exec vitest run --maxWorkers=4` | Full regression suite | passed | 111 files, 1,241 tests |
| `pnpm validate:plugin` | Packaged MCP/plugin bindings | passed | plugin/package validation passed |
| `pnpm validate:skills` | Packaged Agent Skills | passed | 6 skill files, 0 errors, 0 warnings |
| `pnpm pack:dry-run` | Distribution contents | passed | package `0.6.7`, 259 entries; npm emitted only host config deprecation warnings |
| `git diff --check` | Patch hygiene | passed | exit 0 |
| `lint_spec_package` | Spec structure | passed | 0 diagnostics at verify stage |
| `closure_check` | Promotion and cleanup readiness | pending | rerun after T005 completion is written |

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
| --- | --- | --- | --- |
| Requirement 1: Redact And Bound Public Failure Text | AC1-AC5 | sanitizer boundary and serialized hostile-message tests passed | regex coverage is intentionally limited to the durable presentation vocabulary |
| Requirement 2: Preserve Typed Failure Semantics | AC1-AC5 | exact structural assertions plus full contract regression passed | none |
| Requirement 3: One Policy Across Public MCP Failure Sinks | AC1-AC5 | T002/T004 pre/post inventory and shared helper migration complete | new public sinks must follow the durable design |
| Requirement 4: Cross-Surface Regression Evidence | AC1-AC5 | focused 148/148 and full 1,241/1,241 passed | fixture representativeness |
| Requirement 5: Compatibility And Promotion | AC1-AC4 | contract `0.1`, package gates, durable docs, and EB063 disposition preserved | none |

## Public Failure-Sink Inventory

The T002 inventory traced exception-derived and caller-derived free text from
the MCP registries through final serialized envelopes. Registry callbacks that
only pass a message into a presenter are one data path, not independent sinks.

| Sink class | Paths | Classification | T003/T004 disposition |
| --- | --- | --- | --- |
| Shared tool failure envelope | `src/interface-adapters/mcp/envelope.ts` and tool registry callbacks using `classifiedFailureEnvelope` | unsafe: classification uses raw evidence correctly, but the final `errors[].message` is unbounded and unsanitized | sanitize only when constructing the public envelope; preserve raw input for classification and cause-code-dependent typed data |
| Shared resource provider failure | `src/interface-adapters/mcp/registries/resources/provider-failure.ts` and the orientation, status, scope, overview, docs, and integration-health resources | unsafe: the SQLite branch is fixed-safe, while the general branch interpolates raw exception text | sanitize the complete public provider-failure message with the canonical helper |
| Presenter-built failure envelopes | `task-context-presenter.ts`, `repo-scope-presenter.ts`, `repo-overview-presenter.ts`, `repo-orientation-presenter.ts`, `status-presenter.ts`, `integration-health-presenter.ts`, `docs-presenter.ts`, `verification-plan-presenter.ts`, `diagnostics-presenter.ts`, `workspace-edit-presenter.ts`, `symbol-search-presenter.ts`, `find-references-presenter.ts`, `impact-presenter.ts`, and `markdown-quality-presenter.ts` | unsafe: `input.message` reaches `errors[].message` and, for orientation/status/docs/task-context/verification-plan, nested reason, summary, or blocker text | sanitize once per builder and reuse the value in all duplicated public fields |
| Manual diagnostics adapter | `src/interface-adapters/mcp/registries/tools/diagnostics-for-files.ts` | unsafe: catch branch interpolates raw provider exception text directly | use the canonical helper with a fixed diagnostics recovery fallback |
| Fixed-safe generated messages | missing-provider strings, root-authority refusals, validation defaults, and known SQLite recovery wording | fixed-safe, but still flow through the same final sanitizer where they share a public builder | assert wording and typed semantics remain stable |
| Existing independently sanitized non-failure reasons | documentation-ranking reason, verification command reason, documentation action reason, and symbol/source presentation fields | independently sanitized with the existing presentation redaction path; not exception-derived failure sinks | retain existing field-specific limits; prove the new helper is idempotent when it receives already-redacted text |
| Non-public evidence | internal classification input, cause objects/codes, process stderr, debug logs, and instrumentation aggregation state | non-public in the reviewed MCP serialization paths | keep raw for internal decisions; do not add public-response fallbacks or logging changes |

The representative serialized-response suite therefore covers the shared tool
wrapper, resource helper, duplicated presenter fields, diagnostics manual
adapter, workspace safety/cause-code behavior, and the sanitizer boundary. A
post-implementation repeat of this inventory owns any remaining candidate.

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
| --- | --- | --- | --- |
| CP-001 no unsafe sentinel | serialized response assertions | passed | nested duplicated fields included |
| CP-002 idempotent 512-byte UTF-8 output | redaction table, marker-only fallback, and boundary tests | passed | none |
| CP-003 structural invariance | exact golden envelope assertions | passed | free-text wording is intentionally hardened |
| CP-004 every public sink classified | T002 and T004 inventory | passed | debug/public boundary recorded |
| CP-005 cause code precedes redaction | impact-domain regression | passed | none |

## Scope Reconciliation Before Closure

| Broad requirement, design target, or review finding | Implemented in this spec | Coverage state | Deferred or rejected work | Destination | Blocks closure? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Every public MCP failure sink uses one sanitizer or fixed-safe text | shared wrapper, resource helper, presenters/result errors, duplicated fields, manual diagnostics | complete | none | durable design and workspace-safety contract | no | T002/T004 inventory, focused tests |
| Public contract `0.1` remains structurally compatible | code/retryability/data/meta/trust/next actions unchanged | complete | none | runtime contracts | no | typecheck, focused and full suites |
| Hostile-message parity across tool/resource/manual paths | hostile serialized fixtures | complete | none | proof matrix | no | 148 focused tests |
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
| T001 | complete | Lifecycle lint: 0 findings; stage readiness: ready to implement with 0 blocking gaps; task audit: 0 errors/warnings; traceability: 0 gaps; contract and security reviews resolved; baseline redaction/envelope tests: 14/14 passed | T002 is the next task |
| T002 | complete | Bounded `rg` candidate search plus direct reads of the shared envelope, resource helper, presenter builders, manual diagnostics adapter, and representative tests; inventory recorded above | T003 owns the failing hostile-message fixtures |
| T003 | complete | Pre-implementation run: 6 expected failures, 19 passes | red phase recorded before source implementation |
| T004 | complete | canonical sanitizer, all inventoried migrations, typecheck, and 148/148 focused tests | post-inventory resolved all public exception-derived candidates |
| T005 | complete | durable docs updated; `pnpm typecheck`; 11-file focused Vitest slice 148/148; full Vitest 111 files/1,241 tests; `pnpm validate:plugin`; `pnpm validate:skills`; `pnpm pack:dry-run`; `git diff --check`; in-session security/privacy and correctness/regression review found no blocker | closure check must be rerun from the completed task state before cleanup |

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-02 | Spec creation plan and direct source review | specification only | Spec 054 allocated for backlog EB063; no implementation claim. |
| 2026-08-03 | T001 lifecycle, contract, and security readiness review | ready to implement | `lint_spec_package`: 0 findings; `stage_readiness`: ready with 0 blocking/context/downstream/traceability gaps; `task_state_audit T001`: 0 findings after completion; independent contract/security re-reviews: no blocker; focused Vitest baseline: 14/14 passed; `git diff --check`: passed. No production implementation claimed. |
| 2026-08-03 | T002 public MCP failure-sink inventory | complete | `rg` and direct reads covered the shared wrapper, resource helper, presenter-built envelopes, duplicated failure fields, manual diagnostics adapter, fixed-safe wording, and non-public internal evidence. |
| 2026-08-03 | T003 red-before-green run | expected failure | `pnpm exec vitest run tests/presentation/redaction-boundary.test.ts tests/mcp/error-envelope-consistency.test.ts tests/mcp/diagnostics-for-files-tool.test.ts --maxWorkers=4` produced 6 expected failures and 19 passes before source edits. |
| 2026-08-03 | T004 focused implementation validation | passed | `pnpm typecheck` passed; 11 focused files and 148 tests passed; post-implementation sink inventory found no unresolved public exception-derived candidate. |
| 2026-08-03 | T005 repository and packaging gates | passed | `pnpm typecheck`; `pnpm exec vitest run --maxWorkers=4` with 111 files and 1,241 tests; `pnpm validate:plugin`; `pnpm validate:skills` with 6 files, 0 errors, 0 warnings; `pnpm pack:dry-run` with 259 entries; `git diff --check`; `lint_spec_package` with 0 diagnostics. |

## T001 Review Finding Disposition

| Finding | Disposition | Evidence |
| --- | --- | --- |
| Named lifecycle checks might not be callable | rejected | `lint_spec_package`, `stage_readiness`, `task_state_audit`, `review_packet`, and `traceability_lookup` were called successfully through the authoritative lifecycle MCP surface. |
| Package lifecycle and T001 evidence were inconsistent | resolved | Requirements now identify implementation readiness and T002 as next; task and verification records agree. |
| Known resource/manual-adapter suites were absent from the focused command | resolved | The focused T003/T004 command now names orientation, scope/overview, docs surfaces, and integration-health suites; T002 still owns final inventory-driven expansion. |
| Traceability `complete` could be read as implementation proof | resolved | Traceability now defines coverage state as planned mapping and directs delivery claims to this verification record. |
| Marker-only redaction output was not explicitly recovery-oriented | resolved | Design and T003 acceptance now require the fixed sanitized fallback when no actionable text remains beyond redaction markers. |

## Manual Or External Verification

No external verification was required. In-session review of the changed public
failure seams found no blocker beyond the now-fixed fallback guard that the
full-suite rerun validated.

## Residual Risks

- Regex fixtures cannot prove arbitrary secret detection; acceptance is bounded
  to the canonical presentation redactor's documented categories.
- New public sinks could bypass the policy if future changes ignore the durable
  design; the proof matrix and shared boundary tests are the regression guard.

## Durable Promotion And Cleanup

| Spec content | Durable destination or deferral | Status | Evidence |
| --- | --- | --- | --- |
| Public failure-message contract | `docs/reference/runtime-contracts.md` | complete | T005 current-state contract updated |
| Shared MCP surface responsibility | `docs/design/mcp-surface-design.md` | complete | T005 adapter/presenter boundary updated |
| Redaction safety coverage | `docs/reference/workspace-safety-contract.md` | complete | T005 shared public-failure policy updated |
| Fixture and acceptance evidence | `docs/reference/mvp-proof-matrix.md` | complete | T005 public failure presentation row added |
| EB063 disposition | `docs/backlog/README.md` | complete | delivered through Spec 054 |

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
- **Blast radius checked:** yes; pre/post inventory plus focused and full suites
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
