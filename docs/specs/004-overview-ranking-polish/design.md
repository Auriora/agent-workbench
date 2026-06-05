---
title: Overview ranking polish design
doc_type: spec
artifact_type: design
status: archived
owner: platform
last_reviewed: 2026-06-05
---

# Technical Design

## Closure Record

Spec 004 closed on 2026-06-05. Current overview key-file ranking behavior lives
in [MCP surface design](../../design/mcp-surface-design.md).

## Overview

Improve first-read overview ranking without expanding scope into broad
orientation or semantic analysis. The implementation should make existing
bounded key-file output more useful for agents.

## High-Level Design

Overview ranking remains owned by `getRepoOverview` and presentation-facing
metadata. The implementation should add generic ranking categories and reasons
without introducing repo-specific rules.

Primary durable sources:

- [MCP surface design](../../design/mcp-surface-design.md)
- [Runtime contracts](../../reference/runtime-contracts.md)
- [Language adapter design](../../design/language-adapter-design.md)

## Data Flow

1. File catalog scan provides bounded `FileCatalogEntry` rows.
2. Overview detects platform and repository-shape evidence.
3. Key-file ranking scores candidates using generic path/language/config/test
   signals.
4. Presenter returns compact `FileReference` entries with capability metadata
   and ranking reasons.

## Ranking Strategy

Prefer these evidence classes in order when present:

1. Root project descriptors and package/test configuration.
2. Application entrypoints and service roots.
3. Representative first-party source files.
4. Nearby or top-level tests.
5. Infrastructure files relevant to the primary project shape.
6. Workflow/config files.
7. Fixture, generated, vendor, third-party, and package-cache paths.

The scoring must remain generic. Dogfood repositories may inspire fixtures, but
tests should use compact synthetic fixtures.

## Low-Level Design

`selectKeyFiles` should score candidates through small helper functions for
project descriptors, entrypoints, first-party source, tests, infrastructure,
workflow/config, generated/vendor, and fixture evidence. Tie-breaking should
stay deterministic with path ordering. The existing `reason` field should
receive concise evidence-class text unless a later schema change adds a
dedicated ranking-reason field.

## Operational Considerations

The change must not increase scan budgets. If first-pass overview is still
insufficient, the response should guide agents to `context_for_task`, not expand
overview into a broad orientation report.

## Open Questions

- Whether overview should include a small `ranking_reason` vocabulary in the
  public schema or keep using the existing `reason` field.
