---
title: Redaction boundary polish tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003
T002 -> T004
T003 -> T005
T004 -> T005
```

- [ ] T001 Add redaction-boundary fixtures.
  - Files: `tests/fixtures/`, `tests/presentation/`, `tests/mcp/`
  - Acceptance: Fixtures include route strings, URL fragments, absolute host
    paths, traversal-like values, and secret-like values.
  - Evidence: Pending.

- [ ] T002 Implement shared presentation redaction helper.
  - Depends on: T001
  - Files: `src/presentation/`, `src/infrastructure/filesystem/`
  - Acceptance: Helper preserves source snippets and protects filesystem or
    secret-like values with deterministic classifications.
  - Evidence: Pending.

- [ ] T003 Wire helper into MCP presentation paths.
  - Depends on: T002
  - Files: `src/presentation/`, `src/application/use-cases/`,
    `tests/mcp/`
  - Acceptance: Source sections and compact feedback use the shared helper
    instead of local string heuristics.
  - Evidence: Pending.

- [ ] T004 Promote behavior to durable docs.
  - Depends on: T002
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/reference/workspace-safety-contract.md`
  - Acceptance: Durable docs describe the redaction boundary and residual
    caveats.
  - Evidence: Pending.

- [ ] T005 Validate and close the spec.
  - Depends on: T003, T004
  - Files: `docs/specs/007-redaction-boundary-polish/verification.md`
  - Acceptance: Verification records focused tests, `pnpm typecheck`,
    full-suite decision, and promotion evidence.
  - Evidence: Pending.
