---
title: Large-repository graph completion change impact
doc_type: spec
artifact_type: change-impact
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Change Impact

## Durable Source Mapping

| Current authority | Relied-on contract |
| --- | --- |
| `docs/reference/runtime-contracts.md` | Coverage and trust signal semantics in graph responses. |
| `docs/design/mcp-surface-design.md` | Query response presentation and query-envelope trust behavior. |
| `docs/reference/language-capability-matrix.md` | Completion semantics are runtime-surface behavior and should remain explicit as partial/complete. |
| `docs/backlog/README.md` EB014 | Ownership and residual behavior for graph completion work. |

## Proposed Changes

### Design to implementation matrix

| Design section | Implementation owner | Scope evidence |
| --- | --- | --- |
| Coverage truth model | `src/application/use-cases/index-repository-graph.ts` | Run-state counters and completion decision logic. |
| Deterministic priority seeding | `src/application/use-cases/index-repository-graph.ts` | Admission sort and scanner order rewrite. |
| Continuation lifecycle | Graph run persistence module | Owner/generation/cancel-aware resume flow. |
| Atomic publication | Graph storage commit path | Isolated building snapshot swap at completion boundary. |
| Trust propagation | Query response and cache write path | Partial/complete metadata in responses and caches. |
| Debug sweep parity | `src/debug/mcp-tool-sweep.ts` | Same bounded + continuation flow as production. |

## Runtime delta

| Area | Proposed change |
| --- | --- |
| Extraction lifecycle | Report completion from scan + admission + extraction counters, not scan count alone. |
| Priority ordering | Reorder scanner admission with deterministic priority seeding. |
| Continuation model | Add durable continuation with owner/generation/cancel/restart/stale semantics. |
| Publication model | Build on isolated completion snapshot and publish atomically only at completion boundary. |
| Query surfaces | Propagate partial/complete coverage trust metadata and continuation hints. |
| Debug sweep | Remove debug-only hardcoded extraction bound; route through continuation-capable flow. |

## Test delta

| Area | Evidence target | Validation class |
| --- | --- | --- |
| Unit/integration | `index-repository-graph` run state and counters | bounded lifecycle coverage tests |
| Regression | priority-path ordering + scan/admit/extract truth | parser-admission extraction regressions |
| Integration | continuation with cancel/restart/stale | workflow resilience tests |
| End-to-end | partial-to-complete resume in repo-scale fixtures and `gerald`-style traces | multi-slice replay tests |

## Documentation delta

Durable docs updates to be made only after verification and MoE closure:

- `docs/reference/runtime-contracts.md` completion/trust semantics additions
- `docs/reference/dogfood-evidence-ledger.md` bounded run evidence and limits
- `docs/backlog/README.md` EB014 completion status and residuals

## Risks

- Incorrectly merging completion semantics in both production and debug paths can still
  hide bounded states.
- Continuation races without generation/owner checks can produce duplicated or
  skipped admission.
- Overstating query trust in partial mode can create incorrect downstream behavior.

## Open Decision Impact

- No open blocking decision is expected if continuation governance is persisted in the same
  boundary as existing graph run state; unresolved decisions here become explicit residuals
  for EB014 and must remain visible to implementers.
- If continuation replay needs a dedicated debug namespace, that design choice must be
  recorded in durable backlog notes before promotion.

## Promotion Targets

| Artifact | Promotion condition | Evidence requirement |
| --- | --- | --- |
| `docs/reference/runtime-contracts.md` | Update completion/trust semantics after atomic completion and partial-seed behavior is implemented. | Requirement 1, 4, 5 evidence and final publish behavior |
| `docs/design/mcp-surface-design.md` | Update MCP presentation expectations for partial/complete states and continuation metadata. | Requirement 4, Requirement 5 evidence |
| `docs/reference/dogfood-evidence-ledger.md` | Record bounded run evidence for partial seed usability and completion replacement. | Requirement 7 and implementation evidence |
