---
title: FTS-backed docs search requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Requirements

## Introduction

Spec 012 added public docs overview, map, search, outline, and read-section
surfaces. Post-reload comparison against Python Agent IDE showed that the
current scanner-backed `docs_search` is usable but not consistently same-or-
better. Python Agent IDE uses SQLite FTS5 for docs search, which gives stronger
multi-term ranking, match counts, and pagination.

This spec replaces the current per-call scanner/string-search implementation
for docs search with one SQLite FTS-backed docs index path. The goal is not to
copy Python Agent IDE internals. The goal is to use Agent Workbench's existing
SQLite/runtime architecture to provide language-neutral, bounded, deterministic
documentation search that is at least as useful for agent workflows.

## Durable Source Baseline

- MCP docs surface behavior:
  [MCP surface design](../../design/mcp-surface-design.md)
- SQLite and FTS ownership:
  [Graph store design](../../design/graph-store-design.md)
- Runtime cache and warmup ownership:
  [Runtime operations design](../../design/runtime-operations-design.md)
- Documentation quality boundary:
  [Markdown document quality design](../../design/markdown-document-quality-design.md)
- Agent IDE comparison baseline:
  [Agent IDE capability analysis](../../reference/agent-ide-capability-analysis/agent-ide-capability-analysis-2026-06-05.md)

## Goals

- Add an FTS-backed docs index for Markdown path, title, headings, and selected
  body text.
- Make `docs_search` use the indexed path instead of per-call full docs reads.
- Keep `docs_outline` and `docs_read_section` direct-read evidence paths.
- Match or beat Python Agent IDE docs search for multi-term docs-routing
  queries used during dogfood.
- Preserve relative paths, direct-read caveats, truncation metadata, compact
  skipped-path warnings, and structured degraded/blocked states.

## Non-Goals

- Do not add vector search.
- Do not add `docs_crosslinks`, generated reports, or architecture answers.
- Do not make search results authoritative for precise claims.
- Do not add a second hidden search fallback beside FTS. Cold or invalid index
  states must return structured degraded or blocked evidence.
- Do not couple the implementation to TimeLocker, Agent Workbench, or any
  specific sample repository.

## Requirements

### Requirement 1: FTS Docs Index

**User Story:** As a coding agent, I want docs search to use a warm text index,
so that docs-heavy workflows do not depend on broad Markdown scans.

#### Acceptance Criteria

1. GIVEN a repository has Markdown docs, WHEN docs indexing runs, THEN the
   system SHALL persist repo-relative path, title, headings, heading ids, and
   selected body text into a SQLite FTS-backed docs index.
2. WHEN docs files are changed, removed, skipped, or reclassified, THEN the
   system SHALL refresh or invalidate affected docs index rows with snapshot or
   freshness evidence.
3. IF the docs index is cold, stale, invalid, or unavailable, THEN
   `docs_search` SHALL return a structured degraded or blocked state naming the
   missing evidence rather than silently falling back to a broad scan.

### Requirement 2: Search Ranking And Pagination

**User Story:** As a coding agent, I want docs search results ranked like a
documentation search engine, so that likely governing docs appear before broad
or generic matches.

#### Acceptance Criteria

1. GIVEN a multi-term query, WHEN `docs_search` runs, THEN the system SHALL
   rank documents using FTS match evidence across title, path, headings, and
   selected body text instead of requiring exact phrase matches.
2. WHERE common terms such as `agent`, `guide`, `docs`, or `workbench` appear
   broadly, THE SYSTEM SHALL rank stronger phrase, title/path, heading, and
   multi-term matches ahead of generic AI-agent or template docs.
3. WHERE result count exceeds `max_results`, THE SYSTEM SHALL return
   truncation metadata and a cursor or equivalent continuation token.

### Requirement 3: Existing Docs Surface Compatibility

**User Story:** As a maintainer, I want FTS search to preserve existing docs
surface contracts, so that clients do not need a second docs-search workflow.

#### Acceptance Criteria

1. WHEN `docs_search` returns hits, THEN each hit SHALL keep repo-relative
   paths, title or heading evidence, optional bounded snippets, evidence labels,
   scores, and direct-read caveats.
2. WHEN `docs_outline` or `docs_read_section` runs, THEN those tools SHALL
   continue to use direct Markdown reads and workspace-safety checks for
   precise claims.
3. IF docs indexing skips generated, vendor, hidden, permission-denied, or
   missing paths, THEN public docs responses SHALL keep warnings compact while
   retaining enough internal skip evidence to block unsafe direct reads.

### Requirement 4: Parity And Promotion Evidence

**User Story:** As a project maintainer, I want objective parity evidence
against Python Agent IDE, so that replacement claims are defensible.

#### Acceptance Criteria

1. WHEN implementation completes, THEN fixture-backed tests SHALL show
   multi-term search, phrase boosting, heading matches, body snippets, result
   counts, pagination, stale/degraded index states, and compact warnings.
2. WHEN implementation completes, THEN dogfood comparisons SHALL include this
   repo and at least two external sample repositories without modifying those
   repositories.
3. WHEN implementation closes, THEN durable docs SHALL describe the FTS-backed
   docs index, ranking, freshness, pagination, caveats, and remaining deferred
   crosslink/report work.

## Correctness Properties

- Docs index paths must be repo-relative.
- Search must be deterministic for equal indexed data and query options.
- Search must not read unbounded Markdown content on the hot path.
- Direct-read section evidence must remain separate from routing search
  evidence.
- Generated/vendor/hidden/skipped paths must not enter the docs index unless
  explicitly allowed by catalog policy.
- A stale or unavailable FTS index must not be masked by a broad scanner
  fallback.

## Success Criteria

- `docs_search("docs query read surfaces")` returns relevant Spec 012 docs in
  this repository with compact warnings.
- External docs-heavy queries rank governing docs above generic AI-agent
  templates when stronger phrase/heading evidence exists.
- Agents can use Agent Workbench docs search instead of Python Agent IDE docs
  search for common docs-routing workflows.
