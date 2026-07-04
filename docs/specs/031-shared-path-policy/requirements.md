---
title: Shared path policy requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-18
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Introduction

Agent Workbench has a rich catalog path policy and a narrower workspace safety
write policy. The policies can drift across scanner, context routing, docs
routing, preview/apply, validation planning, hooks, and presentation
redaction. A single shared classifier should decide generated, vendor, hidden,
secret, ignored, nested-repo, and explicit allowlist behavior.

## Durable Source Baseline

- [Workspace safety contract](../../reference/workspace-safety-contract.md)
- [Runtime operations design](../../design/runtime-operations-design.md)
- [Threat model](../../security/threat-model.md)
- `src/domain/policies/catalog-path-policy.ts`
- `src/infrastructure/filesystem/workspace-safety.ts`
- `src/infrastructure/filesystem/file-catalog-scanner.ts`
- `plugins/agent-workbench/hooks/post-edit-feedback.js`

## Goals

- Centralize path classification in a domain policy module.
- Use the same classifier for scan skips, read caveats, edit safety,
  validation planning, hooks, and redaction routing.
- Expand secret-bearing path detection beyond `.env` while preserving safe
  examples such as `.env.example`, `.env.sample`, and `.env.template`.
- Add tests proving scanner and write/read decisions stay consistent.

## Non-Goals

- Do not add broad generated-file source-of-truth inference; that remains EB033.
- Do not permit writes to ignored/generated/vendor paths by default.
- Do not scrape secret file contents to classify paths.

## Requirements

### Requirement 1: One Path Classifier

**User Story:** As a maintainer, I want one path classifier, so that Workbench
does not say a path is safe in one surface and unsafe in another.

#### Acceptance Criteria

1. GIVEN a repo-relative path, WHEN any runtime surface classifies it, THEN THE
   SYSTEM SHALL use the shared classifier or a documented adapter over it.
2. WHEN a path is generated, vendor, hidden, secret, ignored, nested-repo, or
   explicitly allowed, THEN the classifier SHALL return a stable reason.
3. IF a surface needs read versus write behavior, THEN it SHALL map the shared
   classification to that surface's policy without duplicating path lists.

### Requirement 2: Secret-Bearing Paths Are Explicit

**User Story:** As a local runtime user, I want secret-bearing paths refused or
redacted consistently, so that agents do not read or write credentials by
accident.

#### Acceptance Criteria

1. GIVEN `.env`, `.env.local`, `.env.production`, `.env.development`, `.envrc`,
   private keys, `credentials.*`, or `secrets.*`, THEN THE SYSTEM SHALL classify
   the path as secret-bearing unless explicitly allowlisted.
2. GIVEN `.env.example`, `.env.sample`, or `.env.template`, THEN THE SYSTEM MAY
   classify the path as safe example material unless content redaction detects
   secret-like values.
3. WHEN preview/apply targets secret-bearing paths, THEN THE SYSTEM SHALL refuse
   writes by default.

### Requirement 3: Policy Consistency Tests

**User Story:** As a developer changing path policy, I want drift tests, so that
scanner, safety, docs, validation, and hooks remain aligned.

#### Acceptance Criteria

1. WHEN fixture paths are classified by scanner and workspace safety, THEN
   generated/vendor/secret/hidden decisions SHALL agree.
2. WHEN `.gitignore` or `.aiignore` affects a path, THEN read/write surfaces
   SHALL report the same configured reason or a documented stricter write
   refusal.
3. WHEN a hook reports path risk, THEN it SHALL use the same classification
   vocabulary as runtime surfaces.

## Correctness Properties

- **P1 Classification consistency:** Same path and config produce same base
  classification across runtime surfaces.
- **P2 Write strictness:** Write policy may be stricter than read policy, but
  never looser for generated, vendor, secret, hidden, or escaped paths.
- **P3 Example safety:** Secret examples stay readable only when path and
  content redaction rules both allow them.

## Success Criteria

- Scanner/catalog policy and workspace safety use one shared classifier.
- Secret-bearing path variants are refused or redacted consistently while safe
  examples remain test-covered.
- Drift tests cover scanner, write safety, docs/context routing, validation,
  and hook feedback decisions.
