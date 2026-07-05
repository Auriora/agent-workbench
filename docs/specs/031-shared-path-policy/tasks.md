---
title: Shared path policy tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-18
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006
T002 -> T007
T006,T007 -> T008
```

- [x] T001 Inventory path-policy consumers.
  - Files: `src/`, `tests/`, `plugins/agent-workbench/hooks/`
  - Acceptance: Scanner, docs, context, validation, preview/apply, hooks, and
    redaction consumers are mapped.
  - Evidence: Inventory completed during implementation: scanner and docs/context/validation consumers use catalog skip reasons; workspace safety and plugin hook had local path-risk lists; redaction remains content/presentation-specific. Evidence: rg inventory plus focused implementation diff.

  - Evidence mode: implementation
- [x] T002 Create shared classifier.
  - Depends on: T001
  - Files: `src/domain/policies/`
  - Acceptance: Classifier covers generated, vendor, hidden, secret, ignored,
    nested-repo, configured skip, and explicit allowlist categories.
  - Evidence: Created `src/domain/policies/path-policy.ts` with `classifyPathPolicy`, stable categories/reasons, shared skip roots, hidden allowlists, ignore-rule parsing, secret-path detection, nested-repo input, and compatibility exports through `catalog-path-policy.ts`. Evidence: `pnpm exec vitest run tests/workspace/path-policy-consistency.test.ts ...` passed; `pnpm typecheck` passed.

  - Evidence mode: implementation
- [x] T003 Migrate workspace safety.
  - Depends on: T002
  - Files: `src/infrastructure/filesystem/workspace-safety.ts`
  - Acceptance: Write safety derives read-only/refusal decisions from the
    shared classifier and keeps containment checks authoritative.
  - Evidence: Migrated `workspace-safety.ts` to call `classifyPathPolicy` for read-only/write-refusal decisions, including root ignore rules and expanded secret-bearing paths while retaining containment and symlink checks as authoritative. Evidence: `tests/workspace/safety.test.ts`, `tests/workspace/filesystem-adapters.test.ts`, `tests/edits/workspace-edit.test.ts`, and `tests/workspace/path-policy-consistency.test.ts` passed.

  - Evidence mode: implementation
- [x] T004 Migrate scanner and routing surfaces.
  - Depends on: T002
  - Files: scanner, docs/context/validation use cases
  - Acceptance: Existing skip behavior is preserved or made stricter with
    explicit test updates.
  - Evidence: Migrated scanner nested-repo skip through `catalogSkipReason`/`classifyPathPolicy`; docs/query warning detail now handles `nested_git_repository`. Existing docs/context/validation surfaces continue consuming `FileCatalogSkippedPath` reasons. Evidence: scanner, docs query, markdown quality, context-adjacent MCP validation-plan slice passed in targeted validation.

  - Evidence mode: implementation
- [x] T005 Align hook feedback.
  - Depends on: T002
  - Files: `plugins/agent-workbench/hooks/post-edit-feedback.js`
  - Acceptance: Hook path-risk vocabulary matches the shared classifier.
  - Evidence: Aligned `plugins/agent-workbench/hooks/post-edit-feedback.js` with the shared generated/vendor root table and secret-path vocabulary via exported `hookPathPolicyReason`; direct TypeScript import is not practical for the packaged plain-JS hook, so the mirrored table is covered by drift tests. Evidence: `tests/feedback/post-edit-hook-fixtures.test.ts` and `tests/workspace/path-policy-consistency.test.ts` passed.

  - Evidence mode: implementation
- [x] T006 Add consistency and secret-path tests.
  - Depends on: T003, T004, T005
  - Files: `tests/`
  - Acceptance: Tests cover `.env*`, safe examples, `.envrc`, credentials,
    secrets, private keys, generated/vendor roots, hidden paths, ignored paths,
    and write strictness.
  - Evidence: Added `tests/workspace/path-policy-consistency.test.ts` covering `.env*`, `.envrc`, safe env examples, credentials/secrets/private-key paths, generated/vendor roots, hidden paths, ignored paths, nested repos, workspace write strictness, and hook vocabulary. Evidence: focused path-policy validation passed 10 test files / 107 tests.

  - Evidence mode: validation
- [x] T007 Promote durable docs.
  - Depends on: T002
  - Files: `docs/reference/workspace-safety-contract.md`,
    `docs/security/threat-model.md`
  - Acceptance: Docs name the shared classifier and surface-specific policy
    mappings.
  - Evidence: Promoted current shared-classifier behavior to `docs/reference/workspace-safety-contract.md` and updated `docs/security/threat-model.md` for shared secret-path classification, write refusal, and redaction boundaries. Evidence: Markdown changes reviewed in diff; path-policy targeted tests and typecheck passed.

  - Evidence mode: implementation
- [x] T008 Validate and record residual generated-file work.
  - Depends on: T006, T007
  - Files: this spec package, backlog if needed
  - Acceptance: `pnpm typecheck` and targeted path-policy tests pass; EB033
    source-of-truth inference remains separate.
  - Evidence: Validated implementation and recorded residual generated-file work as EB033/out of scope. Evidence: `pnpm test` passed 69 files / 497 tests; `pnpm typecheck` passed; `pnpm run validate:plugin` passed; `spec_runtime.py lint docs/specs/031-shared-path-policy` passed with 0 diagnostics; `spec_runtime.py scan .` passed for 3 active specs; `git diff --check` passed.

  - Evidence mode: validation
