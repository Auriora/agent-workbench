---
title: Documentation map
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-07-21
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Documentation Map

## Purpose

Name the canonical document for each major Agent IDE runtime concern so the docs
do not drift or repeat contract details.

## How To Use This Map

Use the canonical owner for detailed changes. Other documents may summarize the
same idea, but they should link back here or to the canonical owner rather than
copying tables, schemas, or enum definitions.

The `Concern` label is always an exact intent term. `Intent terms` adds only the
explicit semicolon-delimited aliases maintained by this map; the runtime does
not derive synonyms. One concern may name several owner links and one document
may own several concerns. Multiple owners are valid by themselves. Owner state
comes from the mapped document: a draft remains draft, archived or superseded
content remains non-governing, a missing target is retained as missing evidence,
and conflict exists only when that document's `canonical_owner` frontmatter
names another path. Changes to concern labels, aliases, or owner links therefore
require a coordinated graph snapshot rebuild before ranked documentation search
uses them.

## Canonical Owners

| Concern | Canonical owner | Intent terms | Notes |
| --- | --- | --- | --- |
| Product narrative and source-project rationale | [Agent IDE restart concept](../design/agent-ide-restart-concept.md) |  | Narrative only; not the contract source of truth. |
| System shape and component boundaries | [System architecture](../architecture/system-architecture.md) |  | Keep high-level and avoid schema detail. |
| Product principles and VMOST | [Agent Workbench principles](../requirements/agent-workbench-principles.md) |  | Owns the project vision, mission, objectives, strategy, tactics, scope rules, governance relationship, and guiding principles for building an IDE for coding agents. |
| Layered implementation architecture | [Layered runtime architecture](../design/layered-runtime-architecture.md) |  | Owns dependency direction, source layout, ports, presenters, policies, boundary-test rules, and current ownership decisions for Markdown helpers, response metadata policy, and telemetry recorder abstractions. |
| Accepted target requirements | [Runtime requirements](../requirements/runtime-requirements.md) |  | Requirements are target-state until implementation evidence exists. |
| Runtime response envelope, enums, and MCP contract rules | [Runtime contracts](runtime-contracts.md) | runtime contracts; response envelope; MCP contract | Single source for capability, trust, freshness, evidence, attention, edit-token, and error-shape vocabulary. |
| Lifecycle bridge contract | [Lifecycle bridge contract](lifecycle-bridge-contract.md) |  | Owns the generic boundary between Agent Workbench repo evidence and lifecycle systems such as `ai-spec-lifecycle`, issue trackers, or ad hoc task packets. |
| Dogfood evidence ledger | [Dogfood evidence ledger](dogfood-evidence-ledger.md) |  | Owns dated real-world product evidence, fallback observations, defects avoided/missed, and follow-up routing. |
| Agent-readable changelog | [Agent-readable changelog](agent-readable-changelog.md) |  | Owns behavior and contract changes that affect how coding agents should use Workbench. |
| Threat model | [Threat model](../security/threat-model.md) |  | Owns security assumptions, untrusted-repository boundaries, and security-sensitive follow-up routing. |
| SQLite graph schema and freshness model | [Graph store design](../design/graph-store-design.md) | graph schema; SQLite schema | Owns storage invariants, FTS, rebuilds, and query budgets. |
| Cache, warm-up, and concurrency | [Runtime operations design](../design/runtime-operations-design.md) |  | Owns cache tiers, invalidation, warm-up, work queues, worker pools, async/snapshot rules, and runtime signals exposed to observability. |
| Observability, trace export, debug harnesses, and profiling | [Observability and debugging design](../design/observability-debugging-design.md) |  | Owns disabled-by-default trace configuration, OTLP HTTP export, repo-local debug harnesses including the MCP tool sweep, profiler guidance, low-impact monitoring candidates, and usage-record boundaries. Sweep result quality vocabulary is summarized in [Runtime contracts](runtime-contracts.md). |
| Codex plugin | [Runbook](../runbooks/codex-agent-workbench-plugin.md) |  | Setup. |
| Adapter capability model and promotion gates | [Language adapter design](../design/language-adapter-design.md) |  | Owns adapter lifecycle and semantic promotion rules. |
| Language priority table | [Language capability matrix](language-capability-matrix.md) |  | Reference view only; uses enums from runtime contracts. |
| MCP resources and tools | [MCP surface design](../design/mcp-surface-design.md) |  | Owns MVP/non-MVP tool split and schema examples through runtime contracts. |
| Trust calibration response metadata | [Runtime contracts](runtime-contracts.md) and [MCP surface design](../design/mcp-surface-design.md) |  | Runtime contracts own `meta.trust` vocabulary and failure-state semantics; MCP surface design owns public surface policy routing and presenter boundaries. |
| Coding-agent integrations | [Coding agent integration design](../design/coding-agent-integration-design.md) | SessionStart; codex; kiro; agent hooks; hook parity | Owns Codex, Claude Code, Kiro, Augment, Gemini, Junie, MCP, skills, hooks, commands, plugins, extensions, and ACP integration guidance. Agent Skills packaging compliance for checked-in Agent Workbench skills is validated by `pnpm run validate:skills` and summarized in the plugin runbook. |
| Markdown document quality | [Markdown document quality design](../design/markdown-document-quality-design.md) |  | Owns Markdown structure checks, compliance linting, link checks, table readability, and formatter preview/apply rules. |
| Workspace safety policy | [Workspace safety contract](workspace-safety-contract.md) |  | Owns path containment, command execution, redaction, network, and generated-write rules. |
| Native dependency setup and tree-sitter rebuilds | [Native dependency setup](../runbooks/native-dependency-setup.md) |  | Owns install/rebuild troubleshooting for native Node bindings. |
| Developer CLI workflows | [Agent Workbench Dev CLI](../../tools/devcli/README.md) |  | Owns `awb` install, command groups, mutation boundaries, and CLI test command. Package/plugin runbooks remain authoritative for underlying install and registration commands. |
| Release notes workflow | [Agent Workbench Dev CLI](../../tools/devcli/README.md) and [Codex Agent Workbench plugin runbook](../runbooks/codex-agent-workbench-plugin.md) |  | Own `awb release notes`, evidence sidecars, draft/final boundary, release-note skill guidance, and tag-driven publishing flow. Agent-visible behavior changes live in [Agent-readable changelog](agent-readable-changelog.md). |
| Edit preview/apply/rollback behavior | [Edit and validation loop design](../design/edit-and-validation-loop-design.md) |  | Owns bounded mutation workflow; schema vocabulary comes from runtime contracts. |
| Attention lifecycle and ranking | [Attention layer design](../design/attention-layer-design.md) |  | Owns minimal blocker/warning behavior; full workflow guidance is post-MVP. |
| Knowledge reports and graph communities | [Knowledge layer design](../design/knowledge-layer-design.md) |  | Post-MVP unless explicitly reduced to cheap persisted summaries. |
| MVP delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 001 delivery evidence. Current behavior lives in the durable design, reference, requirements, runbook, and ADR docs listed in this map. |
| Early dogfood delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 002 delivery evidence. Cross-repo follow-up behavior was implemented through later specs and promoted to durable backlog/status sections. |
| Cross-repo dogfood delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 003 delivery evidence for first-call trust, scope visibility, project-shape validation, and first-slice Go/C++ routing evidence. Current behavior lives in durable design/reference docs. |
| Overview ranking delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 004 delivery evidence. Current overview ranking behavior lives in the durable MCP surface design. |
| .NET repository-shape delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 005 delivery evidence. Current .NET generated-output, project metadata, and validation-planning behavior lives in durable design/reference docs. |
| Infrastructure-template routing delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 006 delivery evidence. Current SAM/CloudFormation handler routing and validation-planning behavior lives in durable design docs. |
| Redaction boundary delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 007 delivery evidence. Current presentation redaction behavior lives in [MCP surface design](../design/mcp-surface-design.md) and [Workspace safety contract](workspace-safety-contract.md). |
| Lambda result presentation delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 008 delivery evidence. Current compact Lambda handler grouping behavior lives in [MCP surface design](../design/mcp-surface-design.md) and [Language adapter design](../design/language-adapter-design.md). |
| CMake/C++ routing delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 009 delivery evidence. Current CMake/C++ first-party routing, heuristic edge, CMake target, validation-planning, and semantic-limit behavior lives in [Language adapter design](../design/language-adapter-design.md), [MCP surface design](../design/mcp-surface-design.md), and [Language capability matrix](language-capability-matrix.md). |
| Agent IDE replacement analysis delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 010 delivery evidence. Current replacement capability analysis lives in the durable matrix below; high-priority follow-up work was delivered by later specs. |
| Diagnostics and post-edit feedback delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 011 delivery evidence. Current public diagnostics behavior lives in [MCP surface design](../design/mcp-surface-design.md), and quiet hook-facing feedback behavior lives in [Edit and validation loop design](../design/edit-and-validation-loop-design.md) and [Coding agent integration design](../design/coding-agent-integration-design.md). |
| Docs query/read surface delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 012 delivery evidence. Current docs overview, map, search, outline, read-section, budgets, caveats, and deferred crosslink/report criteria live in [MCP surface design](../design/mcp-surface-design.md) and [Markdown document quality design](../design/markdown-document-quality-design.md). |
| FTS-backed docs search and currency routing | [MCP surface design](../design/mcp-surface-design.md) | docs search; documentation intent; documentation ranking; count semantics | Owns current exact concern resolution, relevance-before-authority ranking, bounded FTS-plus-owner union, frozen pagination, recovery, direct-read, and lifecycle behavior. Schema-v3 concern/ranked-universe storage and count retrieval live in [Graph store design](../design/graph-store-design.md); public hit, score, count/filter, cursor, failure, trust, and compatibility fields live in [Runtime contracts](runtime-contracts.md). |
| TypeScript/JavaScript partial-semantic routing delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 014 delivery evidence. Current JS/TS package-shape routing, parser-backed declaration/import/export extraction, query/context surfaces, validation planning, and deferred semantic limits live in [Language adapter design](../design/language-adapter-design.md), [MCP surface design](../design/mcp-surface-design.md), and [Language capability matrix](language-capability-matrix.md). |
| Go reference and impact promotion delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 015 delivery evidence. Current Go parser-backed partial-semantic extraction, reference lookup, conservative impact, validation-planning safety, and deferred semantic limits live in [Language adapter design](../design/language-adapter-design.md), [MCP surface design](../design/mcp-surface-design.md), and [Language capability matrix](language-capability-matrix.md). |
| SAM/CloudFormation intrinsic routing delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 016 delivery evidence. Current intrinsic/dependency/event-source routing, handler impact, validation-planning behavior, and deferred stack semantics live in [Language adapter design](../design/language-adapter-design.md), [MCP surface design](../design/mcp-surface-design.md), and [Language capability matrix](language-capability-matrix.md). |
| Markdown quality MCP surface delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 017 delivery evidence. Current read-only Markdown quality checker behavior, validation-planning integration, and deferred formatter/report boundaries live in [Markdown document quality design](../design/markdown-document-quality-design.md), [MCP surface design](../design/mcp-surface-design.md), and [Edit and validation loop design](../design/edit-and-validation-loop-design.md). |
| History mining for agent IDE signals delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 018 delivery evidence. Current mining taxonomy, evidence-source decisions, backlog routing, and deferred automation boundaries live in [Agent Workbench backlog](../backlog/README.md). |
| Integration health and session routing delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 019 delivery evidence. Current integration health, session-aware next-action, and contextual routing behavior lives in [MCP surface design](../design/mcp-surface-design.md), [Coding agent integration design](../design/coding-agent-integration-design.md), and runtime contracts. |
| Brooks-Lint findings tracker delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 025 delivery evidence. Current architecture boundary rules live in [Layered runtime architecture](../design/layered-runtime-architecture.md), runtime contract module ownership lives in [Runtime contracts](runtime-contracts.md), and test-maintainability gates live in [MVP proof matrix](mvp-proof-matrix.md). |
| Multi-file post-edit repair delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 020 delivery evidence. Current quiet multi-file diagnostics, skipped/deferred evidence, post-edit repair-loop outcomes, hook behavior, and telemetry behavior live in [Edit and validation loop design](../design/edit-and-validation-loop-design.md), [Coding agent integration design](../design/coding-agent-integration-design.md), and [Runtime contracts](runtime-contracts.md). |
| Spec task traceability lookup delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 021 delivery evidence. Current spec/task lifecycle evidence behavior lives in [Runtime contracts](runtime-contracts.md), [MCP surface design](../design/mcp-surface-design.md), [Coding agent integration design](../design/coding-agent-integration-design.md), and packaged Agent Workbench skill/Power guidance. |
| MCP server repository support delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 022 delivery evidence. Current MCP-server repo-shape detection, context routing, and safe validation-planning behavior lives in [MCP surface design](../design/mcp-surface-design.md) and [Coding agent integration design](../design/coding-agent-integration-design.md). |
| Agent Skills compliance delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 026 delivery evidence. Current checked-in skill validation lives in `scripts/validate-agent-skills.mjs`, CI, the plugin README, and the plugin runbook. |
| Workspace watcher ignore sync delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 027 delivery evidence. Current shared ignore policy, watcher queue, stale-rescan scheduling, hook routing, and watcher freshness behavior live in [Runtime operations design](../design/runtime-operations-design.md), [Runtime contracts](runtime-contracts.md), [Graph store design](../design/graph-store-design.md), and [Workspace safety contract](workspace-safety-contract.md). |
| Developer CLI workflow delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 028 delivery evidence. Current `awb` command groups, package/local install wrappers, plugin refresh/status, MCP smoke, cache inspect, spec wrappers, doctor, and release preflight behavior live in [Agent Workbench Dev CLI](../../tools/devcli/README.md), [tools README](../../tools/README.md), and the plugin install runbooks. |
| Release notes generation delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 034 release-note generation evidence. Current evidence generation, LLM/human refinement boundary, validation-note inputs, and reusable release-note guidance live in [Agent Workbench Dev CLI](../../tools/devcli/README.md), [Codex Agent Workbench plugin runbook](../runbooks/codex-agent-workbench-plugin.md), and [Agent-readable changelog](agent-readable-changelog.md). |
| Repo-root authority delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 029 delivery evidence. Current launch-root authority, debug-only root override gate, public `repo_root` metadata hiding, and integration-health root policy behavior live in [Workspace safety contract](workspace-safety-contract.md), [MCP surface design](../design/mcp-surface-design.md), [Runtime contracts](runtime-contracts.md), and [Threat model](../security/threat-model.md). |
| MCP error envelope consistency delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 030 delivery evidence. Current MCP failure-class vocabulary lives in [Runtime contracts](runtime-contracts.md), shared handler-wrapper expectations live in [MCP surface design](../design/mcp-surface-design.md), and representative registry behavior is covered by MCP error-envelope tests. |
| Cross-platform packaging delivery record | [Spec closure log](../history/spec-closure-log.md) |  | Closed Spec 033 delivery evidence. Current npm package install, platform matrix, plugin launch, hook, and native dependency guidance lives in [Codex Agent Workbench plugin runbook](../runbooks/codex-agent-workbench-plugin.md), [packaging README](../../packaging/agent-workbench/README.md), and [Native dependency setup](../runbooks/native-dependency-setup.md). Remaining launcher and native-install work is routed to the backlog. |
| MVP proof gates and fixtures | [MVP proof matrix](mvp-proof-matrix.md) |  | Owns fixture, budget, degraded-mode, and acceptance evidence. |

The [Agent Workbench backlog](../backlog/README.md) remains the durable owner of
principle-derived backlog items, promotion rules, sequencing, acceptance
criteria, and evidence requirements. It is temporarily navigation-only in this
map because the production concern classifier currently rejects mapped owner
files over 120,000 bytes. Active Spec 044 must restore its machine-readable
canonical-owner entry through bounded metadata classification before closure;
raising an arbitrary whole-file limit is not the accepted repair.

The `docs/adr/` collection, navigable from
[ADR 0001](../adr/0001-local-first-repo-runtime.md), is not one canonical owner
document. Individual ADRs govern their recorded decisions, and each ADR's
status must match its frontmatter and body text. Do not add a directory link to
the canonical-owner table: the ranked documentation concern index requires
owner destinations to be files.

## Plugin Discoverability Notes

The plugin runbook owns operator guidance for `context_for_task`,
`verification_plan`, `integration:///profiles/codex`, and
`integration:///health/agent-workbench`.

The plugin README owns quick start, verification, update, uninstall, and first
resource guidance for `repo:///status`, `repo:///scope`, and `repo:///overview`.

The server-card metadata at `.well-known/mcp/server-card.json` owns local
machine-readable discoverability for public MCP resources and tools, including
`codex-integration-profile` and `integration-health`.

The CI workflow at `.github/workflows/ci.yml` owns automated typecheck, test,
plugin/package validation, owned Agent Skills validation, installer dry-run,
and npm package dry-run gates.

## Source-Of-Truth Rules

- Do not duplicate enum definitions outside [Runtime contracts](runtime-contracts.md).
- Do not duplicate the language priority table outside [Language capability matrix](language-capability-matrix.md).
- Do not add MVP scope in design docs unless it matches
  [Runtime requirements](../requirements/runtime-requirements.md) and the
  durable design/reference docs listed in this map.
- Do not add graph storage requirements outside [Graph store design](../design/graph-store-design.md) unless they are summarized requirements.
- Do not add observability configuration, trace export rules, repo-local
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
