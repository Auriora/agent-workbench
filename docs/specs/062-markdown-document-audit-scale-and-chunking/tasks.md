---
title: Markdown document audit scale and chunking tasks
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

- [x] T001 Add continuation, coverage, and scope-intent contracts.
  - Requirements: Requirement 1; Requirement 3; Requirement 4; CP-001
  - Files: `src/contracts/`, MCP registry and presentation
  - Acceptance: Additive schemas validate partial, complete, excluded, and blocked states.
  - Evidence: Request, receipt, coverage, continuation, and partial-state schemas pass focused contract and MCP tests.
  - Evidence mode: implementation
- [x] T002 Refactor set checking to one scan and deterministic chunks.
  - Requirements: Requirement 1; Requirement 2; Requirement 3; Requirement 4; CP-001; CP-002
  - Files: `src/application/use-cases/check-markdown-quality.ts`
  - Acceptance: Large audits continue without overlap and each call scans once.
  - Evidence: The 120 durable-doc audit completes at offsets 0, 37, 74, and 111 with one scan per call.
  - Evidence mode: implementation
- [x] T003 Add scale, continuation, telemetry, and MCP regressions.
  - Requirements: all; CP-003
  - Files: `tests/docs/`, `tests/mcp/`
  - Acceptance: A 160-document fixture proves all acceptance paths and body-free telemetry.
  - Evidence: Six focused files and 76 tests pass, including the generated 160-document corpus, reviewer regressions, and telemetry privacy assertion.
  - Evidence mode: implementation
- [x] T004 Validate, promote durable docs, and close the package.
  - Requirements: all
  - Files: durable docs, backlog, verification, history
  - Acceptance: Required validation and lifecycle gates pass with no blocker.
  - Evidence: Typecheck, contract check, plugin/skill/package checks, and bounded full 125-file/1,349-test suite pass; durable docs and EB015 are reconciled.
  - Evidence mode: validation
