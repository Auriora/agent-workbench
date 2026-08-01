---
title: Ruby and Rails partial-semantic tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-08-01
---

# Tasks

**Input:** All artifacts in `docs/specs/048-ruby-rails-partial-semantic/`

## Task Dependency Graph

```text
Spec 047 -> T001 -> T002 -> T003 -> T004 -> T005 -> T006 -> T007 -> T008 -> T009 -> T010
```

## Phase 1: Dependency and parser foundation

- [x] T001 Reconcile delivered Spec 047 behavior and freeze the Ruby parser
  promotion boundary.
  - Depends on: Spec 047 implementation and reconciliation
  - Upstream specs: Spec 047 closure record in
    `docs/history/spec-closure-log.md`, final commit `2f0b160`
  - Requirements: Requirement 1, Requirement 5
  - Files: Spec 047 evidence, delivered Ruby/Rails source/tests, this package
  - Acceptance: Resource-backed behavior, fixtures, validation policy, exact
    supported Ruby/Rails forms, and residual gaps are reconciled before coding.
  - Status: Complete; T002 may begin.
  - Evidence: Artifact review passed: Spec 047 final 2f0b160, cleanup a2a667e, resolution 7113d4e, closure record, durable docs, delivered source/tests, and resource-backed/parser ownership boundary reconciled. Spec 048 package lint returned 0 diagnostics and task_context has no remaining requirement-context gaps.

  - Evidence mode: artifact
- [x] T002 Add and validate the tree-sitter Ruby native dependency and package
  integration.
  - Depends on: T001
  - Requirements: Requirement 1
  - Properties: CP-004
  - Files: `package.json`, lockfile, package manifest, native rebuild/install
    scripts and tests
  - Acceptance: Supported Node/platform paths can load the grammar; failures
    produce explicit native/parser errors without fallback.
  - Evidence: Added tree-sitter-ruby 0.23.1 to runtime dependencies, pnpm native-build allowlist, rebuild-native package list, lockfile and distribution manifest. `pnpm rebuild:native` compiled tree-sitter-ruby; a direct Parser load parsed a Ruby class without errors; `pnpm validate:plugin` and 22 codex-integration-profile tests passed.

  - Status: Complete; one approved native grammar path loads and packaging metadata is consistent. The known peer-range mismatch is the same compatibility class already used by tree-sitter-typescript and is covered by direct runtime load.
  - Evidence mode: command
- [x] T003 Implement the Ruby parser adapter and structured failure boundary.
  - Depends on: T002
  - Requirements: Requirement 1
  - Properties: CP-001, CP-004
  - Files: `src/infrastructure/tree-sitter/ruby-*`, exports, focused parser tests
  - Acceptance: One parse path produces valid ranges or a structured complete
    failure; no partial extraction or alternate parser exists.
  - Evidence: Implemented RubyParserAdapter and RubyTreeSitterExtractorAdapter as the sole .rb tree-sitter path; exports and startup registration added. Injected parser failure rejects the whole extraction with the original error and no partial batch or alternate parser. Focused Ruby parser/path/reference tests: 3 files, 15 tests passed; `pnpm typecheck` passed.

  - Status: Complete; valid parser-backed ranges or total propagated failure only.
  - Evidence mode: command
## Phase 2: Ruby graph evidence

- [x] T004 Implement Ruby declaration extraction and stable identity rules.
  - Depends on: T003
  - Requirements: Requirement 2
  - Properties: CP-001, CP-002
  - Files: Ruby extractor and graph extraction fixtures
  - Acceptance: Supported declarations, nesting, inheritance metadata,
    reopened/duplicate ambiguity, and unsupported forms match fixtures.
  - Evidence: Ruby adapter emits parser-backed module, class, stable singleton-class, instance/singleton-method and constant nodes with lexical qualified identity, superclass metadata, reopen sequence and exact ranges. New fixture-backed graph suite proves nested identity, duplicate/reopened evidence and parser metadata; focused validation totals 6 files/92 tests passed with typecheck.

  - Status: Complete; unsupported/dynamic identity is not promoted to a confident symbol.
  - Evidence mode: command
- [x] T005 Implement bounded Ruby reference extraction.
  - Depends on: T004
  - Requirements: Requirement 3 AC1
  - Properties: CP-001, CP-003
  - Files: Ruby extractor, reference fixtures
  - Acceptance: Approved loading, constant, inheritance, and call forms carry
    exact source ranges, form metadata, provenance, and confidence.
  - Evidence: Parser emits static require, require_relative, inheritance, constant, include, extend, prepend and ordinary call records with exact source ranges, tree-sitter-ruby provenance, form metadata and calibrated confidence. Nonliteral operands emit bounded ruby_dynamic records that are excluded from candidate resolution. `pnpm exec vitest run tests/adapters/ruby-parser.test.ts tests/graph/ruby-semantic-extraction.test.ts tests/graph/reference-completeness.test.ts tests/language/ruby-parser-path.test.ts` passed 4 files/20 tests after final route-target and relative-load fixes; `pnpm typecheck` passed.

  - Status: Complete; the call-form subset is explicit and fixture bounded.
  - Evidence mode: command
- [x] T006 Integrate conservative Ruby resolution, reference queries, impact,
  and coverage-domain disclosure.
  - Depends on: T005
  - Requirements: Requirement 3 AC2-AC3, Requirement 5 AC2
  - Properties: CP-002, CP-003
  - Files: graph resolution, query/context presentation, generic contracts if
    required, query and MCP golden tests
  - Acceptance: Only unique targets resolve; ambiguity persists; all Ruby
    reference results disclose parser-route scope without whole-program claims.
  - Evidence: Ruby resolver filters candidates by static form and declaration kind, resolves only unique first-party targets, preserves duplicate SharedConfig as ambiguous with candidate_count=2, and never resolves ruby_dynamic records. Ruby parser-backed zero-result references stay on an exhausted parser route rather than lexical fallback. Cross-file computeImpact evidence is parser-backed and bounded. 6 focused files/92 tests and typecheck passed.

  - Status: Complete; generic public coverage contracts were reused without schema changes.
  - Evidence mode: command
## Phase 3: Rails framework evidence

- [x] T007 Freeze and test the initial Rails DSL form matrix.
  - Depends on: T006
  - Requirements: Requirement 4, Requirement 5
  - Properties: CP-005
  - Files: Rails fixture sources and expected extraction/query records
  - Acceptance: Each included static route/model/concern form has a positive,
    ambiguous, and dynamic/unsupported counterpart with expected confidence.
  - Evidence: Fixture matrix freezes static resources/resource/get/post/match routes; belongs_to/has_many/has_one/validates model DSL; include/extend/prepend concern forms; duplicate SharedConfig ambiguity; and nonliteral route/model/mixin/load counterparts. Expected static/dynamic confidence, resolution and source-range records pass in the graph suite.

  - Status: Complete; initial Rails DSL forms are frozen by executable fixture evidence.
  - Evidence mode: command
- [x] T008 Implement bounded Rails route and model DSL extraction.
  - Depends on: T007
  - Requirements: Requirement 4
  - Properties: CP-001, CP-002, CP-005
  - Files: Ruby extractor Rails visitors, graph/query/context tests
  - Acceptance: Fixture-approved DSL forms improve navigation while dynamic or
    environment-dependent behavior remains unresolved or unsupported.
  - Evidence: The sole Ruby parser adapter emits bounded Rails route, model and concern records without Rails boot or code execution. Static records carry form, provenance, range and confidence; nonliteral and environment-dependent operands remain bounded ruby_dynamic records excluded from candidate resolution. Ruby graph, query, impact, safety-boundary and parser suites pass (6 files, 92 tests) with typecheck.

  - Status: Complete; Rails navigation improves only for fixture-approved static forms.
  - Evidence mode: command
## Phase 4: Verification, dogfood, and closure

- [x] T009 Run freshness, failure, focused/full validation, installed-package
  smoke, and bounded Rails dogfood review.
  - Depends on: T008
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5
  - Properties: CP-001-CP-005
  - Files: `verification.md`, runtime/workspace/package tests, dogfood ledger
  - Acceptance: Add/modify/delete/rename, parser failure, native packaging,
    query trust, full regressions, and one real Rails solution are evidenced
    with limitations and no fallback behavior.
  - Evidence: Native rebuild/load, parser failure, Ruby/Rails fixture, graph/query, freshness and package validation passed. Focused Ruby/query suite: 6 files/92 tests; workspace freshness suite: 3 files/21 tests; typecheck and plugin validation passed; pack dry-run and installed-package MCP smoke passed. Default-concurrency full suite had five load-sensitive timeouts, all four affected files passed 84/84 with maxWorkers=4, then the complete bounded suite passed 106 files/1161 tests. The final bounded read-only Rails dogfood rerun produced 362 Ruby declarations, 370 resolved Ruby-origin edges, explicit dynamic/ambiguous records and preserved secret/generated/vendor exclusions without executing Ruby, Rails, Bundler, tests, database or containers.

  - Status: Complete; T010 may begin. Cross-platform native ABI variance and whole-program Ruby/Rails semantics remain explicit residual risks.
  - Evidence mode: command
- [x] T010 Complete expert review, durable promotion, residual routing, and
  lifecycle closure preparation.
  - Depends on: T009
  - Requirements: Requirement 5
  - Files: language adapter design, capability matrix, runtime contracts if
    changed, graph design if changed, backlog, changelog, ledger, history
  - Acceptance: Architecture and implementation findings are resolved or
    routed; `partial_semantic` limits are durable; deeper Ruby/Rails work has
    one owner; closure checks pass.
  - Evidence: Final correctness review reported no findings and confirmed the resolved `require_relative` normalization plus static Rails `to:` controller-action routing coverage. An independent security review of the changed parser, resolver, query and fixture paths found no execution, secret-exposure, injection, data-boundary or unsafe-fallback regression in this slice. Durable language, graph, capability, backlog, packaging, changelog and dogfood owners are updated; residual semantics remain routed to EB010, EB014 and EB061; lifecycle cleanup owns the closure-history entry.

  - Status: Complete; closure checks may pass and the package can be archived after the final spec commit is recorded.
  - Evidence mode: artifact
## Execution Rules

- Do not start T002 until T001 verifies Spec 047 is delivered and current.
- Read the full package and durable sources before each implementation slice.
- Mark only one implementation task `[~]` at a time.
- Tree-sitter Ruby is the only primary parser. Do not add AST, LSP, Sorbet,
  RuboCop, Solargraph, Ruby LSP, Rails runner, lexical, shell, or retry fallback.
- Return structured failure rather than partial results after parser failure.
- Keep MCP adapters thin and public contracts language-neutral.
- Record exact commands, results, skipped checks, limitations, expert review,
  and promotion evidence before task completion.

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
