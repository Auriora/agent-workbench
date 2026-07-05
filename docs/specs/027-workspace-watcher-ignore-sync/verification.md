---
title: Workspace watcher ignore sync verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Evidence Log

- 2026-07-05 review: lifecycle `stage_readiness` initially reported
  `ready_to_implement: false` because traceability used unresolved `R1`-style
  labels; traceability now maps tasks to `Requirement N ACx` identifiers.
- 2026-07-05 review: implementation strategy is resolved as stale-rescan first.
  Spec 027 no longer asks agents to add a single-file graph/docs indexer or
  per-file docs FTS maintenance in this slice.
- 2026-07-05 review: watcher configuration is routed through existing
  runtime/domain contract surfaces instead of a non-existent `src/config/`
  ownership root.
- 2026-07-05 review: OS watcher edge cases are explicit implementation
  requirements: rename without old path, case-only rename, atomic-save temp
  files, permission errors, deleted roots, symlink escapes, and native overflow.

## Quality Gates

- `lint_spec_package docs/specs/027-workspace-watcher-ignore-sync` must pass
  before implementation begins and before closure.
- `stage_readiness docs/specs/027-workspace-watcher-ignore-sync` must report
  `ready_to_implement: true` before implementation begins.
- Focused workspace watcher tests must cover inclusion policy, root selection,
  event filtering, OS edge normalization, debounce/coalescing, overflow,
  stale-rescan scheduling, hook routing, and MCP freshness caveats.
- Existing repo validation must include `pnpm typecheck`, the targeted watcher
  test slice, and `git diff --check`.

## Residual Risks

- Per-file graph/docs/FTS refresh remains out of scope. A future spec must
  define explicit port contracts and fixture-backed tests before adding it.
- `.gitignore` versus `.aiignore` diagnostic split remains an open response
  vocabulary decision; this spec keeps one ignore-file skip category unless a
  later task resolves otherwise.
