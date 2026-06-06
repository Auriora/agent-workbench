---
title: Documentation map
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-06-06
---

# Documentation Map

## Purpose

Name the canonical document for each major Agent IDE runtime concern so the docs
do not drift or repeat contract details.

## How To Use This Map

Use the canonical owner for detailed changes. Other documents may summarize the
same idea, but they should link back here or to the canonical owner rather than
copying tables, schemas, or enum definitions.

## Canonical Owners

| Concern | Canonical owner | Notes |
| --- | --- | --- |
| Product narrative and source-project rationale | [Agent IDE restart concept](../design/agent-ide-restart-concept.md) | Narrative only; not the contract source of truth. |
| System shape and component boundaries | [System architecture](../architecture/system-architecture.md) | Keep high-level and avoid schema detail. |
| Layered implementation architecture | [Layered runtime architecture](../design/layered-runtime-architecture.md) | Owns dependency direction, source layout, ports, presenters, policies, and boundary-test rules. |
| Accepted target requirements | [Runtime requirements](../requirements/runtime-requirements.md) | Requirements are target-state until implementation evidence exists. |
| Runtime response envelope, enums, and MCP contract rules | [Runtime contracts](runtime-contracts.md) | Single source for capability, trust, freshness, evidence, attention, edit-token, and error-shape vocabulary. |
| SQLite graph schema and freshness model | [Graph store design](../design/graph-store-design.md) | Owns storage invariants, FTS, rebuilds, and query budgets. |
| Cache, warm-up, and concurrency | [Runtime operations design](../design/runtime-operations-design.md) | Owns cache tiers, invalidation, warm-up, work queues, worker pools, async/snapshot rules, and runtime signals exposed to observability. |
| Observability, Jaeger export, debug harnesses, and profiling | [Observability and debugging design](../design/observability-debugging-design.md) | Owns disabled-by-default OpenTelemetry configuration, OTLP HTTP export, repo-local debug harnesses, profiler guidance, low-impact monitoring candidates, and usage-record boundaries. |
| Codex Agent Workbench plugin and MCP setup | [Codex Agent Workbench plugin and MCP setup](../runbooks/codex-agent-workbench-plugin.md) | Owns the local Codex host-level MCP setup and skill-only plugin installation/update model. |
| Adapter capability model and promotion gates | [Language adapter design](../design/language-adapter-design.md) | Owns adapter lifecycle and semantic promotion rules. |
| Language priority table | [Language capability matrix](language-capability-matrix.md) | Reference view only; uses enums from runtime contracts. |
| MCP resources and tools | [MCP surface design](../design/mcp-surface-design.md) | Owns MVP/non-MVP tool split and schema examples through runtime contracts. |
| Coding-agent integrations | [Coding agent integration design](../design/coding-agent-integration-design.md) | Owns Codex, Claude Code, Kiro, Augment, Gemini, Junie, MCP, skills, hooks, commands, plugins, extensions, and ACP integration guidance. |
| Markdown document quality | [Markdown document quality design](../design/markdown-document-quality-design.md) | Owns Markdown structure checks, compliance linting, link checks, table readability, and formatter preview/apply rules. |
| Workspace safety policy | [Workspace safety contract](workspace-safety-contract.md) | Owns path containment, command execution, redaction, network, and generated-write rules. |
| Native dependency setup and tree-sitter rebuilds | [Native dependency setup](../runbooks/native-dependency-setup.md) | Owns install/rebuild troubleshooting for native Node bindings. |
| Edit preview/apply/rollback behavior | [Edit and validation loop design](../design/edit-and-validation-loop-design.md) | Owns bounded mutation workflow; schema vocabulary comes from runtime contracts. |
| Attention lifecycle and ranking | [Attention layer design](../design/attention-layer-design.md) | Owns minimal blocker/warning behavior; full workflow guidance is post-MVP. |
| Knowledge reports and graph communities | [Knowledge layer design](../design/knowledge-layer-design.md) | Post-MVP unless explicitly reduced to cheap persisted summaries. |
| MVP delivery record | [Agent IDE runtime MVP requirements](../specs/001-agent-ide-runtime/requirements.md) | Archived Spec 001 delivery evidence. Current behavior lives in the durable design, reference, requirements, runbook, and ADR docs listed in this map. |
| TimeLocker dogfood delivery record | [TimeLocker dogfood follow-up requirements](../specs/002-timelocker-dogfood-followups/requirements.md) | Archived Spec 002 delivery evidence. Cross-repo follow-up behavior was implemented through Spec 003 and promoted to durable backlog/status sections. |
| Cross-repo dogfood delivery record | [Cross-repo trust and discovery requirements](../specs/003-cross-repo-trust-discovery/requirements.md) | Archived Spec 003 delivery evidence for first-call trust, scope visibility, project-shape validation, and first-slice Go/C++ routing evidence. Current behavior lives in durable design/reference docs. |
| Overview ranking delivery record | [Overview ranking polish requirements](../specs/004-overview-ranking-polish/requirements.md) | Archived Spec 004 delivery evidence. Current overview ranking behavior lives in the durable MCP surface design. |
| .NET repository-shape delivery record | [.NET repository shape hardening requirements](../specs/005-dotnet-repository-shape-hardening/requirements.md) | Archived Spec 005 delivery evidence. Current .NET generated-output, project metadata, and validation-planning behavior lives in durable design/reference docs. |
| Infrastructure-template routing delivery record | [Infrastructure template routing requirements](../specs/006-infra-template-routing/requirements.md) | Archived Spec 006 delivery evidence. Current SAM/CloudFormation handler routing and validation-planning behavior lives in durable design docs. |
| Redaction boundary delivery record | [Redaction boundary polish requirements](../specs/007-redaction-boundary-polish/requirements.md) | Archived Spec 007 delivery evidence. Current presentation redaction behavior lives in [MCP surface design](../design/mcp-surface-design.md) and [Workspace safety contract](workspace-safety-contract.md). |
| Lambda result presentation delivery record | [Lambda result presentation requirements](../specs/008-lambda-result-presentation/requirements.md) | Archived Spec 008 delivery evidence. Current compact Lambda handler grouping behavior lives in [MCP surface design](../design/mcp-surface-design.md) and [Language adapter design](../design/language-adapter-design.md). |
| CMake/C++ routing delivery record | [CMake C++ routing and validation requirements](../specs/009-cmake-cpp-routing-validation/requirements.md) | Archived Spec 009 delivery evidence. Current CMake/C++ first-party routing, heuristic edge, CMake target, validation-planning, and semantic-limit behavior lives in [Language adapter design](../design/language-adapter-design.md), [MCP surface design](../design/mcp-surface-design.md), and [Language capability matrix](language-capability-matrix.md). |
| Agent IDE replacement analysis delivery record | [Agent IDE capability analysis requirements](../specs/010-agent-ide-capability-analysis/requirements.md) | Archived Spec 010 delivery evidence. Current replacement capability analysis lives in the durable matrix below; high-priority follow-up work was delivered by archived Specs 011, 012, and 013. |
| Agent IDE replacement capability matrix | [Agent IDE capability analysis](agent-ide-capability-analysis/agent-ide-capability-analysis-2026-06-05.md) | Durable first-pass analysis of predecessor `agent-ide` capabilities, portable lessons, Python-specific exclusions, and Agent Workbench parity status. |
| Diagnostics and post-edit feedback delivery record | [Diagnostics and post-edit feedback requirements](../specs/011-diagnostics-post-edit-feedback/requirements.md) | Archived Spec 011 delivery evidence. Current public diagnostics behavior lives in [MCP surface design](../design/mcp-surface-design.md), and quiet hook-facing feedback behavior lives in [Edit and validation loop design](../design/edit-and-validation-loop-design.md) and [Coding agent integration design](../design/coding-agent-integration-design.md). |
| Docs query/read surface delivery record | [Docs query and read surfaces requirements](../specs/012-docs-query-read-surfaces/requirements.md) | Archived Spec 012 delivery evidence. Current docs overview, map, search, outline, read-section, budgets, caveats, and deferred crosslink/report criteria live in [MCP surface design](../design/mcp-surface-design.md) and [Markdown document quality design](../design/markdown-document-quality-design.md). |
| FTS-backed docs search delivery record | [FTS-backed docs search requirements](../specs/013-fts-backed-docs-search/requirements.md) | Archived Spec 013 delivery evidence. Current FTS-backed `docs_search`, docs index storage, ranking, pagination, freshness, degraded-state, and caveat behavior lives in [MCP surface design](../design/mcp-surface-design.md), [Graph store design](../design/graph-store-design.md), and [Runtime operations design](../design/runtime-operations-design.md). |
| TypeScript/JavaScript partial-semantic routing work | [TypeScript/JavaScript partial-semantic routing requirements](../specs/014-typescript-javascript-partial-semantic-routing/requirements.md) | Active Spec 014. Promotes the language-priority backlog for JS/TS package, import/export, route/component, and nearest-test routing without compiler or LSP dependency. |
| Go reference and impact promotion work | [Go reference and impact promotion requirements](../specs/015-go-reference-impact-promotion/requirements.md) | Active Spec 015. Promotes the Go backlog from routing-only declarations toward parser-backed references, confidence labels, impact evidence, and safer validation planning. |
| SAM/CloudFormation intrinsic routing work | [SAM CloudFormation intrinsic routing requirements](../specs/016-sam-cloudformation-intrinsic-routing/requirements.md) | Active Spec 016. Promotes the infrastructure backlog for intrinsic functions, event-source edges, template-to-handler routing, and validation planning without executing AWS or SAM commands. |
| Markdown quality MCP surface work | [Markdown quality MCP surface requirements](../specs/017-markdown-quality-mcp-surface/requirements.md) | Active Spec 017. Promotes the post-MVP Markdown quality backlog into bounded read-only check tools before formatter or generated-report work. |
| MVP proof gates and fixtures | [MVP proof matrix](mvp-proof-matrix.md) | Owns fixture, budget, degraded-mode, and acceptance evidence. |
| Architectural decisions | [ADRs](../adr/) | ADR status must match frontmatter and body text. |

## Source-Of-Truth Rules

- Do not duplicate enum definitions outside [Runtime contracts](runtime-contracts.md).
- Do not duplicate the language priority table outside [Language capability matrix](language-capability-matrix.md).
- Do not add MVP scope in design docs unless it matches [Agent IDE runtime MVP requirements](../specs/001-agent-ide-runtime/requirements.md).
- Do not add graph storage requirements outside [Graph store design](../design/graph-store-design.md) unless they are summarized requirements.
- Do not add observability configuration, Jaeger export rules, repo-local
  debug harness rules, or profiler guidance outside
  [Observability and debugging design](../design/observability-debugging-design.md).
- Do not change source layout, dependency direction, port ownership, or
  presentation ownership outside [Layered runtime architecture](../design/layered-runtime-architecture.md).
- Do not make vendor-specific coding-agent plugin, hook, command, rules,
  steering, guidelines, extension, or ACP formats authoritative runtime
  contracts. Summarize them through
  [Coding agent integration design](../design/coding-agent-integration-design.md).
- Do not add Markdown document-quality rules or formatter behavior outside
  [Markdown document quality design](../design/markdown-document-quality-design.md).
- Keep generated reports and usage analytics out of MVP docs unless explicitly listed in the MVP spec.

## Related Docs

- [Runtime contracts](runtime-contracts.md)
- [Workspace safety contract](workspace-safety-contract.md)
- [MVP proof matrix](mvp-proof-matrix.md)
- [Native dependency setup](../runbooks/native-dependency-setup.md)
- [Observability and debugging design](../design/observability-debugging-design.md)
