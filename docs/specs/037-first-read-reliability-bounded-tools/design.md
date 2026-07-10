---
title: First-read reliability and bounded tools design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-07-10
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Technical Design

## Overview

Spec 037 hardens first-read behavior by making runtime evidence state and
bounded-work limits explicit across status, scope, overview, context, docs,
diagnostics, and verification planning surfaces. The implementation should
reuse the existing response metadata, trust policy, runtime state, graph
snapshot, skipped-path, provider-status, and validation-planning structures
before introducing new vocabulary.

The design target is not to make first reads omniscient. It is to make them
honest: agents should know what is current, stale, degraded, blocked, skipped,
queued, unsafe to claim, and safe to use for next-read selection.

## Requirement Coverage

| Requirement | Acceptance Criteria | Design Coverage | Validation Approach |
|-------------|---------------------|-----------------|---------------------|
| Requirement 1 | AC1-AC3 | Normalize first-read validity/freshness through response metadata and presenter helpers. | Contract and MCP golden tests for valid, stale, degraded, and blocked responses. |
| Requirement 2 | AC1-AC3 | Standardize skipped-work and queued/refreshing evidence across use cases. | Fixture tests for skipped paths, unsupported languages, provider gaps, and truncated budgets. |
| Requirement 3 | AC1-AC3 | Define minimum-evidence gates per tool/resource and return degraded/blocked states when unmet. | Use-case tests for timeout/provider/cache/permission failure classes. |
| Requirement 4 | AC1-AC3 | Add cold, stale, failed, permission-limited, unsupported, and budget-truncated fixtures. | Focused Vitest suites and broad validation before closure. |
| Requirement 5 | AC1-AC3 | Promote accepted behavior into runtime contracts, MCP surface, runtime operations, graph store, and backlog docs. | Docs metadata/link tests and closure reconciliation. |

## Correctness Property Coverage

| Property | Design Behavior | Validation Direction | Notes |
|----------|-----------------|----------------------|-------|
| CP-001 | Trust metadata and presenter caveats must align with response validity. | Contract tests and golden MCP responses. | Reuse `response-metadata` ownership. |
| CP-002 | Minimum-evidence gates produce degraded or blocked states with reasons. | Use-case tests for provider, timeout, stale cache, and permission fixtures. | Avoid success-shaped partial output. |
| CP-003 | Skipped-work summaries cap samples and counts. | Fixture tests for generated/vendor, unsupported, and budget-truncated repositories. | Do not expose unbounded path lists. |
| CP-004 | Validation planning remains planned/non-executed evidence. | Verification-plan golden tests. | EB024 remains separate unless current vocabulary proves insufficient. |

## High-Level Design

### System Architecture

The implementation should stay within existing layers:

- contracts in `src/contracts/` define shared vocabulary;
- domain policies classify path, trust, and safety;
- application use cases compute first-read evidence and minimum-evidence state;
- infrastructure adapters provide graph, filesystem, diagnostics, and runtime
  state evidence;
- MCP presenters serialize compact agent-facing responses and trust metadata.

No MCP registry should own first-read reliability policy directly. Registries
should call use cases and shared presenters.

### Components and Changes

- `src/application/use-cases/response-metadata.ts`: confirm or extend shared
  validity, freshness, verification, and trust derivation without duplicating
  enum vocabulary.
- `src/application/use-cases/get-repo-status.ts`,
  `get-repo-scope.ts`, `get-repo-overview.ts`: define minimum evidence for
  resource claims and normalize stale/degraded/blocked output.
- `src/application/use-cases/get-task-context.ts`: ensure routing evidence
  reports skipped work, stale graph/doc state, and unsafe claims clearly.
- `src/application/use-cases/query-docs.ts` and Markdown/docs helpers: expose
  docs coverage/truncation/staleness consistently with graph state.
- `src/application/use-cases/diagnose-changed-files.ts`: distinguish provider
  unavailable, no actionable findings, and skipped evidence.
- `src/application/use-cases/plan-verification.ts`: keep planned commands as
  planned evidence and report low-confidence/blocker reasons consistently.
- `src/infrastructure/sqlite/graph-store.ts` and runtime state adapters:
  provide snapshot/freshness/blocking evidence needed by use cases.
- `tests/fixtures/`: add or adapt small repositories that exercise first-read
  failure classes.

### Data Models

Approved decision D001 keeps the first slice on existing public response fields
with additive helper semantics. Do not add new public enum values unless T002
proves a concrete field-level contract gap and routes that gap to EB024.

Use this mapping for the first implementation slice:

- stale first-read evidence primarily maps to `meta.freshness`;
- degraded first-read evidence maps to `meta.analysis_validity: partial`,
  bounded caveats, warnings, skipped-work evidence, and trust restrictions;
- blocked first-read evidence maps to `verification_status: blocked`,
  `analysis_validity: invalid_due_to_environment`, errors/warnings, or
  safe-use restrictions according to the root condition;
- `meta.trust.safe_to_use_for`, `meta.trust.not_safe_to_use_for`,
  `meta.trust.must_verify_by`: existing trust boundaries;
- `skipped_paths`, `skipped_work`, `provider_statuses`, `warnings`, and
  `errors`: bounded evidence surfaces.

If T002 proves this mapping cannot express a required public contract, route the
contract migration through EB024 rather than silently adding incompatible
statuses.

### Data Flow

```text
MCP resource/tool call
  -> registry schema parse
  -> application use case
  -> runtime/graph/filesystem/diagnostics providers
  -> minimum-evidence classification
  -> response metadata and trust derivation
  -> MCP presenter with bounded data, skipped work, caveats, warnings, errors
```

## Low-Level Design

### Algorithms and Logic

Each first-read use case should follow the same classification shape:

```text
collect bounded primary evidence
collect bounded optional evidence
classify missing/skipped/stale/provider failures
if required evidence is unavailable:
    return blocked with reason and safe next actions
if minimum evidence is present but optional evidence is missing:
    return degraded with unsafe claims and must-verify steps
if evidence is older than current known state:
    return stale with direct-read or refresh verification guidance
return valid with trust metadata and bounded skipped-work summaries
```

### Function Signatures and Interfaces

Approved decision D003 uses a shared application-level helper with per-use-case
evidence inputs. Shared vocabulary, trust calibration, and common
stale/degraded/blocked derivation belong in response metadata helpers. Minimum
evidence rules stay close to each use case, then flow into the shared helper for
consistent metadata and presentation. MCP registries remain thin.

Implementation should first look for existing helper seams before adding new
interfaces. If new helpers are needed, keep them application-level,
contract-backed, and shaped around current response metadata vocabulary:

```typescript
type FirstReadEvidenceState = {
  analysisValidity: ResponseMetadata["analysis_validity"];
  freshness: ResponseMetadata["freshness"];
  verificationStatus: ResponseMetadata["verification_status"];
  safeToUseFor: string[];
  notSafeToUseFor: string[];
  mustVerifyBy: string[];
  skippedWork: SkippedWorkSummary[];
  blockerReasons: string[];
};
```

This type is illustrative. Use existing contract names where possible.

### Error Handling

- Provider unavailable: degraded when primary evidence remains useful; blocked
  when the requested claim depends on that provider.
- Cache or daemon unavailable: blocked for graph-backed claims unless a stale
  snapshot is explicitly safe for local navigation.
- Timeout or budget: degraded with skipped-work reason when partial evidence is
  safe; blocked when minimum evidence cannot be met.
- Permission-limited path: degraded or blocked depending on whether the path is
  required for the requested claim.
- Unsupported language/platform: degraded with direct-read guidance, not a
  silent omission.

### Security, Trust, and Access

First-read reliability must not expand filesystem or command privileges. It
must preserve shared path policy, secret-path suppression, generated/vendor
classification, and command non-execution boundaries. Response summaries should
stay bounded and redacted; they must not emit unbounded path lists, raw secret
paths, full transcripts, or raw provider errors.

### Migration and Compatibility

Keep changes additive where possible. Existing clients that ignore new metadata
must still receive valid JSON envelopes. If enum/status migration is required,
pause for EB024-style contract migration planning before implementation.

### Slice Boundary And Residual Architecture

| Design target | In this slice | Out of this slice | Follow-up destination | Blocks closure? |
|---------------|---------------|-------------------|-----------------------|-----------------|
| First-read resources/tools report valid/stale/degraded/blocked state | status, scope, overview, context, docs, diagnostics, verification planning | command execution, full semantic analysis | EB024 if status vocabulary changes | yes |
| Bounded skipped-work reporting | generated/vendor, unsupported, provider, budget, and truncation summaries | unbounded full path dumps or raw logs | EB009 telemetry/reporting | yes |
| Fixture-backed failure modes | cold, stale, failed, permission-limited, unsupported, budget-truncated fixtures | large cross-repo benchmark automation | EB014 and EB020 | yes |
| Durable promotion | runtime contracts, MCP surface, runtime operations, graph store, backlog | release-readiness gates | EB043 | yes |

## Validation Strategy

| Validation | Covers | Evidence Location | Residual Risk |
|------------|--------|-------------------|---------------|
| Contract tests for metadata/trust/status vocabulary | Requirements 1, 3; CP-001, CP-002 | `verification.md`, `tests/contracts/` | EB024 only if T002 proves a concrete field-level gap. |
| MCP/resource golden tests | Requirements 1-4 | `tests/mcp/`, `tests/docs/`, `tests/runtime/` | Golden brittleness managed by focused fixtures. |
| Hybrid fixture and adapter-fake tests for cold/stale/degraded/blocked modes | Requirements 2-4 | `tests/fixtures/`, focused test suites | Filesystem fixtures cover repository shape; adapter fakes cover nondeterministic runtime/provider state. |
| `pnpm typecheck` and `pnpm test` | Full regression | `verification.md` | Native/sandbox constraints must be recorded if present. |
| Docs metadata/link checks | Requirement 5 | `tests/docs/docs-links-metadata.test.ts` | Closure docs must be updated after implementation. |

## Downstream Task Guidance

- First implementation slice should be small: define current response-state
  behavior and add one focused fixture that proves a degraded or blocked first
  read.
- Use the D001-D003 approved decisions from `open-decisions.md`: existing
  response fields plus additive helper semantics, hybrid fixture/fake tests, and
  a shared helper with per-use-case evidence inputs.
- Do not change all first-read tools in one task unless the shared helper is
  already proven and the write set remains coherent.
- Before implementing each task, run `verification_plan` for the files in that
  slice and record the intended validation in `verification.md`.
- Update `traceability.md` whenever task IDs or requirement coverage change.

## Operational Considerations

This spec directly affects startup and first-call trust. Dogfood validation
should include a fresh MCP resource read after implementation, not only unit
tests. If a local environment blocks daemon/socket tests, rerun validation in
an unrestricted environment and record both outcomes.

## Approved Decisions

- D001: use existing public response fields with additive helper semantics for
  the first slice. EB024 is not a prerequisite unless T002 proves a concrete
  field-level contract gap.
- D002: use hybrid filesystem fixtures and adapter fakes. Filesystem fixtures
  prove repository-shape behavior; adapter fakes prove nondeterministic runtime,
  watcher, provider, stale, or blocked states.
- D003: use a shared application-level helper with per-use-case evidence inputs.
  Shared vocabulary and trust derivation stay in response metadata helpers;
  minimum-evidence rules stay near the relevant use case.

## Open Questions

- Which first-read surface should be hardened first: repo resources, task
  context, docs search, diagnostics, or verification planning?

## Related Artifacts

- Requirements: `requirements.md`
- Canonical Context: `canonical-context.md`
- Change Impact: `change-impact.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
- Open Decisions: `open-decisions.md`
