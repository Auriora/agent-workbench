---
title: Doc currency routing requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-07-02
---

# Requirements

## Introduction

Agents can re-implement old requirements when documentation search and task
context surface historical, archived, superseded, or draft material without
enough trust metadata. Agent Workbench already exposes document authority
labels for several docs surfaces, but the model is still coarse and is not
applied consistently across task context, docs search, overview, map, and
agent-facing next actions.

This spec turns EB018 into an implementation package for documentation currency
routing. The goal is to preserve historical discoverability while making
current implementation authority explicit for the task at hand.

## Durable Source Baseline

- [Documentation map](../../reference/documentation-map.md)
- [MCP surface design](../../design/mcp-surface-design.md)
- [Graph store design](../../design/graph-store-design.md)
- [Runtime contracts](../../reference/runtime-contracts.md)
- [Lifecycle bridge contract](../../reference/lifecycle-bridge-contract.md)
- [Agent Workbench executable backlog](../../requirements/agent-workbench-executable-backlog.md), EB018
- `src/domain/policies/document-authority.ts`
- `src/application/use-cases/query-docs.ts`
- `src/application/use-cases/get-task-context.ts`
- `src/infrastructure/sqlite/graph-store.ts`
- `src/domain/models/graph.ts`

## Goals

- Route implementation prompts toward current canonical or supporting durable
  docs by default.
- Keep historical, archived, legacy, superseded, and closure-breadcrumb docs
  discoverable with explicit caveats.
- Use frontmatter and lifecycle metadata as input signals without making
  frontmatter itself the source of truth.
- Use file modified time and optional Git file history as corroborating recency
  evidence where available.
- Provide a task-focused way for agents to verify which docs are current before
  implementation work.
- Feed lifecycle-rule gaps back to spec-lifecycle-manager without duplicating
  that plugin's lifecycle authority inside Agent Workbench.

## Non-Goals

- Do not use filesystem `ctime` as a creation or currency signal.
- Do not rely on filesystem birth time for current behavior.
- Do not hide historical documents from explicit historical queries.
- Do not make Agent Workbench decide active-spec completion, spec closure, or
  durable promotion status. Those remain spec-lifecycle-manager concerns.
- Do not require network access or remote Git hosting metadata.
- Do not make broad generated architecture answers part of this spec.

## Requirements

### Requirement 1: Task-Focused Document Currency

**User Story:** As a coding agent, I want to know which docs are current for my
task, so that I do not implement superseded requirements.

#### Acceptance Criteria

1. GIVEN a task prompt, WHEN Agent Workbench selects governing docs, THEN THE
   SYSTEM SHALL prefer current canonical and supporting docs over historical,
   archived, legacy, superseded, template, sample, or unknown docs.
2. WHEN a selected doc is not canonical, THEN THE SYSTEM SHALL return a
   currency caveat explaining whether it is draft, historical, archived,
   legacy, superseded, sample, template, or unknown.
3. IF no current canonical doc is found for the task, THEN THE SYSTEM SHALL
   return an explicit unknown or corroboration-needed state rather than
   treating the best text match as authoritative.

### Requirement 2: Frontmatter And Path Signals Are Inputs

**User Story:** As a maintainer, I want metadata to improve routing without
making every Markdown file a policy engine, so that documentation remains
readable and lifecycle rules stay in the right tool.

#### Acceptance Criteria

1. WHERE frontmatter contains `status`, `doc_type`, `last_reviewed`,
   `superseded_by`, `canonical_owner`, or `authority`, THE SYSTEM SHALL treat
   those values as document-currency input signals.
2. WHERE path or title contains signals such as `history`, `archive`, `legacy`,
   `deprecated`, `obsolete`, `superseded`, `retired`, `closure`, or
   `delivery record`, THE SYSTEM SHALL use those signals when frontmatter is
   absent or incomplete.
3. IF frontmatter conflicts with stronger repository evidence such as the
   documentation map, active lifecycle context, source contracts, or accepted
   durable docs, THEN THE SYSTEM SHALL surface the conflict as a trust caveat
   instead of silently accepting frontmatter.

### Requirement 3: Recency Evidence Uses Reliable Sources

**User Story:** As a maintainer, I want recency checks to use evidence that
means what it says, so that stale-doc warnings are not based on misleading file
metadata.

#### Acceptance Criteria

1. WHERE file metadata is available, THE SYSTEM SHALL use `mtime_ms` only as a
   modified-time signal.
2. THE SYSTEM SHALL NOT use filesystem `ctime` as a creation-time or
   document-currency signal.
3. WHERE Git is available and the file is tracked, THE SYSTEM MAY collect
   first-introduced commit, latest commit touching the file, and latest commit
   date as optional recency evidence.
4. IF Git history is unavailable, shallow, expensive, or the file is untracked,
   THEN THE SYSTEM SHALL return missing Git recency evidence explicitly and
   continue with other currency signals.

### Requirement 4: Historical Discoverability Is Preserved

**User Story:** As an agent investigating history, I want archived material to
remain discoverable, so that I can understand why current behavior exists.

#### Acceptance Criteria

1. GIVEN an explicitly historical query, WHEN matching archived or legacy docs
   exist, THEN THE SYSTEM SHALL return them with non-authoritative caveats.
2. GIVEN an implementation-oriented query, WHEN historical docs match strongly,
   THEN THE SYSTEM SHALL downrank or separate them unless the caller opts into
   non-authoritative results.
3. WHEN a non-authoritative result has `superseded_by` or a documentation-map
   owner, THEN THE SYSTEM SHALL include a next action toward the current source.

### Requirement 5: Agent Guidance Or Prompt Surface

**User Story:** As a coding agent, I want a small verification workflow for doc
currency, so that I can check authority before starting a task.

#### Acceptance Criteria

1. THE SYSTEM SHALL provide either a packaged skill/prompt or an MCP surface
   that asks: "Which docs are current for this task?"
2. WHEN invoked, the workflow SHALL inspect task text, supplied files, scoped
   docs, documentation-map owners, frontmatter input signals, file `mtime_ms`,
   and optional Git recency evidence.
3. WHEN the workflow cannot prove currency, THEN it SHALL return an explicit
   uncertainty state and next actions rather than best-guess authority.

### Requirement 6: Lifecycle Feedback Boundary

**User Story:** As a spec-lifecycle-manager user, I want lifecycle-specific
rules to live in that plugin, so that Workbench routing does not duplicate spec
closure or promotion policy.

#### Acceptance Criteria

1. WHERE stale-doc rules affect active specs, closure, promotion, archive
   indexes, or durable-doc lifecycle state, THE SYSTEM SHALL route rule changes
   to spec-lifecycle-manager.
2. Agent Workbench SHALL consume lifecycle context and labels as evidence for
   routing, but SHALL NOT update task state, close specs, or assert lifecycle
   truth by itself.
3. The spec-lifecycle-manager feedback SHALL include the desired metadata input
   signals and the no-`ctime` rule.

## Correctness Properties

- **Property P1: Authority ordering:** Implementation-oriented document ranking never
  places a known archived, legacy, superseded, template, or sample document
  above a current canonical match with comparable textual relevance.
- **Property P2: Visible uncertainty:** Unknown or conflicting authority evidence is
  visible in the response.
- **Property P3: No ctime dependency:** Removing `ctime` from the host platform cannot
  change doc currency classification.
- **Property P4: Optional Git evidence:** Git history enriches recency output but is not
  required for docs search, task context, or direct reads to complete.
- **Property P5: Historical access:** Exact historical queries can still return
  non-authoritative historical docs with caveats.

## Success Criteria

- `context_for_task`, `docs_search`, `repo:///docs/overview`, and
  `repo:///docs/map` expose consistent document currency labels and caveats.
- Agents have a documented or executable workflow for checking current docs for
  a task before implementation.
- Fixture tests prove current docs outrank stale docs, historical queries still
  work, and Git evidence is optional.
- spec-lifecycle-manager receives a clear rule-change handoff for frontmatter,
  lifecycle-state, and stale-doc handling.
