---
title: Public failure redaction vocabulary expansion change impact
doc_type: spec
artifact_type: change-impact
status: active
owner: platform
last_reviewed: 2026-08-04
---

# Change Impact

## Durable Source Mapping

| Source | Current behavior relied on | Confidence |
| --- | --- | --- |
| `docs/reference/workspace-safety-contract.md` | redaction vocabulary and false-positive boundary | high |
| `docs/reference/runtime-contracts.md` | failure codes, retryability, metadata, and message bound | high |
| `docs/design/mcp-surface-design.md` | canonical presenter and thin-adapter boundary | high |

## Change Type

- **Primary type:** security hardening and bug fix
- **Breaking change:** no; incorrect diagnostics failure codes are corrected
- **Durable docs required:** yes
- **External behavior affected:** yes, public failure text and diagnostics codes

## Proposed Changes

| Change | Type | Current source | Durable destination |
| --- | --- | --- | --- |
| Expand path and credential token vocabulary | modify | presentation redactor | workspace safety and runtime contracts |
| Correct diagnostics provider classifications | bug_fix | manual diagnostics adapter | runtime contracts |
| Record follow-up delivery and remove stale scheduling | clarify | backlog | backlog |

## Promotion Targets

| Spec content | Durable destination | Status |
| --- | --- | --- |
| path and credential vocabulary | `docs/reference/workspace-safety-contract.md` | pending |
| message and diagnostics envelope contract | `docs/reference/runtime-contracts.md` | pending |
| Spec 055 ownership and EB063 reconciliation | `docs/backlog/README.md` | pending |

## Bug Fix Details

- **Observed behavior:** common hostile path/credential forms remain visible;
  provider failures are returned as `invalid_input`.
- **Expected behavior:** evidenced hostile forms redact and diagnostic failure
  codes match their cause.
- **Root cause evidence:** fixed-root and equals-only regex vocabulary; provider
  catch paths reuse the invalid-input presenter.
- **Regression risk:** false-positive redaction and trust/error metadata drift.
- **Mitigation:** explicit safe counterexamples and complete envelope assertions.

## Unchanged Durable Areas

| Durable area | Reason unchanged |
| --- | --- |
| workspace containment | presentation only; no path authorization changes |
| public schemas | existing codes and response shapes suffice |
| packaging and integration | no launcher or manifest behavior changes |
