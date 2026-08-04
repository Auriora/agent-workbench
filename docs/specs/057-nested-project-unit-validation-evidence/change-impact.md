---
title: Nested project-unit validation evidence change impact
doc_type: spec
artifact_type: change-impact
status: draft
owner: platform
last_reviewed: 2026-08-04
---

# Change Impact

## Purpose

Record the implementation and durable-document impact of changing validation
planning from aggregate checkout-wide ecosystem evidence to selected-scope,
per-project-unit evidence. This artifact also fixes the boundary between safe
submodule awareness in Spec 057 and future cross-repository support.

## Durable Source Mapping

| Source | Current behavior relied on | Confidence | Notes |
|--------|----------------------------|------------|-------|
| `docs/backlog/README.md` | EB004 owns policy-aware, repository-backed validation planning and blocked outcomes. | high | Add nested-unit acceptance and a separate submodule follow-up before closure. |
| `docs/reference/runtime-contracts.md` | Owns public validation plan shapes and status vocabulary. | high | Update if structured unit provenance becomes public. |
| `docs/design/edit-and-validation-loop-design.md` | Owns validation-planning workflow and execution boundary. | high | Promote selected-scope and claim-separation behavior here. |
| `docs/design/language-adapter-design.md` | Separates ecosystem routing from language semantics. | high | No semantic promotion is authorized. |
| `docs/reference/language-capability-matrix.md` | Owns capability-level claims by language. | high | Clarify unchanged capability levels after implementation. |
| `docs/design/layered-runtime-architecture.md` | Owns layer and port responsibilities. | high | No change expected if the design is followed. |
| `docs/security/threat-model.md` | Owns untrusted workspace and execution risks. | medium | Update only if current text does not cover script/config reads and repository boundaries. |

## Change Type

- **Primary type:** feature
- **Breaking change:** no
- **Durable docs required:** yes
- **External behavior affected:** yes

## Proposed Changes

| Change | Type | Source of truth | New durable destination | Promotion required |
|--------|------|-----------------|-------------------------|-------------------|
| Discover validation units around selected files/subtrees | add | EB004 | `docs/design/edit-and-validation-loop-design.md` | yes |
| Recognize `.csproj`, `pom.xml`, `Cargo.toml`, and positively evidenced extensionless scripts | add | EB004 and language adapter design | validation design; capability matrix clarification | yes |
| Expose bounded unit provenance/readiness/blockers | add | runtime validation contracts | `docs/reference/runtime-contracts.md` | yes if public contract changes |
| Preserve source evidence while blocking Git cleanliness claims | clarify | repository status and validation design | `docs/design/edit-and-validation-loop-design.md`; runtime contracts if public | yes |
| Detect submodule paths as non-traversed repository boundaries | add | workspace safety and validation design | validation design and conditional security update | yes |
| Route initialized traversal and cross-repository submodule planning | add | Spec 057 residual boundary | `docs/backlog/README.md` new backlog item | yes |
| Execute target commands or add fallbacks | unchanged | existing command-safety and validation contracts | none | no; prohibited |

## Promotion Targets

| Spec content | Durable destination | Promotion status | Notes |
|--------------|---------------------|------------------|-------|
| Selected-scope unit discovery and per-unit planning | `docs/design/edit-and-validation-loop-design.md` | pending | Describe current delivered behavior only after tests pass. |
| Public project-unit evidence and blockers | `docs/reference/runtime-contracts.md` | pending | Promote exact implemented schema, not provisional design names. |
| EB004 nested-unit acceptance | `docs/backlog/README.md` | pending | Mark the delivered slice and residual ecosystem limits. |
| Full submodule repository-boundary support | `docs/backlog/README.md` | pending | One new item must cover explicit scope, identity, recursion, network/credentials, per-repo policy and cleanliness. |
| Unchanged language semantic levels | `docs/reference/language-capability-matrix.md` | pending | Validation evidence does not prove C#, Java, or Rust semantics. |
| Script and repository-boundary threats | `docs/security/threat-model.md` | review pending | Modify only when existing coverage is insufficient. |

## Unchanged Durable Areas

| Durable area | Reviewed source | Reason unchanged |
|--------------|-----------------|------------------|
| layer ownership | `docs/design/layered-runtime-architecture.md` | Discovery remains in application/domain code and adapters remain thin. |
| language extraction | `docs/design/language-adapter-design.md` | No parser, AST, LSP, compiler, or semantic behavior is added. |
| command execution | `docs/reference/runtime-contracts.md` and command-safety policy | Candidates remain planned and `not_executed`; no runner is introduced. |
| graph storage | `docs/design/graph-store-design.md` | No persisted graph schema or migration is planned. |
| installation | native dependency runbook and package manifests | No toolchain, build-system, or Git dependency is installed. |

## Compatibility Details

- Existing callers continue receiving the flat `planned_commands` array.
- Any new `project_units` field is additive and optional unless T001 proves the
  current compatibility rules require a versioned alternative.
- The flat list is derived only from ready selected units and cannot preserve a
  legacy first-project or unrelated-sibling fallback.
- Aggregate `blocked` status may become more accurate for mixed scopes; this is
  an intentional truthfulness improvement, not a success-shape compatibility
  guarantee.
- Existing ecosystem planners must accept unit-scoped evidence without creating
  parallel old/new implementation routes.

## Security and Operational Impact

- Extensionless build scripts are read as bounded evidence only and are never
  executed or imported.
- `.gitmodules` parsing consumes local path declarations only; URLs are not
  followed, emitted, logged, or needed for selection.
- Repository-boundary evidence narrows authority. It does not expand the repo
  root or allow reads outside it.
- Broken Git metadata is a claim-specific degradation: file reads may proceed,
  but cleanliness, diff completeness, and comparisons are blocked.
- Output bounds must cover units, markers, blocker evidence, and flat commands.

## Open Questions

- D001: Exact additive contract shape, resolved in T001 against current runtime
  compatibility rules.
- D002: Existing repository-status seam versus one new narrow read-only port,
  resolved before T006 implementation.
- D003: Numeric backlog ID and title for full submodule support, assigned during
  T012 promotion.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
