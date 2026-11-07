---
title: Startup recovery and refresh accounting verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-11-07
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Evidence Log

B008/B009 source implementation and isolated installed-package acceptance passed
on 2026-11-06. The separately authorized v0.6.12 publication and live installation
completed on 2026-11-07; exact evidence appears below. Version v0.6.11 was the
prior rollout baseline and does not contain these changes.

## Quality Gates

| Check | Result | Evidence |
| --- | --- | --- |
| Typecheck | passed | pnpm typecheck; /tmp/awb071-typecheck-final.log |
| Focused implementation | 101 passed | /tmp/awb071-focused-final.log |
| Daemon launch | 74 passed | /tmp/awb071-launch-final.log |
| Source entrypoint recovery | passed | /tmp/awb071-entrypoint-recovery.log |
| Full source regression | 150 files; 1575 passed; 1 installed-only skip; 244.59s | /tmp/awb071-full-source-final.log |
| Post-review helper/protocol checks | 21 passed | /tmp/awb071-final-protocol-tests.log |
| Runtime build and receipt | passed | /tmp/awb071-build-final.log |
| Plugin/contracts | passed | /tmp/awb071-plugin-final.log; /tmp/awb071-contracts-final.log |
| Ordinary isolated npm/native smoke | passed; all cleanup receipts true | /tmp/awb071-installed-smoke-final.log |
| Actual installed entrypoint | 25 passed; no skip; 64.47s | /tmp/awb071-installed-entrypoint-tests.log |
| Package payload | dry-run passed; compiled helper included | /tmp/awb071-pack-dry-run-final.log |
| Linux foreign PID namespace | live parent owner retained; helper77; silent | /tmp/awb071-foreign-namespace.json |

The final full source run covers the frozen runtime implementation and all
post-review tests, including malformed/oversized stdin, unknown-process evidence
and preservation of explicit foreign-scope canonical successors. The 21-test
focused run is an additional helper/protocol checkpoint.
Planned checks are not substituted for these executed results.

## Reproducible commands

```bash
pnpm typecheck
pnpm exec vitest run tests/infrastructure/runtime/startup-guard-recovery.test.ts tests/infrastructure/runtime/startup-guard-recovery-client.test.ts tests/infrastructure/runtime/daemon-shutdown.test.ts tests/runtime/operations.test.ts tests/architecture/stdio-bridge-import-boundary.test.ts tests/mcp/runtime-build-contract.test.ts --maxWorkers=1
pnpm exec vitest run tests/mcp/daemon-launch.test.ts --maxWorkers=1
pnpm test --maxWorkers=1
pnpm build-runtime
pnpm build-runtime:check
pnpm validate:plugin
pnpm check:contracts
pnpm pack:dry-run
node scripts/ci/installed-package-mcp-smoke.mjs
```

Installed acceptance runs tests/mcp/daemon-entrypoint-integration.test.ts with
AGENT_WORKBENCH_TEST_INSTALLED_ENTRYPOINT pointing to the isolated npm bin and
AGENT_WORKBENCH_TEST_INSTALLED_VARIANT_ENTRYPOINT to the copied receipt-whitespace
variant. /tmp/awb071-installed-state.json records that fixture's exact package,
helper and entrypoint paths, hashes, explicit native rebuilds and pointer check.

## Acceptance matrix

Requirement 1 is delivered by T001 and verified by V001; Requirement 2 is
delivered by T002 and verified by V002. Requirement 3 and integration of both
changes are delivered by T003 and verified by V003. See traceability.md for the
design and canonical-context mapping.

| ID | Acceptance | State |
| --- | --- | --- |
| V001 | Exact dead guard; live/unknown/legacy/foreign scope; reusable mutex; two helpers; busy; corruption/symlink/sidecar/replacement; helper crash before/after unlink; older claimant in the gap | passed |
| V002 | Reentrant running/deadline cancellation zero; synchronous throw and ordinary call one; diagnostic revision | passed |
| V003 | Source/build/isolated install; native-free boundary; expert review; durable promotion and backlog disposition | passed |

## Installed artifact identity

Development tarball SHA-256:
d89149352d8b187cce64e72c2c893ed56765ba0df8a7a7729142539937568836.
Runtime receipt SHA-256:
20f3ba700d659dcd33afa4f58dab5ae3ecacc95eb4e2cafb86167e190831ae05.
The compiled helper was present and rejected an invalid strict request with77
and empty stdout/stderr. All 25 installed entrypoint cases passed, including a
real original guard-owner process killed in an isolated fixture and subsequent
startup through the compiled helper. Same-version handoff uses a copy differing
only in receipt whitespace. Provider-labelled MCP sessions do not prove loading
in a real agent application.

The retained fixture suppresses parent postinstall solely to preserve the host
runtime pointer, explicitly rebuilds approved native dependencies, and verifies
a clean npm dependency tree. Separate ordinary npm/postinstall smoke uses an
isolated HOME and proves six native grammar routes, SQLite, daemon/query
convergence and full cleanup. Both use ordinary peer resolution. Host runtime
pointer stayed unchanged. This is not a live installation or publication claim.

## Native isolation and kernel evidence

Static import-boundary tests prove the bridge cannot reach helper/native SQLite
modules. The child accepts at most 8192 input bytes, validates one strict request,
loads native code only after parsing and reports bounded exit statuses. Process
fixtures verify native rebuild-hint preservation, malformed/oversized input,
empty stdout/stderr and exact cleanup outcomes.

Real child fixtures exercise two recoverers and death before/after unlink while
holding SQLite exclusion. A deterministic occupied transaction returns busy;
two sequential distinct dead guards prove the permanent database does not pin
one prior claim. Replacement and an older hard-link publisher in the post-helper
gap are preserved. Bigint identities are represented as decimal strings.

A real unshare --user --map-root-user --pid --fork probe ran the compiled helper
in a different PID namespace while its original parent guard owner was alive.
The foreign scope differed and kill(pid,0) reported ESRCH there; helper77 retained
the exact guard, created no exclusion database and emitted no output. This is
Linux evidence on this host, not a universal capability or platform-CI claim.

## Expert review and dispositions

Independent correctness/architecture and security/operations reviewers inspected
actual code, fixtures and scope boundaries. No blocking code/security findings
remain. Review-required corrections were implemented and tested: native process
isolation, namespace-qualified death, reusable mutex markers, exact DB identity,
private sidecars, no first-guard ledger, root package inclusion, compiled helper
invocation, pre/post acquisition deadline fences, missing-canonical continuation,
native-hint/EPIPE ordering, unknown-process preservation and explicit foreign
canonical-scope fencing. Both independent reviewers cleared the final scope
delta; its post-helper gap fixture preserves exact successor bytes.

Native SQLite in the bridge was rejected. Loopback socket exclusion was rejected
because network namespaces need not coincide with shared filesystem authority.
The accepted narrow helper only deletes its caller-observed exact dead guard;
its response never grants canonical ownership.

Residual review hardening: a real paused-helper mid-abort fixture remains B011.
The existing coordinator/client cancellation fixtures and static fences cover
late-result safety; no absence of a real-process test is represented as one.
B010 owns verifiable non-Linux kernel scope. Reliable SQLite/POSIX filesystem
locking is an explicit operations/runbook prerequisite.

## Retained validation checkpoints

Initial authoring used fallback skill templates; plan fingerprint was revalidated
before exclusive071 directory creation. Duplicate historical prefix034 is an
unrelated allocation advisory. Direct canonical owners were read; no concrete
imported-authority risk requires a separate canonical-context artifact.

The first ordinary installed smoke failed at sessions_init: fresh status remained
cold/needed; cleanup completed. Static inspection found both bridge processes
were spawned before the intended zero-delay owner was established, allowing the
second client's 60-second delay to win startup. The harness now creates that
second process only after the first baseline is fresh. The corrected full smoke
passed, without timeout extension, retries or product fallback. The exact winner's
configuration was not retained by the failed checkpoint; this is the bounded
root-cause inference and the sequencing defect directly repaired.

An intermediate typecheck caught the test adapter's generic better-sqlite3
constructor mismatch after unknown-state coverage was added. Its test boundary
uses the same explicit constructor adaptation as the helper main. Final typecheck
passed. No native API or runtime behavior was bypassed by that test-only change.

## Durable promotion

Existing runtime operations, runtime contracts, threat model and install runbook
describe delivered source, retained storage and installed-release limits. B008
and B009 are delivered in v0.6.12; B010/B011 remain owned follow-ups. The untracked
Spec065 package is unchanged. Spec071 remains active pending a separate closure
record; no archive or implementation-commit reference is invented.

## Residual Risks

Legacy, foreign or unavailable kernel process scope remains ambiguous. Linux
boot/PID-namespace proof enables recovery of new claims; non-Linux recovery proof
is B010. Explicit foreign/unavailable canonical scope also blocks stale cleanup;
scope-absent canonical and daemon metadata policy remains Spec065. This does not
claim complete cross-PID-namespace daemon ownership support.
The underlying filesystem must provide reliable SQLite/POSIX locking.
Private authority storage must be retained while owners may be active; arbitrary
malicious same-user namespace replacement is outside this boundary. No production
cache cleanup was performed. The later authorized release/install is recorded below.

## v0.6.12 publication and installation

Implementation commit: cb037b1e377442d750751758a4a3e72bb908962b.
Release commit/tag: 662263ecaced6ffc8c842d508db9763bbde462bd, v0.6.12.
[Release workflow 42354547531](https://github.com/Auriora/agent-workbench/actions/runs/42354547531)
passed package, Windows portable preflight/consumer, GHCR and public-release jobs.
CI source regression passed 150 files, 1575 tests and one installed-only skip.
[GitHub release v0.6.12](https://github.com/Auriora/agent-workbench/releases/tag/v0.6.12)
was published at 2026-11-07T08:22:28Z. The previous public release was v0.6.11
at 2026-11-06T19:16:39Z.

The downloaded public auriora-agent-workbench-0.6.12.tgz SHA-256 matches GitHub's
asset digest: a452f344642be89fd89a36b2dc377a98558aa71fdc27712c712bf0453f0bb60c.
Ordinary npm global installation with CXXFLAGS=-std=c++20 completed without
peer bypass. Compiled bridge, daemon, recovery helper and runtime receipt bytes
match the public tarball. Installed receipt SHA-256:
b6f16e087e5137fcb76e7f3abebdfc5c0ae80155e5469e2bd6904d6e669bef97.
The runtime-root pointer names the global v0.6.12 package; Codex reports
agent-workbench@agent-workbench-local v0.6.12 installed/enabled, with its cache
under ~/.codex/plugins/cache/agent-workbench-local/agent-workbench/0.6.12.
The supported hook installer merged the package hooks.

All 25 configured-entrypoint cases passed against this actual global installation
in 50.29s, including compiled recovery and a temporary receipt-whitespace variant.
The variant was removed after validation. Six native parser routes and SQLite
loaded successfully. These are real installed MCP sessions, not proof that an
already-running Codex session has rediscovered the plugin; sessions must restart.

Additional global npm ls checks returned ELSPROBLEMS for the two direct-URL
grammar dependencies. This global install has no lockfile or retained resolved
URL metadata; npm Arborist dep-valid.js requires child.resolved to equal the
requested remote URL. Correct versions/peer ranges and all 27 Ruby/43 TypeScript
archive members were verified against the sealed published grammar payloads,
and native load/parse passed. This is not recorded as a clean global npm tree;
B012 owns diagnosis/reproduction and supported remediation of that diagnostic.
No metadata edit, forced peer resolution or runtime fallback was introduced.
The earlier clean isolated npm tree remains a distinct acceptance checkpoint.

Detailed receipts are /tmp/awb-v0.6.12-release-api.json,
/tmp/awb-v0.6.12-live-install-state.json, /tmp/awb-v0.6.12-plugin-state.json,
/tmp/awb-v0.6.12-live-installed-tests.log, /tmp/awb-v0.6.12-live-native.log and
/tmp/awb-v0.6.12-native-provenance.json. Core identities/results are retained here
because temporary files are not durable evidence storage.

## Documentation checks

Lifecycle structural lint passed with one non-blocking canonical-context advisory;
authority wording was reviewed against direct durable owners. Markdown checks
covered the changed docs/spec and returned table-readability advisories only.
Direct checks of frontmatter and local link targets passed for all ten changed
documents. git diff --check passed. No broad formatting rewrite of existing long
tables is included.
