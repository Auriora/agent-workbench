<!--
Copyright (C) 2026 Auriora
SPDX-License-Identifier: GPL-3.0-or-later
-->

# Agent Workbench Claude Code Guidance

Use the Agent Workbench MCP server before broad repository inspection.

- Read `repo:///status`, `repo:///scope`, and `repo:///overview` when available.
- Call `context_for_task` before broad reads, search, or implementation
  planning.
- Prefer `docs_search`, `symbol_search`, `find_references`, `impact`,
  `diagnostics_for_files`, and `verification_plan` for navigation and
  validation planning.
- If tool schemas are deferred, discover or load `context_for_task`,
  `verification_plan`, `diagnostics_for_files`, and `docs_search` before
  falling back to native file tools.

Do not hardcode client-specific wrapper names. Claude Code, Codex, and other
clients may expose different wrapper prefixes for the same Agent Workbench MCP
surfaces.
