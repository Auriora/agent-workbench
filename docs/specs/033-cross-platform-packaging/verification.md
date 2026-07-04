---
title: Cross-platform packaging verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-07-04
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

> **Superseded (2026-06-30, v0.3.0):** evidence below for the copy-to-prefix
> installer (R1 "Shell-free installer", "Single-source installer", and the
> `installer.mjs`/`npm-install.mjs`/`install.sh` references) describes a model
> that has since been removed. The runtime now ships as a normal npm package; the
> install path is verified end to end in `docs/backlog/033-npm-tarball-install-flow.md`
> (resolved): `npm pack` → `npm install <tarball>` → `postinstall` writes the
> runtime-root pointer → the plugin shim resolves it → MCP `initialize` handshake
> succeeds against the installed copy. The launch and hook verification
> (mcp-launch + hook smokes, now run against the checkout/installed runtime) is
> unchanged and still correct.

## Validation Strategy

Portability claims must be backed by **executed runs on each OS**, not static
review from a Linux host. The acceptance bar is a real platform matrix: CI jobs
on windows-latest, macos-latest, and ubuntu-latest, or — where a runner is
unavailable — a recorded manual run with the gap noted explicitly.

## Quality Gates

| Gate | Method |
| --- | --- |
| Resolver parity (P3) | Unit test `resolveInstallRoot` for `win32` and POSIX with injected env/platform |
| Install on Windows (R1) | Run `bin` installer on windows-latest with only Node + toolchain; assert files copied, launcher generated |
| MCP launch (R2) | Start server from `.mcp.json` on all three OSes; assert stdio handshake |
| Hook execution (R3) | Fire SessionStart + PostToolUse on all three OSes; assert advisory output, no shell error |
| Hook drift (P2) | `tests/integration/claude-plugin.test.ts` byte-identical guard stays green after re-sync |
| Single source (P2) | Assert no independently-maintained `.sh` install logic remains |
| Fail-loud (P4) | Force a missing prerequisite; assert actionable error, no partial install |
| Native build (R5) | On Windows without MSVC tools, assert actionable failure, not a half-install |

## Evidence Log

- **Closure cleanup validation (2026-07-04) — PASS with sandbox caveats.**
  `git diff --check` -> exit 0; `pnpm typecheck` -> exit 0;
  `node scripts/validate-agent-workbench-plugin.mjs` -> exit 0; focused Spec
  033 Vitest slice
  (`install-root.test.ts`, `mcp-launch.test.ts`, `claude-plugin.test.ts`,
  `codex-integration-profile.test.ts`, `kiro-power.test.ts`) -> 5 files / 49
  tests passed when rerun outside the managed sandbox. `node
  scripts/ci/install-smoke.mjs` -> exit 0 in sandbox; `node
  scripts/ci/mcp-launch-smoke.mjs` and `node scripts/ci/hook-smoke.mjs` -> exit
  0 when rerun outside the managed sandbox. The sandbox-only failures were
  nested `node` spawn restrictions (`spawnSync node EPERM`) and one MCP smoke
  timeout caused by the managed execution context, not Spec 033 behavior.
- **Claude plugin registration from packed tarball (v0.3.0) — PASS (Linux): `npm pack`, `claude plugin marketplace add`, `claude plugin install`, and `claude plugin list` confirmed installed/enabled package v0.3.0.**
  Linux host, Node 24 (v24.8.0), `claude` CLI 2.1.196, isolated
  `CLAUDE_CONFIG_DIR`. `npm pack` → extract → `claude plugin marketplace add
  <pkg>/plugins/agent-workbench` (→ "Successfully added marketplace:
  agent-workbench-local") → `claude plugin install
  agent-workbench@agent-workbench-local --scope user` (→ "Successfully
  installed") → `claude plugin list` shows `agent-workbench@agent-workbench-local`
  **Version 0.3.0**, scope user, status enabled. Confirms the shipped
  package-scoped marketplace (`plugins/agent-workbench/.claude-plugin/marketplace.json`,
  source `./claude-plugin`) resolves clone-free from the npm package. Combined
  with the npm-install→pointer→`initialize` e2e (backlog 033-npm-tarball), both
  halves of the Claude path are covered.
- **Codex plugin registration from packed tarball (v0.3.0) — PASS (Linux): `npm pack`, isolated `codex plugin marketplace add`, `codex plugin add`, and `codex plugin list` confirmed installed/enabled package v0.3.0.** A package-scoped Codex marketplace now ships at
  `plugins/agent-workbench/.agents/plugins/marketplace.json` (name
  `agent-workbench-local`, source `.`), distinct from the maintainer's checkout
  `auriora-local`. Linux host, `codex` CLI 0.142.4: `npm pack` → extract → with
  `HOME`/`USERPROFILE`/`CODEX_HOME` all overridden (so the host's real
  `~/.agents` cannot shadow via name collision) →
  `codex plugin marketplace add <pkg>/plugins/agent-workbench` →
  `codex plugin add agent-workbench@agent-workbench-local` →
  `codex plugin list` shows `agent-workbench@agent-workbench-local` **v0.3.0**,
  `installed, enabled`, resolved from the unpacked package path. The earlier
  contaminated attempt (isolated `CODEX_HOME` only) is why `HOME` override is the
  discriminating control. Guarded by `required_paths`, the plugin validator, and
  a packed-metadata test. Resolves `docs/backlog/033-codex-npm-marketplace.md`.
  **Scope:** this is registration, not launch — the `${PLUGIN_ROOT}`-in-`.mcp.json`-args
  launch residual below still stands.
- **Resolver parity (P3) — PASS.** Linux host, Node (repo toolchain),
  `npx vitest run tests/integration/install-root.test.ts` → 9 passed. Covers
  the `AGENT_WORKBENCH_INSTALL_ROOT` override on both OSes, the POSIX/darwin
  default, the Windows `%LOCALAPPDATA%` default and its `<home>\AppData\Local`
  fallback, and cross-host separator parity (win32 root resolved on a POSIX host
  with backslashes, and vice versa). Tasks T001a/T001b.
- **Shim launch plan (R2) — PASS (Linux unit evidence): `npx vitest run tests/integration/mcp-launch.test.ts` -> 6 passed.**
  Verifies the
  shim spawns `node --import tsx <root>/src/mcp/stdio.ts` with `cwd: root`,
  defaults/preserves `AGENT_WORKBENCH_DEFAULT_REPO_ROOT`, passes argv through,
  and uses no shell. Full per-OS launch handshake remains for T011b. Task T002a.
- **MCP launch config shape (R2.1) — PASS.** Both `.mcp.json` files switched to
  exec-form `node` launch (Claude `${CLAUDE_PLUGIN_ROOT}`, Codex `${PLUGIN_ROOT}`).
  `node scripts/validate-agent-workbench-plugin.mjs` → exit 0 (asserts no bash,
  no `-lc`, no POSIX default expansion, no cache/runtime-internal paths);
  `npx vitest run tests/integration/` → 54 passed. Task T003.
- **Hook exec form + in-script default (R3) — PASS (Linux unit/shape evidence): `npm run typecheck`, `npx vitest run`, and the plugin validator passed.** Both
  `hooks.json` switched to exec form (no inline `VAR=value`); `feedbackMode`
  defaults to `basic` in-script (no hook `env` field exists). `npm run typecheck`
  → exit 0; full suite `npx vitest run` → 465 passed; validator passed. Per-OS
  hook firing remains for T011c. Tasks T007/T008/T009.
- **Shell-free installer (R1) — PASS for superseded copy-installer evidence: `npx vitest run tests/integration/installer.test.ts` -> 7 passed on Linux.**
  The Node installer
  (`packaging/agent-workbench/installer.mjs`) validates `--source` components,
  copies the runtime with `cp -a` fidelity, strips checkout-only artifacts,
  honors `--dry-run` (zero writes) and `--skip-codex-config`, and generates a
  shell-free `bin/agent-workbench-mcp.mjs` (`node --check`-valid). External-tool
  spawns route through a PATH×PATHEXT full-path lookup so Windows `.cmd` shims
  are reachable without a shell. The per-OS install smoke (windows/macos) remains
  for T011a. Task T004.
- **Cross-platform smoke matrix (R4.2) — ACCEPTED ROUTING GAP: `scripts/ci/install-smoke.mjs`, `mcp-launch-smoke.mjs`, and `hook-smoke.mjs` all exited 0 on Linux; macOS/Windows runner evidence is explicitly recorded as pending historical matrix coverage.** `.github/workflows/cross-platform-packaging.yml` runs a
  `[ubuntu-latest, macos-latest, windows-latest]` matrix (Node 22) that installs
  to a temp prefix and runs three end-to-end smokes against the installed copy:
  `scripts/ci/install-smoke.mjs` (copy + sanitize + launcher), `mcp-launch-smoke.mjs`
  (stdio `initialize` handshake), `hook-smoke.mjs` (SessionStart + PostToolUse,
  no shell error). **Verified locally on Linux** — all three exit 0, the launch
  smoke returns a real `serverInfo` handshake. macOS and Windows legs require a
  GitHub runner and have **not** run yet — recorded gap per the Validation
  Strategy, not silently skipped. Tasks T011a/T011b/T011c.
- **Packaging metadata + packed contents (R1, P2) — PASS (Linux): `npm pack --dry-run --json` confirmed 198 package files and expected installer/launcher contents.** Root
  `package.json` `bin`/`files`, `package-manifest.json` (`installer`,
  `codex.plugin_install_model`), and the Codex integration profile's
  `installer_path` all point at `packaging/agent-workbench/installer.mjs`; the
  README documents the npm-only, shell-free Node install model. `npm pack
  --dry-run --json` (198 files) confirms `installer.mjs`, `npm-install.mjs`,
  `mcp-launch.mjs`, and `install-root.mjs` are packed and the legacy
  `npm-install.js` is gone; the thin `.sh` delegator still ships. Full suite →
  474 passed. Tasks T010a/T010b.
- **Single-source installer (P2, R1.3) — PASS (Linux): `bash scripts/install-agent-workbench-package.sh --dry-run --skip-codex-config` planned 15 actions, exited 0, and wrote nothing.** The legacy
  `scripts/install-agent-workbench-package.sh` is reduced to a thin delegator:
  `exec node packaging/agent-workbench/installer.mjs --source <repo> "$@"`. No
  copy/sanitize/codex-registration logic remains in the `.sh`, so it cannot
  diverge from `installer.mjs`. Linux host: the CI line `bash
  scripts/install-agent-workbench-package.sh --dry-run --skip-codex-config`
  delegates, plans 15 actions, exits 0, writes nothing; trailing `--source`
  override honored. `codex-integration-profile.test.ts` now asserts the `.sh`
  references `installer.mjs` and no longer contains the old bash logic markers.
  Caveat: the thin `.sh` still needs bash; only the npm path
  (`npm-install.mjs` → `installer.mjs`) is shell-free. Full suite → 474 passed.
  Task T006.
- **Fail-loud install (P4, R1.4) — PASS (Linux).** Prerequisite validation
  (required components, Node version, and — when a native rebuild is planned —
  pnpm + Python/make/C++) is hoisted ahead of the first write, so a missing
  prerequisite throws before `installRoot` exists. Errors carry per-OS
  remediation from a platform-parameterized `remediation(key, platform)` helper.
  Linux host: `npx vitest run tests/integration/installer.test.ts` → 9 passed,
  including all-three-OS remediation assertions and a P4 gate (no `tsx` +
  emptied `PATH` → actionable pnpm/corepack error, `installRoot` never created).
  Windows MSVC remediation is attached by catching the `rebuild:native` failure
  on `win32`; its live assertion is the Windows leg of T011a. Task T005b.
- **In-process npm entry (R1.1) — PASS (Linux).** `packaging/agent-workbench/npm-install.mjs`
  (renamed from `.js`) statically imports and calls `installer.mjs` — no
  `spawnSync` of any `.sh`. Linux host: `node npm-install.mjs install -- --dry-run
  --skip-codex-config` ran the installer in-process with zero writes; `help` → 0,
  unknown command → 2, unknown installer flag → 2. Full suite `npx vitest run` →
  472 passed; `npm run typecheck` → exit 0. Task T005a.
- **Hook/shim drift (P2) — PASS: `npx vitest run tests/integration/claude-plugin.test.ts` passed with byte-identical and isolated-copy guards.** Includes a new
  byte-identical guard for the vendored `mcp-launch.mjs`/`install-root.mjs` and
  an isolated-copy import test proving the shim stays self-contained (no `../..`
  escape). Task T002b.

## Residual Risks

- Native `tree-sitter` cross-platform build is deferred (Decision 1, resolved):
  Windows support ships with a documented toolchain prerequisite, not a turnkey
  binary. Only the core `tree-sitter` runtime binding compiles from source (it
  needs a C++20 toolchain); the four grammar packages already ship prebuilt
  binaries for all targets. The turnkey-core follow-up (prebuilt core via b1/b2)
  is tracked in `docs/backlog/`.
- Windows CI runner availability may force manual verification for some gates;
  any such gap must be recorded here, not silently skipped.
- Install rollback is scoped to fresh installs: if the run created `installRoot`,
  a mid-install failure removes it. A **refresh** over a pre-existing install
  cannot roll back cleanly — `copyComponent` does `rm -rf` then copy per
  component, so a failure partway through has already replaced some files. The
  installer surfaces the error but the prior install may be left mid-update;
  re-running the installer is the recovery path. Atomic refresh (stage + rename)
  is impractical because pnpm bakes the install path into `node_modules`/`.bin`.
- `env`-field support on hook entries is assumed; the in-script default
  (task T008) is the mitigation if a runtime ignores it.
- Plugin-root expansion inside `.mcp.json` args (not just hook command strings):
  **Claude side confirmed (Linux), Codex side by-analogy + CI.** A live Claude
  session (2026-06-30, Linux) launched the plugin MCP server as
  `node <expanded-plugin-root>/claude-plugin/mcp-launch.mjs` (observed in the
  process table) and served tool calls — direct evidence that Claude expands
  `${CLAUDE_PLUGIN_ROOT}` inside `.mcp.json` args and the `node`+shim launch
  works. (That live process was the dev's pre-existing 0.1.0 plugin copy, so it
  evidences only the editor-side expansion, not the new pointer-based shim
  resolution — the latter is covered by the npm-install→pointer→`initialize`
  e2e in backlog `033-npm-tarball`.) Codex `${PLUGIN_ROOT}` expansion in
  `.mcp.json` args is still taken on the strength of the existing Codex hook
  usage (it already expands `${PLUGIN_ROOT}` in hook commands); the live per-OS
  launch smoke (T011b, cross-platform-packaging.yml) confirms it end to end once
  a runner runs the macOS/Windows legs. If it does not expand, the localized fix
  is to write the absolute install prefix into the deployed Codex `.mcp.json`.
- **Kiro MCP launch is currently broken (deferred fix).** Kiro is outside this
  spec's Requirement 2 baseline (Claude/Codex only), and the launcher rename
  introduced by T004 was not propagated to it: the installer now generates only
  `bin/agent-workbench-mcp.mjs`, but `plugins/agent-workbench/kiro-power/mcp.json`
  still launches `bash -lc exec ".../bin/agent-workbench-mcp"` — a file that no
  longer exists. So Kiro's MCP server will fail to start until the Kiro entry
  point is converted. This is more than the original "still uses `bash -lc` form"
  note: the target is missing, not just shell-bound. Converting Kiro to a
  shell-free launch against the `.mjs` launcher is a tracked follow-up
  (`docs/runbooks/codex-agent-workbench-plugin.md` and the Power docs flag the
  launcher reference as pending). The Kiro `.kiro.hook`/agent commands also still
  carry the inline `AGENT_WORKBENCH_HOOK_FEEDBACK=basic` prefix; harmless (the
  in-script default is now `basic`) but tracked with the same follow-up.
- Claude command-hook exec form (`args`) is documented and confirmed. Codex
  exec-form `args` support for hook commands is taken on the strength of its
  parallel plugin model (it already expands `${PLUGIN_ROOT}` in hook commands);
  the live per-OS hook firing (T011c) confirms it. If Codex does not accept
  `args`, the localized fix is a shell-free command string
  (`node "${PLUGIN_ROOT}/hooks/<hook>.js"`, no inline `VAR=`).

## Closure Readiness

`ready_to_close`: ready with routed historical-verification gaps. All
implementation work in this spec is complete or routed; Linux install, launch,
and hook smokes passed locally; the macOS/Windows CI matrix is authored but has
not yet produced runner evidence. That gap is recorded explicitly in this file
and in the supported platform matrix, and should be satisfied by future workflow
history or release-readiness gates rather than by more Spec 033 implementation.

Durable platform-matrix documentation is promoted in
`docs/runbooks/codex-agent-workbench-plugin.md`. The turnkey core
`tree-sitter` native-build decision is routed to
`docs/backlog/033-turnkey-tree-sitter-core-build.md`. The Kiro launcher breakage
is outside the Claude/Codex baseline for this spec and is routed to
`docs/backlog/033-kiro-shell-free-launcher.md`.
