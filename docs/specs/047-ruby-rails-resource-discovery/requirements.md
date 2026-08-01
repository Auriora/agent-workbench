---
title: Ruby and Rails resource discovery requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-08-01
---

# Requirements

## Introduction

Agent Workbench currently treats Ruby and Rails repositories as unsupported or
generic text even though an active Rails solution is available for dogfood and
feedback. This slice makes Ruby/Rails the next ecosystem expansion by adding
resource-backed repository discovery, constrained Rails-aware routing evidence,
and non-executed validation planning. Parser-backed Ruby symbols and references
belong to the sequenced follow-up spec.

## Goals

- Identify Ruby files, package metadata, Rails application structure, and test
  conventions without executing repository code.
- Route context toward first-party Rails files and nearby tests.
- Produce policy-aware Bundler, Rails, Rake, RSpec, and Minitest validation
  candidates while preserving planned-versus-executed evidence boundaries.
- Surface secret-bearing Rails configuration as skipped or redacted under shared
  workspace policy and avoid leaking configured credentials.
- Establish representative fixtures and dogfood evidence for parser promotion.

## Non-Goals

- Ruby symbol, reference, or impact claims above `resource_backed`.
- Executing Bundler, Rails, Rake, tests, generators, migrations, or application
  boot as part of discovery.
- Runtime boot and dynamic framework startup remain out of scope for this spec
  and do not block closure.
- Adding Ruby AST, LSP, Sorbet, RuboCop, or command-execution fallbacks.
- Inferring runtime metaprogramming, database state, mounted engines, or route
  behavior from convention alone.
- Implementing parser-backed Ruby/Rails semantics from the follow-up spec.
- Reading or surfacing secret material from `config/master.key`, credentials, or
  `.env`-style files.

## Glossary

| Term | Definition |
|------|------------|
| Rails role | A conventional first-party application area such as controller, model, job, mailer, channel, service, concern, migration, or test. |
| Resource-backed | Useful file, configuration, and convention evidence that is not semantic proof. |
| Validation candidate | A command selected and explained by repository evidence but not executed by Agent Workbench. |
| Discovery coverage | Existing coverage metadata that states whether bounded catalog evidence is complete, partial, blocked, or otherwise non-complete. |

## Durable Source Baseline

| Source | Current behavior relied on | Confidence | Notes |
|--------|----------------------------|------------|-------|
| `docs/design/language-adapter-design.md` | Tree-sitter is the only primary code extraction path; Ruby starts resource-backed and may later become partial-semantic. | high | Canonical adapter design. |
| `docs/reference/language-capability-matrix.md` | Ruby is currently below already delivered adapters in the priority list. | high | The proposed priority change remains pending T007/T008 evidence and durable promotion. |
| `docs/backlog/README.md` | EB010 permits promotion using representative fixtures, recent project evidence, and tester availability. | high | This spec is the focused EB010 delivery slice. |
| `docs/reference/runtime-contracts.md` | Capability, provenance, validation-status, trust, and degraded-state vocabulary. | high | Public contracts remain language-neutral. |
| `docs/reference/workspace-safety-contract.md` | Shared path policy and redaction behavior include generated and secret-bearing files. | medium | Route and fixtures must follow these constraints. |

## Durable Impact

| Durable area | Action | Target | Notes |
|--------------|--------|--------|-------|
| design | modify (proposed) | `docs/design/language-adapter-design.md` | Record pending Ruby/Rails resource-backed behavior and residual limits after T007/T008 promotion evidence. |
| reference | modify (proposed) | `docs/reference/language-capability-matrix.md` | Raise Ruby/Rails priority and record pending delivered level after T007/T008 promotion evidence. |
| backlog | modify (proposed) | `docs/backlog/README.md` | Record EB010 promotion status and follow-up parser destination. |
| contracts | clarify if needed | `docs/reference/runtime-contracts.md` | Only if implementation exposes new generic metadata; no Ruby-only public fields. |
| dogfood evidence | add | `docs/reference/dogfood-evidence-ledger.md` | Distill dogfood outcomes and confidence for scope gates only. |

## Staged Readiness

- **Current stage:** reconcile
- **Next stage:** T001 repository reconciliation
- **Ready to leave design when:** Rails discovery ownership, safety, validation,
  fixture, and follow-up boundaries pass focused design review.
- **Design-first exception:** no
- **Optional artifacts included:** `canonical-context.md`, `change-impact.md`,
  `traceability.md`, `verification.md`
- **Downstream review needed:** design, tasks, traceability, verification

## Requirements

### Requirement 1: Ruby and Rails file identity

**User Story:** As a coding agent, I want Ruby and Rails files classified
correctly so that repository orientation is not dominated by incidental files
or generic text evidence.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a repository containing `.rb` files, WHEN it is scanned, THEN the
   system SHALL classify those files as Ruby with `resource_backed` evidence.
2. WHERE non-secret config and packaging evidence exists (`Gemfile`, `Gemfile.lock`,
   `.ruby-version`, `Rakefile`, `config.ru`, or Rails environment/config files),
   THE SYSTEM SHALL surface it as package, application, or validation-routing
   evidence with explicit provenance.
3. WHERE repository evidence includes `config/master.key`,
   `config/credentials/**`, encrypted Rails credential files, `.env*`, or
   similarly secret-bearing files, THE SYSTEM SHALL classify them through the
   shared workspace policy, mark them skipped/redacted, and SHALL NOT surface
   secret contents. Safe examples such as `.env.example` remain permitted only
   when the shared policy classifies them as non-secret.
4. WHERE generated, vendor, cache, log, coverage, temporary, or dependency
   paths match repository policy, THE SYSTEM SHALL exclude or down-rank them
   consistently with the shared path policy.
### Requirement 2: Rails application-shape discovery

**User Story:** As a coding agent, I want Rails application roles and tests
identified so that context selection starts from relevant first-party files.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a conventional Rails application, WHEN context or overview is
   requested, THEN the system SHALL identify bounded evidence for controllers,
   models, jobs, mailers, channels, services, concerns, migrations, routes,
   configuration, and tests that actually exist by consulting a bounded repository
   catalog and SHALL NOT run a second repository traversal.
2. IF Rails discovery encounters unreadable or oversized files, unavailable
   required evidence, or a catalog/response budget limit, THEN the system SHALL
   expose the affected evidence class as partial, blocked, or otherwise
   non-complete using existing coverage and caveat vocabulary, including the
   reason and missing evidence, rather than returning success-shaped omission.
3. GIVEN a bounded catalog-backed application shape where route evidence is
   found, THEN the system SHALL identify only observed route file paths such as
   `config/routes.rb` and path/config-role metadata; it SHALL NOT parse Ruby DSL
   syntax, extract route declarations, or claim runtime route resolution.
4. GIVEN a selected Ruby or Rails file, WHEN related context is ranked, THEN
   nearby tests, package metadata, routes, and role-adjacent files SHALL be
   preferred over unrelated generic resources.
5. WHERE a Rails convention is inferred only from a path or config/file anchor,
   THE SYSTEM SHALL label it resource-backed and SHALL NOT claim runtime route,
   constant, callback, association, or database semantics.
6. GIVEN a Rails engine or non-standard layout with observed Rails markers, WHEN
   context or overview is requested, THEN the system SHALL identify the
   catalog-visible role, configuration, route-file, and test roots that actually
   exist without requiring a conventional `app/` layout or fabricating missing
   conventional paths.

### Requirement 3: Rails-aware validation planning

**User Story:** As a coding agent, I want repository-approved Rails validation
commands so that I do not guess at the test runner or execution environment.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN RSpec evidence, WHEN validation is planned, THEN the system SHALL
   apply command precedence and prefer the nearest repository-supported RSpec
   command using catalog-visible project-root ancestry and directory distance,
   then label it planned.
2. GIVEN Minitest evidence, WHEN validation is planned, THEN the system SHALL
   prefer the nearest repository-supported Rails or Ruby test command using the
   same deterministic root-ranking policy and label it planned.
3. Validation sources SHALL be limited to catalog-visible or fixed known paths
   and use this precedence: explicit repository policy or
   instructions first; explicitly required execution environments and wrappers
   second; repository-supported binstubs, scripts, framework manifests, and test
   layout within those boundaries third; and generic Ruby/Rails host defaults
   last, only when repository policy permits them.
4. WHERE Docker, Compose, devcontainer, Nix, or similar artifacts exist without
   instructions or policy requiring that environment, THE SYSTEM SHALL treat
   those artifacts as advisory rather than automatically blocking or replacing
   an otherwise supported command.
5. WHERE repository instructions require Docker, Compose, devcontainer, Nix,
   or another constrained environment, THE SYSTEM SHALL not substitute an
   unapproved host command.
6. IF required command, nearest-root, or environment evidence is absent or
   conflicting, THEN
   THE SYSTEM SHALL return structured `needed` or `blocked` validation evidence,
   with an explicit source-preference reason, rather than executing, guessing,
   or silently falling back. Planned candidates SHALL use structured
   `{ command, args }` values, pass through existing `planCommand` safety, and
   remain `planned` and `not_executed`; shell command strings are not accepted.

### Requirement 4: Fixture-backed promotion boundary

**User Story:** As a maintainer, I want Ruby/Rails support proven against
representative repositories so that future semantic promotion has trustworthy
inputs.

**Priority:** must-have

#### Acceptance Criteria

1. THE SYSTEM SHALL have fixture coverage for a conventional Rails application,
   an engine and one non-standard layout, RSpec, Minitest, constrained command
   policy, absent optional files, generated/vendor exclusions, secret-bearing
   files, and degraded discovery states (missing evidence, policy truncation).
   The expected behaviors for each fixture SHALL be explicitly asserted.
2. THE SYSTEM SHALL preserve all current adapter and fixture behavior affected
   by shared file identity, catalog, extraction, overview, context, path-policy,
   and validation-planning changes, including the existing Python, JavaScript,
   TypeScript, Go, C/C++, .NET, SAM/CloudFormation, docs, and config suites.
3. Parser-backed Ruby support SHALL remain routed to the sequenced follow-up
   spec and SHALL NOT be implemented as a hidden part of this slice.

## Correctness Properties

- **CP-001:** Every Ruby/Rails result is either supported by a scanned path or
  configuration source, or is explicitly absent; conventions never fabricate
  files or runtime relationships.
- **CP-002:** Discovery coverage and validation status SHALL use existing runtime
  vocabulary to distinguish complete evidence from partial, degraded, needed,
  or blocked evidence; missing evidence is never silently omitted.
- **CP-003:** Validation planning never changes `planned`, `needed`, or
  `blocked` evidence into an executed or passed claim.
- **CP-004:** Files excluded by shared workspace policy do not re-enter the
  graph through Rails-specific discovery.
- **CP-005:** Adding Ruby/Rails routing evidence does not change the capability level or
  evidence provenance of existing language adapters.
- **CP-006:** Files, directories, and secrets excluded by shared workspace policy
  are always skipped or redacted and represented in policy-exclusion or coverage
  evidence without exposing secret contents.

## Technical Context

- **Language/Version:** TypeScript ESM runtime; Ruby/Rails repositories are
  untrusted workspace inputs.
- **Primary Dependencies:** existing filesystem scanner, capability policy,
  resource extractor, task context, overview, validation planner, Vitest.
- **Target Platform:** supported Agent Workbench Node platforms.
- **Constraints:** local-first, read-only discovery, no Ruby process execution,
  no parser or semantic fallback.
- **Performance Goals:** bounded scans and results using existing catalog and
  response budgets; no second unbounded repository traversal.

## Success Criteria

- **SC-001:** Representative Rails fixtures report Ruby and Rails evidence as
  `resource_backed`, not unsupported or semantic.
- **SC-002:** Overview and context fixtures expose catalog-backed project-shape
  outcomes, including non-complete coverage and no-second-traversal behavior.
- **SC-003:** Route evidence checks only prove anchored route files/paths and do
  not depend on route DSL parsing.
- **SC-004:** RSpec and Minitest plans use repository evidence and remain
  explicitly non-executed.
- **SC-005:** Full required validation passes with no regressions in all affected
  existing adapter and fixture surfaces, including Python, JavaScript, TypeScript,
  Go, C/C++, .NET, SAM/CloudFormation, docs, and config suites.

## Related Artifacts

- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
