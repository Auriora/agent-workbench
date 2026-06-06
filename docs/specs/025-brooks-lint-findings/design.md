---
title: Brooks-Lint findings tracker design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Design

## Overview

This spec records Brooks-Lint findings as a temporary implementation tracker
that can survive one-skill-at-a-time review. It separates the diagnostic record
from the remediation queue so maintainers can preserve evidence, triage each
finding, and only then convert accepted findings into code, test, and durable
documentation work.

## High-Level Design

This spec is a tracking package rather than a single feature design. It keeps
Brooks-Lint output in three connected artifacts:

- `findings.md` stores review reports and the live finding ledger.
- `tasks.md` converts accepted findings into implementation work.
- `verification.md` defines the validation gates required before a finding can
  be marked resolved.

The package follows the repository's current spec structure and the
Spec Lifecycle Manager rule:

```text
durable docs -> active spec -> code/tests/config -> durable docs -> close spec
```

### Finding Lifecycle

```text
new -> triage -> accepted -> in_progress -> resolved
             \-> deferred
             \-> dismissed
```

- `new`: captured from a Brooks-Lint run but not yet reviewed.
- `triage`: under maintainer review.
- `accepted`: will be remediated or converted into tasks.
- `in_progress`: remediation work has started.
- `resolved`: verified and promoted into durable docs when needed.
- `deferred`: intentionally postponed with a revisit condition.
- `dismissed`: intentionally not acted on, with a recorded rationale.

### Data Model

Each finding entry uses this shape:

```text
ID: BL-ARCH-001
Mode: Architecture Audit
Severity: Critical | Warning | Suggestion
Status: new | triage | accepted | in_progress | resolved | deferred | dismissed
Risk: Dependency Disorder | Change Propagation | ...
Evidence: file paths, line references, test results, durable docs
Symptom: observed structure
Source: book and principle or smell
Consequence: concrete risk if left unresolved
Remedy: specific action
Tasks: linked task IDs
Verification: pending or completed evidence
```

### Report Capture

Full Brooks-Lint reports are stored in `findings.md` under dated sections. Each
report keeps the skill mode, scope, health score, module dependency graph when
required, and findings sorted by severity.

### Task Conversion

Only accepted findings become implementation tasks. Tasks should focus on one
boundary or risk at a time, and they must include:

- file paths or module ownership
- dependency notes
- acceptance criteria
- required tests
- durable documentation targets
- evidence status

## Low-Level Design

### Current Brooks-Audit Intake

The first intake is the whole-repository `$brooks-audit` run. It records:

- architecture graph derived from `src/` imports and durable architecture docs
- targeted architecture test result:
  `pnpm exec vitest run tests/architecture/layer-boundaries.test.ts`
- findings for application-to-infrastructure imports, application-to-presentation
  imports, and MCP adapter telemetry coupling

### Boundary Test Remediation Shape

The boundary test parser should become capable of extracting import specifiers
from single-line and multiline static imports and exports. The implementation
should keep one explicit import-extraction path and should not add hidden
fallback checks.

The layer rules should then include:

- application must not import `src/presentation`
- application must not import `src/infrastructure`
- presentation must not import `src/infrastructure`
- MCP adapters must not import concrete infrastructure except through a
  documented port-level exception

### Code Ownership Remediation Shape

For the first findings, likely remediation options are:

- move pure Markdown document helpers out of `src/infrastructure/markdown/` to
  an application or domain-owned module, or introduce a narrowly named port if
  the helper represents infrastructure behavior
- move next-action and metadata policy used by use cases into `src/contracts`
  or an application-owned policy module, while keeping envelope construction in
  presenters
- move telemetry adapter types to `src/ports` if interface adapters need to
  depend on the abstraction

The final choice should be made during implementation after inspecting call
sites and preserving existing runtime contracts.

## Operational Considerations

- This tracker does not require compiling target repositories. It validates the
  Agent Workbench codebase and documentation that implement the runtime.
- Spec updates should remain append-only for new Brooks-Lint reports unless a
  finding is triaged, resolved, deferred, or dismissed.
- Remediation must avoid masking failures with fallback routes or partial
  results.

## Open Questions

- Should accepted Brooks-Lint findings also be mirrored into
  `.brooks-lint-history.json`, or is the spec ledger the repository's preferred
  tracking mechanism?
- Should telemetry remain a cross-cutting infrastructure concern in MCP
  adapters, or should `TelemetryPort` become the only adapter-facing contract?
