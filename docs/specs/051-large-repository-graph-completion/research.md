---
title: Large-repository graph completion research
doc_type: spec
artifact_type: research
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Research

## Question

What is required for large-repository graph builds to report truthful coverage and
provide resumable bounded completion while avoiding fallback paths and silent
partial claims?

## Confirmed evidence baseline

- Debug sweep execution includes a hardcoded extraction cap (`max_extraction_files=500`)
  with bounded behavior that is not surfaced through the production continuation
  path.
- Production warmup already produces partial states around `max_files=2000` but lacks
  a dedicated completion executor.
- Coverage completion currently depends on scan-level assumptions.
- `priority_paths` currently behaves like a boolean membership hint rather than an
  ordering function.
- Rails route/config files can be missed in first-pass if priority is not enforced
  before admission.

## Internal cross-check

- Repo tracing showed realistic route-extraction utility when first-pass files are
  admitted early, confirming the practical value of deterministic seeded ordering.
- Partial mode without explicit continuation creates inconsistent trust propagation
  in downstream queries where consumers assume full completion from scan signals.
- In large-run scenarios, continuation and ownership/generation control are required
  to avoid cross-run corruption.

## Repo-level regression candidates

- Known large-repository style traces and the `gerald` dataset continue to serve as
  practical regression targets for completion, continuation, and partial trust.

## Rejected alternatives

- Hardcoded caps without continuation.
- Separate debug and production completion semantics.
- Scan-only completion rules.
- Non-deterministic priority behavior dependent on filesystem order.

## Cross-reference

- This research is directly aligned to EB014 and supports bounded graph completion
  requirements in `requirements.md`.
