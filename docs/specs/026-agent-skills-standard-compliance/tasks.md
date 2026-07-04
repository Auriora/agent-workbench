---
title: Agent Skills standard compliance tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-07
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
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
    - Evidence: `design.md` records the hybrid target and strict validation for
      checked-in Agent Workbench skills.
  - [x] T001.2 Decide how Brooks-Lint portability should be handled.
    - Evidence: `design.md` records Brooks-Lint as a non-owned Codex-local
      exception until an explicit plugin/package promotion decision exists.
  - [x] T001.3 Record third-party cached skills as non-owned observations.
    - Evidence: `requirements.md`, `research.md`, and `design.md` describe
      third-party cached skills as observation-only, not local CI failures.

- [x] T002 Define owned skill validation rules.
  - Depends on: T001
  - Files: `docs/specs/026-agent-skills-standard-compliance/design.md`,
    `tests/` or `scripts/`
  - Acceptance: Validation rules cover frontmatter, name, description,
    parent-directory match, size threshold, and reference portability according
    to the selected target.
  - Evidence: `docs/specs/026-agent-skills-standard-compliance/design.md`
    records the owned skill roots and validator rules. The implemented script
    checks YAML frontmatter, required `name` and `description`, name syntax,
    parent-directory match, description length, line threshold, and
    skill-root-relative Markdown references.

## Phase 2: Validation

- [x] T003 Add owned skill validation.
  - Depends on: T001, T002
  - Files: `tests/`, `scripts/`, `package.json`,
    `plugins/agent-workbench/skills/agent-workbench/SKILL.md`
  - Acceptance: A repo-owned validation command or Vitest test checks owned
    skills and passes for current checked-in Agent Workbench skills.
  - Evidence: Added `scripts/validate-agent-skills.mjs`, `pnpm run
    validate:skills`, CI wiring, and focused tests in
    `tests/integration/agent-skills-validation.test.ts`. The Claude packaged
    skill copy now includes required `name: agent-workbench` frontmatter.
  - [x] T003.1 Implement the validator without scanning user cache paths in CI.
    - Evidence: Default `pnpm run validate:skills` checks only checked-in
      plugin, Claude, and Kiro skill paths; `.github/workflows/ci.yml` runs
      that default command.
  - [x] T003.2 Add a passing test for the current plugin skill.
    - Evidence: `tests/integration/agent-skills-validation.test.ts` covers a
      valid owned skill and `pnpm run validate:skills` passes for the three
      checked-in packaged Agent Workbench skills.
  - [x] T003.3 Add failure-message coverage if implemented as a script.
    - Evidence: `tests/integration/agent-skills-validation.test.ts` creates an
      invalid temporary skill and asserts the validator reports frontmatter and
      portability failures.

- [x] T004 Add optional advisory audit for local cached skills.
  - Depends on: T002
  - Files: `scripts/`, `docs/runbooks/codex-agent-workbench-plugin.md`
  - Acceptance: Maintainers can run an advisory local audit that reports
    user-cache issues without failing CI or mutating cached files.
  - Evidence: `pnpm run validate:skills -- --advisory-cache` scans
    `CODEX_HOME` or `~/.codex` skill/cache paths when present, reports cache
    findings as warnings, exits 0 when owned skills pass, and does not mutate
    user cache paths.

## Phase 3: Documentation And Packaging Decisions

- [x] T005 Update plugin and runbook documentation.
  - Depends on: T003
  - Files: `plugins/agent-workbench/README.md`,
    `docs/runbooks/codex-agent-workbench-plugin.md`,
    `docs/reference/documentation-map.md`
  - Acceptance: Docs describe owned skill paths, validation commands, the
    selected compliance target, and third-party cache boundaries.
  - Evidence: Updated plugin README, Codex plugin runbook, and documentation
    map with the hybrid compliance model, owned skill paths, `pnpm run
    validate:skills`, advisory cache mode, and third-party cache boundary.

- [x] T006 Resolve Brooks-Lint portability routing.
  - Depends on: T001
  - Files: `docs/specs/026-agent-skills-standard-compliance/research.md`,
    future Brooks-Lint plugin or docs location if selected
  - Acceptance: Brooks-Lint is either explicitly left as a local Codex skill
    set, packaged into a plugin with shared references inside the bundle, or
    given a follow-up spec for restructuring.
  - Evidence: `design.md` and
    `docs/runbooks/codex-agent-workbench-plugin.md` document Brooks-Lint as a
    non-owned Codex-local skill set. Its cross-root shared references remain an
    accepted local exception until Brooks-Lint is explicitly promoted into a
    plugin or repository-owned package.

## Phase 4: Verification And Closure

- [x] T007 Run validation and promote durable decisions.
  - Depends on: T005, T006
  - Files: `docs/specs/026-agent-skills-standard-compliance/verification.md`,
    durable docs changed by this spec
  - Acceptance: Skill validation passes, docs are updated, and unresolved
    portability work has a documented package decision before closure.
  - Evidence: `pnpm run validate:skills`, focused
    `tests/integration/agent-skills-validation.test.ts`, advisory cache audit,
    `pnpm typecheck`, `pnpm run validate:plugin`, `git diff --check`,
    spec lifecycle lint, and full `pnpm test` passed on 2026-07-04. Durable
    docs record the hybrid target and Brooks-Lint package decision.
