---
title: Native grammar npm installation requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Goals

Deliver B007 and the user-authorized v0.6.10 release/package/install sequence.
Ordinary consumer npm installation must agree with native grammar contracts.

## Durable Source Baseline

At 09c7a12 runtime Tree-sitter is 0.25; Ruby 0.23.1 and TypeScript 0.23.2
publish incompatible optional peer ranges. Official registry/upstream inspection
on 2026-11-06 found no corrected releases. Source/native fixtures already use
these exact grammars with runtime 0.25. Canonical owners: packaging README,
native-dependency setup, runtime contracts and operator install runbook. Repository
spec templates are absent; lifecycle skill fallback applies. Scope preserves
untracked Spec065 and release drafts.

## Non-Goals

No alternate parser, grammar capability removal, runtime downgrade, hidden
fallback, peer-bypass flags, ungoverned remote fork or replacement of public
release assets. B008 remains conservative and explicitly documented.

## Success Criteria

Ordinary isolated npm install and dependency validation, native grammar fixtures,
source/package/platform checks, reviewed release evidence, immutable publication
and verification of the installed release all pass in their proper order.

## Requirements

### Requirement 1: Correct the consumer dependency contract

**Priority:** must-have

#### Acceptance Criteria

1. WHEN a clean consumer installs the release tarball, THE SYSTEM SHALL resolve
   dependencies using ordinary npm semantics without force, legacy-peer-deps,
   ignored peer errors or consumer overrides.
2. THE SYSTEM SHALL preserve the exact accepted native grammar implementation
   and one canonical runtime parser path. Any temporary metadata correction
   SHALL have exact upstream provenance, bounded reviewed delta, fixture proof,
   a named owner and an explicit removal condition.
3. THE SYSTEM SHALL validate native Ruby, TypeScript/TSX and other registered
   languages against the canonical runtime, and reject unresolved dependencies.

### Requirement 2: Prove the packaged candidate

**Priority:** must-have

#### Acceptance Criteria

1. THE SYSTEM SHALL pass typecheck, source regression, contract/plugin/skill,
   dev CLI, package-payload and installed-native/runtime smoke gates.
2. THE SYSTEM SHALL exercise the final installed entrypoint, including the
   shutdown/build-handoff and admission changes, without substituting source
   imports or changing the host installation during isolated acceptance.
3. THE SYSTEM SHALL run supported release-platform validation before public
   publication and preserve artifact/commit identities.

### Requirement 3: Publish and install an auditable release

**Priority:** must-have

#### Acceptance Criteria

1. THE SYSTEM SHALL synchronize a new patch version and reviewed consumer notes,
   documenting B008 and remaining limitations; existing tags/assets stay immutable.
2. WHEN gates pass, THE SYSTEM SHALL publish through the governed tag-driven
   GitHub release/GHCR workflow, verify exact release assets, then install the
   verified artifact into the user-authorized live runtime and check its identity.
3. IF a required gate fails, THE SYSTEM SHALL retain truthful pending/blocked
   evidence and fix the root cause without publishing partial acceptance.

## Correctness Properties

- CP-001: No consumer peer-bypass or parser substitution.
- CP-002: Package and installed proof bind to exact source/artifact identities.
- CP-003: Publication and live installation follow successful required gates.
