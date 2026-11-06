---
title: Daemon admission budget review
doc_type: spec
artifact_type: review
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Review

## Scope and evidence

Independent SDK analysis, bounded implementation agents, and security/correctness
review inspected actual source, contracts and fixtures rather than inferring
completion from task markers. The 108-test focused suite and typecheck passed; the final full suite passed
145 files/1526 tests with one installed-only skip. Package/build checks passed;
verification.md records commands, earlier failures and acceptance limits.

## Findings and disposition

- Core constructor-installed initialize/ping and schema/unknown-method responses
  did not enter application wrappers. Fixed unclaimed response/cancel release;
  real SDK fixtures cover these terminal paths.
- Request admission originally omitted control leases from its session quota.
  Fixed combined accounting, with mixed-control/request boundary fixtures.
- Cancellation can arrive during listener registration or after handler completion
  before the SDK response decision. Fixed immediate post-registration abort
  check, terminal listener lifetime and network cancellation tracking. Deferred
  SDK and injected abort-race fixtures prove no early work release.
- Socket close does not settle detached SDK application handlers. Added budget
  quiescence to daemon close_clients under Spec 068's existing deadline. A real
  delayed-tool fixture proves blocked/resources/deadline, retained canonical
  draining, rejected successor and no late cleanup after settlement.
- Response serialization could fail before the pending-send settlement callback
  was registered, leaving an outstanding request. Parent review moved that failure
  through the same settlement path and added a circular-response fixture.
- Fixed transient TypeScript errors in test signals/closure ID narrowing without
  weakening assertions. Final typecheck result is recorded in verification.md.

## Review status

Security review has no unresolved source blocker after cancellation and shutdown
quiescence corrections. Independent senior correctness review has no source blocker. Its completion
metadata finding is resolved by final evidence, traceability and B006 disposition.
The contract-barrel export consistency suggestion was applied before final checks. No installed-runtime or release readiness is claimed.

## Explicit limits

Queued socket output is bounded, but serialization occurs before that check and
can transiently allocate. Malformed-frame input is not a CPU rate limiter. Wire
bytes do not bound total heap/RSS. Current SDK builtin controls are synchronous;
future async notification handlers require actual settlement accounting. These
are declared design boundaries, not successful exhaustion-test claims.
