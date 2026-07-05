---
title: Trust calibration in tool outputs traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability Matrix

## Purpose

Map Spec 035 implementation tasks to requirements, design sections, correctness
properties, verification expectations, and durable promotion targets. Before
implementing a task, read that task row and the linked requirement and design
sections.

## Task To Context Matrix

### T001 Reconcile Resolved Requirements Open Questions

- Requirements: R1, R2, R4, CP007.
- Acceptance criteria: R1 AC7; R2 AC1-AC2; R4 AC1-AC7.
- Design sections: Decisions D001-D004; Open Questions.
- Change impact: durable active-spec consistency.
- Verification: spec lint and Markdown quality check.
- Durable targets: none directly; clears implementation readiness.
- Open decisions: OQ001-OQ003 resolved by D001-D003.

### T002 Confirm Public Surface Inventory

- Requirements: R1, R2, R4, R5, CP005.
- Acceptance criteria: R1 AC1; R2 AC4; R4 AC1-AC7; R5 AC2.
- Design sections: D003; Components; Data Flow By Tool Family.
- Change impact: MCP registry metadata and test coverage.
- Verification: registry inventory review and early T011 coverage tests.
- Durable targets: `docs/design/mcp-surface-design.md`.
- Open decisions: none.

### T003 Add Trust Calibration Contract Schemas

- Requirements: R1, R3, R5, CP004, CP007.
- Acceptance criteria: R1 AC2-AC3 and AC7; R5 AC1 and AC7.
- Design sections: Data Model; Contract Schemas.
- Change impact: `src/contracts/runtime-response-contracts.ts`.
- Verification: contract schema tests.
- Durable targets: `docs/reference/runtime-contracts.md`.
- Open decisions: contract version bump only if strict consumer evidence
  appears.

### T004 Implement Shared Trust Policy

- Requirements: R1, R2, R3, R5, CP001, CP002, CP003, CP006.
- Acceptance criteria: R1 AC4-AC6; R2 AC1-AC3 and AC5; R3 AC1-AC5; R5 AC3-AC6.
- Design sections: Policy Inputs; Policy Matrix; Derivation Algorithm.
- Change impact: `src/application/use-cases/response-metadata.ts`.
- Verification: response metadata helper tests.
- Durable targets: `docs/reference/runtime-contracts.md`.
- Open decisions: none.

### T005 Add Final Trusted-Envelope Integration Point

- Requirements: R1, R2, R5, CP006, CP007.
- Acceptance criteria: R1 AC3, AC6, AC7; R2 AC1-AC2; R5 AC6-AC7.
- Design sections: Architecture; Metadata Helper Changes; Error Handling.
- Change impact: shared envelope construction and error presenters.
- Verification: tests proving warnings and errors affect trust.
- Durable targets: `docs/reference/runtime-contracts.md`,
  `docs/design/mcp-surface-design.md`.
- Open decisions: none. Public standard-envelope surfaces must use
  `makeTrustedEnvelope`; `buildResponseMeta` remains a base metadata helper.

### T006 Contract And Policy Checkpoint

- Requirements: R1, R2, R3, R5, CP001-CP004, CP006-CP007.
- Acceptance criteria: all contract and shared-policy acceptance criteria.
- Design sections: Contract Schemas; Metadata Helper Changes; Derivation
  Algorithm.
- Change impact: validates source contract before presenter wiring.
- Verification: focused contract Vitest command.
- Durable targets: none directly.
- Open decisions: strict consumer evidence, if any.

### T007 Repository And Integration Resource Presenters

- Requirements: R1, R2, R4, R5, CP001, CP005, CP006.
- Acceptance criteria: R1 AC1, AC4-AC6; R2 AC1-AC4; R4 AC7; R5 AC2-AC6.
- Design sections: Routing-Only Evidence; Error/Warning Failure State; Data
  Flow By Tool Family.
- Change impact: status, scope, overview, integration health, profile
  presenters.
- Verification: repo status/scope/overview and integration health tests.
- Durable targets: `docs/design/mcp-surface-design.md`.
- Open decisions: none.

### T008 Docs And Markdown Quality Presenters

- Requirements: R1, R2, R3, R4, R5, CP001, CP003, CP005, CP006.
- Acceptance criteria: R1 AC1, AC4-AC6; R2 AC1-AC4; R3 AC1 and AC3; R4 AC2;
  R5 AC2-AC6.
- Design sections: Routing-Only Evidence; Direct Docs Or Source Read; Static
  Diagnostics And Markdown Quality; Data Flow By Tool Family.
- Change impact: docs presenter, Markdown quality presenter, `docs_scope`.
- Verification: docs presenter, Markdown quality, and docs MCP tests.
- Durable targets: `docs/design/mcp-surface-design.md`.
- Open decisions: none.

### T009 Graph, Diagnostics, Validation, And Edit Presenters

- Requirements: R1, R2, R3, R4, R5, CP001, CP002, CP003, CP005, CP006.
- Acceptance criteria: R1 AC1, AC4-AC6; R2 AC1-AC4; R3 AC1-AC5; R4 AC1 and
  AC3-AC6; R5 AC2-AC6.
- Design sections: Parser-Backed Or Partial-Semantic Graph Evidence; Planned
  Validation; Edit Preview; Applied Edit Result; Data Flow By Tool Family.
- Change impact: context, graph, diagnostics, post-edit, verification plan,
  and workspace edit presenters.
- Verification: focused MCP tool tests for these surface families.
- Durable targets: `docs/design/mcp-surface-design.md`.
- Open decisions: no executed-validation surface is added in this spec.

### T010 Presenter Validation Checkpoint

- Requirements: R1-R5, CP001-CP003, CP005-CP006.
- Acceptance criteria: all presenter coverage acceptance criteria.
- Design sections: Test Strategy.
- Change impact: validates presenter family wiring.
- Verification: focused docs, MCP, feedback, and edit tests.
- Durable targets: none directly.
- Open decisions: any public-surface exclusion must be resolved or routed.

### T011 Public Surface Policy Coverage Tests

- Requirements: R1, R2, R5, CP005.
- Acceptance criteria: R1 AC1; R2 AC4; R5 AC2.
- Design sections: Components; Data Flow By Tool Family; Test Strategy.
- Change impact: registry metadata test coverage.
- Verification: `tests/mcp/registry-metadata.test.ts` before presenter wiring
  begins.
- Durable targets: none directly.
- Open decisions: none.

### T012 Golden Response Trust Tests

- Requirements: R3, R4, R5, CP001, CP002, CP003, CP006.
- Acceptance criteria: R3 AC1-AC5; R4 AC1-AC7; R5 AC2-AC6.
- Design sections: Policy Matrix; Data Flow By Tool Family; Test Strategy.
- Change impact: MCP and docs golden tests.
- Verification: representative golden response tests.
- Durable targets: none directly.
- Open decisions: none.

### T013 Registry And Golden Validation Checkpoint

- Requirements: R5, CP001, CP002, CP003, CP005, CP006.
- Acceptance criteria: R5 AC1-AC6.
- Design sections: Test Strategy.
- Change impact: validation before durable promotion.
- Verification: focused contract, registry, and golden tests.
- Durable targets: none directly.
- Open decisions: none.

### T014 Durable Documentation Promotion

- Requirements: R1-R5, CP004, CP007.
- Acceptance criteria: R1 AC1-AC7; R2 AC1-AC5; R3 AC1-AC5; R4 AC1-AC7; R5
  AC7.
- Design sections: Operational Considerations; Requirements Trace.
- Change impact: runtime contracts, MCP surface design, documentation map, and
  backlog status.
- Verification: docs link/metadata tests and Markdown quality checks.
- Durable targets: `docs/reference/runtime-contracts.md`,
  `docs/design/mcp-surface-design.md`, `docs/reference/documentation-map.md`,
  `docs/backlog/README.md`.
- Open decisions: none.

### T015 Full Validation And Implementation Review

- Requirements: R1-R5, CP001-CP007.
- Acceptance criteria: all acceptance criteria.
- Design sections: Test Strategy; Operational Considerations.
- Change impact: release and closure readiness.
- Verification: `pnpm typecheck`, `pnpm test`, docs tests, spec lint,
  Markdown quality, and diff whitespace.
- Durable targets: implementation review evidence and any routed follow-up.
- Open decisions: any review findings must be fixed, rejected with rationale,
  or routed.

### T016 Closure Package

- Requirements: R5, CP005, CP007.
- Acceptance criteria: durable promotion and closure success criteria.
- Design sections: Operational Considerations.
- Change impact: closure log, archive index, and active package removal.
- Verification: spec closure check after durable promotion.
- Durable targets: `docs/history/spec-closure-log.md`,
  `docs/history/spec-archive-index.md`.
- Open decisions: none.

## Requirement To Delivery Matrix

- R1 Central Trust Calibration Contract: delivered by T003, T004, T005, T007,
  T008, T009, T011, T012, and T014. Coverage state: planned.
- R2 Shared Generation Policy: delivered by T004, T005, T007, T008, T009, and
  T011. Coverage state: planned.
- R3 Evidence Distinctions Stay Explicit: delivered by T004, T008, T009, T012,
  and T014. Coverage state: planned.
- R4 Major Tool Family Coverage: delivered by T002, T007, T008, T009, T011,
  T012, and T014. Coverage state: planned.
- R5 Contract And Golden Test Coverage: delivered by T003, T006, T010, T011,
  T012, T013, and T015. Coverage state: planned.

## Correctness Property Coverage

- CP001 Routing Is Not Proof: T004, T007, T008, T009, T012, T013.
- CP002 Planned Is Not Executed: T004, T009, T012, T013.
- CP003 Direct-Read Scope Is Bounded: T004, T008, T009, T012, T013.
- CP004 Capability Vocabulary Is Stable: T003, T006, T014, T015.
- CP005 Shared Policy Covers Public Surfaces: T002, T007, T008, T009, T011,
  T013.
- CP006 Failure States Cannot Be Proof: T004, T005, T007, T008, T009, T012,
  T013.
- CP007 Additive Compatibility: T001, T003, T005, T014, T015.

## Design To Implementation Matrix

- Decisions D001-D004: T001, T003, T014, T015.
- Architecture and component boundaries: T004, T005, T007, T008, T009.
- Data model and contract schemas: T003, T006.
- Policy inputs and matrix: T004, T006, T012.
- Data flow by tool family: T007, T008, T009, T011, T012.
- Error handling: T005, T007, T008, T009, T012.
- Test strategy: T006, T011, T010, T012, T013, T015.
- Operational considerations and durable promotion: T014, T015, T016.

## Open Decision Impact

- OQ001 Field Location: resolved by D001 as `meta.trust`; implemented by T003.
- OQ002 Vocabulary Shape: resolved by D002 as enum-backed structured values;
  implemented by T003 and T004.
- OQ003 Coverage Slice: resolved by D003 as all public standard-envelope
  Workbench resources/tools with only non-framable transport failures excluded;
  implemented by T002, T007, T008, T009, and T011.
- Strict consumer migration: not currently open. If implementation finds a
  strict consumer that rejects optional `meta.trust`, pause and return to
  design before changing `contract_version`.

## Maintenance Notes

- Update this matrix whenever task IDs, public surface inventory, design
  decisions, durable promotion targets, or verification commands change.
- Treat any unmapped public standard-envelope MCP surface as a CP005 readiness
  blocker.
- Do not mark implementation tasks complete with routing, planner, dry-run, or
  blocked-output evidence unless the task acceptance explicitly says that mode
  is sufficient.
