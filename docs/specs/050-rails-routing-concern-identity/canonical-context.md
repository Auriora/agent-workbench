---
title: Rails routing concern identity canonical context
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

Identify the authority order for design, implementation, and later durable
promotion without treating background research as repository-current behavior.

## Authority Hierarchy

1. Active Spec 050 requirements and accepted design govern this bounded change.
2. Durable repository owners govern unchanged contracts and residual scope.
3. Official Rails sources define framework syntax, not Agent Workbench support.

## Always-Canonical External Sources

- Rails routing guide and Rails routing mapper API for framework semantics.

## Spec-Canonical Working Sources

- `requirements.md`, `design.md`, `research.md`, and `change-impact.md` while
  this package is active.

## Imported Sources

- None. No external code, fixture, or generated route set is imported.

## Non-Canonical Background Sources

- Adjacent Rails repositories are validation samples only.
- Agent Workbench routing output is navigation evidence, not implementation
  proof until direct source and tests are verified.

| Concern | Canonical owner | Design constraint |
| --- | --- | --- |
| Language semantics | `docs/design/language-adapter-design.md` | One tree-sitter Ruby path; static evidence only. |
| Capability claim | `docs/reference/language-capability-matrix.md` | Remain `partial_semantic`. |
| Graph/query behavior | `docs/reference/runtime-contracts.md` | Reuse existing node, edge, unresolved, reference, impact, and task-context paths. |
| Residual Rails work | `docs/backlog/README.md` EB010 | Retain runtime and broader DSL semantics. |
| Real-repository evidence | `docs/reference/dogfood-evidence-ledger.md` | Record bounded project shapes and limitations after fresh verification. |

The spec package is the implementation authority while active. Durable owners
must be reconciled before closure; they are not rewritten as speculative
current behavior during design.

## Promotion Map

| Accepted result | Durable destination |
| --- | --- |
| Parser and graph behavior | `docs/design/language-adapter-design.md` |
| Capability wording | `docs/reference/language-capability-matrix.md` |
| Agent-visible change | `docs/reference/agent-readable-changelog.md` |
| Residual semantics | `docs/backlog/README.md` EB010 |
| Bounded repository validation | `docs/reference/dogfood-evidence-ledger.md` |
