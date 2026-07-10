---
title: First-read reliability and bounded tools requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-07-09
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Introduction

Agent Workbench first reads and planning tools must be useful at the start of a
coding-agent task, even when a repository is cold, refreshing, stale,
permission-limited, or too large to inspect fully within budget. EB003 captures
the recurring failure mode: status, scope, overview, context, docs,
diagnostics, or verification surfaces can spend hidden time, time out, or imply
evidence is complete when it is partial.

This spec defines the next implementation slice for bounded first-read behavior:
return structured valid, stale, degraded, or blocked states with explicit
missing/skipped evidence instead of partial success, raw errors, or ambiguous
green output.

## Goals

- Make first-read resources and key planning tools return clear validity and
  freshness states under cold, refreshing, stale, failed, and
  permission-limited repo conditions.
- Bound hidden runtime work for status, scope, overview, context, docs,
  diagnostics, and verification planning.
- Surface skipped, queued, stale, missing, or blocked evidence in a consistent
  way that agents can act on safely.
- Add fixture-backed tests for timeout, degraded, stale, and blocked first-read
  conditions.
- Preserve root-cause discipline: do not add broad fallback routes or partial
  output masking.

## Non-Goals

- Do not add command execution to `verification_plan` or diagnostics tools.
- Do not add parser, LSP, semantic, validation, or command-execution fallbacks
  to hide missing evidence.
- Do not replace the per-repo daemon, graph warmup, or cache architecture
  delivered by earlier specs.
- Do not change lifecycle authority: spec/task status remains owned by
  spec-lifecycle-manager, with Agent Workbench consuming lifecycle context only
  as companion evidence.
- Do not promise full-repo impact or security conclusions from first-read
  surfaces.

## Glossary

| Term | Definition |
|------|------------|
| first read | Initial status, scope, overview, context, docs, diagnostics, or verification call used to orient an agent before source edits. |
| bounded work | Runtime work constrained by explicit budgets, row limits, time limits, or skipped-work reporting. |
| valid | Evidence is current enough and complete enough for the specific stated use. |
| stale | Evidence exists but is older than the current repo or runtime state. |
| degraded | Evidence is partial because optional enrichment, indexing, provider, or budget work was unavailable or skipped. |
| blocked | Required evidence cannot be produced safely or usefully until an environment, permission, cache, daemon, or provider issue is resolved. |
| skipped evidence | Named work or paths intentionally not inspected because of policy, budget, generated/vendor classification, unsupported language, or provider limits. |

## Durable Source Baseline

| Source | Current behavior relied on | Confidence | Notes |
|--------|----------------------------|------------|-------|
| `docs/backlog/README.md` | EB003 is P0, active principle and ongoing implementation surface. | high | This spec promotes EB003 into active Spec 037. |
| `docs/reference/runtime-contracts.md` | Owns runtime response envelope, freshness, evidence, trust, validation, and error-shape vocabulary. | high | Must be updated if contract behavior changes. |
| `docs/design/runtime-operations-design.md` | Owns cache tiers, invalidation, warm-up, work queues, async/snapshot rules, and runtime signals. | high | Primary durable owner for first-read operational behavior. |
| `docs/design/mcp-surface-design.md` | Owns public MCP resources/tools, schemas, presenter boundaries, and response behavior. | high | Primary durable owner for MCP-facing first-read behavior. |
| `docs/design/graph-store-design.md` | Owns graph store freshness, rebuilds, FTS, snapshots, and query budgets. | high | Must capture graph/docs budget and skipped-evidence behavior. |
| `docs/reference/documentation-map.md` | Maps canonical owners and source-of-truth rules. | high | Must be kept consistent if durable owners change. |

## Durable Impact

| Durable area | Action | Target | Notes |
|--------------|--------|--------|-------|
| backlog | modify | `docs/backlog/README.md` | Mark EB003 as promoted to active Spec 037 and route residuals after implementation. |
| reference | modify | `docs/reference/runtime-contracts.md` | Promote accepted envelope/freshness/trust semantics. |
| design | modify | `docs/design/runtime-operations-design.md` | Promote accepted bounded first-read and runtime state behavior. |
| design | modify | `docs/design/mcp-surface-design.md` | Promote public resource/tool behavior and response caveats. |
| design | modify | `docs/design/graph-store-design.md` | Promote graph/docs query-budget and skipped-evidence behavior. |
| history | add later | `docs/history/spec-closure-log.md`, `docs/history/spec-archive-index.md` | Update only during closure. |

## Staged Readiness

- **Current stage:** requirements
- **Next stage:** implementation planning from draft design and tasks
- **Ready to implement when:** requirements, design, tasks, traceability, and
  verification identify a bounded first slice, affected files, test fixtures,
  and durable promotion targets.
- **Design-first exception:** no
- **Optional artifacts recommended:** `canonical-context.md`,
  `change-impact.md`, `traceability.md`, `verification.md`
- **Downstream review needed:** design, tasks, traceability, verification

## Requirements

### Requirement 1: First-Read State Is Explicit

**User Story:** As a coding agent, I want first-read resources and tools to
label evidence validity and freshness explicitly, so that I do not treat stale,
degraded, or blocked evidence as confirmed-current truth.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a first-read resource or tool has current and sufficient evidence,
   WHEN it returns a response, THEN the response SHALL identify the analysis as
   valid for the stated use.
2. GIVEN a first-read resource or tool uses older cache, older graph snapshots,
   or known-refreshing evidence, WHEN it returns a response, THEN the response
   SHALL identify the evidence as stale or refreshing and name what must be
   verified before stronger claims are made.
3. GIVEN required evidence is unavailable, unsafe, or cannot be produced within
   the bounded operation, WHEN the resource or tool responds, THEN the response
   SHALL return a degraded or blocked state instead of a partial-success claim.

### Requirement 2: Hidden Work Is Bounded And Reported

**User Story:** As a coding agent, I want status, scope, overview, context,
docs, diagnostics, and verification planning to expose skipped or queued work,
so that I can decide whether to proceed, wait, refresh, or inspect files
directly.

**Priority:** must-have

#### Acceptance Criteria

1. WHERE a first-read surface skips paths, languages, optional enrichment,
   providers, graph rows, docs rows, or expensive analysis, THE SYSTEM SHALL
   include bounded skipped-work evidence with reason and representative sample.
2. WHILE graph or docs warmup is queued or refreshing, THE SYSTEM SHALL expose
   the queue or refresh state without blocking indefinitely on hidden warmup.
3. IF a budget, timeout, provider failure, or unsupported language prevents
   complete evidence, THEN THE SYSTEM SHALL name the missing evidence and state
   which claims are unsafe without direct verification.

### Requirement 3: Tools Do Not Return Misleading Partial Results

**User Story:** As a maintainer, I want bounded tools to prefer structured
degraded or blocked states over partial data that looks complete, so that
agents do not make unsafe implementation, validation, or closure claims.

**Priority:** must-have

#### Acceptance Criteria

1. IF a tool cannot meet the minimum evidence contract for its advertised
   output, THEN THE SYSTEM SHALL return a structured degraded or blocked
   envelope rather than success-shaped output with hidden omissions.
2. GIVEN optional evidence is missing but minimum evidence is still useful,
   WHEN a tool returns degraded output, THEN the response SHALL distinguish
   safe uses from unsafe claims.
3. WHERE a failure is caused by environment, permission, daemon, cache, or
   provider state, THE SYSTEM SHALL report the root condition directly and SHALL
   NOT mask it with retries, alternate tooling, or generic partial output.

### Requirement 4: Fixture Coverage Proves Cold, Stale, Degraded, And Blocked Modes

**User Story:** As a maintainer, I want fixture-backed tests for first-read
failure classes, so that reliability behavior stays stable across future
runtime changes.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN cold, refreshing, stale, failed, permission-limited, unsupported, and
   budget-truncated fixtures, WHEN first-read resources/tools run against them,
   THEN tests SHALL assert the expected valid, stale, degraded, or blocked
   envelope.
2. GIVEN skipped evidence appears in a response, WHEN tests inspect the
   response, THEN they SHALL assert the reason, representative sample, and
   unsafe claim boundaries.
3. GIVEN full validation runs, WHEN the spec is ready for closure, THEN focused
   fixtures and broad `pnpm` validation SHALL pass or each exception SHALL be
   recorded with residual risk.

### Requirement 5: Durable Documentation Captures Accepted Behavior

**User Story:** As a future agent or maintainer, I want the accepted behavior
promoted out of the active spec, so that first-read reliability is understood
after the spec is closed and removed.

**Priority:** must-have

#### Acceptance Criteria

1. WHEN implementation is accepted, THEN current-state behavior SHALL be
   promoted to the durable owners listed in the documentation map.
2. WHEN any behavior remains deferred, THEN it SHALL be routed to one backlog
   item, follow-up spec, or explicit rejection rationale.
3. WHEN the spec is closed, THEN closure records SHALL identify durable
   destinations and validation evidence.

## Correctness Properties

- **CP-001**: A response must not claim evidence is valid for a use that its
  `meta.trust.not_safe_to_use_for` or equivalent caveats explicitly disallow.
- **CP-002**: A first-read response that omits required evidence because of
  timeout, budget, provider failure, permission, or stale state must carry a
  degraded or blocked state and a named reason.
- **CP-003**: Skipped-work reporting must be bounded and representative; it
  must not dump unbounded path lists or hidden raw provider errors.
- **CP-004**: Planned validation and diagnostics remain non-executed evidence
  unless a separate executed-validation surface explicitly records execution.

## Technical Context

- **Language/Version:** TypeScript, ESM, Node 22/24 supported by the repo.
- **Primary Dependencies:** MCP SDK/runtime, SQLite graph store,
  tree-sitter-backed extraction, Vitest.
- **Target Platform:** Local-first Agent Workbench MCP runtime and packaged
  Codex, Claude Code, and Kiro integrations.
- **Constraints:** Keep MCP adapters thin, contracts centralized under
  `src/contracts/`, no fallback parser/semantic/validation paths without
  fixture-backed design justification, no partial results masking failures.
- **Performance Goals:** First-read surfaces should return bounded responses
  without waiting indefinitely for full warmup, while preserving direct
  evidence about stale or missing work.

## Success Criteria

- **SC-001**: Focused tests prove valid, stale, degraded, and blocked first-read
  envelopes for representative fixtures.
- **SC-002**: MCP/resource golden tests show unsafe claims are named when
  evidence is missing, skipped, stale, or provider-limited.
- **SC-003**: Durable docs describe accepted first-read reliability behavior
  after implementation.
- **SC-004**: Full `pnpm typecheck` and `pnpm test` pass before closure, or any
  exception is recorded with residual risk and explicit owner.

## Related Artifacts

- Canonical Context: `canonical-context.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
