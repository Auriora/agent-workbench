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
4. Query `symbol_search`, `find_references`, `callers`, and `impact` for known
   fixture symbols.
5. Preview and apply a bounded edit.
6. Run `post_edit_feedback`, `verification_plan`, and `run_nearest_tests`.
7. Read `repo:///graph/report`.

## Expected Results

The runtime returns compact MCP responses with trust, freshness, scope,
verification, and evidence metadata. Validation plans should name concrete
diagnostics or nearest tests for the fixture change.

## Cleanup

Stop the runtime and remove generated cache state if the test runner does not
clean it automatically.
