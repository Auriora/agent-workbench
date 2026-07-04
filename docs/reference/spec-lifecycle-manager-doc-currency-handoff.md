---
title: Spec-lifecycle-manager doc currency handoff
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-07-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Spec-lifecycle-manager Doc Currency Handoff

## Purpose

Record Agent Workbench feedback for lifecycle tooling that manages active specs,
durable-doc promotion, closure, archived specs, and canonical context.

Agent Workbench consumes lifecycle evidence for routing, but it does not decide
spec completion, promotion, closure, or lifecycle truth.

## Recommended Input Signals

Lifecycle tooling should treat these Markdown frontmatter fields as routing
inputs:

- `status`
- `doc_type`
- `last_reviewed`
- `authority`
- `canonical_owner`
- `superseded_by`
- `review_after`
- `applies_to`

Frontmatter should not be accepted as standalone authority when it conflicts
with repository instructions, governance, documentation-map owners,
source-code contracts, active lifecycle context, or accepted durable docs.

## Canonical Context Guidance

Specs with stale-doc risk should include a canonical-context declaration or
equivalent embedded section. It should identify current durable sources,
imported or adapted sources, non-authoritative historical sources, and
promotion targets.

Lifecycle checks should warn when an active spec, task, or durable-doc update
uses archived, superseded, historical, or closure-breadcrumb docs without a
canonical-context entry or current-source link.

## Recency Evidence

File `mtime_ms` can be displayed as modified-time evidence only. It is not
review, acceptance, creation, or lifecycle-state evidence.

Local Git history may be used as optional corroboration for tracked files:

- latest commit touching the file
- latest commit date
- first-introduced commit/date when bounded and affordable

Missing Git evidence, shallow history, untracked files, command failure, or
missing `git` should be reported explicitly and should not block lifecycle
routing when other evidence exists.

## No ctime Rule

Filesystem `ctime` must not be used as creation-time, lifecycle-state, review,
promotion, closure, or document-currency evidence. Platform `ctime` semantics
are not reliable enough for lifecycle authority.

## Workbench Boundary

Agent Workbench exposes document currency routing through `context_for_task`,
`docs_search`, `repo:///docs/overview`, `repo:///docs/map`, and
`docs_current_for_task`. Those surfaces return routing evidence and caveats.

spec-lifecycle-manager remains responsible for lifecycle rules, active-spec
state, task completion semantics, durable promotion, closure readiness, archive
indexes, closure logs, and canonical-context enforcement.
