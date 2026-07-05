---
title: Per-repo runtime daemon and shared cache verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Quality Gates

- TypeScript type checking must pass.
- Focused daemon launcher tests must pass, including parallel cold-start
  election and POSIX owner-only runtime directory coverage.
- Real daemon-backed stdio entrypoint integration tests must pass.
- MCP stdio regression tests must pass.
- Documentation metadata/link checks must pass.
- Whitespace validation must pass.
- A real package entrypoint smoke must prove daemon-backed MCP status works.
- A concurrent multi-client dogfood sweep must show graph-backed results with no
  raw SQLite lock output.

## Automated Validation

- `pnpm typecheck` passed after daemon launcher, graph-store ownership, and
  integration-health contract changes.
- `pnpm exec vitest run tests/mcp/daemon-launch.test.ts` passed with nine
  daemon launcher and diagnostic tests, including parallel cold-start
  serialization, parallel stale-owner cleanup for same-repo clients, and
  owner-only POSIX metadata/IPC directories.
- `pnpm exec vitest run tests/mcp/daemon-entrypoint-integration.test.ts` passed
  with six process-level package entrypoint tests covering daemon-backed
  status, shared concurrent clients, idle-grace reconnect, crash replacement,
  and locked graph startup without raw SQLite lock text.
- `pnpm exec vitest run tests/mcp/daemon-launch.test.ts tests/mcp/stdio-entrypoint.test.ts`
  passed with 23 MCP/daemon tests.
- `pnpm exec vitest run tests/mcp/daemon-launch.test.ts
  tests/mcp/daemon-entrypoint-integration.test.ts tests/mcp/stdio-entrypoint.test.ts
  tests/mcp/repo-status-resource.test.ts tests/mcp/repo-scope-overview-resource.test.ts`
  passed with 55 MCP daemon, stdio, and resource contract tests after the
  parallel cold-start and owner-only IPC changes.
- `pnpm exec vitest run tests/mcp/debug-harness.test.ts -t
  "runs sample smoke reports into .tmp without modifying target repos"` passed
  after isolating the fixture repo into a temp copy and filtering generated
  runtime cache files from the source snapshot.
- `pnpm exec vitest run tests/docs/docs-links-metadata.test.ts` passed for
  durable documentation metadata and link validation.
- `pnpm test` passed with 77 test files and 543 tests after adding the
  process-level daemon entrypoint integration coverage, sanitized lock-output
  assertions, parallel daemon cold-start election, and owner-only POSIX runtime
  directory assertions.
- `git diff --check` passed.

## Manual And Dogfood Validation

- Real package entrypoint smoke: spawned `node src/mcp/stdio-entrypoint.mjs
  --repo-root tests/fixtures/fixture-mixed-language-platform`, initialized MCP,
  read `repo:///status`, and confirmed the daemon-backed response returned
  `runtime_state: fresh` for the fixture repo with empty stderr.
- Multi-client dogfood sweep: spawned two concurrent package launcher clients
  against this repository, initialized MCP, called graph-backed `symbol_search`
  for `createAgentWorkbenchServer`, and confirmed both clients returned 13
  fresh symbols with empty stderr and no raw `database is locked` text.

## Requirement Coverage

- Requirement 1: covered by first-client start, parallel same-repo cold-start
  serialization, parallel stale-owner cleanup, same-repo reuse, owner-only POSIX
  runtime directories, and different-repo isolation tests in
  `tests/mcp/daemon-launch.test.ts`.
- Requirement 2: covered by daemon-owned graph-store routing, existing locked
  graph startup and concurrent warmup tests in `tests/mcp/stdio-entrypoint.test.ts`,
  and the two-client dogfood sweep.
- Requirement 3: covered by connected-client tracking, short idle grace test
  construction, stale metadata cleanup, and crash/restart replacement behavior.
- Requirement 4: covered by optional `data.daemon` diagnostics on
  `integration:///health/agent-workbench` and the daemon health test.

## Evidence Log

| Evidence | Result |
| --- | --- |
| `pnpm typecheck` | Passed |
| `pnpm exec vitest run tests/mcp/daemon-launch.test.ts` | Passed, 9 tests |
| `pnpm exec vitest run tests/mcp/daemon-entrypoint-integration.test.ts` | Passed, 6 tests |
| `pnpm exec vitest run tests/mcp/daemon-launch.test.ts tests/mcp/stdio-entrypoint.test.ts` | Passed, 23 tests |
| `pnpm exec vitest run tests/mcp/daemon-launch.test.ts tests/mcp/daemon-entrypoint-integration.test.ts tests/mcp/stdio-entrypoint.test.ts tests/mcp/repo-status-resource.test.ts tests/mcp/repo-scope-overview-resource.test.ts` | Passed, 55 tests |
| `pnpm exec vitest run tests/mcp/repo-status-resource.test.ts tests/mcp/repo-scope-overview-resource.test.ts` | Passed, 26 tests |
| `pnpm exec vitest run tests/mcp/debug-harness.test.ts -t "runs sample smoke reports into .tmp without modifying target repos"` | Passed, 1 selected test |
| `pnpm exec vitest run tests/docs/docs-links-metadata.test.ts` | Passed, 2 tests |
| `pnpm test` | Passed, 77 files and 543 tests |
| Real `src/mcp/stdio-entrypoint.mjs` smoke | Passed, fixture status returned `runtime_state: fresh` |
| Two-client dogfood sweep | Passed, both clients returned 13 fresh symbols and empty stderr |
| `git diff --check` | Passed |

## Residual Risks

- Daemon diagnostics currently report `graph_freshness: unknown` until richer
  live graph freshness plumbing is added to the daemon health provider.
- The daemon health surface is MCP-only; no dev CLI doctor command shipped in
  this spec.
- Package install cleanup for stale daemon metadata remains outside this spec
  unless future installer evidence requires it.

## Residual Scope

- Spec 032 did not add a separate dev CLI doctor command. The accepted debug
  surface is MCP integration health.
- Package install cleanup for stale daemon metadata remains outside this spec
  unless a future installer issue requires it.
