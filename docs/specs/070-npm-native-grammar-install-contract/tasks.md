---
title: Native grammar npm installation tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

- [x] T001 Settle and implement the npm native grammar contract.
  - Depends on: bounded resolution experiment and recorded design decision.
  - Requirements: Requirement 1; CP-001.
  - Files: package/lock/native-grammar packaging and focused fixtures.
  - Acceptance: ordinary npm install/dependency validation and exact grammar proof.
  - Evidence: Preparation commit 7dda78adc98fb2c7c3e118ad5c902cfc53c3472d seals reviewed exact upstream payloads with metadata-only deltas. Two rebuilds reproduced pinned archives; 7 tamper tests and dependency URL/integrity test passed. Anonymous URL fetches match sealed SHA256; pnpm frozen install passed. Ordinary npm install/npm ls, all six installed native grammars, SQLite, shared-daemon convergence/deleted-evidence and cleanup passed in scripts/ci/installed-package-mcp-smoke.mjs (/tmp/awb070-installed-url-smoke-acknowledged.log). No peer flags/consumer overrides/parser substitution.

  - Evidence mode: command
- [~] T002 Validate and prepare the exact release candidate.
  - Depends on: T001 for final gates; version/notes preparation may proceed first.
  - Requirements: Requirement 2; Requirement 3 AC1; CP-002.
  - Files: version manifests, release notes, package/runtime tests and evidence.
  - Acceptance: source/package/platform gates pass and identities agree.
  - Evidence: v0.6.10 version metadata and reviewed draft notes prepared. Ordinary npm installed/native/daemon acceptance passes. Final source/package suite, installed entrypoint suite and supported-platform workflows pending; shared native fixture helper/ARM64 matrix being finalized.

- [ ] T003 Publish and verify the installed release.
  - Depends on: T001; T002.
  - Requirements: Requirement 3; CP-002; CP-003.
  - Files: release/installation evidence and backlog disposition.
  - Acceptance: governed immutable publication and verified live installation.
  - Evidence: pending.
