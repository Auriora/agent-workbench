---
title: Developer CLI workflow tools requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-07-04
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Introduction

Agent Workbench has repository-owned operational workflows for validation,
local package installs, plugin refresh, packaging checks, MCP smoke tests, and
cache diagnostics. Those workflows are currently spread across `pnpm` scripts,
shell scripts, runbook snippets, package metadata, and ad hoc terminal history.
The new `tools/` scaffold provides a place for a stable developer CLI that can
make repetitive tasks reliable without creating a second runtime or installer
implementation.

This spec defines a project-specific developer CLI for Agent Workbench. The CLI
must be a thin orchestration layer over existing authoritative scripts and
documented commands. It should improve discoverability, command composition,
preflight checks, and failure messages while preserving the single source of
truth for packaging, plugin validation, runtime behavior, and spec lifecycle.

## Durable Source Baseline

- [Codex Agent Workbench plugin and MCP setup](../../runbooks/codex-agent-workbench-plugin.md)
- [Runtime operations design](../../design/runtime-operations-design.md)
- [Coding agent integration design](../../design/coding-agent-integration-design.md)
- [MCP surface design](../../design/mcp-surface-design.md)
- [Graph store design](../../design/graph-store-design.md)
- [Documentation map](../../reference/documentation-map.md)
- [Spec archive index](../../history/spec-archive-index.md)
- [Spec closure log](../../history/spec-closure-log.md)
- Current tooling scaffold: `tools/README.md`, `tools/devcli/README.md`,
  `tools/devcli/pyproject.toml`, and `tools/devcli/src/auriora_dev/cli.py`
- Existing command sources: `package.json`,
  `scripts/validate-agent-workbench-plugin.mjs`, `packaging/agent-workbench/`,
  `.github/workflows/ci.yml`, and `.github/workflows/release-ghcr.yml`.
  This spec adds `scripts/install-agent-workbench-package.sh` as the
  repo-owned local package installer that `awb package install-local` wraps.

## Current Findings

- `tools/devcli` is a generic Python Typer scaffold named `proj-devcli` with a
  `proj` entry point and placeholder commands.
- The scaffold's spec commands reference `docs/spec/...`, while this repository
  uses active spec packages under `docs/specs/<id>/`.
- The repository already owns robust Node, pnpm, shell, and validation scripts.
  The CLI should call those scripts rather than reimplementing their logic.
- Several high-friction workflows are repetitive and drift-prone:
  package validation, package-backed local install, plugin cache refresh,
  installed-plugin status checks, MCP smoke checks, and generated cache
  diagnostics.

## Goals

- Provide a project-specific CLI entry point for Agent Workbench developer
  workflows.
- Replace template placeholder commands with commands that run real repository
  workflows.
- Keep the CLI implementation thin, testable, and explicit about the commands
  it runs.
- Make local package install, plugin refresh, and MCP smoke validation easier
  to repeat safely.
- Add read-only cache inspection for graph/index diagnostics.
- Preserve existing authoritative scripts and package metadata as the source of
  implementation truth.
- Document and test the supported command set.

## Non-Goals

- Do not duplicate installer logic from `scripts/install-agent-workbench-package.sh`.
- Do not duplicate plugin/package validation logic from
  `scripts/validate-agent-workbench-plugin.mjs`.
- Do not implement a second MCP runtime path.
- Do not mutate SQLite caches in the first CLI slice, except by explicitly
  invoking existing runtime/index workflows in later specs.
- Do not push releases, edit GitHub releases, or publish packages without an
  explicit command flag and human-controlled credentials.
- Do not use the CLI as a replacement for durable runbooks or CI workflows.
- Do not retain template-specific `proj` naming or `docs/spec` assumptions.

## Glossary

- **Developer CLI:** The repository-owned command-line interface under
  `tools/devcli` for local maintainers and agents.
- **Authoritative command:** Existing script or package command that owns the
  actual behavior, such as `pnpm test` or
  `scripts/install-agent-workbench-package.sh`.
- **Wrapper command:** CLI command that validates inputs, runs one or more
  authoritative commands, and reports status.
- **Dry run:** Command mode that reports what would run or invokes existing
  dry-run behavior without changing local installs, plugin registrations, or
  releases.
- **Installed runtime:** The package-backed Agent Workbench installation under
  the configured local prefix and plugin cache, distinct from the checkout.

## Requirements

### Requirement 1: Project-Specific CLI Identity

**User Story:** As a maintainer, I want a project-specific CLI name and help
text, so that commands are clearly tied to Agent Workbench rather than a
generic template.

#### Acceptance Criteria

1. GIVEN the CLI package, WHEN it is installed editable from `tools/devcli`,
   THEN it SHALL expose a project-specific command name such as `awb` or
   `agent-workbench-dev`.
2. WHEN a user runs the CLI with no arguments, THEN it SHALL show useful
   Agent Workbench command groups and SHALL NOT show template placeholder text.
3. WHEN package metadata is inspected, THEN it SHALL use an Agent
   Workbench-specific package name, description, and script entry point.
4. IF a backwards-compatible alias is retained, THEN it SHALL be documented as
   temporary and SHALL NOT be the primary command in docs.

### Requirement 2: Command Runner Contract

**User Story:** As a CLI maintainer, I want one command execution layer, so
that every wrapper reports failures consistently and can be tested without
running external tools.

#### Acceptance Criteria

1. GIVEN a wrapper command, WHEN it runs an external command, THEN it SHALL use
   a shared runner that records command, working directory, exit code, and
   elapsed time.
2. IF a command fails, THEN the CLI SHALL stop subsequent dependent commands
   and return a non-zero exit code.
3. WHEN `--dry-run` is passed to a wrapper that supports it, THEN the CLI SHALL
   print the authoritative commands it would run without making unsupported
   local mutations.
4. WHEN command output is streamed, THEN the CLI SHALL preserve enough stdout
   and stderr for debugging without hiding the failed command.
5. WHERE a wrapper calls an existing dry-run option, THE SYSTEM SHALL prefer
   the authoritative dry-run mode over simulating behavior in Python.

### Requirement 3: Local Confidence Check

**User Story:** As a developer preparing a change, I want one check command, so
that I can run the expected local validation suite without remembering every
script.

#### Acceptance Criteria

1. GIVEN `awb check`, WHEN it runs, THEN it SHALL run `pnpm typecheck`,
   `pnpm test`, and `pnpm run validate:plugin` by default.
2. WHEN a user passes focused options, THEN the CLI MAY run a subset such as
   typecheck-only, tests-only, or plugin-only while making the reduced scope
   explicit.
3. IF any check fails, THEN the CLI SHALL return the failing exit code or a
   non-zero aggregate code and SHALL report which stage failed.
4. WHEN all checks pass, THEN the CLI SHALL summarize passed stages.

### Requirement 4: Package Validation

**User Story:** As a package maintainer, I want one package preflight command,
so that package payload and installer drift are caught before local install or
release.

#### Acceptance Criteria

1. GIVEN `awb package check`, WHEN it runs, THEN it SHALL run the repository
   plugin/package validator.
2. WHEN package install behavior is checked, THEN it SHALL call
   `scripts/install-agent-workbench-package.sh --dry-run --skip-codex-config`.
3. WHEN npm payload behavior is checked, THEN it SHALL call `pnpm pack:dry-run`.
4. IF a focused integration test list is configured, THEN package check SHALL
   run those tests or print a clear reason they were skipped.
5. WHEN the command completes, THEN it SHALL summarize validator, installer
   dry-run, package dry-run, and focused test status.

### Requirement 5: Local Package Install

**User Story:** As a local Codex user, I want one install command, so that I
can refresh the package-backed Agent Workbench install predictably.

#### Acceptance Criteria

1. GIVEN `awb package install-local`, WHEN it runs, THEN it SHALL invoke
   `scripts/install-agent-workbench-package.sh` with passed-through supported
   options.
2. WHEN users provide `--prefix`, `--codex-home`, `--skip-codex-config`, or
   `--dry-run`, THEN the CLI SHALL pass them to the installer without
   reinterpreting installer semantics.
3. IF the installer exits non-zero, THEN the CLI SHALL surface the installer
   command and exit code.
4. WHEN install succeeds, THEN the CLI SHALL print the next verification
   command, such as `awb plugin status`.

### Requirement 6: Plugin Refresh And Status

**User Story:** As a maintainer changing plugin files, I want refresh and
status commands, so that installed plugin drift is visible and repairable.

#### Acceptance Criteria

1. GIVEN `awb plugin refresh`, WHEN it runs, THEN it SHALL run the documented
   plugin cachebuster script and `codex plugin add agent-workbench@auriora-local`
   unless `--dry-run` is passed.
2. WHEN refresh completes, THEN the CLI SHALL tell the user whether a Codex
   restart is needed for skills, hooks, MCP tools, and metadata discovery.
3. GIVEN `awb plugin status`, WHEN it runs, THEN it SHALL inspect
   `codex plugin list` and report whether `agent-workbench` appears installed
   and enabled.
4. IF Codex CLI is unavailable, THEN status SHALL return a clear degraded
   result instead of pretending the plugin is installed.
5. The CLI SHALL NOT edit host-level Codex config directly for plugin refresh.

### Requirement 7: MCP Smoke Check

**User Story:** As a runtime maintainer, I want a bounded MCP smoke command, so
that installed/runtime regressions are caught against a chosen repository.

#### Acceptance Criteria

1. GIVEN `awb mcp smoke --repo <path>`, WHEN it runs, THEN it SHALL exercise a
   bounded set of Agent Workbench MCP resources or debug commands for that
   repository.
2. The smoke SHALL include status, scope or overview, and at least one
   tool-like workflow that has historically regressed, such as docs outline or
   context retrieval.
3. WHEN a timeout is configured, THEN each smoke step SHALL respect the timeout
   and report timeout as a failed or degraded step.
4. IF the installed MCP server is unavailable, THEN the CLI SHALL report that
   state separately from repository-analysis failures.
5. The smoke command SHALL avoid broad unbounded indexing as a success
   prerequisite.

### Requirement 8: Cache Inspection

**User Story:** As a maintainer debugging slow or stale tool calls, I want
read-only cache stats, so that I can distinguish healthy snapshots from
historical bloat.

#### Acceptance Criteria

1. GIVEN `awb cache inspect --repo <path>`, WHEN a graph SQLite cache exists,
   THEN the CLI SHALL report database path, size, snapshot count, file count,
   node count, edge count, docs count, freshness breakdown, and latest snapshot
   summary where available.
2. IF the cache does not exist, THEN the CLI SHALL report `missing` without
   creating the cache.
3. The inspect command SHALL be read-only and SHALL NOT run `VACUUM`, prune, or
   rebuild the database.
4. WHEN counts indicate likely historical bloat, THEN the CLI MAY recommend
   existing maintenance or rebuild workflows but SHALL NOT run them by default.
5. The command SHALL tolerate schema drift by reporting unavailable fields
   explicitly instead of crashing on the first missing table.

### Requirement 9: Spec Lifecycle Wrappers

**User Story:** As an agent working on specs, I want local wrappers for spec
lint and summary, so that I can use the repository's active spec layout without
remembering helper script paths.

#### Acceptance Criteria

1. GIVEN `awb spec lint <path>`, WHEN it runs, THEN it SHALL invoke the
   existing spec lifecycle runtime lint command for the requested package.
2. GIVEN `awb spec summary <path>`, WHEN it runs, THEN it SHALL invoke the
   existing spec lifecycle runtime summary command.
3. WHEN no path is supplied, THEN spec commands SHALL either list active specs
   or fail with a clear request for a `docs/specs/<id>` path.
4. The CLI SHALL NOT implement a second spec parser.
5. Template `docs/spec` commands SHALL be removed or replaced with commands
   that understand `docs/specs/<id>` packages.

### Requirement 10: Release Preflight

**User Story:** As a maintainer preparing a release, I want a guarded release
preflight command, so that build and metadata issues are caught before any
push or publish action.

#### Acceptance Criteria

1. GIVEN `awb release preflight`, WHEN it runs, THEN it SHALL check package
   validation, package dry-run, relevant release metadata, and working tree
   status.
2. IF the working tree is dirty, THEN the command SHALL report the dirty state
   and require an explicit flag to continue.
3. The initial release command SHALL NOT push tags, publish npm, publish GHCR,
   or create GitHub releases.
4. Future push or publish subcommands SHALL require explicit flags and SHALL be
   separate from read-only or dry-run preflight.

### Requirement 11: Documentation And Discoverability

**User Story:** As a new contributor or agent, I want the CLI documented in the
repository, so that I can install and use it without reading implementation
files.

#### Acceptance Criteria

1. WHEN the CLI is implemented, THEN `tools/README.md` and
   `tools/devcli/README.md` SHALL document install, command groups, and command
   examples.
2. WHEN CLI commands wrap runbook workflows, THEN the relevant runbook SHALL
   mention the CLI as a convenience wrapper while preserving authoritative
   underlying commands.
3. WHEN package metadata or scripts change, THEN documentation SHALL stay in
   sync with the chosen command name.
4. The documentation SHALL identify which commands mutate local installs,
   plugin registration, or external release state.

### Requirement 12: Tests And CI Safety

**User Story:** As a maintainer, I want CLI tests that do not mutate my local
Codex setup, so that CI and local validation can run safely.

#### Acceptance Criteria

1. GIVEN CLI unit tests, WHEN they run, THEN external commands SHALL be mocked
   or executed only in safe dry-run modes.
2. Tests SHALL cover command composition, failure propagation, dry-run output,
   and path handling.
3. Tests SHALL cover cache inspect against a fixture SQLite database or a
   controlled temporary database.
4. CI SHALL NOT require a real Codex installation, Docker daemon, GitHub
   credentials, npm credentials, or a writable user-level Codex config.
5. The repository validation suite SHALL include a command that tests the CLI
   without mutating user-local state.

## Correctness Properties

- Wrapper commands invoke documented authoritative commands in deterministic
  order.
- Failed dependent stages stop subsequent stages.
- Dry-run mode does not mutate plugin installs, package prefixes, release
  state, or user-level Codex config.
- Cache inspection is read-only.
- Spec lifecycle commands target `docs/specs/<id>` packages, not template
  `docs/spec`.
- CLI tests do not depend on user-local Codex, Docker, npm, GitHub, or plugin
  cache state.

## Success Criteria

- The CLI exposes a project-specific command name.
- Placeholder template commands are replaced or removed.
- `awb check`, `awb package check`, `awb package install-local`,
  `awb plugin status`, `awb mcp smoke`, `awb cache inspect`, and
  `awb spec lint` have implemented behavior or intentionally staged task
  coverage.
- CLI docs describe install, command groups, mutation boundaries, and examples.
- Automated tests cover command composition and safe failure behavior.
- Durable runbook references are updated before spec closure.
