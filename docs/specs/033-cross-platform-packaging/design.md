---
title: Cross-platform packaging design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-30
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Design

> **Direction change (2026-06-30, v0.3.0): the copy-to-prefix installer is
> superseded by a normal npm package.** Tasks T004–T006 and T010 shipped a
> shell-free Node installer (`packaging/agent-workbench/installer.mjs`) that
> copied the runtime to a per-OS prefix, plus archive installers
> (`install.sh`/`install.ps1`) and a bash delegator. End-to-end testing of the
> npm distribution showed that model fought npm itself (lockfile stripping,
> dependency hoisting) and over-engineered what npm already does. It was removed
> and replaced with a plain npm package: `npm install -g @auriora/agent-workbench`
> builds the native modules normally and the runtime launches **in place** (no
> copy). A failing native build is the user's toolchain to resolve (hints at
> launch + README). The plugin launch path below (exec-form `node` invoking the
> portable `mcp-launch.mjs` shim) is **unchanged and still correct** — the shim
> now resolves the in-place runtime via a `postinstall`-written pointer (or the
> `AGENT_WORKBENCH_INSTALL_ROOT` override) instead of a copied prefix. The
> installer-specific tasks/evidence below are retained as historical record.
> See `docs/backlog/033-npm-tarball-install-flow.md` (resolved) for the rationale
> and the end-to-end verification.

## Overview

The fix is a single principle applied to three entry points: **replace each
POSIX-shell command layer with a bare interpreter invocation of a portable
script.** Claude Code's documented execution model makes this safe on Windows,
macOS, and Linux at once:

- A hook/MCP entry written in **exec form** (`"command"` + `"args"` array) is
  spawned **directly, without a shell**.
- Claude Code expands `${CLAUDE_PLUGIN_ROOT}` (and other placeholders/env vars)
  **itself, before invocation, on every OS** — so a path token in `args` is
  portable and needs no shell expansion.
- On Windows (v2.1.120+), shell form falls back to **PowerShell** when Git Bash
  is absent, which does **not** accept POSIX `VAR=value cmd` syntax — confirming
  the current inline-assignment hook commands are the live Windows blocker.

So every blocker reduces to "stop relying on the shell": move default-path and
env-default logic *into* a Node script, and invoke that script with `node` in
exec form. Native `tree-sitter` build is the one concern this does not solve;
it is bounded separately.

### Documented execution-model basis

| Concern | Documented behavior | Design consequence |
| --- | --- | --- |
| Hook/MCP exec form | `command`+`args` spawned without a shell | Use exec form everywhere |
| `${CLAUDE_PLUGIN_ROOT}` | Expanded by Claude pre-invocation, all OSes | Safe in `args` on Windows |
| Shell-form on Windows | PowerShell when Git Bash absent | `VAR=value cmd` breaks; avoid |
| Env vars | MCP entries take an `env` field; **command hooks do NOT** — verified 2026-06-29 | Default the hook feedback mode in-script (no hook `env` field exists) |
| Command resolution | PATH lookup; `.cmd`/`.bat` not spawnable in exec form | Use `node` (not npx); resolve in-script |

## High-Level Design

Three portable scripts replace three shell layers, with one shared install-root
resolver so default-root parity holds across OSes.

```text
                ┌─────────────────────────────┐
  npx / bin ───►│ packaging/.../installer.mjs  │  (Node installer; copies files,
                │  (cross-platform install)    │   generates launcher, registers)
                └──────────────┬──────────────┘
                               │ writes
                               ▼
              <install_root>/bin/agent-workbench-mcp.mjs   (portable launcher)
                               ▲
        .mcp.json:  node ${CLAUDE_PLUGIN_ROOT}/mcp-launch.mjs
                               │ resolves install root via shared resolver,
                               │ execs:  node --import tsx <root>/src/mcp/stdio.ts
                               ▼
                     Agent Workbench MCP server

  hooks.json:  { "command": "node",
                 "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/session-start.js"],
                 "env":  { "AGENT_WORKBENCH_HOOK_FEEDBACK": "basic" } }
               (hook script also defaults the mode in-process when env unset)

  shared:  install-root-resolver  (AGENT_WORKBENCH_INSTALL_ROOT override,
           else per-OS default: $HOME/.local/share/agent-workbench on POSIX,
           %LOCALAPPDATA%\agent-workbench on Windows)
```

### Components

- **Cross-platform installer (`packaging/agent-workbench/installer.mjs`).** Node
  module holding the copy/generate/register logic currently in
  `scripts/install-agent-workbench-package.sh`. `npm-install.js` calls it
  in-process instead of `spawnSync`-ing the `.sh`. The `.sh` is either deleted
  or reduced to a thin `node installer.mjs` delegator so it cannot drift
  (Requirement 1.3).
- **Portable host launcher (`bin/agent-workbench-mcp.mjs`).** Generated by the
  installer in place of the `#!/usr/bin/env bash` script. Pure Node; started via
  `node` so no shebang/executable-bit dependency on Windows.
- **MCP launch shim (`mcp-launch.mjs` under the plugin root).** Referenced from
  both `.mcp.json` files via `"command":"node","args":["${CLAUDE_PLUGIN_ROOT}/mcp-launch.mjs"]`.
  Resolves the install root through the shared resolver and `execFileSync`/spawns
  the server. Removes the `bash -lc` wrapper and the POSIX `${VAR:-default}`.
- **Shared install-root resolver (`plugins/agent-workbench/install-root.mjs`).**
  One function used by installer, host launcher, and MCP shim so the default root
  is computed identically everywhere (P3). Honors `AGENT_WORKBENCH_INSTALL_ROOT`
  first. The canonical copy lives in the plugin tree (a deployed component) so
  the Codex shim imports it same-dir at runtime and the `packaging/` installer
  imports it from the package source; the Claude plugin carries a single
  vendored, byte-identical copy (Claude installs only the `claude-plugin/`
  subtree, so it cannot import via `../..`). Implemented with `path.win32`/
  `path.posix` so a target OS's root resolves correctly from any host.
- **Hook entries.** Both `hooks.json` files switch to exec form
  (`"command":"node","args":["${TOKEN}/hooks/<hook>.js"]`) with the per-runtime
  token (Claude `${CLAUDE_PLUGIN_ROOT}`, Codex `${PLUGIN_ROOT}`), dropping the
  POSIX inline `VAR=value` prefix. Command hooks have **no `env` field**
  (verified), so the default feedback mode moves entirely into the hook script
  (`feedbackMode` defaults to `basic` when the env var is unset, still honoring
  an explicit `silent`). The in-script default is the contract, not a fallback.

### Data flow / data models

No new persisted data. The only "model" is the resolved install root: a single
absolute path derived from `(AGENT_WORKBENCH_INSTALL_ROOT, platform, homedir)`.

## Low-Level Design

### Install-root resolver

```js
// plugins/agent-workbench/install-root.mjs — canonical; vendored into claude-plugin.
// Imported by installer.mjs (package source), mcp-launch.mjs, generated launcher.
// Uses path.win32/path.posix and env-derived home so a target OS's root resolves
// correctly from any host (pure given env/platform).
export function resolveInstallRoot(env = process.env, platform = process.platform) {
  if (env.AGENT_WORKBENCH_INSTALL_ROOT) return env.AGENT_WORKBENCH_INSTALL_ROOT;
  if (platform === "win32") {
    const home = env.USERPROFILE || os.homedir();
    const base = env.LOCALAPPDATA || path.win32.join(home, "AppData", "Local");
    return path.win32.join(base, "agent-workbench");
  }
  const home = env.HOME || os.homedir();
  return path.posix.join(home, ".local", "share", "agent-workbench");
}
```

### MCP launch shim (`mcp-launch.mjs`)

```js
const root = resolveInstallRoot();
const entry = path.join(root, "src", "mcp", "stdio.ts");
// Exec form already gave us a shell-free invocation; spawn the server inheriting stdio.
const child = spawn(process.execPath, ["--import", "tsx", entry], { stdio: "inherit" });
child.on("exit", code => process.exit(code ?? 1));
```

`.mcp.json` (both copies) becomes:

```json
{ "mcpServers": { "agent-workbench": {
  "command": "node",
  "args": ["${CLAUDE_PLUGIN_ROOT}/mcp-launch.mjs"],
  "startup_timeout_sec": 30.0
} } }
```

### Hook entries (`hooks.json`)

```json
{ "type": "command",
  "command": "node",
  "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/session-start.js"],
  "timeout": 10 }
```

Command hooks have no `env` field, so the feedback mode is defaulted entirely in
the shared hook helper — `basic` when unset, still honoring an explicit
`silent`:

```js
export function feedbackMode(env = process.env) {
  const mode = env.AGENT_WORKBENCH_HOOK_FEEDBACK || "basic";
  return mode === "basic" ? "basic" : "silent";
}
```

This default must be added to the source hooks AND the vendored
`*.core.js` copies, then re-synced via `npm run sync:claude-hooks` so the
byte-identical drift test stays green.

### Installer (`installer.mjs`)

Port, function-for-function, the steps in
`scripts/install-agent-workbench-package.sh`: validate `--source`, resolve the
install root, copy `required_paths`, generate `bin/agent-workbench-mcp.mjs`,
write/refresh the plugin registration, honor `--dry-run`/`--skip-codex-config`.
Use only `node:fs`, `node:path`, `node:os` — no shell calls. `npm-install.js`
imports and calls it; on failure it throws an `Error` whose message names the
missing prerequisite (Requirement 1.4 / P4).

### Error handling

- Missing Node at install: surfaced by npm itself (Node is the package runtime).
- Missing build toolchain for native modules: detected during `npm install`
  rebuild; installer emits an actionable per-OS message (Requirement 5.3).
- Install-root not writable: installer throws naming the path and OS-default
  remediation.

## Operational Considerations

- **Rollout.** Land installer + launcher + hook changes together; ship a new
  package version. Existing Unix installs keep working because the default root
  is unchanged on POSIX.
- **Backward compatibility.** Keep accepting `AGENT_WORKBENCH_INSTALL_ROOT`. If
  the legacy `bin/agent-workbench-mcp` (bash) exists from a prior install,
  document that re-install replaces it with the `.mjs` launcher.
- **Verification.** CI matrix on windows-latest / macos-latest / ubuntu-latest
  running install + MCP launch smoke + hook execution; record evidence in
  `verification.md`. Manual runs are an accepted fallback if a Windows runner is
  unavailable, but must be recorded, not assumed.
- **Native build.** The tarball excludes `node_modules`, so `tree-sitter`
  rebuilds on install. Document MSVC Build Tools (Windows) and Xcode CLT
  (macOS); decide prebuilt-vs-rebuild in Open Questions before closing.

## Open Questions

All four open questions were resolved on 2026-06-29 before implementation start;
each is retained below with its resolution for traceability.

1. **Native build scope (Requirement 5) — RESOLVED: option (a).** Document the
   native-build toolchain prerequisite and detect/report its absence (fail-loud);
   do **not** ship prebuilt binaries in this spec. Rationale: investigation showed
   the concern reduces to a *single* package — the core `tree-sitter` runtime
   binding — not the grammars. The four grammar packages
   (`tree-sitter-{python,javascript,typescript,go}`) already ship prebuilt
   `.node` binaries for `darwin`/`linux`/`win32` × `x64`/`arm64`, so they install
   with zero compilation. Only core `tree-sitter@0.25.0` compiles from source
   (it dropped the prebuilds that 0.22.x shipped) and needs a C++20 toolchain
   (MSVC Build Tools on Windows, Xcode CLT on macOS, gcc/g++ on Linux). Since the
   audience is developers, a documented toolchain prerequisite is acceptable.
   **Follow-up (bounded, deferred to a separate spec):** make the core binding
   turnkey via either (b1) pinning core+grammars to a prebuild-publishing line
   (e.g. 0.22.4, full 6-target coverage) after an ABI/parser regression pass, or
   (b2) adding a `prebuildify` matrix to release CI that vendors core `.node`
   files while staying on the 0.25 API. Record this in `docs/backlog/` at closure.
2. **Distribution channel — RESOLVED: npm package only.** The Claude marketplace
   is not targeted in this spec. Consequence: the shell-free installer
   (Requirement 1 / Phase 2, T004-T006) is **fully load-bearing**, alongside the
   launcher (R2) and hook (R3) work. Reach is npm/CI users.
3. **Windows default root — RESOLVED: `%LOCALAPPDATA%\agent-workbench`,**
   falling back to `%HOME%\AppData\Local\agent-workbench` when `LOCALAPPDATA` is
   unset (the Windows-idiomatic choice, as encoded in the resolver sketch above).
   T001 may proceed on this basis.
4. **Hook `env` field support — RESOLVED: in-script default is the contract.**
   The hook scripts default `AGENT_WORKBENCH_HOOK_FEEDBACK` to `basic` in-process
   (T008), so correctness does not depend on any runtime honoring the `env`
   field; the `env` entry remains a documented, redundant default. Whether Claude
   Code and Codex honor `env` is verified during implementation, not a gate.
