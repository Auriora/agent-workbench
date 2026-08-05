---
title: Bounded docs map payload delivery traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-08-05
---

# Traceability Matrix

## Task To Context Matrix

The compact table below is intentionally retained because lifecycle tooling
uses its fields as structured readiness evidence. The detailed evidence remains
in the prose sections below.

| Task ID | Requirements | Acceptance Criteria |
|---------|--------------|---------------------|
| T001 | Requirement 1 | AC1; AC2; AC3 |
| T001 | Requirement 2 | AC1; AC2; AC3; AC4 |
| T001 | Requirement 3 | AC1; AC2; AC3; AC4 |
| T002 | Requirement 1 | AC1; AC2; AC3 |
| T002 | Requirement 2 | AC1; AC2; AC3; AC4 |
| T002 | Requirement 3 | AC1; AC2; AC3; AC4 |
| T002 | Requirement 4 | AC1; AC2; AC3 |
| T003 | Requirement 3 | AC1; AC2; AC3; AC4 |
| T003 | Requirement 4 | AC3 |
| T004 | Requirement 4 | AC1; AC2; AC3 |

## Requirement To Delivery Matrix

| Requirement | Acceptance Criteria | Coverage State | Residual Destination |
|-------------|---------------------|----------------|----------------------|
| Requirement 1 | AC1; AC2; AC3 | complete | none |
| Requirement 2 | AC1; AC2; AC3; AC4 | complete | none |
| Requirement 3 | AC1; AC2; AC3; AC4 | complete | none |
| Requirement 4 | AC1; AC2; AC3 | complete | none |

## Acceptance Criterion Traceability

### Requirement 1

- AC1 traces to T001 and T002. Evidence: the compact presenter/resource tests
  assert valid JSON within the 32 KiB UTF-8 bound, and `verification.md`
  records the successful focused and installed-smoke checks.
- AC2 traces to T001 and T002. Evidence: the compact contract and presenter
  tests assert typed compaction at the docs-map boundary rather than arbitrary
  byte slicing.
- AC3 traces to T001, T002, and T004. Evidence: the blocked-envelope tests and
  validation records show the structured blocked response with named missing
  evidence and recovery action.

### Requirement 2

- AC1 traces to T001 and T002. Evidence: the pagination tests prove truncated
  pages report `truncated: true`, preserve the full result count, and expose
  the first unreturned cursor.
- AC2 traces to T001 and T002. Evidence: the registry and tool tests prove the
  read-only `docs_map` tool accepts cursor parameters and the active docs
  scope.
- AC3 traces to T001, T002, and T004. Evidence: the multi-page continuation
  tests and live-corpus probe prove deterministic one-time reachability of
  eligible documents in order without rescanning a smaller corpus.
- AC4 traces to T001 and T002. Evidence: the corpus and regression tests prove
  the scan, index, and extraction universe remain unchanged by compaction.

### Requirement 3

- AC1 traces to T001 and T002. Evidence: the compact entry and presenter tests
  keep exact repo-relative paths, bounded titles, authority/currency fields,
  canonical-owner or supersession paths when present, and truthful omission
  counts.
- AC2 traces to T001 and T003. Evidence: the map-level routing contract records
  the direct-read guidance once, and the durable docs promote that single
  representation.
- AC3 traces to T001, T002, and T003. Evidence: `docs_outline` and
  `docs_read_section` remain the detailed follow-up surfaces in the design and
  durable contract promotion.
- AC4 traces to T001, T002, and T003. Evidence: warning totals and truncation
  state are preserved in the compact presenter, verified by the warning
  conservation tests and the docs contract promotion.

### Requirement 4

- AC1 traces to T002 and T004. Evidence: the fixture-backed tests cover the
  over-bound legacy-shaped corpus, multi-page continuation, UTF-8-safe field
  compaction, warning conservation, and structured blocked behavior.
- AC2 traces to T002 and T004. Evidence: the MCP registry tests prove the
  resource default and `docs_map` tool share the compact contract while only
  the tool accepts cursor parameters.
- AC3 traces to T004. Evidence: `pnpm typecheck`, the focused tests, the full
  Vitest suite, `pnpm validate:plugin`, `pnpm pack:dry-run`, and the installed
  or packaged stdio MCP smoke all passed or recorded their bounded state.

## Correctness Property Coverage

- CP-001: requirements R1 and R4; tasks T001, T002, and T004; tests or
  verification are the UTF-8 serialized envelope and installed stdio parse;
  residual risk is covered because both compact resource and pretty tool text
  are bounded.
- CP-002: requirement R2; tasks T001 and T002; tests or verification are the
  multi-page ordered universe equality checks; residual risk is covered
  because the current 66-document corpus returned once across six pages.
- CP-003: requirements R2 and R3; tasks T001 and T002; tests or verification
  are the result and warning count conservation checks; residual risk is
  covered by fixture and live-corpus assertions.

## Design To Implementation Matrix

- Compact contract and data flow covers Requirements 1, 2, and 3; tasks T001;
  interfaces or files are the contracts, use case, presenter, and MCP
  registries; verification is the focused tests; coverage state is complete;
  residual destination is none.
- Validation strategy covers Requirement 4; tasks T002 and T004; interfaces or
  files are the tests and package scripts; verification is the commands in
  `verification.md`; coverage state is complete; residual destination is
  none.
- Migration and compatibility covers Requirements 3 and 4; task T003;
  interfaces or files are the durable docs and changelog; verification is the
  markdown checks; coverage state is complete; residual destination is none.

## Open Decision Impact

No open decisions block implementation.

## Canonical Context Advisory

- Advisory waived for this package slice because the durable canonical sources
  were read directly and copying them into the spec would duplicate authority
  instead of strengthening traceability.
