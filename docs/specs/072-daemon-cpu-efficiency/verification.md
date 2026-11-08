---
title: Daemon CPU efficiency verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-11-08
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Evidence Log

T001's profiling baseline and design checkpoint are validated in source: the
isolated production-worker harness, owned scenarios, exact observations and
comparison contract passed the final evidence gates below. T002's bounded Qt
format admission/V002 and T003 compiled matchers/V003 are also verified. T003
passes SC-001 with 84.60% lower median CPU in the controlled two-scan benchmark.
T004-T006 remain pending. Historical exploratory measurements remain in
[research](research.md). Full-generation CPU/RSS improvement and complete
Requirement 6/candidate/release acceptance remain T007/T008 obligations.

## Quality Gates

| Gate | Coverage | Required evidence | State |
| --- | --- | --- | --- |
| V001 | Requirement 6 baseline portion; CP-006 | Actual-worker harness, exact observations, six scenarios x five runs, comparator and independently reviewed design checkpoint | passed T001; candidate gates V007/V008 pending |
| V002 | Requirement 1; CP-001/CP-002 | Qt XML and real/malformed/unknown TypeScript, misleading directories/strings, BOM/whitespace, root beyond the 16,384-byte bound, long TypeScript comments, inconclusive/read-error outcomes; positive-Qt parser invocation counts | passed T002; full candidate gates V007/V008 pending |
| V003 | Requirement 2; CP-001; SC-001 | Negation/anchor/directory/segment parity, child ignore invalidation, finite matcher lifetime, distinct compilation counts and CPU benchmark | passed T003/SC-001; full candidate gates pending |
| V004 | Requirement 3; CP-001/CP-003/CP-005; SC-002 | Multi-slice single discovery, docs priority, worker exit/restart, create/delete/rename/content/ignore/config/composition invalidation, manifest migration, incomplete/sealed state, death before/during construction, at seal and before consumption, and mutations not yet admitted by watcher | pending T004 |
| V005 | Requirement 4; CP-004/CP-005 | Cross-language/Ruby/lambda graph and ambiguity parity, candidate-count scaling and final-page cursor/transaction proof | pending T005 |
| V006 | Requirement 5; CP-003/CP-005 | Budget/long-file overrun, settlement, cancellation/supersession/shutdown, unique versus visit counters and legacy unknown/rebuild behavior | pending T006 |
| V007 | Requirement 6; SC-001-SC-004; CP-006 | Comparable complete-generation five-run baseline/candidate CPU, wall, RSS, phase costs, frozen permitted Qt/counter corrections, normalized unaffected-evidence parity; source and isolated compiled acceptance | pending T007 |
| V008 | All requirements; CP-001-CP-006 | Independent architecture/data/operational review, durable promotion, backlog reconciliation, evidence/closure checks | pending T008 |

Use deterministic Vitest assertions for the correctness properties. No new
property-test library is needed. Performance timings belong in controlled harness
runs; compilation/traversal/lookup counts provide non-flaky regression assertions.

## Implementation Commands

These are planned, not executed delivery results. Extend focused paths when the
new Qt and profiling fixtures exist.

```bash
pnpm typecheck
pnpm exec vitest run tests/workspace/file-catalog-scanner.test.ts tests/workspace/path-policy-consistency.test.ts tests/graph/graph-build-continuation.test.ts tests/graph/ruby-semantic-extraction.test.ts tests/graph/reference-completeness.test.ts tests/runtime/operations.test.ts tests/architecture/layer-boundaries.test.ts
pnpm test
pnpm build-runtime
pnpm build-runtime:check
git diff --check
```

T001 documents the stable checkout harness command, parameters, profiler scope,
revision and result schema. T007 exercises the compiled production worker and
MCP convergence using an isolated store, never a live external cache. Do not
substitute query-only main-thread profiling for worker CPU evidence.

## Review and Promotion

Review the actual changes for layering, bounded classification reads, manifest
invalidation/migration, reference parity and hard-deadline/ownership preservation.
Record reviewer findings and dispositions, exact commands/results and source/build
identity. Promotion targets are the existing owners in requirements.md.

Every criterion needs complete evidence or a formally recorded scope revision and
owned follow-up. A pending required performance gate blocks closure. B014 does
not absorb incomplete measured fixes implicitly. Release/installation is separate.

## Residual Risks

Exploratory scan timings varied substantially and did not measure total generation
completion or final-resolution cost. Classification prefixes can be inconclusive;
manifest reuse can retain stale evidence without complete invalidation; candidate
indexes can increase RSS or accidentally resolve ambiguity. V001-V007 must test
these risks before any performance claim or closure. Current planning checks do
not establish implementation readiness or delivered fixes.

## MoE Review Dispositions

This section records the historical specification review before T001 began.
Final T001 acceptance is recorded under Final Validation and Review below.

The four independent reviews of commit 406e536 covered requirements/QA,
architecture/performance, operations/persistence safety and lifecycle/evidence.
All judged T001 ready with warnings; no production implementation was reviewed.
The following are specification dispositions, not implementation completion.

- W001, lifecycle context: replace unsupported task/design matrix columns with
  the lifecycle reader's recognized fields; validate T001-T008 task contexts and
  D001-D006 reverse-design lookups. Authoring validation result is recorded below.
- W002, parity versus corrections: D006 now freezes explicit expected Qt/counter
  differences and normalized semantic identities; unaffected evidence remains
  exact. T001 must produce the independent expected-difference manifest/comparator.
- W003, bounded Qt guarantee: Requirement 1/D001 fix a 16,384-byte positive-signature
  boundary, readable-inconclusive extension admission and structured read failure.
  CP-002/SC-002 apply to positive signatures only. V002 tests roots beyond the bound
  and real TypeScript with long comments. No universal Qt detection is claimed.
- W004, final freshness authority: D003 no longer claims an existing filesystem
  validation guarantee. T001 must document and review publication authority,
  evidence/drain ordering, incomplete watcher outcomes and late-mutation cases;
  it must prove compatibility with the single-discovery requirement before T004.
- W005, construction versus complete catalog: D003/T001 require explicit
  incomplete/sealed state, atomic seal/cursor/counter relationships, recovery and
  crash-boundary fixtures before T004 can consume any persisted manifest.

W004/W005 remain mandatory T001 design outputs, owned by platform and inside this
spec; they are not backlog deferrals or completed runtime protocols. All downstream
implementation stays gated until the documented decisions pass QA/architecture/
operations review. B014 remains the separate scheduling-policy question.

## Authoring Validation and Follow-Up Review

Executed on 2026-11-08 against the specification revisions after commit 406e536:

- Lifecycle package lint: zero errors, warnings or informational findings.
- Authoritative task_context for T001-T008: all eight returned no gaps and
  populated requirements, acceptance, design, verification and durable targets.
- Authoritative reverse-design traceability for D001-D006: all six returned their
  intended rows without gaps.
- Direct document checks: all seven spec documents have the required metadata;
  96 Markdown links and code-formatted document references resolve, including
  heading anchors. All eight implementation tasks remain pending.
- Markdown set check of the five revised documents: all examined, with no
  structure/link/frontmatter findings. Thirty-six plain-text table-readability
  advisories remain; long machine-readable traceability rows are retained to
  preserve the lifecycle reader contract. This is not a claim of warning-free
  Markdown quality.
- git diff --check: passed. Runtime typecheck, tests, profiling and installed
  acceptance were not run for these documentation-only revisions.

Independent focused follow-up reviewed the revised five-file diff against 406e536:
requirements/QA accepted the bounded-detection and comparison contracts;
operations accepted W004/W005 as mandatory T001 design outputs; lifecycle/evidence
independently confirmed representative task and reverse-design lookups. Its minor
missing-authoring-record observation is addressed by this section. All three
reviewers judged T001 ready to begin, with downstream implementation still gated.
No reviewer claimed delivered runtime fixes or accepted the as-yet-undesigned
freshness/sealing protocols. The remaining implementation and T001 decision
acceptance must be proved through V001-V008.

## Initial T001 Implementation Progress (Historical)

At the initial cold-only checkpoint T001 was in progress, not complete. The
following records preserve that probe's implementation/evidence and limitations;
the final continuation evidence and dispositions appear below.

- Checkout-only debug commands: pnpm debug:refresh-fixture and
  pnpm debug:refresh-profile. The harness uses the real production worker through
  SnapshotRefreshController/StartupGraphRefreshExecutor, preserving the sixty-second
  hard pass deadline. Its bootstrap profiles that worker isolate, receives a
  separate private metrics receipt and leaves public worker messages unchanged.
- Production scope is one guarded aggregate diagnostics_channel observation in
  the worker; no parser/classification, catalog, reference or budget optimisation.
  Capability-unavailable runtimes return blocked evidence; no alternate profiler.
- Source/output canonical-path isolation, private permissions, existing-output
  preservation, input/runtime drift, actual worker failure and canonical Git
  metadata safety have fixture evidence. Configured fsmonitor and inherited
  foreign GIT_DIR cannot execute/retarget the identity probe.
- The owned generator freezes 336 source files, 322 Python files and 7,680 calls;
  independent default revision/content-fingerprint constants are asserted in its
  tests. Expected Qt/TypeScript cases are independent of runtime classification.
- Architecture/operations accepted the T001 decision contract after requiring the
  publication receipt at both seed and completion. QA accepted the grammar,
  expected-difference contract and observed freshness boundary after the grammar
  explicitly admitted declaration plus optional doctype. The requested independent
  default-fixture identity assertions pass. Runtime/migration proof remains T004.
- Code review's unsafe second Git command path was removed in favour of the
  canonical metadata adapter; focused follow-up accepted that correction.

### Frozen Cold Baseline

Final measured source/runtime state, 2026-11-08:

- Node v24.8.0, Linux x64; five independent empty databases and new worker isolates.
  OS filesystem cache is uncontrolled; cold means database/isolate cold.
- Fixture Git revision: b8bf06687190d3b09280f3b37c11e914bce0577e.
- Fixture content manifest: d10935fcb3d0c1e8ca95e877c08644aec625f2a787b20d7395790b1d0f6eefd4.
- Admitted-source fingerprint: b09d1d3efe9f835a8203164311eda20992f18c472ec72d01902586105e47ef8d.
- Runtime source fingerprint: c450a05ee47116fe9fa819b21a9a8ed358fe28d6d50c3532e0ccb9552d95a145.
- Parameters: runs=5, max_files=2000, hard pass timeout=60000 ms.

| Run | Wall seconds | Worker-thread CPU seconds | Generation-process CPU seconds |
| --- | --- | --- | --- |
| 1 | 6.739039 | 4.967673 | 9.700180 |
| 2 | 5.914662 | 4.342893 | 8.507631 |
| 3 | 8.452766 | 6.408474 | 12.057767 |
| 4 | 7.464637 | 5.590341 | 10.738930 |
| 5 | 8.464926 | 6.313738 | 12.076585 |

Median wall time is 7.464637 s (range 5.914662-8.464926); median worker-thread CPU
is 5.590341 s; median generation-process CPU is 10.738930 s. Process CPU includes
controller, V8 helper threads, profiling and semantic evidence capture, but excludes
pre/post-run source/runtime fingerprinting. It can exceed wall time due to parallel
threads. Sampled process RSS median is 480,468,992 bytes (range 371,986,432-487,395,328);
it is not an exact peak or worker-isolate heap measurement.

All five runs completed four worker passes, including final resolution pages of
5,000 and 858 rows. The published graph had 332 admitted files, 657 nodes, 7,680
edges, two unresolved references and three documentation rows. All five cold runs
produced semantic digest 4399251fe2f4a950c4e3ee929a313cf267aa1e431392e48399309f16b1627f85.
This digest proves repeat stability for this fixed source instance, not the future
before/after Qt/counter-correction comparator or graph equality across regenerated
sources with different stat identities. All twenty worker profiles were written.

Local ignored evidence: .tmp/spec072-t001/fixture.json and
.tmp/spec072-t001/cold-baseline-final/report.json, per-run metrics/semantic evidence
and pass profiles. Raw output includes local paths and is not promoted. An earlier
five-run probe without the final process-CPU/Git-safety changes remains local as
cold-baseline; it is superseded by the final baseline above.

Reproduction from the owning Workbench checkout:

```bash
mkdir -m 700 -p .tmp/spec072-t001-reproduction
pnpm debug:refresh-fixture --parent .tmp/spec072-t001-reproduction
pnpm debug:refresh-profile --repo <repo_root-from-fixture-receipt> --output .tmp/spec072-t001-reproduction/cold-baseline --runs 5 --max-files 2000
```

Use the returned newly owned source path; output must not already exist. Neither
command builds/tests/installs in external source repositories. This is a mechanism
and scaling baseline, not a FreeCAD-wide performance result or CPU improvement.

### Executed Implementation Checks

- pnpm typecheck: passed after integrated harness/fixture changes.
- Focused Vitest command covering refresh-profile, refresh-baseline-fixture,
  graph-build-continuation, layer-boundaries and debug-harness: five files,
  44 tests passed in 32.40 s. Covers real-worker/public-message parity, continuation
  and resolution, safety failures, source/output isolation and fixed fixture identity.
- pnpm build-runtime and pnpm build-runtime:check: passed; compiled entrypoints
  and runtime receipt include the aggregate observation hook without adding a
  public profiling surface.
- Independent code/design/QA reviews and their corrections are recorded above;
  reviewer acceptance is bounded to actual code and the proposed design contract.

### Initial Cold-Probe Gaps (Historical)

At this checkpoint T001 remained in progress and T002-T006 were gated. The
cold-only harness had the following gaps, subsequently addressed by the complete
continuation evidence below:

- Exact filesystem-visit and wildcard-compilation counters remain unobserved;
  profile samples and aggregate progress are not substitutes for those counts.
- Progress intervals are milestone observations, not exclusive phase timings.
- Persisted reuse, controlled settled idle, single edit, burst edits and interrupted
  resume each still need a fixed owned scenario and five-run evidence. The
  controller path is exercised by the cold run, but those scenarios are not inferred.
- The full correction-aware comparator must be validated before T007's candidate
  acceptance; current semantic digests do not implement allowed-delta checking.
- Reconcile the expanded evidence against T001's acceptance and obtain final
  checkpoint review before marking the task complete or starting dependent fixes.

These were T001 baseline gaps, not B014 deferrals or permission to weaken
acceptance. Their final disposition is recorded below; candidate validation
continues through T007.


## T001 Continuation Characterization

Continuation completed the previously recorded baseline measurement gaps. Production
algorithms, parser admission and scan/resolution bounds are unchanged. Optional
pure observation callbacks count actual ignore/priority regex construction and
scanner work; the production worker accumulates numbers and publishes one private
aggregate, not one diagnostic message per path or expression. Explicit canonical
phase boundaries partition the instrumented thread interval without overlap.

The observed-thread interval begins after TSX/debug imports and ends before its
receipt/cleanup tail. Bootstrap and settlement labels refer only to observed
production-import/profiler work. Total measured generation-process CPU is separate
and includes worker startup/teardown and parent/control/V8 work. Worker-only counts
for zero-worker scenarios do not imply zero parent validator/watcher filesystem
I/O. Successful receipt validation requires phase wall/CPU totals to reconcile.

The strong comparator now retains inspectable selected-snapshot graph and
navigation evidence, including node and documentation FTS rows with multiplicity.
Only explicit generated references and observation timestamps are normalized;
free-form snapshot_id/file_id source metadata remains literal. Exact enumerated
Qt/counter corrections require an independently verified source manifest. The
planned store-identity transition requires a separate exact selected schema3-to4
correction; no arbitrary schema or field exclusion is permitted.

The owned fixture now freezes initial source atime/mtime at 2001-01-01T00:00:00Z
while preserving the original contents/Git revision. ctime is not claimed stable.
Intentional scenario edits use separately recorded deterministic changed mtimes.
Scenario sources are always newly generated owned fixtures; the mutating suite
accepts no external --repo argument. The full-run evidence below contains five successful measurements for each
of the six scenarios.


### Complete Scenario Baseline

Executed on 2026-11-08 with Node v24.8.0 on Linux x64, using runtime source
fingerprint 53a31f13d278c28e3a6d2cf26a3980ee5dc8cd391e35acc9199d5699d5358483.
Every repetition generated a new private fixture with Git revision
b8bf06687190d3b09280f3b37c11e914bce0577e and initial content fingerprint
d10935fcb3d0c1e8ca95e877c08644aec625f2a787b20d7395790b1d0f6eefd4.
Parameters: five repetitions, 320 callers/322 Python files, max_files=2000,
unchanged 60000 ms hard pass deadline and 60000 ms idle minimum; watcher
calibration is debounce=25 ms, poll=25 ms and event_budget=2000. Cold means new
store/isolate, not controlled OS cache. Scenario order is fixed and recorded.

| Scenario | Median wall s | Wall range s | Median process CPU s | Workers per repetition |
| --- | --- | --- | --- | --- |
| Cold complete generation | 5.061923 | 4.279162-12.377148 | 7.420853 | 4 |
| Persisted first-read reuse | 0.563146 | 0.507488-1.483982 | 0.591226 | 0 |
| Settled idle | 60.459723 | 60.370593-60.812962 | 1.218458 | 0 |
| Single watcher edit | 4.473116 | 4.341727-15.107945 | 6.046147 | 4 |
| Watcher burst edits | 4.616718 | 4.453773-5.781490 | 6.445047 | 4 |
| Paused committed continuation | 5.499552 | 4.640993-9.588990 | 7.325820 | 4 |

All 30 measurements completed. Each generation-producing scenario used four
actual production-worker passes, including final reference resolution. Five
real idle windows lasted 60.404, 60.499, 60.813, 60.460 and 60.371 seconds with
zero workers; all five persisted first-read checks also used zero workers.
Single/burst edits were admitted by the real watcher/queue/coordinator. The
controlled dispatch pause restored each recorded committed cursor after reopening
the parent store and produced the same graph as normal burst completion.

Each generation-producing observation recorded exactly 20 successful scanner
directory enumerations, 1,028 entries considered, 749 identity-stat attempts and
141,622 ignore/priority wildcard constructions. These are scoped worker-scanner
counts, not all filesystem syscalls. Zero-worker scenarios have no worker phase
intervals; parent validation/watch I/O remains included in process CPU. Every
worker's exclusive phase wall/thread-CPU totals reconcile with its instrumented
interval, and every run's counts sum to its receipt counts. All 80 actual profiles
exist, parse and contain real samples. Thread totals intentionally exclude loader
and receipt-tail work; process CPU is the total measured-generation acceptance
metric. It includes semantic evidence capture and can exceed wall time.

Across all five repetitions, each scenario's source fingerprint and full selected
semantic evidence remained identical. Warm/idle evidence equalled cold evidence;
paused-continuation evidence equalled burst evidence. Cold/warm/idle graphs have
332 files, 657 nodes, 7,680 edges, two unresolved references and three docs rows;
single edit adds one declaration and burst adds three more. This is input-correct
scenario variation, not a permitted comparator loss. FTS multiplicities and all
other selected evidence are included in strong comparison.

Sampled process RSS medians (bytes), in scenario order above, were 724930560,
703594496, 638820352, 699179008, 739655680 and 795820032. These include the checkout
harness and retained comparison evidence across the process's fixed scenario order;
they are not isolated-production heap measurements or exact peaks. No memory
improvement or SC-004 candidate-regression acceptance is inferred.

Local ignored evidence is .tmp/spec072-t001-completion/full-suite/report.json,
per-scenario full semantic evidence/metrics and all worker profiles. Independent
receipt/profile audits are summarized in .tmp/spec072-t001-completion/audit.json.
The previously recorded cold-only measurements remain historical probes and must
not be presented as a before/after optimisation comparison with this expanded
instrumentation. Raw outputs include local paths and are not promoted.

Reproduce from the owning checkout with a new, absent output directory:

```bash
mkdir -m 700 -p .tmp/spec072-t001-reproduction
pnpm debug:refresh-scenarios --output .tmp/spec072-t001-reproduction/full-suite --runs 5 --python-files 320
```

### Final Validation and Review

- pnpm typecheck: passed against the final frozen source.
- pnpm build-runtime and pnpm build-runtime:check: passed; the final runtime
  build receipt is valid. Lifecycle package lint returned zero errors, warnings
  or informational findings after marking T001 complete; T002 context has no gaps.
- Integrated focused Vitest: nine files, 69 tests passed in 57.42 s. Covers
  actual-worker/public-message parity, exact operation counts and phase sums,
  graph continuation, owned fixture/mtime/identity safety, actual watcher edits,
  persisted reuse, controlled continuation, complete comparator/FTS/correction
  rejection, architecture boundaries and existing debug harnesses.
- Final full suite: 30/30 complete measurements; parent audit passed all 80
  profiles, phase sums, counts, revision/source identities, semantic equality,
  five real idle windows and committed-cursor restoration.
- Independent QA repeated the complete evidence audit and accepted the T001
  baseline/design gate. Independent architecture/operations repeated profile,
  timing, count and continuation checks and accepted the same bounded gate.
- Independent code review accepted the comparator after its missing node-FTS
  capture/regressions were added. QA's no-worker timing/capture-scope finding is
  fixed; both worker and no-worker samples include complete capture/digest work.
- Observed-thread scope wording was corrected after review; schema-identity
  correction and arbitrary literal-metadata preservation are explicitly tested.

### T001 Disposition and Remaining Delivery

T001's frozen baseline, reproducible harness/scenarios, independent oracle and
comparison method, exact measurements and reviewed design exit criteria are
satisfied. At T001 completion no T002-T006 optimisation, v4 migration or
final-publication protocol had been implemented. The baseline is synthetic; it is not a FreeCAD-wide result,
daemon-startup reuse claim, worker-crash recovery proof or CPU reduction claim.

Requirement 6's optimized-candidate before/after results and SC-001-SC-004 acceptance
remain owned by T007, with promotion/closure by T008. T004 owns the actual watcher
registration/freshness/sealed-manifest/schema4 implementation and crash/migration
fixtures. The narrower exact Qt detector remains T002. B014 remains solely the
separate sustained CPU scheduling-policy question. These are explicit dependent
delivery tasks, not unresolved T001 baseline gaps or new backlog deferrals.

## T002 Qt Translation Admission

Requirement 1 AC1-AC5 and V002 pass. The shared bounded identity recognizer marks
supported positive `.ts` Qt signatures as `xml`. The existing registry has no XML
extractor, so catalog and persisted coverage remain explicitly unsupported and
no TypeScript parser is invoked. Genuine TypeScript, TSX and readable inconclusive
signatures retain existing admission. No alternate parser, timeout change,
manifest/schema migration or live installation is part of T002.

### Boundary and Routing Evidence

The new workspace and graph suites contain 42 tests. They cover BOM/whitespace,
declaration/doctype/prolog forms, mixed-case supported encoding names, quoted
attributes and supported entity spellings, malformed/repeated/reversed tokens,
invalid attributes/comments/PIs/characters, internal/external DTD rejection,
unsupported encodings, raw invalid UTF-8, root completion at byte 16,384 versus
16,385, and an incomplete multibyte body character after a complete signature.
Only the complete anchored signature is validated; later body content cannot
invalidate established positive evidence. Replacement-bearing signature text
remains conservatively inconclusive. This is format admission, not XML validation.

Tests observe exactly one read at offset zero with a 16,384-byte cap per inspected
`.ts`; `.tsx` is unprobed. They prove compute/scanner identity consistency, external
symlink refusal, valid repository-root aliases, canonical checked-target reads,
structured permission evidence, unexpected EIO propagation and descriptor close.
There is no claim of an atomic filesystem snapshot between check and open.

The graph test delegates to the real production registry and tree-sitter
extractor while counting calls: two positive Qt files make zero TypeScript calls;
five genuine/inconclusive files make exactly five. Those include TypeScript in a
translation directory, an XML string, a long block comment, TSX and beyond-bound/
malformed XML. Coverage is seven admitted, five extracted and two unsupported;
genuine declarations remain present. Selected-catalog local profiling reports
positive_qt for the two confirmed paths and unconfirmed for remaining `.ts`
admissions, including the beyond-bound fixture. No second detector/read is used.

### Complete Worker Correctness Probe

A final cold complete generation used the unchanged T001 owned fixture: 320
callers/322 Python files, revision b8bf06687190d3b09280f3b37c11e914bce0577e,
content manifest d10935fcb3d0c1e8ca95e877c08644aec625f2a787b20d7395790b1d0f6eefd4.
Runtime source fingerprint:
a2097294f22c15c78dfa0d11f94d5deb901a8e4e109637f5396612a6801d7ad6.
Four actual worker passes reached final publication/resolution and produced four
parseable sampled CPU profiles; phase totals and aggregate work counts reconcile.

Before candidate execution, an independent oracle transformed T001's complete
evidence using exactly eight predicted record changes:

- Two positive Qt file records change language to xml, node_count to zero and
  indexing_error to unsupported.
- Their two false module-node records and two corresponding node-FTS records
  disappear. No dependent edges or unresolved references existed for these nodes.
- The build counter record reduces extracted_files and nodes by two and increases
  unsupported_files by two. Graph coverage reduces indexed_files and
  extracted_files by two. This is unsupported-format accounting, not T004/T006's
  unique-counter reinterpretation.

All 9,341 resulting full semantic records matched that frozen expected evidence,
with no other differences. Files remain 332, nodes become 655, and all 7,680 edges,
two unresolved references and three documentation rows remain. Beyond-bound Qt
and genuine TypeScript evidence are unchanged. Scanner counts remain 20 directory
enumerations, 1,028 entries, 749 identity-stat attempts and 141,622 wildcard
constructions. New prefix I/O is scoped to ambiguous `.ts` files; these existing
work counters do not claim to count every filesystem syscall.

Local ignored evidence: `.tmp/spec072-t002/candidate-final/report.json`, its
complete semantic evidence and profiles; `.tmp/spec072-t002/expected-qt-changes.json`
and `expected-semantic-evidence.json` retain the pre-candidate oracle;
`.tmp/spec072-t002/audit-final.json` records the successful audit. Earlier probes
in that directory precede the final review correction and are not final evidence.
Reproduce the final candidate characterization with a new absent output path:

```bash
pnpm debug:refresh-scenarios --output .tmp/spec072-t002/reproduction --runs 1 --python-files 320 --scenario cold_complete_generation
```

This single synthetic correctness probe ran alongside tests. It establishes no
comparative CPU/wall/RSS improvement, FreeCAD-wide result or V007 acceptance.
T007 still owns the five-run comparable candidate suite and success criteria.

### Validation and Review

- pnpm typecheck: passed against final source.
- Integrated targeted Vitest: 12 files, 126 tests passed in 54.38 s. Includes both
  new suites, filesystem/scanner/path policy, scanner observations, graph
  continuation, actual-worker phases, architecture boundaries, profiler/scenarios
  and the complete semantic comparator.
- pnpm build-runtime and pnpm build-runtime:check: passed; final receipt valid.
- Lifecycle package lint: zero errors, warnings or informational findings;
  completed T002 task_context has no gaps. All seven spec documents have required
  metadata; 96 document/anchor references resolve. git diff --check passed.
- Independent review accepted the final source with no blocking findings and
  independently reran the two new suites: 42 tests passed. Findings about malformed
  signatures, encoding, byte-boundary scope, parser-count evidence, containment
  aliases and broad error handling were corrected and regression-tested.
- At T002 completion, behavior was promoted to runtime-operations-design.md and
  T003-T008 remained pending; no T002 criterion was deferred. B014 remains the
  separate sustained CPU scheduling-policy question.

Final integrated test command:

```bash
pnpm exec vitest run tests/workspace/qt-translation-admission.test.ts tests/graph/qt-translation-admission.test.ts tests/workspace/filesystem-adapters.test.ts tests/workspace/file-catalog-scanner.test.ts tests/workspace/path-policy-consistency.test.ts tests/workspace/refresh-profile-observation.test.ts tests/graph/graph-build-continuation.test.ts tests/graph/refresh-profile-phase.test.ts tests/architecture/layer-boundaries.test.ts tests/mcp/refresh-profile.test.ts tests/mcp/refresh-profile-scenarios.test.ts tests/mcp/refresh-profile-comparison.test.ts --maxWorkers=1
```

## T003 Compiled Path Matchers

Requirement 2 AC1-AC3, CP-001, V003 and SC-001 pass. Canonical policy preparation
freezes each ordered rule and its owning array, sharing a compiled wildcard test
per distinct pattern within that policy. Exact patterns retain string matching.
Both root ignore files load in their existing order as one set; workspace safety
uses the same loader. Every new root/admitted-child policy admission reloads the
current contents, including scans on the same scanner. There is no global cache,
scanner-instance cache, unprepared matching branch or alternate algorithm.

Priority ordering prepares each distinct non-`**` segment expression once per
normalized pattern set. It preserves the original escaping, no-flags RegExp and
UTF-16-code-unit question-mark behavior, with a new DP memo for each path.
Construction observations occur during preparation; directory/stat counters and
graph accounting retain their existing meaning. Catalog rediscovery and legacy
unique-counter correction remain T004/T006 work.

### Controlled Two-Scan Comparison

The unchanged repo-owned refresh-scan-benchmark.ts harness ran before production
edits and after source freeze, using Node v24.8.0 on Linux x64. Each arm creates
a fresh private deterministic fixture with 4000 callers, one unmeasured warmup
pair and five measured pairs. Each pair runs two complete broad scans with
max_files=6000, explicit shape/graph priority paths and the two production route
priority patterns. All 4012 admitted files are retained by each scan.

Fixture revision: 84cc2cf7f12db7a39226ec294cf298e6797a0d9f.
Source manifest: d69751250f69943d04725e807f6cb3257cfcf8f7fb5a3708b6cb99c507c1bf34.
Harness SHA-256: 7a5f6d3900f2e3a814cd72eb3e74281353574c06d24899fb14f3f2ad96e17597.
Pre-change runtime source: 20d39dda2ba9dcf082ca3f872fdb40159b308a35efe775846b2663836b4f1492.
Candidate runtime source: 88b9f2e8e043700460b4104049d127bda0adad47bd061b5dac1a9fb0d9a42e01.
The baseline uses the committed e287e1a production path plus this identical
harness, added before any production matcher edit. T002 classification and graph
counter policies are unchanged on both arms.

| Measurement per two-scan pair | Pre-change | Compiled candidate |
| --- | --- | --- |
| Median process CPU s | 3.338694 | 0.514173 |
| CPU range s | 3.152351-3.535450 | 0.468169-0.559605 |
| Median wall s | 3.231881 | 0.465806 |
| Wall range s | 3.130399-3.407967 | 0.455166-0.484347 |
| Expression constructions | 1299336 | 62 |
| Directory enumerations | 12 | 12 |
| Entries considered | 8044 | 8044 |
| File identity-stat attempts | 8024 | 8024 |

Median scan CPU falls 84.60%, exceeding SC-001's 50% threshold. The independent
construction oracle is two scans x (27 distinct ignore wildcards plus four
distinct non-`**` priority segments) = 62. All counts are stable across five runs.
All five corresponding full scanner output files are byte-identical, with
normalized output SHA-256
4c09042fa160b8d646e08138433c87c77551c9004ad82f56209b36acaf1d193c.
Only the generated fixture-root field is normalized; full order, cursor,
classification, identities and skip/coverage populations remain compared.

Timing includes both scans, policy preparation and counter-observer overhead.
Fixture setup, identity checks, serialization and writes are outside timing.
Filesystem cache is uncontrolled; arms run sequentially, before and after the
implementation interval. This is a representative synthetic scan result, not a
FreeCAD-wide or complete-generation CPU/RSS result. SC-003 and V007 remain pending.

### Correctness and Worker Evidence

A tracked golden preserves 500 full pre-change policy outcomes captured from
e287e1a: ten rule sets x 25 paths x file/directory variants. It includes ordered
negation, anchoring, directory/segment matching, duplicate rules, escaping,
literal question marks, default skips and normalized paths. Forty-five distinct
full outcomes are stored once and referenced by the 500 cases; no legacy matcher
implementation is shipped with the test.

Focused tests prove frozen rule/array ownership, duplicate compilation across
both ignore files, preserved old-set behavior and actual priority matches.
Wildcard invalidation changes all four root/child .gitignore/.aiignore policies
on the same scanner: old matching files become admitted and next-policy files
become excluded. Exact counts are six constructions per scan and twelve after
the second admission, including separate root/child identities with equal new
patterns. Duplicate priority patterns share four segments; astral-character
question-mark behavior retains its original semantics.

A separate default-scale complete worker probe reaches final publication in four
passes. All 9341 semantic records are byte-identical to T002's final evidence;
the strong comparator reports equal with zero differences and no correction
manifest. Files/nodes/edges/unresolved/docs remain 332/655/7680/2/3. Discovery
counts stay 20 directories, 1028 entries and 749 identity-stat attempts; actual
scanner expression constructions fall from 141622 to 120. All four CPU profiles
have real samples; phase wall/CPU totals and aggregate operation counts reconcile.
This proves worker correctness and attribution, not comparative generation speed.

### Validation, Review and Reproduction

- pnpm typecheck: passed against the frozen final production source.
- Integrated targeted Vitest: 15 files, 145 tests passed in 53.34 s, including
  matcher/scanner/workspace safety, Qt routing, architecture, graph continuation,
  actual-worker metrics, profiling scenarios, semantic comparison and benchmark
  receipt/threshold rejection. The golden test checks all 500 cases.
- The subsequent test-only wildcard-invalidation strengthening passed its focused
  matcher/golden run: two files, six tests. Production source/harness fingerprints
  remain identical to the accepted measurement.
- pnpm build-runtime and pnpm build-runtime:check: passed; runtime receipt valid.
- Independent review accepted source, lifetime/grammar preservation, golden and
  invalidation tests. It independently recalculated SC-001, checked all five raw
  output pairs and source/harness identities, then audited all 9341 worker records,
  four profiles and phase/count totals. Its final wildcard-test advisory is fixed
  and confirmed; no findings remain.
- Current policy ownership is promoted to runtime operations; controlled scan
  guidance is promoted to observability. No T003 criterion is deferred or routed
  to backlog. T004-T008 and B014 retain their existing separate obligations.
- Final lifecycle lint: zero errors, warnings or informational findings; completed
  T003 task context has no gaps. All seven spec documents have required metadata
  and all 96 document/anchor references resolve. git diff --check passes.

Final local ignored evidence is under .tmp/spec072-t003/: baseline-final/,
candidate/, scan-comparison.json, worker-candidate/ and worker-comparison.json.
The earlier baseline/ preceded receipt-validator hardening and is historical;
the accepted pair uses the identical final harness hash above. Raw output and
profiles remain private and uncommitted. Reproduce each arm on its respective
production revision using the identical harness and a new absent output path:

```bash
pnpm exec tsx src/debug/refresh-scan-benchmark.ts --output .tmp/spec072-t003/reproduction --runs 5 --python-files 4000
```

The exported compareScanBenchmarks rejects missing/invalid runs, changing inputs,
different harnesses, inconsistent summaries/counts and unequal full-output digests;
SC-001 passes only with at least five comparable runs and 50% lower median CPU.
