---
title: Validation-plan skipped-path payload compaction requirements
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

`verification_plan` currently copies as many as 50 scanner-level skipped-path
records into an otherwise concise validation plan. In generated, vendor-heavy,
or archive-heavy repositories, those routine path records can dominate the MCP
payload and obscure the repository-specific validation commands the agent
actually needs. `context_for_task` already groups skipped-path evidence, but its
prose-only summary has separate semantics and does not expose exact structured
counts or truncation.

This spec delivers EB065 by defining one shared skipped-path summary policy for
validation planning and compatible task-context presentation. The change is a
presentation compaction only: it must consume the scanner's completed result
without adding an early stop, scan limit, extraction limit, retry, or partial
success route.

## Goals

- Replace routine per-path validation-plan output with exact reason-grouped
  counts and deterministic bounded samples.
- Preserve exact aggregate skip counts even when the scanner retains only a
  bounded raw compatibility sample.
- Keep individually actionable requested-path exclusions and material
  validation blockers visible.
- Derive validation-plan and task-context summaries from one shared policy.
- Preserve repository-specific validation command discovery and distinguish
  scanner truncation from presentation sampling.
- Keep public output bounded without hiding how much classified evidence was
  summarized.

## Non-Goals

- Changing the file catalog scanner's current traversal, `max_files`, ignore
  policy, classification decisions, or continuation behavior.
- Stopping classification when a response sample is full or using a response
  budget as an extraction budget.
- Adding retries, alternate scanners, filesystem fallbacks, or success-shaped
  partial output.
- Changing validation-command discovery, command ranking, execution status, or
  the `max_commands` request contract.
- Compacting `repo_scope`, `repo_overview`, diagnostics, docs, or other public
  skipped-path surfaces in this slice.
- Absorbing EB059 ranked-universe capacity or EB061 parser coverage decisions.

## Glossary

| Term | Definition |
| --- | --- |
| Classified skipped path | One `FileCatalogSkippedPath` produced by the completed scanner invocation used for a validation plan. |
| Skip population receipt | Scanner-owned exact aggregate counts and bounded samples for all unique skip classifications observed during one invocation. |
| Routine exclusion | A skipped path whose reason is useful as aggregate evidence but whose individual path is not an explicitly requested validation target or material blocker. |
| Actionable exclusion | A skipped-path record for an explicitly requested or changed path that the caller can repair or narrow directly. |
| Reason group | All classified skipped paths sharing one stable `SkippedPathReason`. |
| Representative sample | A deterministic bounded subset of normalized repository-relative paths from one reason group. |
| Presentation truncation | Omission of individual sample paths after full classified counts are known; it is not scanner or extraction truncation. |

## Durable Source Baseline

| Source | Current behavior relied on | Confidence | Notes |
| --- | --- | --- | --- |
| `docs/backlog/README.md` | EB004 and EB065 define validation-plan selection and compaction acceptance | high | Backlog owns scope until promotion. |
| `docs/design/mcp-surface-design.md` | Validation planning exposes modeled scanner skips and task context summarizes them | high | Owns public surface behavior. |
| `docs/reference/runtime-contracts.md` | Contract `0.1` permits additive optional fields but requires a new version for breaking schema changes | high | Owns compatibility and shared skipped-path vocabulary. |
| `src/infrastructure/filesystem/file-catalog-scanner.ts` | Scanner deduplicates raw skip evidence but silently stops retaining records after `MAX_SKIPPED_PATHS = 100` | high | Exact compaction counts require an aggregate receipt that continues after the raw sample fills. |
| `src/application/use-cases/plan-verification.ts` | Planner currently maps the first 50 retained scanner skips to `plan.skipped_paths` | high | Direct implementation evidence. |
| `src/application/use-cases/get-task-context.ts` | Task context groups skips into prose by reason, keeps one sample, and returns at most five groups | high | Useful precedent, not the final shared contract. |
| `src/presentation/verification-plan-presenter.ts` | Presenter sanitizes each public raw skipped-path record | high | Presentation boundary. |
| `src/contracts/runtime-validation-edit-contracts.ts` | `VerificationPlan` currently has optional raw `skipped_paths` | high | Contract change seam. |

## Durable Impact

See `change-impact.md`. Accepted behavior must be promoted to the MCP surface
design, runtime contracts, runtime requirements, proof matrix, backlog, dogfood
ledger when installed-runtime evidence exists, and agent-readable changelog as
applicable before closure.

## Staged Readiness

- **Current stage:** requirements
- **Next stage:** design
- **Ready to design when:** the compatibility direction, summary invariants,
  actionable-exclusion boundary, and no-extraction-limit rule are testable
- **Design-first exception:** no
- **Optional artifacts recommended:** `research.md`, `change-impact.md`,
  `canonical-context.md`, `traceability.md`, `verification.md`
- **Downstream review needed:** requirements, public contract, design, tasks,
  traceability, implementation, and final QA review

## Requirements

### Requirement 1: Exact Reason-Grouped Summary

**User Story:** As a coding agent, I want routine skipped paths summarized by
reason, so that validation commands remain prominent without losing evidence
about excluded repository content.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a completed validation-plan scanner result containing skipped paths,
   WHEN the plan is constructed, THEN THE SYSTEM SHALL group every classified
   skipped path by its stable `SkippedPathReason`.
2. THE SYSTEM SHALL expose the exact total classified skipped-path count and an
   exact count for every returned reason group.
3. THE SCANNER SHALL continue aggregate accounting for every unique
   reason/path classification after its bounded raw compatibility sample is
   full; filling that sample SHALL NOT stop classification or counting.
4. THE SYSTEM SHALL order reason groups deterministically by stable reason and
   SHALL return each encountered reason exactly once.
5. GIVEN no classified skipped paths, WHEN the plan is constructed, THEN THE
   SYSTEM SHALL omit the optional summary rather than emit fabricated zero
   evidence.
6. THE SYSTEM SHALL NOT expose one routine public record per skipped path after
   compaction.

### Requirement 2: Deterministic Bounded Samples

**User Story:** As a coding agent, I want representative paths for each reason,
so that I can understand an exclusion without receiving an unbounded list.

**Priority:** must-have

#### Acceptance Criteria

1. WHEN a reason group is summarized, THEN THE SYSTEM SHALL select a fixed,
   contract-owned maximum number of normalized repository-relative sample paths.
2. THE SYSTEM SHALL sort and deduplicate candidate paths before sampling so
   input enumeration order cannot change the public sample.
3. EACH reason group SHALL state whether its sample omits classified members.
4. THE SYSTEM SHALL expose the sample bound as stable contract behavior rather
   than an environment variable, timeout, or caller-controlled extraction
   budget.
5. THE SYSTEM SHALL pass sample paths and any bounded public detail through the
   established presentation-redaction boundary.

### Requirement 3: No Extraction Or Classification Budget Regression

**User Story:** As a maintainer, I want compaction applied after classification,
so that smaller output cannot silently reduce the evidence the planner gathers.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN any scanner result accepted by validation planning, WHEN presentation
   compaction runs, THEN THE SYSTEM SHALL consume the scanner's exact skip
   population receipt rather than infer completeness from its bounded raw
   `skipped_paths` compatibility sample.
2. THE SYSTEM SHALL NOT stop scanner traversal or skipped-path classification
   because a summary group or response sample is full.
3. THE SYSTEM SHALL NOT add a scan, file, byte, path, time, or group budget to
   obtain compact output.
4. WHERE the upstream scanner reports `truncated`, THE SYSTEM SHALL preserve
   that distinct scanner-level truth and SHALL NOT describe grouped counts as
   repository-complete.
5. WHERE the upstream scanner is not truncated, grouped counts SHALL conserve
   the full returned classification set independently of sample size.

### Requirement 4: Actionable Exclusions And Blockers Remain Visible

**User Story:** As a coding agent, I want exclusions affecting my requested
files to remain individually actionable, so that compaction does not hide why
validation is blocked or incomplete.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a skipped-path record whose normalized path exactly matches an
   explicitly requested or changed validation path, WHEN the plan is built,
   THEN THE SYSTEM SHALL retain bounded individual evidence for that actionable
   exclusion in addition to aggregate accounting.
2. THE SYSTEM SHALL preserve existing unsafe-path, missing-path, discovery,
   environment, and no-command blocker semantics and SHALL NOT downgrade a
   blocker to a routine summary.
3. THE SYSTEM SHALL count actionable exclusions exactly once in aggregate
   conservation even when they also appear as individual evidence.
4. THE SYSTEM SHALL bound actionable individual evidence by the existing
   request-scope contract: return every actionable exclusion for supported
   requests of at most 50 selected paths; for an already-blocked broader
   request, return at most the first 50 normalized, lexically ordered actionable
   exclusions. This SHALL NOT become a scanner or extraction limit.
5. THE SYSTEM SHALL retain stable reasons and safe bounded details without
   leaking absolute host paths, secrets, or excluded file contents.

### Requirement 5: Shared Policy And Compatible Public Contract

**User Story:** As an integrator, I want validation and task-context skip
summaries to agree, so that Agent Workbench does not expose two conflicting
interpretations of the same scanner evidence.

**Priority:** must-have

#### Acceptance Criteria

1. THE SYSTEM SHALL expose one shared pure summary policy used by
   `verification_plan` and `context_for_task`; surface-specific grouping logic
   is forbidden.
2. `verification_plan` SHALL expose a structured summary with total count,
   complete reason groups, deterministic samples, per-group sample-truncation
   state, and bounded actionable exclusions.
3. `context_for_task` SHALL derive its existing bounded `skipped_work`
   presentation from the same reason groups and counts, SHALL render every
   encountered reason group exactly once, and SHALL NOT retain the current
   five-reason slice.
4. THE SYSTEM SHALL deliver the new verification-plan receipt as an additive
   optional contract under version `0.1`; the planner and presenter SHALL stop
   emitting the legacy raw `skipped_paths` list on this surface.
5. Other public surfaces that still own raw `skipped_paths` SHALL remain
   unchanged, and no dual primary output route SHALL be introduced for
   validation planning.

### Requirement 6: Fixture-Backed Acceptance And Promotion

**User Story:** As a maintainer, I want payload and conservation regressions,
so that compaction cannot hide commands, blockers, paths, or incomplete scans.

**Priority:** must-have

#### Acceptance Criteria

1. A generated/vendor-heavy fixture SHALL return all five Agent Workbench
   repository validation gates exactly once within the public response budget.
2. The same fixture SHALL prove exact group and total conservation across more
   than 100 routine exclusions and SHALL record the invocation-scoped memory
   observation without imposing a runtime budget.
3. Deterministic permutation tests SHALL prove stable group ordering, sample
   ordering, deduplication, and truncation state.
4. Regressions SHALL cover no skips, only routine skips, actionable requested
   exclusions, material runtime skips, upstream scanner truncation, redaction,
   presenter parsing, and task-context parity.
5. BEFORE closure, accepted behavior SHALL be promoted to every durable owner
   named in `change-impact.md`, and EB065 SHALL be marked delivered only after
   implementation and validation evidence exists.

## Correctness Properties

- **CP-001:** The sum of all reason-group counts equals the total number of
  normalized, deduplicated skip classifications observed by the scanner
  invocation, including classifications beyond the retained raw sample.
- **CP-002:** For each reason group, `sample_truncated` is true exactly when the
  group count exceeds the number of returned sample paths.
- **CP-003:** Permuting scanner output does not change the structured summary or
  task-context summary derived from it.
- **CP-004:** Filling a presentation sample never changes scanner invocation,
  validation-command discovery, blocker classification, or aggregate counts.
- **CP-005:** Every individually returned actionable exclusion belongs to
  exactly one reason group and does not increase aggregate counts.
- **CP-006:** An upstream truncated scan remains publicly distinguishable from
  complete classification with presentation-truncated samples.

## Technical Context

- **Language/Version:** TypeScript ESM on the repository's supported Node.js
  versions
- **Primary Dependencies:** Zod contracts, Vitest, file catalog scanner port,
  existing response redaction
- **Target Platform:** Agent Workbench MCP runtime and packaged integrations
- **Constraints:** one shared summarizer; additive public contract; no fallback,
  retry, extraction cap, or command-selection change
- **Performance Goals:** public routine-skip payload grows with the finite reason
  vocabulary and fixed per-group sample bound, not with skipped-path population

## Success Criteria

- **SC-001:** A fixture with at least 50 routine excluded paths returns exact
  counts, bounded deterministic samples, and all five repository validation
  gates within the response budget.
- **SC-002:** Focused contract/use-case/presenter/MCP tests prove CP-001 through
  CP-006 and pass under repeated input permutations.
- **SC-003:** Existing validation command and blocker tests pass without an
  extraction/classification budget change.
- **SC-004:** Typecheck, full Vitest, plugin validation, package dry-run, and
  lifecycle gates pass before completion.

## Related Artifacts

- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
