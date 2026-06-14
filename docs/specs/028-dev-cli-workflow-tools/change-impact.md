---
title: Developer CLI workflow tools change impact
doc_type: spec
artifact_type: change-impact
status: active
owner: platform
last_reviewed: 2026-06-14
---

# Change Impact

## Durable Source Mapping

| Durable source | Change type | Expected update |
| --- | --- | --- |
| `tools/README.md` | modify | Replace generic tooling note with Agent Workbench CLI install and command overview. |
| `tools/devcli/README.md` | modify | Replace template commands with project-specific `awb` commands, mutation boundaries, and examples. |
| `docs/runbooks/codex-agent-workbench-plugin.md` | clarify | Mention CLI wrappers for package check, install-local, plugin refresh, and plugin status while preserving underlying commands. |
| `docs/reference/documentation-map.md` | clarify | Add `tools/` developer CLI docs as a repository tooling reference if documentation map currently omits it. |
| `package.json` | optional modify | Add a script for running CLI tests if selected during implementation. |
| `.github/workflows/ci.yml` | optional modify | Add CLI tests only if they are stable and do not require user-local tools. |

## Proposed Changes

| Area | Change type | Notes |
| --- | --- | --- |
| `tools/devcli/pyproject.toml` | modify | Rename package metadata and script entry point from template `proj` to project-specific CLI. |
| `tools/devcli/src/auriora_dev/cli.py` | modify | Replace placeholder commands with real Typer app composition. |
| `tools/devcli/src/auriora_dev/runner.py` | add | Shared subprocess runner and dry-run support. |
| `tools/devcli/src/auriora_dev/repo.py` | add | Repository root discovery and path handling. |
| `tools/devcli/src/auriora_dev/commands/` | add | Command group modules for check, package, plugin, MCP, cache, spec, release, and doctor. |
| `tools/devcli/tests/` | add | CLI unit tests with mocked external commands and fixture SQLite data. |

## Behavior Impact

- Adds a developer convenience CLI for repetitive local workflows.
- Does not change Agent Workbench runtime behavior.
- Does not change MCP contracts.
- Does not change package installer semantics.
- Does not change plugin validation semantics.
- Does not change release workflows except adding a local preflight wrapper.

## Migration Notes

- Existing documented commands remain valid.
- The template `proj` command should be removed or made a temporary alias.
- Contributors should install the CLI with:

```bash
pip install --no-build-isolation -e tools/devcli
```

- If a `pnpm` wrapper script is added, documentation should prefer that for
  repository-local validation.

## Promotion Targets

- `tools/README.md`
- `tools/devcli/README.md`
- `docs/runbooks/codex-agent-workbench-plugin.md`
- `docs/reference/documentation-map.md`
- optional CI or package script documentation if added
