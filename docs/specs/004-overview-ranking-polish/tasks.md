---
title: Overview ranking polish tasks
doc_type: spec
artifact_type: tasks
status: archived
owner: platform
last_reviewed: 2026-06-05
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004
T002 -> T005
T004 -> T006
T005 -> T006
```

## Phase 1: Fixture And Baseline

- [x] T001 Add compact overview-ranking fixtures.
  - Files: `tests/fixtures/`, `tests/mcp/repo-scope-overview-resource.test.ts`
  - Acceptance: Fixtures include source entrypoints, tests, package config,
    many workflow files, fixture docs, and generated/vendor examples without
    using external repo names.
  - Evidence: Added the synthetic workflow-heavy overview fixture in
    `tests/mcp/repo-scope-overview-resource.test.ts`; focused test pass:
    `pnpm exec vitest run tests/mcp/repo-scope-overview-resource.test.ts`.

## Phase 2: Ranking Implementation

- [x] T002 Improve key-file scoring for first-party source, entrypoints, tests,
      and package/test config.
  - Depends on: T001
  - Files: `src/application/use-cases/get-repo-overview.ts`
  - Acceptance: Application and test anchors rank ahead of workflow/config noise
    when both are present.
  - Evidence: `keyFileEvidence` now promotes generic entrypoint evidence and
    preserves deterministic source/test/package ordering ahead of workflow
    config in the focused overview regression test.

- [x] T003 Add compact ranking reasons.
  - Depends on: T002
  - Files: `src/application/use-cases/get-repo-overview.ts`,
    `tests/mcp/repo-scope-overview-resource.test.ts`
  - Acceptance: Key-file reasons identify generic evidence classes without
    claiming semantic proof.
  - Evidence: Overview `key_files[].reason` now names compact generic evidence
    classes; focused regression asserts package configuration, application
    entrypoint, test, workflow configuration, and downranked generated/vendor/
    fixture wording.

## Phase 3: Validation And Promotion

- [x] T004 Add regression coverage for workflow-heavy and docs-heavy shapes.
  - Depends on: T003
  - Files: `tests/mcp/repo-scope-overview-resource.test.ts`
  - Acceptance: Tests prove deterministic ordering and budget preservation.
  - Evidence: Existing docs-heavy coverage and new workflow-heavy coverage pass
    in `pnpm exec vitest run tests/mcp/repo-scope-overview-resource.test.ts`.

- [x] T005 Promote accepted behavior to durable docs.
  - Depends on: T002
  - Files: `docs/design/mcp-surface-design.md`
  - Acceptance: Durable docs describe current ranking behavior and remaining
    caveats.
  - Evidence: `docs/design/mcp-surface-design.md` now documents overview
    key-file ranking behavior, compact reasons, and residual trust caveats.

- [x] T006 Run validation and close the spec.
  - Depends on: T004, T005
  - Files: `docs/specs/004-overview-ranking-polish/verification.md`
  - Acceptance: Verification records focused tests, `pnpm typecheck`, and
    closure/promotion evidence.
  - Evidence: Verification recorded full validation gates and closure evidence
    on 2026-06-05; spec frontmatter archived and documentation map updated.
