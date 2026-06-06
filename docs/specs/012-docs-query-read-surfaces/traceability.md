---
title: Docs query and read surfaces traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Traceability Matrix

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Durable Targets | Verification |
| --- | --- | --- | --- | --- | --- |
| T001 | Requirement 1, Requirement 2, Requirement 3 | Requirement 1 AC1-AC3; Requirement 2 AC1-AC2; Requirement 3 AC1-AC3 | `design.md#high-level-design`, `design.md#operational-considerations` | docs query fixtures and focused docs fixture tests | `verification.md#evidence-log` |
| T002 | Requirement 1, Requirement 2, Requirement 3 | Requirement 1 AC1-AC3; Requirement 2 AC1-AC3; Requirement 3 AC1-AC3 | `design.md#high-level-design`, `design.md#low-level-design` | docs query contracts and application use cases | `verification.md#evidence-log` |
| T003 | Requirement 1, Requirement 2, Requirement 3 | Requirement 1 AC1-AC3; Requirement 2 AC1-AC3; Requirement 3 AC1-AC3 | `design.md#high-level-design`, `design.md#low-level-design` | docs presenters | `verification.md#evidence-log` |
| T004 | Requirement 1, Requirement 2, Requirement 3 | Requirement 1 AC1-AC3; Requirement 2 AC1-AC3; Requirement 3 AC1-AC3 | `design.md#low-level-design`, `design.md#operational-considerations` | MCP resources, tools, templates, and registry metadata | `verification.md#evidence-log` |
| T005 | Requirement 4 | Requirement 4 AC1-AC2 | `design.md#overview`, `design.md#operational-considerations` | `docs/design/mcp-surface-design.md`, `docs/design/markdown-document-quality-design.md`, `docs/reference/documentation-map.md` | `verification.md#evidence-log` |
| T006 | Requirement 4 | Requirement 4 AC1-AC2 | `design.md#operational-considerations` | closure record and archived spec package | `verification.md#quality-gates` |

## Requirement To Delivery Matrix

| Requirement | Acceptance Criteria | Tasks | Durable Targets |
| --- | --- | --- | --- |
| Requirement 1: Docs Overview And Map Resources | AC1, AC2, AC3 | T001, T002, T003, T004 | docs fixtures, docs overview/map contracts, MCP resources |
| Requirement 2: Docs Search | AC1, AC2, AC3 | T001, T002, T003, T004 | docs search contract, presenter, MCP tool |
| Requirement 3: Docs Outline And Read Section | AC1, AC2, AC3 | T001, T002, T003, T004 | docs outline/read-section contracts, presenter, MCP tools or templates |
| Requirement 4: Durable Promotion | AC1, AC2 | T005, T006 | durable MCP and Markdown docs plus closure record |

## Design To Implementation Matrix

| Design Section | Requirements | Tasks | Interfaces Or Files | Verification |
| --- | --- | --- | --- | --- |
| `design.md#overview` | Requirements 1-4 | T001-T006 | docs query/read surfaces and durable docs | spec lint and closure checks |
| `design.md#high-level-design` | Requirements 1, 2, 3 | T001, T002, T003 | docs index provider, query use cases, presenters | focused docs tests |
| `design.md#low-level-design` | Requirements 1, 2, 3 | T002, T003, T004 | public resources/tools/templates and schemas | contract and MCP tests |
| `design.md#operational-considerations` | Requirements 1, 2, 3, 4 | T001, T004, T005, T006 | budgets, warnings, skipped docs behavior, durable docs | docs fixture tests and final gates |

## Open Decision Impact

| Decision ID | Resolution Needed | Affected Requirements | Affected Tasks |
| --- | --- | --- | --- |
| OD-001 outline/read-section surface type | Decide whether `docs_outline` and `docs_read_section` are tools, resource templates, or both. | Requirement 3 | T004 |
| OD-002 snippet payload policy | Decide whether initial search snippets include safe source text or only heading/path metadata until redaction work is complete. | Requirement 2 | T002, T003 |
