---
title: History mining for agent IDE signals verification
doc_type: spec
artifact_type: verification
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Verification

## Quality Gates

- `pnpm exec tsx src/debug/codex-history-mining.ts --repo-root . --limit 2`
- `pnpm typecheck`
- Spec lifecycle lint or scan
- `git diff --check`

## Validation Plan

- Run the scanner with a repo filter for Agent Workbench.
- Confirm the output includes category counts, excerpts, hook summaries, and
  backlog signals.
- Confirm the scanner exits successfully when optional hook files are missing.
- Keep generated output out of committed docs unless manually reviewed and
  promoted.

## Evidence Log

- 2026-06-06: `pnpm exec tsx src/debug/codex-history-mining.ts --repo-root . --limit 2`
  passed and printed a bounded Markdown report.
- 2026-06-06: Promoted mined principles and history signals into executable
  backlog by adding `docs/requirements/agent-workbench-executable-backlog.md`
  and linking it from the principles document and documentation map.
- 2026-06-06: Expanded the executable backlog with explicit chat-history mining
  categories, external evidence sources, extension idea coverage, and the
  driving "what repo, what matters, what proves this, can I trust this, what
  did I miss" product question.
- 2026-06-06: Completed T007 by adding the durable evidence-source decision
  matrix and resolving the spec open questions. Validation passed with
  `pnpm typecheck`, `git diff --check`, and spec lifecycle scan.

## Residual Risks

- Regex category matching is intentionally coarse and may over-count.
- Codex transcript schemas are private implementation details; extraction is
  best effort.
- History mining is local evidence only. Product decisions still need direct
  runtime, fixture, or user-workflow verification.
