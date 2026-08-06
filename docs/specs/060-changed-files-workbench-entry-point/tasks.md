---
title: Changed-files Workbench entry point tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-08-06
---

# Tasks

**Input**: `requirements.md`, `design.md`, `traceability.md`, and durable sources.
**Prerequisites**: backlog reconciliation and lifecycle creation preflight.

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006
```

## Phase 1: Contracts and Git evidence

- [x] T001 Add bounded changed-files and Git-category contracts.
  - Depends on: none
  - Requirements: Requirement 1; Requirement 2; CP-001; CP-003
  - Files: `src/contracts/`, `src/ports/index.ts`, `src/infrastructure/commands/index.ts`, focused tests
  - Acceptance: additive schemas and deterministic staged, unstaged, untracked evidence are fixture-tested without Git mutation.
  - Evidence: Implemented additive Git category contracts and safe command adapter evidence; tests/workspace/command-runner.test.ts and tests/application/changed-files-context.test.ts passed; pnpm typecheck passed.

  - Evidence mode: implementation
## Phase 2: Application and presentation

- [x] T002 Implement changed-files packet orchestration and presentation.
  - Depends on: T001
  - Requirements: Requirement 2; Requirement 3; CP-002; CP-003; CP-004
  - Files: `src/application/use-cases/`, `src/presentation/`, focused tests
  - Acceptance: provider component states and overall state are deterministic; missing evidence is not success-shaped.
  - Evidence: src/application/use-cases/get-changed-files-context.ts and src/presentation/changed-files-context-presenter.ts implement deterministic component states; tests/application/changed-files-context.test.ts passed 6 cases in the final focused run.

  - Evidence mode: implementation
## Phase 3: MCP and integration registration

- [x] T003 Register the thin `changed_files_context` MCP adapter.
  - Depends on: T002
  - Requirements: Requirement 4 AC1, AC3
  - Files: `src/interface-adapters/mcp/registries/`, `src/server.ts`, MCP tests
  - Acceptance: launch-root authority, invalid input, provider failure, metadata, trust, and output bounds pass.
  - Evidence: src/interface-adapters/mcp/registries/tools/changed-files-context.ts and src/server.ts register launch-root-authoritative dispatch; tests/mcp/changed-files-context-tool.test.ts and tests/mcp/registry-metadata.test.ts passed.

  - Evidence mode: implementation
- [x] T004 Update common and packaged agent discoverability.
  - Depends on: T003
  - Requirements: Requirement 4 AC2-AC3
  - Files: `src/integration/`, `plugins/agent-workbench/`, integration tests
  - Acceptance: Codex, Claude Code, and Kiro guidance names the exact post-edit entry point while retaining focused tools.
  - Evidence: Added changed_files_context to common integration metadata, server card, and Codex, Claude Code, and Kiro guidance; integration tests and pnpm validate:plugin passed.

  - Evidence mode: implementation
## Phase 4: Verification and promotion

- [x] T005 Run focused and full validation plus independent reviews.
  - Depends on: T004
  - Requirements: all
  - Files: `verification.md`, implementation and test paths
  - Acceptance: focused tests, typecheck, full Vitest, plugin, skill, package, lifecycle, correctness, and security/operations review evidence is recorded.
  - Evidence: Focused tests and typecheck passed; bounded full suite passed 1,338/1,338; plugin, skill, and package gates passed; correctness and security/operations findings were fixed and reviewer follow-ups confirmed no remaining blocker.

  - Evidence mode: validation
- [x] T006 Promote durable behavior and reconcile closure readiness.
  - Depends on: T005
  - Requirements: all
  - Files: durable targets named in `requirements.md`, backlog, history, lifecycle artifacts
  - Acceptance: lasting behavior is promoted, residual work has one owner, and closure tooling reports no unresolved blocker.
  - Evidence: REQ-032 plus changed-files design, runtime contract, integration guidance, and EB044 delivery state were promoted to durable owners; promotion_plan reports 11 targets and zero missing targets, and all must-have requirements are covered.

  - Evidence mode: promotion
## Execution Rules

- Read the full package before implementing a task.
- Keep one task in progress and record exact evidence before completion.
- Do not add command execution, lifecycle mutation, retries, or fallback routes.
- Preserve unrelated work and keep MCP adapters thin.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
