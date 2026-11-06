---
title: Native grammar npm installation verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Quality Gates

Ordinary npm dependency/native smoke; typecheck; full source regression;
plugin/skills/contracts; dev CLI; tarball payload/install/compiled/installed smoke;
final installed entrypoint suite; Windows portable/release workflows; published
artifact and live installation identity.

## Evidence Log

Baseline09c7a12 has source145 files/1526 passed plus1 installed-only skip.
Official registry inspection found no newer Ruby/TypeScript metadata correction.
Dependency resolution and new-version acceptance are pending; prior source proof
is not this package's installed proof.

## Residual Risks

B008 conservative abandoned-guard handling remains a declared availability limit.
No native runtime downgrade, parser alternative or peer-bypass claim is allowed.

## Retained failed checkpoints

- Initial exact native/parser fixture run passed 4 files/12 tests; tamper rejection
  intentionally emits an error in its captured subprocess. No accepted parser change.
- First ordinary installed-smoke failed during install because npm could not
  resolve nested relative file:.tgz dependency paths. Cleanup passed completely
  (/tmp/awb070-installed-smoke.log). This is not installed acceptance.
- A scratch file-directory dependency probe installed but npm ls rejected its
  link/dependency metadata; that route is rejected. D002 uses immutable HTTPS
  artifact URLs instead. No peer-bypass flag or silent alternate path was added.
- Independent review rejected the initial provenance checker as self-attesting.
  Required fixes pin the source/member/archive identities independently and
  cover valid coordinated manifest/artifact tampering, not just corrupt bytes.

## V001: Native grammar dependency acceptance

- Preparation source commit: 7dda78adc98fb2c7c3e118ad5c902cfc53c3472d,
  pushed to release/v0.6.10. This is source preparation, not a public release.
- Anonymous HTTPS fetches of both full-commit URLs matched sealed SHA-256.
  Ruby: 3ec09920812e280e5e4237ccc45205f3c4b234271c8640f5111960acfad72c8e.
  TypeScript: a3e2e1088e152d742e3cae1466235fb91e4cc23e52696cbbbe91bfaa62fdc731.
- Two python3 scripts/native-grammar-artifacts.py --rebuild runs passed the
  independently pinned archive hashes (/tmp/awb070-artifact-rebuild.log and
  /tmp/awb070-artifact-rebuild-second.log). Offline check and seven tamper tests
  passed, including valid repacking with actual coordinated updated hashes.
- Dependency URL/integrity contract passed. pnpm's generic URL resolver omitted
  integrity initially; SHA-512 anchors were explicitly pinned in the supported
  lock resolution fields and enforced by the fixture. Frozen install passed.
- Ordinary npm installed-package smoke passed with clean npm ls and all cleanup
  receipts true (/tmp/awb070-installed-url-smoke-acknowledged.log). Candidate
  tarball SHA-256: f34e3d49922af1e835116d4b8a8f31b3196219b0c7f5b8fab7e356d9fa443144.
  This pre-final-helper candidate hash is not the future published asset hash.
- Installed runtime core 0.25.1; Go/JavaScript/Python 0.25.0; Ruby0.23.1-awb.1;
  TypeScript0.23.2-awb.1; SQLite12.11.1. These resolve through the declared
  supported ranges; source/portable lock remains separately verified.
- Native JavaScript, TypeScript, TSX, Python, Ruby and Go parsed correct roots
  without syntax errors; SQLite executed a query. Provider-labelled MCP clients
  shared one daemon and one refresh pass, with exact surviving/deleted evidence.
  Real Codex/Claude CLI discovery is not implied by these labels.

## Acceptance harness corrections

The initial native-proof harness incorrectly hardcoded core0.25.0 even though
^0.25.0 permits the resolved0.25.1, and assumed every language root was program.
It now checks the approved0.25 patch family, exact corrected grammar versions,
Python module and Go source_file roots and no syntax errors.

The next attempt passed native/dependency gates but correctly hit B006's eight
message admission limit: initialized notification plus eight parallel probes
coalesced into nine. The harness now awaits an acknowledged protocol ping after
initialized before the same eight parallel probes. Independent review confirmed
this sequencing barrier preserves admission coverage without retries, budget
changes or alternate paths. The subsequent full installed smoke passed.

## V002: Candidate source/package checks

Sequential validation passed typecheck, contracts, plugin and owned skills,
dev CLI, source native parser/SQLite fixture, install-shape, build and receipt,
compiled launch, hooks, package dry-run and the final ordinary installed smoke.
Logs: /tmp/awb070-final-<gate>.log. The installed smoke after extracting the
shared parser fixture retained the acknowledged eight-probe handshake and passed
all convergence, provider-label and cleanup assertions.

The first full candidate suite passed146 files/1534 tests but failed one current
install-version assertion (one installed-only skip). The version-bump tool omitted
the canonical Codex runbook, leaving its npm command at0.6.9 while metadata was
0.6.10. Fix: add that owner to CURRENT_DOC_PATHS, extend the existing CLI fixture
regression and update its four current baseline labels/command, preserving
historical behavior. Dev CLI tests and the focused22-test integration suite
passed. Full source regression is rerunning against this corrected frozen slice
(/tmp/awb070-full-final-after-bump.log). This checkpoint is not successful full
candidate evidence.

The cross-platform workflow now includes UbuntuARM64 and invokes the same shared
six-grammar/SQLite fixture used by the installed smoke. Exact upstream prebuild
bytes remain unchanged; normal native package build behavior handles incompatible
prebuilds. Remote platform evidence is still pending.

## Final local candidate gates

- Corrected frozen source suite: pnpm test --maxWorkers=1 passed147 files,
  1535 tests, one conditional installed-only skip in265.92s
  (/tmp/awb070-full-final-after-bump.log).
- Actual installed entrypoint suite:24/24 passed in47.03s, including the
  conditional same-version build-handoff and final admission saturation
  (/tmp/awb070-installed-entrypoint-final.log).
- Installed tarball SHA-256:
  bdfe3a7834950fc73731cdefce58e8967ab9ea4fba70a858e2807b4c668be711.
  This retained fixture suppressed only parent postinstall to preserve the
  host pointer and explicitly rebuilt approved natives; it supplements the
  separate ordinary npm/postinstall acceptance, not a replacement for it.
  Host runtime pointer was verified unchanged before/after this fixture.
- Release notes were regenerated from v0.6.9..7dda78a Git evidence, with actual
  validation notes. Consumer refinement includes unreleased Windows portable
  and privacy-bounded telemetry work already present in the branch. No closure
  claim is made for Specs063/064; no Spec065 files are part of this release edit.
- A release-note CLI display bug crashed after writing absolute-path evidence
  outside the repository. Fixed display formatting for all three outputs with
  a regression fixture; generation into /tmp now succeeds.
- Canonical dev CLI validation initially inherited host signing in disposable
  repositories using fake fixture identities and was interrupted (exit130).
  Fixed only repository-local signing configuration in those test fixtures;
  host/global signing and production Git behavior are unchanged. Canonical
  pnpm test:devcli now passes28 tests without environment workarounds.

All declared local source/package gates are green. Remote cross-platform and
Windows portable gates remain pending before T003 publication/installation.
