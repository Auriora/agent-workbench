---
title: First-read reliability and bounded tools change impact
doc_type: spec
artifact_type: change-impact
status: draft
owner: platform
last_reviewed: 2026-07-10
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Change Impact

## Purpose

Spec 037 changes existing first-read runtime behavior and must promote accepted
contract, operation, MCP surface, graph, and backlog semantics into durable
docs before closure.

## Durable Source Mapping

| Source | Current behavior relied on | Confidence | Notes |
|--------|----------------------------|------------|-------|
| `docs/backlog/README.md` | EB003 defines the P0 first-read reliability backlog item. | high | Update status and residual routing. |
| `docs/reference/runtime-contracts.md` | Owns runtime envelope, freshness, evidence, validation, and trust vocabulary. | high | Update if accepted behavior changes contracts or metadata. |
| `docs/design/runtime-operations-design.md` | Owns cache, warmup, queue, stale/fresh state, and runtime operations behavior. | high | Update for accepted first-read bounded behavior. |
| `docs/design/mcp-surface-design.md` | Owns public resources/tools and presenter behavior. | high | Update for resource/tool response expectations. |
| `docs/design/graph-store-design.md` | Owns graph freshness, query budgets, FTS, and skipped evidence. | high | Update for accepted graph/docs evidence behavior. |
| `docs/reference/documentation-map.md` | Owns source-of-truth routing. | high | Update only if durable ownership changes. |

## Change Type

- **Primary type:** operational
- **Breaking change:** no
- **Durable docs required:** yes
- **External behavior affected:** yes, MCP/resource response metadata and
  caveats may become more explicit.

## Proposed Changes

| Change | Type | Source of truth | New durable destination | Promotion required |
|--------|------|-----------------|-------------------------|-------------------|
| Promote EB003 to active Spec 037 | modify | `docs/backlog/README.md` | `docs/backlog/README.md` | yes |
| Clarify first-read validity, stale, degraded, and blocked behavior | clarify | `docs/reference/runtime-contracts.md` | `docs/reference/runtime-contracts.md` | yes |
| Clarify bounded hidden work, refresh, queue, and stale evidence behavior | clarify | `docs/design/runtime-operations-design.md` | `docs/design/runtime-operations-design.md` | yes |
| Clarify MCP resource/tool response caveats and safe-use boundaries | clarify | `docs/design/mcp-surface-design.md` | `docs/design/mcp-surface-design.md` | yes |
| Clarify graph/docs skipped-evidence and query-budget behavior | clarify | `docs/design/graph-store-design.md` | `docs/design/graph-store-design.md` | yes |
| Add closure/history record | add | `docs/history/spec-closure-log.md`, `docs/history/spec-archive-index.md` | same | closure-only |

## Promotion Targets

| Spec content | Durable destination | Promotion status | Notes |
|--------------|---------------------|------------------|-------|
| First-read contract semantics | `docs/reference/runtime-contracts.md` | complete | Existing metadata fields and trust boundaries promoted. |
| Runtime operation and warmup behavior | `docs/design/runtime-operations-design.md` | complete | Hidden work, refresh, queue, and unavailable-state behavior promoted. |
| MCP resource/tool behavior | `docs/design/mcp-surface-design.md` | complete | Response trust/caveat expectations promoted. |
| Graph/docs budgets and skipped evidence | `docs/design/graph-store-design.md` | complete | Bounded skipped-work and coverage behavior promoted. |
| Backlog status and residual routing | `docs/backlog/README.md` | complete | EB003 status now points to Spec 037 delivery and residual EB014/EB009 routing. |
| Closure history | `docs/history/spec-closure-log.md`, `docs/history/spec-archive-index.md` | pending | Closure-only after accepted behavior is promoted. |

## Unchanged Durable Areas

| Durable area | Reviewed source | Reason unchanged |
|--------------|-----------------|------------------|
| workspace safety | `docs/reference/workspace-safety-contract.md` | First-read reliability must preserve existing path/secret/generated policy. Update only if implementation changes safety semantics. |
| threat model | `docs/security/threat-model.md` | No new trust boundary is intended. Update only if implementation changes security posture. |
| language adapter priority | `docs/reference/language-capability-matrix.md` | No language promotion is intended. Unsupported language handling remains evidence/caveat behavior. |

## Bug Fix Details

- **Observed behavior:** First-read outputs can be ambiguous when evidence is
  stale, provider-limited, skipped, truncated, refreshing, or blocked.
- **Expected behavior:** Outputs identify valid, stale, degraded, or blocked
  state and name missing/skipped evidence and unsafe claims.
- **Root cause evidence:** EB003 backlog signal plus repeated dogfood findings
  around timeouts, resource freshness, skipped evidence, and first-call trust.
- **Regression risk:** More explicit caveats may change golden outputs and
  agent behavior; mitigate with fixture-backed tests and additive contracts.
- **Durable doc update needed:** yes.

## Open Questions

- Does status vocabulary need a versioned migration under EB024?
- Which first-read surface should be the first implementation slice?

## Related Artifacts

- Requirements: `requirements.md`
- Canonical Context: `canonical-context.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
- Open Decisions: `open-decisions.md`
