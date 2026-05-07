# Repository Guidelines

## Project Structure & Module Organization

This repository currently contains planning and documentation assets for the
Agent IDE restart concept.

- `docs/design/`: current design documents, including
  `agent-ide-restart-concept.md`.
- `docs/templates/`: reusable documentation templates and spec-package
  templates.
- `.cache/`: local generated runtime/index data. This directory is ignored and
  must not be committed.

There is no application source tree or test suite yet. Add future source,
tests, and assets under clearly named top-level directories such as `src/`,
`tests/`, and `assets/`.

## Build, Test, and Development Commands

No build or test commands are defined yet. For now, use basic Git and Markdown
checks:

- `git status --short`: inspect pending changes.
- `git diff -- docs/design/agent-ide-restart-concept.md`: review concept-doc
  edits before committing.
- `find docs -type f | sort`: list tracked documentation candidates.

When a runtime implementation is added, document canonical build, lint, test,
and local-run commands here before relying on them in automation.

## Coding Style & Naming Conventions

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

There is no automated test framework yet. For documentation-only changes,
validate that links, paths, headings, and metadata are accurate. If code is
introduced, add tests with the implementation and document the test command in
this file.

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
