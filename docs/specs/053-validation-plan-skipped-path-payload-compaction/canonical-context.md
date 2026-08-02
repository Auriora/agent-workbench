---
title: Validation-plan skipped-path payload compaction canonical context
doc_type: spec
artifact_type: canonical-context
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Canonical Context

## Purpose

Prevent the active slice from confusing EB065 proposal text, current public
contract behavior, scanner implementation evidence, and future intended
behavior. The spec is canonical only for implementing this change; durable docs
remain current-state authority until promotion.

## Authority Hierarchy

The spec-local context does not override repository instructions, source/tests,
public schemas, live runtime evidence, or durable policy. Conflicts are
reconciliation inputs and must not be resolved by silently weakening acceptance.

## Always-Canonical External Sources

| Source | Authority reason | Handling |
| --- | --- | --- |
| `AGENTS.md` | repository implementation and validation rules | read before every implementation slice |
| source code and tests | current implementation truth | reconcile drift before changing tasks |
| `src/contracts/` | executable public schemas | contract changes require focused review/tests |
| live/package evidence | installed behavior truth | record identity and failure boundaries |

## Spec-Canonical Working Sources

| Source | Role | Scope | Notes |
| --- | --- | --- | --- |
| `requirements.md` | accepted intent | EB065 slice | includes exact accounting/no-extraction-limit constraints |
| `design.md` | implementation approach | scanner receipt and two public projections | deviations require reconciliation |
| `tasks.md` | execution index | T001-T009 | never implement from tasks alone |
| `traceability.md` | bidirectional mapping | requirements through closure | update with evidence |
| `verification.md` | proof and readiness contract | focused/full/dogfood gates | planned commands are not executed proof |

## Imported Sources

| Spec path | Source path | Source revision or date | Status | Canonical scope | Promotion target |
| --- | --- | --- | --- | --- | --- |
| `requirements.md` | `docs/backlog/README.md` EB004/EB065 | read 2026-08-02 | adapted | problem, acceptance, sequencing, exclusions | `docs/backlog/README.md` |
| `requirements.md`, `design.md` | `docs/design/mcp-surface-design.md` | read 2026-08-02 | summarized | current validation/context skipped-path behavior | `docs/design/mcp-surface-design.md` |
| `requirements.md`, `design.md` | `docs/reference/runtime-contracts.md` | read 2026-08-02 | summarized | versioning and current schema behavior | `docs/reference/runtime-contracts.md` |
| `design.md` | scanner/planner/context/presenter source and tests | worktree at spec creation | adapted | exact implementation seams and raw retention bound | source/tests plus durable promotion |

T001 re-read the imported sources and current implementation seams on
2026-08-02. The review incorporated required-result producer/test-double scope,
coherent planner/presenter delivery, exact context reason coverage, the existing
50-path request boundary, and the linear-memory consequence of exact scanner
accounting. Downstream artifacts were re-read after those revisions. No source
behavior is claimed implemented by that review.

## Non-Canonical Background Sources

| Source | Reason non-canonical | Handling |
| --- | --- | --- |
| Spec 052 package | adjacent completed implementation scaffold | use only for residual EB065 boundary and lifecycle style |
| installed runtime `0.6.1` dogfood note | historical friction evidence | do not treat as current source behavior without identity check |
| raw Agent Workbench routing output | navigation evidence only | directly read selected source/tests |

## Promotion Map

| Spec-local content | Durable destination or route | Required before closure |
| --- | --- | --- |
| accepted validation behavior | runtime requirements and MCP surface design | yes |
| public schema/count/truncation semantics | runtime contracts | yes |
| executable proof | MVP proof matrix | yes |
| delivery/residual boundaries | backlog | yes |
| agent-visible response change | agent-readable changelog | yes |
| executed runtime observation | dogfood ledger | when performed |

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Change impact: `change-impact.md`
- Verification: `verification.md`
