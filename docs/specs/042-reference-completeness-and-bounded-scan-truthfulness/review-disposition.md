---
title: Reference completeness review disposition
doc_type: spec
artifact_type: review-disposition
status: draft
owner: platform
last_reviewed: 2026-07-21
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Review Disposition

## Scope And Meaning

This record reconciles the earlier Spec 042 mixture-of-experts review. A
`resolved` disposition means the draft requirements, design, tasks,
traceability, and verification plan now answer the authoring finding. It does
not claim implementation, runtime, validation, promotion, or closure evidence.
Phase 2 implementation findings are recorded separately below. T003-T007 are
complete; installed-client, promotion, and closure tasks remain open.

## Blockers

| ID | Finding | Disposition | Resolution evidence |
| --- | --- | --- | --- |
| B01 | The proposed line/column scan cursor was not implementable against the current whole-file `WorkspaceFilePort`. | resolved | Design fixes declared-size admission and whole-file atomic reads; scan progress follows only a fully inspected or fully classified unresolved path. AC2.2 and AC2.6 enforce it. |
| B02 | The evidence universe was undefined, so skipped searchable files could still permit false absence. | resolved | The declared lexical universe includes all searchable policy-eligible indexed candidates. AC1.5-AC1.6 and CP-009 distinguish unresolved candidates from policy exclusions. |
| B03 | Acceptance omitted the known global-validity/catalog-window failure and candidate failure classes. | resolved | AC4.6-AC4.7 and `fixture-reference-completeness` require missing row 101 plus oversized, unreadable, missing, changed, and policy-excluded cases. |
| B04 | Graph/parser results could still claim completeness at a query limit without proving route exhaustion. | resolved | Graph-First Selection requires limit-plus-one probes and route-bound pagination; AC1.7 and AC4.8 cover zero, exact-limit, limit-plus-one, and multi-page routes. |

## Additional Findings

| ID | Finding | Disposition | Resolution evidence |
| --- | --- | --- | --- |
| A01 | Byte accounting did not say what is checked before a read. | resolved | File-Atomic Admission And Accounting reserves the indexed declared size before `readText` and records declared and actual bytes separately. |
| A02 | Time accounting implied cancellation that the port cannot perform. | resolved | Time is explicitly a monotonic file-admission deadline; an admitted file completes atomically and any overrun is observable. |
| A03 | Scan and result pagination were conflated. | resolved | Cursor Authentication And Lexical Scan State defines separate scan and result cursors; only result replay may carry an occurrence ordinal. |
| A04 | Replay accounting and identity validation were ambiguous. | resolved | AC2.7 and the cursor design bind snapshot, target, bounds, path, file identity, and ordinal; replay reads are charged without inflating unique coverage. |
| A05 | A missing indexed candidate beyond catalog row 100 was not tested. | resolved | AC4.6, T002, T004, and V005 name the row-101 case and require global validity or query-time blocking. |
| A06 | Oversized searchable files could be mistaken for policy-excluded files. | resolved | AC1.5 keeps them in the universe, the coverage receipt counts them as unresolved, and named fixture coverage is required. |
| A07 | Unreadable searchable files lacked a trust outcome. | resolved | Failure Behavior and AC1.5 force partial/blocked evidence; V002 and V005 cover the named case. |
| A08 | Missing or changed files discovered during a scan lacked replay semantics. | resolved | File identity mismatch and read failure are structured unresolved evidence; replay fails explicitly rather than restarting or skipping. |
| A09 | Unsupported and policy-excluded paths were not clearly outside scope. | resolved | AC1.6 and Declared Lexical Evidence Universe define explicit exclusion classes and bounded reason counts. |
| A10 | Parser-route boundary coverage was incomplete. | resolved | T003 and V002 require zero, exact-limit, and limit-plus-one fixtures for each parser route. |
| A11 | Multi-page incoming, outgoing, and unresolved behavior was not acceptance-tested. | resolved | AC4.8, T003, and `tests/graph/reference-completeness.test.ts` require all three multi-page cases without lexical fallback. |
| A12 | Installed-package validation had vague commands and no expected version. | resolved | V010-V012 are exact commands with expected version `0.6.1`; the installed smoke contract enumerates artifacts and failure conditions. |
| A13 | Provider-labelled MCP sessions could be mistaken for real Codex/Claude plugin loading. | resolved | V010 is explicitly insufficient; V011 and V012 require real CLIs and a receipt with `real_agent_cli_executed: true`. |
| A14 | Lifecycle lint, Markdown/link, promotion, closure, and archive checks were bundled or absent. | resolved | V013-V018 and T011-T013 define separate gates and dependencies. |
| A15 | The original six tasks were too broad to execute and review safely. | resolved | `tasks.md` now has thirteen contract, fixture, parser, scanner, pagination, presentation, validation, provider-smoke, review, promotion, and closure slices. |
| A16 | Pagination correctness and focused commands were underspecified. | resolved | CP-007-CP-008 and V006 require seeded property-based concatenation/replay/order/duplicate checks; V001-V008 name stable intended test files. |

## Review Outcome

### Phase 1 Implementation Review

| ID | Finding | Disposition | Resolution evidence |
| --- | --- | --- | --- |
| P1-B01 | Coverage remained optional, so the reproduced false-complete result could omit the new receipt. | resolved | `findReferencesResultSchema` now requires either evidence-backed coverage or explicit `legacy_unverified`; current runtime emits the latter until Phase 2. Contract and reproduction tests reject omission. |
| P1-B02 | Composite cursors accepted impossible route order, offset totals, and route-incompatible continuations. | resolved | Parser cursor refinements enforce outgoing/incoming/unresolved order and offset totals; coverage refinements bind continuation kind to route; negative V001 cases pass. |
| P1-B03 | Accounting, reason categories, page/sequence classification, and language evidence allowed contradictions. | resolved | Contracts now separate policy-exclusion and unresolved-searchable reasons, carry page/sequence classified and reason counts, reconcile unique/replay attempts, and require deduplicated exact inspected-language scope. |
| P1-B04 | Boundary files existed but their oversized, unreadable, changed, missing, and policy classifications were not asserted. | resolved | `catalog-boundaries.json` and the graph fixture test lock each configured boundary and row identity while Phase 2 behavior remains explicitly todo. |
| P1-B05 | Verification still described all implementation and V001 evidence as pending. | resolved | Tasks, traceability, quality gates, validation results, requirement residuals, and the evidence log now distinguish completed Phase 1 from pending Phase 2-4 delivery. |

The Phase 1 todo markers under T003-T005 preserved the contract/reproduction
boundary and were replaced by executable assertions during Phase 2. The full
T011 review remains required before promotion.

### Phase 2 Implementation Review

Three independent reviewers covered code architecture, requirements/QA, and
security/operations. The parent review deduplicated overlapping findings and
verified each remediation with focused tests.

| ID | Finding | Disposition | Resolution evidence |
| --- | --- | --- | --- |
| P2-B01 | Metadata/read access failures could escape the coverage receipt. | resolved | `inspectFile` classifies stat and read failures, advances once, and V008 proves later safe work and exact counters. |
| P2-B02 | Policy and oversized classification could bypass the monotonic page deadline. | resolved | The deadline is checked before every catalog-entry classification; exclusion-heavy V008 coverage proves a scan cursor is returned. |
| P2-B03 | Changed or missing result-cursor files could silently resume later catalog work. | resolved | Result replay now short-circuits with structured partial/blocked evidence; V006 covers changed and deleted replay sources. |
| P2-B04 | Generic skip reasons and live workspace policy could move unsafe or failed candidates outside the wrong evidence universe. | resolved | Only explicit policy reasons are exclusions; unknown reasons are failed candidates, and a required live workspace-safety decision prevents reads of stale read-only catalog entries. |
| P2-B05 | Duplicate parser identities could consume bounded page slots. | resolved | Filtered storage CTEs rank and deduplicate canonical identities before `LIMIT/OFFSET`; storage and V002 regressions prove page composition. |
| P2-B06 | A candidate larger than the whole page byte budget could produce a non-progressing cursor. | resolved | Such a candidate is classified once as oversized and scan progress advances; V008 proves termination. |
| P2-B07 | Completeness was possible without matching snapshot-validity evidence. | resolved | Missing validity evidence downgrades the receipt and blocks verification; stale preflight and debug sweep use real validity evidence. |
| P2-B08 | Opaque cursor input had no allocation/authentication size bound. | resolved | Request/result schemas and the codec enforce a 16,384-character maximum before decode/HMAC work; V001 covers rejection. |
| P2-B09 | Blocked evidence and continuations lacked proven callable recovery. | resolved | Blocked/no-evidence returns repository-status recovery; continuation actions retain query identity and V003 invokes the presented action verbatim through the registered MCP tool. |
| P2-B10 | Parser tests did not prove intermediate limit-plus-one page states. | resolved | V002 asserts every call, row, offset, exhaustion flag, route transition, stop reason, cursor, and terminal state. |
| P2-B11 | Failed-candidate progress was not proven across continuation boundaries. | resolved | V006 table-driven cases cover missing, read failure, oversized, and changed candidates across two pages with exact page/sequence counters. |
| P2-B12 | Cursor negative coverage over-relied on bad-tag rejection. | resolved | V006 adds valid-HMAC snapshot, target, bounds, counter, and route mismatches plus changed/deleted result replay. |
| P2-B13 | Public accounting tests compared receipts without independently reconciling all fields. | resolved | V003/V006 use a real mixed scan/result sequence and assert every page and sequence accounting field against fixed expected values. |
| P2-B14 | No healthy complete query proved all twelve SessionStart occurrences. | resolved | V005 includes a 101-row healthy universe with exactly twelve lexical occurrences, complete validity, no cursor, and no truncation. |
| P2-B15 | The trust-golden gate was not sensitive to reference completeness behavior. | resolved | V004 now covers complete, parser partial, lexical partial, candidate blocked, policy excluded, stale, invalid-cursor, and expired-cursor envelopes. |

Phase 2 review blockers remaining: zero. Phase 2 is ready for its implemented
gate; this does not satisfy T011's later full work-product/promotion review.

### Final Authoring Audit

| ID | Finding | Disposition | Resolution evidence |
| --- | --- | --- | --- |
| F01 | Stateless sequence totals and result ordinals lacked cursor integrity. | resolved | Cursor Authentication And Lexical Scan State requires HMAC-SHA-256, a daemon-lifetime key epoch, tag verification before payload use, `invalid_cursor` for tampering, and `cursor_expired` after restart. AC2.7 and CP-008 require exact rejection behavior. |
| F02 | Failed searchable candidates could loop at the same `after_path` or be skipped without accounting. | resolved | AC2.8, CP-011, the lexical algorithm, and the coverage table define fully classified unresolved progress: advance once, increment classified/unresolved counters, never unique inspection or completeness. |
| F03 | Independent parser routes lacked deterministic combined-page semantics. | resolved | Graph-First Selection defines disjoint route ownership, fixed outgoing/incoming/unresolved order, one authenticated composite cursor, route draining, and all-route exhaustion. AC1.8, AC4.9, and CP-010 provide acceptance. |
| F04 | Actual bytes were described inconsistently as both post-read observation and a bounded admission dimension. | resolved | AC3.7 and File-Atomic Admission And Accounting make declared bytes the enforceable admission bound and actual bytes post-read observation; V008 tests that distinction. |
| F05 | Completed authoring checks and required final reruns shared one pending gate state. | resolved | `verification.md` now separates Completed Authoring Gates from post-implementation Quality Gates, and T011 requires a fresh review after implementation. |

### Consolidated Outcome

- Authoring blockers remaining: zero after the final audit corrections.
- Additional authoring findings remaining: zero after the final audit corrections.
- Implementation readiness authoring gates are satisfied by the clean
  post-revision lifecycle lint and the reconciled initial and final authoring
  reviews. V013 and the refreshed T011/V015 review remain final
  post-implementation gates.
- Phase 2 implementation evidence: complete for T003-T007 and V001-V006/V008.
- Installed-client, promotion, closure, and archive evidence: pending under
  T008-T013; this disposition does not close those gates.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
