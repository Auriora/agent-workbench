---
title: Trust calibration in tool outputs design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Design

## Overview

Spec 035 adds a centralized, additive trust calibration contract to Agent
Workbench response metadata. Public presenters will derive compact structured
safe-use, unsafe-use, and required-verification fields from a shared policy
instead of repeating caveat prose in individual MCP adapters. The design keeps
existing response envelopes, capability levels, evidence kinds, freshness,
analysis validity, and verification status intact while making the boundary
between routing evidence and claim-supporting evidence machine-readable.

## Decisions

- **D001 Field location:** Add trust calibration as optional `meta.trust` on
  `ResponseMetadata`. This keeps the contract beside freshness, evidence,
  capability, verification status, caveats, warnings, and errors without
  changing the response envelope shape.
- **D002 Vocabulary shape:** Use enum-backed structured values for
  `safe_to_use_for`, `not_safe_to_use_for`, and `must_verify_by`. Human-facing
  prose may be derived from those values, but tests assert the structured
  vocabulary.
- **D003 Coverage slice:** Cover every public Workbench MCP resource or tool
  that returns the standard envelope through a shared policy. A surface may be
  excluded only when it is not a public standard-envelope response, such as
  transport startup failure before JSON framing or private maintainer/debug
  helpers that are not registered as public MCP surfaces.
- **D004 Migration path:** Treat trust calibration as additive. No contract
  version bump is required unless implementation finds a strict consumer that
  cannot ignore optional metadata fields.

These decisions resolve requirements open questions OQ001, OQ002, and OQ003.

## High-Level Design

### Architecture

Trust calibration is a contract-level metadata addition backed by one shared
presentation policy:

```text
use case result
-> presenter selects trust surface policy
-> presenter sanitizes data, warnings, and errors
-> shared envelope helper derives meta.trust from policy, meta, warnings, and errors
-> makeEnvelope returns normal response envelope
-> MCP handler serializes the envelope
```

MCP handlers remain thin. They validate transport input, call one use case, and
delegate output shaping to presenters. Use cases continue to return
application-level result objects. Presenters and response metadata helpers own
the trust contract.

### Components

- `src/contracts/runtime-response-contracts.ts`
  - Defines trust calibration schemas and exports the associated TypeScript
    types through the existing contract barrels.
  - Extends `responseMetadataSchema` with optional `trust`.
- `src/application/use-cases/response-metadata.ts`
  - Defines typed trust surface policies.
  - Derives `TrustCalibration` from policy, capability level, evidence kinds,
    freshness, analysis validity, verification status, warnings, errors, and
    caveats.
  - Applies conservative failure-state overrides.
- `src/presentation/`
  - Passes one trust policy input per public response family.
  - Builds or calls the final envelope helper only after top-level warnings and
    errors are known, so failure-state trust uses the complete response.
  - Does not write long adapter-specific caveat prose for safe and unsafe uses.
- `src/interface-adapters/mcp/registries/`
  - Keeps public surface registration explicit.
  - Provides enough registry metadata or test fixtures to prove each public
    standard-envelope surface has a trust policy or documented exclusion.
- `tests/contracts/`, `tests/mcp/`, and `tests/docs/`
  - Lock the schema, policy matrix, golden public outputs, and documentation
    metadata.

### Data Model

`ResponseMetadata` gains:

```ts
type TrustCalibration = {
  safe_to_use_for: TrustUse[];
  not_safe_to_use_for: TrustUse[];
  must_verify_by: TrustVerificationRequirement[];
};
```

`TrustUse` is a shared enum. Initial values:

- `navigation`
- `next_read_selection`
- `local_structure_reference`
- `precise_direct_read_claim`
- `runtime_availability`
- `validation_planning`
- `edit_preview_review`
- `applied_edit_observation`
- `bounded_executed_validation_claim`
- `implementation_claim`
- `passed_validation_claim`
- `task_completion_claim`
- `closure_claim`
- `safe_mutation_claim`
- `whole_program_impact_claim`
- `security_or_vulnerability_claim`

The same `TrustUse` enum is used in both safe and unsafe arrays so tests can
assert that a use does not appear in both lists.

`TrustVerificationRequirement` is a shared enum. Initial values:

- `direct_read_relevant_source`
- `inspect_ranked_evidence`
- `run_planned_validation`
- `review_diagnostics_output`
- `review_generated_diff`
- `refresh_runtime_snapshot`
- `resolve_blocked_environment`
- `consult_lifecycle_authority`
- `obtain_executed_validation_evidence`
- `perform_security_review`

These values name the next evidence class, not a command runner. They do not
introduce command execution.

### Policy Inputs

Presenters pass a typed `TrustSurfacePolicy` into `buildResponseMeta` or a
small wrapper around it:

```ts
type TrustSurfaceKind =
  | "context_routing"
  | "docs_routing"
  | "docs_direct_read"
  | "graph_symbol_routing"
  | "graph_reference_routing"
  | "graph_impact_routing"
  | "diagnostics_static"
  | "markdown_quality"
  | "validation_plan"
  | "edit_preview"
  | "edit_apply"
  | "repository_status"
  | "docs_session_scope"
  | "integration_health"
  | "generic_error";

type TrustSurfacePolicy = {
  surface_kind: TrustSurfaceKind;
  includes_direct_read?: boolean;
  includes_executed_validation?: boolean;
  mutation_applied?: boolean;
};
```

The policy input is intentionally small. Existing metadata still decides most
trust outcomes. Specialized fields only identify facts that the generic
metadata cannot infer, such as whether a docs response is a direct section read
or an edit response describes a preview versus an applied mutation.

### Policy Matrix

The policy matrix is expressed as exact enum sets. Each implementation branch
may add narrower verification requirements, but it must not substitute
unlisted free-form values.

#### Routing-Only Evidence

Applies to context routing, docs search, docs map, docs overview, repository
overview, repository status, integration health, and docs session scope.

- `safe_to_use_for`: `navigation`, `next_read_selection`, and
  `runtime_availability` only when the surface reports runtime or session
  availability.
- `not_safe_to_use_for`: `implementation_claim`,
  `passed_validation_claim`, `task_completion_claim`, `closure_claim`,
  `safe_mutation_claim`, `whole_program_impact_claim`,
  `security_or_vulnerability_claim`.
- `must_verify_by`: `direct_read_relevant_source`,
  `inspect_ranked_evidence`, and `run_planned_validation` when behavior,
  completion, or validation claims are needed.

#### Parser-Backed Or Partial-Semantic Graph Evidence

- `safe_to_use_for`: `navigation`, `next_read_selection`,
  `local_structure_reference`.
- `not_safe_to_use_for`: `safe_mutation_claim`,
  `whole_program_impact_claim`, `passed_validation_claim`,
  `task_completion_claim`, `closure_claim`,
  `security_or_vulnerability_claim`.
- `must_verify_by`: `direct_read_relevant_source`,
  `run_planned_validation`.

#### Direct Docs Or Source Read

- `safe_to_use_for`: `precise_direct_read_claim`.
- `not_safe_to_use_for`: `implementation_claim`, `closure_claim`,
  `whole_program_impact_claim`, `safe_mutation_claim`,
  `passed_validation_claim`, `task_completion_claim`,
  `security_or_vulnerability_claim`.
- `must_verify_by`: `direct_read_relevant_source`,
  `run_planned_validation`.

#### Static Diagnostics And Markdown Quality

- `safe_to_use_for`: `navigation`, `precise_direct_read_claim` when the
  finding includes bounded direct-read evidence for the reported document or
  file.
- `not_safe_to_use_for`: `passed_validation_claim`,
  `task_completion_claim`, `closure_claim`, `safe_mutation_claim`,
  `whole_program_impact_claim`, `security_or_vulnerability_claim`.
- `must_verify_by`: `review_diagnostics_output`,
  `direct_read_relevant_source`, `run_planned_validation`.

#### Planned Validation

- `safe_to_use_for`: `validation_planning`.
- `not_safe_to_use_for`: `passed_validation_claim`,
  `task_completion_claim`, `closure_claim`, `safe_mutation_claim`,
  `whole_program_impact_claim`, `security_or_vulnerability_claim`.
- `must_verify_by`: `run_planned_validation`,
  `obtain_executed_validation_evidence`.

#### Executed Validation Or Equivalent Evidence

- `safe_to_use_for`: `bounded_executed_validation_claim`.
- `not_safe_to_use_for`: `closure_claim`, `whole_program_impact_claim`,
  `security_or_vulnerability_claim`, and any unrelated
  `implementation_claim` or `task_completion_claim` not covered by the
  executed evidence.
- `must_verify_by`: `run_planned_validation`,
  `obtain_executed_validation_evidence`, `perform_security_review` when the
  claim is security-sensitive.

#### Edit Preview

- `safe_to_use_for`: `edit_preview_review`.
- `not_safe_to_use_for`: `applied_edit_observation`,
  `safe_mutation_claim`, `task_completion_claim`, `closure_claim`,
  `passed_validation_claim`, `whole_program_impact_claim`,
  `security_or_vulnerability_claim`.
- `must_verify_by`: `review_generated_diff`, `run_planned_validation`.

#### Applied Edit Result

- `safe_to_use_for`: `applied_edit_observation`.
- `not_safe_to_use_for`: `safe_mutation_claim`,
  `passed_validation_claim`, `task_completion_claim`, `closure_claim`,
  `whole_program_impact_claim`, `security_or_vulnerability_claim`.
- `must_verify_by`: `review_generated_diff`, `run_planned_validation`.

#### Error, Warning, Stale, Degraded, Invalid, Blocked, Or Environment Failure

- `safe_to_use_for`: only the non-proof use from the base surface policy, such
  as `navigation`, `next_read_selection`, `runtime_availability`,
  `validation_planning`, or `edit_preview_review`.
- `not_safe_to_use_for`: `implementation_claim`,
  `passed_validation_claim`, `task_completion_claim`, `closure_claim`,
  `safe_mutation_claim`, `whole_program_impact_claim`,
  `security_or_vulnerability_claim`.
- `must_verify_by`: `refresh_runtime_snapshot`,
  `resolve_blocked_environment`, `direct_read_relevant_source`,
  `run_planned_validation`.

Failure-state overrides run after surface policy derivation. If metadata has
`analysis_validity: invalid`, `analysis_validity: invalid_due_to_environment`,
`freshness: stale`, `freshness: cold`, `freshness: refreshing`,
`verification_status: blocked`, `verification_status: planned`, warnings,
errors, or blocker caveats, the helper removes proof-like uses from
`safe_to_use_for` and adds the matching verification requirement.

### Data Flow By Tool Family

- `context_for_task`
  - Uses `context_routing`.
  - Safe for navigation, next-read selection, and planning. Lifecycle evidence
    remains routing evidence unless it is supplied by a lifecycle authority and
    still does not become Workbench proof of task completion.
- Docs search, overview, map, current-for-task, and outline
  - Use `docs_routing`.
  - Search and inventory results remain routing evidence.
- `docs_read_section`
  - Uses `docs_direct_read` with `includes_direct_read: true`.
  - Safe for precise claims about the returned bounded section only.
- `symbol_search`
  - Uses `graph_symbol_routing`.
  - Parser evidence may support local structure references; heuristic and text
    fallback evidence remain navigation only.
- `find_references`
  - Uses `graph_reference_routing`.
  - Safe scope depends on evidence kinds and confidence. It never implies safe
    broad refactoring by itself.
- `impact`
  - Uses `graph_impact_routing`.
  - Safe for bounded blast-radius routing. Whole-program impact and safe
    mutation require direct review and validation.
- `diagnostics_for_files` and post-edit feedback presented through public
  runtime surfaces
  - Use `diagnostics_static`.
  - Static findings are safe to inspect; they are not executed validation.
- `check_markdown_document` and `check_markdown_set`
  - Use `markdown_quality`.
  - Findings are static direct-read documentation evidence for the checked
    Markdown paths. They are not proof that a broader documentation set is
    complete unless the checked scope covers that claim and residual warnings
    are resolved.
- `docs_scope`
  - Uses `docs_session_scope`.
  - Safe for session-scoped documentation routing state only. Setting or
    showing scope is not proof that scoped docs are current, accepted, or
    complete.
- `verification_plan`
  - Uses `validation_plan`.
  - Commands are planned evidence until execution evidence is explicitly
    supplied by a future approved surface.
- `preview_workspace_edit`
  - Uses `edit_preview`.
  - Safe for reviewing proposed changes, not for claiming mutation occurred.
- `apply_workspace_edit`
  - Uses `edit_apply` with `mutation_applied: true` only after the apply use
    case reports a successful bounded write.
  - Safe for observing that the bounded edit was applied. Validation remains
    required.
- `repo:///status`, `repo:///scope`, `repo:///overview`,
  `repo:///docs/overview`, and `repo:///docs/map`
  - Use `repository_status` or `docs_routing`.
  - Safe for runtime availability, inventory, and navigation, not task proof.
- `integration:///health/agent-workbench` and integration profiles
  - Use `integration_health`.
  - Safe for configured/callable surface routing. Not proof that a user task is
    complete.

## Low-Level Design

### Contract Schemas

Add Zod schemas:

```ts
export const trustUseSchema = z.enum([...]);
export const trustVerificationRequirementSchema = z.enum([...]);

export const trustCalibrationSchema = z
  .object({
    safe_to_use_for: z.array(trustUseSchema),
    not_safe_to_use_for: z.array(trustUseSchema),
    must_verify_by: z.array(trustVerificationRequirementSchema)
  })
  .strict();
```

Extend `responseMetadataSchema`:

```ts
trust: trustCalibrationSchema.optional()
```

The helper must deduplicate and sort arrays for deterministic golden tests.
Contract tests must reject unknown enum values and duplicate safe/unsafe
contradictions in generated metadata.

### Metadata Helper Changes

Add a shared helper for final presenter or envelope construction:

```ts
export function buildTrustCalibration(input: {
  policy: TrustSurfacePolicy;
  meta: Omit<ResponseMetadata, "trust">;
  warnings?: readonly AttentionItem[];
  errors?: readonly RuntimeError[];
}): TrustCalibration;
```

Public standard-envelope surfaces must use a final envelope integration point:

```ts
export function makeTrustedEnvelope<T>(input: {
  data: T;
  meta: Omit<ResponseMetadata, "trust">;
  trust_policy: TrustSurfacePolicy;
  warnings?: readonly AttentionItem[];
  errors?: readonly RuntimeError[];
}): ResponseEnvelope<T>;
```

`makeTrustedEnvelope` must derive `meta.trust` after presenter data sanitization
and after top-level warnings and errors are known. This preserves R1 AC6 for
responses where warnings and errors live outside `meta`.
`buildResponseMeta` remains the base metadata helper and must not be the public
trust derivation boundary unless a later design changes how warnings and errors
flow through metadata construction. Structured error envelopes should wrap
`invalidResponseMeta` with `makeTrustedEnvelope` and a `generic_error` policy so
error calibration stays centralized without duplicating handler logic.

The implementation should avoid an uncalibrated fallback for public surfaces.
For internal tests or private helpers that build metadata before a public
presenter selects a policy, `makeEnvelope` may remain available. Public
presenter tests and registry tests catch omissions before release.

### Derivation Algorithm

1. Start with the base safe, unsafe, and verification requirement sets for the
   selected `TrustSurfaceKind`.
2. Strengthen safe scope only from explicit evidence:
   - `direct_read` plus `includes_direct_read` may add
     `precise_direct_read_claim`.
   - `executed_command` plus `includes_executed_validation` and
     `verification_status: done` may add
     `bounded_executed_validation_claim`.
   - `parser`, `compiler_api`, or `lsp` with semantic or partial-semantic
     capability may add `local_structure_reference`, but not broad mutation or
     behavior proof.
3. Apply verification-status rules:
   - `planned` adds `validation_planning` safe use and marks
     `passed_validation_claim` unsafe.
   - `needed` keeps proof-like uses unsafe.
   - `blocked` adds environment or validation recovery requirements.
   - `done` only permits bounded executed-validation use when the policy
     explicitly says executed validation is represented.
4. Apply freshness and validity rules:
   - stale, cold, refreshing, unknown freshness, partial validity, invalid
     validity, or invalid-due-to-environment validity remove proof-like safe
     uses and add refresh, direct-read, or environment requirements.
5. Apply warnings, errors, and blocker caveats:
   - Any warnings or errors keep completion, closure, safe mutation, broad
     proof, and security claims unsafe.
   - Validation blockers add `resolve_blocked_environment` or
     `run_planned_validation`.
6. Return sorted arrays and assert no use appears in both safe and unsafe. If a
   conflict exists, unsafe wins and the helper removes the value from safe.

### Error Handling

Recoverable MCP errors already return normal envelopes. Those envelopes must
include `meta.trust` through `invalidResponseMeta` or equivalent error
presenters.

Transport failures that prevent MCP response framing cannot include
`meta.trust`. They are the only expected implementation exclusion and must be
documented in durable runtime contracts.

### Test Strategy

Design acceptance requires these test classes before implementation closure:

- Contract tests for the new schemas, enum exports, additive parse behavior,
  and generated safe/unsafe disjointness.
- Policy matrix unit tests covering CP001 through CP007.
- Registry or presenter coverage tests proving each public standard-envelope
  surface selects a trust policy or is explicitly excluded.
- Golden tests for representative responses from context routing, docs
  routing, docs direct read, symbol search, references, impact, diagnostics,
  verification plan, edit preview, edit apply, repository status, integration
  health, and structured errors.
- Regression tests proving planned validation is not labeled as executed, and
  routing-only evidence is not labeled as proof.
- Compatibility tests proving older consumers that ignore `meta.trust` still
  see unchanged metadata fields.

## Operational Considerations

- **Rollout:** Land contract schema and helper tests first, then presenter
  policy wiring, then golden coverage. This keeps failures attributable.
- **Compatibility:** Because `meta.trust` is optional, older consumers can
  ignore it. New public responses should include it once their presenter is
  wired.
- **Compactness:** Trust fields are structured arrays, not paragraph caveats.
  Existing caveats remain for blockers and runtime-specific context.
- **No execution expansion:** Trust calibration describes evidence already
  represented in the response. It must not run commands or auto-validate.
- **No hidden fallback:** If evidence is missing, the response names the missing
  verification requirement instead of silently broadening parser, semantic, or
  command behavior.
- **Durable promotion:** Accepted behavior must be promoted to
  `docs/reference/runtime-contracts.md` and
  `docs/design/mcp-surface-design.md` before spec closure.

## Requirements Trace

- R1 Central Trust Calibration Contract: covered by D001, D004, the data
  model, contract schemas, and failure-state overrides.
- R2 Shared Generation Policy: covered by architecture, components, policy
  inputs, and metadata helper changes.
- R3 Evidence Distinctions Stay Explicit: covered by the policy matrix,
  derivation algorithm, and data flow by tool family.
- R4 Major Tool Family Coverage: covered by data flow by tool family and
  coverage slice D003.
- R5 Contract And Golden Test Coverage: covered by the test strategy.
- CP001 Routing Is Not Proof: covered by the policy matrix and regression
  tests.
- CP002 Planned Is Not Executed: covered by the derivation algorithm and
  validation-plan tests.
- CP003 Direct-Read Scope Is Bounded: covered by docs direct-read policy and
  direct-read tests.
- CP004 Capability Vocabulary Is Stable: covered by additive contract schemas
  and compatibility tests.
- CP005 Shared Policy Covers Public Surfaces: covered by registry and
  presenter coverage tests.
- CP006 Failure States Cannot Be Proof: covered by failure-state overrides and
  structured error tests.
- CP007 Additive Compatibility: covered by D004 and compatibility tests.

## Open Questions

None blocking design acceptance. If implementation discovers a strict consumer
that rejects optional `meta.trust`, route the migration decision back through
the design before changing `contract_version`.
