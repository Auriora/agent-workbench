<!--
Copyright (C) 2026 Auriora
SPDX-License-Identifier: GPL-3.0-or-later
-->

# Agent Workbench Dev CLI

`tools/devcli` provides the `awb` command for repository-owned maintenance
workflows. The CLI is a thin wrapper over existing scripts and package commands;
it does not replace the Node runtime, installer, plugin validator, or spec
lifecycle runtime.

## Install

```bash
pip install --no-build-isolation -e tools/devcli
```

## Commands

Read-only or validation commands:

```bash
awb check
awb package check
awb plugin status
awb mcp smoke --repo .
awb cache inspect --repo .
awb spec list
awb spec summary docs/specs/028-dev-cli-workflow-tools
awb spec lint docs/specs/028-dev-cli-workflow-tools
awb doctor
awb release preflight
```

Local mutation commands:

```bash
awb package install-local
awb plugin refresh
```

Use `--dry-run` on package and plugin mutation commands before changing local
npm installs or Codex plugin registration.

## Validation

```bash
pnpm test:devcli
```

The CLI tests mock or inspect command composition and do not require a real
Codex plugin registry, Docker daemon, GitHub credentials, npm credentials, or
user-level Codex configuration.
