---
title: MCP transport failure containment tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

Input: requirements.md, design.md, traceability.md and verification.md.
Tasks T001 and T002 have disjoint ownership and may run concurrently; this is
an explicit exception to the usual single in-progress task convention.

- [x] T001 Contain bridge output failure and terminal-event races.
  - Depends on: none.
  - Requirements: Requirement 1; CP-001, CP-004.
  - Files: src/mcp/stdio-launch.ts; tests/mcp/stdio-bridge-session.test.ts.
  - Acceptance: stdout EPIPE/close and stderr failure settle cleanly; event
    races settle once; listeners are cleaned; no daemon signalling or retries.
  - Evidence: pnpm exec vitest run tests/mcp/stdio-bridge-session.test.ts: 16 passed, including post-completion stdout EPIPE, stalled/delayed diagnostic handling and quiet terminal races. Architecture import boundary: 3 passed. Final integration fix defers guard deletion and listener removal together with setImmediate; no unhandled errors.

  - Evidence mode: command
- [x] T002 Bound socket frames and settle backpressured sends.
  - Depends on: none.
  - Requirements: Requirement 2, Requirement 3; CP-001, CP-002, CP-003.
  - Files: src/mcp/socket-transport.ts; src/mcp/daemon.ts (readHandshake only);
    src/contracts/mcp-transport-contracts.ts and its runtime barrel;
    tests/mcp/socket-transport.test.ts;
    tests/mcp/daemon-launch.test.ts (handshake tests only).
  - Acceptance: byte bounds including remainder, fragmentation, CRLF,
    coalescing and multibyte text; sends settle and clean all listeners;
    rejected client does not terminate another session.
  - Evidence: pnpm exec vitest run tests/mcp/socket-transport.test.ts tests/mcp/daemon-launch.test.ts: 65 passed; pnpm typecheck passed. Guarded onclose callbacks, frame/handshake boundary cases, other-client isolation and send settlement covered.

  - Evidence mode: command
- [x] T003 Route follow-up work and promote durable contracts.
  - Depends on: none.
  - Requirements: Requirement 4.2, Requirement 4.3.
  - Files: docs/backlog/README.md; durable targets in requirements.md.
  - Acceptance: B001/B002 have owner, priority, concrete acceptance and tests;
    all five review findings have an explicit disposition; delivered source
    changes are distinguished from installation and Spec 065's scope.
  - Evidence: Artifacts: docs/backlog/README.md and docs/specs/066-mcp-transport-failure-containment/traceability.md record all five dispositions; docs/design/runtime-operations-design.md, docs/reference/runtime-contracts.md and docs/runbooks/codex-agent-workbench-plugin.md promote source behavior. backlog_items returned B001/B002 accepted P0 and B003-B005 done, planning_state valid. Seven new link targets checked, nine docs checked with style advisories only; git diff --check passed.

  - Evidence mode: artifact
- [x] T004 Verify integration and review the delivered slice.
  - Depends on: T001, T002, T003.
  - Requirements: Requirement 4.1; CP-001 to CP-004.
  - Files: this package; tests and durable docs above.
  - Acceptance: typecheck, full tests and plugin validation pass; built-runtime
    fixture smoke and independent review have evidence and no open blockers.
  - Evidence: After frontmatter fix commit 8aa5094, pnpm test --maxWorkers=2 passed all 133 files and 1417 tests on 2026-11-06. Previous typecheck, plugin/contracts checks, build receipt and isolated compiled MCP smoke passed; MoE source review has no blockers and residual W1 is routed to B006. Implementation commit bb7abc1; no installed-runtime or release claim.
  - Evidence mode: command
  - Status: Verification complete; package retained with delivery evidence and deferred work routed.
