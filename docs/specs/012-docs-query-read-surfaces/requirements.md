---
title: Docs query and read surfaces requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Requirements

## Introduction

This spec promotes the second high-priority replacement gap from
[Spec 010](../010-agent-ide-capability-analysis/requirements.md): compact
documentation query and read surfaces.

Predecessor `agent-ide` usage showed frequent use of docs search and section
reads. Agent Workbench already treats Markdown and config as resource-backed
evidence, but it lacks a direct, bounded workflow for docs overview, map,
search, outline, and read-section operations.

## Durable Source Baseline

- Capability analysis:
  [Agent IDE capability analysis](../../reference/agent-ide-capability-analysis/agent-ide-capability-analysis-2026-06-05.md)
- MCP surface rules:
  [MCP surface design](../../design/mcp-surface-design.md)
- Markdown quality design:
  [Markdown document quality design](../../design/markdown-document-quality-design.md)
- Runtime contracts:
  [Runtime contracts](../../reference/runtime-contracts.md)

## Goals

- Add compact docs resources for overview and map.
- Add intentional docs query/read operations for search, outline, and
  read-section.
- Keep docs evidence clearly labeled as documentation/routing evidence unless a
  section read directly supports a claim.
- Preserve row caps, pagination, relative paths, and direct-read caveats.

## Non-Goals

- Do not add broad architecture reports or generated summaries.
- Do not make docs search authoritative for precise claims without section-read
  evidence.
- Do not implement docs crosslink graph reporting until core query/read surfaces
  are useful and bounded.
- Do not introduce Python-specific docs indexing assumptions.

## Requirements

### Requirement 1: Docs Overview And Map Resources

**User Story:** As a coding agent, I want cheap docs overview resources, so
that I can find project guidance before falling back to broad file searches.

#### Acceptance Criteria

1. GIVEN a repo has Markdown documentation, WHEN `repo:///docs/overview` is
   read, THEN the system SHALL return a compact summary of important docs,
   headings, and caveats within budget.
2. GIVEN a repo has multiple docs files, WHEN `repo:///docs/map` is read, THEN
   the system SHALL return a bounded map of docs paths and headings.
3. IF docs are unreadable, missing, generated, vendor, or skipped by policy,
   THEN the system SHALL degrade with structured warnings rather than failing
   the whole resource.

### Requirement 2: Docs Search

**User Story:** As a coding agent, I want to search project docs by title, path,
heading, and selected text, so that I can route work to the right durable
guidance quickly.

#### Acceptance Criteria

1. GIVEN a docs query, WHEN `docs_search` runs, THEN the system SHALL return
   ranked docs hits with path, title or heading, snippet where safe, evidence,
   and direct-read caveat.
2. WHERE results exceed the row cap, THE SYSTEM SHALL return truncation metadata
   or a cursor rather than oversized payloads.
3. IF the docs index is cold or stale, THEN the system SHALL return a
   structured degraded state and a next action.

### Requirement 3: Docs Outline And Read Section

**User Story:** As a coding agent, I want to inspect a specific docs outline or
section, so that precise documentation claims are based on direct section
evidence.

#### Acceptance Criteria

1. GIVEN a repo-relative Markdown path, WHEN `docs_outline` runs, THEN the
   system SHALL return a heading outline with stable section identifiers.
2. GIVEN a repo-relative Markdown path and heading identifier, WHEN
   `docs_read_section` runs, THEN the system SHALL return only that section
   within source-byte and copyright-safe limits.
3. IF the path escapes the workspace, is generated/vendor, or is ambiguous, THEN
   the system SHALL return a structured workspace-safety error.

### Requirement 4: Durable Promotion

**User Story:** As a maintainer, I want docs query behavior documented durably,
so that future documentation providers use consistent contracts.

#### Acceptance Criteria

1. WHEN implementation completes, THEN durable MCP and Markdown docs SHALL
   describe docs resources, tools/templates, budgets, caveats, and promotion
   criteria.
2. WHEN implementation completes, THEN deferred crosslinks or generated reports
   SHALL be routed to backlog with evidence needed for promotion.

## Correctness Properties

- Docs paths must be relative to the repo.
- Docs query results must be bounded and deterministic.
- Docs search must not replace direct section reads for precise claims.
- Unreadable docs must degrade structurally.
- Docs evidence must not alter code-language capability labels.

## Success Criteria

- Agents can find, outline, and read docs sections without broad shell search.
- Docs resources/tools stay compact on large docs fixtures.
- The public surface improves docs-heavy workflows without adding broad report
  generation.
