---
title: History mining for agent IDE signals design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Technical Design

## Overview

Add a local history-mining utility and durable planning docs that turn repeated
agent friction into actionable Agent Workbench backlog evidence. The first
slice stays outside the public MCP surface while the privacy, storage,
redaction, and payload-budget model is still unsettled.

## High-Level Design

The first implementation is a local debug utility, not a public MCP surface.
It reads Codex histories and hook logs, applies deterministic category
matching, and emits a compact Markdown or JSON report.

Inputs:

- `~/.codex/history.jsonl`
- `~/.codex/sessions/**/*.jsonl`
- `~/.codex/hooks/*.jsonl`
- optional `--repo-root` filter
- optional pattern/category defaults

Outputs:

- category counts
- representative bounded excerpts
- hook status/reason counts
- suggested backlog signals
- optional Markdown report file

## Data Flow

1. Resolve the Codex home and repository root.
2. Read history, session, and hook JSONL files with best-effort parsing.
3. Extract text-like fields from user prompts, assistant messages, function
   call arguments, function outputs, and hook records.
4. Apply repo filtering when `--repo-root` is supplied.
5. Match each record against stable categories.
6. Aggregate counts and bounded examples.
7. Render Markdown or JSON.

## Categories

Initial categories:

- `tool_discovery`: MCP tool visibility, advertised/callable drift, missing
  tools, server names, startup failures.
- `latency_timeout`: timeouts, hangs, slow calls, first-call reliability,
  prewarm issues.
- `validation_friction`: wrong commands, missing dependencies, blocked host
  commands, verification uncertainty.
- `post_edit_feedback`: diagnostics, hooks, clean/noisy feedback, deferred
  checks.
- `broad_routing`: noisy context, wrong language/repo shape, broad search,
  fallback to `rg` or manual reads.
- `workspace_safety`: wrong repo edits, generated artifacts, dirty worktree,
  accidental docs or cache files.
- `spec_traceability`: spec/task/design/requirements/closure lookup and
  lifecycle checks.
- `domain_mcp`: ActivityWatch, GitHub, Figma, Context7, or other domain MCP
  usage/friction.

## Low-Level Design

`src/debug/codex-history-mining.ts` provides:

- CLI argument parsing for `--codex-home`, `--repo-root`, `--output`,
  `--format`, `--limit`, and `--since`.
- recursive JSONL file discovery under sessions.
- resilient JSON parsing that skips malformed lines.
- text extraction from known Codex event payload shapes without depending on
  private schemas.
- hook aggregation from common `status`, `reason`, `cwd`, and timestamp
  fields.
- Markdown rendering suitable for durable docs review.

## Operational Considerations

- The script is read-only and local-only.
- Reports should be treated as planning evidence, not proof.
- Generated reports should normally live under `.tmp/` unless manually promoted
  into `docs/reference/`.
- Future MCP exposure should wait until storage, privacy, redaction, and
  payload budgets are designed.

## Open Questions

- Should fallback telemetry be captured live through OpenTelemetry spans rather
  than mined after the fact?
- Should reports link to transcript files and line numbers, or keep only
  bounded excerpts?
- Should Agent Workbench expose an opt-in `usage_gaps` resource later?
- Should history mining also inspect CI logs, PR comments, and issue threads?
