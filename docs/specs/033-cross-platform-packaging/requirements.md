---
title: Cross-platform packaging requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-29
---

# Requirements

## Introduction

Agent Workbench installs, launches its MCP server, and runs its Claude/Codex
plugin hooks through a POSIX-shell command layer. Every distribution and
runtime entry point assumes `bash`, a POSIX `${VAR:-default}` expansion, an
inline `VAR=value cmd` assignment, a `#!/usr/bin/env bash` shebang, or a `.sh`
installer. The hook and MCP business logic is already portable JavaScript; only
the shell/launcher/installer layer is Unix-only. As a result the package
installs and runs on Linux and (with prerequisites) macOS, but cannot install or
launch on Windows.

This spec makes the package install, launch, and run on Windows, macOS, and
Linux from the same artifacts. The unifying design principle is to **remove the
shell from the command layer**: every installer, MCP launcher, and hook entry
point becomes a bare interpreter invocation of a cross-platform script
(`node <script>`), with the default-path resolution and environment defaults
moved *into* the script. This collapses most per-OS blockers into one portable
mechanism rather than adding a parallel Windows shell layer.

## Durable Source Baseline

- `packaging/agent-workbench/npm-install.js` (line 8 resolves a `.sh` installer;
  line 39 `spawnSync(installer, ...)` executes it)
- `scripts/install-agent-workbench-package.sh` (`#!/usr/bin/env bash` installer;
  lines 302-311 generate `bin/agent-workbench-mcp` as a `#!/usr/bin/env bash`
  launcher that runs `exec node --import tsx .../src/mcp/stdio.ts`)
- `plugins/agent-workbench/.mcp.json` and
  `plugins/agent-workbench/claude-plugin/.mcp.json` (`"command": "bash"`,
  `args: ["-lc", "exec \"${AGENT_WORKBENCH_INSTALL_ROOT:-$HOME/.local/share/agent-workbench}/bin/agent-workbench-mcp\""]`)
- `plugins/agent-workbench/claude-plugin/hooks/hooks.json` (hook commands use the
  POSIX inline assignment `AGENT_WORKBENCH_HOOK_FEEDBACK=basic node "..."`)
- `packaging/agent-workbench/npm-package.json` and `package-manifest.json`
  (declare the `.sh` installer as the `plugin_install_model`)
- [Runtime operations design](../../design/runtime-operations-design.md)
- [Threat model](../../security/threat-model.md)

## Goals

- Install the npm package and host launcher on Windows, macOS, and Linux without
  a POSIX shell on PATH.
- Launch the MCP server from `.mcp.json` on all three OSes using a direct
  interpreter invocation rather than a `bash -lc` wrapper.
- Run the Claude/Codex plugin hooks on all three OSes without inline POSIX
  environment assignment.
- Keep one source of truth per concern; do not fork a parallel Windows-only
  installer/launcher/hook layer that can drift from the Unix one.
- Document and test the supported-platform matrix so portability is verified,
  not assumed.

## Non-Goals

- Do not change the hook or MCP business logic; it is already portable.
- Do not drop Linux/macOS support or change the default Unix install location.
- Do not, in this spec, deliver prebuilt native `tree-sitter` binaries for
  Windows. Cross-platform native build is bounded as an explicit open decision
  (see Requirement 5) and may be deferred to a follow-up spec; this spec must at
  minimum document the required toolchain and detect/report its absence.
- Do not require Windows users to install WSL, Git Bash, MSYS2, or Cygwin to use
  the package.

## Requirements

### Requirement 1: Shell-Free Installer

**User Story:** As a Windows user, I want `npx` install to run, so that I can
install Agent Workbench without a POSIX shell.

#### Acceptance Criteria

1. GIVEN a host with only Node.js (no `bash`/`sh` on PATH), WHEN the user runs
   the package `bin` installer, THEN THE SYSTEM SHALL perform the install
   without spawning a `.sh` script.
2. WHEN the installer copies runtime files, generates the launcher, and
   registers the plugin, THEN it SHALL use one cross-platform implementation
   shared by Windows, macOS, and Linux.
3. WHERE the legacy `scripts/install-agent-workbench-package.sh` is retained for
   existing Unix workflows, THE SYSTEM SHALL keep it behavior-equivalent to the
   cross-platform installer or delegate to it, so the two cannot diverge.
4. IF a required interpreter (Node, and any documented build toolchain) is
   missing, THEN the installer SHALL fail with an actionable message naming the
   missing prerequisite and the platform-specific remediation.

### Requirement 2: Shell-Free MCP Launcher

**User Story:** As a plugin user on any OS, I want the MCP server to start from
`.mcp.json`, so that Workbench tools load without a `bash` wrapper.

#### Acceptance Criteria

1. WHEN Claude Code or Codex launches the MCP server from `.mcp.json`, THEN THE
   SYSTEM SHALL invoke an interpreter directly (no `bash -lc` wrapper and no
   POSIX-only `${VAR:-default}` expansion in the command string).
2. WHERE the install root must default to `$HOME/.local/share/agent-workbench`
   (or its per-OS equivalent), THE SYSTEM SHALL resolve that default inside the
   launched script, not in the shell command string.
3. WHEN `AGENT_WORKBENCH_INSTALL_ROOT` is set, THEN the launcher SHALL honor it
   on all three OSes.
4. WHEN the generated host launcher (`bin/agent-workbench-mcp` or its
   cross-platform replacement) is invoked, THEN it SHALL start the server on
   Windows without relying on a `#!/usr/bin/env bash` shebang or executable bit.

### Requirement 3: Shell-Free Hook Commands

**User Story:** As a plugin user on any OS, I want the SessionStart and
PostToolUse hooks to run, so that I get Workbench feedback regardless of shell.

#### Acceptance Criteria

1. WHEN a hook command in `hooks.json` runs, THEN it SHALL NOT use POSIX inline
   environment assignment (`VAR=value node ...`).
2. WHERE a hook needs a default feedback mode, THE SYSTEM SHALL resolve that
   default inside the hook script when the environment variable is unset.
3. WHEN the hook command references the plugin root, THEN it SHALL use the
   runtime-provided `${CLAUDE_PLUGIN_ROOT}` token in a form the runtime expands
   on every OS (no shell-dependent expansion).
4. WHEN the same hooks run under Codex and Claude Code on all three OSes, THEN
   they SHALL produce equivalent advisory output.

### Requirement 4: Verified Platform Matrix

**User Story:** As a maintainer, I want the supported platforms verified, so
that "cross-platform" reflects executed runs rather than static review.

#### Acceptance Criteria

1. THE SYSTEM SHALL document the supported platform/interpreter matrix (OS
   versions, Node version floor, and any build toolchain) in durable docs.
2. WHEN portability changes land, THEN install, MCP launch, and hook execution
   SHALL be exercised on Windows, macOS, and Linux via CI or recorded manual
   runs, and the evidence SHALL be captured in `verification.md`.
3. IF a platform is supported with caveats (for example, native build
   prerequisites), THEN those caveats SHALL be stated explicitly rather than
   implied by Unix-clean code.

### Requirement 5: Bounded Native Build Decision

**User Story:** As a maintainer, I want the native `tree-sitter` build scope
bounded, so that the heavy toolchain concern does not silently swamp the shell
fixes.

#### Acceptance Criteria

1. THE SYSTEM SHALL record, as an explicit open decision, whether cross-platform
   native build is in-scope here or deferred to a follow-up spec, with the
   chosen distribution strategy (prebuilt binaries, optional rebuild, or
   documented toolchain prerequisite).
2. WHERE native modules must rebuild on the user's machine because the tarball
   excludes `node_modules`, THE SYSTEM SHALL document the required per-OS build
   toolchain (for example, MSVC Build Tools on Windows, Xcode CLT on macOS).
3. IF the native build is unavailable, THEN install SHALL fail with an
   actionable message rather than producing a half-installed runtime.

## Correctness Properties

- **P1 Shell independence:** No install, launch, or hook entry point requires a
  POSIX shell, inline env assignment, or a bash shebang on any supported OS.
- **P2 Single source of truth:** Each concern (install, launch, hook) has one
  cross-platform implementation; any retained Unix variant is delegated or
  proven equivalent, never independently maintained.
- **P3 Default-root parity:** The resolved install root for a given environment
  is identical whether computed on Windows, macOS, or Linux for the same inputs.
- **P4 Fail-loud prerequisites:** A missing interpreter or build toolchain
  yields an actionable error, never a silent partial install or silent no-op
  launch.

## Success Criteria

- `npx`/`bin` install completes on a Windows host with only Node.js installed
  (plus any documented build toolchain).
- The MCP server launches from `.mcp.json` and hooks fire on Windows, macOS, and
  Linux from the same packaged artifacts.
- The platform matrix and native-build decision are documented in durable docs,
  and install/launch/hook runs are evidenced in `verification.md`.
