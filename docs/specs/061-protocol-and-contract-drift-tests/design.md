---
title: Protocol and contract drift tests design
doc_type: design
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-08-06
---

# Design

## Overview

One application-level checker compares explicit source authorities with their
durable projections. The CLI only loads local inputs and reports findings.

## High-Level Design

## Authority flow

```text
Zod enums + mcpTools registry
          |
          v
pure contract-drift checker
          |
          +-- runtime-contracts managed JSON snapshot and examples
          +-- MCP server-card tool metadata
          v
stable findings and non-zero CLI exit
```

The application checker accepts already-loaded text and registry/schema values,
which keeps fixture tests independent of process state. A thin TypeScript CLI
loads repository-local authorities and exits non-zero on findings.

Only valid fenced JSON examples are inspected. The managed enum snapshot is
explicitly labelled, so ordinary prose is not treated as a parallel schema.
Tool registration remains authoritative; the server card is the documented
projection.

## Low-Level Design

The checker accepts enum options, normalized tool metadata, Markdown text, and
server-card JSON. It parses one marked enum snapshot and valid fenced JSON
examples, compares exact set membership, and sorts findings by code, path, and
message. The CLI adapts Zod options and `mcpTools` metadata into that input.

## Failure behavior

Missing or malformed managed data is a finding, not a skipped check. Findings
are sorted by code, path, and message. The checker does not repair documents,
fetch remote schemas, or infer fallback authorities.

## Operational Considerations

The check is deterministic, local, read-only, fast enough for CI, and emits no
document bodies. A non-zero exit is the only process-side effect.

## Open Questions

None. Newly required public enums should be added only with a fixture-backed
extension of the explicit managed snapshot contract.

## Related Artifacts

- Requirements: `requirements.md`
- Tasks: `tasks.md`
