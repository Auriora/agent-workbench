---
title: Agent IDE capability analysis tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006
                 \                  /
                  -> T007 ----------
```

- [x] T001 Inventory `agent-ide` surfaces.
  - Files: `/home/bcherrington/Projects/Auriora/agent-ide`, `.tmp/` or
    `docs/reference/agent-ide-capability-analysis/`
  - Acceptance: Inventory covers documented resources, tools, hooks, skills,
    command surfaces, telemetry notes, warmup/cache behavior, edit feedback,
    diagnostics, validation, and relevant tests without modifying `agent-ide`.
  - Evidence: Completed on 2026-06-05. Inspected tracked `agent-ide` docs,
    plugin/skill metadata, MCP tool/resource catalogs, hook docs, performance
    findings, multi-language plans, and test inventory read-only. Findings are
    recorded in
    [Agent IDE capability analysis](../../reference/agent-ide-capability-analysis/agent-ide-capability-analysis-2026-06-05.md).

- [x] T002 Build the capability taxonomy and parity matrix.
  - Depends on: T001
  - Files: `docs/reference/agent-ide-capability-analysis/`
  - Acceptance: Matrix records capability, predecessor surface, observed value,
    Agent Workbench status, portable lesson, Python-specific parts,
    recommended action, and evidence needed.
  - Evidence: Completed on 2026-06-05. Added a capability matrix covering
    first-read readiness, task context, docs routing, diagnostics, validation,
    post-edit feedback, symbol/reference/impact, semantic refactors, warmup,
    usage telemetry, hooks, dependency intelligence, config/conventions, and
    multi-language support.

- [x] T003 Reconcile against Agent Workbench specs, backlog, and roadmap.
  - Depends on: T002
  - Files: `docs/specs/`, `docs/design/`, `docs/reference/documentation-map.md`
  - Acceptance: Existing active and archived specs are linked where relevant;
    duplicates are avoided; durable docs are preferred over archived specs for
    implemented behavior.
  - Evidence: Completed on 2026-06-05. The analysis reconciles Specs 007-010,
    points to docs/diagnostics/post-edit feedback as likely next planning
    candidates, and links the durable analysis from
    `docs/reference/documentation-map.md`.

- [x] T004 Identify tool/resource changes worth planning.
  - Depends on: T003
  - Files: `docs/reference/agent-ide-capability-analysis/`,
    `docs/design/mcp-surface-design.md`
  - Acceptance: Candidate public MCP changes are justified by workflow value,
    language neutrality, presenter behavior, and validation evidence; existing
    tools are preferred where they can carry the workflow.
  - Evidence: Completed on 2026-06-05. Added T004 recommendations to
    [Agent IDE capability analysis](../../reference/agent-ide-capability-analysis/agent-ide-capability-analysis-2026-06-05.md)
    and summarized the public-surface direction in
    `docs/design/mcp-surface-design.md`. The recommended follow-up order is
    diagnostics/post-edit feedback first, docs query/read surfaces second, with
    `repo_preflight`, broad orientation, usage resources, dependency deep dives,
    and semantic refactor parity deferred or rejected until evidence justifies
    them.

- [x] T005 Create or update follow-up specs for high-priority gaps.
  - Depends on: T004
  - Files: `docs/specs/`, `docs/reference/documentation-map.md`
  - Acceptance: High-priority replacement gaps become coherent spec packages or
    explicit additions to existing active specs; lower-priority gaps remain in
    durable backlog with promotion criteria.
  - Evidence: Completed on 2026-06-05. Created
    [Spec 011](../011-diagnostics-post-edit-feedback/requirements.md) for
    language-neutral diagnostics and quiet post-edit feedback, created
    [Spec 012](../012-docs-query-read-surfaces/requirements.md) for compact docs
    query/read surfaces, and linked both from durable documentation map and MCP
    surface backlog. Lower-priority parity items remain deferred in the Spec 010
    analysis.
  - Evidence: Pending.

- [ ] T006 Promote durable analysis and close this spec.
  - Depends on: T005
  - Files: `docs/reference/agent-ide-capability-analysis/`,
    `docs/reference/documentation-map.md`, `docs/design/`
  - Acceptance: The final analysis is durable, linked from the documentation
    map, and this spec records validation evidence and residual risks before
    being archived.
  - Evidence: Pending.

- [ ] T007 Validate the analysis package.
  - Depends on: T002
  - Files: `docs/specs/010-agent-ide-capability-analysis/`,
    `docs/reference/agent-ide-capability-analysis/`
  - Acceptance: Spec lint, documentation metadata checks, link checks, and
    whitespace checks pass; any inability to inspect `agent-ide` evidence is
    recorded as a limitation.
  - Evidence: Pending.
