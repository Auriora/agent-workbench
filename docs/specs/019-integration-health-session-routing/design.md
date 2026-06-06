---
title: Integration health and session routing design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Technical Design

## Overview

Add a session-capability model used by integration health and presenters. The
first implementation should prefer explicit session evidence, then registered
runtime evidence, then documented unknown states. The design must avoid a copied
runtime path and keep MCP adapters thin.

## High-Level Design

Components:

- `IntegrationHealth` contract for resources, tools, profiles, repo root,
  runtime version, and callable-state evidence.
- Session capability input model for caller-discovered resources/tools.
- Presenter helper for filtering or labeling `next_actions`.
- Codex integration profile alignment tests.
- Contextual routing design decision record inside this spec package.

## Low-Level Design

Add a small contract shape with:

- surface name and kind;
- configured/registered/advertised/discovered/callable booleans when known;
- status: available, unavailable, blocked, or unknown;
- reason and evidence kinds;
- optional replacement or discovery action.

Presenters should call one shared helper before returning next actions. The
helper receives session capability evidence when available and returns callable
actions plus unavailable caveats.

## Contextual Routing Decision

Decision pending. T001 must decide between:

- one stable `dynamic` router tool;
- startup-time tool registration based on repo/session context;
- session-time tool registration or hiding;
- a hybrid with one stable discovery/router surface and conservative tool
  registration.

## Operational Considerations

- Health output is read-only.
- No network or client introspection is required by default.
- Caller-discovered evidence may be injected by tests, debug harnesses, or
  future clients; absent evidence remains unknown.

## Open Questions

- Should the first public surface be a resource, a tool, or both?
- Should unavailable next actions appear in `warnings`, `caveats`, or a new
  structured field?
- How should a future router avoid becoming a generic fallback shell?
