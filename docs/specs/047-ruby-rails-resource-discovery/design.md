---
title: Ruby and Rails resource discovery design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-08-01
---

# Technical Design

## Overview

Extend the existing language-neutral catalog, resource extraction, context
ranking, and validation-planning path with one explicit Ruby/Rails
resource-backed route. Ruby file identity and Rails project-shape evidence feed
the same graph and response contracts as existing ecosystems through a single
catalog-driven policy layer. No Ruby code is loaded or executed, and no
alternate extraction path is introduced.

## Requirement Coverage

| Requirement | Acceptance Criteria | Design Coverage | Validation Approach |
|-------------|---------------------|-----------------|---------------------|
| Requirement 1 | AC1-AC4 | File identity, capability policy, shared exclusions | Scanner and scope fixtures |
| Requirement 2 | AC1-AC6 | Catalog-backed Rails project shape, file-local resource nodes, coverage and ranking | Overview/context fixtures and golden evidence |
| Requirement 3 | AC1-AC6 | Validation ecosystem discovery, precedence and command selection | RSpec, Minitest, environment and blocked-policy tests |
| Requirement 4 | AC1-AC3 | Representative fixtures and explicit parser boundary | Focused and full regression validation |

## Correctness Property Coverage

| Property | Design Behavior | Validation Direction | Notes |
|----------|-----------------|----------------------|-------|
| CP-001 | Discovery only emits paths and metadata observed in the bounded catalog/read set. | Fixture assertions over every returned path | No speculative route targets. |
| CP-002 | Existing coverage, caveat and validation-status vocabulary is reused. | Degraded discovery and golden validation-plan tests | No success-shaped omission. |
| CP-003 | Validation planning preserves planned/needed/blocked status. | Contract and golden validation-plan tests | No command execution. |
| CP-004, CP-006 | Rails discovery consumes catalog-visible entries after shared path classification. | Generated/vendor/secret fixture cases | No Rails-specific bypass. |
| CP-005 | New adapter registration and capability mapping are additive. | Existing ecosystem regression suite | Shared contracts remain unchanged where possible. |

## High-Level Design

### System Architecture

```text
workspace catalog
  -> shared `FileCatalogEntry[]` input
  -> Ruby/config file identity
  -> shared path-policy filtering
  -> Rails project-shape discovery (one repo-wide pass)
  -> resource-backed graph nodes and routing metadata
  -> overview/context ranking
  -> non-executed validation planning
```

### Components and Changes

- `src/infrastructure/filesystem/file-identity.ts`: recognize `.rb` and Rails/Ruby
  configuration files without treating them as parser-backed.
- `src/domain/policies/adapter-capabilities.ts`: expose Ruby as `resource_backed`
  and classify Bundler/Rails manifests through existing language-neutral
  evidence shapes.
- `src/application/use-cases/file-catalog-entry.ts`: require shared identity
  inference and reuse for scan/stat path coverage across `.rb`, `Gemfile`,
  `Gemfile.lock`, `Rakefile`, and `config.ru`.
- Proposed `src/application/use-cases/rails-project-shape.ts`: perform repository-wide
  project-shape discovery from bounded catalog entries exactly once per owning
  use case/index flow.
- `src/infrastructure/extraction/`: keep extraction file-local, emitting only
  observed Rails role/path metadata. Rails shape is consumed by owning use cases
  and is not passed through `ExtractionRequest`.
- `src/application/use-cases/get-task-context.ts`, `get-repo-overview.ts`, and
  index graph integration: consume the same language-neutral shape and rank
  selection separately from discovery.
- `src/application/use-cases/validation-ecosystems.ts` and
  `plan-verification.ts`: detect RSpec/Minitest and plan commands from local
  policy, binstubs, scripts, and repository instructions.
- `tests/fixtures/`: add representative Rails repositories without generated
  dependencies.

Discovery is repository-wide once-per-flow, then each downstream component
ranks results independently from selected roots.

## Data Models

Reuse `ExtractionBatch`, graph node/reference models, `AdapterEvidence`,
validation hints, response envelopes, and trust metadata. Rails-specific details
live inside adapter metadata and do not add Ruby-only fields to public contracts.

Ruby files use the existing generic `resource` graph-node kind. Rails roles,
route/config roles, tests, and package roles are language-neutral metadata on
that node; Spec 047 adds no graph kind or schema migration.

`RailsProjectShape` is language-neutral and contains:

- `observedRoots`
- `observedAnchors`
- `provenance`
- `evidenceCoverage`
- `evidenceCaveats`

## Data Flow

1. The catalog assigns Ruby/config identity and applies shared path-policy
   exclusions.
2. Rails discovery confirms application shape with observed files such as `Gemfile`,
   `config/application.rb`, `config/routes.rb`, and first-party role roots.
3. File-local extractors emit the existing generic `resource` node plus bounded
   path-role candidate metadata with `resource_backed` capability. They do not
   decide whether a repository is Rails.
4. `index-repository-graph` computes the shape once from its scan and admits
   Rails-specific associations only for catalog paths in that shape. Overview,
   context, and validation flows compute the same pure value once from their
   existing bounded scan; they never reuse hidden process-global state or
   rescan. Selected-path ranking happens only after discovery.
5. Validation planning selects commands from policy, environment boundaries,
   binstubs, scripts, or framework evidence, and only returns planned
   commands.

## Low-Level Design

### Rails Project Shape Discovery

```text
discoverRailsProjectShape(
  catalogEntries: FileCatalogEntry[],
  coverage: CoverageClass,
  skippedPaths: SkippedPathEvidence[],
): RailsProjectShape

  require observed Ruby/Bundler/Rails markers
  collect bounded first-party role directories and test roots
  classify only catalog-visible paths
  apply shared policy precedence and evidence-class handling
  return language-neutral shape + provenance + coverage/caveats
```

The policy runs once per owning flow (`index-repository-graph`, `get-repo-overview`,
`get-task-context`, validation planning). It does not traverse filesystem or
re-enter scanning.

### Route Evidence Constraint

- `config/routes.rb` and equivalent observed route-file paths are surfaced only as
  file/path/config-role metadata.
- Route DSL details are not parsed in this spec package.

### Path-Policy Expansion

The implementation expands the shared path policy, rather than adding a
Rails-specific bypass, to cover:

- `config/credentials/**`
- `config/master.key`
- `.env*`
- encrypted Rails credentials location patterns

Safe counterexamples (e.g. non-secret `.env.example` fixtures) remain allowed
under policy-safe policy settings and are not treated as Rails-specific bypass
exceptions.

### Validation Candidate Discovery and Ranking

Candidate commands are discovered from catalog-bounded fixed known paths only:

1. repository-approved policy and instruction evidence
2. required wrappers/environment evidence
3. binstubs, scripts, framework evidence
4. constrained host defaults (only when policy permits)

For selected paths, candidates are ranked by:

1. nearest repository root among catalog-visible Rails/Bundler roots
2. longest containing root (deepest directory depth) where ties exist
3. minimal directory distance to each selected path
4. deterministic lexical path tie-break (repo-wide)

Conflicting or missing constraints return structured `needed`/`blocked` evidence.

All planned commands must be represented as:

- `{ command: string, args: string[] }`

and flow through existing `planCommand` safety checks.

`planCommand` validates the structured executable and argument shape for this
planning-only surface; it does not authorize execution or make repository-local
policy commands trusted. Custom policy candidates retain explicit repository
provenance, remain non-executed suggestions, and do not expand the runtime's
trusted executable set.

### Error Handling

- Missing optional Rails files produce absent evidence, not errors.
- Conflicting RSpec/Minitest or execution-policy evidence produces a bounded
  needed/blocked result.
- Unreadable, oversized, or budget-truncated files use existing coverage and
  caveat metadata to expose partial, blocked, or otherwise non-complete
  evidence.
- Parser, Rails boot, Bundler, and shell fallback are not attempted.

### Security, Trust, and Access

Treat repository files as untrusted. Do not evaluate Ruby, ERB, YAML aliases,
initializers, credentials, encrypted configuration, or Rails DSL.
Validation must include explicit secret-bearing negative fixtures
(`config/master.key`, `.env*`, equivalent secret paths). Shared path and
presentation redaction policies apply.

## Migration and Compatibility

The change is additive. Previously unsupported Ruby files become
resource-backed. Existing languages and public response shapes remain
compatible. `command` in command plans is an executable plus args tuple, never a
shell string. No fallback parsing or alternate command-string execution path is
added.

No cache or graph-schema migration is expected because the existing generic
`resource` node kind is reused. Any implementation proposal that departs from
that decision requires architecture review before source changes.

## Slice Boundary And Residual Architecture

| Design target | In this slice | Out of this slice | Follow-up destination | Blocks closure? |
|---------------|---------------|-------------------|-----------------------|-----------------|
| Ruby/Rails project discovery | File identity, project shape, resource anchors | none | none | yes |
| Runtime boot and dynamic behavior | none | Rails/application execution | none; explicit non-goal | no |
| Validation planning | Policy-aware planned commands | Execution and pass/fail capture | EB004/EB024 in `docs/backlog/README.md` | no |
| Ruby semantics | Resource-backed evidence only | Tree-sitter declarations/references/impact | `docs/specs/048-ruby-rails-partial-semantic/` | no |
| Rails DSL semantics | Observed resource anchors only | Routes, associations, callbacks as semantic edges | `docs/specs/048-ruby-rails-partial-semantic/` | no |
| Large-repo completion | Existing bounded catalog budgets | Persisted graph completion/progress | EB014 in `docs/backlog/README.md` | no |

Runtime boot and framework execution behavior is therefore a non-goal and does
not block closure for this slice.

## Validation Strategy

| Validation | Covers | Evidence Location | Residual Risk |
|------------|--------|-------------------|---------------|
| File identity and capability tests | Requirement 1, CP-004/CP-006 | Vitest output and task evidence | Unseen extensions/layouts |
| Rails overview/context fixtures | Requirement 2, CP-001/CP-002 | Golden/fixture tests | Convention diversity |
| RSpec/Minitest/policy tests | Requirement 3, CP-003 | Validation-plan tests | Custom wrappers may need later fixtures |
| Full typecheck and test suite | Requirement 4 | `verification.md` | Environment-specific native build constraints |
| Secret-bearing/negative fixtures | Requirement 1, CP-004/CP-006 | Secret-bearing path fixtures and shared policy regressions | Potential false negatives by strict policy |
| Degraded discovery fixtures | Requirement 2, CP-002 | Unreadable, oversized, unavailable and budget-truncated fixtures | Surface-specific coverage metadata may differ |
| Engine and nonstandard layouts | Requirement 2, CP-001/CP-005 | Fixture outcomes for expected role/config coverage | Convention depth may be broader than initial fixture |
| Existing adapter regressions and telemetry redaction | Requirement 4, CP-005/CP-006 | Targeted response-redaction and telemetry-attribute suppression assertions, in addition to the adapter suite | Incomplete logging path coverage may remain until G5/T007 passes |
| Rails dogfood review | Success criteria | Bounded evidence ledger entry | One project is not universal proof |

## Downstream Task Guidance

- Verify reuse of the existing generic `resource` node during T001; do not add
  graph kinds without reopening architecture review.
- Build fixtures before implementation and preserve the parser boundary.
- Run focused tests throughout, then `pnpm typecheck` and `pnpm test`.
- Request architecture review if public contracts or graph schema change.

## Operational Considerations

Rails discovery must reuse bounded catalog data and avoid a second unbounded
walk. `docs/design/observability-debugging-design.md` governs telemetry:
instrumentation is low-cardinality and may record counts, timings, outcomes,
coverage states, and existing contract-approved repository identity, but Spec
047 adds no raw Rails file paths, source bodies, command arguments, secret-like
values, or new repository-specific identifiers. T007 must test both response
redaction and Rails-specific telemetry attribute suppression.

## Open Questions

No owner decision remains open. Focused post-remediation design review accepted
these decisions. T001 reconciles them against the live source seams before
fixtures or implementation proceed.

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
