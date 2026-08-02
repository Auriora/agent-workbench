---
title: Validation-plan skipped-path payload compaction research
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

Determine where compaction must occur, whether current scanner evidence can
support exact counts, how to preserve public compatibility, and which existing
task-context behavior should be shared. Validation-command ranking, scanner
traversal completion, and unrelated public surfaces are out of scope.

## Question

How can `verification_plan` replace path-heavy routine skip output with exact,
bounded evidence without turning a presentation sample into an extraction limit
or hiding actionable exclusions?

## Options Considered

| Option | Summary | Pros | Cons | Notes |
| --- | --- | --- | --- | --- |
| A | Slice the existing raw list more aggressively | smallest patch | loses more evidence; counts remain false beyond scanner raw cap | rejected |
| B | Group the raw list only inside the verification presenter | compact public payload | presenter invents semantics; scanner cap remains hidden; context drifts | rejected |
| C | Group independently in plan and context use cases | avoids presenter logic | duplicate policies and inconsistent samples/counts | rejected |
| D | Add scanner population receipt plus one shared summarizer, then project it into plan/context | exact invocation counts, one policy, bounded output, no traversal change | touches scanner port and test doubles | accepted |
| E | Remove all scanner and public bounds | simplest notion of completeness | unbounded memory/payload; expands beyond EB065 | rejected |
| F | Replace raw field shape under contract `0.1` | one compact field name | breaking strict-schema change | rejected |
| G | Add optional structured field, stop current raw emission, retain legacy input parsing | additive contract and one current emitter | old consumers may ignore the new evidence | accepted |

## Findings

- `plan-verification.ts` copies the first 50 retained scanner skip records; the
  response exposes neither grouped counts nor presentation truncation.
- `get-task-context.ts` groups by reason but keeps one sample and slices to five
  reasons, so it is a useful presentation precedent but not an exact shared
  contract.
- `file-catalog-scanner.ts` deduplicates by `reason:path` but stops retaining
  raw records after `MAX_SKIPPED_PATHS = 100`. A planner cannot derive exact
  counts beyond that point from `skipped_paths` alone.
- The scanner processes priority paths before repository traversal. Moving
  validation-plan selected-path normalization before the scan and passing safe
  selected paths as `priority_paths` preserves actionable skip evidence without
  an alternate filesystem route.
- Contract `0.1` permits optional additive fields and forbids changing an
  existing field's shape without a new contract version.
- The reason vocabulary is finite. Three sorted paths per encountered reason is
  a bounded public sample while all observed unique classifications remain
  counted.
- Presenters already own redaction and strict schema parsing; grouping there
  would violate their thin-boundary role.

## Tradeoffs

The accepted path retains an invocation-scoped deduplication set after the raw
sample fills. This uses memory proportional to unique skipped classifications,
but the same scanner invocation already holds a bounded file catalog and this
change adds no new traversal or extraction bound. It is preferable to false
exact counts or silently discarded classification evidence.

An additive optional public field avoids a contract-version migration, but an
older consumer may ignore the compacted evidence when raw output ends. The
response remains schema-compatible because the old field was optional; durable
docs and the changelog must call out the new preferred receipt.

## Sources

- `docs/backlog/README.md` EB004 and EB065
- `docs/design/mcp-surface-design.md`
- `docs/reference/runtime-contracts.md`
- `src/infrastructure/filesystem/file-catalog-scanner.ts`
- `src/application/use-cases/plan-verification.ts`
- `src/application/use-cases/get-task-context.ts`
- `src/contracts/runtime-core-contracts.ts`
- `src/contracts/runtime-validation-edit-contracts.ts`
- `src/presentation/verification-plan-presenter.ts`
- scanner, contract, verification-plan, context, presenter, and stdio tests
- 2026-08-02 read-only source-seam review

## Confidence And Unknowns

- **Confidence:** high
- **Known unknowns:** exact fixture reuse versus a new generated/vendor-heavy
  fixture is deferred to T002/T007 implementation planning.
- **Assumptions:** the existing optional-field compatibility rule applies to
  omission of current raw validation-plan evidence plus addition of the new
  structured receipt.
- **Evidence gaps:** no implementation, payload-size measurement, or installed
  runtime dogfood exists yet.

## Recommendation

Implement Option D with Option G: scanner-owned exact population accounting,
one shared three-path-per-reason summary policy, additive structured plan
receipt, task-context parity projection, requested-path priority preservation,
and no current raw validation-plan emission.

## Decision Impact

- Requirements now demand exact accounting beyond the raw scanner retention
  bound and explicitly prohibit presentation-driven extraction limits.
- Design adds a required internal population receipt and distinguishes scanner
  truncation from sample truncation.
- Tasks begin with contract/scanner review and failing population tests before
  integrating plan/context output.
- Verification includes over-100 raw-bound coverage, generated permutations,
  all five validation gates, redaction, and dogfood identity.
- No open decision blocks implementation; departures require reconciliation.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Open Decisions: none; decisions are recorded in `design.md`
