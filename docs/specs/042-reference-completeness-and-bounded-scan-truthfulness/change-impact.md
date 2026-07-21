---
title: Reference completeness change impact
doc_type: spec
artifact_type: change-impact
status: draft
owner: platform
last_reviewed: 2026-07-20
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Change Impact

## Summary

This bug fix changes how `find_references` represents bounded lexical work. It
does not strengthen lexical evidence into semantic proof; it makes incomplete
candidate inspection explicit and continuable.

## Durable Source Mapping

| Current authority | Change responsibility |
| --- | --- |
| MCP surface design | define complete/partial reference results and continuation |
| runtime contracts | define coverage and count semantics |
| graph store design | document ordered catalog pagination for lexical routing |
| language adapter design | separate lexical occurrences from semantic references |
| MVP proof matrix | record bounded completeness and continuation proof |
| EB053 and dogfood ledger | preserve reproduction and outcome |

## Change Type

- **Primary type:** bug_fix
- **Breaking change:** additive contract fields; cursor compatibility requires
  explicit version handling
- **Durable docs required:** yes
- **External behavior affected:** yes, reference result completeness and cursor
  presentation

## Proposed Changes

| Change | Type | Source of truth | New durable destination | Promotion required |
| --- | --- | --- | --- | --- |
| evidence-source completeness invariant | clarify | EB053 and Spec 042 | MCP surface design | yes |
| paginated lexical continuation | modify | application and catalog contracts | graph store design | yes |
| count/coverage/trust fields | modify | runtime graph/response contracts | runtime contracts | yes |
| SessionStart regression | add | fixture-backed tests | backlog closure evidence | yes |
| failed searchable candidate truth | add | snapshot/catalog/workspace contracts | runtime contracts and MCP surface design | yes |
| parser-route limit truth | clarify | graph query contracts | MCP surface design | yes |
| real provider installed smoke | add | provider plugin installers and CI smoke | plugin runbook and MVP proof matrix | yes |

## Promotion Targets

| Intended behavior | Durable owner | Closure evidence |
| --- | --- | --- |
| completeness and callable continuation | `docs/design/mcp-surface-design.md` | contract and MCP tests |
| counts, coverage, stop reasons, and trust | `docs/reference/runtime-contracts.md` | contract and golden tests |
| ordered catalog pagination | `docs/design/graph-store-design.md` | pagination and budget tests |
| lexical occurrence semantics | `docs/design/language-adapter-design.md` | JS/TS occurrence fixture |
| product proof boundary | `docs/reference/mvp-proof-matrix.md` | complete and partial SessionStart proof |
| real provider installation proof | plugin runbook and `docs/reference/mvp-proof-matrix.md` | isolated real Codex and Claude CLI smokes |
| delivered outcome | EB053 and agent-readable changelog | validation and installed smoke |

## Bug Fix Details

- **Observed behavior:** Nine lexical hits were presented without truncation
  while three later TypeScript test references were uninspected.
- **Expected behavior:** Exhaust the selected evidence universe or return a
  truthful partial page and callable continuation.
- **Root cause evidence:** The lexical route reads one bounded ordered catalog
  window and derives `hasMore` only from hits already collected.
- **Regression risk:** Cursor drift, duplicate hits across pages, excess reads,
  false complete trust, stale snapshot replay, policy exclusions being confused
  with failed searchable candidates, and package smoke being overclaimed as a
  real Codex or Claude plugin load.
- **Durable doc update needed:** yes.

## Unchanged Durable Areas

| Durable area | Reviewed source | Reason unchanged |
| --- | --- | --- |
| daemon refresh ownership | runtime operations design | Spec 041 convergence remains accepted. |
| parser implementation | language adapter design | No new parser or semantic route is authorized. |
| workspace safety | workspace safety contract | Existing path policy remains authoritative. |

## Implementation Boundaries Fixed By Review

- The current whole-file workspace port makes files atomic byte/time scan
  units. The scanner prechecks declared size and admits no file after the time
  deadline; it does not invent line/column scan progress.
- A result cursor may page occurrences from a completed file and replay its
  whole-file read with exact accounting, but only a path cursor advances scan
  progress.
- Searchable oversized, unreadable, missing, or changed indexed files prevent
  valid absence. Explicit unsupported/generated/vendor/secret/configured/unsafe
  policy exclusions are outside the declared universe and remain summarized.
- Incoming, outgoing, and unresolved parser routes each prove their own
  exhaustion at zero, exact limit, limit-plus-one, and multi-page boundaries.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
- Review disposition: `review-disposition.md`
