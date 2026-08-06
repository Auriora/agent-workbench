---
title: Markdown document audit scale and chunking verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-08-06
---

# Verification

## Quality Gates

- focused Markdown audit, MCP, contract, and telemetry tests
- `pnpm check:contracts`
- `pnpm typecheck`
- bounded full Vitest suite
- plugin, skill, package, lifecycle, and closure checks

## Evidence Log

- T001, Requirements 1, 3, and 4: additive schema and MCP presentation tests pass.
- T002, Requirements 1-4 and CP-001/CP-002: the 160-document synthetic fixture
  proves deterministic first, continuation, and final chunks with one scan per call.
- T003, Requirement 5 and CP-003: telemetry records aggregate audit counts and
  its regression proves document evidence is absent.
- T004, all requirements: six focused files and 76 tests, typecheck, contract
  check, plugin/skill validation, package dry-run, and bounded full 125-file and
  1,349-test suite pass. Independent review found three correctness gaps; all
  three were fixed and the scoped re-review reported no remaining finding.

## Residual Risks

- Cursor continuation blocks and restarts when the Markdown universe changes.
- Cross-page aggregate totals are accumulated by the caller from exact page receipts.
