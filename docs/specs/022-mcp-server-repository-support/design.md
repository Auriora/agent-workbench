---
title: MCP server repository support design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Technical Design

## Overview

Add an MCP-server project-shape adapter that operates at the resource/config
and partial semantic level. It should recognize common MCP SDK imports,
manifest/config files, server entrypoints, transport setup, and docs references
without running the server.

## High-Level Design

Components:

- MCP project-shape detector.
- Context ranking additions for server entrypoints and protocol docs.
- Verification planning additions for MCP smoke checks.
- Fixtures for stdio, HTTP/SSE, streamable HTTP, Docker, and ambiguous repos.

## Low-Level Design

Detection evidence may include:

- package dependencies and imports for MCP SDKs;
- tool registry files or calls;
- server entrypoints and scripts;
- docs mentioning initialize, tools/list, call-tool, stdio, SSE, streamable
  HTTP, or MCP inspector;
- Docker/devcontainer evidence.

Validation planning must prefer repo scripts and documented smoke commands. It
must not run commands.

## Operational Considerations

- Treat this as project-shape routing, not semantic proof.
- Label weak or heuristic evidence explicitly.
- Defer live protocol diagnostics until integration health/session routing is
  stable.

## Open Questions

- Should MCP server support add a dedicated context section or reuse existing
  platform/key-file hints?
- Which smoke command vocabulary is portable enough for the first slice?
