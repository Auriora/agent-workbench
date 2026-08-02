---
title: Large-repository graph completion design
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

EB014 is a bounded-execution design slice. It makes graph indexing coverage
truthful, makes bounded progress resumable, and aligns production with debug
sweep completion behavior.

Core change: replace scan-derived completion assumptions with a run-state model
carried across bounded slices:

- `scan_count`: files discovered
- `admission_count`: files admitted for extraction after deterministic
  priority reordering
- `extraction_count`: files actually extracted
- `continuation`: durable state for safe resumption
- `coverage`: partial/full trust derived from all three counts

## Current-surface behavior to be corrected

- Debug path sets a hard extraction cap and does not represent that run as a
  continuation-able segment.
- Coverage reporting uses scan-derived assumptions and can emit complete trust
  while admitting/extracting only a cap-sized slice.
- Priority seed detection exists but does not reorder scanner output.

## High-Level Design

1. Define a single run state model for every bounded extraction path that carries
   scan/admit/extract counters and bounded completion state.
2. Apply deterministic admission ordering before extraction so priority files are
   admitted first and stable.
3. Persist run state through a durable continuation ledger and consume it only
   within validated ownership and generation rules.
4. Build each continuation run inside an isolated completion snapshot seeded from the
   currently published graph only once.
5. Publish the final stable graph replacement atomically only after completion;
   advance cursor only on successful publish commit.
6. Propagate the seed + run trust state into query/tool-facing response metadata.
7. Maintain queryable, already-published partial seed immutability until explicit
   completion publication.

## Low-Level Design

### 1. Run-state preparation

- Resolve effective graph context and compute run mode (production warmup, debug sweep,
  resume).
- Derive request budget and owner identity from caller context.
- Compute and validate one `completion_target_id` per bounded lifecycle.
- Load active continuation when present and validate owner, status, generation, and
  staleness before each pass.

### 2. Admission ordering

- Build scanner result list and collect source indices for each discovered file.
- Compute a stable priority flag for each file:
  - `1` when file path matches `priority_paths`,
  - `0` otherwise.
- Sort by priority desc, then normalized path, then original stable source order.
- Slice by effective `max_files` / `max_extraction_files`.

### 3. Bounded extraction slice

- Execute extraction only on admitted slice.
- Continuation cursor advances only by deterministic scan list index, never by
  parser-order side effects.
- Increment and persist scan, admission, and extraction counters per slice.
- If slice is capped, persist continuation record with scanner cursor and
  owner/generation.
- If slice is incomplete, materialize/extend completion snapshot by cloning the
  current public seed once, then applying this slice only.
- If slice exhausts all pending admissions without cap pressure, transition run to
  completion phase for atomic publish.
- Preserve unresolved-reference state from this slice for final cross-chunk
  reconciliation.

### 4. Completion and publication

- Initialize a controller-owned isolated building snapshot once per bounded run using
  a copy of last completed public seed.
- Process every bounded slice into that isolated completion snapshot; do not mutate the
  stable public snapshot while incomplete.
- Run final unresolved-reference reconciliation for accumulated cross-chunk findings
  before publish.
- On commit failure, keep the running completion snapshot and cursor unchanged.
- On completion publish boundary:
  - commit metadata for counters and continuation cursor,
  - persist trusted completion state,
  - atomically swap stable published target to completion snapshot output.
- Ordinary query paths must never read the building snapshot; they continue to use the
  last fully published graph until completion swap succeeds.

### 5. Downstream propagation

- Attach coverage metadata to query responses and cache records:
  - bounded
  - has_more
  - completion_state
  - continuation token (when partial)
  - last cursor and reason.

## Target behavior

### 1. Coverage truth model

Every extraction run records and returns:

- `max_scanned_files`
- `max_admitted_files`
- `max_extracted_files`
- `max_extraction_files` request budget
- `scan_count`, `admission_count`, `extraction_count`
- `bounded`: boolean
- `has_more`: boolean
- `continuation_token` when bounded and incomplete
- `completion_state`: `complete` or `partial`

Completion is only `complete` when the deterministic scan is exhausted, no
admission or extraction budget remains truncated, and every admitted path has
either extracted evidence or an explicit terminal unsupported/size-policy
classification. Counter differences remain visible and are not silently
collapsed.

### 2. Deterministic priority seeding

Seed reordering moves priority matches to the front of the admission list with
stable secondary sort:

1. priority flag: `is_priority_path`
2. deterministic lexical path order
3. deterministic source order fallback

This includes first-pass files such as Rails `config/` and `config/routes.rb`
and persists through continuation resumptions.

### 3. Durable continuation

Bounded slices persist a continuation record in a durable ledger keyed by
`run_id` and `graph_name`. Record schema:

- `run_id`
- `owner`
- `generation`
- `status` (`active`, `completed`, `cancelled`, `stale`)
- `next_cursor`
- `max_files`
- `scanned_count`
- `admission_count`
- `extraction_count`
- `total_scanned`, `total_admitted`, `total_extracted`
- `created_at`
- `completion_source_graph_generation`
- `updated_at`

Continuation acceptance rules:

- owner and generation must match.
- status must be `active` for replay.
- cursor must belong to the active generation.
- run-level cancellation short-circuits further replay.

### 4. Atomic publication and idempotent continuation advancement

- Bound completion slices write to the isolated building snapshot; published partial
  seed continues to serve queries.
- A queryable published seed is the stable public snapshot; stable publish
  happens only when complete.
- Bound completion slices write to the isolated completion snapshot; stable publish
  happens once at completion boundary.
- A continuation cursor advances only after successful completion publish commit.
- If publish fails, cursor remains unchanged and run is retried with same cursor.
- Restart logic:
  - if owner requests cancel, mark continuation canceled and block replay.
  - if stale, create a fresh generation and close old state.
  - if active and incomplete, resume from cursor.

### 5. Downstream trust propagation

Result consumers receive normalized trust metadata:

- `coverage_state`: `partial` or `complete`
- `bounded`
- counters and next continuation
- `trusted_scope` computed from run state, not hardcoded assumptions

Query-layer behavior:
- If `partial`, query responses include partial rationale and do not mark complete
  impact/reach unless already complete by counters.

### 6. Completion controller loop and deadlines

- Worker loops for partial completion stay within one completion target and one
  owner/generation pair.
- Each pass sets a fresh per-pass deadline and writes a `partial` or `complete`
  result contract before returning.
- Each pass validates generation ownership on entry and before publish attempt.
- Controller loops partial targets through the isolated completion snapshot and reuse the
  same completion cursor without reparsing already-admitted prefixes.

### 8. Final unresolved-reference reconciliation

- On final completion boundary, merge unresolved-reference sets accumulated across all
  chunks.
- Resolve stable links for each unresolved key in order of admission to avoid
  duplicate/late misses.

### 7. Debug-sweep completion parity

Debug sweep execution should invoke the same continuation-capable path as production
with configurable budget and explicit `resume_if_partial`.

- Remove hardcoded 500 assumption in the debug command path.
- Always persist continuation state for debug path once bounded cap is used.
- Expose clear completion state for diagnostic verification.

## Data model (logical)

```text
GraphRunContext
  -> deterministic_admission_list (priority-sorted)
  -> bounded_slice_extraction -> partial_token_or_complete
  -> continuation_ledger (owner, generation, cursor, counters, status)
  -> atomic graph publication -> trust metadata -> downstream surfaces
```

## Error handling

- Missing continuation / stale state: safe restart with a fresh generation.
- Cancellation: explicit, closed failure mode with no silent resume.
- Inconsistent counters: closed partial state with explicit reason.
- Concurrent replay attempts: generation/owner conflict resolved by explicit state
  ownership checks.

## Migration and compatibility

No public schema extension is implied for query tool protocols beyond carrying
truthful existing fields and explicit partial flags. Existing clients keep old
fields; partial trust fields are additive where contract owners permit.

## Security and access

No process launch, execution, or external service call is introduced. Continuation
state is workspace-local and owner-scoped.

## Validation strategy

- Targeted unit/integration tests for run-state transitions and continuation.
- Regression tests for seeded priority ordering and non-priority skip bug.
- End-to-end warmup/dogfood-like slice replay tests.

## Operational Considerations

- Budget-sensitive paths should not be made to depend on in-memory state only; each
  continuation write must survive process restarts.
- Replay diagnostics should include cursor provenance (file and index) to simplify
  incident triage.
- Partial runs should be visibly bounded in operator-facing output to avoid assumptions
  of full route coverage.
- Counter fields in responses should remain stable across versions to protect query
  parser consumers.

## Open Questions

- No open blocking questions are outstanding; implementation decisions are locked in
  this package.
