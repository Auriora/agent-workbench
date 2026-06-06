---
title: Redaction boundary polish tasks
doc_type: spec
artifact_type: tasks
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Tasks

Spec 007 closed on 2026-06-06. All tasks are complete and accepted behavior
was promoted to durable design/reference docs.

## Task Dependency Graph

```text
T001 -> T002 -> T003
T002 -> T004
T003 -> T005
T004 -> T005
```

- [x] T001 Add redaction-boundary fixtures.
  - Files: `tests/fixtures/`, `tests/presentation/`, `tests/mcp/`
  - Acceptance: Fixtures include route strings, URL fragments, absolute host
    paths, traversal-like values, and secret-like values.
  - Evidence: Completed on 2026-06-06. Added
    `tests/fixtures/fixture-redaction-boundary/src/routes.ts` with API route
    strings, URL-like asset fragments, repo-relative path text,
    traversal-like values, absolute host paths, Windows host paths, and
    token-like values. Added `tests/presentation/redaction-boundary.test.ts`
    to prove route/URL source snippets are preserved while sensitive/path-like
    values remain protected. Validation:
    `pnpm exec vitest run tests/presentation/redaction-boundary.test.ts tests/architecture/layer-boundaries.test.ts`
    and `pnpm typecheck` passed.

- [x] T002 Implement shared presentation redaction helper.
  - Depends on: T001
  - Files: `src/presentation/`, `src/infrastructure/filesystem/`
  - Acceptance: Helper preserves source snippets and protects filesystem or
    secret-like values with deterministic classifications.
  - Evidence: Completed on 2026-06-06. Added
    `src/presentation/redaction.ts` with deterministic classification for
    `source_text`, `repo_relative_path`, `absolute_path`,
    `workspace_escape`, and `secret_like` values plus redacted display values
    for host paths, traversal, and secret-like text. The helper has no
    filesystem access and does not replace workspace path containment.
    Validation: focused presentation and architecture tests plus
    `pnpm typecheck` passed.

- [x] T003 Wire helper into MCP presentation paths.
  - Depends on: T002
  - Files: `src/presentation/`, `src/application/use-cases/`,
    `tests/mcp/`
  - Acceptance: Source sections and compact feedback use the shared helper
    instead of local string heuristics.
  - Evidence: Completed on 2026-06-06. Wired `redactPresentationText` into
    task-context source sections, symbol-search source sections, impact
    affected-symbol source sections, docs-search snippets, and docs
    read-section text. Added MCP/presenter assertions that `/api/orders`
    remains visible while `TOKEN=...`, absolute host paths, and workspace
    escapes are redacted. Validation:
    `pnpm exec vitest run tests/presentation/redaction-boundary.test.ts tests/docs/docs-presenter.test.ts tests/mcp/query-tools.test.ts tests/mcp/context-for-task-tool.test.ts tests/architecture/layer-boundaries.test.ts`
    and `pnpm typecheck` passed.

- [x] T004 Promote behavior to durable docs.
  - Depends on: T002
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/reference/workspace-safety-contract.md`
  - Acceptance: Durable docs describe the redaction boundary and residual
    caveats.
  - Evidence: Completed on 2026-06-06. Promoted the accepted source-snippet,
    path-typed field, absolute host path, workspace escape, and secret-like
    display boundary to `docs/design/mcp-surface-design.md` and
    `docs/reference/workspace-safety-contract.md`. Updated
    `docs/reference/documentation-map.md` so Spec 007 is retained as archived
    delivery evidence.

- [x] T005 Validate and close the spec.
  - Depends on: T003, T004
  - Files: `docs/specs/007-redaction-boundary-polish/verification.md`
  - Acceptance: Verification records focused tests, `pnpm typecheck`,
    full-suite decision, and promotion evidence.
  - Evidence: Completed on 2026-06-06. Updated verification evidence, archived
    the Spec 007 package in place, and recorded durable promotion. Validation:
    focused redaction/presenter/MCP/architecture tests passed; `pnpm typecheck`
    passed; `pnpm test` passed with 48 files and 314 tests; Spec 007 lint
    passed; `git diff --check` passed.
