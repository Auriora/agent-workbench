---
title: PostHog analytics integration verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-08-15
---

# Verification

## Scope

Spec 064 removal of wizard Python analytics and delivery of explicit,
privacy-bounded PostHog analytics and separately enabled operational logs
through the TypeScript runtime telemetry port.

## Quality Gates

| Gate | Required? | Status | Evidence |
|---|---|---|---|
| Requirements and design reviewed | yes | pass | user direction and pre-implementation review findings incorporated |
| Python CLI analytics removed and lock current | yes | pass | T002; REQ-001 to REQ-004; `uv lock --check --project tools/devcli` and `pnpm test:devcli` passed on 2026-08-15. |
| Sanitizer and configuration tests | yes | pass | T003; REQ-001 to REQ-003; `pnpm exec vitest run tests/telemetry/posthog.test.ts` passed on 2026-08-15. |
| MCP and daemon lifecycle tests | yes | pass | T003; REQ-002 to REQ-004; `pnpm exec vitest run tests/mcp/telemetry-instrumentation.test.ts tests/mcp/daemon-launch.test.ts` passed on 2026-08-15. |
| `pnpm typecheck` and full tests | yes | pass | T003-T004; REQ-001 to REQ-004; typecheck passed and `pnpm exec vitest run --maxWorkers=1` passed all 1,380 tests. |
| Plugin and package validation | yes | pass | T004; REQ-004; `pnpm validate:plugin`, `pnpm build-runtime:check`, and `pnpm pack:dry-run` passed. |
| Durable documentation promotion | yes | pass | T004; REQ-001 to REQ-004; observability and layered-runtime design docs updated on 2026-08-15. |
| Security/privacy and correctness review | yes | pass | T003-T004; REQ-001 to REQ-004 and CP-001 to CP-005; security found no PostHog blocker, and correctness blockers were fixed with exact-key and local-evidence tests. |
| Distribution defaults and opt-out | yes | pass | T005; source-default, configured distribution-default, explicit opt-out, missing-token failure, npm/Windows workflow wiring, synthetic release build, and package dry-run passed on 2026-08-15. |
| Sanitized PostHog Error Tracking | yes | pass | T005; synthetic stackless exception input, exact category allowlist, reconstructed `$exception`, sensitive-field stripping, invariance, and failure isolation passed on 2026-08-15. |
| Privacy-bounded PostHog OTLP Logs | yes | pass | T006; REQ-005 and CP-006; focused config/privacy/lifecycle tests, typecheck, build/package/docs checks, and a live PostHog logs receipt passed on 2026-08-15. |

## Validation Commands

| Command | Purpose | Result |
|---|---|---|
| `uv lock --check --project tools/devcli` | Python dependency consistency | pass |
| `pnpm test:devcli` | wizard-removal regression | pass |
| `pnpm exec vitest run tests/telemetry/posthog.test.ts tests/mcp/telemetry-instrumentation.test.ts tests/mcp/daemon-launch.test.ts` | privacy, behavior, lifecycle | pass |
| `pnpm exec vitest run tests/docs/docs-links-metadata.test.ts` | durable docs metadata/links | pass |
| `pnpm typecheck` | TypeScript integrity | pass |
| `pnpm exec vitest run --maxWorkers=1` | full regression without worker contention | pass; 130 files and 1,380 tests |
| `pnpm validate:plugin` | packaged plugin integrity | pass |
| `pnpm build-runtime:check` | generated runtime receipt | pass |
| `pnpm pack:dry-run` | distribution dependency/content proof | pass |
| synthetic configured build and package dry-run | build-time injection without receipt leakage | pass; configured bundle contained the synthetic token, the receipt did not, and the final source-default rebuild removed it |
| `pnpm exec vitest run tests/telemetry/posthog.test.ts tests/integration/distribution-analytics-build.test.ts tests/mcp/runtime-build-contract.test.ts tests/integration/release-notes-publishing.test.ts` | distribution, exception privacy, build, and release workflow | pass; 4 files and 33 tests |
| spec package lint, evidence, and task audit | lifecycle integrity | pass; zero diagnostics |
| `pnpm exec vitest run tests/telemetry/posthog-logs.test.ts tests/telemetry/posthog.test.ts tests/mcp/telemetry-instrumentation.test.ts tests/mcp/daemon-launch.test.ts tests/mcp/runtime-build-contract.test.ts tests/integration/distribution-analytics-build.test.ts` | T006 config, privacy, payload, lifecycle, and packaging interactions | pass; 6 files and 98 tests |
| live source-runtime PostHog logs send and receipt query | T006 external delivery and sanitization proof | pass; `boundary_name=posthog_live_check` returned one `agent_workbench.runtime_boundary_attention` warn log with bounded attributes only |
| `git diff --check` | patch formatting | pass |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
|---|---|---|
| Scope | Spec 064 and named runtime/CLI/docs/package files | unrelated Spec 063 edits must remain untouched |
| Permissions | user authorized spec, cleanup, dependency, implementation, tests, docs, a live PostHog verification send, and commit | no push or release requested |
| Validation | commands above plus adversarial sanitizer fixtures and one live logs send/query | external retention and dashboard layout remain outside repository tests |
| Review | independent privacy/security and correctness reviews completed | PostHog blockers resolved; pre-existing OTEL raw-exception behavior remains outside this PostHog boundary |
| Durable impact | observability and layered architecture docs | promoted |

## Evidence Log

| Date | Evidence | Result | Notes |
|---|---|---|---|
| 2026-08-15 | pre-implementation review, lifecycle guide, spec inventory, creation plan | pass | Spec 064 allocated; raw exception capture, CLI scope drift, unignored `.env`, stale Python lock, and missing tests identified. |
| 2026-08-15 | T002; REQ-001 to REQ-004; `uv lock --check --project tools/devcli`; `pnpm test:devcli` | pass | Confirms the accidental Python CLI analytics path is removed and the dev CLI lock matches its manifest. |
| 2026-08-15 | T003; REQ-001 to REQ-004; `pnpm exec vitest run tests/telemetry/posthog.test.ts tests/mcp/telemetry-instrumentation.test.ts tests/mcp/daemon-launch.test.ts` | pass | Verifies opt-in PostHog gating, sanitization, personless capture, shared daemon lifecycle, and source-level telemetry redaction. |
| 2026-08-15 | T003-T004; REQ-001 to REQ-004; `pnpm run typecheck`; `git diff --check`; `pnpm pack:dry-run` | pass | Confirms TypeScript integrity, patch formatting, and package contents including `posthog-node`. |
| 2026-08-15 | T004; REQ-004; plugin, build receipt, and package validation | pass | `pnpm validate:plugin`, `pnpm build-runtime:check`, and `pnpm pack:dry-run` passed. |
| 2026-08-15 | T004; REQ-001 to REQ-004; full tests | pass | The default parallel run was invalidated by concurrent review load and broad timeouts; `pnpm exec vitest run --maxWorkers=1` then passed 130 files and 1,380 tests. |
| 2026-08-15 | T004; REQ-001 and REQ-003; independent reviews | pass | Exact Markdown-audit keys replaced prefix matching; token-free local config evidence was added; focused tests passed. Security review found no remaining PostHog blocker. |
| 2026-08-15 | T004; REQ-001 to REQ-004; lifecycle lint, evidence-quality check, and task-state audit | pass | All three lifecycle checks reported zero errors and zero warnings; all 11 evidence records were concrete. |
| 2026-08-15 | T005; REQ-001, REQ-003, REQ-004; focused distribution/error/build/workflow tests and typecheck | pass | Four files and 33 tests passed; synthetic exceptions were invariant to raw message/path/stack changes and rebuilt through an exact allowlist. |
| 2026-08-15 | T005; REQ-001 and REQ-004; synthetic configured build, receipt inspection, npm dry-run, source-default rebuild | pass | One generated runtime output contained the synthetic release token; the receipt did not; the final rebuild removed the token and validated its receipt; dry-run contained 277 files. |
| 2026-08-15 | T005; REQ-001 to REQ-004; full regression | pass | `pnpm exec vitest run --maxWorkers=1` passed 131 files and 1,390 tests. |
| 2026-08-15 | T005; REQ-001, REQ-003, REQ-004; independent privacy/security and correctness re-review | pass | Review of `src/infrastructure/telemetry/posthog.ts`, release workflows, disclosure docs, and focused tests confirmed Windows release parity, exact error-category allowlisting, and matching durable documentation; the 33-test focused suite passed after the fixes. |
| 2026-08-15 | T006; REQ-005; `pnpm exec vitest run tests/telemetry/posthog-logs.test.ts tests/telemetry/posthog.test.ts tests/mcp/telemetry-instrumentation.test.ts tests/mcp/daemon-launch.test.ts tests/mcp/runtime-build-contract.test.ts tests/integration/distribution-analytics-build.test.ts`; `pnpm typecheck` | pass | Confirms separate logs opt-in gating, analytics opt-out override, exact fixed bodies, bounded scalar attributes, `recordError` exclusion, contained provider failures, and OTEL trace-config independence across 6 files and 98 tests. |
| 2026-08-15 | T006; REQ-005; `pnpm build-runtime:check`; `pnpm validate:plugin`; `pnpm exec vitest run tests/docs/docs-links-metadata.test.ts`; `pnpm pack:dry-run`; `git diff --check` | pass | Runtime build receipt remained valid, plugin/package validation passed, docs links and metadata passed, formatting stayed clean, and the npm dry run packaged the new OTLP logs dependencies and 278 files. |
| 2026-08-15 | T006; REQ-005; live source-runtime PostHog logs send and receipt query | pass | A manual source-runtime send emitted `agent_workbench.runtime_boundary_attention` for `boundary_name=posthog_live_check`; PostHog returned the row with only `boundary_kind`, `boundary_name`, `degraded_mode_count`, `warning_count`, `outcome`, and `runtime_version` plus `service.name/service.version` resource attributes. |

## Residual Risks

- The repository test suite still proves privacy and lifecycle locally; only one
  manual PostHog logs receipt was exercised, so longer-term ingestion and
  retention behavior remain an external operations concern.

## Durable Promotion And Cleanup

| Spec content | Durable destination or deferral | Status | Evidence |
|---|---|---|---|
| configuration, event schema, privacy, operations | `docs/design/observability-debugging-design.md` | complete | updated 2026-08-15 |
| adapter and daemon lifecycle ownership | `docs/design/layered-runtime-architecture.md` | complete | updated 2026-08-15 |
| operator disclosure and opt-out instructions | `README.md`, `packaging/agent-workbench/README.md`, `docs/runbooks/install-agent-workbench.md` | complete | updated 2026-08-15 |

### Spec Cleanup Decision

- **Cleanup action:** keep active until explicitly closed
- **Reason:** implementation, review, promotion, validation, and the requested commit are complete; closure was not requested
- **Final spec commit:** this Spec 064 implementation change set
- **Closure log entry updated:** no
- **Residual spec-only content:** none

## Ship Or Closure Risk

- **Risk level:** medium
- **Breaking change:** no
- **Blast radius checked:** yes
- **Rollback path:** disable analytics consent flag
- **Requires human review:** completed for this slice
- **Release notes needed:** yes if distributed

## Readiness Decision

- **Ready for promotion:** yes
- **Ready for release:** yes, after the repository Actions secret
  `POSTHOG_PROJECT_TOKEN` is configured and normal release governance completes
- **Ready for closure:** yes after the final spec commit or explicit closure request
