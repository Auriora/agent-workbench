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
| Requirement and property coverage complete | yes | complete | Post-remediation review and fixtures close AWB-038-REV-001 through AWB-038-REV-006. |
| Cross-client plugin guidance validated | yes | complete | Claude, shared skill, Kiro skill, server-card, and registry tests |
| Focused and full automated tests pass | yes | complete | Commands below; 588 full-suite tests passed |
| Controlled workflow quality does not regress | yes | complete | Schema-callability, relevance, intent, collision, repeat-guidance, and watcher fixtures pass. |
| Default startup, orientation, and task-context budgets do not regress | yes | complete | Startup injection removed; receipt ceilings pass; public action explanations add at most 512 accepted bytes. |
| Durable documentation promoted | yes | complete | Current-state MCP, validation-loop, and runtime-contract docs describe the implemented behavior. |
| Residual work has one destination | yes | complete | All blocking findings remain in active Spec 038 tasks T001-T003 and T005-T007. |

## Validation Commands

| Command | Purpose | Result |
| --- | --- | --- |
| `pnpm validate:plugin` | Validate packaged Codex, Claude Code, and Kiro surfaces. | passed |
| `pnpm typecheck` | Validate TypeScript contracts and implementation. | passed |
| `pnpm exec vitest run tests/mcp tests/integration` | Focused MCP and provider integration coverage. | passed through focused slices and full suite |
| `pnpm test` | Full regression suite. | passed: 79 files, 588 tests |
| Spec Lifecycle Manager `lint_spec_package` for Spec 038 | Validate package structure and traceability. | passed with one non-blocking canonical-context advisory |
| Agent Workbench Markdown check for the changed set | Validate frontmatter, links, lists, and tables. | warnings limited to existing table-readability findings |

## Requirement And Property Coverage

| Requirement/property | Planned evidence | Residual risk |
| --- | --- | --- |
| R1 / CP-004 | Claude activation, skill resolution, thin-wrapper tests | Supported-history sample remains small. |
| R2 / CP-001 / CP-002 | Orientation snapshots, trust and degraded golden tests | Synchronized content-only pending work intentionally remains reusable. |
| R3 / CP-002 | Callable continuation schema and capability tests | Public lifecycle continuations are intentionally limited to schema-valid `docs_search` and `verification_plan`. |
| R4 / CP-002 | Navigation flow, budget, partial-semantic tests | Whole-program impact remains outside partial-semantic claims. |
| R5 / CP-003 | Read-only/edit/review/docs/closure intent fixtures | Free-text inference remains bounded; explicit intent is preferred. |
| CP-005 | Baseline/proposed action, decision, round-trip, byte, latency, and output-quality comparison | The accepted explanation fields add at most 512 bytes while removing irrelevant and repeated calls in controlled fixtures. |

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
| 2026-07-12 | Claude startup and packaged guidance byte comparison | passed | `CLAUDE.md` decreased from 865 to 483 bytes; automatic 747-byte SessionStart injection was removed; the conditional skill grew from 2746 to 2912 bytes to describe the compact receipt. |
| 2026-07-12 | Orientation resource budget fixtures | limited pass | Receipt and envelope ceilings pass; material watcher-state coverage is incomplete. |
| 2026-07-12 | Controlled continuation fixtures | limited pass | Covered cases pass, but schema-callability, relevance, collision, and repeat-guidance cases are missing. |
| 2026-07-12 | Full implementation validation | passed | Typecheck, plugin validation, focused tests, and full 588-test suite passed. |
| 2026-07-12 | Post-implementation senior review of commit `29134ee` | blocking findings | Four high-severity continuation/intent defects and two warning-level orientation/evidence gaps were confirmed; green tests do not cover these cases. |
| 2026-07-12 | Post-remediation fresh-context review | passed after follow-up | Schema validation, relevance, intent, action priority, watcher materiality, and stateless deduplication findings were closed after two review/fix cycles. |
| 2026-07-12 | Final remediation validation | passed | Typecheck, plugin validation, 75 focused tests, 33 intent/context tests, and full 597-test suite passed. |

## Post-Implementation Review Findings

| ID | Severity | Status | Finding | Required reconciliation |
| --- | --- | --- | --- | --- |
| AWB-038-REV-001 | high | closed | Returned continuation args included hidden or unvalidated normal-client arguments. | Public args now omit `repo_root`; lifecycle actions are allowlisted and contract-parsed; envelope fixtures validate schemas. |
| AWB-038-REV-002 | high | closed | Unrelated ranked symbols could receive references/impact. | Graph actions now require an exact requested symbol and task-relevant uncertainty; definition-only fixtures omit follow-up. |
| AWB-038-REV-003 | high | closed | Explicit unknown and negated/conflicting task text could promote actions. | Centralized intent signals cover edit/closure verbs, gerunds, and noun negations; parameterized neutral fixtures pass. |
| AWB-038-REV-004 | high | closed | Explicit edit/closure validation could be lost under the action cap. | Validation is selected before other candidates; the four-candidate collision fixture preserves it as primary. |
| AWB-038-REV-005 | warning | closed | Material watcher states could be labeled orientation-reusable. | Degraded/overflowed/failed/unavailable and changed/unknown scope states block reuse; synchronized pending content remains reusable. |
| AWB-038-REV-006 | warning | closed | Phase-level unchanged-guidance deduplication lacked a contract. | Optional `satisfied_actions` provides stateless canonical tool/argument deduplication with repeat-call fixtures. |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
| --- | --- | --- |
| Scope | Plugin guidance, orientation receipt, selective continuation, progressive navigation, validation recommendation | D001-D002 resolved. |
| Out of scope | Chat-analyser fixes, command execution, parser/LSP fallbacks | None. |
| Permissions | Repository docs/source/tests only; installed runtimes require separate authority | Pending implementation plan. |
| Review | Senior review plus fresh-context remediation re-review completed | All six findings closed. |
| Closure impact | Promote to durable designs, backlog/history, then remove package | Pending. |

The canonical-context advisory is explicitly waived for this reconciliation.
The spec names its durable inputs and promotion targets, while code contracts,
tests, repository instructions, and live validation remain higher authority; a
new `canonical-context.md` would duplicate those sources without resolving a
current ambiguity.

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
- **Ready for promotion:** yes
- **Ready for closure:** pending final lifecycle closure check and commit evidence

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
