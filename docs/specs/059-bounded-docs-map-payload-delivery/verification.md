---
title: Bounded docs map payload delivery verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-08-05
---

# Verification

## Scope

Spec 059 T001-T004: compact docs-map resource/tool delivery, continuation,
durable contract promotion, and source/package/client validation.

## Requirement Evidence

- Requirement 1:
  - AC1: presenter and resource tests prove parseable resource and tool
    serialization at or below 32,768 UTF-8 bytes.
  - AC2: compact-contract tests prove the response is compacted at the typed
    docs-map boundary rather than by arbitrary byte slicing.
  - AC3: blocked-output tests prove the structured blocked response names the
    missing evidence and a recovery action.
- Requirement 2:
  - AC1: fixture and live-corpus pagination prove truncated pages report
    `truncated: true`, preserve the full result count, and return the first
    unreturned cursor.
  - AC2: registry and tool tests prove the read-only `docs_map` tool accepts
    cursor parameters and the active session/per-call documentation scope.
  - AC3: continuation tests prove deterministic reachability of every eligible
    document once in order without rescanning a smaller corpus or skipping an
    oversized entry.
  - AC4: corpus and regression tests prove the scan, index, and extraction
    universe remain unchanged by compaction.
- Requirement 3:
  - AC1: contract tests prove exact repo-relative paths, bounded titles,
    authority/currency state, canonical-owner or supersession paths when
    present, and truthful omission counts.
  - AC2: presenter and durable-doc promotion records prove repeated direct-read
    guidance is represented once at map level.
  - AC3: contract and presenter tests prove `docs_outline` and
    `docs_read_section` remain the detailed follow-up surfaces.
  - AC4: warning-conservation tests prove total warning counts and truncation
    state are preserved and declared.
- Requirement 4:
  - AC1: fixture-backed tests cover the over-bound legacy-shaped corpus,
    multi-page continuation, UTF-8-safe field compaction, warning conservation,
    and structured blocked behavior.
  - AC2: MCP registry tests prove the resource default and `docs_map` tool
    share the compact contract while only the tool accepts cursor parameters.
  - AC3: typecheck, focused tests, the full Vitest suite,
    `pnpm validate:plugin`, `pnpm pack:dry-run`, and the installed or packaged
    stdio MCP smoke provide the packaged regression proof.

## Quality Gates

- Requirements acceptance criteria reviewed: required, passed. Evidence:
  requirements, design, traceability, and live payload evidence reconciled.
- Task evidence complete: required, passed. Evidence: T001-T004 carry
  implementation, validation, and promotion evidence.
- Automated tests pass: required, passed. Evidence: one full run passed 120
  files and 1,328 tests; the final rerun passed 1,327, and its sole
  load-sensitive warm-up test passed immediately in isolation.
- Durable documentation promoted: required, passed. Evidence: design,
  runtime contracts, changelog, server card, and packaged guidance updated.
- Governance conflicts resolved: required, passed. Evidence: senior review
  findings addressed; other findings classified below.

## Validation Commands

- Focused Vitest files for docs contracts and surfaces: compact contract,
  cursor, UTF-8, warning, and MCP wiring. Result: passed. Evidence: latest
  map-focused run covered 4 files and 53 tests; the registry/debug cross-check
  covered 4 files and 98 tests.
- `pnpm typecheck`: TypeScript contract integrity. Result: passed. Evidence:
  completed after the final presenter and package-smoke changes.
- `pnpm exec vitest run --maxWorkers=1`: full regression suite without worker
  concurrency. Result: passed with isolated load-sensitive proof. Evidence:
  one run passed 120 files and 1,328 tests; the final rerun passed 1,327
  tests plus the sole stdio warm-up test in isolation (1 passed, 15 skipped).
- `pnpm validate:plugin`: public registry/plugin metadata. Result: passed.
  Evidence: packaged plugin and server metadata agree.
- `pnpm pack:dry-run`: package payload. Result: passed. Evidence: npm package
  built and enumerated successfully.
- `node scripts/ci/mcp-launch-smoke.mjs`: checkout launcher transport. Result:
  passed. Evidence: the child ran from a fresh temporary workspace cwd while
  the install root still pointed at the checkout and the initialize handshake
  completed successfully.
- `CXXFLAGS=-std=c++20 node scripts/ci/installed-package-mcp-smoke.mjs`:
  isolated installed stdio map parse and byte bound. Result: passed. Evidence:
  both provider-labelled sessions parsed resource and tool maps at 4,356 and
  6,469 bytes respectively.

## Scope Reconciliation Before Closure

- 32 KiB map delivery and continuation: implemented in T001-T004; coverage
  state is complete; deferred or rejected work is none; destination is none;
  blocks closure is no; evidence is that six live pages cover all 66 exact
  paths and the largest pretty tool page is 32,576 bytes.
- Markdown table readability advisories: not implemented in this spec;
  coverage state is out-of-scope; deferred work is pre-existing advisory
  cleanup; destination is documentation maintenance/backlog when prioritised;
  blocks closure is no; evidence is the tool sweep.
- No registered prompts: not implemented in this spec; coverage state is
  out-of-scope; deferred work is no evidenced prompt use case; destination is
  none and intentional; blocks closure is no; evidence is the registry
  inventory.
- Docs direct-read freshness `unknown`: not implemented in this spec; coverage
  state is out-of-scope; deferred work is contract-intended direct-read
  semantics; destination is none; blocks closure is no; evidence is the
  runtime contract and current tests.
- Debug sweep parameter-space limits: not implemented in this spec; coverage
  state is out-of-scope; deferred work is the broader scenario matrix;
  destination is observability/debug harness backlog when prioritised; blocks
  closure is no; evidence is the debug harness design and tests.

## Agent Readiness Evidence

- Scope and out-of-scope files: evidence is the requirements non-goals and the
  design slice table; residual risk is none.
- Must-read context: evidence is AGENTS.md, MCP surface design, runtime
  contracts, and current source/tests; residual risk is none.
- Permissions: evidence is the user's explicit authorization to complete all
  recommended actions, including commit and local installation; residual risk
  is none within this repository and user-local install scope.
- Validation: evidence is the commands above; residual risk is none for the
  required gates recorded here.
- Review needs: evidence is the completed post-implementation senior
  correctness review and the fixes recorded above; residual risk is none.
- Durable-doc impact: evidence is the completed updates to all three promotion
  targets named in requirements/design; residual risk is none.
- Repo-evidence caveats: evidence is the initial Workbench snapshot refresh,
  direct source reads, packaged smoke, and the fresh local install; residual
  risk is none for the ordered install-and-smoke slice.

## Task Evidence

- T001: status complete. Evidence: compact map, strict cursor handling, byte
  packer, resource/tool split, and no discovery cap. Notes: senior
  cursor-safety finding addressed.
- T002: status complete. Evidence: UTF-8, blocked-entry, warning, exact-path
  pagination, registry, sweep, and installed transport tests. Notes: both
  serialization styles are bounded.
- T003: status complete. Evidence: durable design, runtime contract,
  changelog, server card, and three packaged skill copies updated. Notes:
  markdown check has warning-only advisories.
- T004: status complete. Evidence: full suite, package gates, installed
  transport, live-corpus probe, checkout launcher smoke, and senior review
  complete. Notes: the launcher now uses a fresh temporary cwd for the child
  process and leaves the default repo-root env unset.

## Evidence Log

- 2026-08-05: legacy `buildDocsMapEnvelope` size probe. Result: fail. Notes:
  the 50-document result serialized to 228,092 pretty bytes before
  compaction.
- 2026-08-05: `lint_spec_package` and `task_context`. Result: advisory. Notes:
  lifecycle structure had no errors; canonical-context review remained
  waivable.
- 2026-08-05: canonical-context advisory waiver. Result: recorded. Notes:
  durable canonical sources were reviewed directly, and copying them here
  would duplicate authority rather than add evidence.
- 2026-08-05: current-repository `getDocsMap`/`buildDocsMapEnvelope` probe.
  Result: pass. Notes: six pages returned 66 unique paths; largest pretty tool
  page was 32,576 bytes.
- 2026-08-05: `node scripts/ci/mcp-launch-smoke.mjs`.
  Result: pass. Notes: the child ran from a fresh temporary workspace cwd and
  the initialize handshake succeeded against the checkout install root.
- 2026-08-05: `CXXFLAGS=-std=c++20 node scripts/ci/installed-package-mcp-smoke.mjs`.
  Result: pass. Notes: both sessions parsed resource/tool maps at 4,356/6,469
  bytes; all cleanup receipt fields were true.
- 2026-08-05: senior review of `query-docs.ts`, `docs-presenter.ts`, and
  package guidance. Result: pass after fixes. Notes: invalid cursors block;
  scope descriptions and static resource actions agree.
- 2026-08-05: `checkMarkdownSet` on eight changed documents. Result:
  advisory. Notes: historical pre-cleanup advisory had 78
  `markdown.table.readability` warnings; the current five-file targeted check
  has zero `markdown.table.readability` findings.

## Residual Risks

- Live installed-client proof is recorded in the local install and package
  smoke evidence above. The isolated package and stdio route already pass.

## Durable Promotion And Cleanup

- Public resource/tool behavior: durable destination is
  `docs/design/mcp-surface-design.md`; status is complete; evidence is T003.
- Schemas, bounds, and cursor semantics: durable destination is
  `docs/reference/runtime-contracts.md`; status is complete; evidence is T003.
- Agent-visible behavior change: durable destination is
  `docs/reference/agent-readable-changelog.md`; status is complete; evidence is
  T003.
- Other findings: durable destination or deferral is the scope reconciliation
  section above; status is recorded; evidence is this artifact.

### Spec Cleanup Decision

- **Cleanup action:** keep active until the final commit record is written;
  closure remains a separate lifecycle action.
- **Reason:** Implementation, launcher smoke, and local-install evidence are
  complete, while the current working tree still needs its commit record.
- **Final spec commit:** pending
- **Closure log entry updated:** no

## Ship Or Closure Risk

- **Risk level:** low
- **Breaking change:** compact map entry projection; URI remains stable
- **Blast radius checked:** yes; registries, debug sweep, package metadata, and installed transport covered
- **Rollback path:** source/package commit reversal; no stored data migration
- **Requires human review:** no, but senior agent review is required locally
- **Release notes needed:** yes, agent-readable changelog in T003

## Readiness Decision

- **Ready for promotion:** yes
- **Ready for release:** yes after commit/package versioning
- **Ready for closure:** no

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
