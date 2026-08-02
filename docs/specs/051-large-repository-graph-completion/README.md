---
title: Large-repository graph completion
doc_type: spec
artifact_type: package-readme
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Spec 051: EB014 large-repository graph completion

## Purpose

Fix the EB014 extraction lifecycle so bounded repository scans no longer misreport
complete graph coverage. Any production bounded extraction must emit truthful
coverage signals and expose a durable run-to-extend path that can deterministically
resume bounded work until completion.

## Package status

- Spec ID: 051
- Owner: platform
- Start date: 2026-08-02
- Current stage: planning and design complete; implementation task started as `[~]`
- Scope owner: `docs/specs/051-large-repository-graph-completion/`

## Confirmed evidence baseline

- Debug sweep currently hard-codes `max_extraction_files=500`, and completion is
  not represented through the same continuation model.
- Coverage reporting is derived from scan results and does not currently reflect
  admission/extraction truthfully.
- Production warmup applies `max_files=2000` and reports partial result states, but
  has no dedicated completion executor.
- First-pass ordering can skip Rails route/config files because priority hints do
  not actually reorder scanner output.
- `priority_paths` is evaluated as a membership check and does not reorder admission.

## Artifacts

- Requirements: `requirements.md`
- Research: `research.md`
- Canonical context: `canonical-context.md`
- Change impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`

## Focus

EB014 is scoped to the graph indexing and completion path only. It does not add
new parser families, add public protocol fallback behavior, or expand supported
language semantics. Durable changes belong in existing canonical owners only after
validation.
