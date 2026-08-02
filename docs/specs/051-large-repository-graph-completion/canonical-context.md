---
title: Large-repository graph completion canonical context
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

EB014 remains a dedicated spec authority while active. Evidence claims in this
package are scoped to the bounded graph lifecycle slice.

## Authority Hierarchy

1. Active Spec 051 artifacts (requirements/design/tasks/verification).
2. Existing durable runtime and query contracts.
3. Existing durable backlog and dogfood evidence ownership.

## Always-Canonical External Sources

No external implementation source is canonical for EB014 beyond repository contracts.

## Non-Canonical Background Sources

- Adjacent repo traces and local reproduction runs are considered validation-only
  material and must not be treated as canonical behavior proof.
- Existing internal notes and legacy debug output can help narrow regressions but are
  not enough to override contract documents.

## Spec-Canonical Working Sources

- `requirements.md`
- `design.md`
- `tasks.md`
- `traceability.md`

## Imported Sources

- Adjacent repository traces and dogfood observations already used for issue evidence
  are validation samples only.

## Canonical Source Map

| Topic | Canonical owner | Constraint |
| --- | --- | --- |
| Coverage truth model | `docs/reference/runtime-contracts.md` | No false complete claims. |
| Graph run state | `docs/reference/language-capability-matrix.md` | Bound states remain explicit. |
| Query trust propagation | `docs/reference/runtime-contracts.md` and `docs/design/mcp-surface-design.md` | Preserve bounded evidence and avoid inference. |
| Completion and residuals | `docs/backlog/README.md` EB014 | Keep completion scope in this spec while residuals remain explicit. |
| Evidence | `docs/reference/dogfood-evidence-ledger.md` | Scope by bounded run shape and no universal claims. |

The spec package is the implementation authority for this slice until closure.

## Promotion Map

| Accepted result | Durable destination |
| --- | --- |
| Run-state and continuation semantics | `docs/reference/runtime-contracts.md` |
| Query trust propagation fields | `docs/design/mcp-surface-design.md` and `docs/reference/runtime-contracts.md` |
| EB014 completion/residual status | `docs/backlog/README.md` |
| Bounded run evidence | `docs/reference/dogfood-evidence-ledger.md` |
