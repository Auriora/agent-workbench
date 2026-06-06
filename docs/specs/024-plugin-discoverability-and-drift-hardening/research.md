---
title: Plugin discoverability and drift hardening research
doc_type: spec
artifact_type: research
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Research

## Reference Inputs

This spec was prompted by comparison with two external plugin repositories.
Keep these references available for deeper analysis during implementation:

- Alcove: <https://github.com/epicsagas/alcove>
  - Reviewed local clone commit: `866c777 style(main): cargo fmt`
  - Notable files:
    - `.codex-plugin/plugin.json`
    - `.codex-plugin/hooks.json`
    - `registry/mcp.json`
    - `registry/skills/alcove/SKILL.md`
    - `registry/scripts/install.js`
    - `.well-known/mcp/server-card.json`
    - `glama.json`
    - `smithery.yaml`
    - `.github/workflows/ci.yml`
    - `.github/workflows/release.yml`
    - `CHANGELOG.md`
- Codebase Recon Skill: <https://github.com/yujiachen-y/codebase-recon-skill>
  - Reviewed local clone commit: `c414281 chore: mirror plugin.json to repo root for registry compatibility`
  - Notable files:
    - `.agents/plugins/marketplace.json`
    - `.codex-plugin/plugin.json`
    - `plugins/codebase-recon/.codex-plugin/plugin.json`
    - `skills/codebase-recon/SKILL.md`
    - `README.md`
    - `docs/specs/2026-04-09-codebase-recon-design.md`

The reviewed clones were temporary local evidence under `/tmp/`. This research
file is the durable pointer to the sources and comparison themes.

## Observed Patterns Worth Considering

### Repo-Level Marketplace Metadata

Codebase Recon ships `.agents/plugins/marketplace.json` in the repository. That
lets Codex install from a marketplace source without relying only on a local
installer to create a personal marketplace entry.

Agent Workbench currently has a package installer that writes or updates the
personal marketplace. A repo-level marketplace could make plugin installation
more inspectable and easier to test.

### MCP Discoverability Metadata

Alcove ships `.well-known/mcp/server-card.json`, `glama.json`, and
`smithery.yaml`. Agent Workbench already has a rich MCP registry and
integration profile, but no published server-card style inventory.

An Agent Workbench server card should be generated or validated against the MCP
registry so it does not drift from actual tools and resources.

### Skill And Tool Drift Controls

Alcove's changelog records fixes where skill tool tables drifted from actual
MCP tools. Agent Workbench has the same risk across:

- `plugins/agent-workbench/skills/agent-workbench/SKILL.md`
- `plugins/agent-workbench/.codex-plugin/plugin.json` default prompts
- `integration:///profiles/codex`
- durable MCP surface docs
- actual MCP resource and tool registries

This should become an automated test or generated inventory check.

### README And First-Run Experience

Alcove has a stronger first-run README pattern: problem framing, quick start,
setup, doctor, update, uninstall, and operational status checks. Agent
Workbench's plugin README is technically correct but sparse.

Agent Workbench should add concise operator steps:

- install from marketplace;
- verify `codex plugin list`;
- verify MCP discovery and health;
- understand hook trust;
- update and uninstall cleanly.

### Repository History Reconnaissance

Codebase Recon uses a two-phase git history workflow:

1. Probe repository size and calibrate time windows.
2. Run independent history queries for hotspots, bug magnets, bus factor,
   momentum, firefighting, recently added files, and active contributors.

This is useful for Agent Workbench as an optional read-only insight. The design
must decide whether git command execution belongs inside the runtime, a debug
command, or external skill guidance. It must not violate the current
no-target-command-execution boundary for MCP tool sweeps.

### Cross-Agent Skill Wording

Codebase Recon keeps skill instructions generic and avoids vendor-specific
tool names. Agent Workbench is Codex-first today, but the common integration
profile could support future cross-agent skill templates with generic
language.

### CI And Release Hardening

Alcove has CI for format, lint, tests, security audit, SBOM, cross-platform
build checks, and release packaging. Agent Workbench should add CI coverage for
plugin and package correctness, at minimum:

- `pnpm typecheck`;
- `pnpm test`;
- plugin validation;
- installer dry-run;
- package manifest consistency;
- dependency audit or SBOM generation.

## Patterns Not To Copy Blindly

Alcove auto-installs or updates its binary from a SessionStart hook. That is
convenient, but it conflicts with Agent Workbench's current preference for
quiet hooks, explicit package installation, and root-cause visibility.

For Agent Workbench, plugin hooks should stay quiet and non-repairing. A
future doctor or health surface may report missing installed package evidence,
but hooks should not perform network installs or hide setup failures.

## Research Questions

- Should Agent Workbench commit `.agents/plugins/marketplace.json`, or keep
  marketplace creation installer-owned?
- Should the MCP server card be generated from registry metadata or maintained
  manually with drift tests?
- Should plugin default prompts be tested against active MCP resources and
  tools?
- Should history reconnaissance be an MCP tool, a debug command, or a
  separate skill-only workflow?
- Should CI publish an SBOM or only validate package manifest dependency
  consistency for now?
