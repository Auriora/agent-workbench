---
title: Agent Workbench adoption flow verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-07-12
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Scope

Verify Spec 038 requirements R1-R5 and tasks T001-T007. History evidence is a
baseline for workflow selection, not proof of correctness or a controlled
adoption outcome.

## Quality Gates

| Gate | Required? | Status | Evidence |
| --- | --- | --- | --- |
| Contract decisions D001 and D002 recorded | yes | complete | `design.md#decisions` |
| Requirement and property coverage complete | yes | pending | Traceability and tests |
| Cross-client plugin guidance validated | yes | pending | Plugin integration tests |
| Focused and full automated tests pass | yes | pending | Commands below |
| Controlled workflow quality does not regress | yes | pending | Adjudicated fixture comparison |
| Default startup, orientation, and task-context budgets do not regress | yes | pending | Baseline and proposed byte/latency evidence |
| Durable documentation promoted | yes | pending | T007 |
| Residual work has one destination | yes | pending | Closure reconciliation |

## Validation Commands

| Command | Purpose | Result |
| --- | --- | --- |
| `pnpm validate:plugin` | Validate packaged Codex, Claude Code, and Kiro surfaces. | pending |
| `pnpm typecheck` | Validate TypeScript contracts and implementation. | pending |
| `pnpm exec vitest run tests/mcp tests/integration` | Focused MCP and provider integration coverage. | pending |
| `pnpm test` | Full regression suite. | pending |
| Spec Lifecycle Manager `lint_spec_package` for Spec 038 | Validate package structure and traceability. | pending |
| Agent Workbench Markdown check for the changed set | Validate frontmatter, links, lists, and tables. | pending |

## Requirement And Property Coverage

| Requirement/property | Planned evidence | Residual risk |
| --- | --- | --- |
| R1 / CP-004 | Claude activation, skill resolution, thin-wrapper tests | Supported-history sample remains small. |
| R2 / CP-001 / CP-002 | Orientation snapshots, trust and degraded golden tests | Response-size trade-off pending D001. |
| R3 / CP-002 | Callable continuation schema and capability tests | Ranking quality needs fixtures, not history inference. |
| R4 / CP-002 | Navigation flow, budget, partial-semantic tests | Public shape pending D002. |
| R5 / CP-003 | Read-only/edit/review/docs/closure intent fixtures | Intent heuristics must remain explicit and bounded. |
| CP-005 | Baseline/proposed action, decision, round-trip, byte, latency, and output-quality comparison | Adjudication quality and fixture representativeness. |

## Controlled Workflow Quality Gates

Run the current and proposed workflow against the same adjudicated fixtures.
Each fixture names the user task, relevant evidence, expected next safe
decision, acceptable calls, calls that would be irrelevant, and required final
answer or implementation facts.

| Measure | Required outcome |
| --- | --- |
| Correct edit or evidence target | No regression. |
| Required evidence acquired | No regression. |
| Unsupported tool calls or claims | No increase; zero where the fixture marks evidence unsupported. |
| Irrelevant recommended actions | No increase. |
| Caller decisions and tool round trips | No increase unless adjudication records a specific quality gain. |
| Startup and default response bytes | No increase beyond recorded baseline unless adjudication records a specific quality gain. |
| Final answer or implementation completeness | No regression. |
| Repeated unchanged guidance | Zero within one task phase. |

Minimum negative fixtures include a trivial direct-read task, read-only review,
unrelated dirty worktree, ambiguous intent, unchanged snapshot, ordinary
content edit, unsupported semantics, definition-only navigation, and a task
whose answer is already complete in `context_for_task`.

## History Replay

Repeat the bounded Codex and Claude queries after implementation to detect
workflow changes. Report provider version, corpus window, top-level versus
subagent sessions, conformance/smoke exclusions, invocation counts, and coverage
limits. An observed adoption increase is not required for closure unless a
controlled fixture or adjudicated comparison is introduced.

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-12 | Codex and Claude history baseline recorded in `requirements.md` | accepted planning evidence | Observational only; effectiveness attribution remains out of scope. |
| 2026-07-12 | Spec package authoring lint | passed with one advisory | No errors; canonical-context recommendation remains non-blocking. |
| 2026-07-12 | Three-role expert review | accepted revisions | Coding-agent, platform-developer, and LLM-optimisation findings tightened usefulness, no-noise, intent, compatibility, and output-quality gates. |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
| --- | --- | --- |
| Scope | Plugin guidance, orientation receipt, selective continuation, progressive navigation, validation recommendation | D001-D002 resolved. |
| Out of scope | Chat-analyser fixes, command execution, parser/LSP fallbacks | None. |
| Permissions | Repository docs/source/tests only; installed runtimes require separate authority | Pending implementation plan. |
| Review | Contract/API review after decisions; post-implementation regression review | Pending. |
| Closure impact | Promote to durable designs, backlog/history, then remove package | Pending. |

## Residual Risks

- Claude supported ordinary history contains only three sessions in the
  baseline window.
- Usage counts do not prove why agents stopped or whether outputs were useful.
- Adjudicated fixtures are proxies for session quality and must cover both
  positive and negative cases to avoid optimising only for tool use.
- The combined navigation surface remains outside this slice; future work needs
  separate controlled evidence rather than invocation counts.

## Readiness Decision

- **Ready for implementation:** yes - D001 and D002 are resolved, with baseline
  budgets and controlled no-noise fixtures required before behavior changes.
- **Ready for promotion:** no
- **Ready for closure:** no

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
