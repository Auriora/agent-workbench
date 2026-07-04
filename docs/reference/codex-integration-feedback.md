---
title: Codex integration feedback

doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-06-18
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Codex Integration Feedback

## Purpose

Capture implementation feedback for improving the Agent Workbench Codex
integration. This document records the final corrected position from review
feedback and should be used as input to future specs, backlog items, and design
updates.

This document is not the canonical contract for MCP resources, runtime response
schemas, or coding-agent integration rules. When implementation changes are
accepted, promote durable decisions into:

- [Coding agent integration design](../design/coding-agent-integration-design.md)
- [MCP surface design](../design/mcp-surface-design.md)
- [Runtime contracts](runtime-contracts.md)
- [Codex Agent Workbench plugin and MCP setup](../runbooks/codex-agent-workbench-plugin.md)
- [Agent Workbench Codex plugin README](../../plugins/agent-workbench/README.md)

## Summary Position

Agent Workbench should make Codex feel more like an IDE for coding agents.
Hooks, skills, default prompts, and MCP surfaces should provide ambient,
bounded, evidence-calibrated guidance at the points where the agent is least
likely to ask but most likely to benefit.

The integration should not add hidden runtime behaviour, hidden validation,
automatic repair, broad repository analysis, or parallel implementations inside
plugin artifacts.

The preferred model is:

```text
MCP runtime
  Authoritative executable surface.

Skill and plugin prompts
  Workflow guidance and user-invoked shortcuts.

Hooks
  Ambient IDE-like signals at lifecycle and tool-use boundaries.
```

## Core Hook Philosophy

A hook is a logical lifecycle or event interception point where Agent Workbench
can inject useful context without waiting for the agent to ask.

A good hook satisfies this test:

```text
IF the agent is about to make, or has just made, a consequential move
AND Agent Workbench can provide bounded evidence that changes the next action
THEN emit concise context
ELSE stay quiet.
```

Use hooks where the agent is least likely to ask but most likely to benefit:

```text
before risky action
after consequential action
after context loss
before unsupported claim
```

Hooks should behave like IDE indicators: problem markers, status badges,
changed-file panels, stale-index warnings, and validation-state reminders.

## Terminology: Quiet, Not Silent

Do not describe the intended default behaviour as "silent" if hooks are still
expected to emit useful context.

Preferred language:

```text
quiet hooks
action-gated hooks
ambient context hooks
IDE-like lifecycle hints
post-edit feedback
no-op suppression
```

Avoid using "silent hooks" unless it specifically means a mode with no
user-visible output.

Recommended wording:

```text
Hooks are quiet and action-gated by default. They emit concise Codex context on
lifecycle events and after edits only when the output changes the agent's next
useful action.
```

## Current Codex Hook Surface

The current Codex plugin registers two concrete hook event classes:

```text
SessionStart
PostToolUse
```

Current implementation should continue improving these hooks, but future design
should reason in terms of logical hook points. Some logical hooks may map to the
same concrete Codex event, while others may require future Codex support or a
non-hook surface.

Current mapping:

```text
SessionStart
  startup
  resume
  clear
  compact

PostToolUse
  apply_patch
  Edit
  Write
  write_file
  create_file
  rename_file
```

## Existing Hook Improvements

### SessionStart

Purpose: lifecycle orientation and context recovery.

Recommended behaviour by event:

```text
startup:
  Agent Workbench is configured. Start with repo:///status, repo:///scope, and
  repo:///overview before broad repository reads.

resume:
  Re-check repo:///status before relying on prior Workbench evidence. Use
  context_for_task to reload bounded task context.

compact:
  After compaction, re-check repo:///status and use context_for_task before
  broad reads. Treat partial, stale, heuristic, text_fallback, or
  resource_backed evidence as routing only. Use verification_plan before
  claiming validation.

clear:
  Context was cleared. Reload repository orientation through repo:///overview
  and context_for_task before implementation reads.
```

Use "configured" rather than "available" unless the hook has actually verified
MCP startup and tool visibility.

### PostToolUse

Purpose: cheap, bounded post-edit feedback after file-changing tools.

Keep this hook narrowly scoped to:

```text
changed-path extraction
generated or local artifact warning
workspace-escape-looking path warning
merge conflict marker detection
cheap syntax checks
bounded deferred-check reporting
bounded state persistence for compact/resume recovery
```

Do not turn this hook into validation execution, broad diagnostics, graph
analysis, or automatic repair.

## Compact And Resume State Handoff

Implement compact/resume state handoff. This is a high-value hook behaviour.

Pattern:

```text
PostToolUse records bounded recent edit state.
SessionStart reads that state on resume or compact.
SessionStart emits a compact recovery context pulse only when useful.
```

This addresses a common agent failure mode: continuing after compaction without
remembering changed files, deferred checks, stale evidence, or validation gaps.

### State To Persist

Persist only bounded metadata:

```json
{
  "schema_version": 1,
  "repo_root": "/repo",
  "updated_at": "2026-06-18T12:00:00Z",
  "recent_changed_files": [
    "src/auth/session.ts",
    "tests/session.test.ts"
  ],
  "last_findings": [
    {
      "severity": "warning",
      "message": "Generated/local artifact changed: dist/app.js."
    }
  ],
  "deferred_checks": [
    {
      "reason": "too_many_files",
      "count": 3,
      "follow_up_tool": "diagnostics_for_files"
    }
  ],
  "recommended_next_actions": [
    "repo:///status",
    "verification_plan"
  ],
  "last_emitted_digest": "sha256:...",
  "last_emitted_at": "2026-06-18T12:05:00Z"
}
```

Do not persist:

```text
source content
diff hunks
secret-like values
full command output
large file lists
unbounded absolute paths
```

Prefer repo-keyed state files:

```text
~/.codex/hooks/agent-workbench/state/<repo-hash>.json
```

Recommended caps:

```text
max_recent_files: 10
max_visible_files: 3
max_findings: 3
max_state_age: 24 hours
max_message_chars: 500
```

### Emission Gates

Emit compact/resume context when at least one is true:

```text
recent changed files exist
last post-edit finding was actionable
checks were deferred
changed file count exceeded inline budget
previous output included a blocker or warning
prior Workbench evidence may be stale after compaction
```

Do not emit when all are true:

```text
no recent changed files
no findings
no deferred checks
same message was already emitted for this state digest
state is too old
repo root changed
state file is unreadable or invalid
```

### Message Examples

No useful state:

```text
Emit nothing.
```

Generic compact recovery:

```text
Agent Workbench compact recovery: re-check repo:///status and use
context_for_task before broad reads. Treat stale or partial evidence as routing
only.
```

Changed files:

```text
Agent Workbench compact recovery: recent edits touched src/a.ts and
tests/a.test.ts. Use verification_plan for these files before claiming
validation.
```

Findings or deferred checks:

```text
Agent Workbench compact recovery: recent edits touched 4 files; inline checks
were deferred for 2. Use diagnostics_for_files or verification_plan before
continuing.
```

Blocker:

```text
Agent Workbench compact recovery: previous edit feedback reported a
workspace-escape-looking path. Re-check the changed paths before further edits.
```

## Additional Logical Hooks Worth Considering

The following hooks are logical hook points. They may or may not map directly to
current Codex plugin hook event names. If a logical hook cannot be implemented
through an available Codex hook, implement the behaviour through MCP resources,
MCP prompts, skill guidance, plugin default prompts, explicit commands, or defer
it until the required hook event exists.

### 1. Session Orientation Hook

Trigger: new session, repository opened, workspace changed.

Purpose: prevent blind repository entry.

Recommended signal:

```text
Agent Workbench is configured. Start with repo:///status, repo:///scope, and
repo:///overview before broad repository reads.
```

Gate: emit once per repo/session, or only if the agent has not yet used
Workbench in the session.

Priority: P1.

### 2. Post-Compact / Resume Recovery Hook

Trigger: compaction, resume, context clear.

Purpose: recover lost task, edit, validation, and freshness context.

Recommended signal:

```text
Agent Workbench compact recovery: recent edits touched src/auth/session.ts and
tests/session.test.ts. Re-check repo:///status, then use verification_plan for
these files before claiming validation.
```

Gate: repo-scoped state, age cap, digest dedupe, max visible files.

Priority: P1.

### 3. Pre-Broad-Read Hook

Trigger: before broad repository discovery such as:

```text
find .
ls -R
grep -R
rg with no path or narrow pattern
cat of large or many files
```

Purpose: prevent avoidable context waste and route through Workbench first.

Recommended signal:

```text
This looks like broad repository discovery. Prefer context_for_task or
repo:///overview first; use broad shell scans only if Workbench evidence is cold,
stale, or insufficient.
```

Gate: emit only when the operation is clearly broad and no recent Workbench
orientation exists. Do not block by default.

Priority: P2.

### 4. Pre-Edit Safety Hook

Trigger: before file write, patch, rename, or delete.

Purpose: catch risky edits before mutation.

Warn on:

```text
generated/vendor paths
secret-like paths
workspace escapes
large full-file replacements
destructive rename/delete
repo-root authority violations
```

Recommended signal:

```text
This edit targets a generated/vendor path: dist/app.js. Confirm this is
intentional or use source files instead.
```

Gate: warn only on high-risk classes, not ordinary source edits.

Priority: P1.

### 5. Post-Edit Feedback Hook

Trigger: after edit/write/patch/rename.

Purpose: immediate IDE-style feedback after mutation.

Keep bounded to:

```text
changed file extraction
generated/local artifact warnings
workspace escape warnings
merge conflict markers
cheap syntax checks
deferred check summaries
```

Priority: P1.

### 6. Pre-Command Validation-Policy Hook

Trigger: before shell command execution.

Purpose: prevent unsafe, misleading, or policy-blocked validation commands.

Detect validation-like commands such as:

```text
pnpm test
npm test
go test ./...
pytest
dotnet test
cmake --build
docker compose ...
```

Recommended signals:

```text
Before running host tests, check verification_plan. This repo may require
containerized validation or package-local commands.
```

```text
Host validation appears blocked by repo policy. Use verification_plan before
executing this command.
```

Gate: emit only for validation-like commands, destructive commands, or commands
that conflict with known repo policy.

Priority: P1.

### 7. Post-Command Evidence Hook

Trigger: after shell command completion.

Purpose: capture executed validation evidence so the agent can distinguish
planned checks from done checks.

Capture bounded metadata:

```text
command
exit code
duration
small output summary
validation scope when inferable
```

Recommended signals:

```text
Validation evidence captured: pnpm test exited 0. You may cite this as executed
validation if the command scope matches the changed files.
```

```text
Validation failed: pnpm test exited 1. Summarize failing test names before
continuing edits.
```

Gate: store metadata and bounded summaries only. Avoid full logs unless
explicitly requested.

Priority: P2.

### 8. Task-Intake Hook

Trigger: new user prompt or task start.

Purpose: classify the task and suggest the first Workbench action.

Useful classifications:

```text
implementation
review
debugging
documentation
validation
spec/lifecycle-driven
security-sensitive
large refactor
```

Recommended signal:

```text
This looks like an implementation task. Use context_for_task before broad reads;
pass known files or symbols if available.
```

For spec-driven tasks:

```text
This appears spec-driven. Use the lifecycle system for authoritative task
context, then pass its output into context_for_task.lifecycle_context.
```

Gate: low-confidence suggestions only. Never override user intent.

Priority: P2.

### 9. Pre-Final Validation-Claim Hook

Trigger: before final assistant response.

Purpose: prevent unsupported validation and completion claims.

Recommended signals:

```text
Validation claim check: verification_plan was generated, but no executed test
evidence was observed. Do not claim validation passed.
```

```text
Changed files exist and no validation evidence was captured. Report validation
as not run or planned.
```

Gate: emit only if changed files exist, validation-related language appears in
the response, or Workbench has pending validation gaps.

Priority: P1.

### 10. Git-State Anomaly Hook

Trigger: before final response, before commit/PR, after several edits, or when
summarising work.

Purpose: surface repository cleanliness and unintended changes.

Warn on:

```text
untracked files
generated artifacts changed
deleted files
large binary changes
lockfile changes
unexpected config changes
dirty repo before task
```

Recommended signal:

```text
Git state changed outside the likely task scope: package-lock.json and
dist/app.js. Review before summarizing completion.
```

Gate: emit anomalies only, not full status.

Priority: P2.

### 11. Dependency / Install Drift Hook

Trigger: plugin load, MCP startup failure, session start when launcher is
missing, or explicit install check.

Purpose: detect broken Agent Workbench installation state.

Emit only on evidence of drift:

```text
missing launcher
version mismatch
plugin manifest/runtime mismatch
native dependency failure
MCP startup timeout
```

Recommended signal:

```text
Agent Workbench launcher was not found at the installed package path. Reinstall
the package and reload the Codex plugin.
```

Gate: only on detected failure. Prefer integration health, installer checks, or
manual debug commands when no suitable hook event exists.

Priority: P3.

### 12. Long-Task Drift Hook

Trigger: many tool calls, many edits, or stale index/freshness change.

Purpose: remind the agent to refresh evidence during long sessions.

Recommended signal:

```text
Workbench evidence may be stale after multiple edits. Re-check repo:///status or
run context_for_task before further impact claims.
```

Gate: event-count thresholds only. Avoid wall-clock-only reminders.

Priority: P3.

## Hooks To Avoid Or Defer

### Automatic Broad Validation Hook

Do not auto-run test suites after edits.

Reason:

```text
Validation can be expensive, environment-specific, destructive, or
policy-blocked. Use verification_plan first.
```

### Automatic Broad Graph Refresh Hook

Do not trigger hidden heavy indexing from arbitrary lifecycle points unless
Workbench already owns a safe warmup path.

Reason:

```text
Hidden heavy work violates the bounded-evidence design.
```

### Automatic Repair Hook

Do not let hooks edit files.

Reason:

```text
Hooks should inform the agent, not become a hidden autonomous editor.
```

### Repeated Generic Guidance Hook

Do not emit the same generic "use Workbench" message after every event.

Reason:

```text
The agent will discount it as noise.
```

## Non-Hook Codex UX Improvements

Some improvements belong outside hooks.

### Plugin Default Prompts

Make plugin default prompts more operational:

```json
[
  "Use Agent Workbench to orient on this repository before broad reads.",
  "Use Agent Workbench to gather context for my current task and identify files to inspect.",
  "Use Agent Workbench to plan validation for my current changes without executing commands.",
  "Use Agent Workbench to review changed files for impact, missing evidence, and residual risk.",
  "Use Agent Workbench after compaction to refresh repository status and task context."
]
```

### Skill Guidance

Add compact/resume guidance to the Agent Workbench skill:

```text
After resume or compaction:
1. Re-read repo:///status.
2. Use context_for_task to restore bounded task context.
3. Treat stale, partial, heuristic, text_fallback, or resource_backed evidence as
   routing only.
4. Use verification_plan before claiming validation.
```

### First-Call Workflow

Consider a first-call MCP prompt or resource only if it does not duplicate
existing resources excessively.

Options:

```text
MCP prompt: agent-workbench-first-call
MCP resource: repo:///first-call
Codex default prompt: Use Agent Workbench to orient on this repository before broad reads.
```

A first-call bundle should remain compact:

```json
{
  "runtime_state": "...",
  "freshness": "...",
  "repo_shape": "...",
  "top_key_files": [],
  "top_key_docs": [],
  "safe_next_actions": [],
  "warnings": []
}
```

## Cross-Cutting Implementation Rules

### Keep Hooks Bounded

Hooks must not perform broad repository analysis, broad graph traversal,
expensive validation, or automatic repair.

### Keep Hooks Evidence-Calibrated

Hooks must distinguish:

```text
routing evidence
planned validation
executed validation
stale evidence
partial evidence
heuristic evidence
unsupported evidence
```

### Do Not Claim Validation

Hooks may point to `verification_plan`, `diagnostics_for_files`, or captured
executed command metadata. They must not claim validation passed unless executed
evidence exists and the scope matches the claim.

### Deduplicate Hook Output

Use state digests and time/repo gates so the same hook message is not emitted
repeatedly.

### Avoid Secret And Content Persistence

State files must not contain source content, diffs, secret-like values, full
command output, or unbounded file lists.

### Align Metadata With Config

Keep integration profile hook metadata aligned with actual hook config. The
profile should either derive matcher metadata from hook config or CI should fail
when the two diverge.

## Recommended Roadmap

### P1

- Rename "silent" terminology to "quiet" or "action-gated".
- Make `SessionStart` event-aware for startup, resume, clear, and compact.
- Implement compact/resume state handoff from post-edit state.
- Keep `PostToolUse` narrowly post-edit and bounded.
- Add or design pre-edit safety hook behaviour.
- Add or design pre-command validation-policy hook behaviour.
- Add or design pre-final validation-claim hook behaviour.
- Align hook matcher metadata between hook config and integration profile.

### P2

- Add post-command validation-evidence capture.
- Add task-intake classification if a suitable hook event exists.
- Add git-state anomaly reporting.
- Improve plugin default prompts.
- Add compact/resume guidance to the skill.
- Validate hook policy against runtime path/safety policy.

### P3

- Add install-drift reporting only on detected failure or explicit request.
- Add long-task stale-evidence reminders with strict event-count gates.
- Consider a first-call MCP prompt/resource if dogfood shows status/scope/overview
  sequencing remains too fragile.

## Decision Summary

```text
Use hooks for ambient IDE-like signals.
Use MCP for authoritative runtime capability.
Use skills and prompts for workflow guidance.
Use installer/debug surfaces for operational checks.
Do not put hidden validation, hidden repair, or broad analysis into hooks.
```
