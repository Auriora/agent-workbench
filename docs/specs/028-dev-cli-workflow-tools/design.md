---
title: Developer CLI workflow tools design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-14
---

# Design

## Overview

The developer CLI should be a Python Typer package under `tools/devcli` that
provides stable, project-specific command groups for common Agent Workbench
maintenance workflows. It must be a thin orchestration layer. The existing
Node, pnpm, shell, package, and spec lifecycle commands remain authoritative
for their domains.

The initial CLI should prioritize low-risk commands that compose existing local
validation and packaging workflows. Commands that mutate local installs or
plugin registrations must be explicit and support dry-run where the underlying
workflow supports it. Commands that inspect caches or status should be
read-only.

## High-Level Design

### Command Groups

```text
awb
  check
  doctor
  package
    check
    install-local
  plugin
    status
    refresh
  mcp
    smoke
  cache
    inspect
  spec
    list
    summary
    lint
  release
    preflight
```

**Decision:** the primary command is `awb`. No secondary alias is installed;
`proj` is removed entirely rather than deprecated, since it was scaffold-only
and nothing external depends on it. Documentation uses `awb` exclusively.

### Architecture

```text
tools/devcli/src/auriora_dev/
  cli.py              Typer app composition and top-level commands
  runner.py           shared subprocess runner and dry-run support
  repo.py             repo-root discovery and path normalization
  commands/
    check.py          typecheck/test/plugin validation orchestration
    package.py        package validation and local install wrappers
    plugin.py         Codex plugin status and refresh wrappers
    mcp.py            bounded MCP smoke checks
    cache.py          read-only graph SQLite inspection
    spec.py           spec lifecycle runtime wrappers
    release.py        release preflight checks
    doctor.py         local toolchain diagnostics
```

This split avoids a growing single-file CLI and makes command composition
testable. The implementation may start with fewer files if tests remain clear,
but the design target is command modules plus shared runner/repo utilities.

### Data Flow

```text
CLI args
  -> Typer command handler
  -> repo root and option validation
  -> command plan
  -> shared runner executes authoritative command(s)
  -> stage summary and exit code
```

Read-only inspection commands use direct structured reads only where no
authoritative command exists. `cache inspect` is the main example: it can read
SQLite metadata directly because the goal is inspection, not mutation.

## Low-Level Design

### Package Identity

Update `tools/devcli/pyproject.toml`:

- package name: `agent-workbench-devcli`
- description: Agent Workbench developer CLI
- script entry point: `awb = "auriora_dev.cli:app"`
- no secondary script alias

Update help text and READMEs to remove template language.

### Shared Runner

The runner should accept:

```python
@dataclass(frozen=True)
class CommandSpec:
    argv: tuple[str, ...]
    cwd: Path
    label: str
    mutates: bool = False
    timeout_seconds: int | None = None
```

The runner should provide:

- dry-run printing
- elapsed time
- stage labels
- streamed stdout/stderr by default
- non-zero exit propagation
- test seam for mocked command execution

The CLI should not hide the exact command. Every failure should show the label,
argv, working directory, and exit code.

### Repository Root Discovery

Root discovery should resolve from the installed CLI package path first, then
walk upward until it finds repository markers:

- `package.json` with `@auriora/agent-workbench`
- `pnpm-lock.yaml`
- `scripts/install-agent-workbench-package.sh`
- `docs/`

Commands should accept `--repo-root` for tests and unusual invocation contexts.
If no root is found, fail with a clear message.

### `awb check`

Default plan:

```text
pnpm typecheck
pnpm test
pnpm run validate:plugin
```

Options:

- `--typecheck/--no-typecheck`
- `--tests/--no-tests`
- `--plugin/--no-plugin`
- `--dry-run`

If all stages are disabled, fail with a usage error.

### `awb package check`

Default plan:

```text
pnpm run validate:plugin
scripts/install-agent-workbench-package.sh --dry-run --skip-codex-config
pnpm pack:dry-run
pnpm exec vitest run tests/integration/codex-integration-profile.test.ts tests/integration/common-integration-profile.test.ts
```

The focused integration tests can be optional behind `--with-integration` if
the team wants faster default package checks. The first implementation should
make the default explicit and document it.

### `awb package install-local`

Wrapper for:

```text
scripts/install-agent-workbench-package.sh [options]
```

Supported options:

- `--prefix <path>`
- `--codex-home <path>`
- `--skip-codex-config`
- `--dry-run`

The CLI should not inspect or rewrite installer internals. It should pass
supported options through and report the next status command on success.

### `awb plugin status`

Read-only command:

```text
codex plugin list
```

Parse enough output to report:

- Codex CLI available or unavailable
- `agent-workbench` installed or missing
- enabled or not clearly enabled
- installed source string if visible

Do not fail CI when Codex is unavailable unless the command is explicitly run
as a required local check.

### `awb plugin refresh`

Plan:

```text
python3 /home/bcherrington/.codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py plugins/agent-workbench
codex plugin add agent-workbench@auriora-local
```

This command mutates local plugin registration and should:

- support `--dry-run`
- print mutation warning before running
- avoid editing `~/.codex/config.toml`
- print restart guidance after success

The hard-coded cachebuster helper path is acceptable only if it is already the
documented repo workflow. A follow-up can make this path configurable or vendor
a repo-owned cachebuster helper if needed.

### `awb mcp smoke`

The first implementation should use existing debug scripts instead of opening a
new MCP client implementation unless a direct client is already available.
Candidate plan:

```text
pnpm debug:mcp-status -- <repo>
pnpm debug:mcp-use-case -- <repo> ...
```

If current debug scripts do not support the exact smoke shape, this task should
first add narrow options to those scripts or add a dedicated smoke script under
`src/debug/`, then wrap it from the CLI.

Smoke steps:

- runtime status
- repo scope or overview
- docs outline against a small known docs path when available
- context or verification-plan call with bounded input

Each step should have a timeout. Failures should distinguish:

- MCP server unavailable
- repository path invalid
- timeout
- tool response degraded
- tool response failed

### `awb cache inspect`

This command may read SQLite directly because it is a diagnostic inspection
tool. It must open the database read-only where possible.

Inputs:

- `--repo <path>`
- `--db <path>` override for fixture tests or unusual cache location
- `--json` for machine-readable output

Reported fields:

- database path
- file size
- table availability
- snapshots count
- snapshots by freshness
- latest snapshot id, freshness, created time if available
- files count
- nodes count
- edges count
- unresolved references count
- docs count
- node/doc FTS row counts if available
- likely bloat warning when historical counts are much larger than the latest
  snapshot counts

The implementation should tolerate missing tables by reporting `unavailable`
for that metric.

### `awb spec`

Replace template `docs/spec` behavior with wrappers for active package paths:

```text
awb spec list
awb spec summary docs/specs/028-dev-cli-workflow-tools
awb spec lint docs/specs/028-dev-cli-workflow-tools
```

Implementation should call the existing spec lifecycle runtime helper when
available:

```text
python3 <spec-lifecycle-manager>/scripts/spec_runtime.py scan .
python3 <spec-lifecycle-manager>/scripts/spec_runtime.py summary <path>
python3 <spec-lifecycle-manager>/scripts/spec_runtime.py lint <path>
```

The helper path can be configured through an environment variable, with the
documented local plugin path as the default if that is acceptable for this repo.

### `awb release preflight`

Initial command should be read-only or dry-run:

- check working tree status
- run `awb package check`
- inspect package version from `package.json` and package metadata
- verify GHCR workflow and containerfile paths exist
- optionally build Docker image only behind `--with-docker-build`

Do not push, tag, publish, or create releases in this spec's first
implementation.

### `awb doctor`

Read-only diagnostics:

- Python version
- Node version
- pnpm version
- Codex CLI availability
- Docker availability, optional
- native module presence or rebuild recommendation
- editable CLI install hint

Doctor should be informational by default and fail only for explicitly required
checks.

## Error Handling

- Usage errors should return code 2 through Typer defaults.
- Failed external commands should return the external command's exit code when
  practical.
- Aggregated failures should return code 1 and list all failed independent
  stages.
- Commands that require unavailable optional tools should return a clear
  degraded or unavailable message.
- Mutating commands should identify mutation scope before execution.

## Test Strategy

Use Python tests for the CLI package. Add `pytest` as a dev dependency for
`tools/devcli` or use a small standard-library test harness if the repository
wants fewer dependencies. The recommended route is `pytest` because command
composition and Typer CLI behavior are easier to test.

Test categories:

- CLI help and command discovery
- runner dry-run and failure propagation
- command plan construction for check/package/plugin/release
- pass-through option handling for install-local
- cache inspect against fixture SQLite
- spec command path handling
- no user-local mutation in tests

Repository-level validation should include a pnpm or documented command to run
the Python CLI tests, but CI should not require Codex, Docker, npm publish, or
GitHub credentials.

## Operational Considerations

- Keep the CLI package independent from runtime TypeScript source.
- Do not add Python dependencies to the Node runtime package.
- Keep generated caches and build artifacts out of Git.
- Document any commands that mutate local machine state.
- Prefer dry-run-first flows for package and release workflows.
- Keep shell quoting simple by passing argv arrays to subprocess, not shell
  strings.

## Open Questions

- Should `awb package check` run focused integration tests by default, or gate
  them behind `--with-integration`?
- Should the plugin cachebuster helper remain an external Codex skill path or
  be moved into repo-owned tooling?
- Should CLI tests be run through a new `pnpm` script, a Python `pytest`
  command, or both?
