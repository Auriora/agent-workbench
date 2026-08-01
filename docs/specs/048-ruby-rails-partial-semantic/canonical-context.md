---
title: Ruby and Rails partial-semantic canonical context
doc_type: spec
artifact_type: canonical-context
status: draft
owner: platform
last_reviewed: 2026-08-01
---

# Canonical Context

## Purpose

Keep Spec 047 resource-backed delivery, current source/tests, and this proposed
parser promotion distinct so future agents do not treat planned Ruby/Rails
semantics as implemented behavior.

## Authority Hierarchy

Repository instructions, user decisions, implemented source/tests, public
contracts, and live evidence outrank this package. This package is canonical
only for the active partial-semantic implementation slice after its dependency
gate is satisfied.

## Always-Canonical External Sources

| Source | Authority reason | Handling |
|--------|------------------|----------|
| `AGENTS.md` | Repository parser, fallback, architecture, and validation policy | Read before task work. |
| delivered Spec 047 source/tests/evidence | Dependency implementation truth | Reconcile through T001. |
| `docs/reference/runtime-contracts.md` | Public evidence and coverage vocabulary | Keep additions generic. |
| `docs/reference/documentation-map.md` | Durable documentation ownership | Promote before closure. |

## Spec-Canonical Working Sources

| Source | Role | Scope | Notes |
|--------|------|-------|-------|
| `requirements.md` | accepted intent | Ruby/Rails partial-semantic slice | Does not assert current support. |
| `design.md` | implementation approach | one tree-sitter Ruby path | No fallback. |
| `tasks.md` | execution index | Spec 048 | T001 dependency gate is mandatory. |

## Imported Sources

| Spec path | Source path | Source revision or date | Status | Canonical scope | Promotion target |
|-----------|-------------|-------------------------|--------|-----------------|------------------|
| full package | Spec 047 package and delivered evidence | future T001 reconciliation | background until delivered | resource discovery dependency | durable adapter docs |
| requirements/design | `docs/design/language-adapter-design.md` | reviewed 2026-08-01 | adapted | parser policy and promotion gates | same source |
| requirements/design | `docs/backlog/README.md` EB010/EB061 | reviewed 2026-08-01 | adapted | language priority and coverage truth | backlog disposition |

## Non-Canonical Background Sources

| Source | Reason non-canonical | Handling |
|--------|----------------------|----------|
| Ruby/Rails runtime behavior inferred from docs or conventions | Not executed implementation evidence | Use only to design fixtures. |
| External gems and application code | Dogfood/reference input | Do not copy private code or treat one project as universal proof. |

## Promotion Map

| Spec-local content | Durable destination or route | Required before closure |
|--------------------|------------------------------|-------------------------|
| Supported Ruby/Rails forms and limits | language adapter design | yes |
| Capability level | language capability matrix | yes |
| Coverage-domain contract | runtime contracts and MCP design if changed | yes |
| Deeper dynamic semantics | backlog or focused follow-up spec | yes |

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Change impact: `change-impact.md`
- Verification: `verification.md`
