---
title: Spec task traceability lookup design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Technical Design

## Overview

Add local spec package reading as a bounded Agent Workbench context source, with
an explicit boundary that spec-lifecycle-manager remains authoritative for spec
governance, closure checks, migrations, and lifecycle policy.

## High-Level Design

Components:

- Spec package scanner for `docs/specs/[###-slug]/`.
- Task parser for checklist IDs and evidence blocks.
- Traceability assembler for requirements/design/tasks/verification snippets.
- Task-context integration for prompts mentioning specs or task IDs.
- Boundary documentation for spec-lifecycle-manager.

## Low-Level Design

The scanner should read only bounded Markdown files in a selected spec package.
It should extract headings, task checklist entries, artifact presence, status,
and validation gates. It should not rewrite or normalize specs.

## Operational Considerations

- Treat archived specs as historical.
- Avoid broad scanning unless the prompt clearly references specs.
- Keep excerpts bounded and repo-relative.

## Open Questions

- Should this be a dedicated MCP tool, an extension to `context_for_task`, or
  both?
- Should Agent Workbench call spec-lifecycle-manager MCP when available, or only
  document that agents should use it directly?
