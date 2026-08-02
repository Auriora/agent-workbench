---
title: Spec 049 Canonical Context
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

This package touches implementation and behavior that already has canonical durable
owners; this file scopes what remains package-local and what routes to durable
sources.

## Authority Hierarchy

The spec-local context does not override governance docs, source code, tests,
contracts, or evidence-backed durable docs.

## Always-Canonical External Sources

- `AGENTS.md` and repository policy
- source code, tests, generated contracts
- `docs/design/language-adapter-design.md`
- `docs/reference/language-capability-matrix.md`
- `docs/reference/agent-readable-changelog.md`

## Spec-Canonical Working Sources

| Source | Role | Scope | Notes |
|---|---|---|---|
| `requirements.md` | implemented intent | this package | package-local scope for this bounded slice |
| `design.md` | implementation approach | this package | static-only implementation boundary |
| `tasks.md` | execution index | this package | execution planning only |

## Imported Sources

| Spec path | Source path | Source revision or date | Status | Canonical scope | Promotion target |
|---|---|---|---|---|---|
| `specs/049/requirements.md` | `docs/design/language-adapter-design.md` | 2026-08-02 | adapted | Ruby/Rails adapter behavior | durable design updates if accepted |
| `specs/049/requirements.md` | `docs/reference/language-capability-matrix.md` | 2026-08-01 | summarized | Ruby/Rails capability boundaries | durable matrix clarification |
| `specs/049/requirements.md` | `docs/reference/agent-readable-changelog.md` | 2026-08-02 | summarized | User-facing behavior notes | durable changelog update if accepted |
| `specs/049/requirements.md` | `docs/backlog/README.md` | 2026-07-21 | adapted | follow-up routing | backlog updates if deferred |

## Non-Canonical Background Sources

- `docs/reference/dogfood-evidence-ledger.md` entries from prior runs are background
  unless newly promoted in this package.

## Promotion Map

| Spec-local content | Durable destination or route | Required before closure |
|---|---|---|
| acceptance-ready requirement wording | `docs/design/language-adapter-design.md` | yes |
| route/association capability framing | `docs/reference/language-capability-matrix.md` | yes |
| agent behavior deltas | `docs/reference/agent-readable-changelog.md` | yes |
| residual follow-ups and deferrals | `docs/backlog/README.md` | yes |

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Change impact: `change-impact.md`
- Verification: `verification.md`
