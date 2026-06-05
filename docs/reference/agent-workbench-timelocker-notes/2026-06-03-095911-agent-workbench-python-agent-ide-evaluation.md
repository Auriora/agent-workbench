---
title: "Update: Agent Workbench and Python Agent IDE Evaluation"
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-06-03
tags: [update, ai-agent, mcp, agent-workbench, python-agent-ide]
links:
  tooling: [python-agent-ide, agent-workbench, mcp]
---

# Update: Agent Workbench and Python Agent IDE Evaluation

- **Owner**: Agent
- **Created Date**: 03-06-2026
- **Audience**: AI agents and maintainers
- **Related**: `AGENTS.md`, `docs/guides/ai-agent/`, `docs/updates/2026-05-06-175047-python-agent-ide-preference.md`
- **Scope**: repository agent tooling evaluation

## 1. Purpose

Record the task-scoped evaluation of the live Python Agent IDE MCP workflow against the intended Agent Workbench direction.

## 2. Summary

Initial discovery found Python Agent IDE as the only visible executable MCP surface. A later retry found Agent Workbench MVP available as an MCP server with
`context_for_task`, `verification_plan`, `symbol_search`, `find_references`, `impact`, `preview_workspace_edit`, and `apply_workspace_edit`.

The Python Agent IDE runtime reported valid, fresh repo state, warm cached analysis, and ready targeted-result trust for this repository.

Agent Workbench MVP now works for compact context, symbol discovery, and validation planning. A later detailed retest showed `repo:///scope` and
`repo:///overview` resolving to the active TimeLocker workspace. `repo:///status` timed out in the post-reload test, which is now the main first-use reliability
issue.

## 3. Implementation Notes

- Loaded the Agent Workbench and Python Agent IDE skills.
- Read `repo:///overview`, `repo:///status`, `repo:///scope`, `repo:///mcp-surface`, `repo:///validation-surface`, `repo:///usage/current`,
  `repo:///usage/gaps`, and `repo:///capability-gaps`.
- Ran Python Agent IDE `repo_preflight`, `context_for_task`, `docs_search`, `docs_read_section`, `orient_repo`, `diagnostics_for_files`,
  `verification_plan`, and `post_edit_feedback`.
- Ran Agent Workbench `context_for_task`, `verification_plan`, `symbol_search`, `find_references`, `impact`, `preview_workspace_edit`, and
  `apply_workspace_edit` safety checks.
- Observed that `docs_search` was stronger than broad task context for agent-process questions.
- Observed that `post_edit_feedback` provided useful combined diagnostics, formatter state, lint state, and test guidance.
- Observed that Agent Workbench `context_for_task` correctly found the Agent Workbench/Python Agent IDE evaluation docs once `repo_root` was supplied.
- Observed that Agent Workbench `verification_plan` produced a broad `python3 -m pytest` plan for representative Python files, while Python Agent IDE produced
  a richer plan with diagnostics, smoke tests, dependency usage audit, and topology review.
- Observed that Agent Workbench `symbol_search` for `RepositoryResolver` now resolves after reload, but cross-file references and impact traversal remain much
  weaker than Python Agent IDE.
- Validation: documentation-only note; no repository test suite run.

## 4. Detailed Agent Workbench Retest

- Discovery: Agent Workbench resources and tools are visible through MCP. Resources resolve TimeLocker and report 1,180 indexed files across Python, Markdown,
  JSON, YAML, shell, config, and related categories.
- Status/scope: `repo:///scope` and `repo:///overview` return quickly and bind to `/home/bcherrington/Projects/Auriora/TimeLocker`. `repo:///status` timed out
  after 120 seconds in the post-reload test. When status worked earlier, it reported `runtime_state: partial` and `freshness: unknown`; Python files were marked
  `partial_semantic`, while many docs/config files were `resource_backed`.
- Context quality: `context_for_task` performs well for documentation and explicit-file tasks. It correctly surfaced AI-agent guidance docs, repository resolver
  tests, validation-service tests, and related update notes.
- Context improvement after reload: repository-resolver context now includes ranked symbols for `RepositoryResolver` and `RepositoryResolver.resolve_repository`
  with parser-backed source ranges, docstrings, and node ids. The earlier `No graph snapshot is available` blocker no longer appears for that slice.
- Context limitation after reload: ranking quality is mixed. A validation-service task around URI validators favored many test functions and did not clearly rank
  the implementation class as highly as expected. Agent Workbench also marks results `freshness: unknown` or `refreshing`, even when the returned context is
  useful.
- Validation planning: documentation-only changes receive a manual docs/config syntax review plan. Python changes receive broad `python3 -m pytest` planning.
  This is usable but not as targeted as Python Agent IDE's nearest diagnostics/test planning.
- Graph tools: `symbol_search` now resolves `RepositoryResolver` and returns source excerpts. However, `find_references` for the class mostly returned local
  unresolved imports/calls from the defining file, and `impact` stayed confined to `src/TimeLocker/cli_modules/services/repository_resolver.py` with reached depth
  0. This is a major improvement over the cold snapshot failure, but it is not yet reliable blast-radius evidence.
- Graph limitation: `symbol_search` for `ConfigValidationService` returned no symbols, despite the explicit validation-service task finding related files and
  tests. This suggests exact-name discovery is still inconsistent across implementation areas.
- Edit preview: unsafe path preview was blocked without mutation. The error was safe, but the message named generated/vendor read-only policy rather than the
  path traversal/workspace escape cause.
- Edit preview: valid no-op preview on `AGENTS.md` returned a token, base/after hashes, and `change_count: 0`. The next action included the full replacement
  text, which is actionable but verbose for larger files.
- Apply safety: applying with a fake preview token was blocked without mutation.

## 5. Experience Comparison

Agent Workbench feels like the right direction for a multi-language IDE runtime: the contract is smaller, the resource model is easier to explain, and the tool
names map cleanly to common agent actions: gather context, search symbols, find references, estimate impact, preview edits, apply edits, and plan validation. It
also handles non-Python repository inventory better conceptually because it does not frame the whole project as a Python runtime with extras.

Python Agent IDE is still substantially ahead as a day-to-day coding assistant in this repository. Its preflight gives a concrete readiness state (`fresh`,
`ready`, valid repo root, command surface, policy hints, cache reuse, and runtime path readiness). Its symbol search has stronger exact-match behavior and cleaner
disambiguation. Its validation workflow is much more actionable: diagnostics, formatter state, lint state, direct-evidence tests, nearby tests, smoke tests, and
deferred broad tests are all separated with trust labels.

The biggest Agent Workbench experience gap is trust calibration. Agent Workbench often returns useful data, but it does not yet explain as clearly whether that
data is fresh enough, semantically strong enough, or only routing evidence. The `status` timeout makes the first touch feel fragile, while Python Agent IDE starts
with a reliable health packet and tells the agent what to do next.

The second gap is narrowing. Python Agent IDE usually finds the direct implementation definition and nearest tests. Agent Workbench can find the primary symbol
now, but its `next_actions` are verbose and its validation plan still jumps to broad `python3 -m pytest`. For coding workflows, Agent Workbench needs stronger
nearest-test selection and a smaller, ranked next-step list.

The third gap is graph depth. Agent Workbench graph tools now run, but the reference and impact results are not yet enough to guide a change. Python Agent IDE's
topology and post-edit feedback are noisy in places, but they better separate active-slice findings, downstream fallout, and test recommendations.

## 6. Recommendations

- Make `repo:///status` fast and bounded. If expensive checks are still running, return partial status with explicit pending work instead of timing out.
- Promote freshness and trust labels to first-class output on every Agent Workbench result: fresh/stale/refreshing, semantic/resource-backed/lexical, and whether
  the result is safe for routing only or strong enough for edit planning.
- Add nearest-test planning to Agent Workbench `verification_plan`, including direct test files supplied by the caller and inferred sibling tests.
- Improve reference resolution before treating `impact` as blast-radius evidence. A bounded lexical fallback is acceptable if it is clearly labeled.
- Reduce `context_for_task.next_actions` to the top few high-value follow-ups. The current list can become a task queue rather than guidance.
- Improve overview ranking so key docs are repo-guidance docs first, not incidental templates or project-management documents.
- Keep the edit preview/apply safety model; refine unsafe-path error messages so blocked workspace escapes are explained directly.

## 7. Documentation & Links

- `AGENTS.md`
- `docs/guides/ai-agent/AGENT-GUIDE-Operational-Best-Practices.md`
- `docs/updates/2026-05-06-175047-python-agent-ide-preference.md`

# References

- Python Agent IDE MCP runtime resources and tools used during this session.
