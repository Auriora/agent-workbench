---
title: Release notes generation verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Quality Gates

- `python -m unittest tools/devcli/tests/test_cli.py`
- `pnpm validate:plugin`
- `pnpm pack:dry-run`
- `pnpm typecheck`
- `git diff --check`

## Functional Test Matrix

| Case | Expected Evidence |
| --- | --- |
| Valid range with multiple commits | Evidence and first-pass outline group changes by area rather than commit line |
| Missing `--from` with reachable tag | Latest release tag is selected and recorded |
| Missing `--from` without reachable tag | Command exits blocked with a clear missing-range message |
| Invalid range | Command exits non-zero and writes no notes |
| Empty range | Command exits non-zero or emits no-op review-needed state without publishing claims |
| `--dry-run` | Notes print to stdout and no files are written |
| Agent refinement | LLM-backed agent prompt can turn evidence into consumer-readable notes without unsupported claims |
| `--output` | Markdown file is written and can be passed to `awb release github --notes-file` after review/refinement |
| `--evidence-output` | JSON evidence contains range, commits, files, areas, and skipped enrichment |
| `--agent-instructions` with evidence output | Agent prompt references the JSON evidence file and does not duplicate unsupported claims |
| `--agent-instructions` without evidence output | Agent prompt embeds compact evidence and preserves review-needed uncertainty |
| Release tag detection | Default tag detection ignores non-semver and prerelease tags and selects the highest reachable `vX.Y.Z` tag |
| Traceability fields | JSON evidence records selected tag, resolved revisions, branch, repository root, and short/full commit hashes |
| Per-commit file evidence | JSON evidence records files touched by each commit so candidate groups do not infer commit-to-path links from range-only data |
| Rename/copy parsing | `R*` and `C*` name-status rows preserve raw status, score, old path, and new path |
| Validation inputs | `--validation-note` and `--validation-file` populate Validation without claiming unsupplied checks |
| Draft/final state | Default output is draft; reviewed/final state is explicit |
| Candidate grouping | Related files and commits are grouped by consumer outcome, with rationale, confidence, and review-needed state |
| CLI help and options | `awb release notes --help` lists range, output, validation, evidence, final, dry-run, and agent-instruction options |
| Output parent creation | Explicit output paths create missing parent directories; `--dry-run` creates no files or directories |
| Module boundary | Release-note logic lives in `release_notes.py`; `release.py` only registers and delegates the `notes` command |
| Durable documentation | Runbook and reusable guidance describe evidence generation, LLM/human refinement, reviewed final notes, and GitHub release publishing |

## Evidence Log

- `python3 -m unittest tools/devcli/tests/test_cli.py`: passed, 19 tests.
- `pnpm validate:plugin`: passed.
- `pnpm pack:dry-run`: passed; npm emitted existing unknown-env-config warnings.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 75 files and 528 tests.
- `git diff --check`: passed.

Implementation evidence:

- `tools/devcli/src/auriora_dev/commands/release_notes.py` owns release-note
  data structures, Git range/tag evidence collection, per-commit file evidence,
  classification, grouping, rendering, JSON output, agent instructions, and file
  writes.
- `tools/devcli/src/auriora_dev/commands/release.py` registers
  `awb release notes` and delegates to the helper module.
- `tools/devcli/tests/test_cli.py` covers name-status parsing, tag detection,
  per-commit evidence, JSON evidence, agent instructions, dry-run no-write
  behavior, empty ranges, and CLI help.
- Durable workflow guidance was promoted to `tools/devcli/README.md`,
  `docs/runbooks/codex-agent-workbench-plugin.md`,
  `docs/reference/agent-readable-changelog.md`, and
  `docs/requirements/agent-workbench-executable-backlog.md`.

## Residual Risks

- Pure path-based classification may miss intent until optional PR metadata or
  LLM-agent review is added.
- Generated notes still require maintainer review before release publication.
- A reusable skill or plugin should not be extracted until cross-repo demand is
  demonstrated.
- Per-commit file evidence increases Git command volume linearly with commit
  count; this is acceptable for release ranges in this repo, but future large
  ranges may need a batched collector.

## Closure Readiness

This spec can close when the command, tests, validation, and durable docs are
complete, and when any deferred cross-repo skill/plugin work is routed to the
backlog or a follow-up spec.
