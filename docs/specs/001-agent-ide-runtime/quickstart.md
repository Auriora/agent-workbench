---
title: Agent IDE runtime MVP quickstart
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-05-31
---

# Quickstart

## Purpose

Describe the expected first smoke path once runtime implementation exists.

## Prerequisites

- Runtime source has been added under `src/`.
- Test fixtures exist under `tests/`.
- Local dependencies are installed.

## Steps

1. Start the runtime against a fixture repository.
2. Read `repo:///status` and verify scope, freshness, and adapter coverage.
3. Read `repo:///scope` and `repo:///overview` and verify they do not trigger
   source scans or broad graph analysis.
4. Run `context_for_task` for a known fixture change and verify ranked files,
   complete-enough markers, skipped-work metadata, direct-read caveats, and
   exact next actions.
5. Follow the context next actions to query `symbol_search`,
   `find_references`, and bounded `impact` for known fixture symbols.
6. Preview and apply a bounded edit.
7. Run `verification_plan` and verify commands are planned, not executed by
   default, with planned versus proven runnable checks clearly distinguished.
8. Run workspace-safety negative checks from the MVP proof matrix.

## Expected Results

The runtime returns compact MCP responses using the shared response envelope.
Validation plans should name concrete diagnostics or tests for the fixture
change without executing commands by default.
Compact/default responses should not hide broad orientation, full topology,
diagnostics execution, or high-cardinality cache validation behind small
payloads. If evidence is skipped or low confidence, the response should include
the exact follow-up call that recovers it.

## Cleanup

Stop the runtime and remove generated cache state if the test runner does not
clean it automatically.
