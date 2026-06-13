---
title: Multi-file post-edit repair design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-13
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
- repair-loop outcome: checked, actionable, queued, skipped, unavailable,
  errored, or silent;
- actionable findings;
- skipped/deferred reason counts and optional affected paths;
- recommended explicit MCP follow-up;
- hook-facing message, omitted when clean or unsupported.

The hook script should preserve successful exit behavior for unsupported,
errored, or clean payloads.

For this slice, queued diagnostics are represented as structured deferred
checks with follow-up to `diagnostics_for_files` or `verification_plan`; they
are not persisted into a background runtime queue.

## Operational Considerations

- Do not execute commands from hooks.
- Do not block edits.
- Do not include absolute paths in hook-facing output.

## Resolved Decisions

- Deferred multi-file diagnostics are represented as structured queued,
  skipped, unavailable, or errored evidence in this slice. A persisted runtime
  pickup queue is deferred until a separate design proves the storage and
  lifecycle behavior.
- Telemetry records aggregate post-edit outcome, deferred-check counts,
  deferred reasons, and deferred outcome counts. Hook logs may include
  repo-relative paths for local operator debugging; telemetry aggregation avoids
  depending on full file contents or raw analyzer output.

## Open Questions

- No open questions block this slice. A persisted background diagnostics queue
  remains deferred and would need a separate spec before implementation.
