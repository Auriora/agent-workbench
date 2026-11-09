---
title: Daemon CPU efficiency delivery audit
doc_type: history
status: active
owner: platform
last_reviewed: 2026-11-09
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Daemon CPU Efficiency Delivery Audit

## Scope And Readiness

This historical audit preserves Spec 072's source delivery, acceptance evidence,
review dispositions and residual ownership. Current behavior is governed by the
[documentation map](../reference/documentation-map.md) and the durable owners below.
The original source-closure evidence does not establish publication, live upgrade
or Windows execution. The separately authorized subsequent release acceptance
below records those later checks.

Evidence window: T001 baseline 84c75ef, T002-T007 delivery through c9658dd,
and the T008 documentation/closure reconciliation. Unrelated release-note drafts,
Spec 065, generated caches and live daemon state are excluded. Independent
read-only roles cover architecture, requirements/QA and lifecycle evidence, and
security/operations; reviewers inspect raw source/tests/artifacts separately.
All three independent review roles have returned; source architecture is ready
and evidence/operations accept source closure with the owned warnings below.

Source closure: complete with owned warnings. The verified final package is
removed after promotion; closure metadata records its final and cleanup commits.
At source closure, release readiness was blocked by B017's unexecuted Windows
gate. No push, publication or installed-runtime replacement was part of that
source delivery. Subsequent release and installed acceptance is recorded below.

## Requirement Dispositions And Durable Promotion

All 24 acceptance criteria are implemented and supported by the following evidence;
T008 records the independent final review and promotion rather than new runtime code.

| Requirement | Criteria | Delivered behavior and proof | Durable owner |
| --- | --- | --- | --- |
| R1 | AC1-AC5 | Bounded positive Qt admission; genuine/inconclusive TS route; actual parser counts and boundary/encoding/read-failure fixtures | [Runtime operations](../design/runtime-operations-design.md); [native/source identity tests](../../tests/workspace/qt-translation-admission.test.ts) |
| R2 | AC1-AC3 | Immutable policy-owned matchers; exact skip/order parity and invalidation; five identical scan-output pairs and bounded constructions | [Runtime operations](../design/runtime-operations-design.md); [observability](../design/observability-debugging-design.md) |
| R3 | AC1-AC4 | One sealed inventory/shape across isolates; receipt-gated seed/final publication; watcher drain; construction/recovery/migration and mutation fixtures | [Graph store](../design/graph-store-design.md); [runtime contracts](../reference/runtime-contracts.md) |
| R4 | AC1-AC3 | Node-set name/Ruby/lambda indexes; ambiguity/provenance parity; numeric continuation and atomic page rollback tests | [Graph store](../design/graph-store-design.md); [continuation fixtures](../../tests/graph/graph-build-continuation.test.ts) |
| R5 | AC1-AC5 | Explicit budgets inside unchanged deadlines/reserve; actual native parse termination and exact exit confirmation; versioned distinct counters and legacy unknown/rebuild handling | [Runtime operations](../design/runtime-operations-design.md); [contracts](../reference/runtime-contracts.md); [native setup](../runbooks/native-dependency-setup.md) |
| R6 | AC1-AC4 | Actual-worker profiling; six scenarios x five plus fixed read-only five; frozen corrections; all success gates; source and isolated installed validation; independent review/promotion | [Observability](../design/observability-debugging-design.md); [audit JSON](072-daemon-cpu-efficiency-performance-evidence.json) |

[Runtime requirements](../requirements/runtime-requirements.md#refresh-efficiency-and-evidence-v0616)
retain the accepted operating requirements. [Layered architecture](../design/layered-runtime-architecture.md)
records the ownership boundaries. [Agent-visible changes](../reference/agent-readable-changelog.md)
and native/install/plugin runbooks distinguish source/unreleased behavior from
installed releases. Complete historical requirements/design/tasks/verification
remain recoverable from the final spec commit in the closure log and archive index.

## Performance And Equivalence

The [immutable audit JSON](072-daemon-cpu-efficiency-performance-evidence.json)
contains all 65 raw baseline/candidate/read-only CPU, wall and RSS measurement
rows, per-pass phase metrics, operation counts, all 35 semantic comparisons and
runtime/build/native identities. Its bytes are unchanged by promotion:
SHA-256 f2e3e060ccf2015b5317084e0e2526aeaeca9ca49ff5faac96be0d93cae0b1cc.

The accepted baseline is 84c75ef, report SHA-256
feb75e933b610e90a6e3b4b7ae53c250c4c82dabbc79d157df5c6396ca34184c.
Primary selection was frozen before candidates: owned-suite cold complete
generation, five runs each. Supplemental read-only cold runs cannot replace it.
Independent correction oracle SHA-256 is
2d8a133b8df5fe10ff4abb021afa39c45470f5531fbbf143470ed40ca61053ce;
final passed comparison SHA-256 is
994f1e3e37aad437d206ede98c9ffb8aa5b4189f137b5d7a6d6b432fd936fa96.

| Success criterion | Result |
| --- | --- |
| SC-001 | Five equivalent scan pairs; 84.60% lower median scan CPU; matcher constructions bounded by admitted patterns |
| SC-002 | Zero positive-Qt TypeScript extractions; broad discovery only in the first pass of each unchanged complete generation |
| SC-003 | Median cold Node-process CPU 7.420853 to 3.765711 seconds (49.26% lower); wall 5.061923 to 2.986628 seconds (41.00% lower); frozen targets pass |
| SC-004 | All graph/coverage fixtures pass; five real >=60-second idle windows and five persisted reads invoke zero workers; higher RSS samples explicitly reviewed and dispositioned |

Cold CPU ranges are 5.822086-17.538489 seconds baseline and
3.704633-4.125337 seconds candidate. Wall ranges are 4.279162-12.377148 and
2.884078-3.293032 seconds. Supplemental read-only cold medians are 3.887959
seconds CPU and 2.944272 seconds wall. The audit retains every other scenario's
median/minimum/maximum and every sample, including baseline outliers.

All 35 semantic comparisons apply exactly nine independently frozen corrections:
six Qt file/node/node-FTS changes, store identity 3 to 4, versioned progress/cursor
accounting, and distinct coverage. Unexpected differences: zero. Default cold
counts are 332 files, 655 nodes, 7680 edges, two unresolved and three documents;
9341 normalized records. Edited scenarios use their predeclared mutations/counts.
All 130 V8 profiles, 130 worker receipts and 1295 exclusive phase entries were
audited; phase wall/thread CPU and generation work totals reconcile. Candidate
owned/read-only profiles number 40/10 versus 80 baseline. Default worker passes
fall four to two; scanner enumerations/entries/stat attempts/wildcard constructions
fall 20/1028/749/141622 to 6/342/332/31, with none repeated on later passes.

No acceptance repetition failed, was discarded or retried. An earlier intermittent
manifest-validation failure did not recur; its exact cause remains unknown.
T006 separately reproduced and fixed a paused profiling store-port lifetime defect,
and added retained failure roots/evidence. That is not causal attribution for the
older intermittent outcome.

### RSS Disposition

Scenario median RSS changes are +8.92%, +9.31%, +4.92%, +7.32%, +2.98% and
-0.42% for cold, reuse, idle, single edit, burst and resume. The maximum idle
sample increases 13.69%; seven ordinal-paired comparisons exceed 10%. Global
sampled maximum is 834170880 bytes candidate versus 808083456 baseline (+3.23%).

Platform and independent review accept that observed tradeoff for this bounded
synthetic fixture's SC-004 criterion. Raw values and flags remain in the JSON.
Idle/reuse RSS is a single post-semantic-capture sample, not a continuous idle
peak. Five repetitions share one parent; native/V8/SQLite allocation and GC
history are uncontrolled. Later observations decrease, but exact allocation
causes and absence of leaks are not established. B016 owns further characterization
before broader production memory claims; this does not defer a CPU/parity/idle gate.

## Executed Validation And Identity

The runtime fingerprint remains
293b5d1bbbbc18eb753fe9920dbea71d2f66ec7fbb6d6e9b33496221ee9029a4.
T008 changes documentation/evidence only. Final T006 validation on that source:

- pnpm typecheck; pnpm build-runtime; pnpm build-runtime:check;
  pnpm validate:plugin: passed.
- pnpm test --maxWorkers=2: 182 files passed; 1816 tests passed and one existing
  skip; 214.68 seconds. Earlier nonfinal failed/mixed-source runs remain recorded
  in the pre-removal verification; no successful final claim relies on them.
- Native guard/build/termination focused validation: seven files, 39 tests passed.
- node scripts/ci/installed-package-mcp-smoke.mjs: independently packed/installed
  Linux x64/Node 24.8.0 proof passed. Tarball SHA-256
  e86daf64b0c7941c40aff8e29c3d94a874519e55b34c0d61de52845442063e0c.
  Native Python parse termination preserves the host; ordinary callback error
  identity survives; missing/incompatible receipts reject before native load and
  create no daemon/refresh state. Both provider-labelled MCP sessions, completed
  baseline, stale-to-fresh replacement/new execution, deletion queries, complete
  docs ranking/pagination and all cleanup assertions pass. Labels do not prove
  actual Codex/Claude CLI plugin execution.

The core is tree-sitter 0.25.0 built by pinned node-gyp 11.5.0 with
NODE_API_SWALLOW_UNTHROWABLE_EXCEPTIONS. Candidate binding SHA-256 is
10fc56af778f8f356423d2308b1efdd64edfd905ceb800620375744270c4fcaa.
Baseline native binary hash was not recorded; identical binary provenance and
individual optimization/native-build contributions are not claimed.

T007 reproducible entrypoints are pnpm debug:refresh-scenarios (five runs,
320 Python callers) and pnpm debug:refresh-profile (five runs, max_files 2000),
using the fixed fixture revision/content identities retained in the JSON.
Raw profiles/SQLite stores and comparison drivers remain ignored local supporting
material; committed audit data is the durable historical evidence. Full original
commands, intermediate findings and checkpoint scope are recoverable in Git.

## Independent Review And Finding Dispositions

Architecture review: ready; the transaction wording warning is corrected and
independently rechecked. Evidence/QA/lifecycle and security/operations reviews
accept source closure with the following visible dispositions. No heavy
or release check is inferred from a reviewer's read-only inspection.

- Dependency wording: the original requirements prohibited extra dependencies
  while T006 added pinned node-gyp for required native termination safety.
  Technical context now explicitly justifies that one builder; no parser change,
  ambient builder or fallback is authorized.
- Evidence retention: the active package was the only committed home of detailed
  metrics, with durable links targeting it. Promote the unchanged JSON and this
  audit to history and retarget links before removal. Repository policy keeps
  docs/specs for active scaffolding; the final spec commit preserves its old tree.
- Windows obligation: T006/T007 called actual Windows execution a T008 release
  preflight. The final T008 scope disposition separates verified source closure
  from release approval and routes that unexecuted gate to platform P1 B017.
  Original R6 AC4 source/compiled/isolated-installed proof remains required and
  executed. The frozen T007 JSON's earlier T008-obligation wording is historical;
  this later disposition supersedes coordination ownership without changing data.
- Transaction wording: final-resolution edge/unresolved replacement and numeric
  cursor settlement are distinct durable operations, unlike extraction outcome/
  ordinal/counter transactions. Graph-store and runtime-requirements prose now
  matches the interruption-safe implementation and reference-resolution fixtures.
- Build-tool advisories: B015 retains the two moderate transitive build-time
  findings; this delivery does not claim audit-clean packaging.

## Residual Ownership And Release Gate

These dispositions record source-closure state. B017 subsequently passed during
the release and installed acceptance recorded below.

- B013: source delivery done after independent review, promotion and closure checks.
- [B014](../backlog/README.md#b014-assess-background-indexing-cpu-duty-cycle):
  platform P2 scheduling/duty-cycle policy; unimplemented and outside algorithmic
  fix acceptance. No CPU cap or foreground-latency guarantee is delivered.
- [B015](../backlog/README.md#b015-maintain-guarded-native-build-tool-dependencies):
  platform P2 guarded builder dependency maintenance, retaining Node 22/24/native
  safety and actual installed proof.
- [B016](../backlog/README.md#b016-characterize-refresh-profiling-rss-retention):
  platform P2 fresh/repeated-process, allocator/native guard/teardown/long-idle
  memory characterization.
- [B017](../backlog/README.md#b017-validate-guarded-windows-portable-release-payload):
  platform release maintainer P1; actual Windows2022/Node22.23.1 preflight at the
  immutable final candidate commit, with native positive/negative/termination and
  extracted portable consumer proof. Release/publication stays blocked until it
  passes. Linux fixtures or older Windows workflow runs are not substitutes.

The workload is T001's preselected fixed-Git synthetic 336-file fixture, not
FreeCAD-wide proof. Shared host and OS cache are uncontrolled. Node-process CPU
excludes separate Git subprocess CPU and out-of-interval fingerprint work;
zero worker counters do not imply zero parent I/O. No production-wide CPU/RSS
bound, live upgrade, actual provider-CLI result or Windows result is inferred.

## T008 Documentation Validation

Two focused documentation test files pass all 11 tests, including repository-wide
relative-link and frontmatter checks. The 13-document Markdown audit is complete:
209 table-readability advisories and six non-Markdown-target false positives
(TypeScript/JSON). Direct target checks and executable documentation tests pass;
the Workbench link checker only tests existing Markdown paths. Lifecycle lint
is clean; closure-check returns ready=true with no blockers and all six
requirements complete. The ready removal plan flags three backlog links because
the historical audit filename contains the spec slug; each resolves to history,
not active scaffolding. This bounded reference review accepts those warnings.
git diff --check passes. The runtime fingerprint and immutable audit JSON hash remain unchanged;
existing full/typecheck/build/plugin/isolated-installed proof stays applicable.

After removal, both documentation test files still pass all 11 tests. Direct
checks resolve all 469 local documentation targets, with no missing target or
active reference into the retired package. Active inventory excludes Spec 072;
all unchanged audit bytes remain available in history. The final five-document
closure audit reports 175 table advisories and five directly verified non-Markdown
link false positives, with no truncation. The closure helper initially appended
the owned archive row under the legacy-gap table; it was moved to Entries so the
archive validator recognizes it. Cleanup-hash resolution uses actual removal
commit a38b26a, with final verified spec tree a305310. The archive validator now
recognizes 41 removed entries and reports zero errors, warnings or informational
findings; Spec 072 is absent from active inventory.

## Closure Records

The [closure log](spec-closure-log.md) and [archive index](spec-archive-index.md)
record the final verified spec commit, removal action and actual cleanup commit.
They distinguish source closure from the release gate outstanding at closure.
This record retains the evidence needed to interpret the promoted result after active-package
removal; it does not replace the canonical behavior owners.


## Subsequent Release And Installed Acceptance

On 2026-11-09, separately authorized release and installation completed for
[v0.6.16](https://github.com/Auriora/agent-workbench/releases/tag/v0.6.16), from
immutable source `f7db3c0a70053445aed9540ef7ffa0657112617f`.
[Release CI](https://github.com/Auriora/agent-workbench/actions/runs/42579776980)
passed all four jobs: Linux package, actual Windows portable preflight, GHCR and
GitHub publication. B017 is done; B014, B015 and B016 remain accepted follow-ups.

- Linux Node 24: typecheck, compiled runtime/contracts, 28 dev CLI tests, all
  182 Vitest files (1,819 passed, one skipped), plugin/skills and package checks.
- Windows 2022/Node 22.23.1: all 18 native-safety/build-contract tests passed,
  including real parser termination, ordinary callback error identity and negative
  admission; extracted portable MCP smoke reported runtime v0.6.16.
- Published npm tarball SHA-256: `cb66e92fb4f3efda84552cd8993dc79a553b95dcfc20fc632c3cedb30c1a947c`.
- Published Windows ZIP SHA-256: `e0ca56a92c4a819200c4d4ef7f351731fbf9f29e4e6cf99611638f687705b233`.
- Windows payload SHA-256: `237ea0aca3d41fd22c087dac159b6181d2794d8fac8937ba51cf8a2b7637e665`.
- Windows native receipt SHA-256: `64ee226f99281e4cbbcc35472fa90a29ef17505d8964e16f375ea678bb8fef65`.
- Windows selected binding SHA-256: `873d1267262312683a8d36e4813512d94347094249064b24038d5a2316a578d1`.
- Windows compiled-runtime receipt SHA-256: `6622fe5e7ab0ff9918b95635ad90b579244986db940159cc5e1957a2a63fce6e`.
- GHCR `ghcr.io/auriora/agent-workbench:0.6.16` digest:
  `sha256:e0bc5cce67f014f6ae2bfd87a50fc20214cf191d4c079f36c8f9b5dd64f7d275`.

Downloaded npm and ZIP bytes matched the public GitHub asset digests before local
installation. Known runtime owners were stopped with PID/start-time checks and
SIGTERM before replacing the global Node 24.8.0 package. No live cache was deleted;
the prior schema database backup was retained. The installed package and compiled
receipt both reported v0.6.16. Installed guarded-source-build validation, a real
parser overrun termination and ordinary callback identity preservation all passed,
as did an isolated installed MCP launch. Codex and Claude plugin updates reported
v0.6.16; existing client sessions require restart to load the refreshed plugin.

The actual checkout then completed five refresh passes with no recorded worker
failure. It reported a published, fresh graph with warmup complete, activity lease
released and complete snapshot validity: 1,006 observed/checked paths, none missing
or inaccessible. This proves this checkout's installed refresh, not a general
production CPU/RSS bound or a provider's complete interactive workflow.

v0.6.15 had already been published and installed after its release gates passed.
Its actual-checkout validation revealed a distinct stable timestamp rounding
failure. v0.6.16 corrects comparison between Node numeric metadata and exact
nanosecond identity without introducing tolerance or weakening nanosecond fences.
Regression tests accept the unchanged boundary and reject real changes; independent
review found no blockers. A source production-worker profile of this checkout also
completed all five passes in 17.783 seconds using an isolated database. This is
operational correction evidence, not a replacement for the controlled Spec 072
benchmark. It does not attribute the earlier unlogged T004 manifest failure.

The earlier v0.6.13 and v0.6.14 candidate tags remain unpublished: actual Windows
CI exposed a CRLF shebang/import issue and a test-only path normalization issue.
Both were corrected at source before the successful v0.6.15/v0.6.16 release gates;
no failed tag was rewritten and no release safety check was bypassed.
