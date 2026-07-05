---
title: Agent Workbench Codex plugin
doc_type: runbook
status: draft
owner: platform
last_reviewed: 2026-06-13
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Agent Workbench Codex Plugin

This plugin packages the Codex-facing Agent Workbench integration. It can be
installed from a local checkout or as part of the GHCR Agent Workbench package.

It packages:

- `skills/agent-workbench/SKILL.md` for workflow guidance
- `hooks/` scripts and hook configuration for optional quiet lifecycle feedback
- `.mcp.json` for the Agent Workbench MCP server binding
- `kiro-power/` for Kiro Power, Agent Skills, MCP, and hook adapter packaging
- `claude-plugin/` for Claude Code plugin, skill, MCP, and hook adapter packaging

The plugin does not reimplement runtime code. Its MCP binding launches the
npm-installed runtime in place through the portable `node` shim, not runtime
source copied into Codex's plugin cache.

## Agent Skills Compliance

Agent Workbench uses a hybrid Agent Skills compliance model. The checked-in
skills packaged by this repository are strict Agent Skills artifacts and are
validated by:

```bash
pnpm run validate:skills
```

The validator checks only repository-owned skill paths by default:

- `plugins/agent-workbench/skills/agent-workbench/SKILL.md`
- `plugins/agent-workbench/claude-plugin/skills/agent-workbench/SKILL.md`
- `plugins/agent-workbench/kiro-power/skills/agent-workbench/SKILL.md`

Use `pnpm run validate:skills -- --advisory-cache` only for local, non-mutating
inspection of user or marketplace caches. Advisory cache findings do not fail
CI and do not make third-party cached skills Agent Workbench-owned.

## Quick Start

Install the runtime from the **GitHub release tarball** (Agent Workbench is not
published to the npm registry). npm builds the native modules during install, all
OSes. **Node 22 is recommended** — on Node 24 the native core needs C++20, so a
default install on Node 24 hits a build error first (use Node 22, or rebuild with
`CXXFLAGS=-std=c++20`). A failing build is a local toolchain issue to resolve
(Python 3 + a C/C++ toolchain). See `packaging/agent-workbench/README.md` for the
full native-build prerequisites and
[the install guide](../../docs/runbooks/install-agent-workbench.md) for the
current release URL:

```bash
npm install -g https://github.com/Auriora/agent-workbench/releases/download/v0.3.0/auriora-agent-workbench-0.3.0.tgz
```

This README's Quick Start covers **Codex**. For **Claude Code**, skip to
[Claude Code Plugin](#claude-code-plugin). Both register clone-free from the
installed npm package.

Then register this plugin with Codex from the installed package and verify it.
Replace `<pkg>` with `$(npm root -g)/@auriora/agent-workbench`:

```bash
codex plugin marketplace add <pkg>/plugins/agent-workbench
codex plugin add agent-workbench@agent-workbench-local
codex plugin list
```

The package ships a package-scoped marketplace
(`plugins/agent-workbench/.agents/plugins/marketplace.json`, name
`agent-workbench-local`), so this resolves without a checkout. (The repo-root
`.agents/plugins/marketplace.json`, name `auriora-local`, is the maintainer's
**checkout** marketplace for plugin development — a different name so the two
never collide.)

In a new Codex session, use Agent Workbench through MCP. The first useful
resources are `repo:///status`, `repo:///scope`, and `repo:///overview`.
For task work, use `context_for_task` before broad reads and
`verification_plan` before running validation. Use
`integration:///profiles/codex` for the Codex integration profile and
`integration:///health/agent-workbench` for integration health.

To update after source, dependency, skill, hook, or MCP config changes, reinstall
the runtime from the new release tarball (see
[the install guide](../../docs/runbooks/install-agent-workbench.md) for the URL),
then re-add the plugin:

```bash
npm install -g https://github.com/Auriora/agent-workbench/releases/download/vX.Y.Z/auriora-agent-workbench-X.Y.Z.tgz
codex plugin add agent-workbench@agent-workbench-local
```

The local marketplace points at the npm install path, so re-running
`codex plugin add` after reinstalling re-installs from the refreshed source.

Then restart Codex so the plugin cache, skill, hooks, and MCP server config are
rediscovered.

To uninstall the Codex plugin from the current Codex installation:

```bash
codex plugin remove agent-workbench@agent-workbench-local
```

Remove the npm package separately (`npm uninstall -g @auriora/agent-workbench`)
only when no other local setup uses it.

Review plugin hook trust in Codex after install or update. Hooks are quiet and
non-repairing; if the MCP launcher is missing, reinstall the package rather
than relying on SessionStart or PostToolUse hooks to repair setup.

For normal Codex workspace sessions, leave
`AGENT_WORKBENCH_DEFAULT_REPO_ROOT` unset. The source plugin MCP config carries
`${PLUGIN_ROOT}/mcp-launch.mjs` only as package input; npm `postinstall`
materializes the installed config to an absolute shim path and does not set
`cwd`. Codex's session cwd remains the active workspace, and the shim passes
that cwd to the installed MCP runtime as the default repo root. Use
`AGENT_WORKBENCH_DEFAULT_REPO_ROOT` or `--repo-root` only for fixed-target
launches outside the active workspace.

## Local Installation Model

Installing the release tarball with `npm install -g <release-url>` places the
runtime (including this plugin source) in npm's global tree and builds the native
modules in place. The
package `postinstall` records a runtime-root pointer under the per-OS state dir;
the plugin MCP binding launches that in-place runtime through the portable shim
(an absolute `mcp-launch.mjs` path without a `cwd` override), which reads the
pointer (or the `AGENT_WORKBENCH_INSTALL_ROOT` override) and starts the server
— not runtime source from Codex's plugin cache, and never copied to a prefix.
The plugin cache is also not a repository-root fallback; Codex's session cwd is
the workspace root unless a fixed target is supplied explicitly.

The repository also includes `.agents/plugins/marketplace.json` for checkout
marketplace inspection and `.well-known/mcp/server-card.json` for local MCP
discoverability metadata. The server card lists public resources and tools,
including `codex-integration-profile` and `integration-health`.

## GHCR Package Model

The package definition lives under `packaging/agent-workbench/` and releases an
OCI image to GHCR. The image contains runtime source, docs, package metadata,
the Codex plugin, MCP config, skills, hook scripts, and hook installer.

Codex hooks are installed into `CODEX_HOME/hooks.json` by
`scripts/install-codex-hooks.mjs` with absolute paths to the installed package
hook scripts. The plugin-bundled `hooks/hooks.json` stays empty so hooks do not
depend on Codex running them from the plugin directory.

## Hook Behavior

Codex hooks are quiet and action-gated by default. Set
`AGENT_WORKBENCH_HOOK_FEEDBACK=silent` only when a host integration needs no
user-visible hook output. By default, the session-start hook emits Agent
Workbench availability plus a small
filesystem-only repo orientation capsule: root, common source/test/docs roots,
common config files, docs/specs presence, git branch when `.git/HEAD` is
directly readable, and first-call guidance. It does not run subprocesses, call
MCP tools, inspect dirty state, or parse source. File-edit hooks stay quiet
unless they have an actionable finding to report.

Post-edit feedback is limited to cheap local findings: generated/local artifact
touches, workspace-escape-looking paths, merge-conflict markers, and syntax
failures for Python, JavaScript, JSON, TOML, and shell files. The hooks never
report clean edits, never suggest follow-up calls from file-edit events, never
return partial results for timeouts or failures, and never block Codex editing.
Runtime analysis remains MCP-owned.

## Kiro Power

The Kiro integration lives in `kiro-power/`. It packages `POWER.md`,
`mcp.json`, a Kiro-importable copy of the Agent Workbench skill, a Kiro CLI
custom-agent config, and Kiro-shaped hook adapters.

Kiro hook payloads and output semantics differ from Codex hooks, so the Power
uses adapter scripts instead of reusing `hooks/hooks.json`. The adapters reuse
the same quiet hook checks and emit plain Kiro hook context only when basic
feedback is enabled and an actionable message exists.

Install the runtime first (from the GitHub release tarball — see
[the install guide](../../docs/runbooks/install-agent-workbench.md)), then add
`kiro-power/` as a local Power in Kiro.

> **Pending (spec 033):** the Kiro `mcp.json` still references the retired
> `bin/agent-workbench-mcp` shell launcher and is **not** yet wired to the
> portable `node` shim / npm runtime, so Kiro MCP launch is broken until the
> Kiro entry point is converted — tracked in
> `docs/backlog/033-kiro-shell-free-launcher.md`. Codex and Claude already
> launch via `mcp-launch.mjs` against the npm-installed runtime.

## Claude Code Plugin

The Claude Code integration lives in `claude-plugin/`. It packages a
`.claude-plugin/plugin.json` manifest, `.mcp.json`, a Claude Code skill, and
Claude-shaped hook configuration.

Claude Code plugin components live at the plugin root. Only `plugin.json` is
inside `.claude-plugin/`; `skills/`, `hooks/`, and `.mcp.json` must remain at
the Claude plugin root.

After installing the runtime (step 1 of
[the install guide](../../docs/runbooks/install-agent-workbench.md)), install the
plugin properly from the installed package (replace `<pkg>` with
`npm root -g`/@auriora/agent-workbench):

```bash
claude plugin marketplace add <pkg>/plugins/agent-workbench
claude plugin install agent-workbench@agent-workbench-local --scope user
```

For plugin development from a checkout you can instead load it directly with
`claude --plugin-dir plugins/agent-workbench/claude-plugin`. After source or hook
changes, run `/reload-plugins` in Claude Code.
