<!--
Copyright (C) 2026 Auriora
SPDX-License-Identifier: GPL-3.0-or-later
-->

# Claude Guidance

Read and follow `AGENTS.md` as the repository instructions for this project.

Before broad repository inspection, use Agent Workbench first:

- Read `repo:///status`, `repo:///scope`, and `repo:///overview` when the
  Agent Workbench MCP server is available.
- Call the Agent Workbench `context_for_task` tool before broad file reads,
  search, or implementation planning.
- Prefer `docs_search`, `symbol_search`, `find_references`, `impact`,
  `diagnostics_for_files`, and `verification_plan` over ad hoc shell searches
  when those tools are available.
- If Agent Workbench tools are deferred, load or discover the schemas for
  `context_for_task`, `verification_plan`, `diagnostics_for_files`, and
  `docs_search` before falling back to native file tools.

Treat SessionStart hook output as orientation, not as the sole source of
workflow authority. This file is the Claude Code project guidance.
