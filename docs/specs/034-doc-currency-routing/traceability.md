---
title: Doc currency routing traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-07-02
---

# Traceability

## Task To Context Matrix

| Task | Requirements | Design Sections | Durable Targets | Verification |
| --- | --- | --- | --- | --- |
| T001 | Requirement 1, Requirement 2, Requirement 3 | Currency Signal Model | Runtime contracts if public fields change | Policy and contract tests for P1, P2, P3 |
| T002 | Requirement 2 | Frontmatter Parsing | Markdown quality design if parser behavior changes | Frontmatter fixture tests |
| T003 | Requirement 1, Requirement 2, Requirement 4 | Task Context Integration, Docs Search And Overview Integration | Documentation map | Documentation-map owner lookup tests for P1, P2 |
| T004 | Requirement 3 | Git History Evidence | Graph store design | Git evidence port tests for P3, P4 |
| T005 | Requirement 1, Requirement 2, Requirement 4 | Task Context Integration | MCP surface design | `context_for_task` tests for P1, P2 |
| T006 | Requirement 1, Requirement 3, Requirement 4 | Docs Search And Overview Integration | MCP surface design, graph store design | Docs search and docs map tests for P1, P4, P5 |
| T007 | Requirement 5 | Agent Verification Workflow | Coding agent integration design if packaged as skill | Prompt/tool contract tests |
| T008 | Requirement 6 | Spec-Lifecycle-Manager Feedback | External plugin handoff | Handoff review |
| T009 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6 | Operational Considerations | MCP surface, graph store, runtime contracts, documentation map | Markdown review |
| T010 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6 | All | Closure docs/backlog route | `pnpm typecheck`, targeted tests for P1-P5 |

## Requirement To Delivery Matrix

| Requirement | Delivery Tasks | Validation |
| --- | --- | --- |
| Requirement 1 Task-focused document currency | T001, T003, T005, T006 | Ranking and caveat tests |
| Requirement 2 Frontmatter and path signals are inputs | T002, T003, T005, T006 | Frontmatter/path conflict fixtures |
| Requirement 3 Recency evidence uses reliable sources | T001, T004, T006 | No-`ctime` code search, Git unavailable tests |
| Requirement 4 Historical discoverability is preserved | T003, T006 | Historical query regression tests |
| Requirement 5 Agent guidance or prompt surface | T007 | Skill/prompt or MCP contract validation |
| Requirement 6 Lifecycle feedback boundary | T008, T009 | Handoff and durable-doc review |

## Design To Implementation Matrix

| Design Area | Tasks | Notes |
| --- | --- | --- |
| Currency signal model | T001 | Establishes shared states, caveats, and contract impact before surface work. |
| Frontmatter parsing | T002 | Supplies metadata input signals without making frontmatter authoritative by itself. |
| Documentation-map owner lookup | T003 | Makes current-source ownership explicit and prevents incidental matches from winning. |
| Git history evidence | T004 | Optional enrichment; must stay non-blocking and avoid `ctime`. |
| Task context integration | T005 | Applies currency ranking to governing docs for implementation prompts. |
| Docs search and overview integration | T006 | Applies consistent metadata and caveats across docs routing surfaces. |
| Agent verification workflow | T007 | Provides the "which docs are current for this task" workflow. |
| Spec-lifecycle-manager feedback | T008 | Keeps lifecycle-rule ownership outside Agent Workbench. |
| Durable documentation | T009 | Promotes accepted behavior into current-state docs. |
| Validation and closure readiness | T010 | Confirms tests, docs, and evidence before closure. |

## Open Decision Impact

- If the verifier ships first as a skill/prompt, T006 implementation lives in
  packaging/plugin docs and the MCP tool is a follow-up.
- If the verifier ships as an MCP tool, T006 must include contracts, registry
  metadata, and presenter tests.
- If `superseded` becomes a public `doc_status`, T001 and T005 must update
  contract schemas and golden fixtures.
