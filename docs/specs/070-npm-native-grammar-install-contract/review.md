---
title: Native grammar package and release review
doc_type: spec
artifact_type: review
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Review

## Scope and roles

Independent security/operations and senior correctness/QA reviews inspected raw
D001/D002 source, manifest and archive contents, consumer dependency declarations,
lockfile, tests and durable owners. Untracked Spec065 and v0.1.1 draft/evidence
are excluded. This review does not infer installed proof from source tests.

## Blockers resolved

- Relative embedded file-tarball dependencies failed ordinary consumer npm
  resolution. A directory prototype failed clean dependency validation. D002
  replaces both with one full-commit HTTPS route, with anonymous fetched hashes,
  source ancestry, explicit lock integrity and a regression contract.
- The original checker trusted a mutable manifest to attest itself. Independent
  pinned archive, upstream, original-metadata and member-inventory constants now
  constrain every allowed field. Seven tests include valid native/metadata
  repacking with coordinated actual updated hashes; both attacks are rejected.
- The installed harness assumed a single exact runtime patch and universal
  program roots. Approved0.25 patch versions, exact corrected artifacts and
  each language's actual root/no-error contract now govern acceptance.
- Initialized plus eight probes exceeded the documented eight-message budget.
  An acknowledged ping barrier preserves all eight simultaneous probes without
  a retry, limit increase or alternate runtime path. Review confirmed ordering.
- Version bump omitted the Codex runbook; release-note output formatting assumed
  paths inside the repository. Both CLI defects have direct regression coverage.
  Disposable Git fixtures no longer inherit host signing preferences.

## Current readiness

Source integration and ordinary npm/native/runtime acceptance are ready:147
source files/1535 tests passed with the installed-only case covered by24/24
actual installed entrypoint cases. Typecheck, contracts, plugin/skills, CLI,
package and compiled/hook smokes passed. Final remote platform and publication
results must be recorded before claiming release or installed-host completion.

## Retained limits

No parser source or native payload bytes changed. Some upstream ARM64 prebuilds
are mislabeled; existing native package installation tests/builds compatible
bindings using the documented compiler prerequisites. The platform matrix now
includes Linux ARM64 and shares the native six-parser/SQLite oracle; actual
runner evidence remains required. B008 fail-closed abandoned-guard handling and
B009 diagnostic counting remain separately owned. Provider-labelled MCP clients
are not real Codex/Claude CLI discovery proof.
