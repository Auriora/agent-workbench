<!--
Copyright (C) 2026 Auriora
SPDX-License-Identifier: GPL-3.0-or-later
-->

# Tools

Put repository-owned developer tooling here.

Agent Workbench uses a dedicated Python CLI package:

- `tools/devcli/`: the `awb` developer CLI used for checks, package install,
  plugin refresh, MCP smoke checks, cache inspection, and spec helpers

Keep tooling code separate from application code so the project structure stays clear.
