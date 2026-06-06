---
title: Brooks-Lint findings tracker requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Requirements

## Introduction

Brooks-Lint reviews should produce durable, methodical findings that can be
triaged, converted into implementation tasks, verified, and either resolved or
explicitly deferred. This package tracks those findings across individual
Brooks-Lint skill runs so the repository can improve architecture, code quality,
technical debt, and test quality without losing source evidence or conflating
diagnosis with remediation.

The first entry captures the `$brooks-audit` architecture audit for the whole
project. Later Brooks-Lint skills can append to the same findings ledger and
add or refine remediation tasks.

## Durable Source Baseline

- [Agent IDE system architecture](../../architecture/system-architecture.md)
- [Layered runtime architecture](../../design/layered-runtime-architecture.md)
- [MCP surface design](../../design/mcp-surface-design.md)
- [Runtime contracts](../../reference/runtime-contracts.md)
- [Workspace safety contract](../../reference/workspace-safety-contract.md)

## Goals

- Preserve each Brooks-Lint finding with Symptom, Source, Consequence, and
  Remedy fields.
- Track finding severity, status, owner, evidence, and verification state.
- Convert accepted findings into scoped implementation tasks.
- Keep remediation aligned with durable architecture and runtime documents.
- Make deferred or dismissed findings explicit with a rationale.
- Support one-skill-at-a-time reviews without losing cross-run context.

## Non-Goals

- Do not fix every finding as part of creating this spec.
- Do not add parser, semantic, validation, command-execution, or architecture
  fallback paths to mask findings.
- Do not replace durable architecture documents with this temporary tracker.
- Do not treat Brooks-Lint output as authoritative over repository governance;
  conflicts must be reconciled before implementation.
- Do not run target repository builds or tests beyond validation needed for the
  Agent Workbench codebase.

## Requirements

### Requirement 1: Findings Ledger

**User Story:** As a maintainer, I want Brooks-Lint findings recorded in a
single ledger, so that each review result can be triaged methodically.

#### Acceptance Criteria

1. GIVEN a Brooks-Lint skill run, WHEN a finding is accepted for tracking,
   THEN the system SHALL record the mode, scope, health score, severity, status,
   evidence, Symptom, Source, Consequence, and Remedy.
2. WHEN a finding is appended, THEN it SHALL preserve enough file and document
   references for a future maintainer to reproduce the diagnosis.
3. IF a finding is dismissed or deferred, THEN the ledger SHALL record the
   rationale and any revisit condition.
4. WHERE multiple skills report related findings, THE SYSTEM SHALL cross-link
   them instead of duplicating contradictory tasks.

### Requirement 2: Triage And Task Conversion

**User Story:** As an implementer, I want accepted findings converted into
scoped tasks, so that remediation can proceed without rereading every report.

#### Acceptance Criteria

1. GIVEN an accepted finding, WHEN remediation is planned, THEN `tasks.md`
   SHALL include a stable task ID, dependencies, file targets, acceptance
   criteria, and evidence requirements.
2. WHEN remediation touches architecture boundaries, THEN the task SHALL cite
   the relevant durable architecture document and required test updates.
3. IF a finding is not yet ready for implementation, THEN it SHALL remain in
   the ledger with status `new`, `triage`, or `deferred` and SHALL NOT be
   silently removed.
4. WHEN a task is completed, THEN the ledger SHALL be updated to `resolved`
   only after verification evidence is recorded.

### Requirement 3: Architecture Boundary Integrity

**User Story:** As a runtime maintainer, I want architecture findings checked
against executable boundary tests, so that layer drift is caught before it
spreads.

#### Acceptance Criteria

1. GIVEN documented layer rules, WHEN boundary tests run, THEN application code
   SHALL be checked for concrete infrastructure imports, including multiline
   import declarations.
2. GIVEN documented presentation boundaries, WHEN boundary tests run, THEN
   application use cases SHALL NOT import presentation modules.
3. GIVEN MCP interface adapters, WHEN boundary tests run, THEN adapter imports
   of concrete infrastructure types SHALL either be prohibited or justified by
   a durable boundary decision.
4. IF a boundary exception is intentionally accepted, THEN the durable
   architecture document SHALL describe the exception and its verification rule.

### Requirement 4: Durable Documentation Promotion

**User Story:** As a future maintainer, I want resolved Brooks-Lint decisions
promoted into durable docs, so that active specs do not become the only record
of architectural intent.

#### Acceptance Criteria

1. WHEN a remediation changes layer responsibilities, THEN the appropriate
   durable architecture or design document SHALL be updated before closure.
2. WHEN a finding is resolved by moving code or contracts, THEN documentation
   SHALL describe the resulting ownership boundary.
3. IF remediation changes runtime contracts, THEN contract documentation and
   tests SHALL be updated together.
4. WHEN this spec is closed, THEN active unresolved findings SHALL be moved to
   durable backlog or a follow-up spec.

## Correctness Properties

- Every active finding has exactly one current status.
- Every resolved finding has verification evidence.
- Every implementation task maps to at least one accepted finding.
- No task claims resolution for a finding unless its acceptance criteria and
  verification evidence are complete.
- Durable documentation is the final source of truth after remediation.

## Success Criteria

- The first `$brooks-audit` report is captured with reproducible evidence.
- Later Brooks-Lint runs can append findings without restructuring the package.
- Accepted architecture findings have explicit remediation tasks and validation
  gates.
- Spec lifecycle lint passes for this package.
