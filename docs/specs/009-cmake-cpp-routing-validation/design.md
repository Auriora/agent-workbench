---
title: CMake C++ routing and validation design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Technical Design

## Overview

Deepen CMake/C++ routing while preserving the current semantic boundary. The
implementation should improve context, impact, and validation usefulness through
bounded heuristic evidence only.

## High-Level Design

The C/C++ extractor may emit declaration, include, and same-file call routing
evidence with `resource_backed` capability, heuristic provenance, and low
confidence. Context ranking should prefer first-party source roots and tests.
Validation planning should convert CMake target evidence into non-executed
configure/build/test command templates unless repo policy blocks host commands.

## Low-Level Design

- Extend fixture repositories with first-party roots, tests, and third-party
  noise.
- Add or refine C/C++ extractor logic for include edges and same-file call
  candidates.
- Add CMake target-to-source lookup where existing target metadata is present.
- Update `verification_plan` to return planned CMake command templates such as
  configure, build target, and `ctest`/targeted test review when evidence is
  strong enough.

## Operational Considerations

Do not execute CMake, compiler, or test commands. Do not create build
directories. Host-blocking repo policy takes precedence over generic CMake
templates.

## Open Questions

- Whether same-file call routing should be extracted for methods only or also
  free functions in the first slice.
