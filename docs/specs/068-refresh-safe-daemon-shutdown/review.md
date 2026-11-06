---
title: Refresh-safe daemon shutdown expert review
doc_type: spec
artifact_type: review
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Work-product review

Outcome: no unresolved source correctness or security blocker. Installed acceptance
passed 23/23 cases. The final source suite passed 142 files and 1491 tests, with its installed-only
case executed separately. Full evidence is recorded in verification.md;
this report does not claim installed-host or release acceptance.

## Scope and independent roles

Task-owned worktree changes based on 84ea8ca: controller/ownership, shutdown
coordinator, daemon/client lifecycle, canonical contracts, lifetime adapter,
focused and child tests, Spec 068, backlog and promoted durable owners. Untracked
Spec 065 and release drafts/evidence were excluded. Root AGENTS.md and the
review-work-products skill governed the read-only reviews.

Independent code reviewers inspected controller races and the D002 lifecycle
invariants. Requirements/QA reviewed spec acceptance and traceability.
Security/operations reviewed ownership, failure fencing, privacy, reclamation
and installed/source claims. Reviewers used raw files; stale Workbench indexing
was not accepted as graph-impact proof. Validation commands were executed by
implementation workers and the parent, separately from static review.

## Findings and disposition

| Finding | Disposition and evidence |
| --- | --- |
| Initial/replacement allocation resumed after shutdown | Post-await fences; deferred allocation and replacement regressions in tests/runtime/operations.test.ts |
| Running transition exposed a pre-registration launch window | Cancellation registration and final pre-run fence; reentrant shutdown test proves no executor call |
| Delayed termination stayed quarantined after confirmation | Distinct termination/publication quarantine and one post-confirmation settlement; delayed termination regression |
| Existing pending termination was not awaited | Capture and reuse the exact pending termination promise; no duplicate request regression |
| Termination promise history accumulated | Confirmed entries are retired; unresolved failure prevents further admission |
| Missing startup exclusion suppressed cancellation | Cancellation request precedes cleanup authorization; tests/infrastructure/runtime/daemon-shutdown.test.ts |
| Stale startup reclamation could remove a replacement | Serialized private guard, bounded identity checks and safe loser path; tests/mcp/daemon-launch.test.ts |
| Live or disappearing lock contention looked ambiguous | Known live/absence progress returns no authority and uses the original bounded wait; deterministic launcher regressions |
| Test double manufactured builds during ID allocation | Fixture now creates builds on executor invocation; unneeded discard workaround removed; src/ports/index.ts documents the split |
| Installed handoff probed a closed endpoint still marked ready | D002 adds exact-owner canonical draining before socket closure; both concurrent installed successors remain required |
| Probe recheck decisions lacked deterministic coverage | tests/mcp/daemon-draining-client.test.ts:138, :166 and :195 prove failed/successful proof progress never signals, while unchanged ready remains ambiguous |
| Spec promotion initially allowed compiled-only acceptance | Requirement 4 retains an isolated installed-package gate; all 23 installed cases passed without skips |

D002 source review checks classification and canonical proof at
src/mcp/daemon-client.ts:179 and :775, exact publication at :1203, and no-await
shutdown ordering at src/infrastructure/runtime/daemon-shutdown.ts:67. These
locators are review evidence; stable task references remain T001-T003.

## Final dispositions and limits

The final controller rereview closed all four correctness blockers. Security
accepted the guarded authority path and known-contention classification without
adding authority, retries or recovery. D002 correctness/security review found no
source blocker; the final code review closed the deterministic probe-test warning.
The installed 23/23 result includes the actual two-successor convergence case.

B006 retains aggregate admission budgets. B007 retains npm peer-resolution
acceptance: the pnpm-installed gate does not prove npm installation. B008 owns
safe abandoned reclaim-guard recovery; current unknown/dead guards block. B009
owns the diagnostic invocation counter boundary; exact executor identities and
real child barriers provide current worker-safety proof.

The second installed payload is an explicitly synthetic same-version build
variant: a copy of the installed package with a whitespace-only build-receipt
change and the installed dependency tree. It proves distinct-fingerprint handoff,
not compatibility with every historical launcher. The host runtime was not the
installation target. Reviewers did not independently execute the complete source
suite, installation acceptance or external CI; parent evidence remains separate.
