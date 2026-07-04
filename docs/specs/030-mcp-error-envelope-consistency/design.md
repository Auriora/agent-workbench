---
title: MCP error envelope consistency design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-18
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Design

## Overview

Add a shared registry helper that registers MCP tools/resources with consistent
argument parsing, provider checks, use-case invocation, exception
classification, telemetry, and text response serialization. Tool-specific
presenters remain responsible for successful and known domain result shapes.

## High-Level Design

```text
raw MCP args
  -> parse schema
  -> resolve repo/root policy
  -> check provider availability
  -> invoke use case
  -> presenter
  -> JSON text response

exceptions
  -> classify
  -> tool-specific or common error envelope
  -> JSON text response
```

## Low-Level Design

### Handler Helper

Provide helpers such as:

```ts
registerMcpToolWithEnvelope({
  server,
  declaration,
  schema,
  parseError,
  providerUnavailable,
  invoke,
  present,
  classifyError
});
```

The helper should not know every domain schema. Each tool supplies envelope
builders for invalid input, unavailable provider, and classified failures.

### Error Classification

Start with stable classes:

- `invalid_input`
- `provider_unavailable`
- `workspace_safety_blocked`
- `stale_state`
- `environment_unavailable`
- `domain_error`
- `internal_error`

Class names may map to existing contract metadata instead of introducing new
public enums if the current contract already has an appropriate field.

### Migration Plan

Migrate representative tools first:

- `context_for_task`
- `preview_workspace_edit`
- `apply_workspace_edit`
- `docs_search`
- one graph-backed symbol tool
- `verification_plan`

Then migrate remaining registries once tests prove the helper shape.

## Operational Considerations

- Do not hide stack traces in telemetry, but do not expose internal stack traces
  to agents.
- Keep clean success output unchanged.
- Avoid retry/fallback behavior in the wrapper.

## Open Questions

- Which failure classes should become public contract enum values, and which
  should map onto existing validity and verification metadata?
- Should resource handlers share the same wrapper in the first slice or follow
  after representative tools are migrated?
