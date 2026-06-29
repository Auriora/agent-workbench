---
title: Codex Agent Workbench plugin and MCP setup
doc_type: runbook
status: draft
owner: platform
last_reviewed: 2026-06-13
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
- The plugin MCP server launches the stable package prefix created by
  `scripts/install-agent-workbench-package.sh`.
- The plugin must not launch runtime code from Codex's plugin cache path.

The npm and GHCR packages are distribution wrappers for complete installs. They
contain runtime source, docs, package metadata, the Codex plugin, skills, hooks,
MCP configuration, and an installer that registers the plugin through the
personal marketplace. This is not a second runtime implementation; the plugin
MCP config launches the same MCP entrypoint installed under a stable prefix.

Companion MCP servers, such as a spec lifecycle server for a separate docs
repository, should also be configured as host-level Codex MCP entries. Keep
their install and validation notes with the repository they target; the Agent
Workbench plugin should not package or proxy those companion runtimes.

This keeps source updates explicit:

- Install a new package version.
- Reinstall `agent-workbench@<personal-marketplace>`.
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
installed package launcher and must not point at a plugin-cache source path.

The repository also includes `.agents/plugins/marketplace.json` for inspectable
repo-level marketplace metadata. It points `agent-workbench` at the checked-in
`./plugins/agent-workbench` source and uses the same `Developer Tools` category
as the plugin manifest. This metadata is useful when testing the checkout as a
marketplace source.

Packaged installs still use the installer-owned personal marketplace flow. The
installer writes or updates `~/.agents/plugins/marketplace.json` and then runs
`codex plugin add agent-workbench@<personal-marketplace>`. Do not edit the
checked-in marketplace file to point at an installed package prefix; package
installs are intentionally represented by the personal marketplace entry.

When changing plugin packaging, update the plugin cachebuster and reinstall:

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
`~/.codex/config.toml`. The supported Codex path is plugin-bundled `.mcp.json`
launching the installed package prefix.

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

Install and launch are shell-free on all supported operating systems: the npm
entry point and the generated `bin/agent-workbench-mcp.mjs` launcher invoke
`node` directly, with no POSIX shell on the install or runtime path. The
supported distribution channel is the npm package (Decision 2).

| OS | Node | Native toolchain (for the build path) | Verification |
| --- | --- | --- | --- |
| Linux (x64/arm64) | 22+ | `make` + `g++`/`clang++` (C++20), Python 3 — e.g. `build-essential` | Smoke matrix verified |
| macOS | 22+ | Xcode command line tools (`xcode-select --install`), Python 3 | Smoke matrix pending runner |
| Windows 10+ | 22+ | MSVC C++ build tools ("Desktop development with C++"), Python 3 | Smoke matrix pending runner |

Default install prefix per OS: `%LOCALAPPDATA%\agent-workbench` on Windows
(falling back to `%USERPROFILE%\AppData\Local`), and
`~/.local/share/agent-workbench` on Linux/macOS. Override with `--prefix` or
`AGENT_WORKBENCH_INSTALL_ROOT`.

**Native build prerequisite (Decision 1).** A C++20 toolchain is required only
when the install must build native modules from source (no packaged
`node_modules`). This is bounded: of the native dependencies, only the core
`tree-sitter` runtime binding compiles from source; the four grammar packages
(`tree-sitter-go`, `-javascript`, `-python`, `-typescript`) ship prebuilt
binaries for all targets, and `better-sqlite3` ships prebuilds. When a packaged
`node_modules` is present, no compiler is needed. A missing toolchain fails loud
with per-OS remediation before any files are written.

The cross-platform smoke matrix that backs the "Verification" column lives in
`.github/workflows/cross-platform-packaging.yml` (install, MCP launch, and hook
smokes per OS). The macOS/Windows legs are authored but await a runner; that gap
is tracked in the spec's `verification.md`.

## NPM Package Installation

The npm distribution package is `@auriora/agent-workbench`. Its package
contract lives at `packaging/agent-workbench/npm-package.json`, and the CLI
entry point is `packaging/agent-workbench/npm-install.mjs`, which runs the
shell-free Node installer (`packaging/agent-workbench/installer.mjs`) in-process.

Install or refresh the package-backed Codex plugin with:

```bash
npx @auriora/agent-workbench install
```

Pass installer options after `--` when needed:

```bash
npx @auriora/agent-workbench install -- \
  --prefix "$HOME/.local/share/agent-workbench" \
  --codex-home "$HOME/.codex"
```

The npm package status is `pack-ready-not-published` until an authorized npm
publish is performed. Validate the package payload with:

```bash
pnpm pack:dry-run
```

## GHCR Package Installation

The package definition lives at `packaging/agent-workbench/`:

- `Containerfile` builds the GHCR image.
- `package-manifest.json` lists installed components and distribution
  contracts.
- `.github/workflows/release-ghcr.yml` publishes tagged releases to GHCR.
- `packaging/agent-workbench/installer.mjs` is the single, shell-free source of
  install logic; `scripts/install-agent-workbench-package.sh` is a thin POSIX
  delegator to it (it still requires bash, so it is not part of the shell-free
  path).

The installer copies all project components required by the runtime and Codex
integration:

- runtime source and package metadata
- documentation
- Codex plugin manifest, MCP config, skill, and hooks
- host launcher for the MCP stdio server
- dependency manifest and lockfile

Run a package install from a checkout or unpacked package source:

```bash
scripts/install-agent-workbench-package.sh
```

Use explicit locations when needed:

```bash
scripts/install-agent-workbench-package.sh \
  --prefix "$HOME/.local/share/agent-workbench" \
  --codex-home "$HOME/.codex"
```

Unless `--skip-codex-config` is passed, the installer:

- removes any old marked `# BEGIN Agent Workbench package install` host-level
  MCP block from `~/.codex/config.toml`;
- copies the plugin source to `~/plugins/agent-workbench`;
- ensures the personal marketplace exposes `agent-workbench`;
- cachebusts the local plugin version; and
- runs `codex plugin add agent-workbench@<personal-marketplace>`.

Hooks remain plugin-bundled. They are not duplicated into `~/.codex/hooks.json`.
Codex may require hook trust review before plugin hooks run.

Dependency installation is explicit in
`packaging/agent-workbench/package-manifest.json`. The package requires
Node.js 22 or newer and pnpm 10.18.1. If the source package does not already
include `node_modules`, the installer runs:

```bash
pnpm install --frozen-lockfile
pnpm rebuild:native
```

Native module installation requires Python 3, `make`, and a C++20-capable
compiler. Runtime dependencies must stay under `dependencies` in `package.json`;
do not leave launcher-required packages such as `tsx` in `devDependencies`.

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
scripts/install-agent-workbench-package.sh --dry-run --skip-codex-config
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
as installed and enabled, rerun the package installer, then reinstall the
plugin from the personal marketplace:

```bash
scripts/install-agent-workbench-package.sh
codex plugin add agent-workbench@auriora-local
```

If the MCP server fails because `bin/agent-workbench-mcp` is missing under the
package prefix, reinstall the package with the expected prefix:

```bash
scripts/install-agent-workbench-package.sh \
  --prefix "${AGENT_WORKBENCH_INSTALL_ROOT:-$HOME/.local/share/agent-workbench}"
```

Hooks must not repair missing launchers, install packages, update plugins, or
write Codex configuration. They stay silent by default and emit only compact
local guidance when `AGENT_WORKBENCH_HOOK_FEEDBACK=basic` is set. If Codex asks
for hook trust review after install or update, review the plugin-bundled
`hooks/hooks.json` and hook scripts under `plugins/agent-workbench/hooks/`.

To uninstall the Codex plugin, remove the plugin entry from Codex:

```bash
codex plugin remove agent-workbench@auriora-local
```

Remove the installed package prefix only when no active local setup depends on
it.

## Kiro Power Packaging

The Kiro integration is packaged under
`plugins/agent-workbench/kiro-power/`. It is a distribution wrapper around the
same installed runtime prefix, not another runtime implementation.

The Power includes:

- `POWER.md` for Kiro activation and workflow guidance
- `mcp.json` for the Agent Workbench MCP binding
- `skills/agent-workbench/SKILL.md` for Agent Skills import
- `agents/agent-workbench.json` for Kiro CLI custom-agent hook configuration
- Kiro hook adapters in `hooks/`

Install or refresh the runtime package first:

```bash
scripts/install-agent-workbench-package.sh \
  --prefix "$HOME/.local/share/agent-workbench" \
  --skip-codex-config
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
the same installed runtime prefix, not another runtime implementation.

The plugin includes:

- `.claude-plugin/plugin.json` for Claude Code plugin metadata
- `.mcp.json` for the Agent Workbench MCP binding
- `skills/agent-workbench/SKILL.md` for Claude Code skill guidance
- `hooks/hooks.json` for Claude Code hook configuration
- Claude Code hook adapters in `hooks/`

Install or refresh the runtime package first:

```bash
scripts/install-agent-workbench-package.sh \
  --prefix "$HOME/.local/share/agent-workbench" \
  --skip-codex-config
```

Then test the plugin locally:

```bash
claude --plugin-dir plugins/agent-workbench/claude-plugin
```

Claude Code plugin layout differs from Kiro and Codex: only
`.claude-plugin/plugin.json` belongs inside `.claude-plugin/`; `skills/`,
`hooks/`, and `.mcp.json` belong at the Claude plugin root. Run
`/reload-plugins` after editing hooks, skills, or MCP config.
