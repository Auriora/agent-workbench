---
title: Ruby and Rails resource discovery change impact
doc_type: spec
artifact_type: change-impact
status: draft
owner: platform
last_reviewed: 2026-08-01
---

# Change Impact

## Purpose

Record the durable change from unsupported/generic Ruby handling to explicit
resource-backed Ruby/Rails discovery and validation planning.

## Durable Source Mapping

| Source | Current behavior relied on | Confidence | Notes |
|--------|----------------------------|------------|-------|
| `docs/design/language-adapter-design.md` | Ruby is planned as resource-backed before partial-semantic promotion. | high | Requires delivered-state update. |
| `docs/reference/language-capability-matrix.md` | Ruby is priority 11 and Rails is mentioned as later discovery. | high | User dogfood decision proposes priority change, still pending T007/T008 promotion evidence. |
| `docs/backlog/README.md` | EB010 owns fixture-gated ecosystem promotion. | high | Spec 047 becomes the focused delivery package. |
| `docs/reference/runtime-contracts.md` | Existing evidence and capability vocabulary. | high | Expected to remain structurally unchanged. |
| `docs/reference/workspace-safety-contract.md` | Shared path classification and cross-surface redaction routing is the safety authority for workspace-sensitive evidence. | medium | Route and shared-policy evidence must be reflected in this contract after Rails policy decisions. |

## Change Type

- **Primary type:** feature
- **Breaking change:** no
- **Durable docs required:** yes
- **External behavior affected:** yes, additive repository evidence

## Proposed Changes

| Change | Type | Source of truth | New durable destination | Promotion required |
|--------|------|-----------------|-------------------------|-------------------|
| Classify Ruby as resource-backed | add (pending) | implementation and tests | `docs/design/language-adapter-design.md`; `docs/reference/language-capability-matrix.md` | pending |
| Discover Rails project shape in proposed `src/application/use-cases/rails-project-shape.ts` | add (pending) | implementation and fixtures | `docs/design/language-adapter-design.md` | pending |
| Plan Rails validation commands | add (pending) | implementation and tests | `docs/design/language-adapter-design.md`; `docs/reference/runtime-contracts.md` if generic clarification is needed | pending |
| Raise Ruby/Rails priority | modify (proposed) | user decision plus EB010 criteria (T007/T008 pending) | `docs/reference/language-capability-matrix.md`; `docs/backlog/README.md` | pending |
| Expand shared path policy for Rails credentials | modify (pending) | implementation and fixtures | `docs/reference/workspace-safety-contract.md`; `docs/design/language-adapter-design.md` | pending |
| Nearest-root command ranking and tie-break rules | add (pending) | implementation and tests | `docs/design/language-adapter-design.md` | pending |

## Promotion Targets

| Spec content | Durable destination | Promotion status | Notes |
|--------------|---------------------|------------------|-------|
| Delivered adapter capability and limits | `docs/design/language-adapter-design.md` | pending | Record resource-backed truth only after T007/T008 evidence. |
| Priority and capability row | `docs/reference/language-capability-matrix.md` | pending | Reconcile other delivered adapters at the same time if needed; not current behavior. |
| EB010 delivery/follow-up route | `docs/backlog/README.md` | pending | Keep semantic work owned by Spec 048 and pending T007/T008 promotion evidence. |
| Dogfood result | `docs/reference/dogfood-evidence-ledger.md` | pending | Distilled evidence only. |
| Shared path-policy routing updates | `docs/reference/workspace-safety-contract.md` | pending | Add Rails credential, generated/vendor, and safe env exception cross-surface behavior. |

## Unchanged Durable Areas

| Durable area | Reviewed source | Reason unchanged |
|--------------|-----------------|------------------|
| Runtime architecture | `docs/design/layered-runtime-architecture.md` | Uses existing ports and layer boundaries. |
| Primary parser policy | `docs/design/language-adapter-design.md` | Tree-sitter remains mandatory for later parser support. |
| Workspace safety | `docs/reference/workspace-safety-contract.md` | Durable contract update is pending the shared Rails-credential classifier change and verification. |

## Open Questions

No product decision blocks authoring. A graph-schema change, if implementation
proposes one, requires architecture review before T004.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
