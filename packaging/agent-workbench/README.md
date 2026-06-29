# Agent Workbench Package

This package definition supports the npm installer and the GHCR image for the
Agent Workbench MCP runtime, documentation, Codex plugin wrapper, skill, and
hook scripts.

The supported distribution channel is the npm package
(`@auriora/agent-workbench`). Install and launch are **shell-free** on Windows,
macOS, and Linux: no POSIX shell is required on the install or runtime path.

Checkout-only debug harnesses under `src/debug/`, `debug:*` package scripts,
and active implementation specs under `docs/specs/` are removed from installed
and containerized packages. Cross-repo dogfood and tool-sweep commands are
available only from the owning repository checkout, not from deployed Agent
Workbench instances.

The image entrypoint launches the MCP stdio server:

```bash
node --import tsx /opt/agent-workbench/src/mcp/stdio.ts
```

Dependency installation is defined in `package-manifest.json`. The package
requires Node.js 22 or newer and pnpm 10.18.1. When `node_modules` is not
already packaged, the host installer runs:

```bash
pnpm install --frozen-lockfile
pnpm rebuild:native
```

Native module builds need Python 3 and a C++20 toolchain. Only the core
`tree-sitter` runtime binding compiles from source; the grammar packages ship
prebuilt binaries for all targets. On Linux/macOS that toolchain is `make` plus
`g++`/`clang++` (e.g. `build-essential` or the Xcode command line tools); on
Windows it is the MSVC C++ build tools (the "Desktop development with C++"
workload). The runtime dependency set includes `tsx` because the installed MCP
launcher uses the TypeScript stdio entrypoint directly.

The host installer is the shell-free Node module
`packaging/agent-workbench/installer.mjs` — the single source of install logic.
Using only `node:fs`/`path`/`os`/`child_process`, it validates the package
contents, copies them to a per-OS local prefix
(`%LOCALAPPDATA%\agent-workbench` on Windows, `~/.local/share/agent-workbench`
on Linux/macOS), generates the `bin/agent-workbench-mcp.mjs` Node launcher, runs
the native rebuild when dependencies are not already packaged, and installs the
Codex plugin wrapper. It does **not** write a fallback `[mcp_servers]` block to
`config.toml` or merge a user `hooks.json`; the plugin-bundled `.mcp.json` and
`hooks/hooks.json` provide those. A missing prerequisite fails loud with per-OS
remediation before any files are written.

The npm package contract is `npm-package.json`. It exposes the
`@auriora/agent-workbench` package; its `npm-install.mjs` entry point imports and
runs `installer.mjs` in-process (no shell, no subprocess installer):

```bash
npx @auriora/agent-workbench install
```

`scripts/install-agent-workbench-package.sh` is retained only as a thin POSIX
delegator (`exec node …/installer.mjs --source <repo> "$@"`) so it cannot
diverge from the Node installer. It still requires bash, so it is not part of
the shell-free path; prefer the npm command above.

Build locally:

```bash
docker build -f packaging/agent-workbench/Containerfile -t agent-workbench:local .
```

GHCR release automation should publish the same containerfile as:

```text
ghcr.io/bcherrington/agent-workbench:<version>
ghcr.io/bcherrington/agent-workbench:latest
```
