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
- [x] T002 Validate and prepare the exact release candidate.
  - Depends on: T001 for final gates; version/notes preparation may proceed first.
  - Requirements: Requirement 2; Requirement 3 AC1; CP-002.
  - Files: version manifests, release notes, package/runtime tests and evidence.
  - Acceptance: source/package/platform gates pass and identities agree.
  - Evidence: Corrective candidate91932a24ffc999a25111501046203fec6da1c315 passed source147 files/1536 tests plus one installed-only skip, typecheck, devcli28, plugin/skills, ordinary npm/native/daemon acceptance and installed entrypoint24/24. Cross-platform run42275040991 passed all four platforms plus actual no-push Docker build; Windows portable run42275045091 passed. v0.6.11 tag pushed.

  - Evidence mode: command
- [~] T003 Publish and verify the installed release.
  - Depends on: T001; T002.
  - Requirements: Requirement 3; CP-002; CP-003.
  - Files: release/installation evidence and backlog disposition.
  - Acceptance: governed immutable publication and verified live installation.
  - Evidence: v0.6.11 run42276022042 passed package/portable/GHCR and signed ZIP attestation; final create failed because Bash retained CR from CRLF sidecar filename. D003 resumes only final creation of exact retained assets after canonical validator repair (12 tests/typecheck passed). Independent source226/compiled3, signature/workflow/tag, GHCR revision and npm install dry-run verified. Live remains0.6.9.
  - Evidence mode: command
