---
title: TimeLocker dogfood follow-up requirements
doc_type: spec
status: archived
owner: platform
last_reviewed: 2026-06-05
---

# Requirements

## Closure Record

Spec 002 closed on 2026-06-05 after implementation, focused validation,
TimeLocker retest, and durable-documentation promotion. Remaining caveats were
routed to [Spec 003](../003-cross-repo-trust-discovery/requirements.md) and the
durable backlog in [MCP surface design](../../design/mcp-surface-design.md).

## Introduction

The TimeLocker dogfood evaluation showed that Agent Workbench is useful after
Spec 001 closure, especially for compact context, active-repo binding, edit
safety, startup graph warmup, and basic symbol discovery. It also showed that
daily coding workflows still feel less mature than Python Agent IDE because
first-touch status can time out, trust labels are weak, validation planning is
broad, symbol discovery is inconsistent, and reference/impact evidence is too
shallow for reliable blast-radius decisions.

This follow-up spec captures the deferred implementation work. It is based on
the TimeLocker evaluation note:

`/home/bcherrington/Projects/Auriora/TimeLocker/docs/updates/2026-06-03-095911-agent-workbench-python-agent-ide-evaluation.md`

## Goals

- Make `repo:///status` a fast, bounded health packet that never waits behind
  broad indexing or graph work.
- Promote freshness, capability, evidence strength, and intended-use labels so
  agents can calibrate trust in every result.
- Improve `verification_plan` from broad repo-level commands to nearest-test
  and direct-evidence planning.
- Improve exact Python symbol discovery and make search misses explainable.
- Improve references and impact so they are useful for bounded blast-radius
  guidance, with lexical evidence clearly labeled when used.
- Reduce noisy `next_actions` across context and graph tools to a short,
  ranked set of high-value follow-ups.
- Improve overview ranking so repository guidance and operational docs appear
  before incidental templates or project-management documents.

## Non-Goals

- Executing validation commands by default.
- Replacing Python Agent IDE in a single step.
- Treating lexical search as semantic proof.
- Adding full language-server, Pyright, Ruff, pytest, or alternate parser
  backends as hidden fallbacks.
- Exposing broad graph-report or topology-report MCP tools in this slice.
- Reopening Spec 001. Spec 001 remains archived delivery evidence.

## Glossary

- **Routing evidence**: Evidence strong enough to choose files, docs, symbols,
  or follow-up tools, but not strong enough by itself to justify an edit.
- **Edit-planning evidence**: Fresh and specific evidence strong enough to
  support a bounded code change after direct source verification where needed.
- **Nearest test**: A direct or inferred test target associated with changed
  files, requested files, symbols, imports, or naming conventions.
- **Lexical reference**: A bounded text-level identifier hit. It can improve
  recall, but must be labeled separately from parser-backed references.

## Requirements

### Requirement 1: Fast Status

**User Story:** As a coding agent, I want `repo:///status` to return quickly, so
that first-touch repository health does not block the workflow.

#### Acceptance Criteria

1. GIVEN a repository with warmup still running, WHEN `repo:///status` is read,
   THEN it returns bounded metadata with `runtime_state: refreshing` and
   pending-work caveats without timing out.
2. GIVEN a large repository, WHEN `repo:///status` is read, THEN it avoids
   broad catalog listing and reports row/time budgets in metadata.
3. IF status cannot read persisted snapshot or warmup metadata, THEN THE SYSTEM
   SHALL return a structured degraded or cold state with the missing evidence
   named.

### Requirement 2: Trust Calibration

**User Story:** As a coding agent, I want every result to explain freshness and
evidence strength, so that I know whether to use it for routing, edit planning,
or only follow-up investigation.

#### Acceptance Criteria

1. GIVEN any MVP resource or tool result, WHEN it returns data, THEN metadata
   includes freshness, capability level, evidence kinds, and verification state
   consistently.
2. WHERE evidence is useful but incomplete, THE SYSTEM SHALL label it as
   routing-only or degraded through schema-owned metadata, caveats, or
   next-action wording.
3. IF a tool mixes parser-backed and lexical evidence, THEN the result SHALL
   identify which rows came from which evidence kind.

### Requirement 3: Nearest-Test Verification Planning

**User Story:** As a coding agent, I want `verification_plan` to choose nearby
tests first, so that routine code changes do not default to the whole suite.

#### Acceptance Criteria

1. GIVEN explicit test files in `files` or `changed_files`, WHEN
   `verification_plan` runs, THEN it plans those test files before broad
   commands.
2. GIVEN a Python source file, WHEN sibling or convention-matched tests exist,
   THEN the plan includes nearest pytest targets before `python3 -m pytest`.
3. WHERE nearest-test evidence is inferred rather than direct, THE SYSTEM SHALL
   label confidence and keep broad-suite validation as a deferred fallback.

### Requirement 4: Exact Symbol Discovery

**User Story:** As a coding agent, I want exact symbol lookup to be reliable, so
that implementation classes and functions can be found without broad file
searches.

#### Acceptance Criteria

1. GIVEN TimeLocker-shaped Python classes such as `RepositoryResolver` and
   `ConfigValidationService`, WHEN `symbol_search` uses exact class names,
   THEN it returns matching parser-backed nodes when they exist in the indexed
   snapshot.
2. GIVEN no exact match, WHEN a fuzzy or FTS match exists, THEN the result
   reports why exact discovery failed and labels fallback matches clearly.
3. IF the graph snapshot is stale, refreshing, or incomplete, THEN symbol
   results SHALL include freshness and next-action guidance without implying
   complete semantic coverage.

### Requirement 5: Reference And Impact Depth

**User Story:** As a coding agent, I want reference and impact tools to show
bounded cross-file usage, so that I can estimate blast radius before editing.

#### Acceptance Criteria

1. GIVEN a parser-backed symbol, WHEN `find_references` runs, THEN it includes
   resolved parser references and unresolved candidate evidence across files
   within the budget.
2. GIVEN a symbol with lexical identifier hits but incomplete parser edges, THEN
   the tool may include lexical references only when they are labeled as
   lexical and lower confidence.
3. GIVEN `impact`, WHEN traversal cannot leave the defining file, THEN the
   result explicitly reports that blast-radius evidence is local-only and not
   sufficient for broad edit planning.

### Requirement 6: Ranked Next Actions

**User Story:** As a coding agent, I want short next-action guidance, so that
runtime output does not turn into a noisy task queue.

#### Acceptance Criteria

1. GIVEN `context_for_task`, `symbol_search`, `find_references`, or `impact`,
   WHEN next actions are returned, THEN the list is capped to the top few
   high-value follow-ups.
2. WHERE the current result is complete enough for routing, THE SYSTEM SHALL
   prefer `verification_plan` or direct source verification over generic graph
   exploration.
3. IF a follow-up requires original request payloads, THEN next-action args
   must stay compact and must not echo large source or replacement text.

### Requirement 7: Overview Ranking

**User Story:** As a coding agent, I want `repo:///overview` to prioritize
repository guidance, so that first-read docs are useful for real work.

#### Acceptance Criteria

1. GIVEN a repository with `AGENTS.md`, `README.md`, and agent guidance docs,
   WHEN `repo:///overview` ranks key docs, THEN those docs appear before
   incidental templates, archived notes, or project-management documents unless
   task evidence indicates otherwise.
2. GIVEN docs under update/history folders, WHEN overview ranks key docs, THEN
   they are downranked unless they match repository guidance or current task
   terms.
3. WHERE ranking is heuristic, THE SYSTEM SHALL keep reasons in each document
   reference concise and evidence-backed.

## Correctness Properties

- `repo:///status` remains bounded and does not perform broad source reads.
- Trust labels never claim stronger evidence than the underlying adapter
  supplied.
- Lexical evidence is never presented as parser-backed or semantic evidence.
- Nearest-test plans are ordered before broad-suite plans when direct or
  inferred test evidence exists.
- Next-action payloads never include full replacement text or large source
  content.
- Graph impact reports local-only evidence as insufficient for blast-radius
  confidence.

## Success Criteria

- TimeLocker dogfood no longer reports `repo:///status` timeout.
- `verification_plan` for representative TimeLocker Python changes includes
  direct or nearest pytest targets before the broad suite.
- `symbol_search` resolves TimeLocker-shaped implementation classes in fixture
  coverage.
- `find_references` and `impact` clearly distinguish parser-backed, lexical,
  local-only, and insufficient evidence.
- Context and graph tool `next_actions` stay compact and ranked.
