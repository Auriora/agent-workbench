---
title: Plugin discoverability and drift hardening design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-13
---

# Technical Design

## Overview

Harden Agent Workbench as a Codex plugin package by adding discoverability
metadata, drift tests, clearer operator documentation, and CI validation. The
runtime remains MCP-owned. Plugin artifacts remain wrappers and launchers, not
alternate implementations.

## High-Level Design

Components:

- Repo-level plugin marketplace metadata or an explicit installer-owned
  marketplace decision.
- MCP discoverability metadata, preferably `.well-known/mcp/server-card.json`.
- Registry-to-guidance drift tests for MCP surfaces, plugin prompts, skill
  text, integration profile bindings, and server-card metadata.
- Plugin README and runbook updates for operator workflows.
- CI workflow for typecheck, tests, plugin validation, installer dry-run, and
  package manifest consistency.
- Research decision on Codebase Recon style git-history reconnaissance.

## Data Flow

```text
MCP registries
  -> integration profile
  -> plugin skill/default prompts
  -> server-card metadata
  -> docs/runbooks
  -> drift tests
```

The MCP registry is the authoritative source for public tools and resources.
Generated or maintained metadata must be validated against it.

## Low-Level Design

### Marketplace Metadata

Commit `.agents/plugins/marketplace.json` as repo-level marketplace metadata.
The entry identifies `agent-workbench`, points at `./plugins/agent-workbench`,
uses `AVAILABLE` installation and `ON_INSTALL` authentication policy, and keeps
the plugin category aligned with the Codex plugin manifest.

This does not replace the package installer's personal marketplace behavior.
The checked-in marketplace is repository metadata; the installer still writes
or updates `~/.agents/plugins/marketplace.json` for packaged installs.

### MCP Server Card

Add `.well-known/mcp/server-card.json` with:

- server name and description;
- local-first/privacy expectations;
- tools and resources;
- capability classes;
- setup requirements;
- link to package/plugin docs.

Maintain the card manually in Phase 1 and validate it directly against
`mcpResources` and `mcpTools`. The drift test compares names, URIs,
descriptions, capability classes, mutation classes, and budget policies so
registry changes fail when the committed card is stale.

### Drift Tests

Add focused tests under `tests/integration/` or `tests/plugin/` that load:

- MCP resource and tool registries;
- `plugins/agent-workbench/.codex-plugin/plugin.json`;
- `plugins/agent-workbench/skills/agent-workbench/SKILL.md`;
- `plugins/agent-workbench/.mcp.json`;
- server-card metadata if present;
- integration profile output.

Test rules:

- Registry surface names in the integration profile match the actual registry.
- Server-card entries match actual public registry entries.
- Plugin default prompts map to known workflows or MCP surfaces.
- Skill text does not name removed tools or obsolete install behavior.
- `.mcp.json` launches the installed package prefix and does not reference
  Codex plugin cache runtime code.

### Documentation Updates

Update:

- `plugins/agent-workbench/README.md` for user quick start, verification,
  update, uninstall, and hook trust.
- `docs/runbooks/codex-agent-workbench-plugin.md` for maintainer install,
  marketplace, plugin cache, hook trust, and troubleshooting.
- `docs/reference/documentation-map.md` if new server-card or CI docs are
  added.
- `docs/design/coding-agent-integration-design.md` if marketplace or
  cross-agent policy changes.

### CI Workflow

Add or update `.github/workflows/ci.yml` with jobs or steps for:

- `pnpm install --frozen-lockfile`;
- `pnpm typecheck`;
- `pnpm test`;
- plugin validation through the plugin-creator validator when available, or a
  repo-owned validation script if CI cannot depend on local Codex skills;
- `scripts/install-agent-workbench-package.sh --dry-run`;
- package manifest consistency checks.

Avoid CI steps that require local user Codex config, target repositories, or
network installs beyond normal dependency installation.

### History Reconnaissance

Do not add git-history reconnaissance directly to MCP in this spec unless the
design explicitly accepts local git command execution. Initial preferred path:

- Capture a follow-up backlog item or follow-up spec for a read-only history
  profile.
- Consider a debug command first, because it can be explicit about executing
  git commands and can stay outside default MCP behavior.
- Consider a separate skill workflow if cross-agent generic wording is more
  valuable than runtime integration.

## Operational Considerations

- Plugin hook trust is a user/session concern; docs should explain it but CI
  should not require interactive trust.
- Marketplace metadata must not assume a personal path when used from a
  repository marketplace.
- Server-card metadata should not imply remote hosting; Agent Workbench remains
  local-first.
- CI plugin validation must be reproducible in a clean runner.

## Open Questions

- Marketplace metadata is committed in Phase 1, while installer-owned personal
  marketplace writes remain supported for packaged installs.
- Server-card metadata includes resources and tools because both are public MCP
  registry surfaces.
- Server-card drift checks are metadata based in Phase 1; string-based skill,
  prompt, and docs drift checks are deferred to Phase 2.
- Should package manifest consistency be a custom test or a standalone script?
- History reconnaissance is deferred to a follow-up debug command or skill
  workflow, not a Phase 1 MCP surface.
