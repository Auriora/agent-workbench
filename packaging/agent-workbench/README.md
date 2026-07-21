<!--
Copyright (C) 2026 Auriora
SPDX-License-Identifier: GPL-3.0-or-later
-->

# Agent Workbench Package

This package definition supports the npm package and the GHCR image for the
Agent Workbench MCP runtime, documentation, Codex/Claude plugin wrappers, skill,
and hook scripts.

The supported distribution channel is the **GitHub release tarball** (package
name `@auriora/agent-workbench`; it is **not** published to the npm registry). It
is a normal npm package: installing the tarball builds the native modules and
launches in place — there is no copy-to-prefix installer, no shell on the install
or runtime path. Install it directly by release URL (see
[the install guide](../../docs/runbooks/install-agent-workbench.md) for the
current version):

```bash
npm install -g https://github.com/Auriora/agent-workbench/releases/download/v0.6.2/auriora-agent-workbench-0.6.2.tgz
```

Checkout-only debug harnesses under `src/debug/`, `debug:*` package scripts,
and active implementation specs under `docs/specs/` are removed from the
containerized package. (npm tarballs already exclude `docs/specs` via the
`files` allowlist.) Cross-repo dogfood and tool-sweep commands are available
only from the owning repository checkout.

## Native build is npm's job (and the user's toolchain)

`npm install` compiles the native modules from source the same way it does for
any native dependency. Only the core `tree-sitter` binding compiles from source;
the grammar packages and `better-sqlite3` ship prebuilt binaries for all
targets. The build needs **Python 3** and a **C/C++ toolchain**:

- Linux/macOS: `make` plus `g++`/`clang++` (e.g. `build-essential` or the Xcode
  command line tools).
- Windows: the MSVC C++ build tools ("Desktop development with C++").
- On **Node 24** the tree-sitter core needs **C++20** (Node 24's V8/cppgc
  headers require it). Use **Node 22** (the supported floor), or rebuild with
  `CXXFLAGS=-std=c++20` (`CL=/std:c++20` on Windows).

If that build fails, it is a local toolchain issue to resolve — not a packaging
bug. The package surfaces an actionable hint in two places: a best-effort note
from `postinstall`, and (authoritatively) a message at server launch if a native
binding cannot load. A source checkout can rebuild with `pnpm rebuild:native`
(or `npm rebuild tree-sitter better-sqlite3`).

## Launch model

`npm install` exposes the `agent-workbench-mcp` bin
(`packaging/agent-workbench/mcp-bin.mjs`), which launches the MCP stdio server
straight from where npm installed the package. The plugins launch the same
runtime through the portable `node`-based shim
(`plugins/agent-workbench/mcp-launch.mjs`) — a bare bin name or `npx` is **not**
spawnable in MCP exec form on Windows, but `node` + a script path is reliable
everywhere.

The package's `postinstall` (`scripts/postinstall.mjs`) records a small
runtime-root pointer under the per-OS state dir
(`%LOCALAPPDATA%\agent-workbench` on Windows, `~/.local/share/agent-workbench`
on Linux/macOS). The plugin shim reads that pointer (or the
`AGENT_WORKBENCH_INSTALL_ROOT` override) to find the in-place runtime — nothing
is copied to a prefix.

Every installed launcher for one canonical repository connects to one
repository daemon. That daemon owns the refresh controller, watcher queue,
graph store, activity lease, and sole refresh worker independently of any one
client connection. Stale first reads and watcher events request this path
automatically; the package does not expose a manual refresh command, retry
loop, provider branch, or alternate indexer.

This convergence behavior describes the current unreleased `0.6.1` package.
The install command above intentionally remains on the latest released
`0.5.2`; it does not obtain this behavior until v0.6.2 is published.

Snapshot replacement is transactional. Readers retain the prior published
snapshot until the replacement's file, graph, unresolved-reference, docs,
heading, FTS, and coverage writes are complete. Failed, superseded, and
orphaned builds remain invisible. Publication is separate from freshness and
coverage, so a published watcher-clean snapshot may still report bounded
partial evidence-class coverage.

Schema identity v2 seeds `graph-v2.sqlite` without mutating v0.6.2
`graph.sqlite`, then classifies legacy non-refreshing rows as published and
legacy refreshing rows as failed. After owner admission, it preserves
`graph-v1.sqlite.pre-v2` and atomically guards `graph.sqlite`; the actual v0.6.2
adapter blocks on that non-SQLite guard. Rollback is not an in-place downgrade:
stop every owner, then restore a known complete pre-migration cache or move the
whole generated `.cache/agent-workbench` directory to a recoverable backup
before allowing the older runtime to rebuild from repository source. The
retained v1 artifact is recovery provenance, not permission to overwrite the
live guard. Never delete individual
database, WAL/SHM, socket, metadata, or ownership files while owner evidence is
live or ambiguous. The exact operator procedure is in the
[install runbook](../../docs/runbooks/install-agent-workbench.md#upgrade-rollback-and-schema-compatibility).

## Package acceptance boundary

Run the complete package checks from a source checkout:

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

`install-smoke.mjs` and `mcp-launch-smoke.mjs` are checkout/package-shape
checks. `installed-package-mcp-smoke.mjs` creates a real tarball, installs it
into isolated runtime and state roots, invokes that installation's
`agent-workbench-mcp` bin, and checks one-daemon convergence with exact
surviving reference/docs hits and deleted-evidence absence.

Its Codex- and Claude-labelled MCP sessions establish provider-neutral daemon
behavior only. They are not evidence that the real Codex or Claude Code CLIs
discovered or invoked the plugin; live CLI proof must be collected separately.
Large-repository convergence outside current bounds remains EB014 rather than a
package fallback or second execution path.

## Contracts

- `npm-package.json` — the npm package contract (`@auriora/agent-workbench`,
  `agent-workbench-mcp` bin, required-paths allowlist).
- `package-manifest.json` — the GHCR container manifest (dependency set, native
  build tools, components, plugin/skill/hook wiring).

## GHCR image

The GHCR image is a separate channel. Its build uses pnpm; the image entrypoint
launches the MCP stdio server:

```bash
node --import tsx /opt/agent-workbench/src/mcp/stdio.ts
```

The container build runs:

```bash
pnpm install --frozen-lockfile
pnpm rebuild:native
```

Build locally:

```bash
docker build -f packaging/agent-workbench/Containerfile -t agent-workbench:local .
```

GHCR release automation publishes the same containerfile as:

```text
ghcr.io/bcherrington/agent-workbench:<version>
ghcr.io/bcherrington/agent-workbench:latest
```
