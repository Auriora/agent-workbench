---
title: Agent IDE runtime MVP quickstart
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-05-07
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
3. Run `context_for_task` for a known fixture change.
4. Query `symbol_search`, `find_references`, and bounded `impact` for known
   fixture symbols.
5. Preview and apply a bounded edit.
6. Run `verification_plan` and verify commands are planned, not executed by
   default.
7. Run workspace-safety negative checks from the MVP proof matrix.

## Expected Results

The runtime returns compact MCP responses using the shared response envelope.
Validation plans should name concrete diagnostics or tests for the fixture
change without executing commands by default.

## Cleanup

Stop the runtime and remove generated cache state if the test runner does not
clean it automatically.
