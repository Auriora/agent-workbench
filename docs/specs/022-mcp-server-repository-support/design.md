---
title: MCP server repository support design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-13
---

# Technical Design

## Overview

Add an MCP-server project-shape detector that operates on repository path,
config, and documentation evidence. It recognizes server entrypoints, tool
registry files, protocol docs, MCP config files, transport hints, and
container/devcontainer evidence without running the server.

## High-Level Design

Components:

- MCP project-shape detector in `mcp-server-shape.ts`.
- Overview platform, key-file, key-doc, and validation-hint routing additions.
- Task-context ranking additions for server entrypoints, tool registries, and
  protocol docs.
- Verification planning additions for MCP initialize/tools-list/call-tool smoke
  checks.
- Fixtures for stdio, HTTP/SSE, streamable HTTP, Docker/devcontainer, and
  ambiguous evidence repos.

## Low-Level Design

Detection evidence includes:

- tool registry files;
- server entrypoints;
- docs mentioning initialize, tools/list, call-tool, stdio, SSE, streamable
  HTTP, or MCP inspector;
- MCP config files such as `mcp.json`, `mcp-server.json`, and server cards;
- Docker/devcontainer evidence after MCP-specific evidence is present.

Detection is conservative path-shape routing, not semantic proof. Docker,
devcontainer, generated, vendor, fixture, cache, and temp paths must not create
standalone MCP-server detection without MCP-specific evidence.

Validation planning prefers repo scripts named `mcp:smoke`, `mcp:inspect`,
`inspect:mcp`, `mcp:stdio`, and `mcp:http`. It also emits a manual planned
smoke review named `mcp-initialize-tools-list-call-tool` that records transport,
entrypoint, and tool-registry evidence. Planning must not execute commands or
open network sessions.

## Operational Considerations

- Treat this as project-shape routing, not semantic proof.
- Label weak or heuristic evidence explicitly.
- Reuse existing platform, key-file, key-doc, reason, and validation-hint
  fields rather than adding a dedicated MCP-server context section.
- Defer live protocol diagnostics until integration health/session routing is
  stable.

## Open Questions

- No open questions remain for this implementation slice. Live protocol
  diagnostics and deeper SDK import parsing remain deferred until fixture-backed
  designs justify them.
