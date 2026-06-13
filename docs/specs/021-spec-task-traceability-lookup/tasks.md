---
title: Spec task traceability lookup tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-09
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005
```

- [x] T001 Finalize Agent Workbench/spec-lifecycle-manager boundary.
  - Files: `docs/specs/021-spec-task-traceability-lookup/design.md`,
    `docs/design/mcp-surface-design.md`,
    `docs/design/coding-agent-integration-design.md`
  - Acceptance: Design states that spec-lifecycle-manager owns lifecycle
    workflows and Agent Workbench owns spec-aware routing plus repo-evidence
    support, including consumption of lifecycle preflight, task detail,
    validation-plan, evidence-quality, task-state-audit, and closure-risk
    context without making Agent Workbench lifecycle-authoritative.
  - Evidence: Resolved as route-and-consume in
    `docs/specs/021-spec-task-traceability-lookup/design.md`,
    `docs/design/mcp-surface-design.md`, and
    `docs/design/coding-agent-integration-design.md`; focused validation
    passed with `pnpm exec vitest run tests/mcp/context-for-task-tool.test.ts
    tests/contracts/runtime-contracts.test.ts
    tests/presentation/session-aware-presenters.test.ts
    tests/mcp/registry-metadata.test.ts
    tests/integration/codex-integration-profile.test.ts
    tests/integration/kiro-power.test.ts`.

- [x] T002 Add spec fixture packages.
  - Depends on: T001
  - Files: `tests/fixtures/`, `tests/docs/`
  - Acceptance: Fixtures cover active, archived, malformed, and
    traceability-rich specs, plus companion lifecycle available, unavailable,
    unknown, and caller-supplied lifecycle context states.
  - Evidence: Synthetic temp fixture packages in
    `tests/mcp/context-for-task-tool.test.ts` cover active, archived,
    malformed, traceability-rich, unknown/unavailable local-reader states, and
    caller-supplied lifecycle context; focused validation passed.

- [x] T003 Implement spec-reference detection and bounded local routing.
  - Depends on: T002
  - Files: `src/application/`, `src/infrastructure/markdown/`,
    `src/contracts/`, `tests/docs/`
  - Acceptance: Runtime detects explicit spec/task prompts, routes to
    spec-lifecycle-manager when available, and returns non-authoritative local
    routing evidence only when lifecycle tools are unavailable or unknown.
  - Evidence: `src/application/use-cases/get-task-context.ts` detects spec
    paths, `Spec NNN`, and `TNNN`, reads bounded local spec artifacts, labels
    local routing as non-authoritative, and keeps missing evidence explicit;
    focused validation passed.

- [x] T004 Integrate with task context and companion integration metadata.
  - Depends on: T003
  - Files: `src/application/use-cases/get-task-context.ts`,
    `src/interface-adapters/mcp/`, `src/presentation/`, `tests/mcp/`
  - Acceptance: Spec/task prompts route to lifecycle tools, relevant repo
    files, symbols, impact, diagnostics, edit preview, and validation planning
    where evidence exists; caller-supplied lifecycle outputs are consumed
    before broad repo search; lifecycle next actions are not presented as
    callable without discovery evidence.
  - Evidence: `src/contracts/runtime-orientation-contracts.ts`,
    `src/interface-adapters/mcp/registries/tools/context-for-task.ts`, and
    `src/presentation/task-context-presenter.ts` expose and present
    `lifecycle_context`/`lifecycle_evidence`; caller-supplied lifecycle
    validation hints remain planned evidence and companion next actions stay
    nested rather than top-level Workbench actions.

- [x] T005 Promote docs, validate, and close.
  - Depends on: T004
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/coding-agent-integration-design.md`,
    `plugins/agent-workbench/kiro-power/`,
    `plugins/agent-workbench/skills/agent-workbench/SKILL.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/021-spec-task-traceability-lookup/`
  - Acceptance: Durable docs and packaged skill/Power guidance describe the
    companion spec-lifecycle-manager boundary and validation passes.
  - Evidence: Durable docs and packaged guidance updated in
    `docs/design/mcp-surface-design.md`,
    `docs/design/coding-agent-integration-design.md`,
    `docs/reference/runtime-contracts.md`,
    `plugins/agent-workbench/skills/agent-workbench/SKILL.md`,
    `plugins/agent-workbench/kiro-power/POWER.md`, and
    `plugins/agent-workbench/kiro-power/skills/agent-workbench/SKILL.md`;
    `pnpm typecheck`, `pnpm test` unsandboxed, `git diff --check`, spec
    lifecycle lint, and closure check passed on 2026-06-13.
