<!--
Copyright (C) 2026 Auriora
SPDX-License-Identifier: GPL-3.0-or-later
-->

# Agent Workbench

Agent Workbench gives coding agents a local, repository-aware evidence layer.
Through MCP, an agent can orient itself, find relevant code and documentation,
trace symbols and references, assess likely impact, plan verification, and make
bounded workspace edits without repeatedly scanning the whole repository.

It is designed for two participants:

- **You** install and operate one local runtime for the repositories where you
  want stronger coding-agent support.
- **Your coding agent** uses the runtime's evidence to navigate and change a
  repository with explicit freshness, capability, provenance, and safety
  signals.

Agent Workbench supports an agent; it does not replace one.

## Install

Agent Workbench is distributed as an npm package attached to each
[GitHub release](https://github.com/Auriora/agent-workbench/releases). Normal
installations should use that package rather than a source checkout.

You need macOS, Linux, or Windows, plus Node.js, npm, Python 3, and a C/C++
build toolchain for the native parser dependencies. Node.js 22 is recommended.
Node.js 24 requires C++20 compiler flags; on macOS, install Xcode Command Line
Tools with `xcode-select --install` if no compiler is available. On Windows,
install Visual Studio Build Tools with the C++ workload. The commands below use
`npm.cmd` in PowerShell so they do not depend on PowerShell script-execution
policy allowing the `npm.ps1` shim.

### macOS And Linux

With `nvm` installed, install Node.js 22 and the v0.5.2 runtime:

```bash
nvm install 22
nvm use 22
npm install -g https://github.com/Auriora/agent-workbench/releases/download/v0.5.2/auriora-agent-workbench-0.5.2.tgz
```

For Node.js 24:

```bash
CXXFLAGS="-std=c++20" npm install -g https://github.com/Auriora/agent-workbench/releases/download/v0.5.2/auriora-agent-workbench-0.5.2.tgz
```

For an offline installation, download the release asset and install it from the
directory containing the file:

```bash
npm install -g ./auriora-agent-workbench-0.5.2.tgz
```

### Windows PowerShell

Install Node.js 22, Python 3, and Visual Studio Build Tools with the C++
workload, then open a new PowerShell window and install the runtime:

```powershell
node --version
npm.cmd --version
npm.cmd install --global "https://github.com/Auriora/agent-workbench/releases/download/v0.5.2/auriora-agent-workbench-0.5.2.tgz"
```

For Node.js 24, append the MSVC C++20 flag after package-supplied compiler
options, then remove it from the current PowerShell session. Use `_CL_`, not
`CL`: MSVC appends `_CL_` after command-line options, so it overrides the
`/std:c++17` option supplied by tree-sitter's build project.

```powershell
Remove-Item Env:CL -ErrorAction SilentlyContinue
$env:_CL_ = "/std:c++20"
npm.cmd install --global "https://github.com/Auriora/agent-workbench/releases/download/v0.5.2/auriora-agent-workbench-0.5.2.tgz"
Remove-Item Env:_CL_ -ErrorAction SilentlyContinue
```

For an offline installation, download the release asset and install it from the
directory containing the file:

```powershell
npm.cmd install --global ".\auriora-agent-workbench-0.5.2.tgz"
```

### Codex

On macOS or Linux:

```bash
PKG="$(npm root -g)/@auriora/agent-workbench"
codex plugin marketplace add "$PKG/plugins/agent-workbench"
codex plugin add agent-workbench@agent-workbench-local
codex plugin list
```

On Windows PowerShell:

```powershell
$packageRoot = Join-Path (npm.cmd root --global) "@auriora\agent-workbench"
$pluginRoot = Join-Path $packageRoot "plugins\agent-workbench"
codex plugin marketplace add "$pluginRoot"
codex plugin add agent-workbench@agent-workbench-local
codex plugin list
```

### Claude Code

On macOS or Linux:

```bash
PKG="$(npm root -g)/@auriora/agent-workbench"
claude plugin marketplace add "$PKG/plugins/agent-workbench"
claude plugin install agent-workbench@agent-workbench-local --scope user
claude plugin list
```

On Windows PowerShell:

```powershell
$packageRoot = Join-Path (npm.cmd root --global) "@auriora\agent-workbench"
$pluginRoot = Join-Path $packageRoot "plugins\agent-workbench"
claude plugin marketplace add "$pluginRoot"
claude plugin install agent-workbench@agent-workbench-local --scope user
claude plugin list
```

The plugin list should show `agent-workbench@agent-workbench-local` as enabled.
Start a new coding-agent session after installation so it discovers the skill,
hooks, and MCP server.

See [Install Agent Workbench](docs/runbooks/install-agent-workbench.md) for
updates, uninstallation, platform details, and native-build troubleshooting.

## Update

The installed runtime contains a package-scoped marketplace named
`agent-workbench-local`. This makes updates clone-free: install the newer
release tarball, refresh the plugin from the same marketplace, then restart the
coding-agent session.

```bash
npm install -g https://github.com/Auriora/agent-workbench/releases/download/vX.Y.Z/auriora-agent-workbench-X.Y.Z.tgz
```

On Windows PowerShell, use the command shim explicitly:

```powershell
npm.cmd install --global "https://github.com/Auriora/agent-workbench/releases/download/vX.Y.Z/auriora-agent-workbench-X.Y.Z.tgz"
```

Refresh Codex:

```bash
codex plugin add agent-workbench@agent-workbench-local
```

Refresh Claude Code:

```bash
claude plugin marketplace update agent-workbench-local
```

The marketplace source lives inside the installed package, so it follows the
runtime version. It is not a remote automatic-update channel: selecting and
installing a newer release remains an explicit user action.

## Verify Your First Session

Open a supported coding agent in a repository and ask it to read
`repo:///orientation`. This public resource is the compact starting receipt for
repository identity, scope, freshness, and available capabilities. A healthy
response links to more detailed resources such as `repo:///status`,
`repo:///scope`, and `repo:///overview`.

If tool schemas are deferred in the client, ask the agent to discover these
Agent Workbench tools:

```text
context_for_task
verification_plan
diagnostics_for_files
docs_search
```

If orientation cannot be read, first confirm that the plugin is enabled, then
restart the agent session. The [installation runbook](docs/runbooks/install-agent-workbench.md)
covers runtime-path and native-module failures.

## How An Agent Should Use It

A productive default workflow is:

```text
repo:///orientation
  -> context_for_task
  -> targeted source, symbol, reference, or documentation evidence
  -> preview/apply a bounded edit when requested
  -> diagnostics_for_files
  -> verification_plan
  -> run the relevant checks and report the evidence
```

The main capabilities are:

- repository orientation, scope, status, and capability discovery
- task-focused code and documentation routing
- symbol search, reference finding, and bounded impact analysis
- documentation search, outlines, maps, and section reads
- read-only file diagnostics and verification planning
- workspace edit preview/apply with containment, token, and drift checks
- integration profiles and health evidence for configured agent surfaces

Use `context_for_task` before broad file reads. Prefer targeted symbol,
reference, impact, and documentation tools when they answer the question. For
writes, preview before applying when the surface is available, then use the
verification plan to select checks; the agent must still execute those checks
before claiming validation is complete.

## Reading The Evidence

Every result should be interpreted according to its capability, freshness,
confidence, and provenance metadata. Parser- or fixture-proven semantic results
can support stronger claims than routing heuristics or text matches. Cold,
stale, partial, degraded, heuristic, or unsupported evidence is a prompt to
inspect the source directly or name what remains unknown.

In particular:

- routing evidence tells an agent where to look; it is not proof of behavior
- planned validation is not completed validation
- partial or failed output must not be presented as success
- direct source reads and executed checks remain necessary when the available
  evidence is insufficient

The durable public contracts are indexed by the
[documentation map](docs/reference/documentation-map.md). User-visible behavior
changes are recorded in the
[agent-readable changelog](docs/reference/agent-readable-changelog.md).

## Safety And Lifecycle Boundary

Agent Workbench keeps repository operations bounded: it reports scope and
freshness, identifies excluded or sensitive paths, constrains edits to the
workspace, and checks preview tokens and file drift before applying supported
edits. These controls reduce risk; they do not authorize a change or replace
review.

It also does not decide whether a task or specification is approved, complete,
promoted, released, or closed. Use the project's lifecycle system, issue
tracker, and maintainers for those decisions. When a lifecycle system supplies
task context, Agent Workbench can join it to repository evidence without taking
ownership of lifecycle state. See the
[lifecycle bridge contract](docs/reference/lifecycle-bridge-contract.md).

## Troubleshooting And Support

- Installation, update, uninstall, and native builds:
  [installation runbook](docs/runbooks/install-agent-workbench.md)
- Product contracts, architecture, safety, and proof:
  [documentation map](docs/reference/documentation-map.md)
- Known behavior changes:
  [agent-readable changelog](docs/reference/agent-readable-changelog.md)
- Bugs and feature requests:
  [GitHub Issues](https://github.com/Auriora/agent-workbench/issues)
- Repository development and contribution guidance: [AGENTS.md](AGENTS.md)

When reporting a problem, include the Agent Workbench version, Node.js version,
operating system, coding-agent client, the orientation/status evidence, and the
exact error. Do not include secrets or private repository contents.

## License

Agent Workbench is licensed under the GNU General Public License v3.0 or later.
See [LICENSE](LICENSE) for the full license text.
