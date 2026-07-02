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
| T001 | R1, R2, R3, P1, P2, P3 | Currency Signal Model | Runtime contracts if public fields change | Policy and contract tests |
| T002 | R2 | Frontmatter Parsing | Markdown quality design if parser behavior changes | Frontmatter fixture tests |
| T003 | R3, P3, P4 | Git History Evidence | Graph store design | Git evidence port tests |
| T004 | R1, R2, P1, P2 | Task Context Integration | MCP surface design | `context_for_task` tests |
| T005 | R1, R3, R4, P1, P4, P5 | Docs Search And Overview Integration | MCP surface design, graph store design | Docs search and docs map tests |
| T006 | R5 | Agent Verification Workflow | Coding agent integration design if packaged as skill | Prompt/tool contract tests |
| T007 | R6 | Spec-Lifecycle-Manager Feedback | External plugin handoff | Handoff review |
| T008 | R1-R6 | Operational Considerations | MCP surface, graph store, runtime contracts, documentation map | Markdown review |
| T009 | R1-R6, P1-P5 | All | Closure docs/backlog route | `pnpm typecheck`, targeted tests |

## Requirement To Delivery Matrix

| Requirement | Delivery Tasks | Validation |
| --- | --- | --- |
| R1 Task-focused document currency | T001, T004, T005 | Ranking and caveat tests |
| R2 Frontmatter and path signals are inputs | T002, T004, T005 | Frontmatter/path conflict fixtures |
| R3 Recency evidence uses reliable sources | T001, T003, T005 | No-`ctime` code search, Git unavailable tests |
| R4 Historical discoverability is preserved | T005 | Historical query regression tests |
| R5 Agent guidance or prompt surface | T006 | Skill/prompt or MCP contract validation |
| R6 Lifecycle feedback boundary | T007, T008 | Handoff and durable-doc review |

## Open Decision Impact

- If the verifier ships first as a skill/prompt, T006 implementation lives in
  packaging/plugin docs and the MCP tool is a follow-up.
- If the verifier ships as an MCP tool, T006 must include contracts, registry
  metadata, and presenter tests.
- If `superseded` becomes a public `doc_status`, T001 and T005 must update
  contract schemas and golden fixtures.
