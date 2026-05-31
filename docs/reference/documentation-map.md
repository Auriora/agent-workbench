---
title: Documentation map
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-05-07
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
| MVP scope and implementation plan | [Agent IDE runtime MVP spec](../specs/001-agent-ide-runtime/spec.md) | Must stay narrower than the concept roadmap. |
| MVP proof gates and fixtures | [MVP proof matrix](mvp-proof-matrix.md) | Owns fixture, budget, degraded-mode, and acceptance evidence. |
| Architectural decisions | [ADRs](../adr/) | ADR status must match frontmatter and body text. |

## Source-Of-Truth Rules

- Do not duplicate enum definitions outside [Runtime contracts](runtime-contracts.md).
- Do not duplicate the language priority table outside [Language capability matrix](language-capability-matrix.md).
- Do not add MVP scope in design docs unless it matches [Agent IDE runtime MVP spec](../specs/001-agent-ide-runtime/spec.md).
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
