---
title: Markdown document audit scale and chunking design
doc_type: design
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-08-06
---

# Design

## Overview

The set use case scans once, freezes a deterministic candidate list for the
call, validates an optional fingerprint-bound cursor, and checks one chunk
against the reused catalog.

## High-Level Design

```text
one catalog scan -> lexical candidate universe -> cursor validation
                 -> one document chunk -> receipts and coverage
                 -> next opaque cursor or complete state
```

## Low-Level Design

The cursor contains a version, next offset, and SHA-256 fingerprint of the
normalized candidate set and scope intent. Results include current receipts and
a bounded preview of unchecked next-chunk receipts. A shared internal document
checker accepts the existing catalog so the standalone document surface keeps
its behavior while set checking removes the N+1 scan.

Scope-derived active specs are filtered only when requested. Explicit paths are
merged after filtering and remain eligible. Generic MCP instrumentation extracts
coverage scalars from the envelope and never copies findings or evidence.

## Operational Considerations

The implementation is local, read-only, bounded by existing file/finding limits,
and fail-closed for stale or malformed cursors. No alternate inventory path or
retry exists.

## Open Questions

None blocking. Cross-call server-side universe storage remains unnecessary while
fingerprint validation provides deterministic local continuation.
