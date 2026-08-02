---
title: Production documentation corpus and owner-priority research
doc_type: spec
artifact_type: research
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Research

## Scope

Cross-check the EB064 dogfood failure against current indexing, task-document
classification, ranking, storage, and compatibility paths. External web
research is unnecessary because this is a repository-specific policy defect.

## Questions

1. Where can one production-corpus decision govern both affected surfaces?
2. How should exact concern ownership interact with lexical relevance?
3. What version/migration evidence prevents old corpus or cursor state from
   being treated as current?

## Options Considered

| Option | Summary | Pros | Cons | Decision |
| --- | --- | --- | --- | --- |
| Query-time fixture filtering | Remove fixture paths only from search/classification output | Small localized edit | Search counts remain polluted; excluded content is already indexed; surfaces drift; violates EB064 | rejected |
| Global scanner exclusion | Add `tests/fixtures` to shared source path exclusions | Removes content early | Changes non-document source behavior and risks erasing fixture-root tests | rejected |
| Shared repo-relative documentation admission | Classify Markdown paths before snapshot document reads and before current-doc scoring | One rule, no content read, fixture-root behavior follows selected root | Requires new policy/version and coverage integration | selected |
| Preserve relevance-before-owner | Keep current tuple and boost legacy score | Minimal contract movement | Legacy score is not canonical order; does not guarantee owner precedence | rejected |
| Exact concern owner as strongest intent evidence | Classify valid matched owners before non-owner lexical bands, then authority/currency/ties | Matches documentation-map intent and explains order | Requires ranking-policy version advance | selected |
| Reuse ranking v1 after behavior change | Change comparator without versioning | No migration work | Existing cursors/universes falsely claim old identity | rejected |
| Advance ranking policy and invalidate transient universes | Use a new policy identity and explicit transient-state migration | Truthful compatibility boundary | Requires store migration/regressions | selected |

## Findings

- `index-repository-graph.ts` merges graph and priority docs scans and reads all
  admitted Markdown before `replaceSnapshotDocs`; this is the earliest shared
  snapshot-corpus admission point.
- `current-docs-for-task.ts` independently scans all Markdown and scores paths
  before reading/classifying content. It needs the same policy before scoring.
- The current ranker calculates lexical relevance bands before the existing
  `intent_owner_match` band. A body mention therefore outranks a matched owner
  even when authority metadata is correct.
- Frozen ranked-universe identity includes `ranking_policy_version`, and the
  SQLite table constrains the accepted value. A behavior change requires a
  coordinated contract/store migration rather than silently retaining v1.
- Corpus isolation changes the meaning of snapshot docs evidence. A persisted
  corpus-policy identity is needed so a compatible older snapshot cannot be
  reported as current-policy success after an upgrade.
- An exact concern may map to a policy-excluded document. Treating that owner as
  ordinary `missing` would erase the known exclusion cause, while admitting it
  would leak the excluded corpus back into ranking. An additive `excluded`
  owner state with stable reason and no document identity is the truthful path.
- Repo-relative classification naturally preserves fixture-root tests: when
  the fixture becomes the root, its own `README.md` and `docs/**` no longer sit
  below an embedded fixture prefix.

## Tradeoffs

Corpus versioning adds a small persisted compatibility field and refresh gate,
but prevents silent use of polluted snapshots. Owner-first exact intent can
place a mapped owner ahead of lexically stronger content; that is deliberate
only after exact concern resolution and does not affect unmatched queries.

## Sources

- `docs/backlog/README.md` EB064 and Immediate Next Specs
- `docs/reference/dogfood-evidence-ledger.md` installed-runtime reproduction
- `src/application/use-cases/index-repository-graph.ts`
- `src/application/use-cases/current-docs-for-task.ts`
- `src/domain/policies/docs-ranking.ts`
- `src/application/use-cases/query-docs.ts`
- `src/infrastructure/sqlite/graph-store.ts`
- `src/contracts/runtime-docs-contracts.ts`

## Confidence And Unknowns

- **Confidence:** high
- **Known unknowns:** exact additive field/table shape should be confirmed
  during T002 against the current schema migration pattern
- **Assumptions:** documentation fixture roots are represented by stable
  repo-relative structural segments, with `tests/fixtures/**` as the required
  first contract
- **Evidence gaps:** no post-implementation installed-runtime rerun yet

## Recommendation

Implement one pure domain corpus classifier returning eligible or excluded with
a stable `embedded_fixture` reason. Use it before snapshot document reads and
before `docs_current_for_task` scoring. Persist a corpus-policy version, block
stale-policy search, advance ranked-universe policy identity, and explicitly
clear incompatible transient universes. Add an explicit excluded-owner state
and a public governing-owner priority component so exact intent ordering is
fully inspectable rather than hidden in comparator logic.

## Decision Impact

The recommendation defines Requirements 1-5, the component boundaries in
`design.md`, the migration task, and the required production/fixture-root and
SessionStart regressions. No open owner decision blocks implementation.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Open Decisions: none
