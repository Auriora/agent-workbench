---
title: PostHog analytics integration tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-08-15
---

# Tasks

**Input:** `requirements.md`, `design.md`, `change-impact.md`

## Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006
```

- [x] T001 Establish the analytics, privacy, and migration contract.
  - Depends on: none
  - Requirements: REQ-001 to REQ-004; CP-001 to CP-005
  - Files: `docs/specs/064-posthog-analytics-integration/`
  - Acceptance: Requirements, design, change impact, traceability, and
    verification define one explicit implementation path with no open blocker.
  - Evidence mode: contract
  - Evidence: User selected explicit dogfood MCP analytics, requested
    sanitization instead of raw exception autocapture, and authorized removal
    of the wizard CLI path on 2026-08-15. The lifecycle `spec_creation_plan`
    returned `next_spec_id: 064`, and the package lint later reported zero
    errors.

- [x] T002 Remove wizard CLI analytics and protect local configuration.
  - Depends on: T001
  - Requirements: REQ-001, REQ-002, REQ-003, REQ-004
  - Files: `.gitignore`, `.env.example`, `tools/devcli/pyproject.toml`,
    `tools/devcli/uv.lock`, `tools/devcli/src/auriora_dev/`
  - Acceptance: Python PostHog code, imports, captures, and dependencies are
    absent; `.env` is ignored without deleting it; the dev CLI lockfile matches
    its manifest.
  - Evidence: `.gitignore` now ignores `.env`; `.env.example` documents only the
    runtime PostHog variables; `tools/devcli/pyproject.toml` contains no
    PostHog/dotenv dependency declarations; `uv lock --check --project
    tools/devcli` passed on 2026-08-15; `pnpm test:devcli` passed on 2026-08-15.

- [x] T003 Implement the sanitized runtime PostHog adapter and lifecycle.
  - Depends on: T002
  - Requirements: REQ-001 to REQ-004; CP-001 to CP-005
  - Files: `src/infrastructure/telemetry/`, MCP instrumentation, daemon/server
    lifecycle, package manifests and lock, focused tests
  - Acceptance: PostHog is explicitly enabled, personless, allowlisted,
    failure-isolated, shared by daemon connections, and shut down once.
  - Evidence: Added `src/infrastructure/telemetry/posthog.ts`, composed runtime
    telemetry through `TelemetryRecorderPort`, removed repo-root and resource-URI
    emission from shared MCP instrumentation, injected one daemon-owned adapter
    across connections, and proved focused behavior with `pnpm exec vitest run
    tests/telemetry/posthog.test.ts tests/mcp/telemetry-instrumentation.test.ts
    tests/mcp/daemon-launch.test.ts` on 2026-08-15.

- [x] T004 Promote durable docs, validate, and resolve expert review.
  - Depends on: T003
  - Requirements: all
  - Files: canonical observability/architecture docs, verification record
  - Acceptance: Focused and full gates pass; privacy/security and correctness
    reviews are resolved or explicitly routed; durable docs match behavior.
  - Evidence: Durable docs were updated in
    `docs/design/observability-debugging-design.md` and
    `docs/design/layered-runtime-architecture.md`. Typecheck, focused tests,
    dev-CLI tests, plugin validation, runtime build receipt validation, package
    dry run, and `git diff --check` passed on 2026-08-15. A contended parallel
    full-suite run timed out broadly, while the complete single-worker rerun
    passed all 1,380 tests. Security review found no PostHog blocker; correctness
    review's wildcard-key and local-config-evidence blockers were fixed and
    covered by focused tests.

- [x] T005 Package distribution analytics defaults with an explicit opt-out.
  - Depends on: T004
  - Requirements: REQ-001, REQ-003, REQ-004; CP-001 to CP-005
  - Files: runtime PostHog configuration, runtime build scripts and tests,
    release workflows, package/runbook documentation, and Spec 064 artifacts
  - Acceptance: official release builds inject the PostHog project token into
    generated runtime artifacts without committing or logging it; source builds
    remain disabled; distributed builds default on; explicit runtime `false`
    creates no client; npm and Windows portable artifacts share the built
    runtime; missing release configuration fails packaging.
    The packaged README and install runbook disclose the default and show the
    explicit opt-out before launch.
    `recordError` also reaches PostHog Error Tracking through a stackless
    synthetic exception while original messages, stacks, paths, and throwable
    objects remain outside the SDK boundary.
  - Evidence mode: command and artifact
  - Evidence: REQ-001, REQ-003, and REQ-004: implemented build-injected defaults for official npm and Windows releases, explicit false/0 opt-out before client construction, README/runbook disclosure, and stackless synthetic PostHog Error Tracking with exact outbound reconstruction. Focused distribution/error/build/workflow tests passed 33 tests; typecheck, runtime build/receipt check, plugin validation, package dry-run (277 files), git diff check, and the full single-worker suite (131 files, 1,390 tests) passed on 2026-08-15. Independent security/privacy and correctness re-review found no remaining blocker.

  - Status: Distribution analytics defaults, transparent opt-out, and sanitized exception routing verified.

- [x] T006 Add separately enabled privacy-bounded PostHog operational logs.
  - Depends on: T005
  - Requirements: REQ-005; CP-002, CP-003, CP-005, CP-006
  - Files: PostHog logs infrastructure adapter, runtime telemetry composition,
    package dependencies and manifest, focused tests, `.env.example`, README,
    install runbook, canonical observability/architecture docs, and Spec 064
    artifacts
  - Acceptance: explicit logs opt-in creates one independent EU OTLP Logs
    provider; disabled/analytics-opt-out configurations create none; only
    fixed-body actionable WARN/ERROR summaries and bounded aggregate scalar
    attributes are exported; `recordError` is not duplicated; logs failures are
    isolated; OTEL trace configuration is unchanged; package and lifecycle
    validation pass.
  - Evidence mode: command, artifact, external
  - Evidence: Added `src/infrastructure/telemetry/posthog-logs.ts`, composed the
    separate logs provider through `src/infrastructure/telemetry/index.ts`,
    packaged the OTLP logs dependencies, documented the logs opt-in/opt-out and
    privacy boundary in README/runbook/design docs, and proved the slice with
    `pnpm exec vitest run tests/telemetry/posthog-logs.test.ts
    tests/telemetry/posthog.test.ts tests/mcp/telemetry-instrumentation.test.ts
    tests/mcp/daemon-launch.test.ts tests/mcp/runtime-build-contract.test.ts
    tests/integration/distribution-analytics-build.test.ts`, `pnpm typecheck`,
    `pnpm build-runtime:check`, `pnpm validate:plugin`, `pnpm pack:dry-run`,
    and `git diff --check` on 2026-08-15. A live PostHog logs query then
    returned one `agent_workbench.runtime_boundary_attention` row for
    `boundary_name=posthog_live_check` at `2026-08-15T12:21:35.577000Z` with
    only the expected bounded `boundary_*`, count, `outcome`, and
    `runtime_version` attributes.

## Execution Rules

- Do not add exception autocapture, original/raw-error export, a stable
  identifier, direct SDK calls outside the PostHog adapter, or a fallback
  exporter.
- Preserve unrelated Spec 063 and Windows smoke worktree changes.
- Do not inspect, print, edit, or delete the local `.env`; release configuration
  must enter through the build environment without appearing in logs.
- Mark tasks complete only with recorded implementation and validation evidence.
