---
title: MCP server repository support requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Requirements

## Introduction

Repositories that implement MCP servers need transport, session, tool-list,
HTTP/SSE, stdio, Docker, and log debugging context. Agent Workbench should
recognize MCP-server repo shapes and route agents to safe smoke checks without
executing unsafe commands.

## Durable Source Baseline

- [Agent Workbench executable backlog](../../requirements/agent-workbench-executable-backlog.md)
- [MCP surface design](../../design/mcp-surface-design.md)
- [Coding agent integration design](../../design/coding-agent-integration-design.md)
- [Edit and validation loop design](../../design/edit-and-validation-loop-design.md)

## Goals

- Detect repositories that implement MCP servers.
- Surface transport modes, server entrypoints, tool registries, protocol docs,
  smoke commands, and relevant logs where evidence exists.
- Plan initialize, tools/list, and call-tool validation without executing
  unsafe commands.

## Non-Goals

- Do not run MCP servers automatically.
- Do not perform network calls by default.
- Do not assume one MCP SDK or language.
- Do not replace integration health/session routing work.

## Requirements

### Requirement 1: MCP Server Shape Detection

**User Story:** As a coding agent, I want Agent Workbench to recognize MCP
server repositories, so that I can inspect the right entrypoints and validation
surfaces quickly.

#### Acceptance Criteria

1. GIVEN repo files that indicate MCP server implementation, WHEN context is
   requested, THEN the system SHALL surface likely server entrypoints,
   transports, tool registry files, and protocol docs.
2. WHEN multiple transports are present, THEN the system SHALL distinguish
   stdio, HTTP/SSE, streamable HTTP, Docker, and devcontainer evidence.
3. IF evidence is weak, THEN the system SHALL label it as heuristic and avoid
   claiming server readiness.

### Requirement 2: MCP Validation Planning

**User Story:** As a coding agent, I want safe MCP validation plans, so that I
can verify server behavior without guessing commands.

#### Acceptance Criteria

1. GIVEN MCP server evidence, WHEN `verification_plan` runs, THEN the system
   SHALL plan initialize, tools/list, and targeted call-tool smoke checks where
   repo scripts or docs provide evidence.
2. WHERE host commands are blocked by Docker/devcontainer policy, THE SYSTEM
   SHALL plan policy-compliant commands or report blocked evidence.
3. IF no safe command evidence exists, THEN the system SHALL return manual MCP
   smoke guidance rather than generic command execution.

## Correctness Properties

- MCP detection must be multi-language and evidence-labeled.
- Validation plans must not execute servers or network calls.
- Host-blocked policy takes precedence over generic MCP smoke commands.
- Context must remain bounded and avoid generated/vendor files.

## Success Criteria

- Fixture MCP server repos cover stdio, HTTP/SSE, streamable HTTP, Docker, and
  weak/ambiguous shapes.
- Context and verification golden tests show entrypoints, transports, tool
  registry evidence, and blocked/manual validation behavior.
