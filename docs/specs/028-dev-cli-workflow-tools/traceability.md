---
title: Developer CLI workflow tools traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-07-04
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability

## Requirement To Delivery Matrix

| Requirement | Acceptance focus | Design sections | Tasks | Verification target |
| --- | --- | --- | --- | --- |
| R1 Project-Specific CLI Identity | Command name, package metadata, no template help | Package Identity | T001, T003 | CLI help and metadata tests |
| R2 Command Runner Contract | Shared execution, dry-run, failure propagation | Shared Runner, Error Handling | T002 | Runner unit tests |
| R3 Local Confidence Check | `pnpm typecheck`, `pnpm test`, `validate:plugin` | `awb check` | T004 | Command plan tests |
| R4 Package Validation | Validator, installer dry-run, pack dry-run, focused tests | `awb package check` | T005 | Package command tests |
| R5 Local Package Install | Installer pass-through and next-step guidance | `awb package install-local` | T006 | Option pass-through tests |
| R6 Plugin Refresh And Status | Codex plugin list, cachebuster, plugin add, restart note | `awb plugin status`, `awb plugin refresh` | T007 | Mocked Codex command tests |
| R7 MCP Smoke Check | Bounded MCP status/scope/tool workflow with timeout | `awb mcp smoke` | T008 | Smoke plan and timeout tests |
| R8 Cache Inspection | Read-only SQLite counts and bloat hints | `awb cache inspect` | T009 | Fixture SQLite tests |
| R9 Spec Lifecycle Wrappers | `docs/specs/<id>` scan, summary, lint wrappers | `awb spec` | T010 | Spec command tests |
| R10 Release Preflight | Dirty tree, package check, metadata, no publish | `awb release preflight` | T011 | Release preflight tests |
| R11 Documentation And Discoverability | READMEs and runbook update | Operational Considerations | T001, T014 | Documentation review |
| R12 Tests And CI Safety | Mock external commands, no user-local mutation | Test Strategy | T012, T013 | CLI tests and CI-safe validation |

## Task To Context Matrix

| Task | Requirements | Primary files | Evidence expected |
| --- | --- | --- | --- |
| T001 | R1, R11 | `tools/devcli/pyproject.toml`, `tools/README.md`, `tools/devcli/README.md` | Metadata diff and CLI install/help evidence |
| T002 | R2 | `runner.py`, `repo.py`, tests | Unit tests for dry-run, failure, root discovery |
| T003 | R1, R2 | `cli.py`, `commands/`, tests | Help output contains real command groups |
| T004 | R3 | `commands/check.py`, tests | Command plan and failure tests |
| T005 | R4 | `commands/package.py`, tests | Package check plan tests |
| T006 | R5 | `commands/package.py`, tests | Installer option pass-through tests |
| T007 | R6 | `commands/plugin.py`, tests | Mocked Codex available/unavailable tests |
| T008 | R7 | `commands/mcp.py`, optional `src/debug/`, tests | Bounded smoke and timeout tests |
| T009 | R8 | `commands/cache.py`, SQLite fixtures, tests | Read-only cache inspect tests |
| T010 | R9 | `commands/spec.py`, tests | Spec lifecycle wrapper tests |
| T011 | R10 | `commands/doctor.py`, `commands/release.py`, tests | Doctor and release preflight tests |
| T012 | R12 | `pyproject.toml`, `package.json`, CI if selected | Safe CLI test command evidence |
| T013 | R12 | `verification.md` | Validation command results |
| T014 | R11 | READMEs, runbook, documentation map | Durable docs updated |

## Design To Implementation Matrix

| Design section | Implementation tasks | Validation signal |
| --- | --- | --- |
| Command Groups | T003-T011 | CLI help tests list expected groups |
| Package Identity | T001 | Metadata and install tests |
| Shared Runner | T002 | Runner unit tests |
| Repository Root Discovery | T002 | Root override and discovery tests |
| `awb check` | T004 | Command plan tests |
| `awb package check` | T005 | Command plan tests |
| `awb package install-local` | T006 | Pass-through tests |
| `awb plugin status` and `refresh` | T007 | Mocked Codex tests |
| `awb mcp smoke` | T008 | Smoke plan tests |
| `awb cache inspect` | T009 | Fixture SQLite tests |
| `awb spec` | T010 | Spec path tests |
| `awb release preflight` | T011 | No-publish preflight tests |
| Test Strategy | T012, T013 | CLI test command and validation evidence |
| Operational Considerations | T014 | Documentation review |

## Open Decision Impact

All decisions that previously blocked implementation are resolved.

| Decision | Affected requirements | Affected tasks | Resolution |
| --- | --- | --- | --- |
| Primary CLI name: `awb` only or alias with `agent-workbench-dev` | R1, R11 | T001 | Resolved as `awb` only; no `proj` or secondary alias. |
| Package check integration tests default or optional | R4, R12 | T005, T012 | Resolved as optional `--with-integration`; default reports the skip. |
| Plugin cachebuster helper path external or repo-owned | R6, R12 | T007 | External documented Codex skill helper retained for this slice. |
| CLI test runner: pytest or standard library | R12 | T012 | Standard-library `unittest` exposed through `pnpm test:devcli`; no new Python test dependency. |
