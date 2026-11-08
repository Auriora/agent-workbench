---
title: Daemon CPU efficiency requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-11-08
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Introduction

Reduce avoidable daemon indexing CPU without weakening graph evidence, freshness,
publication, cancellation or workspace safety. The user requested a fix spec after
the 2026-11-08 FreeCAD investigation; [research](research.md) preserves the measured
baseline and its limits. This is a focused EB014 follow-up, tracked as B013 in the
[backlog](../../backlog/README.md#b013-deliver-daemon-cpu-efficiency).
No implementation or performance acceptance is claimed by creating this package.

## Goals

- Classify Qt translation XML correctly, compile ignore matchers once, and avoid
  redundant repository traversal across one unchanged build generation.
- Index reference candidates, preserve useful bounded extraction progress, and
  report distinct unique coverage and repeated work.
- Prove correctness and total CPU improvement with worker-level measurements.

## Non-Goals

Parser replacements, blanket directory exclusions, timeout increases, runtime
fallbacks, competing refresh writers, public profiling tools, live cache cleanup,
release publication, or a new CPU utilisation cap. CPU duty-cycle policy is owned
by [B014](../../backlog/README.md#b014-assess-background-indexing-cpu-duty-cycle).
Closed Spec 051 and completed delivery in Specs 068/069/071 are not reopened.

## Durable Source Baseline

| Source | Current behavior relied on | Confidence |
| --- | --- | --- |
| [Runtime operations](../../design/runtime-operations-design.md) | One refresh authority; per-pass deadlines; durable extraction and resolution continuations | high |
| [Graph store](../../design/graph-store-design.md) | Generation-fenced build progress; isolated completion target; atomic publication | high |
| [Observability](../../design/observability-debugging-design.md) | Repo-local profiling harnesses and bounded private evidence | high |
| [Runtime contracts](../../reference/runtime-contracts.md) | Explicit coverage, freshness and progress vocabulary | high |
| [Layered architecture](../../design/layered-runtime-architecture.md) | Application orchestrates ports; infrastructure owns native and filesystem work | high |

## Durable Impact

T002/T003 promote verified format admission and compiled policy ownership to
runtime operations; T004 promotes inventory, publication observation and v4 migration
to runtime operations, graph-store design and runtime contracts; controlled scan guidance is promoted to observability. T008 reconciles
these existing owners after delivery: runtime operations for scan
reuse and budgets; graph-store design for manifests/counters; observability for
worker profiling; runtime contracts for any changed progress semantics. Proposed
behavior stays in this package until implemented and verified.

## Staged Readiness

Current stage: T001 baseline/design checkpoint verified: reproducible actual-worker
harness, six controlled scenarios with five repetitions, exact observations and
independent review. T002 bounded Qt admission is implemented and verified under
V002. T003 compiled ignore/priority matchers pass V003 and the controlled SC-001
scan benchmark. T004 inventory/publication/migration passes
V004 and SC-002; T005 candidate indexing passes V005; T006 budget/native settlement passes V006. Full-generation acceptance remains T007.
User purpose is established by the explicit request to put the CPU findings into
a fix spec and route residuals to backlog. Template authority is the skill
fallback: docs/templates/spec-package and docs/templates/README.md are absent.
Requirements precede design; no design-first exception. T001 reconciled the
baseline, migration decision and measurement contract before dependent work.
Architecture, data/publication and operational review are required before closure.

## Requirements

### Requirement 1: Distinguish Qt translation XML from TypeScript

**Priority:** must-have

#### Acceptance Criteria

1. WHEN a .ts file has validated Qt translation XML format evidence, THE SYSTEM
   SHALL classify it as non-TypeScript before TypeScript extraction, retaining
   truthful resource-backed or unsupported coverage through the existing policy.
2. Genuine TypeScript SHALL retain the canonical tree-sitter route, including
   source in translation-named directories and strings/comments containing XML.
3. WHERE the extension is ambiguous, detection SHALL inspect at most the first
   16,384 bytes through containment-checked reads. Positive Qt evidence requires
   a complete XML declaration or Qt TS doctype and the complete TS root start tag
   inside that prefix, under the bounded recognizer defined in D001.
4. A readable inconclusive prefix SHALL retain the established extension-based
   admission and expose unconfirmed format evidence in local characterization.
   This includes a root beyond the bound, unsupported encoding or an incomplete
   prolog/tag. Such files are outside the positive-Qt exclusion guarantee.
   Unreadable evidence SHALL use the existing structured read-failure outcome.
5. Classification SHALL NOT use directory names, search inside source strings or
   comments for XML, expand XML entities, increase the read bound, or select a
   different parser after failure. Fixtures SHALL cover the bound and both sides
   of the positive/inconclusive distinction.

### Requirement 2: Compile ignore policy once per rule set

**Priority:** must-have

#### Acceptance Criteria

1. WHEN an immutable ignore rule set is admitted, wildcard compilation SHALL
   occur at most once per distinct pattern for that set, rather than per path.
2. Matching SHALL preserve current ordering, negation, anchoring, directory,
   segment, default-skip and nested-repository behavior with equivalent results.
3. Matcher storage SHALL have a defined lifetime bound to policy identity;
   changed root/child ignore rules SHALL never reuse an obsolete matcher set.

### Requirement 3: Reuse generation-scoped catalog and shape evidence

**Priority:** must-have

#### Acceptance Criteria

1. FOR an unchanged generation, extraction continuations SHALL consume one
   generation-scoped ordered catalog and stored project-shape evidence without
   repeating whole-repository discovery or a Rails probe for every slice.
2. Before every fresh publication, including the partial seed and final completion,
   the sole controller SHALL consume a distinct generation-, target- and
   watcher-session-bound validation receipt covering the sealed manifest's admitted
   files, enumerated directories and policy/composition inputs, and drain admitted
   watcher evidence through its final observed sequence. Any observed identity or
   relevant path/policy/composition change, queued change, incomplete validation,
   watcher coverage loss/overflow or generation mismatch SHALL prevent a fresh
   publication and enter the existing explicit invalidation/failure path.
   Freshness describes the recorded validation observations and admitted-event
   boundary, not an atomic filesystem snapshot or absence of later/unobserved changes.
3. Resume after worker exit/restart SHALL preserve deterministic priority order,
   exclusive cursors, admitted submodule boundaries, unique coverage and complete
   eventual extraction. Invalid manifest evidence SHALL block/degrade explicitly.
4. Catalog construction and reuse costs SHALL be measured separately; max_files
   SHALL NOT be presented as a bound on discovery work when it only limits rows.

### Requirement 4: Index reference candidates without changing resolution

**Priority:** must-have

#### Acceptance Criteria

1. Extraction and final resolution SHALL build a name candidate index once per
   node set and reuse it for lookup and candidate counts, including unresolved
   and ambiguous references, rather than filtering every node for each name.
2. Fixtures SHALL preserve edges, confidence, provenance, ambiguity and unresolved
   rows across languages, including Ruby special forms and lambda file targets.
3. Final pages SHALL retain generation fencing, durable numeric cursors and
   atomic edge/unresolved replacement; broad special-form searches SHALL use
   purpose-built indexes or explicitly measured bounded candidate subsets.

### Requirement 5: Preserve budgets and report honest progress

**Priority:** must-have

#### Acceptance Criteria

1. Catalog preparation, extraction, resolution and settlement SHALL have explicit
   measured budget treatment; repeated scans SHALL NOT consume the extraction
   allowance before each continuation. The hard pass deadline and required
   settlement reserve SHALL NOT be extended to obtain a passing result.
2. A single long native parse SHALL remain governed by existing hard worker
   termination and structured failure evidence; no successful timeout fragment.
3. Unique eligible/admitted/extracted counts SHALL not count overlapping scan
   windows repeatedly. Repeated visits and work SHALL be separately labelled.
4. Cancellation, shutdown and supersession SHALL retain one writer, exact worker
   termination evidence, isolated targets and generation-safe publication.
5. Existing stored progress SHALL have an explicit versioned migration or
   invalidation/rebuild disposition; inflated legacy counts cannot be relabelled
   as unique totals. Unknown unique totals SHALL remain explicitly unknown.

### Requirement 6: Reproducible characterization and delivery proof

**Priority:** must-have

#### Acceptance Criteria

1. A repo-owned debug harness SHALL profile the actual refresh worker isolate
   using private output stores and read-only external source inputs. It SHALL
   record runtime/build identity, parameters, cold/warm state, phase wall/CPU
   time, RSS, paths visited, compilation counts, useful extraction and completion.
2. Before/after runs SHALL cover cold startup, persisted reuse, unchanged idle,
   single edit, burst edits, interrupted resume and final reference resolution.
   Use owned fixtures for edits and a fixed read-only large-repository revision.
3. At least five comparable runs per performance scenario SHALL report median,
   spread, total CPU per completed generation and correctness parity. Baseline
   and candidate SHALL use the same input and runtime. Coverage and graph
   comparison SHALL follow the frozen D006 comparison contract: exact equality
   for unaffected evidence and only fixture-proven Qt/counter corrections for
   affected evidence, plus an independently declared exact store-identity 3-to-4
   transition. Any other difference SHALL fail comparison.
4. SC-001 through SC-004 SHALL pass; source and compiled/isolated-installed checks,
   architecture review and durable promotion SHALL be recorded before closure.

## Correctness Properties

- CP-001: Optimisation preserves skip decisions, catalog order and workspace boundaries.
- CP-002: Positively identified Qt XML within the supported prefix never enters
  TypeScript extraction; readable inconclusive evidence and genuine TypeScript
  retain the established admission route.
- CP-003: Cursors advance committed work once; coverage counts distinct file identities.
- CP-004: Candidate indexes preserve graph semantics, including unresolved ambiguity.
- CP-005: One writer and unchanged termination/publication safety survive all failures.
- CP-006: Measurements cover the worker and a complete generation without exporting raw content.

## Technical Context

TypeScript ESM, existing tree-sitter and SQLite, supported Node/platform contract.
Keep MCP adapters thin. No extra dependency or parser is justified by this spec.

## Success Criteria

- SC-001: Rule compilation count is bounded by distinct admitted patterns, and
  a representative two-scan benchmark uses at least 50% less median CPU than
  the recorded pre-change path. This optimisation-only comparison freezes the
  classification/counter policy on both arms and requires identical scanner output.
- SC-002: Positively identified Qt XML causes zero TypeScript extractor invocations;
  inconclusive prefixes follow Requirement 1 AC4. An unchanged
  successful generation performs at most one broad catalog discovery regardless
  of extraction slices. Final identity validation visits persisted paths without
  directory enumeration and is measured separately; interrupted unsealed
  preparation invalidates its generation rather than claiming discovery complete.
- SC-003: A fixed representative large-repository full-generation benchmark
  uses at least 30% less median CPU with no more than 10% wall-time regression,
  equivalent required coverage and graph semantics under D006's explicit
  correction contract. T001 freezes the baseline/revision and permitted
  differences before optimisation; unavailable evidence blocks this gate.
- SC-004: All fixture invariants pass; unchanged settled input schedules zero
  refresh workers in a controlled 60-second window. Peak RSS is recorded and any
  growth over 10% must be explained and dispositioned before closure.

These are proposed delivery targets, not conclusions from the exploratory scan
experiment. Failure requires root-cause work or an explicit scope revision with
backlog routing, never silent weakening or a claim of full CPU-cap enforcement.
