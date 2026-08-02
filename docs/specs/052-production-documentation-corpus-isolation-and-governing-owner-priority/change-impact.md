---
title: Production documentation corpus and ranking change impact
doc_type: spec
artifact_type: change-impact
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Change Impact

## Purpose

Record the behavior, contract, storage, migration, tests, and durable-document
owners affected by Spec 052.

## Durable Source Mapping

| Source | Current behavior relied on | Confidence | Notes |
| --- | --- | --- | --- |
| `docs/reference/documentation-map.md` | exact concern and canonical owner mapping | high | SessionStart maps to coding-agent integration design. |
| `docs/design/mcp-surface-design.md` | FTS-plus-owner candidate union and ranking tuple | high | Current relevance precedes owner. |
| `docs/design/graph-store-design.md` | indexed docs corpus, coverage, frozen universe identity | high | Requires version/migration update. |
| `docs/reference/runtime-contracts.md` | policy version, ranking components, counts, failure trust | high | Public compatibility owner. |
| `docs/requirements/runtime-requirements.md` | accepted target behavior | high | Add corpus-isolation requirement. |
| `docs/reference/mvp-proof-matrix.md` | required fixture and installed acceptance proof | high | Add both root-shape proofs. |

## Change Type

- **Primary type:** bug_fix
- **Breaking change:** no schema-level client break; ranking order and policy
  identity intentionally change
- **Durable docs required:** yes
- **External behavior affected:** yes, documentation search/classification order,
  corpus membership, counts, and refresh blocking

## Proposed Changes

| Change | Type | Source of truth | New durable destination | Promotion required |
| --- | --- | --- | --- | --- |
| Shared repo-relative documentation corpus policy | add | Spec 052 | documentation map and MCP surface design | yes |
| Snapshot corpus-policy identity and exclusion coverage | add | Spec 052 | graph-store design and runtime contracts | yes |
| Exact matched-owner priority | modify | MCP surface design | MCP surface design and runtime contracts | yes |
| Ranked-universe policy migration | modify | graph-store design | graph-store design and runtime contracts | yes |
| Production/fixture-root acceptance evidence | add | verification | MVP proof matrix and dogfood ledger | yes |
| EB064 delivery status | modify | backlog | backlog | yes |

## Promotion Targets

| Spec content | Durable destination | Promotion status | Notes |
| --- | --- | --- | --- |
| eligibility and owner mapping rules | `docs/reference/documentation-map.md` | pending | Add policy ownership without duplicating schemas. |
| public routing behavior | `docs/design/mcp-surface-design.md` | pending | Corpus, order, counts, blocking. |
| persistence and migration | `docs/design/graph-store-design.md` | pending | Corpus and ranking policy identity. |
| public contract shapes | `docs/reference/runtime-contracts.md` | pending | Canonical enums/fields/version. |
| accepted target requirement | `docs/requirements/runtime-requirements.md` | pending | Behavioral summary. |
| validation gates | `docs/reference/mvp-proof-matrix.md` | pending | Root shapes, SessionStart, migration. |
| delivery and residual work | `docs/backlog/README.md` | pending | Close EB064; retain EB059/EB065. |
| dated acceptance | `docs/reference/dogfood-evidence-ledger.md` | pending | Record installed or local runtime evidence truthfully. |
| agent-visible behavior | `docs/reference/agent-readable-changelog.md` | pending | Corpus/order/version change. |

## Unchanged Durable Areas

| Durable area | Reviewed source | Reason unchanged |
| --- | --- | --- |
| language adapters | `docs/design/language-adapter-design.md` | Corpus ranking is ecosystem-independent. |
| general workspace safety | `docs/reference/workspace-safety-contract.md` | No read/write/secret policy change. |
| ranked-universe capacity | `docs/backlog/README.md` EB059 | Explicitly excluded. |
| validation-plan presentation | `docs/backlog/README.md` EB065 | Explicitly excluded. |

## Bug Fix Details

- **Observed behavior:** embedded fixture docs appear in production canonical
  results, and supporting mentions outrank the exact concern owner.
- **Expected behavior:** production corpus excludes embedded fixtures; exact
  governing owner is first; counts and policy identity remain truthful.
- **Root cause evidence:** independent corpus selection and relevance-before-owner
  ranking in current application policies.
- **Regression risk:** fixture-root tests could disappear, old cursors could be
  misinterpreted, or counts could mix pre/post-policy universes.
- **Durable doc update needed:** yes, all promotion targets above.

## Open Questions

No owner decision currently blocks implementation. T002 must confirm the
smallest schema migration that persists corpus-policy identity without widening
EB059 scope.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
