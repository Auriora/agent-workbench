---
title: Diagnostics and post-edit feedback design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Technical Design

## Overview

Add diagnostics and post-edit feedback as provider-backed application use cases
with shared presentation. The implementation should make the current
`verification_plan.static_feedback` behavior more explicit without turning MCP
adapters or hooks into analyzer implementations.

## High-Level Design

Components:

- Diagnostics provider port: accepts repo root, relative files, optional ranges,
  and capability context; emits normalized findings and provider status.
- Provider registry: maps file categories and adapter capabilities to available
  diagnostics providers.
- Diagnostics use case: validates input, resolves files through workspace
  safety, invokes providers, applies budgets, and returns application results.
- Post-edit feedback use case: combines diagnostics results with edit metadata,
  risky-change signals, and validation-plan next actions.
- Feedback presenter: suppresses no-op output and formats only actionable
  findings, blockers, and next actions.
- Hook adapter: calls the same feedback use case and displays only actionable
  output.

## Low-Level Design

Provider result shape should include:

- `path`
- `range`
- `severity`
- `message`
- `category`
- `provider_id`
- `capability_level`
- `evidence_kinds`
- `blocking`
- `fix_hint` when safe and concise

Public surface decision is part of implementation:

- Accepted for T004: add `diagnostics_for_files` because it is compact and
  provider-backed.
- Accepted for T005: keep `post_edit_feedback` internal and hook-facing rather
  than adding a public MCP tool. The public workflow stays
  `diagnostics_for_files` plus `verification_plan`; the hook-facing path uses
  the same quiet presenter policy for actionable feedback only.

## Operational Considerations

Diagnostics must be bounded by file count, source-byte caps, provider timeouts,
and row limits. Optional provider failures are instrumented, not shown, unless
the caller explicitly requested that provider or the failure changes the next
action.

## Open Questions

- Which first code adapter should provide fixture-backed diagnostics beyond
  Markdown/config?
