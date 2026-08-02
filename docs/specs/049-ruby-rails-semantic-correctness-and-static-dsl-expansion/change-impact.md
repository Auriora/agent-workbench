---
title: Spec 049 Change Impact
doc_type: spec
artifact_type: change-impact
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Change impact

## Purpose

## Durable Source Mapping

| Source | Current behavior relied on | Confidence | Notes |
|---|---|---|---|
| `docs/design/language-adapter-design.md` | Ruby adapter baseline and partial-semantic boundaries | high | Canonical adapter boundary source |
| `docs/reference/language-capability-matrix.md` | Ruby capability and slice ordering | high | Current capability level target |
| `docs/reference/agent-readable-changelog.md` | Prior agent behavior changelog format | medium | Historical, not exhaustive |
| `docs/backlog/README.md` | Follow-up routing | medium | Promotion routing and deferral destination |

## Change Type

- **Primary type:** bug_fix
- **Breaking change:** no
- **Durable docs required:** yes
- **External behavior affected:** no

## Proposed Changes

| Change | Type | Source of truth | New durable destination | Promotion required |
|---|---|---|---|---|
| Unify singleton method identity across `def self` and `class << self` | bug_fix | `requirements.md` | `docs/design/language-adapter-design.md` | yes |
| Expand static namespace-aware resolution and routing-action evidence | clarify | `requirements.md` | `docs/design/language-adapter-design.md` | yes |
| Clarify conservative association safety for through/source_type/HABTM | feature | `requirements.md` | `docs/design/language-adapter-design.md` | yes |
| Add ecosystem-neutral validation label policy | clarify | `requirements.md` | `docs/reference/agent-readable-changelog.md` | yes |
| Add static route `draw` mapping rules and defer concern reuse | feature | `requirements.md` | `docs/reference/language-capability-matrix.md`; EB010 | yes |

## Promotion Targets

| Spec content | Durable destination | Promotion status | Notes |
|---|---|---|---|
| Requirement and design intent | `docs/design/language-adapter-design.md` | pending | Package-only authoring completed, runtime implementation pending |
| Capability and slice boundary detail | `docs/reference/language-capability-matrix.md` | pending | Keep as `partial_semantic` unless evidence extends scope |
| Agent-visible behavior changes | `docs/reference/agent-readable-changelog.md` | pending | Add no-runtime static-boundary notes if accepted |
| Backlog follow-ups | `docs/backlog/README.md` | pending | Route deferred forms and follow-up checks |
| Historical evidence baseline | `docs/reference/dogfood-evidence-ledger.md` | pending | Add only when closure evidence is verified |

## Unchanged Durable Areas

| Durable area | Reviewed source | Reason unchanged |
|---|---|---|
| architecture | `docs/architecture` | No runtime architectural component changes in this package. |
| operations | `docs/design/runtime-operations-design.md` | No operational rollout changes in this package. |

## Bug Fix Details

- **Observed behavior:** Prior static output may expose split singleton identities and
  conservative fallback gaps for certain route/association forms.
- **Expected behavior:** Static evidence is bounded and consistent within scoped
  rules; unsupported and dynamic forms remain unresolved/deferred.
- **Root cause evidence:** Missing scope/normalization rules and route/association
  guardrails in the existing parser-backed slice.
- **Regression risk:** Low, if unresolved/deferred behavior is preserved.
- **Durable doc update needed:** Adapter design and reference matrix updates plus
  changelog notes.

## Open Questions

- Whether validation labels should become a dedicated canonical enum now or later.
- Whether concern edge reuse metadata should be expanded in a separate spec.
- Whether advisory `load/autoload/alias/visibility` evidence should move from metadata
  to a dedicated graph edge type later.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
