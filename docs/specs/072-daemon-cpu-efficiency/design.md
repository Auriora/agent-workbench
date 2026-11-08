---
title: Daemon CPU efficiency design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-11-08
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Design

## Overview

Fix admitted file format and repeated algorithmic work inside the existing
refresh pipeline. Preserve its single executor, durable completion and atomic
publication. T001 baseline/design, T002 bounded Qt admission and T003 compiled
matchers are verified. T003 passes the controlled SC-001 scan gate. T004-T006
remain pending; full-generation comparative acceptance remains T007.

## Requirement Coverage

| Requirement | Criteria | Design | Tasks | Validation |
| --- | --- | --- | --- | --- |
| Requirement 1 | AC1-AC5 | D001 | T002 | V002 mixed .ts fixtures |
| Requirement 2 | AC1-AC3 | D002 | T003 | V003 matcher parity and compilation counts |
| Requirement 3 | AC1-AC4 | D003 | T004 | V004 generation and restart cases |
| Requirement 4 | AC1-AC3 | D004 | T005 | V005 graph parity and scaling |
| Requirement 5 | AC1-AC5 | D003; D005 | T004; T006 | V006 counters, deadlines and shutdown |
| Requirement 6 | AC1-AC4 | D006 | T001; T007; T008 | V001; V007; V008 |

## High-Level Design

Application orchestration owns the build sequence and candidate-index lifecycle.
Filesystem infrastructure owns bounded classification reads and catalog discovery;
SQLite infrastructure owns generation-scoped persistence and migrations. Contracts
and ports expose shared data; the worker composes adapters. Profiling remains in
src/debug with explicit worker instrumentation, outside public MCP tool surfaces.

## Low-Level Design

### D001: Explicit Qt translation admission

Use one bounded admission policy for ambiguous .ts files, before extraction.
Read at most 16,384 bytes from offset zero through containment-checked I/O.
The supported positive signature is UTF-8/ASCII XML with an optional UTF-8 BOM,
XML whitespace, a complete XML declaration optionally followed by one Qt TS
doctype, or one declaration-free Qt TS doctype, with complete prolog comments/
processing instructions between allowed tokens, and the complete case-sensitive TS root
start tag. Root/tag matching must be anchored to this prolog, not a substring in
TypeScript source, strings or comments. Do not expand entities, resolve external
identifiers or add an XML parser dependency. T001 freezes recognizer grammar and
boundary fixtures before T002; no FreeCAD path or directory heuristic is permitted.

A complete positive signature routes to existing resource-backed extraction only
where supported, otherwise explicit unsupported evidence. A readable incomplete,
malformed or unsupported prefix is inconclusive, retains the existing extension
admission, and is labelled unconfirmed in local profiling evidence. A Qt root past
the bound may consequently retain TypeScript admission: the exclusion guarantee
applies only to positive evidence inside the supported bound. Genuine TypeScript,
including long leading comments, retains its canonical parser. Read failures keep
the existing structured failure outcome. This is one pre-extraction admission
rule, not a parser-failure fallback or an alternate parser. Carry the classification
consistently through identity, registry resolution and coverage; test both outcomes.

T002 implements this route as language `xml`, using existing unsupported coverage
because no XML extractor is registered. The shared identity recognizer validates
the signature only through the complete root start tag: later body content or a
UTF-8 character split by the read bound cannot invalidate positive evidence.
Signature validation preserves exactly one optional BOM, case-sensitive tokens,
XML whitespace, quoted/unique attributes and supported entity-reference spellings
without expansion. XML versions 1.0/1.1 and case-insensitive UTF-8/ASCII encoding
names are recognized; ASCII declarations require ASCII signature content after
the optional BOM. Unsupported constructs, replacement-bearing signature text and
non-ASCII attribute/PI names remain inconclusive. No XML document validation or
semantic support is claimed. Scanner reads use the canonical containment-checked
target; ordinary check/open workspace limits remain. Local profiling labels the
selected catalog's `.ts` admissions as positive_qt or unconfirmed without reading
sources again. V002 proves actual parser invocation counts and bounded reads.

### D002: Compiled rule set

Prepare exact/wildcard matchers once when root or child-local ignore policy is
loaded; preserve ordered rules and last-match negation. Give the compiled set
policy-scoped ownership, not an unbounded process-global string cache. The
exploratory Map is proof of cost, not production design. Preserve pattern semantics
and discarded-set release on invalidation. The exact profiling counter includes
both ignore-policy and scanner priority-glob expressions: T003 must also prepare
priority matchers once per immutable ordering-pattern set, so those comparisons
do not retain a separate per-path compilation bottleneck. Preserve identical
priority semantics. T003 implements this scope and passes V003/SC-001.

The canonical parser produces frozen readonly rule sets with a private prepared
matcher on each frozen rule. Raw shapes stay private; classification has one
prepared-rule execution path. Preparation copies rule flags and deduplicates
wildcards by pattern within the set, while retaining each ordered rule's own
negation/directory/anchor behavior. Both root ignore files are prepared together
in their existing order. The shared filesystem loader is also used by workspace
safety. Each scanner admission reloads root/admitted-child contents, creating new
sets; no global or scanner-instance policy cache exists. Old retained sets remain
immutable and retain their old behavior until discarded.

Priority preparation shares each distinct non-`**` segment expression within one
normalized ordering-pattern set. Exact non-glob patterns retain string matching;
glob segments preserve their original escaping and no-flags RegExp behavior.
Each path comparison gets a fresh DP memo, preserving `**` recursion and UTF-16
code-unit `?` semantics. Retention is bounded by the current policy's distinct
patterns and the current ordering set's distinct segments. Construction observers
run at preparation; the obsolete per-path construction route is removed.

The unchanged owned two-scan harness records full output and comparable five-run
CPU distributions before/after. The 4000-caller fixture passes SC-001 with 84.60%
less median scan CPU and byte-identical output. A separate complete-worker probe
preserves all T002 semantic evidence exactly. See verification.md for identities,
limits and independent review; these results do not establish SC-003/V007.

### D003: Durable catalog manifest and shape

Store the ordered admitted paths, identities, priority-order inputs and shape
receipt for a build generation, fenced by controller/invalidation generation,
policy/config identity and composition fingerprint. Reuse the same manifest across
short-lived workers instead of moving repeated discovery to another worker phase.
Derive separate source/docs views without losing independent docs priority coverage.
Use existing catalog rows where sufficient; add schema only for missing build-only
metadata. T001 records the exact ownership/schema and migration decision before
T004. Public queries remain published-only; a manifest never grants freshness.

Generation equality establishes only that the controller has not yet observed a
newer invalidation. It does not prove the live workspace matches the manifest;
this design does not assume an existing final filesystem-validation protocol.
Before T004, T001 must define the final validation authority, evidence inputs,
publication linearization point, and serialization with watcher drain and generation
checks. The decision must cover events queued but not admitted, overflow, disabled
or unavailable watchers, content identity changes, new/deleted/renamed paths,
ignore/config changes and repository composition. Validation that is incomplete
or cannot establish the stated boundary must yield structured stale/degraded or
blocked evidence, not a fresh claim based solely on generation equality.

T001 must demonstrate that this protocol and the single broad-discovery target
can both hold; any extra discovery or validation work is measured explicitly.
If they cannot, T001 remains incomplete until an explicit requirement revision is
reviewed. Tests mutate the workspace during discovery and just before publication,
including changes not yet observed by the trigger. Missing or mismatched manifest
evidence follows the sole controller's explicit invalidation/rebuild path, never
a hidden broad-scan fallback in every continuation.

Manifest construction must distinguish incomplete preparation from a sealed,
consumable inventory. T001 defines ownership, completeness evidence and an atomic
seal tied to generation/policy/ordering identity, together with cursor/counter
transactions. Consumers must reject incomplete, missing or mismatched evidence;
no persisted prefix can prove traversal exhaustion. The checkpoint must specify
whether interrupted preparation can resume from durable discovery state or must
explicitly invalidate the incomplete generation and rebuild through the same
authority. Neither automatic retries nor reuse of an unsealed prefix is permitted.
V004 covers death before first write, during construction, at the seal boundary,
and after seal before first consumption, as well as subsequent worker restart.

### D004: Candidate indexes

Build name buckets once per extraction batch node set or final resolution page's
node universe. Reuse the exact candidate pool for selection and count. Add indexed
qualified names, paths, Ruby form metadata and lambda file targets where existing
rules require them. Resolve against the same authoritative node set and apply the
existing filters; never resolve an ambiguous bucket by first match. Scope indexes
to the worker/slice initially; measure complete-node loading and memory before
considering further persisted/query changes. No second semantic implementation.

### D005: Budget and accounting

Separate catalog preparation measurements from extraction's cooperative allowance,
retain the hard controller deadline and reserve necessary for resolution/write
settlement, and avoid promises of interrupting synchronous native parsing inside
a file. T006 derives the feasible allocation from measured settlement costs within
the existing hard limit. A phase that cannot fit fails explicitly. Unique counters
come from committed admitted identities or catalog state; repeated visits use
separate work counters. Define additive contract/schema changes and legacy counter
invalidation explicitly; do not infer unique totals from old cumulative windows.

### D006: Worker evidence

Create a checkout-only refresh profiling harness with one production execution
path, isolated output database and worker-isolate CPU capture. Distinguish active
core utilisation, total CPU and background duty cycle. Record phase costs and
counter definitions, profile start/stop scope, native-frame limits, source revision,
Node version and compiled source parity. Store raw outputs in ignored local
artifacts; promote sanitized summaries and stable fixture commands into verification.
No raw path/source/error export to product analytics, no external source mutation,
and no daemon restart or kernel policy change is needed by the harness.

Freeze a comparison contract in T001 before either optimisation or benchmark
selection. Use the following rules for all before/after evidence:

- Optimisation-only matcher comparisons hold classification and accounting policy
  constant, or use inputs unaffected by those corrections; full scanner output
  must match exactly, including identities, ordering, cursors and skip evidence.
- End-to-end comparison normalizes only generated snapshot/file/node identifiers
  and observation timestamps through a documented stable semantic-key mapping.
  Compare unaffected files' language, classification, coverage, declarations,
  references, edges, confidence, provenance and ambiguity exactly after mapping.
- Enumerate positive-Qt files using an independent expected fixture manifest.
  Only those files may change from TypeScript evidence to the specified
  resource/unsupported outcome, including removal of false parser module nodes
  and their dependent references/edges. List and validate each affected item;
  unrelated files or references cannot be ignored wholesale.
- For the planned store identity migration, require a separate explicit correction
  declaration with exact selected-snapshot schema_version before=3 and after=4.
  Bind it to the independently verified source manifest and exact before/after
  snapshot records; it permits no other field, schema transition or blanket
  schema exclusion. New v4 evidence fields require deliberate T004 capture/tests,
  not accidental normalization by the v3 comparator.
- For progress corrections, independently derive distinct identity totals from
  the fixed input manifest. Only the documented repeated-work-to-unique counter
  changes are allowed; record visits/work separately. Do not use old inflated
  counters as the expected truth or normalize away real coverage losses.

Publish the allowed-difference manifest and comparator rules with V001/V007.
Any unlisted difference fails comparison and requires investigation, not a wider
exclusion. No final acceptance may preserve false TypeScript evidence just to
match the defective baseline.

## T001 Design Decisions

These concrete decisions passed independent QA/architecture/operations checkpoint
review; acceptance is recorded in verification.md. None is a claim that T004's
runtime protocol exists.

### Observation Boundary and Publication Authority

Requirement 3 AC2 is explicitly clarified during T001: the mutable workspace and
fs.watch do not supply an atomic snapshot or complete ordered change journal.
The existing watcher enumerates directories before registering their watches;
its poll drains callbacks already received. An observed generation is therefore
not proof of every concurrent filesystem change. The revised claim is bounded to
a generation/session-bound identity validation and admitted-event observation
boundary; later/unobserved mutation and filesystem identity/timestamp aliasing
remain limitations. This is a reviewed scope clarification, not a hidden guarantee.

The single broad discovery and final validation serve different purposes:

1. The daemon owns one watch session/epoch across its sequential workers. Arm
   each admitted directory before its single readdir, using a worker-to-daemon
   registration acknowledgement; root is armed before initial discovery. Record
   pre/post bigint device/inode/mtimeNs/ctimeNs and directory kind/containment.
   Registration failure, an identity change during enumeration or coverage loss
   invalidates that generation. Do not run a separate watcher tree discovery.
2. Discovery persists included file identities and enumerated directory identities,
   including the owning repository and inputs that determine policy, composition,
   priorities and shape. A newly included directory or relevant membership event
   invalidates the sealed generation; it does not append silently to its inventory.
3. Before every fresh publication (partial seed and final completion), require a
   sealed manifest and a distinct target-bound receipt. The validation adapter
   checks every persisted
   admitted file and directory, plus policy/composition identity inputs. Use
   containment, kind and bigint dev/ino/size/mtimeNs/ctimeNs as applicable; changed
   or unavailable evidence invalidates or degrades. Validation must not readdir
   directories or silently rediscover the tree. Count its reads/time separately.
4. Validation and forced non-debounced watcher draining occur outside the
   controller mutation lock: watcherBatch re-enters the controller and holding
   that lock while draining would deadlock. Capture immutable start/end session
   sequences, health and generation in the private validation receipt. Missing,
   disabled, overflowed or restarted watcher coverage prevents a fresh receipt;
   no attempt to emulate an event journal with a timeout or polling fallback.
5. Re-enter the controller mutation authority. Recheck receipt manifest identity,
   session epoch/health/live sequence, requested generation and shutdown fence.
   Bind each receipt to its publication kind and target; never reuse a seed
   receipt for the completion target. Consume it once and enter synchronous SQLite publication
   without an await, observer callback or yielded event-loop gap between the final
   observation check and transaction. The publication linearization point is the
   SQLite commit; the separately recorded validation boundary is not that instant.
   A queued/newly admitted event supersedes the target through the existing
   authority. No concurrent writer, in-lock watcher callback or failure retry.

The application owns the validation protocol/receipt port, filesystem adapters own
identity reads/watch registration, and the controller owns publication admission.
The receipt carries manifest/owner/controller/invalidation/session/target identities,
publication kind,
start/end observations, inspected counts, validation-policy version and complete
or structured failure outcome. Keep this private evidence out of product analytics.
Apply the same admission gate to both controller publication branches. Tests
mutate source at seed publication and final completion separately and prove events
during discovery, after individual identity reads and
before transaction entry cannot be silently discarded as observed evidence. They
must also assert the explicit unobserved-mutation limit rather than simulate an
unavailable atomic-snapshot guarantee.

### Manifest Schema and Sealing

Use independent generation-level inventory, not only snapshot files rows: existing
files rows contain already admitted snapshot paths, not all remaining ordered
source, directory identities or preparation completeness. The v4 design is:

- graph_build_manifests: manifest_id primary key; repo/config/owner identities;
  controller/invalidation generation; generation-source hash; policy, composition
  and ordering versions/fingerprints; preparing/sealed/invalid state; watcher
  epoch; discovered/eligible counts; manifest digest; start/seal timestamps.
  Unique key on repo identity plus controller/invalidation generation.
- graph_build_manifest_files: foreign key manifest_id; ordinal; relative path;
  repository key; language/classification evidence; bigint device/inode/size and
  nanosecond mtime/ctime serialized losslessly; docs eligibility; nullable content
  hash; pending/extracted/resource/unsupported outcome. Primary key on manifest
  and path; unique manifest/ordinal. Unassigned ordinals are NULL only while
  preparing; consumers require sealed state and contiguous final ordinals.
- graph_build_manifest_directories: primary key manifest/path; repository key;
  kind/device/inode/nanosecond identities; watch-registration state. Contains only
  discovery observations, never a claim that fs.watch is a complete journal.
- graph_build_progress: manifest foreign key, ordinal cursor, counters_version=2.
  Keep published seed and isolated completion target linked to the same manifest
  in the existing seed-clone transaction; do not duplicate inventory per slice.

Preparing rows remain private/nonconsumable. After complete enumeration and the
existing deterministic priority/path ordering, a single IMMEDIATE transaction
rechecks owner, generations, session and policy; verifies unique paths, contiguous
ordinals, counts and digest; seals the manifest and initializes progress/counters.
No persisted prefix may prove extraction exhaustion. Each subsequent file outcome
transaction writes graph evidence, the first pending-to-terminal state transition,
ordinal cursor and distinct counters atomically. Re-examining a committed identity
cannot increment unique counts. Eligible total is the sealed source universe;
admitted/extracted totals are distinct terminal outcomes. Visits/work are separate.

Crash/recovery dispositions are fixed before T004:

- Before first write or during preparation: exact-owner recovery marks any
  preparing inventory invalid and fails that execution. A later explicit admission
  builds a new generation. No automatic retry or partial-discovery resume.
- At sealing: transaction rollback leaves preparing state; commit exposes complete
  sealed inventory and initialized progress together, never one without the other.
- After seal/before first consumption and between later slices: same-owner/session
  continuation validates identity/session fences and resumes the committed cursor.
  A new daemon/watch epoch cannot silently resume old capture; it invalidates the
  old generation under established ownership/recovery authority.
- During file commit, seed clone or publication: SQLite atomicity and existing
  generation/owner fencing preserve the previous committed cursor and target.

Tests require deterministic barriers at all these boundaries, including failure
on digest/ordinal/count mismatch, watcher registration loss and legacy progress.

### Store Identity and Legacy Counters

Advance graph-store identity/schema to v4 in T004, with canonical graph-v4.sqlite.
Do not add unique-counter semantics inside v3: an older writer could update the old
fields while leaving an additive counters-version marker, silently corrupting the
interpretation. No v3 progress, coverage or snapshots are cloned into v4; v4 starts
as an empty derived store and the ordinary coordinated build creates its evidence.

Migration is owned by the existing version-independent repository refresh lease,
acquired before retiring prior storage. Require quiesced prior handles or positively
established owner death and a nonbusy WAL checkpoint. Otherwise block and preserve
all storage. Retain a fsynced, verified v3 rollback artifact; atomically install a
canonical v3 retirement blocker so an old binary cannot create a divergent writable
cache. Build/validate/fsync a temporary empty v4 and atomically claim its canonical
path using the established versioned-store publication discipline. Conflicting
backup/guard/target evidence blocks; never delete or overwrite a live cache.

T004 must explicitly replace the current v2/legacy seed selection for this identity
transition, add retained-v3 retirement/re-entry tests, and test crashes between each
backup/blocker/v4 claim. Re-entry under the same lease validates completed artifacts
and advances the one migration protocol; it is not a fallback implementation.
Rollback requires all owners stopped and restoration of a known complete retained
v3, or recoverable quarantine/rebuild of the entire derived cache by the older
runtime. No in-place downgrade. Legacy inflated counters stay historical; unique
coverage is unknown until the v4 coordinated build commits distinct identities.

### Bounded Qt Grammar and Independent Fixture Oracle

Freeze a byte-oriented prolog recognizer under the existing 16,384-byte bound:
optional UTF-8 BOM and XML whitespace, then either a complete case-sensitive XML
declaration followed by an optional single literal Qt TS doctype, or one doctype
without a declaration. Allow complete prolog comments/processing instructions
between tokens and before the complete case-sensitive TS root start tag; preserve
quoted attribute boundaries. A declaration, if present, precedes the doctype;
neither token can repeat. At least one declaration/doctype token is required.
Require valid UTF-8/ASCII for this supported signature. Do not scan arbitrary
source substrings or expand entities/external/internal DTD subsets. An incomplete,
malformed, unsupported-encoding or beyond-bound signature is inconclusive and
retains established extension admission; unreadable input is a structured failure.

The owned fixture generator freezes two positive paths (standard XML and prolog),
one root-beyond-bound inconclusive path and two genuine TypeScript paths (XML
string and long leading comment). Expected classification comes from fixture
construction, independently of the runtime detector. T002 must add exact-bound,
BOM/whitespace, quotes, malformed declaration/tag, doctype, processing instruction,
unsupported encoding, symlink escape and read-error cases before implementation.
T001 does not introduce classification code or turn the fixture oracle into one.

### Baseline and Comparison Contract

Use src/debug/fixtures/refresh-baseline-fixture.ts to construct a new private,
immutable-input Git repository. Default scale is 336 files, 322 Python files and
7,680 cross-slice calls, plus Qt/TypeScript/ignore/docs/CMake cases. The fixed Git
revision is b8bf06687190d3b09280f3b37c11e914bce0577e; content manifest SHA-256 is
d10935fcb3d0c1e8ca95e877c08644aec625f2a787b20d7395790b1d0f6eefd4.
This is a synthetic mechanism/scaling baseline, not FreeCAD-wide performance proof.

The independent expected-difference manifest lists only the two positive Qt paths
for format correction and the unique-counter reinterpretation. The beyond-bound Qt
path is deliberately unchanged. Stable comparison keys are file relative path and
repository key; node kind/language/qualified name/source range; and references/edges
by those source/target keys plus kind/range/provenance/confidence/metadata. Normalize
only generated storage/snapshot identities and observation timestamps. Enumerate
false positive-Qt parser nodes and their dependent edges explicitly before removal;
all unaffected evidence, including ambiguous/unresolved cases, must remain equal.
An unlisted difference fails. T003's matcher-only comparison holds this admission
and accounting policy constant. T007 proves the full candidate result against this
contract; a digest of a handful of totals is not graph equivalence evidence.

Actual worker-isolate profiler output separates its observed thread CPU/wall
interval, whole measured generation-process CPU and sampled process RSS. Exact
scanner counters describe successful readdir operations, entries considered,
file-identity stat attempts and actual ignore/priority RegExp construction.
They are not inferred from profile samples and do not count every OS syscall.
Exclusive production phase boundaries partition the observed thread interval;
bootstrap/profiler settlement labels exclude pre-observation TSX/debug imports
and the final receipt/cleanup tail. Whole-process generation CPU separately
captures controller/worker startup, execution, V8/profiler and evidence overhead.
Milestone intervals remain distinct and sampled RSS is not an exact high-water mark.

The owned scenario suite runs five repetitions in fixed order: cold generation,
persisted first-read validation/reuse (not daemon startup reuse), real sixty-second
settled idle with zero workers, real watcher-triggered single edit, burst edits,
and a controlled same-session dispatch pause after a worker commits a partial
cursor and exits. The pause closes/reopens the parent store before accepting that
result; it is not worker-crash recovery. Every mutable source is newly generated
inside a private owned output root; no external mutable repo option exists.
Watcher calibration and deterministic edited bytes/mtimes are frozen in report
identity. Strong selected-snapshot semantic evidence, including node/doc FTS
multiplicity, is compared across independent repetitions. Full suite evidence must
pass before T001 is marked complete; no optimisation or future v4 proof follows
merely from passing this baseline.

## Migration and Compatibility

Existing schema/version and graph-build contracts stay authoritative. Any new
manifest/counter fields require an explicit schema migration or safe generation
invalidation/rebuild before use, respecting rollback policy and active ownership.
No deleting or replacing an active live cache. Coordinate additive diagnostics with
Spec 071's actual executor invocation counter, and preserve Specs 068/069 shutdown
and admission. No unrelated endpoint or install changes.

## Correctness Property Coverage

| Property | Design behavior | Verification |
| --- | --- | --- |
| CP-001 | D002 ordered matchers; D003 fenced manifest | V003; V004 |
| CP-002 | D001 positive format admission | V002 |
| CP-003 | D003 committed cursor; D005 distinct counters | V004; V006 |
| CP-004 | D004 same pools and ambiguity rules | V005 |
| CP-005 | Existing controller authority retained by D003/D005 | V004; V006; V008 |
| CP-006 | D006 actual worker and isolated stores | V001; V007 |

## Slice Boundary And Residual Architecture

| Target | In this slice | Out of this slice | Follow-up | Blocks closure? |
| --- | --- | --- | --- | --- |
| Observed wasted CPU | Requirements 1-6 | None of the measured fixes intentionally deferred | B013 promoted to this package | yes |
| Sustained resource policy | Measure utilisation and duty cycle | New throttling, priority or scheduling policy | B014, platform | no |
| Rollout | Compiled isolated acceptance | Publish/install live replacement | Separate user-authorized release work | no |

## Validation Strategy

Use conventional Vitest tests and deterministic operation-count assertions; no new
property-test dependency. Verification V001-V008 maps fixtures, profiling and
promotion to every requirement. Review architecture, manifest/storage invalidation,
parser routing, measurement validity and shutdown before closure. T001 resolves
schema/counter and discriminator details before dependent tasks; passing lint is
not permission to skip that readiness checkpoint.

## Operational Considerations

Roll out only after the isolated compiled gate. Treat schema/manifest changes as
owned derived-cache migrations, preserving current publication and rollback rules.
Inspect worker CPU, complete-generation cost, RSS and foreground request latency;
raw measurements remain local and do not become analytics payloads. This package
does not authorize installation, daemon termination or live cache replacement.

## Open Questions

T001 settled and independently reviewed the manifest schema, incomplete/sealed
construction and recovery protocol, final freshness-validation authority, legacy
counter migration, Qt recognizer grammar and comparison contract under T001 Design
Decisions above. Downstream tasks must implement and verify those decisions; the
design checkpoint does not establish delivered runtime protocols. The 16,384-byte
bound and inconclusive admission policy are fixed by Requirement 1; a different
policy requires an explicit spec revision. Scheduling policy remains owned by
B014 and does not block algorithmic fixes.

## Related Artifacts

[Requirements](requirements.md), [tasks](tasks.md), [research](research.md),
[traceability](traceability.md), [verification](verification.md).
