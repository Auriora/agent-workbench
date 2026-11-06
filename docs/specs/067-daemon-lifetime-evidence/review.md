---
title: Daemon lifetime evidence expert review
doc_type: spec
artifact_type: review
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Work-product review

Outcome: source review ready. Final full-suite evidence is recorded separately
in verification.md; this review makes no installed or release-readiness claim.

## Scope and roles

Independent read-only requirements/QA and security/operations reviewers inspected
Spec 067, changed contracts/ports/storage/process hooks/daemon/health code, focused
tests and durable promotion. A separate code reviewer checked the handoff design.
Evidence windows were task-owned unstaged edits and new Spec 067/source/test files.
Untracked Spec 065 and release drafts/evidence were excluded. Root AGENTS.md and
the review-work-products skill governed the review. Reviewers used raw source,
not each other's conclusions; the indexed snapshot was not treated as impact proof.

## Resolved findings

| Finding | Correction | Evidence |
| --- | --- | --- |
| Read-check-rename handoff race | Dedicated nonblocking evidence lock covers reread through replacement | src/infrastructure/runtime/daemon-lifetime-evidence.ts:270; tests/infrastructure/daemon-lifetime-evidence.test.ts:94 |
| Replacement lock could be reclaimed using stale death evidence | Carry exact dead-owner inode/device/token through cleanup checks | tests/infrastructure/daemon-lifetime-evidence.test.ts:114; src/infrastructure/runtime/daemon-lifetime-evidence.ts:311 |
| Refresh diagnostics failure hid independent lifetime evidence | Typed top-level daemon_lifetime_evidence survives the degraded response | tests/mcp/daemon-lifetime-health.test.ts:57 |
| Inconsistent lifecycle facts could pass validation | Canonical phase/reason/code/signal invariants reject corruption | src/contracts/daemon-lifetime-contracts.ts:66; tests/infrastructure/daemon-lifetime-evidence.test.ts:135 |
| Exit/fatal contention coverage missing | Observe both events under a held live lock; receipt bytes stay unchanged | tests/infrastructure/daemon-lifetime-evidence.test.ts:94 |
| Admission test overstated pending-client proof | Rename to the admission/health assertions actually exercised | tests/mcp/daemon-launch.test.ts:51 |

The parent also corrected draft permission traversal and constructor-path wiring
before runtime validation: existing ancestors are preserved, and lifetime storage
cannot replace endpoint metadata. Ancestor-mode and admission tests cover these.

## Final dispositions and limits

QA confirmed no remaining findings after the focused regressions and accurate
test naming. Security/operations confirmed no supported blocker or warning against
the frozen source. These were static reviews; reviewers did not independently run
full tests, installation acceptance or CI. Parent command evidence is separate.

Unknown prior-owner loss remains distinct from unavailable storage. Uncatchable
or pre-ready termination, failed filesystem writes, Windows ACL privacy and
installed-runtime acceptance are documented limits. B002 and B006 remain owned
follow-up work; this review does not diagnose the original incident.
