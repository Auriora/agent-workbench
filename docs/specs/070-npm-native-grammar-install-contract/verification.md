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

## Remote preflight checkpoint and correction

Candidate d45e42864a4429ceca0d64a14400bc8b5d0b75e8 is signed and passed all
four cross-platform jobs (Linuxx64/ARM64, macOS, Windows) in run42268596035.
Each job ran the shared six-parser/SQLite fixture and hook/MCP smokes.

Windows portable run42268600046 installed locked dependencies, deployed and
built the ZIP, then failed its installed Codex SessionStart hook invocation with
Windows path-syntax error. Root cause was the smoke harness: cmd.exe /s /c
strips the first/last quote of its command-string argument. The valid materialized
hook already quotes executable and script separately, so the harness must add
one enclosing quote pair while keeping windowsVerbatimArguments=true.

The bounded correction changes only the smoke invocation and its contract test;
installed hook generation and runtime payload are unchanged. Focused smoke/hook
suite8/8, typecheck and diff-check passed. Both remote preflights will rerun on
the revised signed candidate before tagging. No public release/tag or live
installation occurred at this failed checkpoint.

## Second portable preflight checkpoint

Candidate6b854f6f4c27384d1e84e44a58bc07e7aaec2dcf passed all four platform
jobs in run42270429182. Portable run42270432423 passed the corrected hooks,
then exposed a packaged CLI startup defect: import(absolutePath) was interpreted
as a d: URL on Windows. The single shared entrypoint now imports
pathToFileURL(entrypoint).href on every platform. No branch or fallback exists.
A real copied-bin fixture under a path containing# and spaces reproduces the
old failure and proves the fix; focused launch18/18, typecheck and diff passed.
Full source/installed and remote platform gates will validate the final candidate.
No tag or public release has been created at this checkpoint.

## Final v0.6.10 candidate acceptance

The tagged candidate is f45940fb5b02e8b03e110d396bcb673b8f6b85bb. It
supersedes the retained checkpoints above:

- Source: 147 files, 1536 tests passed; one conditional installed-only skip,
  252.62 seconds (/tmp/awb0610-final-source-tests.log).
- Typecheck passed (/tmp/awb0610-final-typecheck.log).
- Ordinary npm installation, clean dependency tree, all six native parser
  routes, SQLite, shared-daemon queries and complete cleanup passed
  (/tmp/awb0610-final-installed-smoke.log). Local tarball SHA-256:
  3fab7e99d53e8b85a5de86ca423da9346289a84e3abec91dc19387eead6c20b6.
- Retained installed entrypoint suite: 24/24 passed, 86.59 seconds
  (/tmp/awb070-installed-entrypoint-final.log). Host runtime pointer unchanged.
- [Cross-platform run 42272025612](https://github.com/Auriora/agent-workbench/actions/runs/42272025612)
  passed Linux x64, Linux ARM64, Windows and macOS.
- [Windows portable run 42272230510](https://github.com/Auriora/agent-workbench/actions/runs/42272230510)
  passed the built portable bundle, materialized hooks and packaged CLI.
- An initial dispatch of this candidate used a shortened commit identifier;
  checkout interpreted it as a branch and failed before running product code
  (run42272030730). The successful dispatch uses the full commit identifier.
- Annotated v0.6.10 tag pushed from the clean release worktree. Governed
  [publication run 42273149994](https://github.com/Auriora/agent-workbench/actions/runs/42273149994)
  is running. Publication and live upgrade evidence remain pending.

The local candidate hashes above are not claims about the future published
artifact, which includes the governed distribution build configuration.

## Publication checkpoint: v0.6.10

Release run42273149994 passed the package and Windows portable jobs, then
failed GHCR build before image push and public GitHub publication. The
Containerfile omitted pnpm-workspace.yaml, so pnpm's default
injectWorkspacePackages setting disagreed with the frozen lockfile. The
failure was ERR_PNPM_LOCKFILE_CONFIG_MISMATCH; the lockfile was not regenerated
and frozen validation was not bypassed.

The existing v0.6.10 tag is preserved. Corrective candidate v0.6.11 adds the
missing canonical build input. Publication and live installation remain
pending under T003. The live installation remains v0.6.9.

The corrective Containerfile passed a local Docker build before tagging:
`docker build --file packaging/agent-workbench/Containerfile --tag awb-ghcr-fix-local:validation .`.
Frozen installation, runtime build, approved native rebuild and image export
all completed. The focused container/plugin integration suite passed22/22;
typecheck passed. Linux x64 cross-platform preflight now includes this same
no-push container build. No lockfile rewrite or peer bypass was used.

## Corrective v0.6.11 candidate acceptance

Candidate91932a24ffc999a25111501046203fec6da1c315 is tagged v0.6.11.
The v0.6.10 tag remains unchanged after its failed publication checkpoint.

- Source suite:147 files/1536 tests passed, one conditional installed-only
  skip,304.95 seconds (/tmp/awb0611-source-tests.log).
- Dev CLI28 tests, plugin/skills validation and typecheck passed.
- Ordinary npm/native/daemon smoke and complete cleanup passed
  (/tmp/awb0611-installed-smoke.log). Six native grammar routes and SQLite
  passed with a clean npm dependency tree.
- Installed entrypoint suite:24/24 passed in77.77 seconds
  (/tmp/awb070-installed-entrypoint-final.log). Host pointer unchanged.
- [Cross-platform/container run42275040991](https://github.com/Auriora/agent-workbench/actions/runs/42275040991)
  passed Linux x64/ARM64, macOS, Windows and the actual no-push container build.
- [Windows portable run42275045091](https://github.com/Auriora/agent-workbench/actions/runs/42275045091)
  passed built bundle, native, hook and packaged startup checks.
- Local container identity:
  sha256:fa01a3ee0b63b24023b6b1e56ed2b6739f3789ad2c2db78b74a66a54db623356.
  This local validation image is not the future GHCR publication identity.
- [Release run42276022042](https://github.com/Auriora/agent-workbench/actions/runs/42276022042)
  is running from the immutable v0.6.11 source. Published asset hashes and live
  installation identity remain T003 evidence.

## Final publication gate correction

Run42276022042 passed package, Windows portable and GHCR publication. Its final
GitHub release creation failed before creation: Bash read retained CR from the
Windows sidecar's CRLF filename. The earlier ZIP hash gate and signed workflow
attestation passed; this was a filename-line-ending validation defect.

The canonical scripts/ci/verify-release-checksum.mjs now handles LF/CRLF and
strictly rejects wrong names, digests and malformed/multiple records. Both
workflow gates call it. Focused release tests12/12 and typecheck passed; it
verified the exact retained v0.6.11 ZIP and unchanged CRLF sidecar. D003 and the
packaging README govern completing only this final step using retained bytes.

Independent prepublication checks passed:226 source hashes match immutable
commit91932a24ffc999a25111501046203fec6da1c315; all3 compiled outputs match
the receipt; package/bin/sealed grammar archive bytes match that tag. GitHub
CLI2.103.3 was checksum-verified in a temporary directory because the host CLI
lacks attestation support. Cryptographic attestation verification confirms ZIP
SHA-256, exact repository/workflow/tag, source commit and run42276022042.
GHCR0.6.11 and latest match the expected source revision and manifest digest
sha256:bff3196952b3ae2397a653ee50cd9e926da89cf10ed4abe8ddeebe7140a1de1b.
Normal global npm install dry-run passed; live installation is still0.6.9.
