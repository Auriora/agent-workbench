---
title: Diagnostics and post-edit feedback traceability
doc_type: spec
artifact_type: traceability
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Traceability Matrix

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Durable Targets | Verification |
| --- | --- | --- | --- | --- | --- |
| T001 | Requirement 1, Requirement 2, Requirement 3 | Requirement 1 AC1-AC4; Requirement 2 AC1-AC4; Requirement 3 AC2, AC4 | `design.md#high-level-design`, `design.md#operational-considerations` | diagnostics and hook fixtures | `verification.md#evidence-log` |
| T002 | Requirement 1 | Requirement 1 AC1-AC4 | `design.md#low-level-design` | `src/contracts/runtime-contracts.ts`, `src/ports/index.ts` | `verification.md#evidence-log` |
| T003 | Requirement 1, Requirement 2 | Requirement 1 AC1-AC4; Requirement 2 AC1-AC4 | `design.md#high-level-design`, `design.md#low-level-design` | `src/application/use-cases/diagnose-changed-files.ts`, `src/presentation/diagnostics-presenter.ts` | `verification.md#evidence-log` |
| T004 | Requirement 2 | Requirement 2 AC1-AC4 | `design.md#low-level-design`, `design.md#operational-considerations` | `docs/design/mcp-surface-design.md`, MCP registry and profile metadata | `verification.md#evidence-log` |
| T005 | Requirement 3 | Requirement 3 AC1-AC4 | `design.md#high-level-design`, `design.md#low-level-design` | `docs/design/edit-and-validation-loop-design.md`, `docs/design/coding-agent-integration-design.md`, post-edit feedback use case, Codex hook wrapper | `verification.md#evidence-log` |
| T006 | Requirement 4 | Requirement 4 AC1-AC2 | `design.md#overview`, `design.md#operational-considerations` | `docs/design/edit-and-validation-loop-design.md`, `docs/design/mcp-surface-design.md`, `docs/design/coding-agent-integration-design.md` | `verification.md#evidence-log` |
| T007 | Requirement 4 | Requirement 4 AC1-AC2 | `design.md#operational-considerations` | `docs/specs/011-diagnostics-post-edit-feedback/verification.md` | `verification.md#quality-gates` |

## Requirement To Delivery Matrix

| Requirement | Acceptance Criteria | Tasks | Durable Targets |
| --- | --- | --- | --- |
| Requirement 1: Normalized Diagnostics Providers | AC1, AC2, AC3, AC4 | T001, T002, T003 | diagnostics contracts, provider port, diagnostics presenter, `docs/design/edit-and-validation-loop-design.md` |
| Requirement 2: Changed-File Diagnostics Surface | AC1, AC2, AC3, AC4 | T001, T003, T004 | `diagnostics_for_files` MCP tool, MCP registry/profile metadata, `docs/design/mcp-surface-design.md` |
| Requirement 3: Post-Edit Feedback Surface | AC1, AC2, AC3, AC4 | T001, T005 | internal post-edit feedback use case, presenter, Codex hook wrapper, integration design docs |
| Requirement 4: Durable Promotion | AC1, AC2 | T006, T007 | durable design docs, verification closure record |

## Design To Implementation Matrix

| Design Section | Requirements | Tasks | Interfaces Or Files | Verification |
| --- | --- | --- | --- | --- |
| `design.md#overview` | Requirements 1-4 | T001-T007 | diagnostics use case, post-edit feedback use case, durable design docs | `verification.md#evidence-log` |
| `design.md#high-level-design` | Requirements 1, 2, 3 | T001, T003, T005 | provider contracts, diagnostics use case, post-edit feedback use case, hook adapter | focused diagnostics and feedback tests |
| `design.md#low-level-design` | Requirements 1, 2, 3 | T002, T004, T005 | runtime contracts, MCP registry, presenters | contract, MCP, and presenter tests |
| `design.md#operational-considerations` | Requirements 2, 3, 4 | T004, T005, T006, T007 | bounded diagnostics, quiet hook behavior, durable docs | full test suite, spec lint, docs metadata test |

## Open Decision Impact

| Decision ID | Resolution | Affected Requirements | Affected Tasks | Durable Record |
| --- | --- | --- | --- | --- |
| OD-001 public diagnostics surface | Expose `diagnostics_for_files` as the compact public MCP diagnostics surface. | Requirement 2 | T004 | `docs/design/mcp-surface-design.md` |
| OD-002 public post-edit feedback surface | Keep `post_edit_feedback` internal and hook-facing; use `diagnostics_for_files` and `verification_plan` for public workflow. | Requirement 3 | T005, T006 | `docs/design/edit-and-validation-loop-design.md`, `docs/design/coding-agent-integration-design.md` |

## Closure Notes

- `diagnostics_for_files` is the public diagnostics MCP surface.
- `post_edit_feedback` remains internal and hook-facing; no public MCP tool was
  added.
- Remaining provider expansion belongs to future provider specs or backlog
  items, not this closed package.
