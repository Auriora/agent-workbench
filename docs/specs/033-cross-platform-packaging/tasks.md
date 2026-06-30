---
title: Cross-platform packaging tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-30
---

# Tasks

> **Superseded (2026-06-30, v0.3.0):** T004–T006 and T010 built a copy-to-prefix
> installer (`installer.mjs`, `install.sh`/`install.ps1`, the bash delegator,
> `npm-install.mjs`). That model was removed and replaced with a normal npm
> package — `npm install -g @auriora/agent-workbench` builds the native modules
> and launches in place; the plugin shim resolves the runtime via a
> `postinstall` pointer. The launch/hook tasks (T001–T003, T007–T009, T011) are
> unchanged and still correct. See the direction-change banner in `design.md`
> and `docs/backlog/033-npm-tarball-install-flow.md` (resolved). The graph and
> per-task evidence below are retained as historical record.

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
  - Files: `plugins/agent-workbench/install-root.mjs` (new, exported
    `resolveInstallRoot(env, platform)`). Canonical home is the plugin tree (a
    deployed component) so the Codex shim imports it same-dir and the Claude
    plugin vendors a single self-contained copy (no `../..` escape); the
    `packaging/` installer imports it from the package source.
  - Acceptance: Returns `AGENT_WORKBENCH_INSTALL_ROOT` when set; else
    `$HOME/.local/share/agent-workbench` on POSIX and
    `%LOCALAPPDATA%\agent-workbench` (fallback `%HOME%\AppData\Local\agent-workbench`)
    on `win32` (Decision 3). Pure function, no shell calls.
  - Evidence: `plugins/agent-workbench/install-root.mjs` implemented as a pure
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

- [x] T002a Implement the portable MCP launch shim.
  - Depends on: T001a
  - Files: `plugins/agent-workbench/mcp-launch.mjs` (new, source of truth;
    imports `./install-root.mjs`)
  - Acceptance: Resolves install root via T001a and spawns
    `node --import tsx <root>/src/mcp/stdio.ts` inheriting stdio; exits with the
    child's code. Preserves the legacy bash launcher's behavior: defaults
    `AGENT_WORKBENCH_DEFAULT_REPO_ROOT` to the launch `cwd` when unset, sets the
    child `cwd` to the install root (so `--import tsx` resolves the bare `tsx`
    specifier), and passes through extra argv. No `bash`, no `${VAR:-default}`.
    Satisfies Requirement 2.2-2.3.
  - Evidence: Shim exports a testable `planLaunch(env, argv, cwd)` behind an
    `isMain` guard; spawns with signal forwarding (SIGINT/SIGTERM/SIGHUP).
    `tests/integration/mcp-launch.test.ts` → 6 cases verify the entry path,
    `cwd: root`, the repo-root default + preservation, argv passthrough, and the
    no-shell property.

- [x] T002b Vendor the shim and resolver into the Claude plugin copy.
  - Depends on: T002a
  - Files: `plugins/agent-workbench/claude-plugin/mcp-launch.mjs`,
    `plugins/agent-workbench/claude-plugin/install-root.mjs`,
    `scripts/sync-claude-plugin-hooks.mjs` (extend), drift test in
    `tests/integration/claude-plugin.test.ts`
  - Acceptance: Both files are synced (not hand-maintained) from their plugin-tree
    sources via the existing `npm run sync:claude-hooks` vendoring step, with the
    byte-identical drift test extended to cover them so they cannot diverge.
    Keeps `claude-plugin/` self-contained (no `../..` imports). Satisfies P2.
  - Evidence: Added `VENDORED_PLUGIN_FILES` to the sync script; `npm run
    sync:claude-hooks` writes both files. `claude-plugin.test.ts` extended with a
    byte-identical guard for the plugin-root modules and an isolated-copy test
    that imports the vendored shim and asserts `./install-root.mjs` resolves
    inside the copied subtree. 22 tests pass across the three suites.

- [x] T003 Switch both `.mcp.json` files to exec-form `node` launch.
  - Depends on: T002b
  - Files: `plugins/agent-workbench/.mcp.json`,
    `plugins/agent-workbench/claude-plugin/.mcp.json`,
    `scripts/validate-agent-workbench-plugin.mjs`,
    `tests/integration/{claude-plugin,codex-integration-profile}.test.ts`
  - Acceptance: `"command":"node"` with the per-runtime plugin-root token —
    Claude uses `${CLAUDE_PLUGIN_ROOT}/mcp-launch.mjs`, Codex uses
    `${PLUGIN_ROOT}/mcp-launch.mjs` (the runtimes use different tokens; the Codex
    one is confirmed by the existing hooks). No `bash`/`-lc`/`${VAR:-}`. Codex
    timeout `startup_timeout_sec` preserved. Satisfies Requirement 2.1.
  - Evidence: Both `.mcp.json` files rewritten to exec form (Claude
    `${CLAUDE_PLUGIN_ROOT}`, Codex `${PLUGIN_ROOT}`). Validator updated to assert
    the shell-free shape (no bash, no `-lc`, no POSIX default expansion, no cache
    or runtime-internal paths) and re-run green (exit 0). Claude and Codex
    integration assertions updated; full suite `npx vitest run
    tests/integration/` → 54 passed. Requirement 2.1 shell-free launch shape
    verified.

## Phase 2: Cross-platform installer

- [x] T004 Port the installer to Node (`installer.mjs`).
  - Depends on: T001a
  - Files: `packaging/agent-workbench/installer.mjs` (new),
    `packaging/agent-workbench/installer.d.mts` (new),
    `tests/integration/installer.test.ts` (new)
  - Acceptance: Reproduces `install-agent-workbench-package.sh` steps (validate
    `--source`, resolve root, copy `required_paths`, register plugin, honor
    `--dry-run`/`--skip-codex-config`) using only `node:fs/path/os`. Generates
    `bin/agent-workbench-mcp.mjs` (Node, no bash shebang). Satisfies
    Requirement 1.1-1.2, 2.4.
  - Evidence: `installer.mjs` ports the `.sh` using only `node:fs/path/os/child_process`
    and the shared `resolveInstallRoot`. External tools (pnpm, corepack, codex)
    spawn through a `resolveOnPath` (PATH×PATHEXT) full-path lookup so Windows
    `.cmd` shims are found without a shell. Validates `REQUIRED_PATHS`, copies
    `COPY_COMPONENTS` with `cp -a` fidelity (`verbatimSymlinks`), strips
    checkout-only `src/debug`/`docs/specs`/`debug:*` scripts, and writes a
    shell-free `bin/agent-workbench-mcp.mjs` (self-locating root, `node --import
    tsx`). `--skip-codex-config` and `--dry-run` honored; unknown flags exit 2.
    `npx vitest run tests/integration/installer.test.ts` → 7 passed (dry-run
    writes nothing; real install to a temp prefix copies the runtime, sanitizes,
    and emits a `node --check`-valid launcher; missing component fails loud).
    `npm run typecheck` → exit 0.

- [x] T005a Wire `npm-install.mjs` to call `installer.mjs` in-process.
  - Depends on: T004
  - Files: `packaging/agent-workbench/npm-install.mjs` (renamed from `.js`),
    `packaging/agent-workbench/npm-package.json` (bin + required_paths)
  - Acceptance: No `spawnSync` of a `.sh`; imports and calls `installer.mjs`
    in-process. Satisfies Requirement 1.1.
  - Evidence: The npm entry point no longer spawns any process — it statically
    imports `parseArgs`/`install` from `installer.mjs` and runs them in-process.
    Renamed `.js` → `.mjs` so it stays ESM in both the `type:module` checkout and
    the CommonJS-default published package; `npm-package.json` `bin` and
    `required_paths` updated (now lists `npm-install.mjs` and `installer.mjs`).
    Verified on Linux: `node npm-install.mjs install -- --dry-run
    --skip-codex-config` runs the installer in-process (zero writes); `help` → 0,
    unknown command → 2, unknown installer flag → 2. `npm run typecheck` → exit 0;
    full suite `npx vitest run` → 472 passed.

- [x] T005b Make install failures fail loud and actionable.
  - Depends on: T005a
  - Files: `packaging/agent-workbench/installer.mjs` (error surfaces, validation
    ordering, rollback), `packaging/agent-workbench/installer.d.mts`,
    `tests/integration/installer.test.ts`
  - Acceptance: On failure, throws/exits with a message naming the missing
    prerequisite and per-OS remediation; never leaves a partial install.
    Satisfies Requirement 1.4, P4.
  - Evidence: A platform-parameterized `remediation(key, platform)` helper
    supplies per-OS, actionable text (Node, pnpm, Python, make, C++20 compiler,
    and the Windows MSVC build tools); every prerequisite `InstallError` now
    carries it. All prerequisite validation (required components, Node version,
    and — when a native rebuild is planned — pnpm + Python/make/C++) runs ahead
    of the first write, so a missing prerequisite fails before `installRoot` is
    created. Fresh installs that error mid-copy roll back (remove the root the
    run created); the Windows MSVC remediation is attached by catching the
    `rebuild:native` spawn failure on `win32`. Verified on Linux:
    `npx vitest run tests/integration/installer.test.ts` → 9 passed, including
    per-OS remediation assertions and a P4 gate (no `tsx`, emptied `PATH` →
    actionable pnpm/corepack error and `installRoot` never created).
    `npm run typecheck` → exit 0; full suite → 474 passed.

- [x] T006 Retire or delegate the legacy `.sh` installer.
  - Depends on: T004
  - Files: `scripts/install-agent-workbench-package.sh`,
    `tests/integration/codex-integration-profile.test.ts`
  - Acceptance: Either removed, or reduced to a thin `exec node .../installer.mjs "$@"`
    delegator so it cannot diverge. Satisfies Requirement 1.3, P2.
  - Evidence: The `.sh` is now a thin delegator — it resolves the repo root and
    `exec node packaging/agent-workbench/installer.mjs --source <repo> "$@"`,
    injecting `--source` before `"$@"` so a user-supplied `--source` wins
    (parseArgs is last-wins). All install logic lives only in `installer.mjs`
    (single source, P2): no copy/sanitize/codex-registration logic remains in the
    `.sh`. Verified on Linux: the exact CI line
    `bash scripts/install-agent-workbench-package.sh --dry-run --skip-codex-config`
    delegates to the installer, plans 15 actions, exits 0, and writes nothing; a
    trailing `--source` override is honored. `codex-integration-profile.test.ts`
    updated — redundant `.sh`-internal string assertions removed (behavior is
    covered by `installer.test.ts`), negatives kept, and a P2 pair added (`.sh`
    contains `installer.mjs`, no longer contains `sanitize_deployed_runtime`/
    `install_codex_plugin`). Full suite → 474 passed; `npm run typecheck` → exit
    0; validator → exit 0. Note: a thin `.sh` still requires bash, so the POSIX
    entry point is not itself shell-free; the shell-free install path is
    npm → `npm-install.mjs` → `installer.mjs`.

## Phase 3: Shell-free hooks

- [x] T007 [P] Convert hook commands to exec form.
  - Depends on: none
  - Files: `plugins/agent-workbench/claude-plugin/hooks/hooks.json`,
    `plugins/agent-workbench/hooks/hooks.json` (Codex)
  - Acceptance: `"command":"node","args":["${TOKEN}/hooks/<hook>.js"]` with the
    per-runtime token (Claude `${CLAUDE_PLUGIN_ROOT}`, Codex `${PLUGIN_ROOT}`);
    no `VAR=value` prefix. Command hooks have **no `env` field** (verified
    against the Claude hooks docs 2026-06-29), so the feedback default is carried
    in-script by T008, not by an `env` entry. Satisfies Requirement 3.1, 3.3.
  - Evidence: Both `hooks.json` files rewritten to exec form, inline
    `AGENT_WORKBENCH_HOOK_FEEDBACK=basic` removed. Claude `args` exec form is
    documented to spawn shell-free and Windows-safe; Codex uses the same shape
    (its `${PLUGIN_ROOT}` hook-command usage already proves token support).
    Validator + full suite green (see T009).

- [x] T008 Add the in-script feedback-mode default.
  - Depends on: none
  - Files: `plugins/agent-workbench/hooks/hook-common.js` (`feedbackMode`,
    the shared decision point for both hooks), `plugins/agent-workbench/README.md`
  - Acceptance: `feedbackMode` defaults `AGENT_WORKBENCH_HOOK_FEEDBACK` to
    `basic` when unset (still honoring an explicit `silent`), so the hook is
    correct without any `env` field — which command hooks do not support
    (Decision 4 sharpened: the in-script default is now the sole mechanism, not a
    fallback). Satisfies Requirement 3.2.
  - Evidence: `feedbackMode` flipped to basic-default; README "silent by default"
    contract updated to "basic by default, silent is opt-in". Codex integration
    profile metadata (`describe-codex-integration-profile.ts` `default_mode`) and
    its test updated to `basic_feedback`; kiro unit test updated for the new
    default. `npm run typecheck` exit 0 (also fixed a pre-existing
    `claude-plugin.test.ts` typecheck failure via a `.d.mts` for the sync
    script); full suite 465 passed.

- [x] T009 Re-sync vendored Claude hook copies.
  - Depends on: T008
  - Files: `plugins/agent-workbench/claude-plugin/hooks/{session-start.core.js,post-edit-feedback.core.js,hook-common.js}`
  - Acceptance: `npm run sync:claude-hooks` run; byte-identical drift test in
    `tests/integration/claude-plugin.test.ts` stays green. Satisfies P2.
  - Evidence: `npm run sync:claude-hooks` re-vendored the hook cores + plugin-root
    modules; byte-identical drift guards stay green. Full suite
    `npx vitest run` → 465 passed; `node scripts/validate-agent-workbench-plugin.mjs`
    passed.

## Phase 4: Packaging metadata and verification

- [x] T010a Update packaging manifests for the new install model.
  - Depends on: T004, T006
  - Files: `packaging/agent-workbench/package-manifest.json`, root `package.json`
    (`bin` + `files`), `src/application/use-cases/describe-codex-integration-profile.ts`,
    `tests/integration/codex-integration-profile.test.ts`
    (`packaging/agent-workbench/npm-package.json` already updated in T005a)
  - Acceptance: `plugin_install_model` and `files` reference `installer.mjs` and
    `mcp-launch.mjs`; any `.sh` reference updated or removed.
  - Evidence: Root `package.json` `bin` (both `agent-workbench` and
    `agent-workbench-plugin`) now points at `npm-install.mjs`; `files` lists
    `npm-install.mjs`, `installer.mjs`, and `installer.d.mts` (and keeps the
    `plugins/agent-workbench` tree that carries `mcp-launch.mjs`). The manifest
    `installer` and `codex.plugin_install_model`, and the integration profile's
    `install_package.installer_path`, all point at
    `packaging/agent-workbench/installer.mjs`; the coupled
    `codex-integration-profile.test.ts` assertions updated to match. The `.sh`
    stays referenced as the retained thin POSIX delegator (T006). `npm run
    typecheck` → exit 0; full suite → 474 passed.

- [x] T010b Update the README and verify packed contents.
  - Depends on: T010a
  - Files: `packaging/agent-workbench/README.md`
  - Acceptance: README documents the Node install model (npm-only distribution,
    Decision 2). `npm pack --dry-run` includes `installer.mjs`/`mcp-launch.mjs`
    and excludes any retired `.sh`.
  - Evidence: README rewritten to document the shell-free Node install model:
    npm (`@auriora/agent-workbench`) as the supported channel, `installer.mjs` as
    the single source of install logic, the per-OS install prefix, the
    fail-loud/per-OS-toolchain notes (core `tree-sitter` C++20 build; grammars
    prebuilt; Windows MSVC), and the `.sh` as a retained thin POSIX delegator. The
    stale "appends fallback `[mcp_servers]` to `config.toml` / merges
    `hooks.json`" description was corrected. `npm pack --dry-run --json` (198
    files) confirms `packaging/agent-workbench/installer.mjs`,
    `npm-install.mjs`, `plugins/agent-workbench/mcp-launch.mjs`, and
    `install-root.mjs` are packed and the legacy `npm-install.js` is gone.

- [ ] T011a Add the cross-platform CI matrix and install smoke.
  - Depends on: T003, T005b, T009
  - Files: `.github/workflows/cross-platform-packaging.yml`,
    `scripts/ci/install-smoke.mjs`
  - Acceptance: Jobs on windows-latest, macos-latest, ubuntu-latest run the `bin`
    installer; assert files copied and launcher generated. If a Windows runner is
    unavailable, record a manual run instead and note the gap. Satisfies
    Requirement 4.2 (install).
  - Evidence: Workflow authored with a `[ubuntu-latest, macos-latest,
    windows-latest]` matrix (Node 22, `fail-fast: false`) that runs
    `scripts/ci/install-smoke.mjs` — installs to a temp prefix and asserts the
    runtime copied, `src/debug`/`docs/specs` stripped, and
    `bin/agent-workbench-mcp.mjs` generated. **ubuntu leg verified locally**
    (`node scripts/ci/install-smoke.mjs` → exit 0). macOS/Windows legs await a
    GitHub runner run — recorded gap, not yet green. (Open until the matrix runs
    green or the gap is formally accepted.)

- [ ] T011b MCP launch smoke on all three OSes.
  - Depends on: T011a
  - Files: `.github/workflows/cross-platform-packaging.yml`,
    `scripts/ci/mcp-launch-smoke.mjs`
  - Acceptance: Server launches from `.mcp.json` on all three OSes; assert stdio
    handshake. Satisfies Requirement 4.2 (launch).
  - Evidence: `scripts/ci/mcp-launch-smoke.mjs` launches the installed
    `bin/agent-workbench-mcp.mjs` and asserts a JSON-RPC `initialize`/`serverInfo`
    handshake over stdio. **ubuntu leg verified locally** (real handshake,
    `serverInfo.name = agent-workbench`, exit 0). macOS/Windows await runner.

- [ ] T011c Hook execution smoke on all three OSes.
  - Depends on: T011a
  - Files: `.github/workflows/cross-platform-packaging.yml`,
    `scripts/ci/hook-smoke.mjs`
  - Acceptance: SessionStart + PostToolUse fire on all three OSes; assert
    advisory output and no shell error. Satisfies Requirement 4.2 (hooks).
  - Evidence: `scripts/ci/hook-smoke.mjs` runs the installed SessionStart hook
    (asserts the basic-default advisory) and PostToolUse hook (asserts clean exit,
    no shell error) via exec-form `node <hook>.js`. **ubuntu leg verified
    locally** (exit 0). macOS/Windows await runner.

- [ ] T012a Document the supported platform matrix.
  - Depends on: T011a, T011b, T011c
  - Files: `docs/runbooks/codex-agent-workbench-plugin.md` (Supported Platform
    Matrix), spec `verification.md`
  - Acceptance: Supported OS/Node/toolchain matrix documented, including the core
    `tree-sitter` C++20 toolchain prerequisite (Decision 1) and the caveat that
    grammar packages ship prebuilt binaries. Satisfies Requirement 4.1, 4.3,
    5.2.
  - Evidence: Runbook now carries a "Supported Platform Matrix" section —
    OS × Node 22+ × native toolchain (Linux `make`+`g++`/`clang++`, macOS Xcode
    CLT, Windows MSVC build tools; Python 3), per-OS install prefix, the bounded
    native-build note (only core `tree-sitter` compiles from source; grammars and
    `better-sqlite3` ship prebuilds; no compiler needed when `node_modules` is
    packaged), and a Verification column tied to the smoke matrix. Stale
    `npm-install.js`/`.sh` runbook references corrected. Held open until the
    matrix's macOS/Windows rows are backed by green runner runs (T011), per the
    spec's executed-run validation strategy.

- [ ] T012b [follow-up] Route the turnkey-core native build to the backlog.
  - Depends on: T012a
  - Files: `docs/backlog/033-turnkey-tree-sitter-core-build.md`
  - Acceptance: Record a bounded follow-up spec for making the core
    `tree-sitter` binding turnkey — option (b1) pin core+grammars to a
    prebuild-publishing line (e.g. 0.22.4) after an ABI/parser regression pass,
    or (b2) add a `prebuildify` matrix to release CI. This is a follow-up
    routing task, not implementation. Satisfies Requirement 5.1.
  - Evidence: `docs/backlog/033-turnkey-tree-sitter-core-build.md` records the
    bounded follow-up — context (only core `tree-sitter` compiles from source),
    options (b1) prebuild-publishing pin after an ABI/parser regression pass and
    (b2) `prebuildify` release-CI matrix, acceptance for the future spec, and
    references to Decision 1 / Requirement 5.1. Routing note authored; remains
    open under its T012a dependency until the matrix doc closes.
