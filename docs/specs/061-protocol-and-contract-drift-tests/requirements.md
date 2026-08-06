---
title: Protocol and contract drift tests requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-08-06
---

# Requirements

## Introduction

EB029 requires one deterministic local guard against drift between source
schemas, MCP registration, durable contract documentation, examples, and safety
metadata.

## Goals

- Add `pnpm check:contracts` as the single local and CI entry point.
- Compare documented shared enums and MCP tools with runtime authorities.
- Validate JSON example enum values and executable next-action tool names.
- Fail closed when mutating-tool safety metadata is inconsistent.

## Non-Goals

- Network calls, source generation, runtime mutation, or broad prose parsing.
- A second MCP registry, schema authority, or compatibility fallback.

## Durable Source Baseline

| Source | Authority |
| --- | --- |
| `src/contracts/runtime-core-contracts.ts` | Shared runtime enum schemas |
| `src/interface-adapters/mcp/registries/index.ts` | Public MCP tool and safety metadata |
| `docs/reference/runtime-contracts.md` | Canonical durable contract documentation and examples |
| `.well-known/mcp/server-card.json` | Documented MCP tool projection |

## Requirements

### Requirement 1: Canonical local check

1. THE SYSTEM SHALL expose `pnpm check:contracts` and require no network.
2. THE CHECK SHALL compare a machine-readable enum snapshot in
   `docs/reference/runtime-contracts.md` with source Zod enum options.
3. THE CHECK SHALL compare `.well-known/mcp/server-card.json` tools with the
   actual `mcpTools` registry, including capability and mutation classes.
4. GIVEN aligned local authorities, WHEN the command runs, THEN THE SYSTEM
   SHALL exit successfully with no findings.

### Requirement 2: Examples and actions

1. Valid JSON examples SHALL use source-defined capability and verification
   status values.
2. Every `next_actions[].tool` in valid JSON examples SHALL name a registered
   public MCP tool.
3. GIVEN an invalid example value or action, WHEN the check runs, THEN THE
   SYSTEM SHALL return a stable finding and a failing exit status.

### Requirement 3: Safety policy

1. Every workspace-mutating tool SHALL use `workspace_write` capability and an
   explicit trust policy with `mutation_applied: true`.
2. Non-mutating and planning tools SHALL NOT claim applied mutation.
3. GIVEN inconsistent mutation metadata, WHEN the check runs, THEN THE SYSTEM
   SHALL fail closed.

### Requirement 4: Deterministic drift evidence

1. Findings SHALL have stable codes, paths, and ordering.
2. Fixture-backed tests SHALL prove clean documents and intentional drift for
   enums, tools, examples, actions, and mutation safety.
3. GIVEN the same inputs, WHEN the check is repeated, THEN THE SYSTEM SHALL
   return the same ordered findings.

## Correctness Properties

- CP-001: Source schemas and the MCP registry remain the runtime authorities.
- CP-002: Adding a source enum value or public tool fails until durable
  documentation is reconciled.
- CP-003: The check reads local files only and produces no repository writes.

## Durable Impact

- `docs/reference/runtime-contracts.md`
- `docs/design/mcp-surface-design.md`
- `docs/backlog/README.md`

## Success Criteria

- SC-001: Clean repository authorities pass `pnpm check:contracts`.
- SC-002: Fixture-backed intentional drift produces every required finding.
- SC-003: Typecheck, focused tests, and bounded full tests pass.

## Related Artifacts

- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
