---
title: Git submodule repository support change impact
doc_type: spec
artifact_type: change-impact
status: draft
owner: platform
last_reviewed: 2026-08-04
---

# Change Impact

## Purpose

Record the implementation and durable-authority changes required to admit
declared initialized Git submodules into a selected superproject's bounded
read-only scope without an additional prompt.

## Durable Source Mapping

| Source | Current behavior relied on | Required disposition |
|--------|----------------------------|----------------------|
| `docs/reference/workspace-safety-contract.md` | All nested Git repositories are skipped for reads and refused for writes. | Add the narrow declared-submodule read exception; retain unrelated and write refusals. |
| `docs/security/threat-model.md` | Workspace input, repository boundaries, process execution, network, and secrets are untrusted. | Add `.gitmodules`, gitlink, Git-dir, recursive composition, URL, and mutation controls. |
| `docs/reference/runtime-contracts.md` | Owns public snapshot, status, provenance, blocking, and validation shapes. | Add repository composition, qualified claims, and bounded provenance. |
| `docs/design/layered-runtime-architecture.md` | Ports isolate application logic from filesystem/process adapters. | Add the repository-composition use case and semantic Git metadata port. |
| `docs/design/graph-store-design.md` | Owns SQLite snapshot schema and validity. | Add normalized repository units, migration, prefix resolution, and fingerprint. |
| `docs/design/edit-and-validation-loop-design.md` | Owns planning-only validation and blocked outcomes. | Add repository-local Spec 057 planning and explicit aggregation rules. |
| `docs/backlog/README.md` | EB004 and Spec 057 route validation evidence; Spec 057 leaves initialized submodules unavailable. | Link Spec 058 and reconcile the delivered residual at promotion. |

## Change Type

- **Primary type:** feature and safety-contract clarification
- **Breaking change:** no; public fields are additive, but aggregate claims may
  become more conservative and accurate
- **Durable docs required:** yes
- **Schema migration required:** yes
- **External behavior affected:** yes

## Proposed Changes

| Change | Type | Promotion required |
|--------|------|--------------------|
| Parent-authorized read of declared initialized submodules | modify | workspace safety and threat model |
| Fixed bounded local Git metadata port and shared runner | add/modify | architecture, runtime contracts, threat model |
| Recursive repository-composition discovery and state vocabulary | add | architecture and runtime contracts |
| Federated catalog paths under one parent-relative namespace | add | workspace safety and runtime contracts |
| Normalized snapshot repository units and composition fingerprint | add | graph-store design and runtime contracts |
| Repository-qualified graph/docs/context/status evidence | add | runtime contracts |
| Repository-local Spec 057 validation candidates | add | validation design and runtime contracts |
| Remote access, submodule mutation, target execution, unrelated nested reads | unchanged | document as prohibited/non-goals |

## Compatibility Details

- Existing superproject-relative evidence paths remain valid.
- Repository composition and repository references are additive and bounded.
- Existing callers that do not request or consume submodule-aware claims may
  continue to use old snapshots; submodule-complete claims require a current
  composition receipt.
- The scanner keeps its skip-all behavior when no admitted composition receipt
  is supplied. This is the safe policy default, not a runtime fallback route.
- Aggregate `clean`, `fresh`, `ready`, or `planned` may become blocked/unknown
  when a requested child lacks evidence; that is an intentional truthfulness
  correction.
- `GitHistoryAdapter` must share the hardened runner rather than preserving an
  unbounded compatibility path.

## Security and Operational Impact

- `.gitmodules` is untrusted input. Only contained path declarations matter;
  URLs and update configuration are ignored and excluded from output/logging.
- Git process calls are local, fixed, structured, prompt-free, optionally
  lock-free, cancellable, time/byte bounded, and redacted.
- No hooks, remote helpers, package managers, build scripts, or submodule helper
  commands execute.
- Canonical worktree/Git-dir containment and cycle detection are mandatory.
- Composition inspection occurs during snapshot creation/freshness checks, not
  on every query; telemetry excludes absolute paths and source/command output.

## Promotion Targets

| Content | Durable destination | Status |
|---------|---------------------|--------|
| Declared-submodule read authority and unchanged write refusal | `docs/reference/workspace-safety-contract.md` | pending T013 |
| Threats and command/network/mutation controls | `docs/security/threat-model.md` | pending T013 |
| Repository composition and public claim vocabulary | `docs/reference/runtime-contracts.md` | pending T013 |
| Use-case/port/adapter ownership | `docs/design/layered-runtime-architecture.md` | pending T013 |
| Composition table, migration, prefix lookup, freshness fingerprint | `docs/design/graph-store-design.md` | pending T013 |
| Per-repository project-unit planning and aggregation | `docs/design/edit-and-validation-loop-design.md` | pending T013 |
| EB004/Spec 057 residual reconciliation | `docs/backlog/README.md` | pending T013 |
| Active Spec 057 supersession boundary | `docs/specs/057-nested-project-unit-validation-evidence/` or its closure record when already closed | pending T013 |

## Unchanged Durable Areas

| Area | Reason unchanged |
|------|------------------|
| Language extraction/semantics | No parser, grammar, AST, LSP, compiler, or semantic capability is added. |
| Edit/apply authority | Submodule writes remain refused. |
| Remote maintenance | Clone, fetch, init, update, sync, repair, and remote comparison remain unavailable. |
| Target validation execution | Plans remain `not_executed`. |
| Worktrees/subtrees/vendor copies | They are different repository-composition models and remain out of scope. |

## Open Decisions

- D001: T001 chooses the smallest additive contract and confirms whether the
  existing shared command abstraction is evolved in place. The outcome is
  constrained to one hardened runner with no fallback.
- D002: Numeric schema version and exact migration naming are implementation
  details resolved in T008 without changing the normalized model.

## Related Artifacts

- Requirements: `requirements.md`
- Canonical Context: `canonical-context.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
