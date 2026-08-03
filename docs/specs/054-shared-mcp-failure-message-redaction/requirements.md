---
title: Shared MCP failure-message redaction requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Introduction

This spec delivers backlog item EB063. Agent Workbench already classifies MCP
failures into stable public error classes, but the shared tool wrapper still
copies arbitrary provider exception text into `errors[].message`. Resource
helpers, presenters, and the diagnostics adapter also contain direct failure
message paths. An exception can therefore expose an absolute host path,
workspace escape, or secret-like fragment after surface-specific data has been
made safe.

The change is a public presentation hardening repair. It preserves contract
version `0.1`, existing error codes, retryability, typed cause-code handling,
data skeletons, and trust calibration.

## Goals

- Apply one shared redaction and UTF-8 bound to every public MCP failure
  message before serialization.
- Preserve stable failure classification and safe actionable context.
- Cover shared tool, resource, presenter, and manual-adapter failure paths.
- Prove cross-surface parity with hostile-message fixtures and golden tests.

## Non-Goals

- Adding a new public error class, response field, contract version, feature
  flag, or compatibility mode.
- Redacting internal exceptions before classification or debugging capture.
- Changing failure retryability, trust semantics, transport framing, or typed
  domain data that is already independently safe.
- Adding per-tool fallback redactors or replacing typed domain messages with
  generic success-shaped output.
- Sanitizing debug-only CLI, telemetry, or process stderr in this slice unless
  it is proven to enter a public MCP response.

## Glossary

| Term | Definition |
| --- | --- |
| Public failure message | Free text placed in `errors[].message`, warnings, blocker reasons, or failure data returned through a public MCP resource or tool. |
| Failure classification | Existing `McpFailureClass` value used for public code, metadata, retryability, and recovery behavior. |
| Cause code | Stable typed identifier read from an internal error and used by a failure-envelope builder without exposing arbitrary exception text. |
| Shared redactor | The canonical presentation helper that removes secret-like text, host paths, and workspace escapes and then applies a fixed UTF-8 byte bound. |

## Durable Source Baseline

| Source | Current behavior relied on | Confidence | Notes |
| --- | --- | --- | --- |
| `docs/backlog/README.md` | EB063 defines the leak and acceptance boundary | high | Backlog owns proposed scope until promotion. |
| `docs/reference/runtime-contracts.md` | Owns error classes, response envelopes, and blocked trust semantics | high | Public vocabulary remains unchanged. |
| `docs/design/mcp-surface-design.md` | Requires shared envelope handling and forbids raw exception leakage | high | Owns adapter/presenter boundaries. |
| `docs/reference/workspace-safety-contract.md` | Owns presentation-time secret, host-path, and workspace-escape redaction | high | Canonical redaction policy. |
| `src/interface-adapters/mcp/envelope.ts` | Shared tool wrapper classifies errors but forwards raw exception messages | high | Primary implementation seam. |
| `src/presentation/redaction.ts` | Provides shared redaction and UTF-8 bounding primitives | high | Reuse; do not add an alternate algorithm. |
| `src/interface-adapters/mcp/registries/resources/provider-failure.ts` | Resource helper special-cases SQLite but otherwise returns raw provider text | high | Secondary shared seam. |

## Durable Impact

| Durable area | Action | Target | Notes |
| --- | --- | --- | --- |
| API/contract | clarify | `docs/reference/runtime-contracts.md` | State that all public failure text is redacted and bounded without changing schema. |
| design | clarify | `docs/design/mcp-surface-design.md` | Record shared wrapper, resource, presenter, and manual-adapter responsibilities. |
| safety reference | clarify | `docs/reference/workspace-safety-contract.md` | Add public failure-message coverage. |
| proof matrix | modify | `docs/reference/mvp-proof-matrix.md` | Name hostile-message parity fixtures. |
| backlog | modify | `docs/backlog/README.md` | Mark EB063 delivered only after implementation evidence. |

## Staged Readiness

- **Current stage:** requirements
- **Next stage:** design review
- **Ready to design when:** sinks, invariants, compatibility, and hostile fixture
  classes are explicit
- **Design-first exception:** no
- **Optional artifacts recommended:** none; traceability and validation are
  embedded in the core package for this focused repair
- **Downstream review needed:** security, contract, design, implementation, and
  final QA review

## Requirements

### Requirement 1: Redact And Bound Public Failure Text

**User Story:** As a coding agent, I want failure responses to retain safe
recovery information without exposing host or secret material.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN any provider or store exception, WHEN its text enters a public MCP
   failure envelope or failure data field, THEN THE SYSTEM SHALL pass it
   through the canonical presentation redactor before serialization.
2. THE SYSTEM SHALL redact Unix and Windows absolute host paths, workspace
   escapes, secret assignments, and private-key material using the existing
   presentation vocabulary.
3. AFTER redaction, THE SYSTEM SHALL bound every public failure message to one
   fixed contract-owned maximum of 512 UTF-8 bytes.
4. GIVEN already-safe text, WHEN it is sanitized once or repeatedly, THEN THE
   SYSTEM SHALL preserve its meaning and SHALL NOT introduce additional
   redaction markers.
5. THE SYSTEM SHALL NOT return unredacted source exception text through a
   warning, reason, nested data field, or `errors[].message` while returning a
   redacted sibling field.

### Requirement 2: Preserve Typed Failure Semantics

**User Story:** As a coding agent, I want redacted failures to remain
actionable and correctly classified.

**Priority:** must-have

#### Acceptance Criteria

1. THE SYSTEM SHALL classify an error and extract its cause code from internal
   evidence before public message sanitization.
2. Redaction SHALL NOT change the public error code, retryability,
   `analysis_validity`, freshness, verification status, trust requirements, or
   typed next action selected for the failure.
3. Surface builders MAY preserve bounded typed context such as a requested
   repository-relative identity only when the owning schema and tests prove it
   safe.
4. Unknown or fully redacted text SHALL retain a stable recovery-oriented
   fallback message rather than an empty, success-shaped, or raw response.
5. Transport exceptions SHALL remain limited to failures that prevent MCP
   response framing itself.

### Requirement 3: One Policy Across Public MCP Failure Sinks

**User Story:** As a maintainer, I want one failure-message policy so that a
safe tool wrapper cannot be bypassed by a resource or presenter.

**Priority:** must-have

#### Acceptance Criteria

1. The shared tool-envelope wrapper SHALL sanitize its final public message at
   the common envelope boundary.
2. Shared resource-provider failure construction SHALL use the same sanitizer
   for non-typed provider reasons.
3. Public presenters and manual adapters that construct failure text outside
   the shared wrapper SHALL call the same sanitizer before schema validation or
   serialization.
4. The implementation SHALL inventory public `errors`, warning, reason, and
   blocker sinks and either migrate each unsafe sink or record evidence that
   the sink accepts only fixed or independently sanitized text.
5. Per-tool copies, hidden fallback redactors, and primary-plus-fallback
   message routes are forbidden.

### Requirement 4: Cross-Surface Regression Evidence

**User Story:** As a maintainer, I want hostile provider failures tested across
representative surfaces so that later adapters cannot reintroduce leakage.

**Priority:** must-have

#### Acceptance Criteria

1. Golden tests SHALL cover representative docs, graph, diagnostics, and
   workspace-edit provider failures.
2. Tests SHALL cover both shared tool-wrapper and resource/manual-adapter paths.
3. Each hostile message fixture SHALL combine an absolute path, workspace
   escape, secret-like assignment, and safe actionable phrase; public output
   SHALL retain the safe phrase and omit every unsafe sentinel.
4. Tests SHALL prove stable error code, retryability, cause-code-dependent typed
   data, metadata, trust calibration, and next-action behavior before and after
   redaction.
5. Tests SHALL cover a multi-byte message at the 512-byte boundary and prove
   valid UTF-8 output no longer than the bound.

### Requirement 5: Compatibility And Promotion

**User Story:** As an integrator, I want the hardening applied without a public
contract migration.

**Priority:** must-have

#### Acceptance Criteria

1. The implementation SHALL retain contract version `0.1` and the existing
   `RuntimeError` and `McpFailureClass` shapes.
2. No feature switch, environment override, dual response shape, or migration
   fallback SHALL be introduced.
3. Existing safe fixed messages and typed domain failures SHALL remain
   semantically compatible.
4. Before closure, accepted behavior SHALL be promoted to every durable owner
   named under Durable Impact and EB063 SHALL be marked delivered.

## Correctness Properties

- **CP-001:** No serialized public MCP response contains any unsafe sentinel
  supplied only through an arbitrary provider exception message.
- **CP-002:** Sanitization is idempotent and its output is at most 512 UTF-8
  bytes.
- **CP-003:** For the same internal failure, sanitization changes only public
  free text; classification, retryability, metadata, trust, typed data, and
  next actions remain invariant.
- **CP-004:** Every public failure sink is either routed through the shared
  sanitizer or proven to accept only fixed or independently sanitized text.
- **CP-005:** Cause-code-dependent typed recovery behavior is selected from
  internal evidence and cannot be altered by redaction markers.

## Technical Context

- **Language/Version:** TypeScript ESM on supported Node.js versions
- **Primary Dependencies:** Zod, Vitest, existing presentation redaction
- **Target Platform:** Agent Workbench MCP tools and resources
- **Constraints:** thin adapters; one explicit sanitization policy; no public
  schema change; no fallback path
- **Performance Goals:** linear in message length with a 512-byte public output
  bound; no repository scan or extra provider call

## Success Criteria

- **SC-001:** Hostile-message parity tests pass for docs, graph, diagnostics,
  workspace-edit, and representative resources.
- **SC-002:** A public failure-sink inventory has no unexplained raw exception
  path.
- **SC-003:** Focused tests, typecheck, full Vitest, plugin/skill/package gates,
  and lifecycle checks pass before completion.
- **SC-004:** No public contract version, enum, schema, retryability, or trust
  behavior changes.

## Related Artifacts

- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
