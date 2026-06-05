---
title: Agent IDE runtime MVP quickstart
doc_type: spec
status: archived
owner: platform
last_reviewed: 2026-06-03
---

# Quickstart

## Purpose

Describe the expected first smoke path once runtime implementation exists.

## Prerequisites

- Runtime source has been added under `src/`.
- Test fixtures exist under `tests/`.
- Local dependencies are installed.

## Steps

1. Start the runtime against a fixture repository.
2. Read `repo:///status` and verify scope, freshness, and adapter coverage.
3. Read `repo:///scope` and `repo:///overview` and verify they do not trigger
   source scans or broad graph analysis.
4. Run `context_for_task` for a known fixture change and verify ranked files,
   complete-enough markers, skipped-work metadata, direct-read caveats, and
   exact next actions.
5. Follow the context next actions to query `symbol_search`,
   `find_references`, and bounded `impact` for known fixture symbols.
6. Preview and apply a bounded edit.
7. Run `verification_plan` and verify commands are planned, not executed by
   default, with planned versus proven runnable checks clearly distinguished.
8. Run workspace-safety negative checks from the MVP proof matrix.

## Codex Host-Level MCP Launch

For local replacement testing, configure Codex to launch the MCP server from
this repository checkout rather than from a copied plugin package. Restarting
Codex picks up source changes. Dependency changes require `pnpm install`.

Example `~/.codex/config.toml` entry:

```toml
[mcp_servers.agent-workbench]
enabled = true
command = "/home/bcherrington/.config/nvm/versions/node/v24.8.0/bin/node"
args = [
  "--import",
  "tsx",
  "/home/bcherrington/Projects/Auriora/agent-workbench/src/mcp/stdio.ts"
]
```

Do not set `AGENT_WORKBENCH_DEFAULT_REPO_ROOT` for normal Codex use. With no
explicit default, the MCP server uses Codex's active working directory as the
default repo root, so `repo:///status`, `repo:///scope`, `repo:///overview`, and
tool calls without `repo_root` bind to the current workspace.

Use an explicit override only for a fixed target repo or non-Codex launch
environment:

```toml
[mcp_servers.agent-workbench.env]
AGENT_WORKBENCH_DEFAULT_REPO_ROOT = "/path/to/target/repo"
```

The MCP resources and tools also accept explicit `repo_root` arguments where
defined. This matters when a client starts global MCP servers from a directory
that is not the target repository, but it should not be required for ordinary
Codex workspace sessions.

The first coding workflow tool is `context_for_task`. Use it before broad file
reads when you have a task prompt, known files, or symbols and need compact
status, file, docs/config, risk, and validation routing evidence.

Optional OpenTelemetry export:

```toml
[mcp_servers.agent-workbench.env]
AGENT_WORKBENCH_OTEL_ENABLED = "true"
AGENT_WORKBENCH_OTEL_DESTINATION = "otlp_http"
AGENT_WORKBENCH_OTEL_ENDPOINT = "http://localhost:4318/v1/traces"
```

For a direct local launch outside Codex:

```bash
pnpm mcp -- --repo-root tests/fixtures/fixture-mixed-language-platform
```

## Codex Plugin Wrapper

The repo-local Codex plugin wrapper lives at `plugins/agent-workbench/`.

It includes:

- `.codex-plugin/plugin.json`
- `skills/agent-workbench/SKILL.md`
- `hooks/hooks.json`
- `hooks/session-start.js`
- `hooks/post-edit-feedback.js`

The plugin is a wrapper only. It installs workflow guidance and optional quiet
hook artifacts; it does not register the executable MCP server. Keep the
host-level `mcp_servers.agent-workbench` entry above as the single runtime path
so Codex launches this repository checkout instead of a copied plugin cache
path. Hook scripts are silent by default. Set `AGENT_WORKBENCH_HOOK_FEEDBACK=basic`
only when concise MCP follow-up guidance is useful during local testing.

This archived quickstart is delivery evidence for Spec 001. Current operational
setup guidance lives in
[Codex Agent Workbench plugin and MCP setup](../../runbooks/codex-agent-workbench-plugin.md).

## Expected Results

The runtime returns compact MCP responses using the shared response envelope.
Validation plans should name concrete diagnostics or tests for the fixture
change without executing commands by default.
Compact/default responses should not hide broad orientation, full topology,
diagnostics execution, or high-cardinality cache validation behind small
payloads. If evidence is skipped or low confidence, the response should include
the exact follow-up call that recovers it.

## Cleanup

Stop the runtime and remove generated cache state if the test runner does not
clean it automatically.
