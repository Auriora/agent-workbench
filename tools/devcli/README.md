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
awb release notes --from v0.3.0 --to HEAD --version 0.4.0 --dry-run
```

Local mutation commands:

```bash
awb package install-local
awb plugin refresh
```

Use `--dry-run` on package and plugin mutation commands before changing local
npm installs or Codex plugin registration.

## Release Notes

Generate first-pass release notes from Git evidence before publishing a GitHub
release:

```bash
awb release notes \
  --from v0.3.0 \
  --to HEAD \
  --version 0.4.0 \
  --output docs/release-notes/v0.4.0-draft.md \
  --evidence-output docs/release-notes/v0.4.0-evidence.json \
  --agent-instructions docs/release-notes/v0.4.0-agent.md
```

The default output is a generated draft. Review it manually or with an
LLM-backed agent before using it as release notes:

```bash
awb release github 0.4.0 --notes-file docs/release-notes/v0.4.0.md
```

`awb release notes` uses Git history and changed-file evidence only. It does not
query GitHub or claim validation unless `--validation-note` or
`--validation-file` is supplied. `--dry-run` prints the draft and creates no
files or directories.

## Validation

```bash
pnpm test:devcli
```

The CLI tests mock or inspect command composition and do not require a real
Codex plugin registry, Docker daemon, GitHub credentials, npm credentials, or
user-level Codex configuration.
