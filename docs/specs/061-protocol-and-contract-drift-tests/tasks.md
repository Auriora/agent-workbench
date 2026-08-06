---
title: Protocol and contract drift tests tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-08-06
---

# Tasks

## Dependency Graph

```text
T001 -> T002 -> T003 -> T004
```

- [x] T001 Implement the pure deterministic checker and stable findings.
  - Requirements: Requirement 1; Requirement 2; Requirement 3; CP-001; CP-003
  - Files: `src/application/use-cases/`, focused tests
  - Acceptance: Clean authorities yield no findings; all finding order is stable.
  - Evidence: Pure checker returns stable sorted findings and clean fixture input returns none.
  - Evidence mode: implementation
- [x] T002 Add fixture-backed clean and intentional-drift coverage.
  - Requirements: Requirement 4; CP-002
  - Files: `tests/contracts/`, `tests/fixtures/fixture-contract-drift/`
  - Acceptance: Fixtures prove every EB029 drift category and fail-closed malformed input.
  - Evidence: `tests/contracts/contract-drift.test.ts` passes clean, combined drift, and malformed-document cases.
  - Evidence mode: implementation
- [x] T003 Add the thin CLI, package command, and durable projections.
  - Requirements: Requirement 1; Requirement 2; Requirement 3
  - Files: `scripts/`, `package.json`, canonical docs and server card
  - Acceptance: `pnpm check:contracts` passes locally without network access.
  - Evidence: Package command passes against source schemas, `mcpTools`, runtime contracts, and the server card.
  - Evidence mode: implementation
- [x] T004 Run validation, promote durable behavior, and close the package.
  - Requirements: all
  - Files: `verification.md`, durable docs, backlog, history
  - Acceptance: Required gates pass and closure tooling reports no blocker.
  - Evidence: Focused 23-test set, typecheck, plugin/skill/package checks, and bounded full 1,341-test suite pass; durable docs and EB029 are reconciled.
  - Evidence mode: validation

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
