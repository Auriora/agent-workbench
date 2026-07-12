---
title: Agent Workbench adoption flow requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-07-12
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Introduction

Recent coding-agent histories show that Agent Workbench is exposed more often
than its task workflow is completed. This spec turns that evidence into one
cross-client activation, orientation, continuation, navigation, and validation
guidance slice. It does not treat observational usage as proof of causality or
tool effectiveness.

## Goals

- Make one conditional, useful Agent Workbench entry action explicit in Claude
  Code without creating an automatic startup ritual.
- Reduce repeated orientation ceremony without hiding trust evidence.
- Turn task context into callable, evidence-backed continuation actions.
- Lower the friction of bounded symbol, reference, and impact navigation.
- Match validation guidance prominence to task intent and changed-file evidence.

## Non-Goals

- Repair chat-analyser import or outcome attribution.
- Add parser, semantic, validation, command-execution, or provider fallbacks.
- Claim that history observations prove effectiveness or adoption causality.
- Execute validation commands from `verification_plan`.
- Increase tool invocation counts as a success target.
- Add a combined public navigation tool without separate controlled evidence
  that it improves task decisions and total interaction cost.

## Durable Source Baseline

| Source | Current behavior relied on | Confidence | Notes |
| --- | --- | --- | --- |
| `docs/design/coding-agent-integration-design.md` | Owns provider integration guidance. | high | Claude activation promotes here. |
| `docs/design/mcp-surface-design.md` | Owns public MCP resource and tool behavior. | high | Orientation and continuation promote here. |
| `docs/reference/runtime-contracts.md` | Owns response trust and contract vocabulary. | high | No duplicate enums. |
| `docs/design/edit-and-validation-loop-design.md` | Owns validation workflow behavior. | high | Intent-aware guidance promotes here. |
| `docs/design/language-adapter-design.md` | Owns semantic capability and promotion gates. | high | Navigation must respect adapter evidence. |
| `docs/backlog/README.md` | Owns EB041 and EB048-EB050. | high | Evidence and residual routing. |

## Durable Impact

| Durable area | Action | Target | Notes |
| --- | --- | --- | --- |
| integration design | modify | `docs/design/coding-agent-integration-design.md` | Accepted cross-client activation guidance. |
| MCP design | modify | `docs/design/mcp-surface-design.md` | Accepted orientation and continuation behavior. |
| runtime contracts | modify if needed | `docs/reference/runtime-contracts.md` | Only for public response fields or semantics. |
| validation design | modify | `docs/design/edit-and-validation-loop-design.md` | Intent-aware recommendation policy. |
| semantic design | modify if needed | `docs/design/language-adapter-design.md` | Only if combined navigation changes capability gates. |

## Evidence Baseline

The 2026-07-10 through 2026-07-12 Codex 0.144.1 corpus contained 100
sessions: 79 showed an Agent Workbench interaction and 57 invoked a direct
tool. Direct calls totalled 273, including 70 `context_for_task`, 43
`verification_plan`, three `symbol_search`, four `find_references`, and zero
`impact` calls. Of the 57 direct-use sessions, 44 read all three orientation
resources, 49 used `context_for_task`, and 30 used `verification_plan`; 22
additional sessions stopped after resource interaction.

Claude history contained 10 top-level sessions and five subagent files. Six
files used analyser-supported Claude Code 2.1.206; three were conformance or
smoke histories and three were ordinary histories. None invoked Agent
Workbench. One unsupported 2.1.205 session read all three orientation
resources. These are bounded observational signals, not general adoption rates.

## Requirements

### Requirement 1: Executable Claude Activation

**User Story:** As a Claude Code agent, I want one explicit first Workbench
action, so that plugin exposure becomes a usable repository workflow.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN the packaged Claude plugin is active, WHEN a task needs repository
   investigation or change evidence and the runtime is available, THEN one
   concise guidance surface SHALL name the packaged Agent Workbench skill as
   the canonical entry action.
2. WHERE the Agent Workbench skill is packaged, THE SYSTEM SHALL validate that
   the documented name resolves to the packaged skill.
3. THE SYSTEM SHALL keep MCP as the executable runtime contract and SHALL NOT
   add Claude-specific runtime behavior.
4. THE SYSTEM SHALL NOT automatically invoke Agent Workbench, repeat the same
   activation instruction across startup surfaces, or imply that trivial tasks
   require it.

### Requirement 2: Snapshot-Aware Orientation

**User Story:** As a coding agent, I want one explicit orientation entry path,
so that I can obtain trustworthy repo context without redundant ceremony.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN no trusted orientation for the current snapshot, WHEN orientation is
   requested, THEN the system SHALL return one compact receipt containing
   snapshot identity, freshness, trust summary, material blockers, and explicit
   paths to detailed status, scope, and overview evidence.
2. WHILE the repository snapshot is unchanged, THE SYSTEM SHALL make safe reuse
   conditions visible without silently hiding evidence.
3. IF repository root, scope, policy, runtime identity, or index validity
   changes materially, THEN THE SYSTEM SHALL direct the agent to refresh
   orientation.
4. GIVEN an ordinary content edit that does not change orientation-relevant
   evidence, WHEN the next task step begins, THEN the system SHALL NOT require
   a repeated orientation call.
5. THE SYSTEM SHALL keep existing status, scope, and overview resource
   contracts available and SHALL NOT embed their full payloads in the default
   `context_for_task` response.

### Requirement 3: Executable Task Continuation

**User Story:** As a coding agent, I want task context to include callable next
actions, so that I can continue with bounded evidence instead of broad search.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN `context_for_task` identifies a material unresolved question, WHEN an
   additional tool call is expected to resolve it, THEN it SHALL present one
   primary and at most two secondary callable actions with usable arguments, a
   task-specific reason, and the evidence each action is expected to return.
2. WHERE a graph node is already resolved, THE SYSTEM SHALL include its node ID
   rather than require redundant symbol resolution.
3. IF no additional call has material expected value, THEN THE SYSTEM SHALL
   omit recommended actions rather than emit a generic tool menu.
4. IF a continuation is unsupported or incomplete, THEN the system SHALL put a
   compact explanation in task-relevant limitations only when the gap blocks
   the current task, and SHALL NOT substitute another parser or hidden route.
5. THE SYSTEM SHALL deduplicate actions already satisfied by returned evidence
   or previously unchanged guidance.

### Requirement 4: Bounded Navigation Flow

**User Story:** As a coding agent, I want low-friction definition, reference,
and impact evidence, so that I can assess changes before editing.

**Priority:** should-have

#### Acceptance Criteria

1. GIVEN a supported symbol, WHEN navigation is requested, THEN the system
   SHALL recommend the minimum next evidence needed: definition, references,
   impact, or relevant tests, without requiring the complete sequence.
2. THE SYSTEM SHALL improve the existing `symbol_search`, `find_references`,
   and `impact` continuation path before considering another public tool.
3. THE SYSTEM SHALL retain explicit partial or blocked states when semantic
   evidence is insufficient.
4. THE SYSTEM SHALL NOT add a combined navigation surface in this slice; any
   future proposal requires a separate controlled comparison proving fewer
   decisions and lower total tokens or latency without weaker provenance,
   pagination, capability boundaries, or failure attribution.

### Requirement 5: Intent-Aware Validation Guidance

**User Story:** As a coding agent, I want validation advice matched to my task,
so that edit work receives prominent verification guidance without burdening
read-only investigation.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN explicit edit intent, task-owned changed files, or closure evidence
   needs, WHEN task context is presented, THEN `verification_plan` SHALL be a
   prominent action when its command-selection evidence affects the next safe
   decision.
2. GIVEN a read-only investigation, WHEN task context is presented, THEN
   validation guidance SHALL be concise and SHALL NOT imply execution.
3. IF repository policy blocks a command, THEN the system SHALL preserve a
   structured blocked or degraded state without an alternate execution route.
4. THE SYSTEM SHALL determine recommendation prominence from explicit caller
   mode or user instruction first, task-owned edits second, lifecycle evidence
   third, and bounded task-text inference last; unrelated dirty files SHALL NOT
   be treated as task intent.
5. IF intent is unknown or conflicting, THEN validation guidance SHALL remain
   neutral rather than default to a prominent recommendation.
6. THE SYSTEM SHALL NOT repeat unchanged validation guidance within the same
   task phase.

## Correctness Properties

- **CP-001:** Equivalent repository snapshot and caller capability inputs yield
  equivalent orientation refresh guidance.
- **CP-002:** Every executable continuation names a callable surface and
  supplies schema-valid arguments, resolves a task-relevant uncertainty, and
  is not duplicated by evidence already returned.
- **CP-003:** Validation guidance never upgrades planned evidence to executed
  or passed evidence.
- **CP-004:** Provider guidance cannot change the provider-neutral MCP runtime
  contract.
- **CP-005:** Adding guidance cannot increase irrelevant recommended actions,
  required tool decisions, or default response bytes in controlled fixtures
  without an explicitly accepted quality benefit.

## Success Criteria

- **SC-001:** Cross-client fixtures prove one valid activation and orientation
  entry path for Codex, Claude Code, and Kiro.
- **SC-002:** Context golden tests cover executable continuation in supported,
  partial, and blocked states.
- **SC-003:** Navigation and validation behavior stays within existing query and
  first-read budgets or records an accepted budget change.
- **SC-004:** Adjudicated workflow fixtures show no regression in correct
  evidence acquisition, target selection, unsupported-call avoidance, final
  answer or implementation completeness, and unsupported-claim rate.
- **SC-005:** Against the current workflow on the same fixtures, the proposed
  flow does not increase irrelevant actions, required caller decisions, tool
  round trips, startup bytes, or default response bytes unless the review
  records a specific compensating quality improvement.

## Related Artifacts

- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
