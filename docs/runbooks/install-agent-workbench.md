---
title: Install Agent Workbench (portable Windows or npm + Claude Code / Codex)
doc_type: runbook
status: draft
owner: platform
last_reviewed: 2026-08-08
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Install Agent Workbench

End-user install guide for the Agent Workbench runtime and its editor plugins.
Windows x64 releases include a self-contained ZIP; all platforms retain the
normal npm package (`@auriora/agent-workbench`). Plugins register against the
selected in-place runtime without a repository clone.

## When To Use

Use this after deciding to run Agent Workbench in Claude Code or Codex on a fresh
machine. For native-build failures during `npm install`, see
[Native dependency setup](native-dependency-setup.md). For the Codex plugin's
hook/MCP details, see
[Codex Agent Workbench plugin and MCP setup](codex-agent-workbench-plugin.md).

## Prerequisites

The Windows x64 portable ZIP needs only supported Windows and a Codex or Claude
Code installation. It contains Node 22 and the compiled native dependencies.

The npm/source-package path has these additional prerequisites:

- **Node.js 22 (recommended).** Node 24 builds the native core (tree-sitter) only
  with a C++20 toolchain, so a default `npm install -g` on Node 24 hits a build
  error first. Use Node 22, or rebuild with `CXXFLAGS=-std=c++20` (GCC/Clang) /
  `_CL_=/std:c++20` (MSVC, appended after project-supplied options).
- A C/C++ build toolchain and Python 3 for `node-gyp` (Linux: build-essential +
  python3; macOS: Xcode Command Line Tools; Windows: Visual Studio Build Tools
  with the C++ workload). A failing native build is a local toolchain issue to
  resolve — see [Native dependency setup](native-dependency-setup.md).

## 1a. Install the Windows x64 portable runtime

Use this path when the selected GitHub release lists
`agent-workbench-vX.Y.Z-windows-x64.zip`. Download that ZIP and its matching
`.sha256` file, then run the following from the download directory:

```powershell
$version = "X.Y.Z"
$zip = "agent-workbench-v$version-windows-x64.zip"
$expected = ((Get-Content "$zip.sha256") -split "\s+")[0]
$actual = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw "Agent Workbench ZIP checksum mismatch" }

$installRoot = Join-Path $env:LOCALAPPDATA "Programs\Agent Workbench"
Expand-Archive -LiteralPath $zip -DestinationPath $installRoot
$bundleRoot = Join-Path $installRoot "agent-workbench-v$version-windows-x64"
& (Join-Path $bundleRoot "configure.cmd")
$packageRoot = Join-Path $bundleRoot "runtime\node_modules\@auriora\agent-workbench"
$pluginRoot = Join-Path $packageRoot "plugins\agent-workbench"
```

`configure.cmd` is fail-fast. It records the package root, writes absolute
bundled-Node MCP commands for Codex and Claude, and merges Codex hooks using the
same executable. It writes hooks to `CODEX_HOME` when that environment variable
is set; otherwise it uses `%USERPROFILE%\.codex`. Keep the extracted directory
at that path. If it is moved, rerun `configure.cmd` before starting another
coding-agent session.

Register Claude Code:

```powershell
claude plugin marketplace add "$pluginRoot"
claude plugin install agent-workbench@agent-workbench-local --scope user
claude plugin list
```

Register Codex:

```powershell
codex plugin marketplace add "$pluginRoot"
codex plugin add agent-workbench@agent-workbench-local
codex plugin list
```

The portable asset contains `manifest.json` with the package version, immutable
Git commit, Windows architecture, exact Node version and module ABI,
source-package, committed source-lock, and pruned deployment-lock identities,
and an immutable payload hash.
Files that `configure.cmd` must materialize are declared outside that immutable
hash set, so normal first-run configuration does not invalidate the manifest.
GitHub publishes the ZIP checksum separately and publishes build provenance
through GitHub artifact attestations. The attestation is not a separate release
asset. Authenticode signing is not claimed unless the release explicitly says
the binary was signed.

## 1b. Install the npm runtime (all OSes)

Agent Workbench is distributed through **GitHub Releases** (it is not published to
the npm registry). Install the release tarball directly by URL — npm builds the
native modules and runs the package's `postinstall` the same as any package:

```bash
npm install -g https://github.com/Auriora/agent-workbench/releases/download/v0.6.9/auriora-agent-workbench-0.6.9.tgz
```

For a different version, take the tarball URL from the matching release on
<https://github.com/Auriora/agent-workbench/releases>. Offline/air-gapped: download
the `.tgz` from that page and `npm install -g ./auriora-agent-workbench-0.6.9.tgz`.

The commands above install release `0.6.9`, including the compiled lightweight
bridge, daemon-owned refresh convergence, and schema-isolated publication.

This source-package path builds the native modules in place and records a runtime-root pointer under
the per-OS state directory (`%LOCALAPPDATA%\agent-workbench` on Windows,
`~/.local/share/agent-workbench` on POSIX). The plugin MCP binding launches that
in-place runtime through the portable `node` shim; nothing is copied to a prefix.

For local checkout testing, maintainers can build and install the current
package tarball with the developer CLI:

```bash
awb package install-local --dry-run
awb package install-local
```

The wrapper delegates to `scripts/install-agent-workbench-package.sh`, which
packs the checkout, installs the tarball with `npm install -g`, and optionally
registers the package-scoped Codex plugin.

For Codex development directly from this checkout, materialize and register the
repo-local plugin binding and install its SessionStart and post-edit hooks with:

```bash
scripts/install-agent-workbench-repo-local.sh
```

The generated marketplace is kept under `.cache/agent-workbench/`; the tracked
plugin manifest remains portable. Re-run the command after checkout changes
that affect the plugin or hooks, then start a new Codex session.

## 2a. Register the Claude Code plugin after an npm installation

This is the verified clone-free path. The npm package ships a package-scoped
Claude marketplace (`plugins/agent-workbench/.claude-plugin/marketplace.json`,
name `agent-workbench-local`).

**macOS / Linux:**

```bash
PKG="$(npm root -g)/@auriora/agent-workbench"
claude plugin marketplace add "$PKG/plugins/agent-workbench"
claude plugin install agent-workbench@agent-workbench-local --scope user
claude plugin list   # -> agent-workbench@agent-workbench-local  v0.6.9  enabled
```

**Windows (PowerShell):**

```powershell
$pkg = "$(npm root -g)\@auriora\agent-workbench"
claude plugin marketplace add "$pkg\plugins\agent-workbench"
claude plugin install agent-workbench@agent-workbench-local --scope user
claude plugin list   # -> agent-workbench@agent-workbench-local  v0.6.9  enabled
```

Start a new Claude Code session so the skill, hooks, and MCP server are
discovered. The first useful MCP resources are `repo:///status`,
`repo:///scope`, and `repo:///overview`.

To update after a new package version (use the new release's tarball URL):

```bash
npm install -g https://github.com/Auriora/agent-workbench/releases/download/vX.Y.Z/auriora-agent-workbench-X.Y.Z.tgz
claude plugin marketplace update agent-workbench-local
```

To uninstall:

```bash
claude plugin uninstall agent-workbench@agent-workbench-local
npm uninstall -g @auriora/agent-workbench   # only if nothing else uses it
```

## 2b. Register the Codex plugin after an npm installation

The npm package ships a package-scoped Codex marketplace
(`plugins/agent-workbench/.agents/plugins/marketplace.json`, name
`agent-workbench-local`), so Codex registers clone-free too.

**macOS / Linux:**

```bash
PKG="$(npm root -g)/@auriora/agent-workbench"
codex plugin marketplace add "$PKG/plugins/agent-workbench"
codex plugin add agent-workbench@agent-workbench-local
codex plugin list   # -> agent-workbench@agent-workbench-local  v0.6.9  installed, enabled
```

**Windows (PowerShell):**

```powershell
$pkg = "$(npm root -g)\@auriora\agent-workbench"
codex plugin marketplace add "$pkg\plugins\agent-workbench"
codex plugin add agent-workbench@agent-workbench-local
codex plugin list   # -> agent-workbench@agent-workbench-local  v0.6.9  installed, enabled
```

Start a new Codex session so the skill, hooks, and MCP server are discovered. See
[Codex Agent Workbench plugin and MCP setup](codex-agent-workbench-plugin.md) for
hook behavior, update/uninstall, and the separate `auriora-local` checkout
marketplace used for plugin development.

## Verify the MCP server launches

In a new editor session, call an Agent Workbench resource (for example
`repo:///status`). A successful response confirms the `node` shim resolved the
runtime-root pointer and started the MCP server against the installed copy. If
the launcher reports the runtime is missing, reinstall the npm package rather
than hand-editing config; the pointer is rewritten on install.

## Verify refresh convergence

The installed runtime owns refresh work in one per-repository daemon. Codex,
Claude Code, and other MCP clients connected to the same canonical repository
share that controller, graph store, watcher queue, and worker. A stale first
read or repository change requests the existing refresh path automatically;
there is no manual refresh command.

Read `repo:///status`, then inspect `integration:///health/agent-workbench` when
diagnostic detail is needed. The daemon block is authoritative for the current
execution:

- `planned` or `running` with `activity_lease_held: true` means refresh owns the
  daemon lifetime. The prior published snapshot remains visible but must not be
  treated as fresh proof.
- `complete` with `publication_state: published` means the target and visible
  snapshot identities agree and the activity lease has been released.
- `failed` includes bounded `last_failure` evidence and leaves any existing
  publication target invisible; a failure before build creation can have no
  publication state. One later ordinary stale read may request one successor;
  failure callbacks and health reads do not retry automatically.
- `worker_invocations` is a cumulative controller count. It can demonstrate
  that a bounded convergence interval used one worker pass, but it is not a
  general performance metric.

If another client disconnects while refresh is active, leave the daemon to
finish. Do not remove the graph database, WAL/SHM files, socket, metadata, or
ownership records. A replacement daemon recovers an orphaned build only after
positive evidence that the previous owner is dead; ambiguous ownership returns
a structured blocked result and requires investigation, not manual cleanup.

Large-repository warm-up completion and deadline tuning remain tracked by
EB014. A finite refresh failure on a repository that exceeds current bounds is
not authorization to add a second indexer, retry loop, or partial-result path.

## Upgrade, rollback, and schema compatibility

The 0.6.2 runtime adds schema-identity-v2 publication. It seeds
`graph-v2.sqlite` from v0.5.2 `graph.sqlite` without modifying the
source, then transactionally classifies non-refreshing snapshots as published
and refreshing snapshots as failed. After owner admission and v2 readiness it
checkpoints v1, preserves `graph-v1.sqlite.pre-v2`, and atomically replaces
`graph.sqlite` with a non-SQLite guard. The released v0.5.2 adapter then blocks
with `SQLITE_NOTADB`; it cannot read or mutate v2. Failed seeding, migration, or
retirement cleans its candidate and leaves a recoverable state.

For upgrades that retain the same graph schema, stop the prior repository
daemon before starting the new version. If that positively dead owner left a
`building` snapshot, the replacement runtime marks it failed only when the
repository, schema, and exact recovered owner generation match. A live owner,
schema mismatch, or incomplete owner chain remains blocked.

For rollback, restore a known complete pre-migration cache only after every MCP
client and daemon or standalone owner has stopped. Do not copy
`graph-v1.sqlite.pre-v2` over the live guard in place; the runtime retains that
artifact for recovery provenance, not as an ad hoc operator overwrite. When a
complete cache restore is unavailable, rebuild the derived store from
repository source using this recoverable quarantine procedure:

1. Close every Codex, Claude Code, and direct MCP session for the repository.
2. Confirm the authoritative repository ownership record is absent or names an
   owner that is positively dead. If it names a daemon, also confirm the
   reported PID no longer exists and its local socket or named pipe cannot be
   connected. A standalone owner may have no daemon socket, so socket absence
   alone is never sufficient. If any ownership, process, or endpoint check is
   inconclusive, stop; ownership is ambiguous.
3. Move the whole generated cache aside instead of deleting individual SQLite,
   WAL/SHM, daemon, socket, metadata, or ownership files.

On macOS or Linux, after replacing `/absolute/repo` with the canonical
repository path:

```bash
AWB_ROLLBACK_REPO=/absolute/repo
AWB_ROLLBACK_CACHE="$AWB_ROLLBACK_REPO/.cache/agent-workbench"
mv "$AWB_ROLLBACK_CACHE" "$AWB_ROLLBACK_CACHE.pre-rollback-$(date +%Y%m%d%H%M%S)"
```

On Windows PowerShell:

```powershell
$awbRollbackRepo = "C:\absolute\repo"
$awbRollbackCache = Join-Path $awbRollbackRepo ".cache\agent-workbench"
$awbRollbackBackup = "$awbRollbackCache.pre-rollback-$(Get-Date -Format yyyyMMddHHmmss)"
Move-Item -LiteralPath $awbRollbackCache -Destination $awbRollbackBackup
```

Install the intended older package only after the cache is quarantined, then
start one session and let that runtime create a compatible derived store. Keep
the backup until repository status and required queries are verified. Never
attempt an in-place schema downgrade.

## Understand the evidence boundary

These checks establish different claims:

- Checkout tests that launch `src/mcp/stdio-entrypoint.mjs` prove source
  composition only.
- Invoking `agent-workbench-mcp` from a real isolated tarball installation
  proves the installed package entrypoint and native/runtime dependencies.
- Two MCP sessions labelled `codex` and `claude_code` prove provider-neutral
  behavior through one daemon; labels alone do not prove either real CLI loaded
  its plugin.
- A real Codex or Claude Code claim requires a separate live CLI session that
  discovers the installed plugin and calls its Agent Workbench surfaces.

Maintainers can reproduce the package-level gates with:

```bash
pnpm typecheck
pnpm test
pnpm run validate:plugin
pnpm run validate:skills
pnpm pack:dry-run
node scripts/ci/install-smoke.mjs
node scripts/ci/mcp-launch-smoke.mjs
CXXFLAGS=-std=c++20 node scripts/ci/installed-package-mcp-smoke.mjs
```

The reusable Windows preflight additionally deploys the committed production
dependency graph on `windows-2022`, passes the ZIP through a separate consumer
job with a constrained `PATH`, checks native loads, installed Codex and Claude
hooks, MCP initialization, and bounded process cleanup through the bundled Node
executable, and performs no publication. Pull requests and manual dispatch use
this gate before any release tag exists. A governed release reuses the same
jobs, publishes GHCR, generates the ZIP attestation, and creates the public GitHub
release last; an existing release is a hard conflict rather than an asset
replacement target.

The final smoke packs and installs a real tarball into isolated roots, starts
the installed bin, connects two provider-labelled sessions to one daemon, and
checks exact surviving graph/docs hits plus deleted-evidence absence. It
records `real_agent_cli_executed: false` unless a separate CLI-level test ran.
