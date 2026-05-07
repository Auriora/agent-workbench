---
title: Requirements title
doc_type: requirements
status: draft
owner: team-or-person
last_reviewed: YYYY-MM-DD
---

# Title

## Purpose

Describe the capability, policy, or contract this document requires from the
current system.

## Scope

State what is in scope and what is intentionally out of scope.

## Audiences

List the teams or roles that rely on these requirements.

## Current-State Requirements

Use normative language for implemented expectations that should remain true.

| ID | Requirement | Applies To | Source Of Truth | Verification |
| --- | --- | --- | --- | --- |
| REQ-001 | The system must... | Component, API, data flow, or config family | Code, config, ADR, schema, or external contract | Test, command, query, or review method |

## Configuration Requirements

Document config values that materially affect the requirement.

| Config Source | Key Or Field | Required Behavior | Validation |
| --- | --- | --- | --- |
| AppConfig, SSM, Secrets Manager, template parameter, or code constant | Key path | Expected behavior | Schema, test, deploy check, or runtime check |

## Operational Requirements

Describe observability, replay, rollback, support, security, and data-quality
requirements that apply after deployment.

## Non-Requirements

List behaviors that are intentionally not required, especially if old specs or
legacy docs implied otherwise.

## Evidence

- Code:
- Config:
- Tests:
- Runbooks:
- Data-flow docs:

## Related Docs

- ADRs:
- Architecture:
- Technical design:
- Runbooks:
