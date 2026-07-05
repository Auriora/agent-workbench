<!--
Copyright (C) 2026 Auriora
SPDX-License-Identifier: GPL-3.0-or-later
-->

# Agent Workbench

Agent Workbench is a local-first IDE/runtime for coding agents. It exposes
repo-scoped code intelligence, documentation routing, bounded edit support,
diagnostics, validation planning, workspace safety, and capability/freshness
metadata through MCP, so agents can rely on mature software-engineering
evidence instead of broad file reads, ad hoc shell scans, and unsupported
inference.

Agent Workbench does not replace coding agents. It gives coding agents an
IDE-grade evidence layer.

## What It Solves

Coding agents are strongest when they can spend context on design decisions and
edits instead of rediscovering repository structure. Agent Workbench provides
bounded, repo-scoped evidence for common questions:

| Agent problem | Mature tool class | Workbench role |
| --- | --- | --- |
| Where is this defined? | Parser/index/symbol graph | Symbol search and context routing |
| What uses this? | Reference engine | References with confidence and provenance |
| What might break? | Impact graph/test mapping | Bounded impact and validation planning |
| Is this file valid? | Parser/linter/type checker | Diagnostics and planned checks |
| What should I test? | Test discovery/dependency graph | Verification plan |
| Can I safely edit this? | Workspace safety/edit preview | Preview/apply with drift checks |
| Is this generated/vendor/secret? | Scope/catalog policy | Refusal, caveats, and redaction |
| Where are the docs? | Markdown index/outline/FTS | Docs routing and section reads |

Agents should not spend context and time rediscovering what mature coding
support tools can already answer deterministically or semi-deterministically.

## What It Exposes

The public runtime surface is MCP-first:

- `repo:///status`, `repo:///scope`, and `repo:///overview` for first-read repo
  state, scope, freshness, and capability coverage.
- Documentation resources and tools for bounded docs overview, map, search,
  outline, and section reads.
- `context_for_task` for bounded task routing before broad file reads.
- `symbol_search`, `find_references`, and `impact` for targeted code evidence.
- `diagnostics_for_files` and `verification_plan` for read-only diagnostics and
  planned validation.
- `preview_workspace_edit` and `apply_workspace_edit` for bounded writes with
  preview tokens, path containment, and drift checks.
- Integration health/profile resources for configured, discovered, callable,
  unavailable, blocked, hidden, and unknown agent surfaces.

## Evidence You Can Rely On

Workbench responses carry metadata so agents can calibrate claims:

- Capability levels are `semantic`, `partial_semantic`, `resource_backed`, or
  `unsupported`.
- Freshness is `fresh`, `stale`, `cold`, `refreshing`, or `unknown`.
- Evidence kinds include parser, docs, FTS, config, direct reads, heuristics,
  text fallback, and executed commands.
- Verification status distinguishes `done`, `planned`, `needed`, `blocked`,
  and `not_applicable`.

Routing evidence helps an agent decide where to look. Parser-backed evidence
supports stronger claims about declarations and syntax. Semantic evidence
supports stronger claims only when fixture-proven for that language and
operation. Direct source reads remain necessary when confidence is partial,
degraded, stale, or heuristic. Planned validation is not completed validation;
executed tests/checks or equivalent evidence are required before claiming proof.

## Not A Lifecycle Engine

Agent Workbench does not decide whether work is approved, complete, promoted,
released, or closed. It provides repository evidence, coding support,
validation planning, diagnostics, and workspace-safety contracts. Lifecycle
tools, issue trackers, maintainers, or project governance remain responsible
for intent, acceptance, and closure.

Workbench may consume active task or spec context when a lifecycle system
provides it. It may rank files/docs using active spec links and expose evidence
useful to lifecycle tasks. It must not require `ai-spec-lifecycle` or any
specific lifecycle tool, decide whether a spec is complete, promote durable
docs automatically, or close specs.

See [Lifecycle bridge contract](docs/reference/lifecycle-bridge-contract.md)
for the generic boundary.

## Proven Use

Agent Workbench has been dogfooded on multiple repositories where coding agents
used it to support feature development. Dogfood evidence should be recorded in
project docs, proof matrices, or review notes rather than treated as an
implicit guarantee.

Current evidence starts in:

- [Dogfood evidence ledger](docs/reference/dogfood-evidence-ledger.md)
- [MVP proof matrix](docs/reference/mvp-proof-matrix.md)
- [Spec closure log](docs/history/spec-closure-log.md)
- [Cross-repo smoke feedback](docs/reference/agent-workbench-cross-repo-smoke-2026-06-06.md)
- [Agent Workbench smoke feedback](docs/reference/agent-workbench-smoke-feedback-2026-06-06.md)

Maintainers should add new dogfood entries to durable reference docs or proof
matrices with dates, repositories, validated surfaces, limitations, and
follow-up work.

## Coding-Agent Workflows

### Ad Hoc Direct Patch

```text
repo status -> context_for_task -> source read -> preview edit
-> diagnostics -> validation plan -> report evidence
```

Check freshness before editing. Treat `resource_backed`, `heuristic`, or
`text_fallback` evidence as routing, not proof. Report validation as planned
unless checks actually ran.

### Spec Or Lifecycle Task

```text
lifecycle readiness packet -> lifecycle bridge context
-> bounded implementation -> diagnostics -> validation plan
-> lifecycle evidence update by the owning lifecycle system
```

Workbench consumes task context and returns repo evidence. The lifecycle system
or maintainer remains responsible for acceptance, promotion, and closure.

### Review-Only Task

```text
changed files -> impact evidence -> diagnostics
-> validation adequacy -> residual risk report
```

Do not mutate files. Use impact and diagnostics as evidence, then call out
stale indexes, partial semantic coverage, missing checks, and residual risk.

## Install

Agent Workbench installs from the npm package tarball attached to a GitHub
release. Do not clone the repository, copy files with `rsync`, or install from a
checkout for normal use. The npm package builds native modules in place, records
the installed runtime root during `postinstall`, and the Codex and Claude
plugins launch that installed runtime through the bundled portable launcher.

Use Node.js 22 when possible, because Node 24 requires C++20 flags when
compiling the native `tree-sitter` core.

### 1. Install The Runtime Package

On macOS or Linux with `nvm`, install the release tarball globally:

```bash
nvm install 22
nvm use 22
npm install -g https://github.com/Auriora/agent-workbench/releases/download/v0.4.0/auriora-agent-workbench-0.4.0.tgz
```

For an offline install, download the `.tgz` from the matching GitHub release and
install that local file:

```bash
npm install -g ./auriora-agent-workbench-0.4.0.tgz
```

If you must install under Node 24, pass C++20 flags to the native build:

```bash
CXXFLAGS="-std=c++20" npm install -g https://github.com/Auriora/agent-workbench/releases/download/v0.4.0/auriora-agent-workbench-0.4.0.tgz
```

Install Xcode Command Line Tools first if `node-gyp` cannot find a compiler:
`xcode-select --install`.

Then install the plugin for each coding agent that should use Agent Workbench.
The package includes the Codex and Claude Code plugin definitions, so each
plugin is registered from the installed package directory.

### 2a. Install The Codex Plugin

Register the package-scoped Codex marketplace, install the plugin, and verify
that Codex sees it:

```bash
PKG="$(npm root -g)/@auriora/agent-workbench"
codex plugin marketplace add "$PKG/plugins/agent-workbench"
codex plugin add agent-workbench@agent-workbench-local
codex plugin list
```

The expected plugin entry is `agent-workbench@agent-workbench-local`, installed
and enabled. Start a new Codex session after installing so Codex discovers the
skill, hooks, and MCP server configuration.

### 2b. Install The Claude Code Plugin

Register the package-scoped Claude Code marketplace, install the plugin for the
current user, and verify that Claude Code sees it:

```bash
PKG="$(npm root -g)/@auriora/agent-workbench"
claude plugin marketplace add "$PKG/plugins/agent-workbench"
claude plugin install agent-workbench@agent-workbench-local --scope user
claude plugin list
```

The expected plugin entry is `agent-workbench@agent-workbench-local`, enabled
for the user scope. Start a new Claude Code session after installing so Claude
Code discovers the skill, hooks, and MCP server configuration.

The first useful MCP resources in either agent are `repo:///status`,
`repo:///scope`, and `repo:///overview`.

Native dependencies need Python 3 and a C/C++ toolchain. For full
cross-platform setup, update, uninstall, and troubleshooting steps, see
[Install Agent Workbench](docs/runbooks/install-agent-workbench.md).

## Development

Use pnpm for local development:

```bash
pnpm install
pnpm rebuild:native
pnpm typecheck
pnpm test
pnpm dev -- <repo-root>
```

Native tree-sitter bindings may require `pnpm rebuild:native` under newer Node
versions. Do not add parser fallbacks to mask install/build issues.

For package and plugin changes, also use:

```bash
pnpm validate:plugin
pnpm pack:dry-run
```

`plugins/agent-workbench/` owns the packaged Codex, Claude Code, and Kiro
integration files. `packaging/agent-workbench/` owns the npm package metadata,
portable MCP entrypoint, and distribution manifest. Keep plugin hooks and MCP
launchers as thin wrappers over the installed runtime; behavior belongs in
`src/` and the durable contracts/docs listed below.

Active implementation work is tracked under `docs/specs/`. Closed MVP behavior
from Spec 001 has been promoted into durable design, reference, runbook,
requirements, ADR, and history docs; do not add new implementation evidence to
the closed MVP package.

## Documentation Map

Start with [Documentation map](docs/reference/documentation-map.md) for the
canonical owner of each design, contract, proof, integration, and safety topic.

Agent-visible behavior changes are tracked in
[Agent-readable changelog](docs/reference/agent-readable-changelog.md).

## License

Agent Workbench is licensed under the GNU General Public License v3.0 or later.
See [LICENSE](LICENSE) for the full license text.
