---
title: Public failure redaction vocabulary expansion requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-08-04
---

# Requirements

## Introduction

Spec 054 made one bounded sanitizer authoritative for arbitrary public MCP
failure messages. Independent review then demonstrated that the existing
presentation vocabulary does not cover several common host-path and credential
forms, while the manual `diagnostics_for_files` adapter classifies provider
availability and execution failures as invalid user input. This spec closes
those evidenced gaps without widening containment policy or adding a fallback
redaction path.

## Goals

- Expand the canonical presentation sanitizer for evidenced path and credential
  forms.
- Preserve routes, URLs, repo-relative paths, ordinary prose, typed failure
  semantics, and the 512-byte UTF-8 bound.
- Restore the documented MCP distinction between invalid input, an unconfigured
  provider, and an unexpected provider failure for `diagnostics_for_files`.

## Non-Goals

- Treating every slash-prefixed route or source fragment as a host path.
- Adding a second sanitizer, per-tool patterns, retries, partial responses, or
  alternate parser/security tooling.
- Changing workspace containment, secret-path classification, contract version
  `0.1`, or the `RuntimeError` schema.

## Durable Source Baseline

| Source | Current behavior relied on | Confidence |
| --- | --- | --- |
| `docs/reference/workspace-safety-contract.md` | Presentation redaction preserves route/source text and redacts unsafe tokens. | high |
| `docs/reference/runtime-contracts.md` | Public failure messages are redacted and bounded after typed classification. | high |
| `docs/design/mcp-surface-design.md` | One canonical presentation policy; MCP adapters remain thin. | high |
| `docs/backlog/README.md` | EB038 owns typed envelope consistency and EB063 records Spec 054 delivery. | high |

## Durable Impact

| Durable area | Action | Target |
| --- | --- | --- |
| workspace safety | clarify | `docs/reference/workspace-safety-contract.md` |
| runtime contract | clarify | `docs/reference/runtime-contracts.md` |
| MCP design | unchanged | `docs/design/mcp-surface-design.md` |
| backlog | add and reconcile | `docs/backlog/README.md` |

## Staged Readiness

- **Current stage:** implementation
- **Ready to implement:** yes; hostile examples, false-positive boundaries,
  classifications, affected files, and validation are explicit.
- **Design-first exception:** no
- **Downstream review needed:** security and correctness review before closure.

## Requirements

### Requirement 1: Expanded host-path redaction

**User Story:** As an MCP consumer, I want common host-path forms removed from
public failure text so that local machine details do not leak.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a message containing `~/`, `/srv/`, `/data/`, a UNC path, or an
   extended Windows path, WHEN it crosses the canonical presentation boundary,
   THEN the host path SHALL be replaced by `[REDACTED_ABSOLUTE_PATH]`.
2. GIVEN the same hostile value as a whole presentation value or embedded text,
   WHEN it is sanitized repeatedly, THEN redaction SHALL be consistent and
   idempotent.

### Requirement 2: Expanded credential redaction

**User Story:** As an MCP consumer, I want common structured credentials removed
from public failure text so that provider exceptions cannot expose them.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN token, password, secret, or API-key assignments in equals, JSON, or
   YAML form, WHEN public text is sanitized, THEN the value SHALL be redacted
   while the key and safe punctuation remain useful.
2. GIVEN an `Authorization: Bearer` or `Authorization: Basic` value, WHEN public
   text is sanitized, THEN the credential SHALL be redacted.
3. GIVEN a message reduced to redaction markers, WHEN it is sanitized as a
   public MCP failure, THEN the fixed caller fallback SHALL be used.

### Requirement 3: False-positive and compatibility boundary

**User Story:** As an agent, I want safe routing and source evidence preserved
so that stronger redaction does not make Workbench results unusable.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN routes, URLs, repo-relative paths, ordinary colon text, or non-secret
   authorization prose, WHEN sanitized, THEN safe text SHALL remain unchanged.
2. Public messages SHALL remain at most 512 UTF-8 bytes without splitting a
   code point.
3. The implementation SHALL use the existing canonical sanitizer and SHALL NOT
   add per-tool fallback patterns.

### Requirement 4: Diagnostics provider-failure classification

**User Story:** As an MCP consumer, I want diagnostics failures classified by
cause so that I can choose the correct recovery action.

**Priority:** must-have

#### Acceptance Criteria

1. IF `diagnostics_for_files` has no configured provider, THEN it SHALL return
   `provider_unavailable`, `invalid_due_to_environment`, blocked verification,
   and non-retryable semantics consistent with shared MCP tool envelopes.
2. IF the configured diagnostics provider throws unexpectedly, THEN it SHALL
   return `internal_error`, `invalid_due_to_environment`, blocked verification,
   and retryable semantics.
3. Invalid arguments and blocked root overrides SHALL remain non-retryable
   `invalid_input` failures.
4. All diagnostics failure variants SHALL retain the `diagnostics_static` trust
   policy, an empty blocked data skeleton, sanitized public text, and no claim
   that diagnostics ran.

## Correctness Properties

- **CP-001:** Sanitization is idempotent for every newly supported hostile form.
- **CP-002:** Safe route, URL, repo-relative, and prose fixtures are unchanged.
- **CP-003:** UTF-8 public failure messages never exceed 512 bytes or contain a
  split replacement character.
- **CP-004:** Diagnostics error code, retryability, metadata, data summary, and
  trust calibration agree with the internal failure class.

## Technical Context

- **Language/Version:** TypeScript ESM on the repository-supported Node runtime.
- **Primary Dependencies:** existing presentation and MCP envelope contracts.
- **Constraints:** one explicit sanitizer path; no parser or retry fallback.

## Success Criteria

- **SC-001:** Focused hostile and false-positive fixtures pass.
- **SC-002:** Diagnostics contract tests distinguish all three failure classes.
- **SC-003:** Typecheck, full tests, plugin/package checks, lifecycle checks, and
  expert review pass before closure.
