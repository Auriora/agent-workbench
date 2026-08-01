---
title: Ruby and Rails resource discovery canonical context
doc_type: spec
artifact_type: canonical-context
status: draft
owner: platform
last_reviewed: 2026-08-01
---

# Canonical Context

## Purpose

Prevent the older priority matrix and planned adapter descriptions from being
mistaken for current implementation truth while this package proposes changes
to Ruby/Rails priority and capability. This package records proposed,
not-yet-published,
priority and promotion state.

## Authority Hierarchy

Repository instructions, user decisions, source, tests, public contracts, and
live evidence outrank this package. This package is canonical only for the
active Ruby/Rails resource-discovery slice.

## Always-Canonical External Sources

| Source | Authority reason | Handling |
|--------|------------------|----------|
| `AGENTS.md` | Repository implementation and validation policy | Read before task work. |
| source and tests | Current implemented behavior | Reconcile conflicts; do not overwrite truth with task markers. |
| `docs/reference/runtime-contracts.md` | Public capability and evidence vocabulary | Keep shared schemas language-neutral. |
| `docs/reference/documentation-map.md` | Durable documentation ownership | Promote to named owners before closure. |

## Spec-Canonical Working Sources

| Source | Role | Scope | Notes |
|--------|------|-------|-------|
| `requirements.md` | accepted intent | resource-backed Ruby/Rails slice | User prioritisation recorded 2026-08-01. |
| `design.md` | implementation approach | repository-wide Rails project-shape policy and validation precedence | Catalog-driven discovery only; no parser fallback. |
| `tasks.md` | execution index | `docs/specs/047-ruby-rails-resource-discovery/tasks.md` | Do not implement from tasks alone. |

## Imported Sources

| Spec path | Source path | Source revision or date | Status | Canonical scope | Promotion target |
|-----------|-------------|-------------------------|--------|-----------------|------------------|
| `requirements.md` | `docs/backlog/README.md` EB010 | reviewed 2026-08-01 | adapted | promotion rules and dogfood signal | `docs/backlog/README.md` |
| `requirements.md` | `src/application/use-cases/rails-project-shape.ts` (proposed) | proposed 2026-08-01 | proposed | repository discovery policy and ownership | `docs/design/layered-runtime-architecture.md` |
| `requirements.md` | `src/application/use-cases/file-catalog-entry.ts` (proposed) | proposed 2026-08-01 | proposed | shared catalog identity input and scope reuse | `docs/design/language-adapter-design.md` |
| `requirements.md`, `design.md` | `docs/design/language-adapter-design.md` | reviewed 2026-08-01 | adapted | adapter policy and Ruby target | same source |
| `requirements.md` | `docs/reference/language-capability-matrix.md` | last reviewed 2026-06-07 | proposed pending T007/T008 evidence | Ruby/Rails delivery priority for this slice | same source |
| `requirements.md` | `docs/reference/workspace-safety-contract.md` | last reviewed 2026-07-04 | pending | Shared path-policy behavior and redaction routing | `docs/reference/workspace-safety-contract.md` |

## Non-Canonical Background Sources

| Source | Reason non-canonical | Handling |
|--------|----------------------|----------|
| Removed historical spec packages | Closure evidence only | Do not restore or implement from them. |
| External Rails projects | Dogfood evidence, not product contract | Distil findings into fixtures and the evidence ledger. |

## Promotion Map

| Spec-local content | Durable destination or route | Required before closure |
|--------------------|------------------------------|-------------------------|
| Ruby/Rails capability and limitations | `docs/design/language-adapter-design.md` | yes |
| Revised ecosystem priority | `docs/reference/language-capability-matrix.md` | yes |
| EB010 delivery state | `docs/backlog/README.md` | yes |
| Distilled Rails dogfood result | `docs/reference/dogfood-evidence-ledger.md` | yes |
| Rails shared path-policy routing and redaction evidence | `docs/reference/workspace-safety-contract.md` | yes |
| Parser-backed residual work | `docs/specs/048-ruby-rails-partial-semantic/` | yes |

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Change impact: `change-impact.md`
- Verification: `verification.md`
