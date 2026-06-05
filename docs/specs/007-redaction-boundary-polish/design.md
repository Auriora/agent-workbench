---
title: Redaction boundary polish design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Technical Design

## Overview

Refine presentation-time redaction so ordinary code snippets are not mistaken
for unsafe filesystem paths. The change belongs at the presentation/safety
boundary, not inside graph extraction or source storage.

## High-Level Design

Add or consolidate a small redaction helper that classifies values as:

- source text that should be preserved
- repo-relative filesystem path evidence
- absolute host path or workspace escape evidence
- secret-like evidence

Presentation code should use the helper for snippets, source sections,
warnings, and compact feedback where redaction currently happens.

## Low-Level Design

Prefer structured inputs where available. For plain strings, classify a value as
a filesystem path only when it has strong path evidence such as a drive/root
prefix, home prefix, traversal segment, known workspace root, or file extension
plus path separators in a field that expects a path. URL route fragments such as
`/api/orders` are source snippets unless a field is explicitly path-typed.

Secret-like values remain redacted based on existing environment-file and token
heuristics.

## Operational Considerations

Do not add noisy hook output. Redaction failures should surface through tests,
structured warnings where relevant, or telemetry/logging rather than chatty
file-edit hooks.

## Open Questions

- Whether the helper should live in `src/presentation/` or the existing
  workspace-safety policy module.
