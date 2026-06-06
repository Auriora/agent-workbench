---
title: Markdown quality MCP surface design
doc_type: spec
artifact_type: design
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Technical Design

## Overview

Add the read-only Markdown quality surface described in the durable design. The
first implementation exposes checker use cases and MCP tools. Formatter
planning, preview, apply, cross-document reports, and generated reports remain
future work.

## High-Level Design

Components:

- Markdown parser port for AST/event-stream structure.
- Documentation policy provider for required frontmatter and repository doc
  conventions.
- Structure checker for headings, ordered lists, links, and table readability.
- MCP adapters for `check_markdown_document` and `check_markdown_set`.
- Presenter for compact findings, clean success, skipped paths, caveats, and
  budgets.
- Verification planner integration for changed Markdown files.

## Low-Level Design

`check_markdown_document` accepts a repo-relative path and optional rule/budget
options. It reads through workspace safety, parses Markdown, runs checks, and
returns compact findings.

`check_markdown_set` accepts explicit paths or a bounded scope selector. It
applies catalog skip policy, checks each eligible document, and returns
aggregate counts plus top findings within budgets.

Findings should use stable rule ids such as:

- `markdown.heading.skipped_level`
- `markdown.heading.duplicate`
- `markdown.frontmatter.missing_required`
- `markdown.link.broken_relative`
- `markdown.list.numbering`
- `markdown.table.readability`

## Operational Considerations

- Do not mutate files.
- Do not run external markdown linters.
- Keep hook integration quiet: hooks should surface only actionable findings,
  and no output for clean or errored checks unless explicitly requested.
- Use direct document reads for precise findings; docs FTS remains a search
  index, not quality evidence.

## Open Questions

No active open questions remain. Closure decisions:

- `MarkdownParserAdapter` is the approved first-slice parser-aware
  implementation path for read-only checks.
- The first slice supports configurable required frontmatter fields and defers
  richer repository documentation policy validation.
- `check_markdown_set` supports explicit paths and a bounded `scope_path`; glob
  selectors remain deferred to avoid unsafe broad reads.
