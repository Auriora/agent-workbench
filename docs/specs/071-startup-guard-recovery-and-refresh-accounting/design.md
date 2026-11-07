---
title: Startup recovery and refresh accounting design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Design

## Overview

Recover only scope-qualified exact dead guards in an isolated process, retaining
one canonical hard-link election and the native-free stdio bridge. Count actual
executor invocations at their call boundary.

## High-Level Design

Parent startup owns election/deadlines; the fixed child helper owns filesystem
mutex/proof/dead-guard unlink; controller infrastructure owns invocation counts.
A child response is recovery evidence and never grants startup ownership.

## Low-Level Design

### D001: Filesystem-scoped recovery in an isolated process

Accepted after independent review. Keep the native-free stdio bridge boundary.
Only exact dead-guard deletion uses a short exclusive SQLite transaction in a
separately spawned helper process. The existing better-sqlite3 dependency stays
inside that process; the parent never imports its module or graph code. Add a
specific compiled helper entrypoint to build/receipt/package acceptance, using
the existing dev-wrapper/compiled-entrypoint convention without a runtime fallback.

The caller records the bounded original guard's device/inode as decimal strings
from bigint stat, PID, timestamp, token and owner scope. The helper validates
private metadata/exclusion storage, enters BEGIN EXCLUSIVE with timeout0,
re-reads exactly that guard and proves same-scope positive death immediately
before unlink. A missing guard is already_recovered; a different guard remains
ambiguous, never retargeted. All dead-guard deletions share this permanent mutex.
Normal guard creation/release retains atomic hard-link exclusion: a parent cannot
replace the original guard before unlink; after unlink, competing parents can
publish only one guard. A second helper cannot delete a successor from its old
request. The helper grants no ownership; the parent makes exactly one normal
hard-link guard/election attempt in a named continuation, without recursion.

A helper crash leaves either the original guard or absence and releases its
SQLite kernel lock. The database pathname is retained permanently. Validate a
private owner-only directory, regular non-symlink owner-only database, stable
bigint device/inode and safe journal sidecars. Corrupt, replaced, nonregular or
otherwise unverifiable storage blocks and is preserved. Namespace authority is
repo-filesystem scoped; UDP/TCP locking is rejected because host/container
network namespaces can diverge while sharing those files.

#### Process scope and migration

PID absence alone cannot prove a legacy guard's owner dead across PID namespaces.
New claims record a private Linux scope fingerprint over the kernel boot UUID
and /proc/self/ns/pid identity. Matching scope plus ESRCH permits recovery.
Missing legacy, foreign or unavailable scope remains ambiguous. macOS/Windows
retain conservative guard handling until equivalent verifiable scope evidence
is governed (B010); ordinary fresh launch is unaffected. This is an explicit
kernel-evidence boundary, not a hostname guess or alternate recovery path.
Canonical startup claims with explicit foreign or unavailable scope are also
preserved before each PID probe and before stale unlink, including a successor
published in the post-helper gap. Scope-absent canonical claims retain their
established policy; broader canonical-owner/endpoint migration remains Spec065.

#### Parent protocol and deadlines

Send one bounded strict request over stdin to a fixed process.execPath/entrypoint
with no shell. The helper emits no raw stdout/stderr; fixed exit codes classify
recovered, already_recovered, busy, ambiguous and native_module_rebuild_required.
Malformed/abnormal exit cannot grant permission. Abort/deadline causes the parent
to ignore late results and prevents its continuation; no process is killed for
a timeout. Late helper completion can only delete the original verified dead
guard, never create or remove canonical ownership. Parent deadlines stay fixed.
Shutdown still fences admission, requests controller cancellation, publishes
draining and closes sockets synchronously before awaiting exclusion. Its existing
monotonic deadline covers asynchronous acquisition and fences late work.

The private metadata directory is trusted against arbitrary same-user mutation;
cooperating claimants honor atomic publication and retained mutex storage.
Removing/replacing private authority storage while owners may be active is
unsupported and never a cleanup authorization. Tests must prove child crash,
two-helper serialization, replacement races and an older claimant winning the
post-unlink election gap.

### D002: Invocation count

Move the increment from the running transition to the actual executor.run call
boundary. Preserve cancellation checks after synchronous lifecycle/deadline hooks.
Update diagnostic revision without allowing observer reentrancy to cancel between
a final check and the actual call. A synchronous executor throw is still one
invocation; failure before invocation is zero. Counts are diagnostic evidence,
not worker-termination or publication authority.

## Operational Considerations

### Boundaries and durable promotion

- runtime-operations-design owns recovery protocol and supported storage assumptions.
- runtime-contracts owns busy/ambiguous meaning and actual invocation diagnostics.
- threat-model owns deletion/identity and retained private-storage boundaries.
- install runbook owns supported operational recovery limits.
- backlog records B008/B009 delivery; Spec065 remains separate and unmodified.

## Validation

Deterministic filesystem/process barrier fixtures plus real child-process crash
and contention cases; controller reentrancy/deadline/synchronous-throw fixtures.
Run typecheck, targeted tests, architecture checks, full source suite, runtime
build/receipt and isolated installed-entrypoint acceptance. Installed or source
success does not claim publication or a live-version upgrade.

## Review

D001 review rejected direct native loading and socket namespace locking, then
accepted the narrow filesystem helper and scope-proof boundary. Final
security/operations review must inspect actual code and race fixtures. No open
scope decision requires changing Spec065 or the installed runtime.

## Primary references

- [SQLite locking](https://www.sqlite.org/lockingv3.html) and
  [transaction control](https://www.sqlite.org/lang_transaction.html) describe
  the filesystem lock and EXCLUSIVE/SQLITE_BUSY basis; process fixtures are
  still required for this implementation's actual lifetime behavior.
- [Node datagram bind options](https://github.com/nodejs/node/blob/v22.x/doc/api/dgram.md)
  define exclusive as cluster handle policy. Socket exclusion was rejected for
  this filesystem authority domain, rather than adopted as a fallback.

## Open Questions

No blocking decision remains for the Linux scope-qualified path. B010 retains
non-Linux kernel-scope evidence. Broader canonical-owner/PID namespace policy and
endpoint relocation remain Spec065; this slice claims no delivery for them.
