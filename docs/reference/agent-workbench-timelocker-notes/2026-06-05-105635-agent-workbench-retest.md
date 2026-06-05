---
title: "Update: Agent Workbench Retest"
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-06-05
tags: [update, ai-agent, mcp, agent-workbench]
links:
  tooling: [agent-workbench, mcp]
---

# Update: Agent Workbench Retest

- **Owner**: Agent
- **Created Date**: 05-06-2026
- **Audience**: AI agents and maintainers
- **Related**: `AGENTS.md`, `docs/guides/ai-agent/`, `docs/updates/2026-06-03-095911-agent-workbench-python-agent-ide-evaluation.md`
- **Scope**: Agent Workbench MCP retest

## 1. Purpose

Record the Agent Workbench retest requested on 05-06-2026 and confirm whether the stated acceptance criteria are met.

## 2. Summary

Agent Workbench has improved since the earlier evaluation. `repo:///status` returned without timing out, exact lookup works for existing repository-resolver
symbols, validation planning now selects targeted pytest files for Python changes, and graph impact now includes confidence labels.

The retest is not a clean full acceptance. `repo:///status` reports a degraded refresh state, exact lookup for `ConfigValidationService` returns no symbol because
the implementation class in this repo is `ValidationService`, and context ranking for validation-service URI work still prefers tests over the implementation.

## 3. Retest Notes

- Read `repo:///status`, `repo:///scope`, and `repo:///overview`.
- Ran `context_for_task` for repository-resolver, validation-service URI, and docs/update-log tasks.
- Ran `symbol_search` for `RepositoryResolver`, `RepositoryResolver.resolve_repository`, `ConfigValidationService`, `ValidationService`, and
  `validate_repository_uri`.
- Ran `find_references` and `impact` for `RepositoryResolver.resolve_repository` and `ValidationService.validate_repository_uri`.
- Ran `verification_plan` for repository-resolver Python changes, validation-service Python changes, documentation-only changes, and docs/YAML config changes.
- Commands were planned but not executed.

## 4. Acceptance Status

- `repo:///status` no longer times out: accepted with caveat. It returned promptly, but reported `runtime_state: refreshing`, `warmup_state: failed`, and
  `reason: Unknown snapshot id: 1780653277649`.
- Nearest-test planning is better than broad-only pytest: accepted. Python plans now returned targeted pytest files instead of only `python3 -m pytest`.
- Exact symbols resolve reliably: partially accepted. `RepositoryResolver` and `RepositoryResolver.resolve_repository` resolved exactly. `ConfigValidationService`
  did not resolve; source inspection showed the implementation class is named `ValidationService`.
- Reference/impact output has useful confidence labels: accepted for impact, partially accepted for references. `impact` returned high and low confidence labels
  with scope and reason fields. `find_references` returned per-reference confidence/status/provenance for resolved edges.
- Overview/status/scope behavior is compact and quiet: accepted with caveat. The resources are compact and quiet, but status exposes a degraded refresh/warmup
  state and overview still emphasizes workflow/config files before application entrypoints.

## 5. Follow-Up

- Investigate the status refresh failure and unknown snapshot id.
- Improve validation-service context ranking so implementation definitions rank above matching tests when explicit implementation files are supplied.
- Consider documenting non-existent symbol behavior separately from failed exact lookup, because it affects acceptance interpretation.

## 6. Documentation & Links

- `docs/updates/2026-06-03-095911-agent-workbench-python-agent-ide-evaluation.md`
- `docs/guides/ai-agent/AGENT-GUIDE-Operational-Best-Practices.md`

# References

- Agent Workbench MCP resources and tools used during this retest.
