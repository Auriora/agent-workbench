---
title: Reference completeness and bounded-scan truthfulness requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-07-20
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Introduction

`find_references` can fall back to a bounded lexical identifier scan when the
indexed graph has no parser references. Runtime `0.6.0` dogfood proved that the
scan may inspect only the first catalog window, omit later TypeScript test
references, and still return `truncated: false` with an apparently complete
`result_count`. This spec makes reference completeness an evidence-backed
contract: bounded work remains bounded, but uninspected candidates remain
visible as partial evidence rather than false absence.

## Goals

- Distinguish complete reference evidence from a bounded partial scan.
- Continue lexical catalog work deterministically without rescanning hidden
  windows or adding a second search implementation.
- Make counts, scanned languages, query budgets, and trust metadata agree.
- Define lexical output as identifier occurrences rather than semantic
  consumers, including multiple occurrences on one source line.
- Reproduce the twelve-occurrence SessionStart case with TypeScript tests.
- Preserve truthful absence semantics when an indexed searchable file cannot be
  inspected, including candidates beyond the first 100 catalog rows.

## Non-Goals

- Add shell search, grep, LSP, AST, or another parser/semantic fallback.
- Claim whole-program semantic reference resolution from lexical matches.
- Remove query budgets or read generated, vendor, secret, or unsafe paths.
- Change snapshot validity, daemon refresh ownership, or impact traversal.

## Durable Source Baseline

| Source | Current behavior relied on |
| --- | --- |
| `docs/design/mcp-surface-design.md` | Reference tools are bounded routing evidence with explicit trust and cursors. |
| `docs/design/graph-store-design.md` | Published snapshots and catalog rows are the indexed query authority. |
| `docs/design/language-adapter-design.md` | Parser-backed and lexical language evidence retain distinct capabilities and confidence. |
| `docs/reference/runtime-contracts.md` | Response metadata must preserve skipped, partial, and planned-only evidence. |
| `docs/reference/mvp-proof-matrix.md` | Reference-navigation claims require fixture-backed proof and honest degradation. |
| `docs/backlog/README.md` EB053 | P0 defect evidence and acceptance boundary. |
| `docs/reference/dogfood-evidence-ledger.md` | Dated healthy-runtime reproduction and shell comparison. |

## Durable Impact

| Durable area | Action | Target | Notes |
| --- | --- | --- | --- |
| MCP behavior | clarify | `docs/design/mcp-surface-design.md` | Define complete versus partial reference pages and continuation. |
| Runtime contract | modify | `docs/reference/runtime-contracts.md` | Define count basis and scan-coverage receipt. |
| Graph/catalog design | clarify | `docs/design/graph-store-design.md` | Define deterministic catalog pagination used by lexical reference routing. |
| Language capability | clarify | `docs/design/language-adapter-design.md` | Define lexical occurrence evidence separately from semantic references. |
| Proof boundary | update | `docs/reference/mvp-proof-matrix.md` | Record bounded completeness and continuation proof. |
| Provider proof guidance | update | `docs/runbooks/codex-agent-workbench-plugin.md` | Distinguish package/provider-labelled evidence from real Codex and Claude plugin proof. |
| Backlog | close after proof | `docs/backlog/README.md` EB053 | Preserve the dogfood reproduction and final disposition. |

## Requirements

### Requirement 1: Evidence-Backed Completeness

**Priority:** must-have

#### Acceptance Criteria

1. **AC1.1:** WHEN `find_references` reports complete analysis, THEN the
   selected reference evidence universe SHALL be demonstrably exhausted.
2. **AC1.2:** IF catalog candidates remain uninspected, THEN the response SHALL
   report partial or truncated analysis and SHALL NOT imply absence.
3. **AC1.3:** Parser, unresolved-parser, and lexical evidence SHALL retain
   distinct provenance, confidence, and semantic caveats.
4. **AC1.4:** Snapshot validity and publication selection SHALL remain required
   before any completeness claim.
5. **AC1.5:** The declared evidence universe SHALL include every searchable,
   policy-eligible indexed candidate for the selected route. An oversized,
   unreadable, missing, or changed candidate SHALL force `partial` or `blocked`
   evidence and SHALL never support a valid absence claim.
6. **AC1.6:** A path excluded by an explicit workspace policy (unsupported
   language, generated/vendor, secret, configured skip, or unsafe path) SHALL
   be outside the declared evidence universe, SHALL be summarized as a scoped
   exclusion, and SHALL NOT be represented as an inspected candidate.
7. **AC1.7:** Parser-backed incoming, outgoing, and unresolved routes SHALL
   prove exhaustion independently; zero rows, exactly the query limit, and
   limit-plus-one rows SHALL not share an ambiguous completeness state.
8. **AC1.8:** The combined parser result SHALL drain the disjoint routes in the
   fixed order outgoing, incoming, then unresolved. Its authenticated cursor
   SHALL preserve per-route progress and exhaustion, and complete parser
   evidence SHALL require exhaustion of all three routes.

### Requirement 2: Deterministic Bounded Continuation

**Priority:** must-have

#### Acceptance Criteria

1. **AC2.1:** A lexical scan SHALL page through the existing ordered catalog
   boundary using an opaque snapshot- and target-bound continuation.
2. **AC2.2:** Each page SHALL obey explicit time, file, byte, result, and
   path-policy bounds without rereading earlier catalog windows as hidden work.
   The whole-file `WorkspaceFilePort` read SHALL be admitted only after a
   declared-size byte precheck; an admitted file SHALL be the atomic scan unit
   for byte and time accounting.
3. **AC2.3:** Replaying a continuation against changed target, snapshot, or
   request identity SHALL return a structured invalid or blocked result.
4. **AC2.4:** Deduplication and ordering SHALL be stable across page boundaries.
5. **AC2.5:** A stop SHALL identify whether time, file, byte, result, path
   policy, read failure, or catalog exhaustion ended the scan.
6. **AC2.6:** Scan progress SHALL resume only after the last fully inspected or
   fully classified unresolved catalog entry. It SHALL NOT use a line or column
   as scan progress. A separate result
   cursor MAY page occurrences from an already selected atomic file, but SHALL
   not claim additional files inspected or advance catalog progress.
7. **AC2.7:** Replaying the same request and cursor against the same published
   snapshot and cursor-key epoch SHALL preserve authenticated prior progress,
   catalog order, occurrence order, and exact accounting for the work actually
   admitted. When replay executions both remain within the live admission
   deadline and stop on a structural file, byte, or result bound, they SHALL
   yield the same ordered occurrence page, structural progress, and non-time
   accounting. Observed `elapsed_admission_ms` and an opaque cursor token that
   authenticates that elapsed receipt MAY differ. A live
   time-admission boundary MAY stop at a different safe file
   boundary as scheduling or IO latency changes; either result SHALL remain
   partial/truncated, report its observed elapsed accounting and `time` stop
   when applicable, and SHALL NOT skip prior work or claim completeness.
   Changed file identity, target, bounds, snapshot, cursor payload, or
   authentication tag SHALL fail explicitly rather than silently restarting or
   skipping work. A daemon restart that rotates the cursor key SHALL return
   structured `cursor_expired`, never page-one replay.
8. **AC2.8:** An oversized, missing, unreadable, or changed searchable catalog
   entry SHALL be fully classified as unresolved and SHALL advance lexical
   `after_path`. It SHALL increment unresolved/classified counters, SHALL NOT
   increment unique-inspected counters, and SHALL continue to prevent complete
   evidence after later safe entries are scanned.

### Requirement 3: Count And Coverage Truthfulness

**Priority:** must-have

#### Acceptance Criteria

1. **AC3.1:** Reference results SHALL distinguish `page_matches`,
   `matched_so_far`, and a `complete_matches` total available only after source
   exhaustion, or SHALL expose an equivalent explicit count basis.
2. **AC3.2:** Lexical results SHALL expose inspected-file count, catalog
   exhaustion state, stop reason, and languages derived from files actually
   inspected rather than from unrelated response rows.
3. **AC3.3:** Response metadata SHALL be `valid` only for complete evidence and
   SHALL be `partial` when the bounded candidate universe is not exhausted.
4. **AC3.4:** Coverage fields SHALL remain bounded and SHALL NOT enumerate the
   entire catalog or skipped-path list in the response.
5. **AC3.5:** Coverage SHALL distinguish policy exclusions from searchable
   candidates that were skipped or failed, and SHALL carry unresolved
   searchable-candidate counts across continuation pages.
6. **AC3.6:** Unique files inspected, file read attempts, declared bytes
   admitted, actual bytes observed, elapsed admission time, replay reads, and
   occurrence counts SHALL have exact page and sequence accounting semantics.
7. **AC3.7:** Declared bytes SHALL be the enforceable pre-read admission bound.
   Actual bytes SHALL be measured and reported after an admitted atomic read but
   SHALL NOT be described as an enforceable pre-read bound. An identity or size
   mismatch SHALL be classified as unresolved evidence.

### Requirement 4: SessionStart Regression Proof

**Priority:** must-have

#### Acceptance Criteria

1. **AC4.1:** A fixture SHALL reproduce the Claude/Codex SessionStart twin and
   the TypeScript integration-test consumers.
2. **AC4.2:** A complete lexical query SHALL reach all twelve known identifier
   occurrences, including the three TypeScript test occurrences, without
   presenting those occurrences as resolved semantic consumers.
3. **AC4.3:** A deliberately smaller budget SHALL return an explicitly partial
   page whose callable continuation reaches the omitted occurrences.
4. **AC4.4:** No test SHALL satisfy acceptance by invoking shell search or an
   alternate parser route.
5. **AC4.5:** A fixture with two matching identifier occurrences on one source
   line SHALL return two stable occurrence records or explicitly define and
   label a line-match unit; it SHALL NOT silently collapse the count.
6. **AC4.6:** A fixture SHALL place a missing indexed searchable candidate after
   catalog row 100 and prove that global snapshot validity or query-time
   discovery prevents a valid complete/absence result.
7. **AC4.7:** Fixtures SHALL separately cover oversized, unreadable, missing,
   and explicitly policy-excluded paths and prove the evidence-universe rules
   in AC1.5-AC1.6.
8. **AC4.8:** Parser-route fixtures SHALL cover zero, exactly-limit,
   limit-plus-one, and multi-page results for incoming, outgoing, and unresolved
   references without invoking the lexical route.
9. **AC4.9:** Mixed parser-route fixtures SHALL prove outgoing-before-incoming-
   before-unresolved ordering, disjoint route ownership, cross-page route
   transitions, authenticated composite-cursor replay, all-route exhaustion,
   and cursor expiry after key rotation.

## Correctness Properties

- **CP-001:** `complete` implies catalog or graph evidence exhaustion for the
  resolved snapshot and target.
- **CP-002:** Concatenating valid continuation pages yields the same ordered,
  deduplicated lexical hits as one sufficiently budgeted complete scan.
- **CP-003:** No result or metadata field can claim fewer remaining candidates
  than the scan has proven.
- **CP-004:** File, declared-byte, and result work per page never exceeds the
  declared admission budget; no file begins after the monotonic time deadline.
  An admitted atomic read MAY cross that deadline, but its elapsed overrun and
  `time` stop reason SHALL be observable and no later file SHALL be admitted.
- **CP-005:** Parser and lexical provenance never collapse into a stronger
  semantic claim.
- **CP-006:** Lexical occurrence ordering is stable by path, line, and column,
  including multiple matches on the same line.
- **CP-007:** For any valid sequence of scan and result cursors, concatenating
  pages produces the same ordered occurrence multiset as a sufficiently
  budgeted complete scan, with neither duplicates nor omissions.
- **CP-008:** Replaying any valid cursor preserves authenticated progress,
  deterministic catalog/occurrence order, and exact accounting for admitted
  work. Structural-bound replays preserve ordered evidence, structural
  progress, and non-time accounting; elapsed accounting and opaque cursor-token
  equality are not promised. A live time-bound replay
  may stop at a different safe file boundary but remains truthful partial
  evidence. Changing any cursor-bound identity component, accumulated counter,
  ordinal, route state, or authentication tag is rejected. A cursor from a
  prior key epoch expires.
- **CP-009:** A complete absence claim is impossible while the sequence receipt
  records any uninspected searchable candidate.
- **CP-010:** Parser pages are the stable concatenation of the disjoint
  outgoing, incoming, and unresolved routes in that order; complete parser
  evidence implies all three route-exhaustion flags are true.
- **CP-011:** Classifying a failed searchable candidate advances catalog
  progress exactly once and preserves unresolved sequence evidence without
  inflating unique-file inspection.

## Success Criteria

- **SC-001:** The healthy SessionStart reproduction returns all twelve known
  occurrences or a truthful continuation sequence that reaches them.
- **SC-002:** Focused contracts reject false-complete and stale-continuation
  responses.
- **SC-003:** Typecheck, focused query tests, full tests, plugin/skill checks,
  package dry-run, installed-package convergence smoke, and both provider
  plugin-install smokes pass before closure.

## Related Artifacts

- Canonical context: `canonical-context.md`
- Change impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
- Review disposition: `review-disposition.md`
