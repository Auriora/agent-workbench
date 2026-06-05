---
title: Agent IDE capability analysis
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-06-05
---

# Agent IDE Capability Analysis

## Purpose

This document records the first inventory and reconciliation pass for
predecessor `agent-ide` capabilities. It supports
[Spec 010](../../specs/010-agent-ide-capability-analysis/requirements.md).

The intent is not to port Python implementation code. The useful output is a
language-neutral replacement plan: keep the workflows that proved valuable,
route language-specific evidence through adapters/providers, and avoid adding
public MCP tools only for surface parity.

## Evidence Inspected

Agent IDE repository inspected read-only:
`/home/bcherrington/Projects/Auriora/agent-ide`.

Primary evidence:

- `docs/current-capabilities.md`
- `docs/performance-findings-2026-05-06.md`
- `docs/design/post-edit-hooks.md`
- `docs/adr/0003-quiet-post-edit-hooks.md`
- `docs/agent-client-integration-portability.md`
- `docs/design/multi-language-support.md`
- `docs/multi-language-support-plan.md`
- `plugins/python-agent-ide/skills/python-agent-ide/SKILL.md`
- `src/agent_ide/mcp/tool_catalog.py`
- `src/agent_ide/mcp/resource_catalog.py`
- tracked tests for runtime contracts, hooks, docs, diagnostics, symbol
  navigation, runtime status, usage resources, and profiling

Surface profile evidence in `docs/performance-findings-2026-05-06.md` recorded
67 tools, 29 resources, 8 prompts, 56 scripts, 2 hooks, and 1 skill in a full
profile run. That is useful evidence of breadth, but it is not a target size for
Agent Workbench.

## High-Value Findings

The strongest predecessor lessons are product/workflow lessons:

- Agents used first-pass planning, docs search, diagnostics, validation
  planning, and post-edit feedback far more than deep refactor/navigation
  tools.
- `repo_preflight` was a high-value single pre-edit readiness packet:
  repo/runtime health, policy hints, scope, freshness, and execution context.
- `context_for_task` was the primary work router, but broad natural-language
  routing could drift. It worked best when followed by explicit target
  verification through symbols, dependencies, modules, diagnostics, or direct
  reads.
- Docs support was valuable enough to be a first-class route: docs overview,
  docs map, search, outline, read-section, and crosslinks.
- Post-edit feedback was highly used through hooks and internal spans. Clean
  edits must be quiet; visible output should be reserved for actionable
  findings.
- Usage telemetry was valuable because it showed fallback/direct-read patterns,
  verification gaps, and repair-loop coverage.
- Slow compact tools damaged trust when they secretly invoked broad topology,
  validation, cache freshness, or dependency work. Compact should mean bounded
  presentation over trusted targeted evidence, or an explicit skipped-work
  label.

The main implementation lessons to avoid copying are:

- Python semantic depth should not become the shared runtime model.
- Pytest, Ruff, Pyright/LSP, Python AST, and Python package heuristics are
  provider/adapter details only.
- A large public tool surface creates discovery pressure. Workbench should
  improve primary workflows first and add public tools only when existing
  surfaces cannot carry the workflow clearly.
- Usage/event storage must avoid hot-path full JSON rewrites and excessive
  cache-file growth.

## Capability Matrix

| Capability | Agent IDE surface | Observed value | Agent Workbench status | Portable lesson | Python-specific parts | Recommended action |
| --- | --- | --- | --- | --- | --- | --- |
| First-read repo readiness | `repo_preflight`, `repo:///overview`, `repo:///status`, `repo:///scope`, `repo:///mcp-surface` | Strong first touch; tells agents whether runtime evidence can be trusted before edits | Partly implemented through `repo:///status`, `repo:///scope`, `repo:///overview`, and Codex profile docs | Keep a compact readiness packet with freshness, scope, capability, verification, and next reads | Python file counts, Python runtime readiness, pytest/Ruff hints | Consider whether Workbench needs a `repo_preflight` tool or whether `repo:///status` plus `repo:///overview` should explicitly cover the same workflow in T004 |
| Task context routing | `context_for_task`, `orient_repo`, `explore_codebase`, `find_runtime_path` | Highest top-level usage after tool listing; useful but can drift on broad prompts | Implemented as `context_for_task`; overview ranking and language routing improved through Specs 003-006; active polishing in Specs 008-009 | Primary router should be compact, explain evidence, and emit exact follow-up calls for target verification | Python-oriented exploration policies and runtime-path heuristics | Improve existing `context_for_task` before adding broad orientation tools; evaluate `find_runtime_path` as a future explicit orientation/report surface |
| Documentation routing | `repo:///docs/overview`, `repo:///docs/map`, `docs_search`, `docs_outline`, `docs_read_section`, `docs_crosslinks` | Frequently used; avoids broad code reads when docs already answer process/architecture questions | Resource-backed Markdown routing exists, but no equivalent public docs-search/read-section surface is exposed | Docs are first-class project evidence and should have compact indexed query/read surfaces | Python docs index implementation details | High-value gap. Candidate follow-up spec: language-neutral docs index/search/read-section resources or tools backed by Markdown adapter and presenters |
| Diagnostics | `diagnostics_for_files`, `diagnostics_for_change`, `lint_changed_files`, hook `post_apply_patch_feedback` | Top retained usage and core repair-loop step | Workbench has quiet static feedback in `verification_plan.static_feedback`; no standalone diagnostics tool yet | Agents need fast changed-file diagnostics independent of full test planning | Ruff, py_compile, Pyright/Python LSP | High-value gap. Prefer provider-backed diagnostics use case with language adapters; decide in T004 whether standalone `diagnostics_for_files` is justified |
| Validation planning and nearest tests | `verification_plan`, `test_impact_with_evidence`, `run_nearest_tests`, `rank_test_targets` | Useful when it names exact tests; dangerous when broad or stale | `verification_plan` implemented; nearest-test planning improved for Python, Go, JS/TS, SAM, .NET; command execution intentionally not implemented | Plan narrow checks, label planned vs executed, and avoid unsafe host commands | pytest execution, Python test ranking | Continue improving `verification_plan`; defer command execution until command-runner policy and provider gates exist |
| Post-edit feedback | `post_edit_feedback`, Codex post-write hook, `repo:///last-edit` | Dominant internal span volume; guides repair loop after edits | Workbench has quiet hooks and `verification_plan.static_feedback`; no explicit `post_edit_feedback` tool | Post-edit feedback should summarize changed-file diagnostics, validation status, risky cleanup, and next verification while staying quiet when clean | Python diagnostics and public-symbol breakage mechanisms | High-value gap. Candidate follow-up spec: language-neutral post-edit feedback presenter/use case reusing diagnostics and validation providers |
| Symbol lookup | `find_symbol`, `symbol_search`, `workspace_symbols`, `repo:///symbol/{name}` | Underused directly but useful when context routes to it | Implemented as `symbol_search`; Python partial semantic plus resource-backed Go/C++/.NET/SAM evidence | Exact-first lookup, ambiguity handling, confidence labels, source excerpts | Python AST/LSP symbol details | Continue through language adapter promotion gates; no new tool needed |
| References and impact | `find_references`, `analyze_change_impact`, `test_impact_with_evidence`, resource templates | Valuable when target is known; underused without guidance | Implemented as `find_references` and `impact` with confidence labels; depth remains shallow for several languages | Keep reference/impact confidence explicit and route users from context to targeted calls | Python semantic refs/calls/import graph | Improve per-language adapters; Spec 009 covers C/C++ routing edges; future Go/C#/JS specs should use same contracts |
| Semantic refactors and workspace edits | `rename_symbol`, `change_signature`, `apply_code_action`, `preview_workspace_edit`, `apply_workspace_edit`, rollback/drift tools | Powerful but low observed top-level usage; strong safety contract | `preview_workspace_edit` and `apply_workspace_edit` implemented; semantic rename/signature not implemented | Preview/apply token, hash drift checks, path safety, rollback concepts | Python LSP-backed edits, Python import updates | Do not add semantic refactor tools until a language adapter proves safe preview semantics |
| Runtime/cache/warmup | `refresh_now`, background indexer, warm caches, runtime status, background-state | Warm state improves trust; slow freshness checks hurt trust | Workbench warmup/status improved; resources expose status/scope/overview and freshness | Startup warmup should be bounded, observable, and never block first-read status indefinitely | Python cache namespaces and Python index store | Continue runtime operations work; ensure future providers share snapshot/freshness helpers |
| Usage and adoption telemetry | `repo:///usage/current`, `repo:///usage/history`, `repo:///usage/gaps`, `repo:///usage/failures`, Jaeger review | Showed fallback patterns, partial repair-loop coverage, and underused tools | Workbench has OpenTelemetry instrumentation and no durable usage records by MVP policy | Usage is product-quality evidence; fallback frequency should feed backlog | Python Agent IDE usage schema and JSON state writes | Medium/high-value planning gap. Consider opt-in usage/adoption summaries after observability policy is settled |
| Hooks and client integrations | Codex session-start prewarm and post-write hooks, portability docs | Helpful when quiet and actionable; noisy hook context reduces value | Workbench Codex plugin/skill and quiet hooks exist | Hooks should be thin client adapters over runtime capabilities, silent on success/error unless actionable | Python-specific fast diagnostics | Continue through coding-agent integration docs; post-edit feedback gap should make hooks better without adding noise |
| Dependency intelligence | `dependency_lookup`, dependency audit, provider handoff metadata | Useful after target files are known; slow if broad | Workbench has project/config/package evidence for several ecosystems, not deep dependency API context | Keep local/cache-first dependency evidence and explicit provider handoff | Python import/package metadata and AST scans | Defer as provider-backed feature unless Spec 010 T004 finds it should outrank docs/diagnostics/post-edit work |
| Project/config/conventions | project config resources, execution context, validation surface, service/auth context | Useful for command planning and safety; external commands can be slow | Workbench has repository shape, package manager, Docker/devcontainer and validation policy evidence across several specs | Config should inform routing and validation without hidden command execution | Python service/auth helpers | Continue as resource-backed adapters; avoid public tools for every config view unless primary workflows need them |
| Multi-language support | multi-language design and plan | Clear promotion gates prevent overstating support | Workbench has stronger language-neutral contracts and resource-backed Go/C++/.NET/SAM work | Capability labels, adapter contracts, promotion gates are essential | Python semantic baseline | Keep Workbench direction. Do not copy Agent IDE implementation; use it only for promotion-gate lessons |

## Reconciliation With Active Agent Workbench Specs

### Spec 007: Redaction Boundary Polish

This is still a good active task. It supports the broader predecessor lesson
that output presentation must be trusted, quiet, and precise. It is not a parity
item, but it affects every future docs/diagnostics/post-edit presenter.

### Spec 008: Lambda Result Presentation

This remains useful because Jaeger usage was heavily concentrated in an
AWS/Lambda repository. It turns already-implemented SAM/CloudFormation routing
into more usable results without adding a Python-shaped tool.

### Spec 009: CMake/C++ Routing And Validation

This remains useful because predecessor telemetry and dogfood both exposed
mixed C++/Python weaknesses. The scope is correctly resource-backed and
heuristic; deeper clangd/libclang semantics should stay behind promotion gates.

### Spec 010: Agent IDE Capability Analysis

T001-T003 are now complete for the first pass. T004 should decide which tool or
resource changes are worth planning. The evidence points to docs search/read
surfaces, diagnostics, and post-edit feedback as stronger candidates than broad
orientation or semantic refactor parity.

## Candidate Priority After T003

1. Complete T004 for this spec and choose concrete public-surface
   recommendations.
2. Strongest likely follow-up spec: language-neutral diagnostics and post-edit
   feedback, because this is heavily used in `agent-ide` and only partially
   present in Workbench.
3. Second likely follow-up spec: Markdown docs search/read-section/crosslink
   surfaces, because docs search was repeatedly used and maps well to
   language-neutral adapter contracts.
4. Continue Specs 007-009 as already promoted dogfood-driven implementation
   work.
5. Defer semantic refactor parity, dependency API context, and command
   execution until provider contracts and language promotion gates justify them.

## Open Questions For T004

- Should Workbench add `repo_preflight`, or should `repo:///status` and
  `repo:///overview` be made explicitly equivalent to that workflow?
- Should diagnostics be a standalone public tool, or should diagnostics remain
  inside `verification_plan.static_feedback` until post-edit feedback needs a
  public workflow?
- Should docs search/read-section be MCP tools, resources/templates, or both?
- Should opt-in usage/adoption resources exist, or should telemetry stay only
  in Jaeger/logs for now?
