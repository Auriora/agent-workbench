---
title: Agent Skills standard compliance tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-07
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002
T001 -> T003
T002,T003 -> T004
T004 -> T005
T004 -> T006
T005,T006 -> T007
```

## Phase 1: Decision And Scope

- [x] T001 Record the compliance target decision.
  - Files: `docs/specs/026-agent-skills-standard-compliance/design.md`,
    `docs/runbooks/codex-agent-workbench-plugin.md`
  - Acceptance: The repo states whether it targets strict Agent Skills
    portability, Codex-local compatibility, or a hybrid model.
  - Evidence: Hybrid target recorded in design.md (Compliance Levels and
    Brooks-Lint Portability Decision sections): owned checked-in skills are
    strict, Brooks-Lint stays Codex-local with a documented exception,
    third-party cached skills are observation-only.
  - [x] T001.1 Decide the target for checked-in Agent Workbench skills.
  - [x] T001.2 Decide how Brooks-Lint portability should be handled.
  - [x] T001.3 Record third-party cached skills as non-owned observations.

- [ ] T002 Define owned skill validation rules.
  - Depends on: T001
  - Files: `docs/specs/026-agent-skills-standard-compliance/design.md`,
    `tests/` or `scripts/`
  - Acceptance: Validation rules cover frontmatter, name, description,
    parent-directory match, size threshold, and reference portability according
    to the selected target.
  - Evidence: Pending.

## Phase 2: Validation

- [ ] T003 Add owned skill validation.
  - Depends on: T001, T002
  - Files: `tests/`, `scripts/`, `package.json`,
    `plugins/agent-workbench/skills/agent-workbench/SKILL.md`
  - Acceptance: A repo-owned validation command or Vitest test checks owned
    skills and passes for current checked-in Agent Workbench skills.
  - Evidence: Pending.
  - [ ] T003.1 Implement the validator without scanning user cache paths in CI.
  - [ ] T003.2 Add a passing test for the current plugin skill.
  - [ ] T003.3 Add failure-message coverage if implemented as a script.

- [ ] T004 Add optional advisory audit for local cached skills.
  - Depends on: T002
  - Files: `scripts/`, `docs/runbooks/codex-agent-workbench-plugin.md`
  - Acceptance: Maintainers can run an advisory local audit that reports
    user-cache issues without failing CI or mutating cached files.
  - Evidence: Pending.

## Phase 3: Documentation And Packaging Decisions

- [ ] T005 Update plugin and runbook documentation.
  - Depends on: T003
  - Files: `plugins/agent-workbench/README.md`,
    `docs/runbooks/codex-agent-workbench-plugin.md`,
    `docs/reference/documentation-map.md`
  - Acceptance: Docs describe owned skill paths, validation commands, the
    selected compliance target, and third-party cache boundaries.
  - Evidence: Pending.

- [ ] T006 Resolve Brooks-Lint portability routing.
  - Depends on: T001
  - Files: `docs/specs/026-agent-skills-standard-compliance/research.md`,
    future Brooks-Lint plugin or docs location if selected
  - Acceptance: Brooks-Lint is either explicitly left as a local Codex skill
    set, packaged into a plugin with shared references inside the bundle, or
    given a follow-up spec for restructuring.
  - Evidence: Pending.

## Phase 4: Verification And Closure

- [ ] T007 Run validation and promote durable decisions.
  - Depends on: T005, T006
  - Files: `docs/specs/026-agent-skills-standard-compliance/verification.md`,
    durable docs changed by this spec
  - Acceptance: Skill validation passes, docs are updated, and unresolved
    portability work is routed to a follow-up task or spec before closure.
  - Evidence: Pending.
