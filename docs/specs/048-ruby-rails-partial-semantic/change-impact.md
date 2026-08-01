---
title: Ruby and Rails partial-semantic change impact
doc_type: spec
artifact_type: change-impact
status: draft
owner: platform
last_reviewed: 2026-08-01
---

# Change Impact

## Purpose

Record the promotion from resource-backed Ruby/Rails routing to calibrated
parser-backed partial-semantic evidence.

## Durable Source Mapping

| Source | Current behavior relied on | Confidence | Notes |
|--------|----------------------------|------------|-------|
| `docs/specs/047-ruby-rails-resource-discovery/` | Delivered Ruby identity, Rails shape, fixtures, and validation planning. | dependency | Must be reconciled before implementation. |
| `docs/design/language-adapter-design.md` | Parser architecture, current language support, promotion gates. | high | Requires delivered-state update. |
| `docs/reference/runtime-contracts.md` | Capability, graph, coverage, trust, and failure vocabulary. | high | Generic coverage clarification may be required. |
| `docs/backlog/README.md` | EB010 language promotion and EB061 parser-route disclosure. | high | This spec delivers the Ruby slice and may partly deliver EB061. |

## Change Type

- **Primary type:** feature
- **Breaking change:** no
- **Durable docs required:** yes
- **External behavior affected:** yes, additive parser-backed evidence

## Proposed Changes

| Change | Type | Source of truth | New durable destination | Promotion required |
|--------|------|-----------------|-------------------------|-------------------|
| Add tree-sitter Ruby extraction | add | implementation/tests | language adapter design and matrix | yes |
| Add Ruby reference/impact evidence | add | implementation/tests | adapter design and runtime contracts | yes |
| Add bounded Rails DSL evidence | add | fixtures/implementation | adapter design | yes |
| Add parser-route coverage disclosure | modify | generic contracts/tests | runtime contracts and MCP design | yes if public shape changes |

## Promotion Targets

| Spec content | Durable destination | Promotion status | Notes |
|--------------|---------------------|------------------|-------|
| Supported Ruby forms and limits | `docs/design/language-adapter-design.md` | pending | Current behavior only after verification. |
| Ruby capability state | `docs/reference/language-capability-matrix.md` | pending | Do not mark semantic. |
| Generic coverage semantics | `docs/reference/runtime-contracts.md`, `docs/design/mcp-surface-design.md` | pending if changed | Align all parser-backed adapters. |
| Graph resolution behavior | `docs/design/graph-store-design.md` | pending if changed | No Ruby-only store contract. |
| EB010/EB061 disposition | `docs/backlog/README.md` | pending | Route deeper dynamic behavior. |

## Unchanged Durable Areas

| Durable area | Reviewed source | Reason unchanged |
|--------------|-----------------|------------------|
| Layering | `docs/design/layered-runtime-architecture.md` | Adapter remains behind existing ports. |
| Workspace safety | `docs/reference/workspace-safety-contract.md` | Existing containment and redaction apply. |
| Runtime execution | runtime contracts and adapter design | Extraction remains read-only and non-executing. |

## Open Questions

No product decision blocks authoring. The exact generic coverage-contract delta
and Rails DSL form list require implementation-stage architecture review.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
