---
title: Codex Agent Workbench plugin and MCP setup
doc_type: runbook
status: draft
owner: platform
last_reviewed: 2026-06-13
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Codex Agent Workbench Plugin And MCP Setup

## Purpose

Define the supported local-development and packaged setup for using Agent
Workbench from Codex without creating a second executable runtime path.

## Supported Model

Agent Workbench has one executable Codex runtime path per packaged install:

- The Codex plugin installs the `agent-workbench` skill.
- The Codex plugin installs quiet lifecycle hooks from `hooks/hooks.json`.
- The Codex plugin registers the `agent-workbench` MCP server through
  `.mcp.json`.
- The plugin MCP server launches the npm-installed runtime in place through the
  portable `node`-based shim `plugins/agent-workbench/mcp-launch.mjs`, which
  resolves the runtime root and starts the MCP stdio server.
- The plugin must not launch runtime code from Codex's plugin cache path; the
  shim lives in the plugin but always delegates to the npm-installed runtime.

The npm package `@auriora/agent-workbench` is an ordinary npm package, and the
GHCR image is a separate container channel. Installing the npm package builds
the native modules and records where the runtime lives; the plugin's `.mcp.json`
then launches that same runtime through `mcp-launch.mjs`. This is not a second
runtime implementation; the plugin MCP config launches the one MCP entrypoint
installed by npm.

Companion MCP servers, such as a spec lifecycle server for a separate docs
repository, should also be configured as host-level Codex MCP entries. Keep
their install and validation notes with the repository they target; the Agent
Workbench plugin should not package or proxy those companion runtimes.

This keeps source updates explicit:

- Install a new package version with `npm install -g https://github.com/Auriora/agent-workbench/releases/download/vX.Y.Z/auriora-agent-workbench-X.Y.Z.tgz`.
- Re-add `agent-workbench@<personal-marketplace>`.
- Restart Codex so skills, hooks, and MCP tools are discovered from the updated
  plugin cache.

For normal Codex workspace sessions, leave
`AGENT_WORKBENCH_DEFAULT_REPO_ROOT` unset. The MCP process should default to the
active Codex workspace. Use an explicit `repo_root` argument or
`AGENT_WORKBENCH_DEFAULT_REPO_ROOT` only for fixed-target launches outside an
active workspace.

## Plugin Installation

The local plugin source lives at `plugins/agent-workbench/`.

The plugin manifest includes `skills` and `mcpServers`. Codex auto-discovers
`hooks/hooks.json` when the plugin is enabled. The `.mcp.json` file launches the
npm-installed runtime through the portable shim and must not point at a
plugin-cache source path:

```json
{"command": "node", "args": ["${PLUGIN_ROOT}/mcp-launch.mjs"]}
```

There are **two** Codex marketplaces, named differently so they never collide:

- **`agent-workbench-local`** — package-scoped, shipped in the npm package at
  `plugins/agent-workbench/.agents/plugins/marketplace.json` (plugin source `.`).
  This is the **end-user / npm install** path: `codex plugin marketplace add
  <pkg>/plugins/agent-workbench` registers it clone-free.
- **`auriora-local`** — the maintainer's **checkout** marketplace at the repo
  root `.agents/plugins/marketplace.json` (plugin source `./plugins/agent-workbench`).
  Used for **plugin development** from a checkout, alongside the cachebuster.

End-user (npm package) registration — replace `<pkg>` with
`$(npm root -g)/@auriora/agent-workbench`:

```bash
codex plugin marketplace add <pkg>/plugins/agent-workbench
codex plugin add agent-workbench@agent-workbench-local
```

Plugin-development (checkout) registration, from the repo root:

```bash
codex plugin marketplace add .   # registers auriora-local from .agents/plugins/marketplace.json
codex plugin add agent-workbench@auriora-local
```

When changing plugin packaging during development, update the plugin cachebuster
and reinstall:

```bash
python3 /home/bcherrington/.codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py plugins/agent-workbench
codex plugin add agent-workbench@auriora-local
```

After reinstall, start a new Codex session to pick up changed skills, hooks,
MCP tools, and plugin metadata.

Verify the installed plugin and marketplace source with:

```bash
codex plugin list
```

The expected installed entry is
`agent-workbench@<personal-marketplace>` with status `installed, enabled`.

## First-Run Verification

After installation, start a new Codex session from the target repository. Use
the Agent Workbench MCP resources first:

- `repo:///status` for runtime freshness, scope, and adapter coverage.
- `repo:///scope` for indexed roots, skipped roots, language counts, and
  generated/vendor scope.
- `repo:///overview` for repository shape, key files, key docs, validation
  hints, and first-call guidance.

For task work, call `context_for_task` before broad file reads and
`verification_plan` before running validation commands. Read
`integration:///profiles/codex` when checking the Codex plugin, skill, hook,
and MCP binding model. Read `integration:///health/agent-workbench` when
checking configured, registered, discovered, and callable MCP states.

The plugin should not create a host-level Agent Workbench MCP block in
`~/.codex/config.toml`. The supported Codex path is the plugin-bundled
`.mcp.json` launching the npm-installed runtime through `mcp-launch.mjs`.

## MCP Discoverability Metadata

The repository publishes `.well-known/mcp/server-card.json` as local,
machine-readable MCP discoverability metadata. It describes the Agent Workbench
stdio transport, local-first privacy posture, setup paths, public MCP
resources, and public MCP tools.

The server card is a checked-in metadata file, not another runtime registry.
Integration tests compare its resources and tools against the MCP registry, so
changes to `mcpResources` or `mcpTools` must update the card in the same
change. The card must not claim remote hosting, network requirements, or
surfaces that Agent Workbench does not register.

The server card is the durable metadata owner for public resource/tool names.
The core Codex-facing resources are `repo:///status`, `repo:///scope`,
`repo:///overview`, `integration:///profiles/codex`, and
`integration:///health/agent-workbench`; the matching public resource names
include `codex-integration-profile` and `integration-health`.

## Supported Platform Matrix

Install and launch are shell-free on all supported operating systems. `npm
install` builds the native modules the normal way, and the plugins launch the
runtime with `node ${PLUGIN_ROOT}/mcp-launch.mjs` — no POSIX shell on the
install or runtime path. The supported distribution channel is the npm package
(Decision 2).

| OS | Node | Native toolchain (build path only) | Verification |
| --- | --- | --- | --- |
| Linux (x64/arm64) | 22+ | C/C++ toolchain + Python 3 | Verified |
| macOS | 22+ | C/C++ toolchain + Python 3 | Pending runner |
| Windows 10+ | 22+ | C/C++ toolchain + Python 3 | Pending runner |

Per-OS toolchain: Linux `make` + `g++`/`clang++` (e.g. `build-essential`);
macOS the Xcode command line tools (`xcode-select --install`); Windows the MSVC
C++ build tools (the "Desktop development with C++" workload).

On **Node 24** the `tree-sitter` core needs **C++20** (Node 24's V8/cppgc
headers require it). Use **Node 22** (the supported floor), or rebuild with
`CXXFLAGS=-std=c++20` (`CL=/std:c++20` on Windows).

The package's `postinstall` records a runtime-root pointer file under the per-OS
state directory: `%LOCALAPPDATA%\agent-workbench` on Windows (falling back to
`%USERPROFILE%\AppData\Local`), and `~/.local/share/agent-workbench` on
Linux/macOS. The launch shim reads this pointer to find the runtime; nothing is
copied to a prefix. Set `AGENT_WORKBENCH_INSTALL_ROOT` to override the runtime
root (point it at a checkout containing `src/mcp/stdio-entrypoint.mjs`).

**Native build prerequisite (Decision 1).** A C/C++ toolchain (and Python 3) is
required to build native modules from source. This is bounded: of the native
dependencies, only the core `tree-sitter` runtime binding compiles from source;
the four grammar packages (`tree-sitter-go`, `-javascript`, `-python`,
`-typescript`) ship prebuilt binaries for all targets, and `better-sqlite3`
ships prebuilds. A failing native build is the user's local toolchain issue to
resolve, not a packaging bug: the package prints an actionable hint from
`postinstall` (best effort) and, authoritatively, at server launch when a
native binding cannot load.

The cross-platform smoke matrix that backs the "Verification" column lives in
`.github/workflows/cross-platform-packaging.yml` (install, MCP launch, and hook
smokes per OS). The macOS/Windows legs are authored but await a runner; that gap
is tracked in the spec's `verification.md`.

## NPM Package Installation

The npm distribution package is `@auriora/agent-workbench`. Its package
contract lives at `packaging/agent-workbench/npm-package.json`. It is an
ordinary npm package: `npm install` builds the native modules
(`tree-sitter`, `better-sqlite3`) from source the normal way — there is no
custom installer, no copy-to-prefix step, and no POSIX shell on the path.

Install or refresh the runtime with:

```bash
npm install -g https://github.com/Auriora/agent-workbench/releases/download/vX.Y.Z/auriora-agent-workbench-X.Y.Z.tgz
```

This runs `scripts/postinstall.mjs`, which records the runtime-root pointer file
under the per-OS state directory so the plugins' launch shim can find the
runtime in place. Then register the Codex plugin:

```bash
codex plugin add agent-workbench@auriora-local
```

If the native build fails, it is a local toolchain issue. Ensure Python 3 and a
C/C++ toolchain are installed, then on Node 24 use Node 22 or rebuild with
`CXXFLAGS=-std=c++20` (`CL=/std:c++20` on Windows). From a source checkout you
can rebuild with `pnpm rebuild:native` (or
`npm rebuild tree-sitter better-sqlite3`).

The npm package status is `pack-ready-not-published` until an authorized npm
publish is performed. Validate the package payload with:

```bash
pnpm pack:dry-run
```

## Package Launch Model

`npm install` exposes the `agent-workbench-mcp` bin
(`packaging/agent-workbench/mcp-bin.mjs`), which launches the MCP stdio server
straight from where npm installed the package — no copy, no prefix. The Codex
and Claude plugins launch the same runtime through the portable `node`-based
shim `plugins/agent-workbench/mcp-launch.mjs`, referenced in `.mcp.json` as
`{"command": "node", "args": ["${PLUGIN_ROOT}/mcp-launch.mjs"]}` (Claude uses
`${CLAUDE_PLUGIN_ROOT}`). A bare bin name or `npx` is not spawnable in MCP exec
form on Windows (no PATHEXT, no shell), so `node` plus a script path is the only
reliable cross-platform command shape.

The shim resolves the runtime root from `AGENT_WORKBENCH_INSTALL_ROOT` (an
override that means "the runtime root, or a checkout containing
`src/mcp/stdio-entrypoint.mjs`") or, failing that, by reading the pointer file
written by `postinstall`. Nothing is copied to a prefix.

## GHCR Package Installation

The GHCR container image is a separate, still-valid distribution channel. Its
package definition lives at `packaging/agent-workbench/`:

- `Containerfile` builds the GHCR image.
- `package-manifest.json` lists installed components and distribution
  contracts.
- `.github/workflows/release-ghcr.yml` publishes tagged releases to GHCR.

The container build installs and rebuilds native dependencies the same way the
npm package does:

```bash
pnpm install --frozen-lockfile
pnpm rebuild:native
```

Native module installation requires Python 3, `make`, and a C/C++ compiler.
Runtime dependencies must stay under `dependencies` in `package.json`; do not
leave launcher-required packages such as `tsx` in `devDependencies`. The image
entrypoint launches the MCP stdio server directly:

```text
node --import tsx /opt/agent-workbench/src/mcp/stdio.ts
```

Build and publish use the package containerfile:

```bash
docker build -f packaging/agent-workbench/Containerfile -t ghcr.io/bcherrington/agent-workbench:0.1.0 .
```

Tagged GitHub releases publish through the GHCR workflow.

## Validation

Use these checks before considering plugin/runtime setup changes complete:

```bash
pnpm exec vitest run tests/integration/codex-integration-profile.test.ts tests/integration/common-integration-profile.test.ts
```

The focused integration tests validate the plugin manifest, default prompts,
skill wording, `.mcp.json`, marketplace metadata, server-card metadata, and
package/install profile. Do not rely on user-local plugin validator scripts for
CI unless a repository-owned equivalent exists.

CI runs the repository-owned plugin/package validator:

```bash
pnpm run validate:plugin
```

That validator checks the Codex plugin manifest, `.mcp.json`, hooks, skill,
repo marketplace metadata, MCP server card, package manifest dependency lists,
and package component paths without reading user-local Codex configuration.

For package changes, also run:

```bash
pnpm exec vitest run tests/integration/codex-integration-profile.test.ts
pnpm pack:dry-run
```

For broader runtime-impacting changes, also run:

```bash
pnpm typecheck
pnpm test
```

## Troubleshooting

If `codex plugin list` does not show `agent-workbench@<personal-marketplace>`
as installed and enabled, reinstall the npm runtime, then re-add the plugin from
the personal marketplace:

```bash
npm install -g https://github.com/Auriora/agent-workbench/releases/download/vX.Y.Z/auriora-agent-workbench-X.Y.Z.tgz
codex plugin add agent-workbench@auriora-local
```

If the MCP server fails because the runtime cannot be found, the runtime-root
pointer is missing. Reinstall the npm package so `postinstall` rewrites the
pointer, or set the runtime-root override explicitly:

```bash
npm install -g https://github.com/Auriora/agent-workbench/releases/download/vX.Y.Z/auriora-agent-workbench-X.Y.Z.tgz
# or point the shim at a checkout that contains src/mcp/stdio-entrypoint.mjs:
export AGENT_WORKBENCH_INSTALL_ROOT="$HOME/Projects/agent-workbench"
```

Hooks must not repair missing launchers, install packages, update plugins, or
write Codex configuration. They emit compact `basic` local guidance by default;
set `AGENT_WORKBENCH_HOOK_FEEDBACK=silent` to suppress it. If Codex asks
for hook trust review after install or update, review the plugin-bundled
`hooks/hooks.json` and hook scripts under `plugins/agent-workbench/hooks/`.

To uninstall the Codex plugin, remove the plugin entry from Codex:

```bash
codex plugin remove agent-workbench@auriora-local
```

To uninstall the runtime entirely:

```bash
npm uninstall -g @auriora/agent-workbench
```

## Kiro Power Packaging

The Kiro integration is packaged under
`plugins/agent-workbench/kiro-power/`. It is a distribution wrapper around the
same npm-installed runtime, not another runtime implementation.

The Power includes:

- `POWER.md` for Kiro activation and workflow guidance
- `mcp.json` for the Agent Workbench MCP binding
- `skills/agent-workbench/SKILL.md` for Agent Skills import
- `agents/agent-workbench.json` for Kiro CLI custom-agent hook configuration
- Kiro hook adapters in `hooks/`

Install or refresh the runtime package first:

```bash
npm install -g https://github.com/Auriora/agent-workbench/releases/download/vX.Y.Z/auriora-agent-workbench-X.Y.Z.tgz
```

Then add `plugins/agent-workbench/kiro-power/` as a local Power in Kiro. If Kiro
does not automatically import the bundled skill, import
`plugins/agent-workbench/kiro-power/skills/agent-workbench/` from the Agent
Steering & Skills panel or copy it to `~/.kiro/skills/agent-workbench`.

Kiro hooks are configured through Kiro agent configuration, not Codex
`hooks/hooks.json`. Use `kiro-power/agents/agent-workbench.json` as the source
for a global or workspace Kiro custom agent.

## Claude Code Plugin Packaging

The Claude Code integration is packaged under
`plugins/agent-workbench/claude-plugin/`. It is a distribution wrapper around
the same npm-installed runtime, not another runtime implementation.

The plugin includes:

- `.claude-plugin/plugin.json` for Claude Code plugin metadata
- `.mcp.json` for the Agent Workbench MCP binding
- `skills/agent-workbench/SKILL.md` for Claude Code skill guidance
- `hooks/hooks.json` for Claude Code hook configuration
- Claude Code hook adapters in `hooks/`

Install or refresh the runtime package first:

```bash
npm install -g https://github.com/Auriora/agent-workbench/releases/download/vX.Y.Z/auriora-agent-workbench-X.Y.Z.tgz
```

Then register the Claude plugin from the npm package (replace `<pkg>` with
`npm root -g`/@auriora/agent-workbench):

```bash
claude plugin marketplace add <pkg>/plugins/agent-workbench
claude plugin install agent-workbench@agent-workbench-local --scope user
```

Claude Code plugin layout differs from Kiro and Codex: only
`.claude-plugin/plugin.json` belongs inside `.claude-plugin/`; `skills/`,
`hooks/`, and `.mcp.json` belong at the Claude plugin root. Run
`/reload-plugins` after editing hooks, skills, or MCP config.
