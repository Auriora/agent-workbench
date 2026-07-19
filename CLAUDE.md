<!--
Copyright (C) 2026 Auriora
SPDX-License-Identifier: GPL-3.0-or-later
-->

# Claude Guidance

Read and follow `AGENTS.md` as the repository instructions for this project.

For non-trivial repository investigation, change evidence, or validation
planning, invoke `/agent-workbench:agent-workbench` when the Agent Workbench MCP
server is available. Skip this for trivial tasks.

The packaged skill owns the provider-neutral workflow, beginning with the
compact `repo:///orientation` receipt. SessionStart only advertises that skill;
it does not invoke Agent Workbench automatically.
