---
title: Markdown document audit scale and chunking requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-08-06
---

# Requirements

## Introduction

EB015 requires large durable Markdown sets to remain inside the structured
Workbench audit flow instead of forcing filesystem-only inventory and ad hoc
subset calls.

## Goals

- Continue large audits through deterministic bounded chunks.
- Scan Markdown inventory once per set call and reuse it for document checks.
- Report measurable per-document and aggregate coverage states.
- Support intentional active-spec exclusion and aggregate-only telemetry.

## Non-Goals

- Unbounded responses, hidden retries, filesystem fallbacks, or document-body telemetry.
- Mutating, formatting, or lifecycle-state changes.

## Durable Source Baseline

| Source | Authority |
| --- | --- |
| `docs/backlog/README.md` | EB015 scope and acceptance |
| `src/contracts/runtime-docs-contracts.ts` | Markdown request/result contracts |
| `src/application/use-cases/check-markdown-quality.ts` | Audit orchestration |
| `docs/design/mcp-surface-design.md` | Public read-only MCP behavior |

## Requirements

### Requirement 1: Deterministic continuation

1. GIVEN more documents than `max_documents`, WHEN a set audit runs, THEN THE
   SYSTEM SHALL return a partial state, exact offset/coverage, an opaque cursor,
   and a next `check_markdown_set` action.
2. GIVEN the returned cursor and unchanged candidates, WHEN the next call runs,
   THEN THE SYSTEM SHALL continue the same lexical universe without overlap.
3. IF candidate identity changes, THEN THE SYSTEM SHALL block the stale cursor.

### Requirement 2: Single-scan checking

1. GIVEN any set call, WHEN multiple documents are checked, THEN THE SYSTEM
   SHALL scan repository Markdown inventory once and reuse it for each document.

### Requirement 3: Measurable coverage

1. THE SYSTEM SHALL distinguish unchecked, skipped, checked-clean,
   checked-with-findings, and budget-truncated document states.
2. THE SYSTEM SHALL report total, chunk, checked, skipped, finding, remaining,
   exclusion, truncation, and completion counts.

### Requirement 4: Durable/spec scope intent

1. GIVEN `exclude_active_specs: true`, WHEN scope discovery runs, THEN THE
   SYSTEM SHALL exclude `docs/specs/<package>/` documents.
2. Explicitly supplied spec paths SHALL remain eligible.

### Requirement 5: Safe telemetry

1. MCP telemetry SHALL record document/chunk/checked/skipped/finding/truncation
   counts, completion, and elapsed time without document bodies.

## Correctness Properties

- CP-001: Cursor pages cover one stable lexical candidate set exactly once.
- CP-002: One set call performs exactly one catalog scan.
- CP-003: Telemetry contains aggregate scalars only.

## Durable Impact

- `docs/reference/runtime-contracts.md`
- `docs/design/mcp-surface-design.md`
- `.well-known/mcp/server-card.json`
- `docs/backlog/README.md`

## Success Criteria

- SC-001: A synthetic 160-document corpus completes durable-doc auditing in bounded calls.
- SC-002: First, continuation, final, exclusion, explicit inclusion, stale cursor,
  and budget-truncated cases pass.
- SC-003: Typecheck, focused tests, bounded full tests, and packaging gates pass.
