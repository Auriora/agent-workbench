---
title: Rails routing concern identity
doc_type: spec
artifact_type: package-readme
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Spec 050: Rails routing concern identity

## Purpose

Add bounded, parser-backed identity and navigation for statically declared Rails
routing concerns and their static reuse sites. The implementation must preserve
the existing tree-sitter-only Ruby path and fail closed for dynamic, missing, or
ambiguous forms.

## Package status

- Spec ID: 050
- Owner: platform
- Start date: 2026-08-02
- Current stage: implementation complete; awaiting closure decision
- Scope owner: `docs/specs/050-rails-routing-concern-identity/`

## Artifacts

- Requirements: `requirements.md`
- Research: `research.md`
- Canonical context: `canonical-context.md`
- Change impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
- Durable promotion, final implementation MoE, and task reconciliation are
  recorded in `verification.md`. The package remains active until closure is
  separately requested.
