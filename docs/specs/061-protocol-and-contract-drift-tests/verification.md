---
title: Protocol and contract drift tests verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-08-06
---

# Verification

## Quality Gates

- `pnpm check:contracts`
- focused contract-drift tests
- `pnpm typecheck`
- bounded full Vitest suite
- `pnpm validate:plugin`
- `pnpm validate:skills`
- `pnpm pack:dry-run`
- lifecycle lint, traceability, promotion, and closure checks

## Evidence Log

- T001, Requirement 1 and Requirement 4: pure checker tests pass with stable findings.
- T002, Requirement 2 and Requirement 3: clean, intentional-drift, and malformed fixture cases pass.
- T003, Requirement 1: `pnpm check:contracts` and `pnpm typecheck` pass.
- T004, all requirements: 4 focused files and 23 tests pass; plugin and skill
  validation pass; package dry-run passes; bounded full Vitest passes 124 files
  and 1,341 tests.

## Residual Risks

- Only explicitly managed shared enums and valid JSON examples are checked;
  adding another public enum requires an intentional checker extension.
- Prose semantics remain subject to documentation review rather than brittle
  keyword parsing.
