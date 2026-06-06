---
title: SAM CloudFormation intrinsic routing design
doc_type: spec
artifact_type: design
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Technical Design

## Overview

Deepen the infrastructure adapter from template/resource discovery to explicit
resource-backed intrinsic and event-source relationships. The adapter parses
YAML/JSON templates structurally, emits logical resource nodes, and adds edges
for supported expressions without evaluating a CloudFormation stack.

## High-Level Design

Components:

- Template parser extension for intrinsic functions and `DependsOn`.
- SAM event-source extractor for explicit Lambda event resources.
- Handler-context grouping that combines logical ID, handler binding, handler
  file, event sources, and directly referenced resources.
- Impact ranking for template resources, handler files, tests, and policy
  evidence.
- Validation planner improvements for repo-local IaC command evidence.

## Low-Level Design

Supported first-slice expressions:

- `Ref`
- `Fn::GetAtt` and short-form `!GetAtt`
- `Fn::Sub` and short-form `!Sub` logical-id substitutions
- `Fn::Join` only where nested references are explicit
- `Fn::ImportValue` as external/unresolved evidence
- `DependsOn`

The adapter should record expression path, source logical ID, target logical ID
where known, expression kind, and confidence. Unsupported intrinsics should be
counted as skipped evidence with a compact caveat.

## Operational Considerations

- Do not call AWS, SAM, Docker, or template validators.
- Do not expand parameters, mappings, exports, pseudo parameters, or account
  context unless a later spec promotes those semantics.
- Keep raw values out of public snippets when they look secret-like.

## Open Questions

- Resolved: first-slice `Fn::Sub` support is limited to structural
  `${LogicalId}` and `${LogicalId.Attribute}` style substitutions; pseudo
  parameters are ignored and other values remain unresolved.
- Resolved: `Fn::ImportValue` is modeled as unresolved external stack evidence
  with low confidence.
- Resolved: event-source evidence uses adapter-domain metadata on
  resource-backed `lambda_event_source` nodes and `lambda_event_source` edges,
  without adding AWS-specific shared contract fields.
