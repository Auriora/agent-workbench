---
title: Cross-platform packaging verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-29
---

# Verification

## Validation Strategy

Portability claims must be backed by **executed runs on each OS**, not static
review from a Linux host. The acceptance bar is a real platform matrix: CI jobs
on windows-latest, macos-latest, and ubuntu-latest, or — where a runner is
unavailable — a recorded manual run with the gap noted explicitly.

## Quality Gates

| Gate | Method |
| --- | --- |
| Resolver parity (P3) | Unit test `resolveInstallRoot` for `win32` and POSIX with injected env/platform |
| Install on Windows (R1) | Run `bin` installer on windows-latest with only Node + toolchain; assert files copied, launcher generated |
| MCP launch (R2) | Start server from `.mcp.json` on all three OSes; assert stdio handshake |
| Hook execution (R3) | Fire SessionStart + PostToolUse on all three OSes; assert advisory output, no shell error |
| Hook drift (P2) | `tests/integration/claude-plugin.test.ts` byte-identical guard stays green after re-sync |
| Single source (P2) | Assert no independently-maintained `.sh` install logic remains |
| Fail-loud (P4) | Force a missing prerequisite; assert actionable error, no partial install |
| Native build (R5) | On Windows without MSVC tools, assert actionable failure, not a half-install |

## Evidence Log

- Record per-OS CI run URLs or manual-run transcripts here as tasks complete.
  Each entry: OS, Node version, command, outcome, link.
- **Resolver parity (P3) — PASS.** Linux host, Node (repo toolchain),
  `npx vitest run tests/integration/install-root.test.ts` → 9 passed. Covers
  the `AGENT_WORKBENCH_INSTALL_ROOT` override on both OSes, the POSIX/darwin
  default, the Windows `%LOCALAPPDATA%` default and its `<home>\AppData\Local`
  fallback, and cross-host separator parity (win32 root resolved on a POSIX host
  with backslashes, and vice versa). Tasks T001a/T001b.
- **Shim launch plan (R2) — PARTIAL (unit).** Linux host,
  `npx vitest run tests/integration/mcp-launch.test.ts` → 6 passed. Verifies the
  shim spawns `node --import tsx <root>/src/mcp/stdio.ts` with `cwd: root`,
  defaults/preserves `AGENT_WORKBENCH_DEFAULT_REPO_ROOT`, passes argv through,
  and uses no shell. Full per-OS launch handshake remains for T011b. Task T002a.
- **Hook/shim drift (P2) — PASS.** `npx vitest run
  tests/integration/claude-plugin.test.ts` → all passed, including a new
  byte-identical guard for the vendored `mcp-launch.mjs`/`install-root.mjs` and
  an isolated-copy import test proving the shim stays self-contained (no `../..`
  escape). Task T002b.

## Residual Risks

- Native `tree-sitter` cross-platform build is deferred (Decision 1, resolved):
  Windows support ships with a documented toolchain prerequisite, not a turnkey
  binary. Only the core `tree-sitter` runtime binding compiles from source (it
  needs a C++20 toolchain); the four grammar packages already ship prebuilt
  binaries for all targets. The turnkey-core follow-up (prebuilt core via b1/b2)
  is tracked in `docs/backlog/`.
- Windows CI runner availability may force manual verification for some gates;
  any such gap must be recorded here, not silently skipped.
- `env`-field support on hook entries is assumed; the in-script default
  (task T008) is the mitigation if a runtime ignores it.

## Closure Readiness

`ready_to_close` requires: all gates evidenced on all three OSes (or gaps
recorded), durable platform-matrix doc promoted, and the native-build decision
resolved.
