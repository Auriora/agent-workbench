---
title: Cross-platform packaging tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-29
---

# Tasks

## Task Dependency Graph

```text
T001a resolver ──┬─► T001b resolver unit tests
                 ├─► T002a mcp-launch shim ──► T002b vendor shim ──► T003 .mcp.json (both)
                 └─► T004 installer.mjs ─┬─► T005a npm-install wiring ──► T005b fail-loud errors
                                         └─► T006 retire/delegate .sh
T007 hook exec form
T008 hook in-script default ──► T009 re-sync vendored
T004 + T006 ──► T010a packaging manifests ──► T010b README + npm pack check
T003 + T005b + T009 ──► T011a CI matrix + install smoke ─┬─► T011b MCP launch smoke
                                                         └─► T011c hook execution smoke
T011a-c ──► T012a platform-matrix docs ──► T012b backlog follow-up (turnkey core)
```

> Open decisions 1-4 are resolved in `design.md` (2026-06-29); tasks below
> assume those resolutions (npm-only distribution, `%LOCALAPPDATA%` Windows root,
> documented native-build toolchain, in-script hook default).

## Phase 1: Shared resolver and MCP launch

- [x] T001a Implement the shared install-root resolver.
  - Depends on: none
  - Files: `packaging/agent-workbench/install-root.mjs` (new, exported
    `resolveInstallRoot(env, platform)`)
  - Acceptance: Returns `AGENT_WORKBENCH_INSTALL_ROOT` when set; else
    `$HOME/.local/share/agent-workbench` on POSIX and
    `%LOCALAPPDATA%\agent-workbench` (fallback `%HOME%\AppData\Local\agent-workbench`)
    on `win32` (Decision 3). Pure function, no shell calls.
  - Evidence: `packaging/agent-workbench/install-root.mjs` implemented as a pure
    ESM function using `path.win32`/`path.posix` so it resolves a target OS's
    root from any host. Verified against 5 cases (POSIX default/override, Windows
    LOCALAPPDATA/fallback/override), all correct.

- [x] T001b Unit-test the resolver for both platforms.
  - Depends on: T001a
  - Files: `tests/integration/install-root.test.ts`
  - Acceptance: Covers `win32` and POSIX, and the
    `AGENT_WORKBENCH_INSTALL_ROOT` override, via injected `platform`/`env`.
    Satisfies P3 (default-root parity).
  - Evidence: `npx vitest run tests/integration/install-root.test.ts` →
    9 passed (override on both OSes, POSIX/darwin default, Windows
    LOCALAPPDATA + fallback, cross-host separator parity).

- [ ] T002a Implement the portable MCP launch shim.
  - Depends on: T001a
  - Files: `plugins/agent-workbench/mcp-launch.mjs` (new, source of truth)
  - Acceptance: Resolves install root via T001a and spawns
    `node --import tsx <root>/src/mcp/stdio.ts` inheriting stdio; exits with the
    child's code. No `bash`, no `${VAR:-default}`. Satisfies Requirement 2.2-2.3.
  - Evidence: Pending.

- [ ] T002b Vendor the shim into the Claude plugin copy.
  - Depends on: T002a
  - Files: `plugins/agent-workbench/claude-plugin/mcp-launch.mjs`
  - Acceptance: Copy is generated/synced from the T002a source (not
    hand-maintained) so the two cannot drift; sync mechanism documented or
    wired into the existing vendoring step. Satisfies P2.
  - Evidence: Pending.

- [ ] T003 Switch both `.mcp.json` files to exec-form `node` launch.
  - Depends on: T002b
  - Files: `plugins/agent-workbench/.mcp.json`,
    `plugins/agent-workbench/claude-plugin/.mcp.json`
  - Acceptance: `"command":"node","args":["${CLAUDE_PLUGIN_ROOT}/mcp-launch.mjs"]`;
    no `bash`/`-lc`. Preserves `startup_timeout_sec`. Satisfies Requirement 2.1.
  - Evidence: Pending.

## Phase 2: Cross-platform installer

- [ ] T004 Port the installer to Node (`installer.mjs`).
  - Depends on: T001a
  - Files: `packaging/agent-workbench/installer.mjs` (new)
  - Acceptance: Reproduces `install-agent-workbench-package.sh` steps (validate
    `--source`, resolve root, copy `required_paths`, register plugin, honor
    `--dry-run`/`--skip-codex-config`) using only `node:fs/path/os`. Generates
    `bin/agent-workbench-mcp.mjs` (Node, no bash shebang). Satisfies
    Requirement 1.1-1.2, 2.4.
  - Evidence: Pending.

- [ ] T005a Wire `npm-install.js` to call `installer.mjs` in-process.
  - Depends on: T004
  - Files: `packaging/agent-workbench/npm-install.js`
  - Acceptance: No `spawnSync` of a `.sh`; imports and calls `installer.mjs`
    in-process. Satisfies Requirement 1.1.
  - Evidence: Pending.

- [ ] T005b Make install failures fail loud and actionable.
  - Depends on: T005a
  - Files: `packaging/agent-workbench/npm-install.js`,
    `packaging/agent-workbench/installer.mjs` (error surfaces)
  - Acceptance: On failure, throws/exits with a message naming the missing
    prerequisite and per-OS remediation; never leaves a partial install.
    Satisfies Requirement 1.4, P4.
  - Evidence: Pending.

- [ ] T006 Retire or delegate the legacy `.sh` installer.
  - Depends on: T004
  - Files: `scripts/install-agent-workbench-package.sh`
  - Acceptance: Either removed, or reduced to a thin `exec node .../installer.mjs "$@"`
    delegator so it cannot diverge. Satisfies Requirement 1.3, P2.
  - Evidence: Pending.

## Phase 3: Shell-free hooks

- [ ] T007 [P] Convert hook commands to exec form.
  - Depends on: none
  - Files: `plugins/agent-workbench/claude-plugin/hooks/hooks.json` (and the
    Codex `hooks/hooks.json` if it carries the same inline assignment)
  - Acceptance: `"command":"node","args":["${CLAUDE_PLUGIN_ROOT}/hooks/<hook>.js"]`
    plus `"env":{"AGENT_WORKBENCH_HOOK_FEEDBACK":"basic"}`; no `VAR=value`
    prefix. Satisfies Requirement 3.1, 3.3.
  - Evidence: Pending.

- [ ] T008 Add the in-script feedback-mode default.
  - Depends on: none
  - Files: `plugins/agent-workbench/hooks/session-start.js`,
    `plugins/agent-workbench/hooks/post-edit-feedback.js` (source of truth)
  - Acceptance: Default `AGENT_WORKBENCH_HOOK_FEEDBACK` to `basic` in-process
    when unset, so the hook is correct even if a runtime ignores `env`
    (Decision 4). Satisfies Requirement 3.2.
  - Evidence: Pending.

- [ ] T009 Re-sync vendored Claude hook copies.
  - Depends on: T008
  - Files: `plugins/agent-workbench/claude-plugin/hooks/{session-start.core.js,post-edit-feedback.core.js,hook-common.js}`
  - Acceptance: `npm run sync:claude-hooks` run; byte-identical drift test in
    `tests/integration/claude-plugin.test.ts` stays green. Satisfies P2.
  - Evidence: Pending.

## Phase 4: Packaging metadata and verification

- [ ] T010a Update packaging manifests for the new install model.
  - Depends on: T004, T006
  - Files: `packaging/agent-workbench/npm-package.json`,
    `packaging/agent-workbench/package-manifest.json`, root `package.json` `files`
  - Acceptance: `plugin_install_model` and `files` reference `installer.mjs` and
    `mcp-launch.mjs`; any `.sh` reference updated or removed.
  - Evidence: Pending.

- [ ] T010b Update the README and verify packed contents.
  - Depends on: T010a
  - Files: `packaging/agent-workbench/README.md`
  - Acceptance: README documents the Node install model (npm-only distribution,
    Decision 2). `npm pack --dry-run` includes `installer.mjs`/`mcp-launch.mjs`
    and excludes any retired `.sh`.
  - Evidence: Pending.

- [ ] T011a Add the cross-platform CI matrix and install smoke.
  - Depends on: T003, T005b, T009
  - Files: CI workflow under `.github/workflows/` (or repo CI equivalent)
  - Acceptance: Jobs on windows-latest, macos-latest, ubuntu-latest run the `bin`
    installer; assert files copied and launcher generated. If a Windows runner is
    unavailable, record a manual run instead and note the gap. Satisfies
    Requirement 4.2 (install).
  - Evidence: Pending.

- [ ] T011b MCP launch smoke on all three OSes.
  - Depends on: T011a
  - Files: CI workflow (extends T011a jobs)
  - Acceptance: Server launches from `.mcp.json` on all three OSes; assert stdio
    handshake. Satisfies Requirement 4.2 (launch).
  - Evidence: Pending.

- [ ] T011c Hook execution smoke on all three OSes.
  - Depends on: T011a
  - Files: CI workflow (extends T011a jobs)
  - Acceptance: SessionStart + PostToolUse fire on all three OSes; assert
    advisory output and no shell error. Satisfies Requirement 4.2 (hooks).
  - Evidence: Pending.

- [ ] T012a Document the supported platform matrix.
  - Depends on: T011a, T011b, T011c
  - Files: durable docs (runtime operations / install guide), spec
    `verification.md`
  - Acceptance: Supported OS/Node/toolchain matrix documented, including the core
    `tree-sitter` C++20 toolchain prerequisite (Decision 1) and the caveat that
    grammar packages ship prebuilt binaries. Satisfies Requirement 4.1, 4.3,
    5.2.
  - Evidence: Pending.

- [ ] T012b [follow-up] Route the turnkey-core native build to the backlog.
  - Depends on: T012a
  - Files: `docs/backlog/`
  - Acceptance: Record a bounded follow-up spec for making the core
    `tree-sitter` binding turnkey — option (b1) pin core+grammars to a
    prebuild-publishing line (e.g. 0.22.4) after an ABI/parser regression pass,
    or (b2) add a `prebuildify` matrix to release CI. This is a follow-up
    routing task, not implementation. Satisfies Requirement 5.1.
  - Evidence: Pending.
