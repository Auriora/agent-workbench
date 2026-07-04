---
title: Codex history agent tooling scan - 2026-06-06
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-06-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Codex History Agent Tooling Scan - 2026-06-06

## Scope

This scan reviewed local Codex history and hook logs for recurring issues,
successes, and friction-reduction opportunities around `agent-ide`,
`agent-workbench`, and adjacent MCP tooling.

Evidence inspected:

- 884 local Codex session JSONL files under `~/.codex/sessions`.
- `~/.codex/history.jsonl` prompts matching Agent IDE, Agent Workbench, and MCP
  terms: 354 matching prompts across 101 sessions.
- Hook logs:
  - `agent-workbench-post-edit.log.jsonl`
  - `session_start_python_prewarm.log.jsonl`
  - `post_apply_patch_feedback.log.jsonl`
  - `cache_refresh_requests.log.jsonl`
- Existing Agent Workbench feedback notes under `docs/reference/`.

## High-Signal Successes

### Agent IDE

- `repo_preflight` was repeatedly useful as a first-read readiness packet. It
  helped agents understand repo health, scope, freshness, command policy, and
  runtime state before editing.
- `context_for_task` became the main router for implementation work. It was
  most useful when seeded with explicit files or followed by direct symbol,
  docs, diagnostics, or validation calls.
- `post_edit_feedback`, `diagnostics_for_files`, and validation planning were
  high-value repair-loop surfaces. Agents benefited when clean results stayed
  quiet and actionable findings were concise.
- Usage telemetry and Jaeger traces were useful product evidence. They exposed
  slow calls, fallback patterns, and underused or over-broad tools.

### Agent Workbench

- The strongest positive pattern is disciplined, compact metadata:
  `analysis_validity`, freshness, scope, capability level, evidence kinds,
  truncation, and planned/blocked validation status.
- File-seeded workflows improved materially across non-Python repositories:
  FreeCAD C++ files, OneMount Go files, LibreChat JS/TS packages, AWS SAM
  templates, and .NET projects now produce better routing or validation plans
  than earlier dogfood passes.
- `verification_plan` now plans across several repo shapes without executing
  commands: Python/pytest, JS/TS npm package scripts, SAM/cfn-lint, CMake/CTest,
  .NET build, and Docker-blocked Go validation.
- Cross-repo smoke on 2026-06-06 showed `status`, `scope`, `overview`,
  `context`, and `verification` returning for eight local repositories inside
  bounded time.

### Adjacent MCP Tooling

- The spec-lifecycle MCP idea has strong user pull: agents need task/spec/design
  traceability, template checks, archive-aware linting, closure checks, and
  review packets that cheap subagents can consume safely.
- ActivityWatch MCP showed the value of aggregated domain tools. Tools such as
  activity summaries, calendar-aware activity, project categorization, and
  meeting context reduce the need for agents to process large raw event sets.
- GitHub MCP and other domain MCPs are useful when they expose the exact
  workflow users want, but agents often need explicit prompting to choose them
  over shell or web fallbacks.

## Recurring Issues

### Tool Use Requires Too Much Prompting

Several histories show the user explicitly reminding agents to use Agent IDE,
Agent Workbench, GitHub MCP, ActivityWatch MCP, or spec MCP tools. This is a
product problem: agents do not always discover or trust the available tool
surface without direct instruction.

Implication for Agent Workbench:

- First-read guidance must be visible, short, and reliable.
- Tool outputs should include exact next actions only when those actions are
  callable in the current session.
- A compact workflow packet may be more effective than relying on agents to
  remember multiple resource reads.

### Tool Discovery And Advertised Surface Drift

History and feedback notes repeatedly mention MCP visibility mismatches:

- Agent Workbench profiles advertised tools that were not callable in some
  Codex sessions.
- Earlier Agent IDE attempts had server-name and startup issues.
- ActivityWatch MCP tools were sometimes absent from the client-visible tool
  list even while server logs showed requests.
- Kiro integration had separate skill/MCP enablement problems.

Implication for Agent Workbench:

- Add or improve an integration health surface that compares advertised,
  registered, and discovered tools/resources.
- Suppress next actions for unavailable tools or mark them unavailable with a
  reason.
- Include host/client identity and repo root in telemetry so tool visibility
  bugs are diagnosable per session.

### First-Call Reliability And Latency Are Trust-Critical

The histories contain repeated startup, timeout, and latency reports:

- Agent Workbench `repo:///status` previously timed out or reported degraded
  warmup.
- A smoke test reported `verification_plan` timing out while context worked.
- Agent IDE `context_for_task.dependencies` was reported around eight seconds
  in Jaeger.
- ActivityWatch MCP HTTP/SSE sessions hung or returned method/session errors.
- Users asked for prewarm and for tools to be callable only when they can
  return in time.

Implication for Agent Workbench:

- Every first-read and repair-loop surface needs hard budgets and structured
  planned/degraded/blocked output.
- Slow hidden work should become skipped-work metadata, not a surprise timeout.
- OpenTelemetry traces should cover MCP tools and executable helper paths, with
  repo root and host client context attached.

### Broad Routing Still Drifts

Broad natural-language prompts often led to noisy or misleading candidates:

- Python Agent IDE treated LibreChat as Python-heavy because of incidental
  Python scripts.
- Agent Workbench broad FreeCAD routing over-weighted third-party/vendor-like
  files before first-party C++ source.
- AWS SAM tasks needed explicit template/handler files before routing became
  useful.
- Early .NET routing selected generated runtime assets before source/project
  files.

Implication for Agent Workbench:

- Prefer file-seeded workflows and exact next actions until broad routing has
  stronger repo-shape scoring.
- Treat fallback to `rg`, broad file reads, or manual command inspection as a
  backlog signal.
- Continue ecosystem-specific resource-backed promotion before deep semantic
  claims.

### Post-Edit Hooks Need Better Multi-File Behavior

Hook logs show:

- `agent-workbench-post-edit.log.jsonl`: 79 entries; 42
  `tool_failed_or_unknown`, 37 `checks_deferred`; all deferred entries used
  reason `too_many_files`.
- `post_apply_patch_feedback.log.jsonl`: 25,362 entries; 5,344
  `diagnostics_ran`, 5,881 `non_python_targets_logged`, 205
  `diagnostics_deferred`, 133 timeout reasons, and 44
  `too_many_files_for_inline_hook` reasons.
- Cache refresh requests were frequent: 11,733 queued entries.

Implication for Agent Workbench:

- Multi-file post-edit feedback should queue or parallelize bounded diagnostics
  instead of simply deferring useful checks.
- Hook output must stay quiet, but logs and telemetry should preserve enough
  evidence to explain skipped checks.
- A public `diagnostics_for_files` plus quiet hook-backed feedback loop remains
  one of the highest-value replacement surfaces.

### Validation Planning Must Be Policy-Aware

Histories repeatedly show friction from agents trying commands, failing, then
switching strategy. The user explicitly called out wanting to avoid sequences
such as missing PostgreSQL clients followed by alternate driver choices.

Implication for Agent Workbench:

- Validation planning should read repo policy, scripts, Docker/devcontainer
  guidance, and project shape before recommending commands.
- It should return blocked when repo guidance forbids host commands.
- It should prefer repo-owned scripts and documented validation paths over
  generic language defaults.

## Other Friction Agent Workbench Could Reduce

- Spec/task traceability: provide a task context surface that maps spec task ID
  to requirements, design sections, files, validation commands, and closure
  checks.
- PR/review readiness: surface changed files, likely validation, risky areas,
  and missing direct reads before final response or PR review.
- MCP server debugging: for repos implementing MCP servers, surface protocol
  mode, transport, tool list, session handling docs, and likely smoke commands.
- Domain-tool visibility: show when a relevant domain MCP exists but is not
  callable in the current session.
- Generated-artifact cleanup: flag accidental `.cache/`, temp reports, local
  runtime artifacts, and docs written into the wrong repository.
- Cross-agent handoff: produce compact verification packets that subagents can
  run independently without rediscovering repo rules.

## Recommended Product Backlog Signals

1. Add an integration health/check surface for advertised versus callable MCP
   resources/tools.
2. Keep improving `repo:///status`, `repo:///scope`, and `repo:///overview` as
   the first-read replacement for `repo_preflight`; reconsider a single
   `repo_preflight` tool only if agents still miss the resource workflow.
3. Make `context_for_task` next actions session-aware and suppress unavailable
   tools.
4. Promote `diagnostics_for_files` and quiet multi-file post-edit feedback as a
   core repair-loop capability.
5. Add task/spec traceability lookup for spec-driven repositories, using the
   spec-lifecycle work rather than duplicating it.
6. Expand validation-policy discovery: repo scripts, Docker/devcontainer,
   project-specific guidance, and blocked host commands.
7. Add MCP-server repo support: tool inventory, transport smoke tests, session
   protocol hints, and server log pointers.
8. Treat fallback telemetry as product input: manual `rg`, broad reads,
   command-surface inspection, and shell-first validation should become
   measurable friction signals.
