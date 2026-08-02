---
title: Validation-plan skipped-path payload compaction design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Technical Design

## Overview

Add one shared skipped-path population summarizer at the scanner/application
boundary. The scanner continues classifying after its bounded raw compatibility
sample fills and publishes exact reason counts plus deterministic samples for
the completed invocation. `verification_plan` projects that receipt into a new
optional structured `skipped_path_summary`; `context_for_task` renders its
existing `skipped_work` text from the same groups. Validation planning stops
emitting its legacy raw `skipped_paths` list, while other raw-path surfaces stay
unchanged.

The fixed representative-path limit is three per reason. The stable skip-reason
vocabulary currently has eleven values, so the routine public sample is bounded
by the vocabulary rather than skipped-path population. This is a presentation
bound only. It never stops traversal, classification, deduplication, counting,
or validation-command discovery.

## Requirement Coverage

| Requirement | Acceptance Criteria | Design Coverage | Validation Approach |
| --- | --- | --- | --- |
| Requirement 1 | AC1-AC6 | scanner population receipt and structured groups | accumulator, scanner, contract, and MCP tests |
| Requirement 2 | AC1-AC5 | fixed sample limit 3; normalized sort/dedup; redaction | permutation and presenter tests |
| Requirement 3 | AC1-AC5 | aggregate accounting continues beyond raw sample; scanner truncation stays distinct | over-100 skip fixture and scan-truncation tests |
| Requirement 4 | AC1-AC5 | requested paths are priority-classified and retained individually; blockers unchanged | requested exclusion and blocker regressions |
| Requirement 5 | AC1-AC5 | one shared summarizer; additive receipt; no verification raw output | contract, task-context parity, translation tests |
| Requirement 6 | AC1-AC5 | generated/vendor-heavy fixture, full validation, durable promotion | focused/full suite and lifecycle evidence |

## Correctness Property Coverage

| Property | Design Behavior | Validation Direction | Notes |
| --- | --- | --- | --- |
| CP-001 | accumulator deduplicates `reason:path`, counts every unique observation, and conserves group totals | table tests plus more than 100 classified skips | raw compatibility sample may be smaller |
| CP-002 | group count is compared with returned sample length | boundary tests at 0, 1, 3, and 4 paths | sample limit is contract-owned |
| CP-003 | reason and normalized path ordering occur at finalization | generated input permutations | no filesystem-order dependence |
| CP-004 | summarization consumes classification events and does not affect scan or command planner control flow | scanner spy and five-gate regression | no early exit or retry |
| CP-005 | actionable paths are selected from already-counted priority skip records | intersection/conservation tests | individual evidence is a second projection, not a second count |
| CP-006 | `source_truncated` mirrors the upstream scan and differs from `sample_truncated` | complete and truncated scanner doubles | no repository-completeness overclaim |

## High-Level Design

### System Architecture

```text
path policy / filesystem failure
              |
              v
scanner skip recorder -----> bounded raw compatibility records
              |
              +-----------> exact population accumulator
                                  |
                         FileCatalogScanResult
                           /             \
                          v               v
              verification_plan     context_for_task
              structured receipt    existing prose projection
```

The scanner owns observation and population truth. The application layer owns
which scanner evidence is actionable for a request. Presenters own redaction
and schema validation only; they do not regroup or invent counts.

### Components and Changes

- `src/domain/policies/skipped-path-summary.ts`
  - Add the pure accumulator/finalizer for normalized reason/path observations.
  - Export `SKIPPED_PATH_SAMPLE_LIMIT = 3` and deterministic comparison logic.
  - Accept structural skip records so the domain policy does not depend on a
    filesystem adapter or MCP presenter.
- `src/infrastructure/filesystem/file-catalog-scanner.ts`
  - Feed every unique skip classification to the accumulator.
  - Continue retaining the existing bounded raw `skipped_paths` compatibility
    evidence for surfaces outside this spec.
  - Return a required zero-or-more population receipt even after the raw sample
    reaches `MAX_SKIPPED_PATHS`.
- `src/ports/index.ts`
  - Extend `FileCatalogScanResult` with the required internal population receipt.
  - Keep `skipped_paths` during this slice for existing scope/overview consumers.
  - Update every production producer and test double of `FileCatalogScanResult`
    in the same migration; the required receipt is not introduced through an
    optional compatibility seam.
- `src/contracts/runtime-core-contracts.ts`
  - Add reusable strict schemas/types for a reason group and skipped-path
    population summary using the existing `SkippedPathReason` vocabulary.
- `src/contracts/runtime-validation-edit-contracts.ts`
  - Add optional `skipped_path_summary` to `VerificationPlan`.
  - Retain legacy raw `skipped_paths` only as deprecated compatibility input;
    current `verification_plan` output no longer emits it.
- `src/application/use-cases/plan-verification.ts`
  - Normalize selected paths before scanning and pass safe selected paths as
    scanner priority paths, preserving individually actionable exclusions.
  - Build the public structured receipt from the scanner population plus the
    intersection of retained priority skip evidence and requested/changed paths.
  - Preserve command discovery, blocker construction, status, and next actions.
- `src/application/use-cases/get-task-context.ts`
  - Remove local count/sample grouping.
  - Render `skipped_work` from the shared finalized reason groups without the
    current five-reason loss.
- `src/presentation/verification-plan-presenter.ts`
  - Validate and redact summary samples/actionable records.
  - Do not accept raw records as a fallback source for rebuilding a summary.

### Data Models

Internal scanner result, expressed structurally:

```ts
type SkippedPathPopulation = {
  total_count: number;
  groups: readonly {
    reason: SkippedPathReason;
    count: number;
    sample_paths: readonly string[];
    sample_truncated: boolean;
  }[];
};
```

Public validation-plan receipt:

```ts
type ValidationSkippedPathSummary = SkippedPathPopulation & {
  count_basis: "scanner_observed_unique_reason_path";
  source_truncated: boolean;
  actionable_paths: readonly SkippedPath[];
};

type VerificationPlan = {
  // existing fields
  skipped_path_summary?: ValidationSkippedPathSummary;
  /** Deprecated compatibility input; not emitted by the current planner. */
  skipped_paths?: readonly SkippedPath[];
};
```

`total_count` and every group count describe unique normalized `reason:path`
observations from this scanner invocation. They are repository-complete only
when the existing upstream scan receipt is not truncated. `actionable_paths`
are already members of groups and never alter counts. They contain every
actionable exclusion when the existing supported request scope is at most 50
selected paths. For an already-blocked request above that threshold, they retain
the first 50 normalized, lexically ordered actionable paths; this is public
detail compaction and does not limit scanner traversal or classification.

### Data Flow

1. `planVerification` normalizes requested and changed paths before scanning.
2. Safe selected paths are passed as `priority_paths`; unsafe paths retain the
   existing blocker and are not made safe by summarization.
3. For every skip classification, the scanner recorder normalizes the path and
   deduplicates by `reason:path`.
4. Every unique observation updates exact total/group counts and a deterministic
   top-three path sample. The independent raw compatibility list may stop at its
   existing bound, but the accumulator does not.
5. The scan returns files, raw compatibility evidence, the exact population
   receipt, existing `truncated`, and any continuation cursor.
6. Validation planning performs unchanged command discovery and risk handling,
   selects individually actionable priority skip records, and projects the
   structured receipt.
7. Task context formats the same group counts/samples into `skipped_work`.
8. Presenters redact paths/details, validate the strict schema, and return the
   existing response envelope.

## Low-Level Design

### Algorithms and Logic

```text
record(skip):
  path = canonical repository-relative normalization(skip.path)
  key = skip.reason + ":" + path
  if key already observed: return
  mark key observed
  increment total and reason count
  insert path into reason sample in lexical order
  retain only the first 3 sample paths
  if raw compatibility list has space: retain the full safe skip record

finalize(source_truncated, selected_paths):
  groups = every non-empty reason ordered by stable reason value
  sample_truncated = group.count > group.sample_paths.length
  actionable = retained priority records whose paths are selected
  assert sum(group.count) == total_count
  return summary or omit public summary when total_count == 0
```

The accumulator retains the deduplication key set for the invocation. Exact
unique counts therefore use `O(n)` memory in the number of distinct skip
classifications encountered by the scanner, independent of the three-path
public sample and 100-record compatibility list. This explicit tradeoff adds no
new population limit; implementation evidence must cover more than 100 unique
skips and record the large-fixture memory observation without turning it into a
scan, extraction, time, or caller-controlled budget.

### Function Signatures and Interfaces

The implementation may refine names, but it must retain these responsibilities:

```ts
export const SKIPPED_PATH_SAMPLE_LIMIT = 3;

export function createSkippedPathPopulationAccumulator(): {
  record(input: { path: string; reason: SkippedPathReason }): void;
  finalize(): SkippedPathPopulation;
};

export function presentValidationSkippedPathSummary(input: {
  population: SkippedPathPopulation;
  source_truncated: boolean;
  actionable_paths: readonly SkippedPath[];
}): ValidationSkippedPathSummary | undefined;
```

There is one accumulator and one finalized group order. Validation-plan and
task-context code may project different public shapes from that finalized data,
but may not recount or resample independently. Because the reason vocabulary is
finite, task context can render every encountered group without retaining its
current five-group slice or introducing an unbounded per-path payload.

### Error Handling

- Invalid or non-relative paths follow existing scanner/path-policy behavior;
  the summary does not repair them.
- Duplicate reason/path observations collapse deterministically.
- A group/total conservation failure is an internal contract defect and must
  fail validation rather than return adjusted or partial counts.
- Scanner failure retains the existing blocked MCP envelope; no summary is
  fabricated from a failed scan.
- Missing summary data from a custom/test scanner implementation is a contract
  error to update at that adapter boundary, not a signal to rebuild from raw
  paths through a fallback.

### Security, Trust, and Access

- The scanner performs no new content reads, process execution, or network
  access.
- Samples contain repository-relative paths only. Presenters apply the existing
  redactor before public output.
- Secret-like paths and bounded detail remain protected by the current
  presentation boundary; excluded file contents are never read or returned.
- Aggregate counts do not reveal raw query text or file content.

### Migration and Compatibility

This is an additive contract `0.1` change:

- Add optional `skipped_path_summary`.
- Stop emitting optional raw `skipped_paths` from current validation plans.
- Retain the legacy field in the validation-plan schema only to parse persisted
  or test compatibility inputs during this version; it is not a second runtime
  output route and must be marked deprecated.
- Keep the shared raw `SkippedPath` contract and raw fields on scope/overview or
  other owners unchanged.
- Do not add a feature flag, environment switch, dual emitter, or fallback
  summarizer.

A future breaking removal from the accepted input schema requires a contract
version change and is outside this spec.

### Slice Boundary And Residual Architecture

| Design target | In this slice | Out of this slice | Follow-up destination | Blocks closure? |
| --- | --- | --- | --- | --- |
| exact skip population | scanner invocation counts and deterministic samples beyond raw retention bound | changing traversal/max-files/continuation | EB014 or separate scanner-completion evidence | no |
| validation-plan compaction | structured summary and actionable records | scope/overview/docs/diagnostics compaction | owning surface backlog if evidenced | no |
| context parity | shared counts and sample policy rendered in existing `skipped_work` | task-context schema redesign | none | no |
| validation behavior | existing commands, blockers, risks, and execution state preserved | command ranking/execution | EB004 | no |
| unrelated capacity | none | ranked docs universe capacity/eviction | EB059 | no |

## Validation Strategy

| Validation | Covers | Evidence Location | Residual Risk |
| --- | --- | --- | --- |
| accumulator table/permutation tests | CP-001 through CP-005 | new `tests/application/skipped-path-summary.test.ts` | none expected |
| scanner over-100 and truncated tests | Requirement 1, Requirement 3, CP-006 | `tests/workspace/file-catalog-scanner.test.ts` | existing scanner traversal bound remains explicit |
| contract tests | additive schema, strict shape, legacy input compatibility | `tests/contracts/runtime-contracts.test.ts` | old consumers may ignore the new optional receipt |
| validation planner tests | commands, actionable paths, blockers, conservation | `tests/mcp/verification-plan-tool.test.ts` | fixture representativeness |
| context parity tests | one shared group/count/sample result | `tests/mcp/context-for-task-tool.test.ts` | prose remains less structured by design |
| presenter/translation tests | redaction and public envelope | presenter and MCP translation tests | none expected |
| full repository gates | integration and packaging regression | `verification.md` | environment recorded truthfully |

No new property-test dependency is required. Deterministic generated
permutations in Vitest are sufficient for the finite reason/path invariants.

## Downstream Task Guidance

- Review the public additive shape and scanner population seam before source
  implementation.
- Add failing pure-policy, scanner, and contract tests before integrating the
  two use cases.
- Treat any proposed scan/extraction cap, retry, or raw-to-summary fallback as a
  design deviation requiring reconciliation.
- Final review must include contracts, architecture/layering, payload truth,
  and QA fixtures.

## Operational Considerations

- The public routine-skip payload is bounded to at most three paths for each
  encountered reason plus actionable selected-path evidence.
- Counts are safe aggregate observability; no raw transcript, file contents, or
  query text is persisted.
- No database migration, daemon state migration, environment variable, or
  runtime feature flag is required.
- Installed-runtime dogfood should record response byte size, planned command
  presence, exact group counts, scanner truncation, and package/runtime identity.

## Open Questions

No open product decision blocks task drafting. The sample bound is three, the
contract change is additive, the scanner population receipt is required, and
raw validation-plan emission ends in this slice.

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
