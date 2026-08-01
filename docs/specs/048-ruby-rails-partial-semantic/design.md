---
title: Ruby and Rails partial-semantic design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-08-01
---

# Technical Design

## Overview

Add a Ruby tree-sitter adapter behind the existing extraction port, normalize
its output into language-neutral graph contracts, resolve only unambiguous
static references, and expose bounded Ruby/Rails evidence through existing MCP
query and context surfaces. Rails DSL extraction is part of the Ruby adapter,
not a second parser or executable framework adapter.

## Requirement Coverage

| Requirement | Acceptance Criteria | Design Coverage | Validation Approach |
|-------------|---------------------|-----------------|---------------------|
| R1 | AC1-AC3 | Grammar integration, adapter registration, structured failure | Native-load and parser-failure fixtures |
| R2 | AC1-AC3 | Declaration visitor and stable identity policy | Extraction golden tests |
| R3 | AC1-AC3 | Reference forms, resolver guardrails, coverage receipt | Reference/impact/query fixtures |
| R4 | AC1-AC3 | Bounded Rails DSL visitors and confidence rules | Rails route/model fixtures |
| R5 | AC1-AC4 | Fixture matrix, common presenters, promotion/review | Focused/full validation and dogfood |

## Correctness Property Coverage

| Property | Design Behavior | Validation Direction | Notes |
|----------|-----------------|----------------------|-------|
| CP-001 | Shared node/reference builders require path, range, provenance, and capability. | Property-style fixture assertions over every record | No new property-test dependency required. |
| CP-002 | Resolver uses existing unique-candidate rule and preserves ambiguity. | Duplicate/reopened constant fixtures | Runtime constant lookup remains out of scope. |
| CP-003 | Ruby reference results include generic coverage-domain disclosure. | Query golden tests | Align with EB061, avoid Ruby-only schema. |
| CP-004 | Adapter errors cross the existing structured failure boundary. | Missing grammar, timeout, crash tests | No partial results. |
| CP-005 | DSL confidence is derived from explicit static form and resolution state. | Dynamic/static Rails fixture pairs | No Rails boot. |

## High-Level Design

### System Architecture

```text
Spec 047 Ruby/Rails identity and catalog evidence
  -> ExtractorRegistryAdapter
  -> RubyTreeSitterExtractorAdapter
       -> declaration visitor
       -> reference visitor
       -> bounded Rails DSL visitor
  -> ExtractionBatch
  -> common graph storage and unique-candidate resolution
  -> symbol_search / find_references / impact / context_for_task
  -> capability, coverage, trust, and degraded metadata
```

### Components and Changes

- Package metadata: add one approved tree-sitter Ruby grammar to the native
  build/install path and package manifest.
- `src/infrastructure/tree-sitter/`: add Ruby parser and extractor modules,
  reusing shared range, node, reference, failure, and timeout conventions.
- Startup and debug registries: register exactly one Ruby parser adapter.
- Graph resolution: add only generic, fixture-justified resolution rules for
  Ruby reference provenance; preserve ambiguity.
- Query/context presentation: disclose Ruby parser-route coverage using common
  response contracts.
- Fixtures/tests: extend Spec 047 Rails fixtures and add parser, graph, query,
  freshness, failure, and dogfood cases.

### Data Models

Reuse `ExtractionBatch`, declaration nodes, unresolved references, resolved
edges, source ranges, adapter evidence, coverage receipts, trust metadata, and
structured error envelopes. Ruby/Rails-specific form details remain bounded in
adapter metadata. Any generic coverage-contract change must be designed once
for all parser-backed adapters and reviewed against EB061.

### Data Flow

1. Spec 047 identifies a catalog-visible Ruby file.
2. The registry selects the Ruby tree-sitter adapter.
3. One parse produces declarations, static reference candidates, Rails DSL
   evidence, diagnostics hints, and test hints.
4. The extraction batch is stored through the common graph port.
5. The resolver creates an edge only for an unambiguous indexed target.
6. Query surfaces return results with parser-route coverage, confidence,
   freshness, and degraded-state evidence.

## Low-Level Design

### Supported Initial Forms

| Area | Included initial forms | Explicit limit |
|------|------------------------|----------------|
| Declarations | module, class, singleton class with stable receiver, instance/singleton method, constant assignment | anonymous/dynamic identity remains unsupported |
| Structure | lexical nesting, explicit superclass, static include/extend/prepend candidate | runtime ancestors and constant lookup not claimed |
| Loading | static `require` and `require_relative` string literals | load path, autoload/eager-load runtime state not evaluated |
| References | static constant and fixture-approved call forms | dynamic dispatch and `send`-style calls unresolved |
| Rails routes | literal controller/action and standard resource declarations proven by fixtures | computed routes, constraints, engine runtime behavior incomplete |
| Rails models | literal association/validation/callback/concern forms proven by fixtures | database schema and callback execution not inferred |

### Algorithms and Logic

```text
extractRuby(file):
  parse once with tree-sitter Ruby
  if parser failure: return structured failure, no alternate route
  visit supported declarations and references
  visit fixture-approved Rails DSL forms
  attach source range, provenance, capability, confidence, and form metadata
  return one normalized ExtractionBatch

resolveRubyReference(reference, graph):
  select candidates allowed by the declared reference form
  if exactly one first-party indexed candidate: emit conservative edge
  otherwise: retain unresolved reference and ambiguity reason
```

### Function Signatures and Interfaces

Candidate infrastructure types:

```text
RubyParserAdapter.parse(source) -> SyntaxTree
RubyTreeSitterExtractorAdapter.extract(request) -> ExtractionBatch
RubyReferenceMetadata = { form, literal?, namespace?, rails_dsl? }
```

Exact types must reuse shared ports and contract vocabulary. MCP registries do
not contain parser logic.

### Error Handling

- Grammar load/build failure is structured degraded or blocked evidence.
- Parse timeout/crash returns no partial extraction batch.
- Syntax errors follow existing parser diagnostic conventions.
- Unsupported/dynamic forms become bounded unresolved evidence or are omitted
  with coverage caveats; they never trigger lexical or executable fallback.

### Security, Trust, and Access

Ruby and Rails inputs are untrusted. Never execute source, templates,
initializers, Rake tasks, Bundler hooks, gems, application boot, database
connections, encrypted credentials, or subprocesses during extraction. Shared
workspace containment, secret-path classification, and presentation redaction
remain mandatory.

### Migration and Compatibility

Ruby capability changes from `resource_backed` to `partial_semantic` only when
the parser is installed and extraction evidence exists. Resource-backed Rails
shape and validation planning from Spec 047 remain the same path, not a
fallback implementation. Public contract additions, if EB061 requires them,
must be additive and language-neutral.

### Slice Boundary And Residual Architecture

| Design target | In this slice | Out of this slice | Follow-up destination | Blocks closure? |
|---------------|---------------|-------------------|-----------------------|-----------------|
| Ruby parser support | One tree-sitter path and bounded static forms | AST/LSP/runtime enrichment | EB010 follow-up only with fixtures | yes |
| Ruby references | Fixture-approved static forms and ambiguity | Whole-program dynamic dispatch | backlog | no |
| Rails navigation | Bounded route/model DSL evidence | Complete Rails runtime semantics | focused follow-up backlog/spec | no |
| Coverage truth | Parser-route domain disclosure | Whole-program completeness | EB061 residual if broader migration remains | yes for Ruby surface |
| Large repo scale | Existing budgets and truthful partial coverage | Persisted completion/progress | EB014 | no |

## Validation Strategy

| Validation | Covers | Evidence Location | Residual Risk |
|------------|--------|-------------------|---------------|
| Native grammar load/package tests | R1, CP-004 | package and integration tests | Platform ABI variance |
| Extraction fixtures | R2, CP-001/CP-002 | graph extraction tests | Ruby grammar diversity |
| Reference/impact coverage tests | R3, CP-002/CP-003 | graph/query golden tests | Dynamic dispatch |
| Rails DSL fixtures | R4, CP-005 | Rails route/model fixtures | Metaprogramming diversity |
| Freshness/failure tests | R1, R5 | runtime and workspace tests | Large repo scale belongs to EB014 |
| Full gates and dogfood | R5 | `verification.md` and ledger | One solution is not universal proof |

## Downstream Task Guidance

- Do not begin implementation until Spec 047 is reconciled as delivered.
- Prove native grammar packaging before writing broad extractor logic.
- Implement declarations before references and references before Rails DSL.
- Pause for architecture review if generic contracts or graph schema change.
- Use focused tests during slices, then typecheck, full tests, plugin/package
  validation, installed-runtime smoke, and Rails dogfood.

## Operational Considerations

The adapter must parse each file once, respect file and query budgets, expose
parser timing/failure through existing telemetry, and avoid source/body logging.
EB014 owns persisted completion beyond first-pass graph budgets.

## Open Questions

No owner choice blocks package creation. Implementation review must freeze the
exact initial DSL form list from fixtures before T007 begins.

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
