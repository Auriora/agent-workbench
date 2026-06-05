---
title: Agent IDE runtime MVP research
doc_type: spec
status: archived
owner: platform
last_reviewed: 2026-06-05
---

# Research

## Question

Which ideas from the existing `agent-ide` proof of concept and current local
runtime design work should shape the restart?

## Findings

- `agent-ide` proves the runtime-first model: long-lived repo MCP runtime,
  background indexing, compact resources, edit feedback, validation routing, and
  trust/freshness metadata.
- `agent-ide` also proves why the restart must not be Python-shaped at the
  runtime core. Python remains the first proof path for direct comparison, but
  graph records, adapter outputs, context ranking, validation planning,
  capability metadata, and MCP contracts must be language-, framework-, and
  platform-neutral from the beginning.
- `agent-ide` also shows a key failure mode: compact output can hide broad work,
  causing latency and pushing agents back to direct file reads.
- The latest `agent-ide` Jaeger review in
  `/home/bcherrington/Projects/Auriora/agent-ide/docs/performance-findings-2026-05-06.md`
  shows actual retained usage concentrated around first-pass planning, docs,
  diagnostics/lint, verification, and post-apply feedback. In the retained
  window, top-level MCP calls were led by `context_for_task`, `docs_search`,
  `diagnostics_for_files`, `repo_preflight`, `lint_changed_files`, and
  `verification_plan`, while `find_symbol`, `find_runtime_path`, and reference
  style navigation were rarely invoked. Internal spans were dominated by
  `post_apply_patch_feedback`, docs indexing/search, diagnostics,
  `context_for_task`, and `verification_plan`.
- That usage pattern means the restart should make status/scope,
  `context_for_task`, docs/config routing evidence, validation planning, and
  post-edit safety semantics excellent before expanding the public surface. It
  also means symbol/reference tools should be advertised as executable next
  calls from first-pass context rather than relying on agents to discover and
  choose them unaided.
- The same performance review shows that `context_for_task`, validation, docs
  search, dependency audit, and topology paths became slow when they invoked
  broad orientation APIs, repeated freshness scans, JSON cache work, or full
  topology construction inside compact/default calls. The restart should build
  hot paths directly on targeted SQLite queries and snapshot metadata from the
  beginning.
- The runtime should use deterministic local code-intelligence building blocks:
  tree-sitter extraction, SQLite graph storage, FTS, reference resolution,
  traversal, file watching, and targeted MCP tools.
- Knowledge-oriented reporting should remain an explicit orientation layer with
  confidence labels, ambiguous evidence, gaps, suggested questions, and
  generated reports rather than hidden work inside compact calls.

## Sources

- Existing PoC: `/home/bcherrington/Projects/Auriora/agent-ide`
- Agent IDE performance and usage review:
  `/home/bcherrington/Projects/Auriora/agent-ide/docs/performance-findings-2026-05-06.md`

## Recommendation

Start with a TypeScript local-first runtime that uses deterministic local graph
evidence, keeps Agent IDE's edit/validation semantics, and treats knowledge
reports as an explicit orientation layer.

The first implementation should prioritize the workflow agents actually used
most in the PoC: fast status/scope, bounded task context, docs/config routing,
planned validation, and post-edit safety. Symbol, reference, and impact tools
remain MVP surfaces, but their adoption should be driven by precise
`next_action` guidance from context and validation responses. Broad topology,
usage analytics, diagnostics execution, docs reports, and post-apply hooks are
post-MVP unless fixture evidence shows they are required for the first trusted
loop.

The core restart recommendation is not "rewrite the Python IDE in TypeScript."
It is to build a language-neutral local runtime where Python is only the first
fixture-backed adapter. Platform evidence such as package managers, test
systems, CI, containers, infrastructure templates, frontend frameworks, and
project files should enter through adapter and validation-provider contracts,
not through Python-specific assumptions.
