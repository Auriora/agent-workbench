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

Use a conservative hybrid:

- keep the current explicit public MCP resources and tools registered at
  startup so advanced capabilities remain discoverable and addressable;
- add one stable integration-health surface that explains configured,
  registered, advertised, caller-discovered, callable, unavailable, blocked,
  and hidden capabilities for the current repo/runtime/session evidence;
- make presenters route `next_actions` through shared session-aware filtering
  so executable actions only name callable tools/resources when caller
  discovery is known;
- label useful but unavailable actions as compact caveats instead of hiding
  them silently or presenting them as executable;
- defer a generic `dynamic` invocation router until fixture evidence proves it
  gives agents better outcomes than explicit tools plus health-guided routing.

The first implementation must not hide tools through startup-time or
session-time registration. Tool shaping can be reconsidered only after the
health surface proves that agents understand why a capability is unavailable
and what evidence would make it available. Hidden capabilities therefore remain
an explicit status value in the contract, but the MVP behavior should use it
only for documented future or profile-inapplicable surfaces, not for registered
public tools.

Capability states:

- `available`: registered and, when caller discovery evidence exists,
  discovered/callable in the active session;
- `unavailable`: configured or advertised but not registered, not discovered,
  or not exposed by the active client session;
- `blocked`: registered but unusable because runtime state, repo shape,
  safety policy, or missing evidence blocks trustworthy execution;
- `hidden`: intentionally not shown as an executable public surface, with an
  explanation and discovery/replacement action;
- `unknown`: caller discovery or runtime evidence is absent, so the system must
  not assume callability.

Agents can ask why a capability is unavailable or hidden by reading the stable
health surface. A future router may use the same contract, but it must stay
read-only unless a separate spec defines bounded invocation semantics.

## Operational Considerations

- Health output is read-only.
- No network or client introspection is required by default.
- Caller-discovered evidence may be injected by tests, debug harnesses, or
  future clients; absent evidence remains unknown.

## Open Questions

- Should the first public surface be a resource, a tool, or both?
- Should unavailable next actions appear in `warnings`, `caveats`, or a new
  structured field?
