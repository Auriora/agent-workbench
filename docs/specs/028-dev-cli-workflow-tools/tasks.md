---
title: Developer CLI workflow tools tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-14
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003
T003 -> T004
T003 -> T005
T003 -> T006
T003 -> T007
T003 -> T008
T003 -> T009
T003 -> T010
T003 -> T011
T004,T005,T006,T007,T008,T009,T010,T011 -> T012
T012 -> T013
T013 -> T014
```

## Phase 1: CLI Foundation

- [x] T001 Decide CLI identity and install contract.
  - Files: `tools/devcli/pyproject.toml`, `tools/README.md`,
    `tools/devcli/README.md`
  - Acceptance: The primary command name, optional alias policy, package name,
    and editable install command are documented.
  - Evidence: Decision recorded in design.md (Command Groups and Package
    Identity sections): primary command `awb`, no secondary alias, package
    name `agent-workbench-devcli`, `proj` removed outright rather than
    deprecated. Actual rename of pyproject.toml lands with T002/T003.
  - [x] T001.1 Select primary command name.
  - [x] T001.2 Rename package metadata and script entry point.
  - [x] T001.3 Remove or explicitly deprecate template `proj` naming.

- [ ] T002 Add shared runner and repo utilities.
  - Depends on: T001
  - Files: `tools/devcli/src/auriora_dev/runner.py`,
    `tools/devcli/src/auriora_dev/repo.py`, `tools/devcli/tests/`
  - Acceptance: Commands can build deterministic command plans, run dry-run
    output, propagate failures, and discover the repository root.
  - Evidence: Pending.
  - [ ] T002.1 Implement command spec model and subprocess runner.
  - [ ] T002.2 Implement dry-run rendering.
  - [ ] T002.3 Implement repo-root discovery and `--repo-root` override.
  - [ ] T002.4 Test success, failure, dry-run, and missing-root behavior.

- [ ] T003 Replace template CLI structure with Agent Workbench command groups.
  - Depends on: T002
  - Files: `tools/devcli/src/auriora_dev/cli.py`,
    `tools/devcli/src/auriora_dev/commands/`, `tools/devcli/tests/`
  - Acceptance: CLI help exposes Agent Workbench command groups and no
    placeholder commands remain.
  - Evidence: Pending.

## Phase 2: Validation And Packaging Commands

- [ ] T004 Implement `awb check`.
  - Depends on: T003
  - Files: `tools/devcli/src/auriora_dev/commands/check.py`,
    `tools/devcli/tests/`
  - Acceptance: Default command plan runs `pnpm typecheck`, `pnpm test`, and
    `pnpm run validate:plugin`; focused options and failure propagation are
    tested.
  - Evidence: Pending.

- [ ] T005 Implement `awb package check`.
  - Depends on: T003
  - Files: `tools/devcli/src/auriora_dev/commands/package.py`,
    `tools/devcli/tests/`
  - Acceptance: Package check wraps plugin validation, installer dry-run,
    package dry-run, and the selected focused integration test policy.
  - Evidence: Pending.

- [ ] T006 Implement `awb package install-local`.
  - Depends on: T003
  - Files: `tools/devcli/src/auriora_dev/commands/package.py`,
    `tools/devcli/tests/`
  - Acceptance: CLI passes supported installer options through to
    `scripts/install-agent-workbench-package.sh` and supports dry-run.
  - Evidence: Pending.

## Phase 3: Plugin, MCP, Cache, And Spec Commands

- [ ] T007 Implement `awb plugin status` and `awb plugin refresh`.
  - Depends on: T003
  - Files: `tools/devcli/src/auriora_dev/commands/plugin.py`,
    `tools/devcli/tests/`
  - Acceptance: Status is read-only and tolerant of missing Codex CLI; refresh
    supports dry-run, cachebuster, plugin add, and restart guidance.
  - Evidence: Pending.

- [ ] T008 Implement `awb mcp smoke`.
  - Depends on: T003
  - Files: `tools/devcli/src/auriora_dev/commands/mcp.py`,
    `src/debug/` if a narrow smoke helper is required, `tools/devcli/tests/`
  - Acceptance: Smoke command checks bounded status/scope/overview and one
    tool-like workflow against a target repo with timeout reporting.
  - Evidence: Pending.

- [ ] T009 Implement `awb cache inspect`.
  - Depends on: T003
  - Files: `tools/devcli/src/auriora_dev/commands/cache.py`,
    `tools/devcli/tests/fixtures/`
  - Acceptance: Cache inspect reads graph SQLite metadata read-only, reports
    core counts and freshness, tolerates missing schema, and supports JSON.
  - Evidence: Pending.

- [ ] T010 Implement `awb spec` wrappers.
  - Depends on: T003
  - Files: `tools/devcli/src/auriora_dev/commands/spec.py`,
    `tools/devcli/tests/`
  - Acceptance: Spec commands target `docs/specs/<id>` packages and invoke the
    existing spec lifecycle runtime for scan, summary, and lint.
  - Evidence: Pending.

- [ ] T011 Implement `awb doctor` and `awb release preflight`.
  - Depends on: T003
  - Files: `tools/devcli/src/auriora_dev/commands/doctor.py`,
    `tools/devcli/src/auriora_dev/commands/release.py`,
    `tools/devcli/tests/`
  - Acceptance: Doctor reports local toolchain state; release preflight is
    read-only/dry-run and does not push, tag, publish, or create releases.
  - Evidence: Pending.

## Phase 4: Test And Validation Integration

- [ ] T012 Add CLI test command and repository validation hook.
  - Depends on: T004, T005, T006, T007, T008, T009, T010, T011
  - Files: `tools/devcli/pyproject.toml`, `package.json`,
    `.github/workflows/ci.yml`, `tools/devcli/tests/`
  - Acceptance: There is a documented command to run CLI tests, and any CI
    integration avoids user-local Codex, Docker, GitHub, npm, or plugin cache
    dependencies.
  - Evidence: Pending.
  - [ ] T012.1 Decide pytest versus standard-library test runner.
  - [ ] T012.2 Add local test command.
  - [ ] T012.3 Add CI integration only if safe.

- [ ] T013 Run validation.
  - Depends on: T012
  - Files: `docs/specs/028-dev-cli-workflow-tools/verification.md`
  - Acceptance: CLI tests, `pnpm typecheck`, relevant package validation, and
    spec lifecycle lint pass or have documented waivers.
  - Evidence: Pending.

## Phase 5: Documentation And Promotion

- [ ] T014 Promote CLI usage to durable docs and close readiness.
  - Depends on: T013
  - Files: `tools/README.md`, `tools/devcli/README.md`,
    `docs/runbooks/codex-agent-workbench-plugin.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/028-dev-cli-workflow-tools/verification.md`
  - Acceptance: Durable docs describe install, commands, mutation boundaries,
    validation, and authoritative underlying commands; residual work is routed.
  - Evidence: Pending.
