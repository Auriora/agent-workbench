---
title: Go reference impact promotion tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006
```

- [x] T001 Add Go reference and validation-policy fixtures.
  - Files: `tests/fixtures/`, `tests/language/`, `tests/validation/`
  - Acceptance: Fixtures cover packages, imports, methods, selectors,
    ambiguous references, generated skips, tests, Docker-only policy, Makefile,
    and CI evidence.
  - Evidence: Completed on 2026-06-06. Expanded
    `tests/fixtures/fixture-go-service-repo/` with same-package declarations,
    imports, receiver methods, selector calls, package-level and method
    `LoadConfig` ambiguity, duplicate `Reset` declarations across packages,
    generated/cache noise, Go tests, Makefile evidence, and GitHub Actions CI.
    Added `tests/fixtures/fixture-go-docker-policy-repo/` with Docker Compose
    guidance that forbids host `go test`. Added
    `tests/workspace/go-reference-fixtures.test.ts` and updated existing Go
    fixture count assertions. Validation:
    `pnpm exec vitest run tests/workspace/go-reference-fixtures.test.ts
    tests/workspace/file-catalog-scanner.test.ts
    tests/mcp/repo-scope-overview-resource.test.ts
    tests/mcp/verification-plan-tool.test.ts
    tests/graph/extraction-pipeline.test.ts tests/graph/query-tools.test.ts`
    passed.

- [ ] T002 Implement Go package and reference extraction.
  - Depends on: T001
  - Files: `src/infrastructure/language/`, `tests/language/`
  - Acceptance: Extractor emits package, import, declaration, receiver,
    selector, and identifier-reference evidence with provenance.
  - Evidence: Pending.

- [ ] T003 Wire Go references into graph queries and impact.
  - Depends on: T002
  - Files: `src/graph/`, `src/application/`, `tests/graph/`, `tests/mcp/`
  - Acceptance: `find_references` and `impact` return useful Go evidence with
    confidence labels and ambiguity caveats.
  - Evidence: Pending.

- [ ] T004 Harden Go validation planning.
  - Depends on: T001
  - Files: `src/application/use-cases/`, `tests/validation/`, `tests/mcp/`
  - Acceptance: Docker/devcontainer/CI/repo guidance suppresses unsafe generic
    host `go test ./...` suggestions.
  - Evidence: Pending.

- [ ] T005 Run read-only Go dogfood comparison.
  - Depends on: T003, T004
  - Files: `.tmp/`, `docs/specs/015-go-reference-impact-promotion/verification.md`
  - Acceptance: Evidence records same, better, weaker, and remaining blocked
    cases against at least one Go-heavy sample repository without modifying it.
  - Evidence: Pending.

- [ ] T006 Promote docs, validate, and close.
  - Depends on: T005
  - Files: `docs/design/language-adapter-design.md`,
    `docs/reference/language-capability-matrix.md`,
    `docs/design/mcp-surface-design.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/015-go-reference-impact-promotion/`
  - Acceptance: Durable docs describe accepted Go reference, impact, and
    validation-planning behavior; full relevant validation passes before
    archival.
  - Evidence: Pending.
