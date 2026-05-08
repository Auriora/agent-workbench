# Repository Guidelines

## Project Structure & Module Organization

This repository contains the Agent IDE runtime implementation scaffold and
planning documentation for the restart concept.

- `src/`: TypeScript runtime source. Keep MCP adapters thin and place shared
  contracts, runtime state, graph storage, adapters, workflow, edit, and
  workspace safety code in the matching subdirectories.
- `tests/`: Vitest contract tests, fixture repositories, and golden snapshots.
- `docs/design/`: current design documents, including
  `agent-ide-restart-concept.md`.
- `docs/specs/001-agent-ide-runtime/`: MVP spec package and implementation
  task list.
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
- `git diff -- docs/design/agent-ide-restart-concept.md`: review concept-doc
  edits before committing.
- `find docs -type f | sort`: list tracked documentation candidates.

Native dependency note: `tree-sitter` and `tree-sitter-python` are native
Node bindings. Under Node 24, `node-gyp` may fail with `C++20 or later
required` or tests may fail with `No native build was found` after install.
Run `pnpm rebuild:native`; do not add parser fallbacks or switch away from
tree-sitter to mask this install/build issue. `better-sqlite3`, `tree-sitter`,
`tree-sitter-python`, and `esbuild` are the approved pnpm build-script
dependencies in `package.json`.

## Coding Style & Naming Conventions

Use TypeScript with ESM under `src/`. Keep shared enums and response shapes in
`src/contracts/`, validate external/tool-facing data with structured schemas,
and avoid duplicating contract vocabulary outside the canonical contract module.

Use Markdown for documentation. Keep headings concise and use sentence-style
paragraphs with short bullet lists. New documentation files should use
kebab-case names, for example `runtime-architecture.md`.

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

The first language implementation path is Python using tree-sitter. Do not add
AST, LSP, Pyright, Ruff, pytest, or other alternate parser/semantic fallbacks
until a design document or fixture-backed test justifies the specific
capability.

Prefer one explicit implementation path for each capability. Avoid hidden
fallbacks, compatibility workarounds, extra mode switches, or parallel
implementations unless a design document or fixture-backed test justifies them.
When something fails, perform root-cause analysis and fix the underlying cause
rather than masking it with retry logic, alternate tooling, or special-case
branches. If a workaround is temporarily unavoidable, document why it exists,
what root cause remains, and what evidence will allow its removal.
