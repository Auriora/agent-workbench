---
title: Documentation map
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-06-11
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
| Product principles and VMOST | [Agent Workbench principles](../requirements/agent-workbench-principles.md) | Owns the project vision, mission, objectives, strategy, tactics, scope rules, governance relationship, and guiding principles for building an IDE for coding agents. |
| Product executable backlog | [Agent Workbench executable backlog](../requirements/agent-workbench-executable-backlog.md) | Owns principle-derived backlog items, promotion rules, sequencing, acceptance criteria, and evidence requirements before work becomes an active implementation spec. |
| Layered implementation architecture | [Layered runtime architecture](../design/layered-runtime-architecture.md) | Owns dependency direction, source layout, ports, presenters, policies, boundary-test rules, and current ownership decisions for Markdown helpers, response metadata policy, and telemetry recorder abstractions. |
| Accepted target requirements | [Runtime requirements](../requirements/runtime-requirements.md) | Requirements are target-state until implementation evidence exists. |
| Runtime response envelope, enums, and MCP contract rules | [Runtime contracts](runtime-contracts.md) | Single source for capability, trust, freshness, evidence, attention, edit-token, and error-shape vocabulary. |
| Lifecycle bridge contract | [Lifecycle bridge contract](lifecycle-bridge-contract.md) | Owns the generic boundary between Agent Workbench repo evidence and lifecycle systems such as `ai-spec-lifecycle`, issue trackers, or ad hoc task packets. |
| Dogfood evidence ledger | [Dogfood evidence ledger](dogfood-evidence-ledger.md) | Owns dated real-world product evidence, fallback observations, defects avoided/missed, and follow-up routing. |
| Agent-readable changelog | [Agent-readable changelog](agent-readable-changelog.md) | Owns behavior and contract changes that affect how coding agents should use Workbench. |
| Threat model | [Threat model](../security/threat-model.md) | Owns security assumptions, untrusted-repository boundaries, and security-sensitive follow-up routing. |
| SQLite graph schema and freshness model | [Graph store design](../design/graph-store-design.md) | Owns storage invariants, FTS, rebuilds, and query budgets. |
| Cache, warm-up, and concurrency | [Runtime operations design](../design/runtime-operations-design.md) | Owns cache tiers, invalidation, warm-up, work queues, worker pools, async/snapshot rules, and runtime signals exposed to observability. |
| Observability, Jaeger export, debug harnesses, and profiling | [Observability and debugging design](../design/observability-debugging-design.md) | Owns disabled-by-default OpenTelemetry configuration, OTLP HTTP export, repo-local debug harnesses including the MCP tool sweep, profiler guidance, low-impact monitoring candidates, and usage-record boundaries. Sweep result quality vocabulary is summarized in [Runtime contracts](runtime-contracts.md). |
| Codex Agent Workbench plugin and MCP setup | [Codex Agent Workbench plugin and MCP setup](../runbooks/codex-agent-workbench-plugin.md) | Owns the plugin-bundled Codex MCP, skill, hook, and package installation/update model. |
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
| MVP delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 001 delivery evidence. Current behavior lives in the durable design, reference, requirements, runbook, and ADR docs listed in this map. |
| TimeLocker dogfood delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 002 delivery evidence. Cross-repo follow-up behavior was implemented through later specs and promoted to durable backlog/status sections. |
| Cross-repo dogfood delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 003 delivery evidence for first-call trust, scope visibility, project-shape validation, and first-slice Go/C++ routing evidence. Current behavior lives in durable design/reference docs. |
| Overview ranking delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 004 delivery evidence. Current overview ranking behavior lives in the durable MCP surface design. |
| .NET repository-shape delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 005 delivery evidence. Current .NET generated-output, project metadata, and validation-planning behavior lives in durable design/reference docs. |
| Infrastructure-template routing delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 006 delivery evidence. Current SAM/CloudFormation handler routing and validation-planning behavior lives in durable design docs. |
| Redaction boundary delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 007 delivery evidence. Current presentation redaction behavior lives in [MCP surface design](../design/mcp-surface-design.md) and [Workspace safety contract](workspace-safety-contract.md). |
| Lambda result presentation delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 008 delivery evidence. Current compact Lambda handler grouping behavior lives in [MCP surface design](../design/mcp-surface-design.md) and [Language adapter design](../design/language-adapter-design.md). |
| CMake/C++ routing delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 009 delivery evidence. Current CMake/C++ first-party routing, heuristic edge, CMake target, validation-planning, and semantic-limit behavior lives in [Language adapter design](../design/language-adapter-design.md), [MCP surface design](../design/mcp-surface-design.md), and [Language capability matrix](language-capability-matrix.md). |
| Agent IDE replacement analysis delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 010 delivery evidence. Current replacement capability analysis lives in the durable matrix below; high-priority follow-up work was delivered by later specs. |
| Agent IDE replacement capability matrix | [Agent IDE capability analysis](agent-ide-capability-analysis/agent-ide-capability-analysis-2026-06-05.md) | Durable first-pass analysis of predecessor `agent-ide` capabilities, portable lessons, Python-specific exclusions, and Agent Workbench parity status. |
| Diagnostics and post-edit feedback delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 011 delivery evidence. Current public diagnostics behavior lives in [MCP surface design](../design/mcp-surface-design.md), and quiet hook-facing feedback behavior lives in [Edit and validation loop design](../design/edit-and-validation-loop-design.md) and [Coding agent integration design](../design/coding-agent-integration-design.md). |
| Docs query/read surface delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 012 delivery evidence. Current docs overview, map, search, outline, read-section, budgets, caveats, and deferred crosslink/report criteria live in [MCP surface design](../design/mcp-surface-design.md) and [Markdown document quality design](../design/markdown-document-quality-design.md). |
| FTS-backed docs search delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 013 delivery evidence. Current FTS-backed `docs_search`, docs index storage, ranking, pagination, freshness, degraded-state, and caveat behavior lives in [MCP surface design](../design/mcp-surface-design.md), [Graph store design](../design/graph-store-design.md), and [Runtime operations design](../design/runtime-operations-design.md). |
| TypeScript/JavaScript partial-semantic routing delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 014 delivery evidence. Current JS/TS package-shape routing, parser-backed declaration/import/export extraction, query/context surfaces, validation planning, and deferred semantic limits live in [Language adapter design](../design/language-adapter-design.md), [MCP surface design](../design/mcp-surface-design.md), and [Language capability matrix](language-capability-matrix.md). |
| Go reference and impact promotion delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 015 delivery evidence. Current Go parser-backed partial-semantic extraction, reference lookup, conservative impact, validation-planning safety, and deferred semantic limits live in [Language adapter design](../design/language-adapter-design.md), [MCP surface design](../design/mcp-surface-design.md), and [Language capability matrix](language-capability-matrix.md). |
| SAM/CloudFormation intrinsic routing delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 016 delivery evidence. Current intrinsic/dependency/event-source routing, handler impact, validation-planning behavior, and deferred stack semantics live in [Language adapter design](../design/language-adapter-design.md), [MCP surface design](../design/mcp-surface-design.md), and [Language capability matrix](language-capability-matrix.md). |
| Markdown quality MCP surface delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 017 delivery evidence. Current read-only Markdown quality checker behavior, validation-planning integration, and deferred formatter/report boundaries live in [Markdown document quality design](../design/markdown-document-quality-design.md), [MCP surface design](../design/mcp-surface-design.md), and [Edit and validation loop design](../design/edit-and-validation-loop-design.md). |
| History mining for agent IDE signals delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 018 delivery evidence. Current mining taxonomy, evidence-source decisions, executable backlog routing, and deferred automation boundaries live in [Agent Workbench executable backlog](../requirements/agent-workbench-executable-backlog.md). |
| Integration health and session routing delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 019 delivery evidence. Current integration health, session-aware next-action, and contextual routing behavior lives in [MCP surface design](../design/mcp-surface-design.md), [Coding agent integration design](../design/coding-agent-integration-design.md), and runtime contracts. |
| Brooks-Lint findings tracker delivery record | [Spec closure log](../history/spec-closure-log.md) | Closed Spec 025 delivery evidence. Current architecture boundary rules live in [Layered runtime architecture](../design/layered-runtime-architecture.md), runtime contract module ownership lives in [Runtime contracts](runtime-contracts.md), and test-maintainability gates live in [MVP proof matrix](mvp-proof-matrix.md). |
| Multi-file post-edit repair work | [Multi-file post-edit repair requirements](../specs/020-multi-file-post-edit-repair/requirements.md) | Active Spec 020. Promotes EB005 into quiet multi-file diagnostics, skipped/deferred evidence, and post-edit repair-loop work. |
| Spec task traceability lookup work | [Spec task traceability lookup requirements](../specs/021-spec-task-traceability-lookup/requirements.md) | Active Spec 021. Promotes EB006 into bounded spec/task lookup and task-context integration work while preserving the spec-lifecycle-manager ownership boundary. |
| MCP server repository support work | [MCP server repository support requirements](../specs/022-mcp-server-repository-support/requirements.md) | Active Spec 022. Promotes EB007 into MCP-server repo-shape detection, context routing, and safe validation-planning work. |
| MVP proof gates and fixtures | [MVP proof matrix](mvp-proof-matrix.md) | Owns fixture, budget, degraded-mode, and acceptance evidence. |
| Architectural decisions | [ADRs](../adr/) | ADR status must match frontmatter and body text. |

## Source-Of-Truth Rules

- Do not duplicate enum definitions outside [Runtime contracts](runtime-contracts.md).
- Do not duplicate the language priority table outside [Language capability matrix](language-capability-matrix.md).
- Do not add MVP scope in design docs unless it matches
  [Runtime requirements](../requirements/runtime-requirements.md) and the
  durable design/reference docs listed in this map.
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
- [Lifecycle bridge contract](lifecycle-bridge-contract.md)
- [Dogfood evidence ledger](dogfood-evidence-ledger.md)
- [Agent-readable changelog](agent-readable-changelog.md)
- [Threat model](../security/threat-model.md)
- [Workspace safety contract](workspace-safety-contract.md)
- [MVP proof matrix](mvp-proof-matrix.md)
- [Native dependency setup](../runbooks/native-dependency-setup.md)
- [Observability and debugging design](../design/observability-debugging-design.md)
