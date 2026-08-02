---
title: Validation-plan skipped-path payload compaction
doc_type: spec
artifact_type: package-readme
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Spec 053: Validation-plan skipped-path payload compaction

## Purpose

Deliver EB065 by replacing routine per-path `verification_plan` skip output
with exact reason counts, deterministic bounded samples, and preserved
actionable exclusions. The scanner must continue accounting after its raw
compatibility sample fills; output compaction cannot become an extraction or
classification limit.

## Package Status

- Spec ID: 053
- Owner: platform
- Start date: 2026-08-02
- Current stage: requirements, research, design, tasks, traceability, and
  verification planning drafted; implementation not started
- Scope owner:
  `docs/specs/053-validation-plan-skipped-path-payload-compaction/`
- Backlog owner: EB065 under EB004 and EB009

## Confirmed Evidence Baseline

- Installed-runtime dogfood recorded roughly 50 individual routine
  `skipped_paths` entries around the useful validation plan.
- The planner currently slices retained raw scanner skips to 50.
- The scanner independently stops retaining raw skip records at 100 without a
  population receipt.
- Task context groups skip evidence separately, with one sample and at most five
  reasons.
- Contract `0.1` permits additive optional fields but not an in-place breaking
  field-shape change.

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

This spec owns exact invocation-level skip population accounting, structured
validation-plan compaction, actionable selected-path evidence, and task-context
summary parity. It does not change scanner traversal/max-files/continuation,
validation command selection, other raw skipped-path surfaces, ranked docs
capacity, or parser coverage policy.
