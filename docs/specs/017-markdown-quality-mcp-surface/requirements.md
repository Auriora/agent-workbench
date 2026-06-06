---
title: Markdown quality MCP surface requirements
doc_type: spec
artifact_type: requirements
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Requirements

## Introduction

Markdown quality work was explicitly deferred from the MVP and now has durable
design coverage. The docs query/read surfaces help agents find and read docs,
but they do not detect structure, frontmatter, link, list, or table quality
issues. This spec promotes the read-only Markdown quality checker surface before
formatter or generated-report work.

## Durable Source Baseline

- Markdown quality design:
  [Markdown document quality design](../../design/markdown-document-quality-design.md)
- MCP surface design:
  [MCP surface design](../../design/mcp-surface-design.md)
- Edit and validation boundaries:
  [Edit and validation loop design](../../design/edit-and-validation-loop-design.md)
- Workspace safety:
  [Workspace safety contract](../../reference/workspace-safety-contract.md)

## Goals

- Expose bounded read-only `check_markdown_document` and
  `check_markdown_set` MCP tools.
- Add parser-aware Markdown structure, frontmatter, link, ordered-list, and
  table readability checks with compact findings.
- Integrate Markdown quality planning into `verification_plan` without running
  formatting or mutating docs.

## Non-Goals

- Do not add Markdown formatting preview/apply in this spec.
- Do not generate documentation reports.
- Do not rewrite prose or perform semantic contradiction analysis.
- Do not use regex-only parsing as the core checker.

## Requirements

### Requirement 1: Read-Only Markdown Quality Checks

**User Story:** As a documentation maintainer, I want structured Markdown
quality findings, so that agents can fix authoring issues without broad manual
review.

#### Acceptance Criteria

1. GIVEN a Markdown document, WHEN `check_markdown_document` runs, THEN the
   system SHALL return bounded findings for skipped headings, duplicate
   headings, ordered-list numbering, frontmatter shape, broken local links, and
   table readability where parser evidence supports them.
2. WHEN `check_markdown_set` runs, THEN the system SHALL apply catalog policy,
   row budgets, and skip warnings across a bounded set of docs.
3. IF a document is generated, vendor, hidden, oversized, missing, or outside
   the workspace, THEN the system SHALL return structured skipped or blocked
   evidence rather than reading it unsafely.

### Requirement 2: Findings Presentation

**User Story:** As a coding agent, I want Markdown findings to be compact and
actionable, so that hooks and MCP calls do not create noise.

#### Acceptance Criteria

1. WHEN findings are returned, THEN each finding SHALL include repo-relative
   path, rule id, severity, line or range where available, evidence text within
   budget, and suggested action.
2. WHERE a document is clean, THE SYSTEM SHALL return a quiet success envelope
   without hook-style advisory noise.
3. IF checks are incomplete because of budgets or parser limits, THEN the
   response SHALL include compact caveats and truncation metadata.

### Requirement 3: Validation Planning Integration

**User Story:** As an implementation agent, I want documentation edits to plan
quality checks, so that docs changes get targeted validation.

#### Acceptance Criteria

1. GIVEN changed Markdown or documentation-policy files, WHEN
   `verification_plan` runs, THEN the system SHALL plan the relevant Markdown
   quality check without executing formatting.
2. WHERE the public checker tools are unavailable or blocked, THE SYSTEM SHALL
   report a manual docs/config review plan with the missing evidence.
3. WHEN the spec closes, THEN formatter and generated-report work SHALL remain
   routed to durable backlog or future specs.

## Correctness Properties

- Markdown checks must be read-only.
- Findings must use repo-relative paths.
- Fenced code blocks must not be interpreted as Markdown structure findings.
- Link checks must respect workspace safety and catalog skip policy.
- Clean results must remain quiet in hooks and compact in MCP responses.

## Success Criteria

- Fixture-backed tests prove heading, list, frontmatter, link, table, skipped
  path, clean-result, budget, and presentation behavior.
- `verification_plan` proposes Markdown quality checks for Markdown edits.
- Durable docs clearly distinguish checker tools from future formatter tools.
