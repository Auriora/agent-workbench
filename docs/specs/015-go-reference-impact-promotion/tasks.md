---
title: Go reference impact promotion tasks
doc_type: spec
artifact_type: tasks
status: archived
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

- [x] T002 Implement Go package and reference extraction.
  - Depends on: T001
  - Files: `src/infrastructure/language/`, `tests/language/`
  - Acceptance: Extractor emits package, import, declaration, receiver,
    selector, and identifier-reference evidence with provenance.
  - Evidence: Completed on 2026-06-06. Added `tree-sitter-go`, included it in
    the native rebuild and approved build-script dependency list, and replaced
    the regex-only Go extractor with a `tree-sitter-go` extractor. Go files
    now report parser-backed `partial_semantic` capability labels. Extraction
    emits package, import, function, type, and method nodes with package and
    receiver metadata, plus unresolved selector and identifier references with
    package/import/provenance metadata. Same-file and unique name references
    can resolve through the shared resolver; imported selector ambiguity stays
    unresolved for T003. Validation:
    `pnpm rebuild:native`, `pnpm typecheck`, and focused Go-adjacent Vitest
    suite passed.

- [x] T003 Wire Go references into graph queries and impact.
  - Depends on: T002
  - Files: `src/graph/`, `src/application/`, `tests/graph/`, `tests/mcp/`
  - Acceptance: `find_references` and `impact` return useful Go evidence with
    confidence labels and ambiguity caveats.
  - Evidence: Completed on 2026-06-06. Added Go-aware candidate filtering to
    the shared reference resolver so imported package selectors resolve against
    first-party files whose path matches the import suffix, while receiver-style
    selectors prefer method candidates and unresolved ambiguity remains
    explicit. `find_references` now returns parser-backed Go references from
    the fixture service entrypoint to package symbols, and `impact` traverses
    the resulting low-confidence parser-backed graph edges with local or graph
    scope caveats. Validation: `pnpm exec vitest run
    tests/graph/extraction-pipeline.test.ts tests/graph/query-tools.test.ts`
    passed.

- [x] T004 Harden Go validation planning.
  - Depends on: T001
  - Files: `src/application/use-cases/`, `tests/validation/`, `tests/mcp/`
  - Acceptance: Docker/devcontainer/CI/repo guidance suppresses unsafe generic
    host `go test ./...` suggestions.
  - Evidence: Completed on 2026-06-06. Go validation planning now prefers
    GitHub Actions run-step evidence, then Makefile evidence, before generic
    host `go test ./...`. CI run steps for `make test`, `go test ./...`, and
    Docker Compose Go test commands are parsed as non-executed planned
    commands. When repo guidance or validation policy blocks host commands, the
    planner suppresses generic Go commands and returns blocked guidance unless
    repo policy supplies replacement commands. Validation:
    `pnpm exec vitest run tests/mcp/verification-plan-tool.test.ts` passed.

- [x] T005 Run read-only Go dogfood comparison.
  - Depends on: T003, T004
  - Files: `.tmp/`, `docs/specs/015-go-reference-impact-promotion/verification.md`
  - Acceptance: Evidence records same, better, weaker, and remaining blocked
    cases against at least one Go-heavy sample repository without modifying it.
  - Evidence: Completed on 2026-06-06. Ran read-only dogfood against
    `/home/bcherrington/Projects/Auriora/OneMount`, wrote the comparison note
    to `.tmp/spec-015-go-dogfood-onemount-2026-06-06.md`, and left the sample
    repository clean. Results improved Go scope, parser-backed symbol search,
    reference lookup, and validation safety; impact remains low-confidence
    local-only for the sampled symbol, and validation planning blocks unsafe
    host commands without yet inferring a replacement Docker command.

- [x] T006 Promote docs, validate, and close.
  - Depends on: T005
  - Files: `docs/design/language-adapter-design.md`,
    `docs/reference/language-capability-matrix.md`,
    `docs/design/mcp-surface-design.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/015-go-reference-impact-promotion/`
  - Acceptance: Durable docs describe accepted Go reference, impact, and
    validation-planning behavior; full relevant validation passes before
    archival.
  - Evidence: Completed on 2026-06-06. Promoted accepted Go behavior and
    residual limits to durable language, MCP surface, capability-matrix, and
    documentation-map docs. Full validation passed before archival:
    `pnpm typecheck`, `pnpm test`, `git diff --check`, and spec lifecycle scan.
