---
title: Install Agent Workbench (npm + Claude Code / Codex)
doc_type: runbook
status: draft
owner: platform
last_reviewed: 2026-06-30
---

# Install Agent Workbench

End-user install guide for the Agent Workbench runtime and its editor plugins.
The runtime ships as a normal npm package (`@auriora/agent-workbench`); plugins
register against the in-place install — no repository clone, no copy-to-prefix.

## When To Use

Use this after deciding to run Agent Workbench in Claude Code or Codex on a fresh
machine. For native-build failures during `npm install`, see
[Native dependency setup](native-dependency-setup.md). For the Codex plugin's
hook/MCP details, see
[Codex Agent Workbench plugin and MCP setup](codex-agent-workbench-plugin.md).

## Prerequisites

- **Node.js 22 (recommended).** Node 24 builds the native core (tree-sitter) only
  with a C++20 toolchain, so a default `npm install -g` on Node 24 hits a build
  error first. Use Node 22, or rebuild with `CXXFLAGS=-std=c++20` (GCC/Clang) /
  `CL=/std:c++20` (MSVC).
- A C/C++ build toolchain and Python 3 for `node-gyp` (Linux: build-essential +
  python3; macOS: Xcode Command Line Tools; Windows: Visual Studio Build Tools
  with the C++ workload). A failing native build is a local toolchain issue to
  resolve — see [Native dependency setup](native-dependency-setup.md).

## 1. Install the runtime (all OSes)

```bash
npm install -g @auriora/agent-workbench
```

This builds the native modules in place and records a runtime-root pointer under
the per-OS state directory (`%LOCALAPPDATA%\agent-workbench` on Windows,
`~/.local/share/agent-workbench` on POSIX). The plugin MCP binding launches that
in-place runtime through the portable `node` shim; nothing is copied to a prefix.

## 2a. Register the Claude Code plugin (verified, clone-free)

This is the verified clone-free path. The npm package ships a package-scoped
Claude marketplace (`plugins/agent-workbench/.claude-plugin/marketplace.json`,
name `agent-workbench-local`).

**macOS / Linux:**

```bash
PKG="$(npm root -g)/@auriora/agent-workbench"
claude plugin marketplace add "$PKG/plugins/agent-workbench"
claude plugin install agent-workbench@agent-workbench-local --scope user
claude plugin list   # -> agent-workbench@agent-workbench-local  v0.3.0  enabled
```

**Windows (PowerShell):**

```powershell
$pkg = "$(npm root -g)\@auriora\agent-workbench"
claude plugin marketplace add "$pkg\plugins\agent-workbench"
claude plugin install agent-workbench@agent-workbench-local --scope user
claude plugin list   # -> agent-workbench@agent-workbench-local  v0.3.0  enabled
```

Start a new Claude Code session so the skill, hooks, and MCP server are
discovered. The first useful MCP resources are `repo:///status`,
`repo:///scope`, and `repo:///overview`.

To update after a new package version:

```bash
npm install -g @auriora/agent-workbench
claude plugin marketplace update agent-workbench-local
```

To uninstall:

```bash
claude plugin uninstall agent-workbench@agent-workbench-local
npm uninstall -g @auriora/agent-workbench   # only if nothing else uses it
```

## 2b. Register the Codex plugin (verified, clone-free)

The npm package ships a package-scoped Codex marketplace
(`plugins/agent-workbench/.agents/plugins/marketplace.json`, name
`agent-workbench-local`), so Codex registers clone-free too.

**macOS / Linux:**

```bash
PKG="$(npm root -g)/@auriora/agent-workbench"
codex plugin marketplace add "$PKG/plugins/agent-workbench"
codex plugin add agent-workbench@agent-workbench-local
codex plugin list   # -> agent-workbench@agent-workbench-local  v0.3.0  installed, enabled
```

**Windows (PowerShell):**

```powershell
$pkg = "$(npm root -g)\@auriora\agent-workbench"
codex plugin marketplace add "$pkg\plugins\agent-workbench"
codex plugin add agent-workbench@agent-workbench-local
codex plugin list   # -> agent-workbench@agent-workbench-local  v0.3.0  installed, enabled
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
