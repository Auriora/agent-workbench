---
title: First-read reliability and bounded tools open decisions
doc_type: spec
artifact_type: open-decisions
status: draft
owner: platform
last_reviewed: 2026-07-10
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Open Decisions

## Purpose

Track implementation-blocking Spec 037 decisions that must be resolved or routed
before code changes start. These decisions are intentionally separate from the
task checklist so lifecycle tooling and worker agents do not treat broad design
uncertainty as implementation-ready work.

## Decisions

### D001: Response-State Vocabulary

- **Question:** Does the existing runtime response vocabulary cover first-read
  valid, stale, degraded, and blocked distinctions, or is an EB024 contract
  migration required first?
- **Context:** Current contracts already separate related concepts:
  `freshness` covers `fresh`, `stale`, `cold`, `refreshing`, and `unknown`;
  `analysis_validity` covers `valid`, `partial`, `invalid`, and
  `invalid_due_to_environment`; `verification_status` covers validation state;
  and trust metadata names safe uses, unsafe claims, and required verification.
  Spec 037 needs first-read responses to become clearer without creating a
  second, incompatible state vocabulary.
- **Why it matters:** First-read behavior spans public MCP resources and tools.
  Adding incompatible status values would create a contract migration rather
  than an implementation hardening slice.
- **Options:**
  - **Use existing vocabulary only.** Map first-read states onto current
    `freshness`, `analysis_validity`, `verification_status`, `warnings`,
    `errors`, and `meta.trust`.
    - Benefit: lowest contract risk and likely no EB024 prerequisite.
    - Cost: implementers must document the mapping carefully so "degraded" and
      "blocked" are not interpreted as missing top-level enum values.
  - **Add helper semantics without new public enum values.** Keep public
    contracts stable, but add or clarify shared helpers that derive first-read
    safe-use, missing-evidence, skipped-work, stale, degraded, and blocked
    presentation from existing fields.
    - Benefit: gives implementers one coherent path while preserving API
      compatibility.
    - Cost: still requires focused contract and golden response tests to prove
      the mapping.
  - **Promote EB024 before implementation.** Treat first-read valid, stale,
    degraded, and blocked as a contract migration with new or changed public
    status values.
    - Benefit: maximally explicit public vocabulary.
    - Cost: expands scope, delays this spec, and increases downstream golden
      output churn.
- **Recommendation:** Use additive helper semantics without new public enum
  values for the first slice. Record the mapping in `design.md` and
  `docs/reference/runtime-contracts.md`: stale should primarily use
  `freshness`, degraded should use `analysis_validity: partial` plus caveats and
  trust restrictions, and blocked should use `verification_status: blocked`,
  `invalid_due_to_environment`, warnings/errors, or safe-use restrictions as
  appropriate. Route to EB024 only if T002 proves an existing field cannot
  express a required public contract.
- **Approved resolution:** Approved on 2026-07-10. Use additive helper semantics
  with existing public response fields for the first slice. EB024 is not a
  prerequisite unless T002 proves a concrete field-level contract gap.
- **Affected stage:** design and implementation.
- **Expected answer shape:** one of: existing vocabulary is sufficient; additive
  helper semantics are sufficient; EB024 must run before broad changes.
- **Blocking status:** blocks T003, T004, T006, and T007.
- **Artifact destination:** `design.md`, `traceability.md`, and
  `docs/reference/runtime-contracts.md` if behavior is accepted.
- **Owner:** platform.
- **Status:** approved.

### D002: Failure-Mode Fixture Strategy

- **Question:** Should cold, stale, degraded, blocked, permission-limited,
  unsupported, and budget-truncated modes be tested with filesystem fixtures,
  adapter fakes, or both?
- **Context:** Spec 037 covers behavior that comes from real repository shape
  and runtime state. Some cases, such as unsupported language, skipped paths, and
  budget truncation, are naturally fixture-driven. Other cases, such as blocked
  daemon state, stale watcher ownership, provider failure, and refresh timing,
  are difficult to reproduce reliably with only filesystem fixtures.
- **Why it matters:** Wall-clock or daemon-state tests can become flaky, but
  overuse of fakes can miss real first-read behavior.
- **Options:**
  - **Filesystem fixtures only.** Add small fixture repositories for cold,
    unsupported, permission-limited, generated/vendor-heavy, and
    budget-truncated shapes.
    - Benefit: high confidence that public use cases work against real files.
    - Cost: poor fit for daemon, watcher, provider, and timeout states; may
      encourage flaky timing tests.
  - **Adapter fakes only.** Test first-read classification with injected runtime,
    graph, docs, diagnostics, or provider states.
    - Benefit: deterministic coverage for stale, blocked, provider-limited, and
      timeout-like states.
    - Cost: can miss integration failures in catalog scanning, resource
      presenters, and fixture repositories.
  - **Hybrid fixtures and adapter fakes.** Use filesystem fixtures for
    repository-shape evidence and adapter fakes for nondeterministic runtime or
    provider states.
    - Benefit: balances real integration evidence with deterministic edge-case
      coverage.
    - Cost: requires clearer test ownership so fake-backed tests do not become a
      parallel implementation path.
- **Recommendation:** Use the hybrid strategy. Start with one filesystem fixture
  for unsupported/skipped/budget behavior and one adapter-fake test for a stale
  or blocked runtime/provider state. Do not use wall-clock sleeps, daemon races,
  or hidden retries as test mechanisms. Record which modes are covered by
  fixtures versus fakes in `verification.md`.
- **Approved resolution:** Approved on 2026-07-10. Use the hybrid strategy:
  filesystem fixtures for repository-shape behavior and adapter fakes for
  nondeterministic runtime, watcher, provider, stale, or blocked states.
- **Affected stage:** design and validation.
- **Expected answer shape:** selected fixture strategy with the first test slice
  and any intentionally deferred failure modes.
- **Blocking status:** blocks T003 and T005.
- **Artifact destination:** `design.md`, `verification.md`, and focused test
  files.
- **Owner:** platform.
- **Status:** approved.

### D003: Shared Classifier Ownership

- **Question:** Should first-read classification live in response metadata
  helpers or in per-use-case helpers?
- **Context:** The current implementation already centralizes response metadata,
  trust calibration, runtime trust classification, watcher freshness caveats,
  and invalid response metadata in `response-metadata.ts`. First-read behavior
  still spans multiple use cases, so surface-specific code needs a way to supply
  minimum evidence, skipped work, provider status, and blockers without copying
  the classification rules.
- **Why it matters:** Duplicated classification across status, scope, overview,
  context, docs, diagnostics, and verification planning would make the behavior
  drift-prone.
- **Options:**
  - **Centralize all first-read logic in `response-metadata.ts`.** Put shared
    classification, minimum-evidence checks, skipped-work shaping, and caveat
    generation behind one helper.
    - Benefit: one source of truth.
    - Cost: risks turning response metadata into a cross-surface policy module
      that knows too much about individual tools.
  - **Keep classification per use case.** Each first-read surface decides its own
    stale, degraded, blocked, skipped-work, and trust behavior.
    - Benefit: each surface can define precise minimum evidence locally.
    - Cost: high drift risk and repeated logic across status, scope, overview,
      context, docs, diagnostics, and verification planning.
  - **Shared helper with per-use-case evidence inputs.** Keep response metadata
    responsible for common vocabulary, trust calibration, and bounded caveat
    shaping. Let each use case provide minimum-evidence inputs and
    surface-specific missing/skipped/provider evidence.
    - Benefit: preserves one contract-backed classifier without making MCP
      adapters or response metadata own every surface rule.
    - Cost: requires a small, well-tested input shape and disciplined use-case
      boundaries.
- **Recommendation:** Use a shared helper with per-use-case evidence inputs.
  Keep MCP registries thin. Keep shared vocabulary, trust calibration, and common
  stale/degraded/blocked derivation in application-level response metadata
  helpers. Keep minimum-evidence decisions close to each use case, then pass the
  result into the shared helper for consistent metadata and presentation.
- **Approved resolution:** Approved on 2026-07-10. Use a shared application-level
  helper with per-use-case evidence inputs. Keep shared vocabulary, trust
  calibration, and common derivation in response metadata helpers while leaving
  minimum-evidence rules near each use case.
- **Affected stage:** design and implementation.
- **Expected answer shape:** selected ownership boundary plus the first file set
  to change.
- **Blocking status:** blocks T003 and T004.
- **Artifact destination:** `design.md` and implementation tasks.
- **Owner:** platform.
- **Status:** approved.

## Resolution Rules

- Resolve each approved decision into `design.md`, `traceability.md`, and
  `verification.md` before marking T003 complete.
- If a decision expands scope beyond this package, mark the affected task
  attention-needed and route the residual to one backlog item or follow-up spec.
- Record the concrete resolution and validation impact in `verification.md`
  before implementation tasks are marked complete.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
