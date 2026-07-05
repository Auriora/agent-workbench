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
npm install -g https://github.com/Auriora/agent-workbench/releases/download/v0.4.0/auriora-agent-workbench-0.4.0.tgz
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
