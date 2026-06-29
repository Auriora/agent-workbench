---
title: Shared path policy design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-18
---

# Design

## Overview

Promote the catalog policy into a shared domain path classifier and make
workspace safety, scanner, docs routing, validation planning, and hooks consume
it. The classifier returns base path facts; each surface maps those facts to
read, write, skip, warning, or redaction behavior.

## High-Level Design

```text
PathPolicyInput
  repo_relative_path
  is_directory
  gitignore_rules
  aiignore_rules
  configured_skips
  explicit_allowlist

PathClassification
  category: source | generated | vendor | hidden | secret | ignored | nested_repo | configured_skip
  reason
  read_policy
  write_policy
  redaction_policy
```

## Low-Level Design

- Move or rename `catalog-path-policy.ts` to a shared path policy module.
- Keep existing exported names as compatibility shims if needed during
  migration.
- Replace `DEFAULT_GENERATED_ROOTS` and `DEFAULT_VENDOR_ROOTS` in
  `workspace-safety.ts` with classifier-derived decisions.
- Add secret path patterns for `.env*` except safe examples, `.envrc`,
  private keys, `credentials.*`, and `secrets.*`.
- Add fixtures that compare scanner skip reasons and workspace write decisions.
- Update hook code to call a generated/shared policy artifact or mirror a
  tested data table if direct TypeScript import is not practical.

## Operational Considerations

- Default policy must remain conservative.
- New allowlists require fixture-backed tests.
- Secret-looking content redaction remains separate from path classification.

## Open Questions

- Should hook feedback import a generated/shared policy table or keep a
  mirrored JavaScript table with drift tests?
- Should nested Git repository detection block reads, writes, or only ranking
  by default?
