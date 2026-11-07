---
title: Startup recovery and refresh accounting traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability

## Requirement To Delivery Matrix

| Requirement | Design | Tasks | Verification | State |
| --- | --- | --- | --- | --- |
| Requirement 1 | D001 | T001; T003 | V001 guard races and process death | complete |
| Requirement 2 | D002 | T002; T003 | V002 invocation boundary | complete |
| Requirement 3 | Boundaries and validation | T003 | V003 integrated acceptance and promotion | complete |

## Task To Context Matrix

| Task | Context | Properties | Durable target |
| --- | --- | --- | --- |
| T001 | D001; existing startup claim protocol; B008 | CP-001; CP-002; CP-003; CP-005 | runtime operations; threat model |
| T002 | D002; existing shutdown/termination authority; B009 | CP-004; CP-005 | runtime contracts |
| T003 | Both requirements and fixture evidence | all | existing durable owners; backlog |

## Authority and scope

Existing canonical owners are explicit; no imported authority replaces them.
Spec065 is an existing untracked proposed package with unresolved broader policy;
this focused delivery coordinates its safety boundary without editing it.

## Design To Implementation Matrix

| Design | Implementation | Tests | State |
| --- | --- | --- | --- |
| D001 exact isolated recovery | startup-guard-recovery core/main/client/scope; daemon-client; shutdown coordinator | helper/process fixtures; daemon-launch; entrypoint integration; native-free architecture and runtime build contract | complete; V001/V003 |
| D002 actual invocation boundary | refresh-controller | operations.test.ts | complete; V002/V003 |

## Open Decision Impact

D001 narrow-helper review is accepted. Rejected native-bridge and socket-mutex
proposals are not executable paths. B010 and Spec065 remain separately owned
scope limitations, not permission to weaken current acceptance.
