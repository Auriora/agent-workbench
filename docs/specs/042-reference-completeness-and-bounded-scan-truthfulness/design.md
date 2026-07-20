---
title: Reference completeness and bounded-scan truthfulness design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-07-20
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Technical Design

## Overview

Retain the existing graph-first `find_references` path and its lexical route
when parser evidence is absent. Replace the lexical route's one-window catalog
assumption with deterministic `FileCatalogPort.listFiles({after_path})`
pagination, an opaque scan cursor, and a compact coverage receipt. Completeness
is derived from source exhaustion, not from whether the current hit list filled
`max_results`.

## Confirmed Root Cause

`find-references.ts` caps the catalog at 100 path-sorted rows in both candidate
selection and lexical scanning, then stops at the result limit. The current
cursor represents only a result offset, and `meta.truncated` reflects result
pagination rather than catalog exhaustion. It cannot represent an unvisited
catalog window, so later TypeScript files can be omitted while the response
appears complete. Response `scope.languages` is also derived from returned
rows rather than the files the lexical scan actually inspected.

The JavaScript/TypeScript extractor intentionally indexes declarations,
imports, and exports rather than every call identifier. A call-site match from
the lexical route is therefore an unresolved lexical occurrence, not a
semantic consumer. The current scan also emits at most one hit per matching
line, which can make occurrence counts ambiguous.

## Requirement Coverage

| Requirement | Design coverage | Validation |
| --- | --- | --- |
| Requirement 1 | Declared evidence universes, independent parser-route exhaustion, and graph/lexical separation | false-complete and route-limit contract tests |
| Requirement 2 | File-atomic catalog continuation, stable ordering, stop reasons, and per-page budgets | pagination, replay, stale-cursor, and budget tests |
| Requirement 3 | Exact page/sequence accounting and compact scan-coverage receipt | contract, presenter, property, and trust tests |
| Requirement 4 | SessionStart, candidate-failure, policy-exclusion, and parser-limit fixtures | focused graph/query and MCP tests |

## High-Level Design

### Graph-First Selection

Parser-backed outgoing, incoming, and unresolved references remain the primary
route. Lexical scanning remains a low-confidence routing route only when that
selected graph result is empty. This spec does not union in a hidden second
implementation after parser evidence succeeds.

Each parser route declares its own evidence universe: all matching graph rows
for the resolved node, direction, and published snapshot. The application asks
the graph port for `remaining_page_slots + 1` rows from the route's authenticated
offset, retains at most the remaining slots, and uses the extra row only to
prove route continuation. Zero rows prove an exhausted empty route; exactly the
requested limit is complete only when the limit-plus-one probe returns no extra
row.

The routes are disjoint and concatenate in the fixed order `outgoing`,
`incoming`, `unresolved`. An outgoing row owns a resolved reference whose source
is the target node. An incoming row owns a resolved edge whose target is the
target node, excluding a self-edge already owned by outgoing. An unresolved row
owns only unresolved-parser evidence, so it cannot duplicate either resolved
route. Within each route the storage query returns canonical reference identity
order and suppresses duplicate identities. The application drains the current
route before entering the next, preserving per-route offsets and exhaustion
flags in one authenticated composite parser cursor. The public page order is
therefore the stable concatenation of the three disjoint routes without an
unbounded emitted-identity set.

Complete parser evidence requires all three exhaustion flags. A route that has
more rows leaves the combined response partial and callable; later routes are
not probed until it is exhausted. Lexical scanning is selected only when all
three parser routes are exhausted with zero combined rows on the first parser
sequence. It never follows a non-empty or partially exhausted parser sequence.

### Declared Lexical Evidence Universe

The lexical evidence universe is the path-ordered set of published-snapshot
catalog entries that are searchable by the lexical route and allowed by
workspace policy. Unsupported languages and paths excluded as generated/vendor,
secret, configured skip, or unsafe are outside that universe. The receipt
reports bounded exclusion counts and reason classes so declared scope is
auditable without enumerating paths.

Every searchable, policy-eligible entry remains inside the universe even if it
is oversized for the per-file ceiling, missing, unreadable, or changes after
publication. Such a candidate is unresolved evidence: the response is partial
when other useful evidence can be returned, and blocked when no safe useful
result can be established. It can never contribute to complete absence. Global
snapshot validity should block a known missing indexed path before scanning;
query-time discovery is the required backstop, including paths beyond catalog
row 100.

### Cursor Authentication And Lexical Scan State

Every scan, result, and composite parser cursor is an authenticated opaque
envelope. The daemon generates a random cursor-authentication key and key-epoch
identifier at startup, keeps the key only in process memory, and authenticates
the versioned payload with HMAC-SHA-256. Decoding verifies the tag before using
any payload field. A malformed envelope or bad tag is `invalid_cursor`; a
well-formed cursor from a different key epoch after daemon restart is
`cursor_expired`. Neither outcome restarts at page one. Cursor keys and tags are
never logged or returned outside the opaque token.

The lexical cursor payload binds:

- cursor kind and schema version;
- resolved snapshot ID and target node ID/name;
- scan progress as catalog `after_path` for the last fully inspected or fully
  classified unresolved catalog entry;
- optional result-page identity and next occurrence ordinal for results from a
  fully scanned atomic file; this is not scan progress;
- stable request bounds relevant to replay.

The composite parser cursor payload binds the same request/snapshot/target
identity plus current route, per-route offsets, per-route exhaustion flags,
combined rows returned so far, schema version, and key epoch. Authentication
prevents a caller from changing an ordinal, counter, route offset, exhaustion
flag, or bound that cannot otherwise be recomputed without hidden work.

The application layer validates that identity before continuing. The catalog
port already provides ordered `after_path` pagination; storage remains a thin
provider of deterministic rows. No scan cursor contains a line or column.

If one admitted file produces more occurrences than the remaining public result
slots, the scanner completes that file and the presenter returns a separate
result cursor bound to path, indexed file identity, target, snapshot, bounds,
and next occurrence ordinal. Replaying it re-reads and re-validates that same
whole file, charges the replay read to the new page, returns the same occurrence
slice, and does not increment the sequence's unique-file count or advance the
catalog cursor. Changed identity is a structured blocked/invalid replay, never
a silent rescan with different results.

An oversized candidate or a candidate found missing, unreadable, or changed is
fully accounted as a classified unresolved catalog entry. Classification
increments the page and sequence unresolved/classified reason counters and
advances `after_path` exactly once, allowing safe later catalog entries to be
visited. It does not increment unique files inspected. A read attempt and its
declared/actual byte counters change only according to the accounting table.
The carried unresolved count prevents the sequence from becoming complete even
after catalog exhaustion. If later safe work remains, the response may return
useful partial evidence and a continuation; if no safe result can be
established, the response is blocked with the same classified receipt.

### File-Atomic Admission And Accounting

The current `WorkspaceFilePort` supplies whole-file reads, so a file is the
smallest scan work unit. Before `readText`, the scanner:

1. checks policy and searchable language;
2. checks the indexed declared size against the per-file ceiling and remaining
   page byte budget;
3. confirms that the file-count budget has capacity; and
4. checks that the page's monotonic time admission deadline has not passed.

Only then is the read admitted. No new read starts at or after the deadline;
an admitted whole-file read and occurrence scan finish atomically, so the time
bound is an admission deadline rather than cancellable mid-file CPU time. The
receipt exposes elapsed time after that atomic unit and the `time` stop reason
if it crossed the deadline. This is the only implementable time contract until
the workspace port exposes cancellable/chunked reads.

Declared bytes are reserved before the read and are the only enforceable byte
admission bound. Actual UTF-8 bytes are measured after the admitted atomic read
and are observable accounting, not a pre-read limit. If actual bytes or the
recomputed content identity differ from the cursor-bound/indexed identity, the
candidate is changed/unresolved, the response cannot be complete, and scanning
does not pretend the declared reservation proved inspection. Page accounting
records declared bytes admitted and actual bytes observed separately.

### Coverage Receipt

The public result or response metadata gains a bounded receipt with:

- `state: complete | partial`;
- `catalog_exhausted`;
- `unique_files_inspected` for the page and sequence, plus `file_read_attempts`
  and `replay_reads` so result replay never inflates unique coverage;
- `declared_bytes_admitted`, `actual_bytes_observed`, and elapsed admission
  time for the page and cursor sequence;
- `searchable_candidates_classified`, including unresolved reason counters, so
  failed entries that advance catalog progress remain auditable;
- `languages_inspected`, deduplicated, bounded, and derived from inspected
  files;
- `page_matches`, `matched_so_far`, and `complete_matches` only when the
  catalog is exhausted, or an explicitly equivalent count basis;
- bounded `policy_exclusions` counts separate from
  `unresolved_searchable_candidates` counts;
- `stop_reason` identifying catalog exhaustion, time, file, byte, result,
  path-policy, oversized, missing, changed, or read-failure boundaries;
- continuation only when more safe candidate work exists.

`analysis_validity` is `partial` whenever the candidate universe is not
exhausted. `truncated` agrees with the coverage state and cursor.

The cursor carries bounded scalar sequence totals and bounded reason counters;
the response does not reconstruct them from returned rows. Accounting uses
these exact rules:

| Field | Page increment | Replay behavior | Complete condition |
| --- | --- | --- | --- |
| unique files inspected | one after a searchable file is fully read, identity-checked, and scanned | zero for the same cursor-bound file | unchanged by policy exclusions or failed candidates |
| file read attempts | one immediately before each admitted `readText` | one per replay read | may exceed unique files |
| replay reads | zero for first inspection | one per result-cursor read | subset of read attempts |
| declared bytes admitted | indexed declared bytes reserved before each read | charged again | never charged for a rejected admission |
| actual bytes observed | UTF-8 bytes returned by each successful read | charged again | identity mismatch remains unresolved evidence |
| page matches | occurrence records returned on this page | counts only the returned replay slice | never inferred from files |
| matched so far | prior returned occurrences plus page matches | advances by returned slice | equals complete matches only after route exhaustion and result drain |
| unresolved searchable candidates | carried prior count plus newly failed, oversized, or changed candidates | unchanged unless replay itself fails | must be zero for complete evidence |
| policy exclusions | carried bounded reason counts plus new exclusions | unchanged by result replay | outside the completeness denominator |
| searchable candidates classified | one for each searchable entry inspected or conclusively classified unresolved | unchanged by result replay | advances catalog progress but does not imply inspection |

A replay of the same cursor recomputes the identical page receipt; it does not
accumulate against server-side session state. Advancing with the returned next
cursor incorporates that page's sequence totals exactly once. Duplicate cursor
submission therefore repeats a page idempotently rather than double-counting it.

### Lexical Output Unit

The lexical route emits one `ReferenceHit` per identifier occurrence, ordered
by path, line, and column. Multiple matches on one line remain separate. Hits
retain `status: unresolved`, low confidence, and lexical provenance; neither
the result label nor its count describes them as semantic consumers. Parser
references keep their existing semantic unit and do not share lexical count
semantics.

## Low-Level Design

### Lexical Page Algorithm

```text
validate snapshot, target, cursor identity, request bounds, and budgets
verify cursor HMAC and current daemon key epoch before reading payload state
drain a bound result cursor first, if present, without advancing scan progress
start after the last fully inspected or classified unresolved entry, or at catalog beginning
while file capacity remains and the time admission deadline has not passed:
    read next ordered catalog page
    classify policy exclusions outside the evidence universe
    for each searchable candidate, precheck declared size and remaining bytes
    if oversized, missing, unreadable, or changed, classify unresolved and advance after_path
    admit and read one whole file atomically
    scan the whole file deterministically and measure actual bytes
    append one hit per occurrence with lexical provenance
    if public result capacity ends, create a result cursor over the completed file
    advance scan after_path after full inspection or full unresolved classification
    if catalog page is short, mark catalog exhausted
return hits, separate result/scan continuation as needed, stop reason, and receipt
```

### Contract Boundary

Extend the canonical graph response contracts rather than adding presenter-only
fields. Keep MCP adapters thin. Cursor contents remain opaque to callers and
must not expose host paths or unbounded candidate lists.

### Failure Behavior

- Stale or unpublished snapshots remain blocked through existing preflight.
- Invalid cursor identity returns structured invalid input; it does not restart
  silently from page one.
- A bad cursor authentication tag returns `invalid_cursor`; a cursor whose key
  epoch predates a daemon restart returns `cursor_expired`. Neither is retried,
  reinterpreted, or silently restarted.
- Workspace read failures remain explicit degraded/blocked evidence according
  to existing path policy; they do not become partial success guards.
- Budget exhaustion produces a valid partial response, not a timeout fallback.
- A missing or unreadable indexed candidate produces explicit degraded or
  blocked evidence under existing policy; it is not silently treated as
  catalog exhaustion.
- An oversized but otherwise searchable candidate stays inside the evidence
  universe and prevents valid absence; a policy-excluded unsupported path does
  not.

### Security And Trust

Only indexed repo-relative paths already accepted by workspace and catalog
policy are read. Secret, generated/vendor, oversized, missing, or inaccessible
paths preserve compact skipped evidence. No command execution or network access
is introduced.

## Operational Considerations

- Preserve the existing bounded reference-query latency target by returning a
  continuation when any time, file, byte, or result budget is reached.
- Cursor decoding and identity validation remain application-owned and require
  no daemon migration or external service.
- Additive response fields must remain readable by older clients; a cursor
  schema-version mismatch returns structured invalid input rather than silently
  restarting the scan.
- Runtime and dogfood diagnostics should expose the stop reason and coverage
  receipt without logging source text or host paths.

## Slice Boundary And Residual Architecture

| Design target | In this slice | Out of this slice | Follow-up destination | Blocks closure? |
| --- | --- | --- | --- | --- |
| truthful lexical completeness | pagination, cursor, coverage, counts, trust | whole-program semantics | language capability backlog | no |
| SessionStart regression | JS/TS hook and test fixture | unrelated language expansion | language-specific backlog | no |
| graph-first architecture | existing parser/reference route retained | parser replacement or LSP | none | no |

## Validation Strategy

| Validation | Covers | Evidence location | Residual risk |
| --- | --- | --- | --- |
| contract and response metadata tests | Requirements 1 and 3 | `verification.md` | none expected |
| graph query pagination fixtures | Requirements 2 and 4 | `tests/graph/query-tools.test.ts`; `tests/fixtures/fixture-reference-completeness/` | lexical evidence remains low confidence |
| MCP envelope tests | public cursor and trust behavior | MCP query suites | none expected |
| property-based deterministic sequences | cursor concatenation, replay, duplicates, stable order | `tests/graph/reference-pagination.property.test.ts` | seeded runs complement named boundary fixtures |
| provider installation smoke | packaged Codex and Claude paths and artifact identity | `scripts/ci/installed-provider-plugin-smoke.mjs` | real client availability remains an environment prerequisite |
| full repository gates | integration and package compatibility | `verification.md` | environment-specific native builds remain install concerns |

## Durable Promotion Targets

- `docs/design/mcp-surface-design.md`
- `docs/reference/runtime-contracts.md`
- `docs/design/graph-store-design.md`
- `docs/design/language-adapter-design.md`
- `docs/reference/mvp-proof-matrix.md`
- `docs/backlog/README.md` EB053
- `docs/reference/agent-readable-changelog.md`

## Decisions Fixed For Implementation

- Scanning is whole-file atomic; no within-file scan cursor is permitted.
- Time is a file-admission deadline because the current workspace port cannot
  cancel a whole-file read.
- Declared and actual bytes, unique inspections, attempts, and replay reads are
  separately accounted at page and sequence scope.
- Result pagination may replay one already scanned atomic file, but it cannot
  advance scan progress or inflate unique coverage.
- Exact public field names and cursor schema version remain a contract-task
  choice, not an unresolved behavioral decision.
- Cursor authentication is HMAC-SHA-256 with an in-memory daemon key and explicit
  restart expiry; no unauthenticated sequence totals or route state are trusted.
- Parser results drain disjoint outgoing, incoming, and unresolved routes in
  that order through one authenticated composite cursor.
- Failed searchable candidates are fully classified unresolved entries: they
  advance catalog progress and counters, never unique inspection or completeness.

## Open Questions

None block implementation. Public additive field names and cursor schema
version are bounded T001 implementation choices governed by the fixed behavior
above; they do not reopen whole-file atomicity, evidence-universe scope, or
accounting semantics.

## Related Artifacts

- Requirements: `requirements.md`
- Change impact: `change-impact.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
- Review disposition: `review-disposition.md`
