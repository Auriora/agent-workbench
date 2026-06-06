---
title: Docs query and read surfaces design
doc_type: spec
artifact_type: design
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Technical Design

## Overview

Spec 012 closed on 2026-06-06. Current public docs query/read behavior lives in
[MCP surface design](../../design/mcp-surface-design.md), with Markdown quality
boundaries in
[Markdown document quality design](../../design/markdown-document-quality-design.md).

Add docs query/read surfaces on top of documentation adapter evidence. The first
slice should be compact and deterministic: overview, map, search, outline, and
read-section. Crosslinks and generated architecture answers remain deferred.

## High-Level Design

Components:

- Markdown/docs index provider: emits docs file identity, title, headings,
  links, path mentions, snippets, and unreadable-file warnings.
- Docs query use cases: overview, map, search, outline, and read-section.
- Docs presenters: build compact resource/tool envelopes with direct-read
  caveats and budget metadata.
- MCP resources/tools/templates: expose the chosen public surface through thin
  handlers.

## Low-Level Design

Recommended first public surface:

- `repo:///docs/overview`
- `repo:///docs/map`
- `docs_search`
- `docs_outline`
- `docs_read_section`

Implementation should reuse existing Markdown parsing and workspace safety
helpers where possible. Search can begin with indexed headings/path/title text;
full-content or FTS search should be added only when fixture-backed budget tests
prove the need.

## Operational Considerations

Docs indexing must avoid per-call full repo walks. Hot reads should use snapshot
identity and cached docs rows. Unreadable files should become warnings with path
and reason, not fatal errors.

## Open Questions

- Should `docs_outline` and `docs_read_section` be tools, resource templates, or
  both?
- Should snippets include source text initially, or only heading/path metadata
  until redaction boundary behavior from Spec 007 is complete?
