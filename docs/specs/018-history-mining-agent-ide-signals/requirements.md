---
title: History mining for agent IDE signals requirements
doc_type: spec
artifact_type: requirements
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Requirements

## Introduction

Codex chat histories, hook logs, telemetry, CI failures, PR comments, and
dogfood notes contain repeated evidence of agent friction. Today those signals
are found manually. Agent Workbench needs a repeatable way to mine them into
product backlog evidence for the goal of becoming an IDE for coding agents.

## Durable Source Baseline

- Agent Workbench principles:
  [Agent Workbench principles](../../requirements/agent-workbench-principles.md)
- Agent IDE capability analysis:
  [Agent IDE capability analysis](../../reference/agent-ide-capability-analysis/agent-ide-capability-analysis-2026-06-05.md)
- Observability and debugging:
  [Observability and debugging design](../../design/observability-debugging-design.md)
- MCP surface design:
  [MCP surface design](../../design/mcp-surface-design.md)
- Edit and validation loop:
  [Edit and validation loop design](../../design/edit-and-validation-loop-design.md)

## Goals

- Identify repeated agent friction and successful tool patterns from local
  histories and logs.
- Produce compact repo-scoped reports that can seed specs, fixtures, and
  durable docs.
- Keep the scanner offline, local-first, and safe to run against repositories
  without modifying them.
- Preserve enough excerpts to understand the signal while avoiding full
  transcript dumps.

## Non-Goals

- Do not build a full analytics warehouse in this slice.
- Do not upload histories or telemetry.
- Do not make mined excerpts authoritative without direct source or test
  verification.
- Do not replace OpenTelemetry or Jaeger; use history mining as a complementary
  local evidence source.

## Requirements

### Requirement 1: Repo-Scoped History Mining

**User Story:** As a maintainer, I want to scan Codex histories for a specific
repository, so that repeated agent friction becomes visible product evidence.

#### Acceptance Criteria

1. GIVEN a local Codex home and repository root, WHEN the scanner runs, THEN it
   SHALL summarize matching session prompts, transcript hits, and hook entries.
2. GIVEN a repository path appears in workdir/cwd fields or text snippets, WHEN
   filtering is enabled, THEN the scanner SHALL include that record in the
   repo-specific summary.
3. GIVEN a record does not match the requested repository or selected patterns,
   WHEN the scanner runs, THEN it SHALL omit that record from repo-scoped
   counts.

### Requirement 2: Friction Categories

**User Story:** As a product maintainer, I want mined signals grouped by
workflow category, so that backlog items are tied to repeated agent behavior.

#### Acceptance Criteria

1. GIVEN matching history text, WHEN it mentions tool startup, missing tools,
   timeouts, fallback, validation, diagnostics, wrong repo, dirty worktree,
   broad search, or user correction, THEN the scanner SHALL count it under a
   stable category.
2. GIVEN a category has examples, WHEN the report is generated, THEN it SHALL
   include bounded representative excerpts.
3. GIVEN hook logs are available, WHEN the scanner runs, THEN it SHALL include
   status and reason counts such as deferred checks, timeouts, and unknown tool
   failures.

### Requirement 3: Durable Product Follow-Up

**User Story:** As a maintainer, I want mined signals to map to possible Agent
Workbench improvements, so that scanning leads to executable work rather than
unstructured notes.

#### Acceptance Criteria

1. GIVEN category counts and examples, WHEN the report is written, THEN it
   SHALL include suggested backlog signals.
2. GIVEN the scanner detects repeated fallback or tool-use prompting, WHEN the
   report is written, THEN it SHALL identify the likely runtime surface that
   could reduce that friction.
3. GIVEN a scan is used for planning, THEN durable docs or specs SHALL be
   updated before implementation work closes.

## Correctness Properties

- The scanner must not modify the target repository.
- The scanner must not emit full transcripts by default.
- Category matching must be deterministic for the same inputs.
- Missing Codex or hook files must produce a partial report, not a crash.
- Repo filtering must be explicit and visible in the output.

## Durable Documentation Targets

- `docs/requirements/agent-workbench-principles.md`
- `docs/reference/codex-history-agent-tooling-scan-2026-06-06.md`
- `docs/design/observability-debugging-design.md`
- `docs/design/mcp-surface-design.md`
- `docs/design/edit-and-validation-loop-design.md`

## Success Criteria

- A maintainer can run one local command to summarize Codex history and hook
  friction for a repository.
- The generated summary identifies repeated agent friction categories and
  representative examples without dumping full transcripts.
- The scan result can seed follow-up specs for integration health, validation
  planning, diagnostics, traceability, or MCP-server support.
- Missing optional history or hook files do not prevent a partial report.
