<!--
Copyright (C) 2026 Auriora
SPDX-License-Identifier: GPL-3.0-or-later
-->

# Repository Guidelines

## Project Structure & Module Organization

This repository contains the Agent Workbench runtime, packaged MCP/plugin
integrations, fixture-backed tests, and durable design/reference documentation.

- `src/`: TypeScript runtime source. Keep MCP adapters thin and place shared
  contracts, runtime state, graph storage, adapters, workflow, edit, and
  workspace safety code in the matching subdirectories.
- `tests/`: Vitest contract tests, fixture repositories, and golden snapshots.
- `plugins/agent-workbench/`: packaged Codex, Claude Code, and Kiro integration
  files. Keep launchers and hooks thin wrappers over the installed runtime.
- `packaging/agent-workbench/`: npm package metadata, portable MCP entrypoint,
  and distribution manifest.
- `docs/design/`, `docs/architecture/`, `docs/reference/`, `docs/runbooks/`,
  `docs/requirements/`, and `docs/adr/`: durable documentation. Use
  `docs/reference/documentation-map.md` to find the canonical owner before
  changing behavior or contracts.
- `docs/specs/`: active and historical implementation spec packages. Current
  active packages are numbered `026` through `033`; do not add new work to the
  closed `001` MVP package.
- `docs/templates/`: reusable documentation templates and spec-package
  templates.
- `.cache/`: local generated runtime/index data. This directory is ignored and
  must not be committed.

Use the existing top-level `src/`, `tests/`, `docs/`, and future `assets/`
directories rather than adding duplicate roots.

## Build, Test, and Development Commands

Use pnpm for local development:

- `pnpm install`: install dependencies.
- `pnpm rebuild:native`: rebuild native tree-sitter bindings with the Node 24
  C++20 requirement when needed.
- `pnpm typecheck`: run TypeScript type checking.
- `pnpm test`: run the Vitest suite.
- `pnpm dev -- <repo-root>`: print the current cold runtime status for a repo.
- `git status --short`: inspect pending changes.
- `pnpm validate:plugin`: validate packaged plugin manifests, MCP bindings, and
  hook shapes.
- `pnpm pack:dry-run`: inspect the npm package contents without publishing.
- `git diff -- README.md AGENTS.md`: review front-door documentation edits
  before committing.
- `find docs -type f | sort`: list tracked documentation candidates.

Native dependency note: `better-sqlite3`, `tree-sitter`, and the language
grammar packages are native Node bindings. Under Node 24, `node-gyp` may fail
with `C++20 or later required` or tests may fail with `No native build was
found` after install. Run `pnpm rebuild:native`; do not add parser fallbacks or
switch away from tree-sitter to mask this install/build issue. The approved
pnpm build-script dependencies are the entries in `package.json` under
`pnpm.onlyBuiltDependencies`.

## Coding Style & Naming Conventions

Use TypeScript with ESM under `src/`. Keep shared enums and response shapes in
`src/contracts/`, validate external/tool-facing data with structured schemas,
and avoid duplicating contract vocabulary outside the canonical contract module
or `docs/reference/runtime-contracts.md`.

Use Markdown for documentation. Keep headings concise and use sentence-style
paragraphs with short bullet lists. New documentation files should use
kebab-case names, for example `runtime-architecture.md`. Before adding a new
durable document, check `docs/reference/documentation-map.md` and update an
existing canonical owner when possible.

Follow the frontmatter pattern from `docs/templates/README.md`:

```yaml
---
title: Short descriptive title
doc_type: design
status: draft
owner: platform
last_reviewed: YYYY-MM-DD
---
```

Prefer ASCII unless a document already requires non-ASCII content.

## Testing Guidelines

Use Vitest for automated tests. Add contract, fixture, golden snapshot,
workspace-safety, degraded-mode, and query-budget tests with the implementation
they prove. For documentation-only changes, validate that links, paths,
headings, and metadata are accurate.

## Commit & Pull Request Guidelines

The current history uses short imperative commit subjects, for example
`Initial documentation baseline`. Keep commits focused and describe the user
visible change.

Pull requests should include:

- summary of changed docs or code
- rationale for architecture or process changes
- validation performed, even if manual
- links to related issues or follow-up decisions when available

## Agent-Specific Instructions

Do not commit `.cache/` or other generated local runtime artifacts. When editing
documentation, prefer updating existing design sections over adding duplicate
notes. Preserve the distinction between accepted direction, draft concepts, and
open questions.

For coding work, prefer delegating bounded implementation chunks to
GPT-5.3-Codex-Spark sub-agents where practical. Give each sub-agent explicit
file or module ownership, keep write sets disjoint, and state that other agents
may be editing the codebase in parallel. Use sub-agents for implementation,
focused refactors, architecture-boundary tests, and validation runs when the
work can proceed independently. Keep tightly coupled integration decisions,
scope tradeoffs, and final review in the parent agent.

When delegating, ask sub-agents to:

- avoid reverting changes they did not make
- follow the layered architecture boundaries
- keep MCP adapters thin
- avoid adding parser, semantic, validation, or command-execution fallbacks
- report files changed, commands run, validation status, and limitations

Run `pnpm typecheck` and targeted or full `pnpm test` after implementation
chunks unless the user explicitly asks to skip validation.

The first language implementation path is Python using tree-sitter. Do not add
AST, LSP, Pyright, Ruff, pytest, or other alternate parser/semantic fallbacks
until a design document or fixture-backed test justifies the specific
capability.

Prefer one explicit implementation path for each capability. Do not implement
primary-plus-fallback routes, hidden fallbacks, compatibility workarounds, extra
mode switches, or parallel implementations unless a design document and
fixture-backed test explicitly require them. Do not return partial results as a
guard for timeouts, crashes, or other failures; return a structured degraded or
blocked state that makes the missing evidence clear. When something fails,
perform root-cause analysis and fix the underlying cause rather than masking it
with retry logic, alternate tooling, partial output, or special-case branches. If
a workaround is temporarily unavoidable, document why it exists, what root cause
remains, and what evidence will allow its removal.
