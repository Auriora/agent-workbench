---
title: Ruby and Rails partial-semantic verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-08-01
---

# Verification

## Scope

Validate Spec 048 Requirement 1 through Requirement 5 and tasks T001-T010 after Spec 047 is
delivered and reconciled. Planned commands below are not executed evidence.

## Quality Gates

| Gate | Required? | Status | Evidence |
|------|-----------|--------|----------|
| G1 Spec 047 dependency reconciliation and form freeze | yes | passed | Closure record, commits `2f0b160`, `a2a667e`, `7113d4e`, delivered source/tests, and canonical-context boundary reviewed on 2026-08-01. |
| G2 Native tree-sitter Ruby build/load/package checks | yes | passed | Native rebuild and direct grammar load passed; package metadata, dry-run and installed smoke passed. |
| G3 Parser failure and no-fallback fixtures | yes | passed | Injected parser failure rejects the complete batch with the original error and no alternate route. |
| G4 Declaration, identity, duplicate and dynamic-form fixtures | yes | passed | Ruby parser and graph fixture suites passed. |
| G5 Reference, resolver, ambiguity and impact fixtures | yes | passed | Unique resolution, duplicate ambiguity, dynamic exclusion and bounded impact tests passed. |
| G6 Parser-route coverage and trust golden tests | yes | passed | Ruby zero-result parser route remains exhausted without lexical fallback; generic contract reused. |
| G7 Rails route/model/concern DSL fixtures | yes | passed | Static/dynamic Rails DSL fixture matrix passed. |
| G8 Freshness, workspace safety, diagnostics and response-budget checks | yes | passed | Focused safety/query suite and 21 workspace queue/freshness tests passed; Rails dogfood preserved exclusions. |
| G9 Typecheck and full Vitest suite | yes | passed | Typecheck passed; bounded full suite passed 106 files/1161 tests. |
| G10 Plugin/package/install smoke and Rails dogfood | yes | passed | Plugin validation, pack dry-run, installed-package MCP smoke and bounded Rails graph dogfood passed. |
| G11 Architecture, implementation, security/trust and closure review | yes | passed | Final correctness review reported no findings and confirmed the resolved `require_relative` and static Rails controller-action routing defects; direct security/trust review of parser, resolver, query and promoted-doc paths found no actionable regressions. |

## Validation Commands

| Command | Purpose | Result | Evidence |
|---------|---------|--------|----------|
| `pnpm rebuild:native` | Build approved native parser dependencies when needed | passed | `tree-sitter-ruby` compiled and loaded under the local Node 24 toolchain. |
| focused Vitest files selected by verification planning | Ruby/Rails parser, graph, query, failure and freshness behavior | passed | Ruby/query: 6 files/92 tests; workspace queue/freshness: 3 files/21 tests. |
| `pnpm typecheck` | Type and layer correctness | passed | TypeScript completed with no errors. |
| `pnpm test` | Full runtime regression suite | passed with bounded workers | Default concurrency produced five load-sensitive timeouts after 1156 passes; all four affected files passed 84/84 with `--maxWorkers=4`, then the complete bounded suite passed 106 files/1161 tests. |
| `pnpm validate:plugin` | Packaged integration consistency | passed | Plugin/package validation passed. |
| `pnpm pack:dry-run` | Ruby grammar/runtime package contents | passed | Runtime bundle contains Ruby parser/extractor and package metadata includes the grammar. |
| installed-package MCP smoke | Native load and public query behavior | passed | Isolated tarball install, daemon, two provider-labelled MCP sessions, refresh and cleanup passed. |
| lifecycle lint, review and closure checks | Package and closure integrity | passed | Spec lint remained clean and closure readiness returned ready with zero blockers after the T010 completion update. |

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
|-------------|-----------------------------|----------|---------------|
| Requirement 1 | AC1-AC3 | one parser path, native/package validation and total failure fixture | Native platform variance |
| Requirement 2 | AC1-AC3 | declaration, nesting, singleton, reopen and ambiguity fixtures | Ruby dynamic identity remains unresolved |
| Requirement 3 | AC1-AC3 | bounded reference, resolution, query and impact fixtures | Dynamic dispatch and runtime constant lookup |
| Requirement 4 | AC1-AC3 | frozen static/dynamic Rails DSL fixture matrix | Rails metaprogramming and engine behavior |
| Requirement 5 | AC1-AC4 | safety/freshness tests, full regressions, dogfood, durable promotion and review | Representative fixtures cannot prove all applications |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
|-------|----------|---------------|
| Scope and dependency | Spec 047 closure record and commits; requirements, design, T001 | Dependency delivered and reconciled. |
| Must-read context | full Spec 047/048 packages plus canonical durable owners | Sources may drift. |
| Permissions | user requested completion of Spec 048 on 2026-08-01 | No release, push, or external deployment authority. |
| Validation | focused, bounded full-suite, package/install and dogfood commands above | Cross-platform native ABI matrix was not executed locally. |
| Review needs | architecture, implementation, security/trust | Correctness review returned no findings; direct security/trust review found no actionable issues in the changed paths. |
| Durable-doc impact | adapter/graph design, capability matrix, backlog, packaging, changelog and ledger updated | Closure readiness passed; lifecycle cleanup still needs to write history and archive the package. |

## Scope Reconciliation Before Closure

| Broad target | Implemented in this spec | Coverage state | Deferred work | Destination | Blocks closure? | Evidence |
|--------------|--------------------------|----------------|---------------|-------------|-----------------|----------|
| One canonical Ruby parser path | `tree-sitter-ruby` adapter, registration and packaging | covered | cross-platform ABI evidence | release/platform validation | no | native, focused and installed-package checks |
| Calibrated Ruby partial semantics | declarations, bounded static references, unique resolution and conservative graph queries | covered | runtime/dynamic lookup | EB010 | no | fixture and dogfood graph evidence |
| Rails DSL relationships | frozen static route/model/concern matrix plus dynamic unresolved records | covered | metaprogramming and engine/runtime composition | EB010 | no | paired fixture tests |
| Whole-program Ruby/Rails semantics | deliberately not claimed | out-of-scope | dynamic behavior | EB010 | no | durable design boundary |
| Persisted large-repo completion | deliberately not claimed | out-of-scope | graph scale | EB014 | no | durable design boundary |

## Task Evidence

| Task ID | Status | Evidence | Notes |
|---------|--------|----------|-------|
| T001-T008 | complete | Dependency reconciliation, native/parser foundation, Ruby graph evidence and Rails DSL tasks contain artifact/command evidence in `tasks.md`. | Focused checks passed. |
| T009 | complete | Native, focused/full, package/install and bounded Rails dogfood validation recorded above. | Full suite required bounded workers after default-concurrency timeouts. |
| T010 | complete | Correctness review returned no findings, direct security/trust review found no actionable issues, durable owners/residual routes were updated, and lifecycle closure readiness passed. | Package is ready for archive cleanup. |

## Evidence Log

| Date | Evidence | Result | Notes |
|------|----------|--------|-------|
| 2026-08-01 | Spec 047 dependency reconciliation | passed | Final implementation and cleanup commits, closure record, durable docs, delivered source/tests, and parser boundary reviewed. |
| 2026-08-01 | Ruby/Rails focused validation | passed | 6 files/92 tests plus 3 freshness files/21 tests; typecheck passed. |
| 2026-08-01 | Full regression validation | passed with bounded workers | 106 files/1161 tests; five default-concurrency timeouts were isolated and passed 84/84 before the bounded full rerun. |
| 2026-08-01 | Package and installed-runtime validation | passed | Plugin validation, pack dry-run and installed-package MCP smoke passed. |
| 2026-08-01 | Active Rails application dogfood | passed with limitations | `pnpm debug:mcp-tool-sweep -- --repo /home/bcherrington/Projects/Auriora/ror-sandpit --output-dir /tmp/agent-workbench-spec048-dogfood-final --start-graph-warmup --timeout-ms 60000` completed; read-only SQLite counts were 362 Ruby declarations and 370 resolved Ruby-origin edges. No target-repo command was executed; the invalid generic automatic reference probe was excluded from acceptance. |
| 2026-08-01 | Final correctness and security/trust review | passed | Independent correctness re-review reproduced the fixed `require_relative` and three controller/action edges and reported no remaining finding. Independent security review checked non-execution, fail-closed parsing, path normalization, dynamic exclusion and safety fixtures and reported no actionable finding. |
| 2026-08-01 | Lifecycle lint and closure readiness | passed | `lint_spec_package` returned 0 errors/0 warnings/0 info; `closure_check` returned `ready: true` with 0 blockers and all five requirements covered after T010 completion. |

## Residual Risks

- Ruby and Rails are highly dynamic; partial-semantic evidence must remain
  calibrated to supported static forms.
- Native tree-sitter packaging must be proven across supported Node/platform
  combinations.
- EB014 remains the owner for completing very large graphs beyond first-pass
  budgets.

## Durable Promotion And Cleanup

| Spec content | Durable destination or deferral | Status | Evidence |
|--------------|---------------------------------|--------|----------|
| Supported forms, architecture and limitations | `docs/design/language-adapter-design.md` | promoted | Ruby/Rails partial-semantic section updated. |
| Current capability | `docs/reference/language-capability-matrix.md` | promoted | Ruby/Rails now current `partial_semantic`. |
| Coverage/trust contract | runtime contracts and MCP design if changed | unchanged | Existing generic parser-route contract reused without schema delta. |
| Resolution/storage behavior | `docs/design/graph-store-design.md` | promoted | Form-aware unique Ruby resolution recorded. |
| Native install guidance | `packaging/agent-workbench/README.md` | promoted | Packaging README now documents grammar source-build expectations and `tree-sitter-ruby` rebuild guidance. |
| EB010/EB061 and deeper semantics | backlog | promoted | EB010 owns deeper Ruby/Rails semantics; EB061 remains the generic disclosure owner. |
| User-visible capability | changelog and dogfood ledger | promoted | Behavior, limits, counts, invalid generic probe and closure routing recorded; lifecycle cleanup writes closure history. |

### Spec Cleanup Decision

- **Cleanup action:** remove after promotion and closure evidence
- **Final spec commit:** pending
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Closure cleanup commit:** pending
- **Active indexes updated:** no

## Ship Or Closure Risk

- **Risk level:** high
- **Breaking change:** no
- **Blast radius checked:** yes; focused and full regression, packaging/install and Rails dogfood evidence recorded
- **Rollback path:** remove Ruby parser registration/dependency and retain Spec
  047 resource-backed behavior
- **Requires human review:** yes
- **Release notes needed:** yes
- **Follow-up issue or spec needed:** likely for deeper dynamic semantics

## Readiness Decision

- **Ready to implement:** yes after T001 package reconciliation is linted and recorded
- **Ready for promotion:** yes
- **Ready for release:** no
- **Ready for closure:** yes

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
