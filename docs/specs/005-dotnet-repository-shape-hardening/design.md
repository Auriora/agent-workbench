---
title: .NET repository shape hardening design
doc_type: spec
artifact_type: design
status: archived
owner: platform
last_reviewed: 2026-06-05
---

# Technical Design

## Closure Record

Spec 005 closed on 2026-06-05. Current .NET generated-output, project metadata,
and validation-planning behavior lives in durable design/reference docs.

## Overview

Deepen .NET repository-shape handling while staying resource-backed. The spec
should improve routing and validation evidence without promoting C# or Razor to
semantic capability.

## High-Level Design

This is a resource-backed repository-shape improvement, not semantic C#/Razor
support. It should extend filesystem policy, resource extraction, graph routing,
overview, context, and validation planning using generic .NET project metadata.

## Components

- Catalog path policy: generated-output roots and artifact extensions.
- Resource extractor: `.sln` and project-file metadata extraction.
- Graph store: resource-backed project nodes and edges.
- Overview/context: project and test anchors.
- Verification planner: nearest project/test command planning with policy
  checks.

## Low-Level Design

Project parsing should use structured XML parsing when available through the
standard toolchain or a small safe parser. Avoid ad hoc broad text scraping for
semantic claims. Extract only stable metadata:

- SDK
- target frameworks
- output type
- package references
- project references
- test-project markers

## Operational Considerations

Do not execute `dotnet`. Do not depend on external sample repos in automated
tests. External dogfood notes are reference evidence only.

## Open Questions

- Whether project-file XML parsing should live in a generic resource extractor
  module or a future dedicated .NET adapter package.
