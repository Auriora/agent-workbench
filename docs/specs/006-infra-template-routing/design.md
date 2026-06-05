---
title: Infrastructure template routing design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Technical Design

## Overview

Improve infrastructure-template routing by connecting existing resource-backed
template evidence to handler files, nearby tests, and validation planning. The
result should be useful routing evidence, not a semantic infrastructure graph.

## High-Level Design

Infrastructure template routing extends the existing resource-backed SAM and
CloudFormation extraction path. It adds low-confidence relationships between
templates, logical IDs, handler strings, handler files, and nearby tests.

## Components

- Template resource extractor for logical IDs, handler strings, events, and
  unresolved references.
- Handler resolver that maps handler strings to repo-relative source paths.
- Graph routing edges with resource-backed confidence/provenance.
- Context/impact ranking for template-to-handler/test relationships.
- Validation planner ranking for template and infrastructure test evidence.

## Low-Level Design

Handler resolution should support common Python and JavaScript/TypeScript Lambda
handler forms without adding a semantic language fallback. For example, a
handler string may map to a candidate file and exported function, but the first
implementation should only claim file-level routing unless a language adapter
proves more.

## Operational Considerations

Do not run SAM, CloudFormation, AWS, Docker, or test commands. All validation
commands remain planned evidence and must respect repo-local policy.

## Open Questions

- Which handler runtimes should be included in the first fixture slice beyond
  Python and JavaScript/TypeScript-style handlers.
