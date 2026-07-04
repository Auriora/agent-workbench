---
title: Developer CLI workflow tools tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-07-04
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
    deprecated. Implemented in `tools/devcli/pyproject.toml`,
    `tools/README.md`, and `tools/devcli/README.md`.
  - [x] T001.1 Select primary command name.
  - [x] T001.2 Rename package metadata and script entry point.
  - [x] T001.3 Remove or explicitly deprecate template `proj` naming.

- [x] T002 Add shared runner and repo utilities.
  - Depends on: T001
  - Files: `tools/devcli/src/auriora_dev/runner.py`,
    `tools/devcli/src/auriora_dev/repo.py`, `tools/devcli/tests/`
  - Acceptance: Commands can build deterministic command plans, run dry-run
    output, propagate failures, and discover the repository root.
  - Evidence: Implemented `CommandSpec`, shared runner, dry-run output, failure
    exits, repo-root discovery, and command plan tests. `pnpm test:devcli`
    passed on 2026-07-04.
  - Evidence mode: validation
  - [x] T002.1 Implement command spec model and subprocess runner.
  - [x] T002.2 Implement dry-run rendering.
  - [x] T002.3 Implement repo-root discovery and `--repo-root` override.
  - [x] T002.4 Test success, failure, dry-run, and missing-root behavior.

- [x] T003 Replace template CLI structure with Agent Workbench command groups.
  - Depends on: T002
  - Files: `tools/devcli/src/auriora_dev/cli.py`,
    `tools/devcli/src/auriora_dev/commands/`, `tools/devcli/tests/`
  - Acceptance: CLI help exposes Agent Workbench command groups and no
    placeholder commands remain.
  - Evidence: Replaced template `proj` CLI with `awb` command groups under
    `auriora_dev.commands`; help tests verify placeholder text is absent.
    Removed tracked stale `proj_devcli.egg-info` files.
  - Evidence mode: validation

## Phase 2: Validation And Packaging Commands

- [x] T004 Implement `awb check`.
  - Depends on: T003
  - Files: `tools/devcli/src/auriora_dev/commands/check.py`,
    `tools/devcli/tests/`
  - Acceptance: Default command plan runs `pnpm typecheck`, `pnpm test`, and
    `pnpm run validate:plugin`; focused options and failure propagation are
    tested.
  - Evidence: Implemented `awb check` with typecheck/test/plugin toggles and
    dry-run support. `pnpm test:devcli`, `pnpm typecheck`, `pnpm test`, and
    `pnpm run validate:plugin` passed on 2026-07-04.

- [x] T005 Implement `awb package check`.
  - Depends on: T003
  - Files: `tools/devcli/src/auriora_dev/commands/package.py`,
    `tools/devcli/tests/`
  - Acceptance: Package check wraps plugin validation, installer dry-run,
    package dry-run, and the selected focused integration test policy.
  - Evidence: Implemented package preflight over plugin validation, installer
    dry-run, npm pack dry-run, and optional focused integration tests. Live
    `awb package check` passed on 2026-07-04.

- [x] T006 Implement `awb package install-local`.
  - Depends on: T003
  - Files: `tools/devcli/src/auriora_dev/commands/package.py`,
    `tools/devcli/tests/`
  - Acceptance: CLI passes supported installer options through to
    `scripts/install-agent-workbench-package.sh` and supports dry-run.
  - Evidence: Added `scripts/install-agent-workbench-package.sh` and wrapper
    option pass-through for `--prefix`, `--codex-home`,
    `--skip-codex-config`, and `--dry-run`. Installer dry-run passed on
    2026-07-04.

## Phase 3: Plugin, MCP, Cache, And Spec Commands

- [x] T007 Implement `awb plugin status` and `awb plugin refresh`.
  - Depends on: T003
  - Files: `tools/devcli/src/auriora_dev/commands/plugin.py`,
    `tools/devcli/tests/`
  - Acceptance: Status is read-only and tolerant of missing Codex CLI; refresh
    supports dry-run, cachebuster, plugin add, and restart guidance.
  - Evidence: Implemented read-only status with degraded Codex-unavailable
    handling and refresh plan over cachebuster plus `codex plugin add`.
    Command plan tests passed in `pnpm test:devcli` on 2026-07-04.

- [x] T008 Implement `awb mcp smoke`.
  - Depends on: T003
  - Files: `tools/devcli/src/auriora_dev/commands/mcp.py`,
    `src/debug/` if a narrow smoke helper is required, `tools/devcli/tests/`
  - Acceptance: Smoke command checks bounded status/scope/overview and one
    tool-like workflow against a target repo with timeout reporting.
  - Evidence: Implemented bounded smoke over `debug:mcp-status` plus
    `debug:mcp-use-case` scope, overview, and context steps. Dry-run passed in
    sandbox; live smoke passed outside sandbox after `tsx` IPC was blocked by
    sandbox `EPERM`.

- [x] T009 Implement `awb cache inspect`.
  - Depends on: T003
  - Files: `tools/devcli/src/auriora_dev/commands/cache.py`,
    `tools/devcli/tests/fixtures/`
  - Acceptance: Cache inspect reads graph SQLite metadata read-only, reports
    core counts and freshness, tolerates missing schema, and supports JSON.
  - Evidence: Implemented read-only SQLite inspection with missing database,
    JSON, live-schema aliases, and unavailable-field tolerance. Unit tests and
    live cache JSON smoke passed on 2026-07-04.

- [x] T010 Implement `awb spec` wrappers.
  - Depends on: T003
  - Files: `tools/devcli/src/auriora_dev/commands/spec.py`,
    `tools/devcli/tests/`
  - Acceptance: Spec commands target `docs/specs/<id>` packages and invoke the
    existing spec lifecycle runtime for scan, summary, and lint.
  - Evidence: Implemented `awb spec list`, `summary`, and `lint` wrappers over
    the existing spec lifecycle runtime. `awb spec lint
    docs/specs/028-dev-cli-workflow-tools` passed on 2026-07-04.

- [x] T011 Implement `awb doctor` and `awb release preflight`.
  - Depends on: T003
  - Files: `tools/devcli/src/auriora_dev/commands/doctor.py`,
    `tools/devcli/src/auriora_dev/commands/release.py`,
    `tools/devcli/tests/`
  - Acceptance: Doctor reports local toolchain state; release preflight is
    read-only/dry-run and does not push, tag, publish, or create releases.
  - Evidence: Implemented read-only doctor and release preflight with dirty-tree
    guard, package metadata checks, package preflight reuse, and no publish or
    push steps. Command plan tests passed in `pnpm test:devcli`.

## Phase 4: Test And Validation Integration

- [x] T012 Add CLI test command and repository validation hook.
  - Depends on: T004, T005, T006, T007, T008, T009, T010, T011
  - Files: `tools/devcli/pyproject.toml`, `package.json`,
    `.github/workflows/ci.yml`, `tools/devcli/tests/`
  - Acceptance: There is a documented command to run CLI tests, and any CI
    integration avoids user-local Codex, Docker, GitHub, npm, or plugin cache
    dependencies.
  - Evidence: Added `pnpm test:devcli`, using standard-library `unittest` plus
    Typer's test runner to avoid a new Python test dependency. CI integration
    was intentionally not added in this slice; the documented local command is
    safe and does not require Codex, Docker, GitHub, npm credentials, or user
    plugin cache writes.
  - Evidence mode: validation
  - [x] T012.1 Decide pytest versus standard-library test runner.
  - [x] T012.2 Add local test command.
  - [-] T012.3 Add CI integration only if safe.

- [x] T013 Run validation.
  - Depends on: T012
  - Files: `docs/specs/028-dev-cli-workflow-tools/verification.md`
  - Acceptance: CLI tests, `pnpm typecheck`, relevant package validation, and
    spec lifecycle lint pass or have documented waivers.
  - Evidence: `pnpm test:devcli`, `awb package check`, `awb spec lint
    docs/specs/028-dev-cli-workflow-tools`, `pnpm run validate:plugin`,
    `git diff --check`, `pnpm typecheck`, `pnpm test`, and live `awb mcp
    smoke --repo . --timeout 30` passed on 2026-07-04.

## Phase 5: Documentation And Promotion

- [x] T014 Promote CLI usage to durable docs and close readiness.
  - Depends on: T013
  - Files: `tools/README.md`, `tools/devcli/README.md`,
    `docs/runbooks/codex-agent-workbench-plugin.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/028-dev-cli-workflow-tools/verification.md`
  - Acceptance: Durable docs describe install, commands, mutation boundaries,
    validation, and authoritative underlying commands; residual work is routed.
  - Evidence: Updated `tools/README.md`, `tools/devcli/README.md`,
    `docs/runbooks/install-agent-workbench.md`,
    `docs/runbooks/codex-agent-workbench-plugin.md`, and
    `docs/reference/documentation-map.md` with `awb` commands, mutation
    boundaries, underlying command authority, and validation guidance.
