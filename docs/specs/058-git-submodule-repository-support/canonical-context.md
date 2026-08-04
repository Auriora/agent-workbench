---
title: Git submodule repository support canonical context
doc_type: spec
artifact_type: canonical-context
status: draft
owner: platform
last_reviewed: 2026-08-04
---

# Canonical Context

## Purpose

This package needs explicit authority because accepted Spec 058 behavior creates
a narrow read-only exception to the current durable rule that skips every
nested Git repository. The exception applies only to submodules declared and
pinned by the selected repository lineage. It does not weaken containment,
write refusal, network policy, or the refusal of unrelated nested checkouts.

## Authority Hierarchy

The spec-local context is canonical only for this active implementation slice.
It does not override system, developer, user, repository instructions,
governance, security, privacy, generated contracts, source-code contracts,
tests, or live evidence. When current source differs from this accepted design,
the difference is implementation work, not evidence that the existing skip-all
behavior should be retained through a fallback route.

## Always-Canonical External Sources

| Source | Authority reason | Handling |
|--------|------------------|----------|
| `AGENTS.md` | Repository implementation, validation, fallback, and safety instructions | Read before every task and keep adapters layered. |
| User direction dated 2026-08-04 | Declared submodules of the selected project do not require separate permission for read-only support | Preserve as Requirement 1; do not reintroduce per-submodule prompts. |
| `docs/reference/workspace-safety-contract.md` | Durable containment, write, command, network, and capability policy | Superseded only for declared initialized submodule read admission; all other rules remain binding. |
| `docs/security/threat-model.md` | Durable threat and trust boundaries | Update before closure to cover the accepted exception. |
| source code, tests, generated contracts, and live evidence | Current implementation truth | Reconcile conflicts; do not treat current skip-all behavior as accepted final behavior. |

## Spec-Canonical Working Sources

| Source | Role | Scope | Notes |
|--------|------|-------|-------|
| `requirements.md` | Accepted intent | Spec 058 | Parent selection authorizes bounded read-only declared-submodule traversal. |
| `design.md` | Implementation approach | Spec 058 | Owns inventory, identity, recursion, Git evidence, safety, and integration decisions. |
| `tasks.md` | Execution index | Spec 058 | Do not implement from tasks alone. |
| `traceability.md` | Coverage map | Spec 058 | Must remain synchronized with requirement and task changes. |
| `verification.md` | Evidence and closure gates | Spec 058 | Target commands remain non-executed. |

## Imported Sources

| Spec path | Source path | Source revision or date | Status | Canonical scope | Promotion target |
|-----------|-------------|-------------------------|--------|-----------------|------------------|
| `canonical-context.md` | `docs/reference/workspace-safety-contract.md` | reviewed 2026-08-04 | supersedes | Declared, gitlink-backed, initialized submodules may be read within selected parent scope; unrelated nested repositories and all writes remain refused. | `docs/reference/workspace-safety-contract.md` |
| `canonical-context.md` | `docs/specs/057-nested-project-unit-validation-evidence/` | active package reviewed 2026-08-04 | adapted | Spec 057 remains current for non-traversal until Spec 058 is implemented. T009 requires Spec 057 T001-T009 complete and verified; T013 then records that Spec 058 supersedes only the initialized-submodule residual. Spec 057 remains authoritative for project-unit discovery and validation isolation. | Spec 057 package or closure record, durable promotion targets, and current validation design |
| `canonical-context.md` | `docs/backlog/README.md` EB004 | reviewed 2026-08-04 | summarized | Validation candidates remain evidence-backed, structured, and non-executed per repository. | `docs/backlog/README.md` |
| `canonical-context.md` | `docs/reference/runtime-contracts.md` | reviewed 2026-08-04 | summarized | Public status, claim, blocker, next-action, path, and redaction vocabularies remain canonical unless explicitly extended. | `docs/reference/runtime-contracts.md` |

## Accepted Exception Matrix

| Situation | Read source? | Read Git metadata? | Write or initialize? | Network? | Required result |
|-----------|--------------|--------------------|----------------------|----------|-----------------|
| Declared, gitlink-backed, initialized submodule | yes, bounded | yes, bounded and read-only | no | no | Per-repository evidence without a separate permission prompt |
| Declared but uninitialized submodule | no source available | declaration and pin only | no | no | Structured unavailable state |
| Revision-mismatched initialized submodule | yes, labeled local revision | yes | no | no | Block pinned-composition claims |
| Orphan gitlink or declaration without gitlink | no traversal | bounded inconsistency evidence | no | no | Structured blocked state |
| Unrelated nested Git checkout | no | no beyond classification | no | no | Existing `nested_git_repository` refusal |
| Escaping or malformed submodule path/Git-dir | no | bounded failure only | no | no | Workspace-safety blocker |

## Non-Canonical Background Sources

| Source | Reason non-canonical | Handling |
|--------|----------------------|----------|
| Real repositories with pinned dependencies, detached submodule `HEAD`, nested submodules, or stale gitlinks | Useful scenario evidence but repository-specific | Translate only into generic fixture cases; do not copy branch, remote, or maintenance workflows. |
| `.gitmodules` URLs | Untrusted and unnecessary for local read discovery | Do not emit, follow, validate remotely, or use as identity. |
| Remote branch tips | Outside local-first pinned-composition scope | Do not query or compare. |

## Promotion Map

| Spec-local content | Durable destination or route | Required before closure |
|--------------------|------------------------------|-------------------------|
| Declared-submodule read exception | `docs/reference/workspace-safety-contract.md` | yes |
| Submodule threat and command boundaries | `docs/security/threat-model.md` | yes |
| Repository/submodule public evidence | `docs/reference/runtime-contracts.md` | yes |
| Per-repository validation behavior | `docs/design/edit-and-validation-loop-design.md` | yes |
| Repository-composition port and layer ownership | `docs/design/layered-runtime-architecture.md` if changed | yes or explicit unchanged rationale |
| Delivered backlog state | `docs/backlog/README.md` | yes |

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Change Impact: `change-impact.md`
- Verification: `verification.md`
