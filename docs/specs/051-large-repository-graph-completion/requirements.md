---
title: Large-repository graph completion requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Introduction

EB014 requires that bounded extraction in large repositories report what really
happened (scan, admission, extraction), and that every limiting bound can be
continued safely via a durable run-to-extend flow instead of implying full
coverage.

## Goals

- Stop representing bounded extraction as complete coverage.
- Make extraction scheduling deterministic for Rails-config-sensitive first-pass files.
- Guarantee durable continuation across bounded runs with resumable ownership and
  staleness semantics.
- Make partial states explicit and safely consumable by downstream query surfaces.
- Ensure debug/test sweep tooling uses the same durable continuation path used in
  production.

## Non-goals

- Adding parser fallbacks or alternate extraction engines.
- Building a universal completion UI or scheduler outside existing graph runtime.
- Treating debug tooling as a substitute for production completion behavior.
- Reordering full repository semantics without a bounded budget or continuation.

## Durable Source Baseline

| Source | Baseline claim | Evidence confidence | Why this is durable |
| --- | --- | --- | --- |
| `docs/reference/runtime-contracts.md` | Existing result fields carry trust/completeness metadata but are currently scan-biased for completion interpretation. | high | Must be the baseline for how downstream tools represent complete/partial work. |
| `docs/design/mcp-surface-design.md` | MCP presentation behavior governs public tool response shape; runtime contracts remain trust vocabulary authority. | medium | Trust and coverage presentation in MCP query surfaces must remain consistent with runtime-contract semantics. |
| `docs/reference/dogfood-evidence-ledger.md` | Prior large-repository dogfood evidence exists and is repository-scoped. | medium | New EB014 claims must stay bounded and non-universal. |
| `docs/backlog/README.md` | EB014 owns graph completion and budget semantics in this area. | high | Scope and residuals remain owner-controlled. |
| `src/application/use-cases/index-repository-graph.ts` | Current bounded run state and continuation behavior are the technical baseline for this spec. | high | Required implementation slice is this use-case. |
| `src/debug/mcp-tool-sweep.ts` | Current debug sweep cap is hard-coded at 500 for bounded extraction. | high | This is the known debug-path divergence to fix. |

## Correctness Properties

### CP-001 partial-seed and completion truth

- Completion state is complete only when `scan_count`, `admission_count`, and
  `extraction_count` all meet expected bounded or unbounded criteria.
- If any of the three counts are lower than expected, coverage state MUST be partial.
- A partial first-read seed must remain queryable and complete only when replaced by
  atomic stable-target publication.

### CP-002 deterministic priority ordering

- Files matching `priority_paths` must always be admitted before non-matching files.
- For equal-priority files, order must be stable across runs and resumptions.

### CP-003 continuation correctness

- A continuation with mismatched owner, stale generation, cancelled status, or
  repository-generation mismatch MUST not be replayed.
- A stale continuation must transition to cancellation or restart semantics before
  new admission begins.
- Staleness is repository-generation based, not a time-based TTL.

### CP-004 atomic publication

- A successful slice must only advance continuation after successful atomic graph
  publication.
- Failed publication must keep cursor and counters unchanged so replay is safe.

### CP-005 trust propagation monotonicity

- A response generated under partial state cannot claim complete traversal coverage.
- Once a full run completes, trust can upgrade to complete; no regression to partial
  occurs without a new bounded restart.

### CP-006 bounded completion parity

- Debug and production bounded runs must evaluate the same completion and continuation
  rules to the same terminal state boundaries.

## Glossary

| Term | Definition |
| --- | --- |
| Scan count | Files discovered by the repository scanner. |
| Admission count | Files admitted to extraction under budget and path-priority policy. |
| Extraction count | Files actually processed in one extraction slice. |
| Complete coverage claim | A successful `complete` trust posture that requires full bounded admission/extraction. |
| Partial coverage claim | A bounded run result with explicit remainder and continuation token. |
| Continuation token | A durable cursor that captures where bounded extraction should resume. |
| Owner | The canonical actor/repository owner recorded on each continuation record. |
| Generation | The bounded lifecycle version for continuation state. |
| Stale continuation | A continuation whose owner generation does not match active repository state. |

## Requirements

### Requirement 1: Truthful scan/admission/extraction reporting

**User Story:** As a tooling consumer, I need to trust whether a graph build is
complete or partial from bounded limits.

#### Acceptance criteria

1. GIVEN a bounded run, WHEN scanner, admission, or extraction is capped by
   budget, THEN the result MUST report bounded-admission and bounded-extraction
   state explicitly in both runtime metadata and coverage output.
2. GIVEN a run with any bound, WHEN no partial semantics are recorded, THEN the
   result MUST NOT claim complete coverage.
3. Coverage completeness must be derived from scan exhaustion, admission and
   extraction terminal state, and not from scan count alone. An explicit
   unsupported or size-policy classification is terminal evidence rather than
   hidden truncation.
4. IF extraction is partial, the system MUST include the bounded reason and next
   continuation cursor.
5. No bounded run should stop at an uncoupled cap; bounded cap conditions must
   always preserve a run-to-extend cursor path unless the run is complete.
6. Final completion publication must reconcile unresolved references accumulated
   across all bounded chunks before the result is marked complete.

### Requirement 2: Deterministic priority seeding for first-pass files

**User Story:** As an indexer, I need route-centric Rails files to be scanned
first so coverage in large repositories is deterministic and useful.

#### Acceptance criteria

1. GIVEN `priority_paths` contains config/routes-like patterns, WHEN files are
   admitted, THEN priority files SHALL be deterministically moved to the head of
   the admission order.
2. Ordering MUST be stable for equal-priority files and independent of filesystem
   enumeration quirks.
3. Priority ordering MUST apply to both scanner-to-admission and continuation
   resume order.

### Requirement 3: Durable chunk continuation semantics

**User Story:** As an operator, I need bounded extraction to resume deterministically
without rework or silent skips.

#### Acceptance criteria

1. WHEN admission/extraction is capped, THEN the system MUST create/persist a
   continuation record containing:
   - owner
   - generation
   - completion target id
   - max files
   - scanner cursor index into deterministic admission order
   - continuation cursor
   - scan/admit/extract counts
   - generation source hash
2. Continuation reuse SHALL require matching owner and generation and SHALL be
   rejected when generation-mismatched, stale, or cancelled.
3. The continuation cursor MUST be consumed against the same deterministic
   admission ordering and resume from `next_cursor` on later slices without
   reparsing already-admitted prefixes.
4. A continuation MUST be consumed atomically and leave the next cursor visible
   for exactly one successful completion attempt.
5. Any unresolved references raised during partial slices MUST be carried forward
   for final reconciliation before completion publication.
6. Upon completion, the continuation state SHALL transition to `completed` and
   be safe to evict after grace.
7. A stale continuation is one whose owner-generation pair no longer matches the
   active repository-generation state.

### Requirement 4: Atomic publication and restart semantics

**User Story:** As a query client, I should never observe partial write states
that are later overwritten or duplicated.

#### Acceptance criteria

1. Partial and complete graph publication SHALL be single-transaction at the
   run boundary.
2. A restart of a run with stale continuation SHALL create a fresh generation
   and cancel the stale continuation.
3. Owner cancellation SHALL stop resumption until explicitly re-enabled.
4. Restart after incomplete completion SHALL preserve all previously admitted
   evidence and append only missing admitted/extracted work.
5. Partial completion state MUST remain immutable and queryable as the current
   published seed while the run remains incomplete.
6. Partial state queries MUST return truthful partial trust, bounded counters,
   and continuation metadata.
7. A partial seed MUST NOT be replaced by a partial continuation chunk; only
   full run completion replaces the selected graph.

### Requirement 5: Downstream trust propagation

**User Story:** As a caller of query tools, I need to know whether a response
refers to partial evidence.

#### Acceptance criteria

1. Existing query surfaces MUST expose the same coverage truth model used by the
   extractor (scan/admit/extract + partial flag + continuation cursor).
2. Query responses derived from partial coverage MUST carry trust that is bounded
   by extraction state and must not claim complete impact/references.
3. Trust level SHALL be monotonic within a run: complete overrides partial.
4. Any cached or warm graph read path MUST preserve partial-trust metadata.

### Requirement 6: Debug sweep completion parity

**User Story:** As an engineer running debug sweeps, I need reproducible
completion behavior and not a separate capped path that cannot continue.

#### Acceptance criteria

1. Debug sweep execution MUST use a runtime setting aligned with bounded max
   extraction files and continuation support, not an isolated hardcoded cap.
2. Debug sweeps with partial budgets MUST be resumable using the same durable
   continuation semantics as production.
3. A debug completion run SHALL terminate at the same completion boundary as
   production and report completion state consistently.

### Requirement 7: Regression and durability testing

**User Story:** As the maintainer, I want clear regression coverage for EB014 risks.

#### Acceptance criteria

1. Add regression coverage for:
   - scan/admit/extract misreporting
   - first-pass route/config priority reordering
   - continuation replay and stale/cancel/restart cases
   - partial trust propagation to at least one query surface
2. Include regression coverage for known partial indexing behavior observed in
   large-repository traces that include `gerald`.
3. Regression coverage SHALL include evidence that `priority_paths` membership-only
   behavior is replaced by deterministic reordering.

## Success criteria

- **SC-1:** No user-visible response can claim full coverage if any budget was
  enforced and continuation remains possible.
- **SC-1b:** Partial seed state remains usable and query-safe until successful atomic replacement of the stable target.
- **SC-2:** Partial and completed runs publish explicit trust states and continue
  semantics are machine-consumable.
- **SC-3:** Continuation replay is owner/generation safe and stale/cancelled cases
  fail closed to avoid replay corruption.
- **SC-4:** Debug sweep and production bounded flows use compatible completion
  semantics.
- **SC-5:** Durability and partial trust regressions are covered in targeted tests.

## Staged readiness

- **Current stage:** planning setup complete, implementation plan [~].
- **Next stage:** implementation slice execution and regression completion.
- **Ready for implementation:** after architecture, requirements/QA, and lifecycle MoE clear all blockers.
