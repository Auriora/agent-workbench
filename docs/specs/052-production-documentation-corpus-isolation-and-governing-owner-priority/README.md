---
title: Production documentation corpus isolation and governing-owner priority
doc_type: spec
artifact_type: package-readme
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Spec 052: Production documentation corpus isolation and governing-owner priority

## Purpose

Promote EB064 into one focused implementation slice. The runtime must keep
documentation embedded below fixture roots out of a containing product
repository's documentation corpus while still treating the same fixture as a
normal repository when it is selected as the repository root. For an exactly
matched documentation concern, its current canonical governing owner must rank
ahead of draft or supporting documents that merely mention the query.

## Package Status

- Spec ID: 052
- Owner: platform
- Start date: 2026-08-02
- Current stage: requirements, research, design, tasks, traceability, and
  verification planning drafted; implementation not started
- Scope owner:
  `docs/specs/052-production-documentation-corpus-isolation-and-governing-owner-priority/`
- Backlog owner: EB064

## Confirmed Evidence Baseline

- Installed-runtime dogfood recorded that `docs_current_for_task` admitted
  embedded fixture documentation into production canonical results.
- The exact query `rule governing SessionStart behavior` ranked the dogfood
  ledger and backlog ahead of the current canonical coding-agent integration
  owner.
- Snapshot documentation indexing and `docs_current_for_task` currently select
  Markdown candidates independently.
- Ranked documentation policy currently assigns lexical relevance before the
  matched-owner intent band.

## Artifacts

- Requirements: `requirements.md`
- Research: `research.md`
- Canonical context: `canonical-context.md`
- Change impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`

## Scope Boundary

This spec owns production documentation-corpus eligibility and exact-concern
governing-owner priority. It does not choose EB059 ranked-universe capacity or
cursor-eviction policy, compact EB065 validation-plan payloads, or introduce a
query-time filename filter, fallback route, or partial success response.
