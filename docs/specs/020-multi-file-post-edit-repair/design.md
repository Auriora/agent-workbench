---
title: Multi-file post-edit repair design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Technical Design

## Overview

Extend the internal post-edit feedback path so it can classify multi-file edits
as checked, actionable, queued, skipped, unavailable, or silent. The hook
adapter remains quiet unless actionable findings are present and the configured
mode allows output.

## High-Level Design

Components:

- Post-edit budget policy for file count, size, and provider support.
- Multi-file diagnostic aggregation result.
- Quiet hook presenter rules.
- Telemetry/logging for skipped and deferred reasons.
- Tests for advisory hook behavior.

## Low-Level Design

`buildPostEditFeedback` should return an internal structured result with:

- checked files;
- actionable findings;
- skipped/deferred reason counts;
- recommended explicit MCP follow-up;
- hook-facing message, omitted when clean or unsupported.

The hook script should preserve successful exit behavior for unsupported,
errored, or clean payloads.

## Operational Considerations

- Do not execute commands from hooks.
- Do not block edits.
- Do not include absolute paths in hook-facing output.

## Open Questions

- Should deferred multi-file diagnostics be queued for later runtime pickup or
  only represented as skipped evidence in this slice?
- Which telemetry attributes are safe enough for hook skip reasons?
