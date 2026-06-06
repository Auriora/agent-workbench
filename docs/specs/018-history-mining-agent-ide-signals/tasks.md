---
title: History mining for agent IDE signals tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Tasks

## Task Dependency Graph

T001 -> T002 -> T003 -> T004 -> T005

T006 can run after T003.

## Tasks

- [x] T001 Define project principles and VMOST.
  - Files: `docs/requirements/agent-workbench-principles.md`
  - Acceptance: Principles describe Agent Workbench as an IDE for coding
    agents and include the edit/verify/refactor feedback loop.
  - Evidence: Added durable principles document.

- [x] T002 Record current Codex history scan findings.
  - Files: `docs/reference/codex-history-agent-tooling-scan-2026-06-06.md`
  - Acceptance: Findings include agent-ide wins, agent-workbench wins,
    recurring issues, hook-log signals, and backlog signals.
  - Evidence: Added reference scan note from local history and hook logs.

- [x] T003 Create active spec package for repeatable mining.
  - Files:
    - `docs/specs/018-history-mining-agent-ide-signals/requirements.md`
    - `docs/specs/018-history-mining-agent-ide-signals/design.md`
    - `docs/specs/018-history-mining-agent-ide-signals/tasks.md`
    - `docs/specs/018-history-mining-agent-ide-signals/verification.md`
  - Acceptance: Spec explains goals, categories, local script behavior, and
    validation expectations.
  - Evidence: Added Spec 018 package.

- [x] T004 Add a local history-mining script.
  - Files: `src/debug/codex-history-mining.ts`
  - Acceptance: Script scans Codex history/session/hook JSONL files, applies
    repo filtering, groups friction categories, and renders Markdown or JSON.
  - Evidence: Implemented debug utility.

- [x] T005 Validate the script on this repository.
  - Files: `src/debug/codex-history-mining.ts`
  - Acceptance: Script runs against the current repo and produces a bounded
    summary without modifying target repos.
  - Evidence: `pnpm exec tsx src/debug/codex-history-mining.ts --repo-root . --limit 2`
    passed.

- [x] T006 Promote mined backlog items into executable backlog.
  - Depends on: T002, T003
  - Files: `docs/requirements/agent-workbench-executable-backlog.md`
  - Acceptance: Highest-signal items such as integration health,
    session-aware next actions, multi-file post-edit diagnostics, and
    spec/task traceability are promoted into scoped executable backlog entries
    and candidate implementation specs.
  - Evidence: Added the executable backlog with item IDs, acceptance criteria,
    validation expectations, sequencing, and promotion rules.

- [ ] T007 Consider additional data sources.
  - Depends on: T005
  - Files: `docs/requirements/agent-workbench-executable-backlog.md`
  - Acceptance: Decide whether to mine PR comments, CI logs, git history,
    shell command logs, MCP server logs, Jaeger traces, issue trackers,
    `AGENTS.md` files, spec/task docs, and human or agent tooling references.
  - Evidence: Added a durable evidence-source list to the executable backlog;
    implementation and automation remain pending.
