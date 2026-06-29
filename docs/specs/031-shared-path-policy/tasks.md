---
title: Shared path policy tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-18
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006
T002 -> T007
T006,T007 -> T008
```

- [ ] T001 Inventory path-policy consumers.
  - Files: `src/`, `tests/`, `plugins/agent-workbench/hooks/`
  - Acceptance: Scanner, docs, context, validation, preview/apply, hooks, and
    redaction consumers are mapped.
  - Evidence: Pending.

- [ ] T002 Create shared classifier.
  - Depends on: T001
  - Files: `src/domain/policies/`
  - Acceptance: Classifier covers generated, vendor, hidden, secret, ignored,
    nested-repo, configured skip, and explicit allowlist categories.
  - Evidence: Pending.

- [ ] T003 Migrate workspace safety.
  - Depends on: T002
  - Files: `src/infrastructure/filesystem/workspace-safety.ts`
  - Acceptance: Write safety derives read-only/refusal decisions from the
    shared classifier and keeps containment checks authoritative.
  - Evidence: Pending.

- [ ] T004 Migrate scanner and routing surfaces.
  - Depends on: T002
  - Files: scanner, docs/context/validation use cases
  - Acceptance: Existing skip behavior is preserved or made stricter with
    explicit test updates.
  - Evidence: Pending.

- [ ] T005 Align hook feedback.
  - Depends on: T002
  - Files: `plugins/agent-workbench/hooks/post-edit-feedback.js`
  - Acceptance: Hook path-risk vocabulary matches the shared classifier.
  - Evidence: Pending.

- [ ] T006 Add consistency and secret-path tests.
  - Depends on: T003, T004, T005
  - Files: `tests/`
  - Acceptance: Tests cover `.env*`, safe examples, `.envrc`, credentials,
    secrets, private keys, generated/vendor roots, hidden paths, ignored paths,
    and write strictness.
  - Evidence: Pending.

- [ ] T007 Promote durable docs.
  - Depends on: T002
  - Files: `docs/reference/workspace-safety-contract.md`,
    `docs/security/threat-model.md`
  - Acceptance: Docs name the shared classifier and surface-specific policy
    mappings.
  - Evidence: Pending.

- [ ] T008 Validate and record residual generated-file work.
  - Depends on: T006, T007
  - Files: this spec package, backlog if needed
  - Acceptance: `pnpm typecheck` and targeted path-policy tests pass; EB033
    source-of-truth inference remains separate.
  - Evidence: Pending.

