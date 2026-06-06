---
title: Agent Workbench principles
doc_type: requirements
status: draft
owner: platform
last_reviewed: 2026-06-06
---

# Agent Workbench Principles

## Purpose

Agent Workbench exists to become an IDE for coding agents. Its purpose is to
provide the runtime surfaces, evidence packets, and safety checks that let
agents work inside repositories with less manual discovery and fewer
trust-breaking guesses.

## VMOST

### Vision

Coding agents should experience a repository as an instrumented workspace, not
as an unstructured filesystem. The workspace should expose current context,
available capabilities, confidence levels, safe edit routes, and validation
paths in forms that are compact enough for agents to act on.

### Mission

Reduce the cognitive and operational load of coding agents by turning repeated
repo exploration, edit planning, validation, repair, and handoff work into
bounded, trustworthy runtime surfaces.

### Objectives

- Make first-read orientation reliable, compact, and trust-calibrated.
- Make editing, verification, compiling, diagnostics, refactoring, and review
  preparation easy, with relevant feedback and minimal noise.
- Reuse proven developer-tool ideas such as problems panels, test explorers,
  symbol outlines, call hierarchy, task runners, source-control views, refactor
  previews, and project indexes, but reshape them for agent workflows.
- Treat agent fallback to shell discovery, broad search, manual validation, or
  user correction as product telemetry.
- Support many languages and project shapes through explicit adapter
  capability levels rather than hidden fallbacks.

### Strategy

- Prefer a small set of high-value workflow surfaces over a large tool catalog.
- Keep MCP adapters thin and put behavior in use cases, policies, providers,
  presenters, and runtime state.
- Use structured metadata to distinguish proof from routing evidence and
  planned validation from executed validation.
- Make the runtime local-first, bounded, observable, and safe by default.
- Promote capabilities only when fixture-backed tests prove the evidence,
  budget, degraded-state, and presentation behavior.

### Tactics

- Improve first-read resources before adding overlapping preflight tools.
- Route agents from `context_for_task` into exact next actions such as docs
  reads, symbol lookup, references, impact, diagnostics, edit preview, and
  validation planning.
- Keep hooks quiet for clean results and visible only for actionable findings.
- Capture friction through smoke tests, Codex history mining, hook logs,
  telemetry, CI failures, PR review comments, and dogfood notes.
- Turn recurring friction into specs, fixtures, and durable docs rather than
  one-off prompt guidance.

## Core Principles

### 1. Remove Agent Discovery Burden

Agents should not have to rediscover stable repository facts on every task.
Agent Workbench should cache and present repo roots, language mix, package
boundaries, generated paths, project guidance, and capability availability as
explicit evidence with freshness and scope metadata.

### 2. Make The Edit And Repair Loop Easy

Making edits, verifying, compiling, refactoring, and reviewing should be easy
for agents. The runtime should provide targeted diagnostics, validation plans,
edit previews, drift checks, and concise repair guidance with minimal noise.

### 3. Preserve Trust Calibration

Every result should make its evidence quality clear. Semantic proof,
resource-backed routing, heuristic matches, stale snapshots, truncated scans,
and blocked validation must not look the same.

### 4. Reuse Human Tooling Lessons, Not Human UI

Human IDEs prove which workflows matter: symbols, references, diagnostics,
tests, refactors, docs, tasks, source control, and run configurations. Agent
Workbench should reuse those concepts as MCP tools/resources and structured
packets, not as human-facing panes.

### 5. Prefer One Explicit Path

Each capability should have one primary implementation path unless a design
document and fixture-backed tests justify alternatives. Hidden fallback routes
make results harder for agents to trust.

### 6. Treat Fallback As Product Signal

When agents fall back to broad `rg`, repeated file reads, command-surface
inspection, manual test selection, or user correction, Agent Workbench should
record that as evidence of a missing or weak runtime capability.

### 7. Keep Quiet Success And Actionable Failure

The runtime should stay silent when no useful feedback exists. When there is a
problem, it should report the smallest actionable finding, the missing
evidence, and the next safe action.

## Scope Rules

### Include

Agent Workbench owns coding-agent runtime support for:

- repository context and first-read orientation;
- language and project-shape evidence;
- validation planning, diagnostics, and post-edit feedback;
- edit safety, preview/apply behavior, drift checks, and workspace hygiene;
- docs, symbols, references, impact, and other task-routing evidence;
- MCP/tool integration health and session-aware next actions;
- local telemetry and mined friction signals that improve coding-agent
  workflows.

### Exclude Or Defer

Agent Workbench should not become the owner of unrelated governance or project
management systems. Defer or integrate with existing owners for:

- generic lifecycle governance outside coding-agent runtime needs;
- spec template ownership where the spec-lifecycle-manager or repository
  governance already owns the workflow;
- broad project management, issue planning, roadmaps, or scheduling that is
  not tied to coding-agent execution;
- domain-specific business logic that belongs to a target repository;
- human IDE UI replication that does not translate into an agent-facing tool,
  resource, contract, or feedback packet.

## Relationship To Governance

Agent Workbench principles guide product and runtime design. They do not
override repository governance, `AGENTS.md`, durable architecture decisions,
active specs, security policies, or workspace safety contracts.

When these principles identify a new direction, the implementation path should
flow through the repository's normal lifecycle:

- update durable source-of-truth docs when the principle changes project
  direction;
- create or update a spec when implementation work is non-trivial;
- keep spec-template and closure-process decisions with the spec lifecycle
  owner;
- resolve conflicts with governance documents before changing code.

## Current Product Signals

The executable backlog for these signals is
[Agent Workbench executable backlog](agent-workbench-executable-backlog.md).

- Integration health: advertised MCP surfaces must match callable surfaces.
- First-call reliability: status, scope, overview, context, diagnostics, and
  validation planning must return bounded responses.
- Policy-aware validation: repo guidance, Docker/devcontainer rules, scripts,
  and blocked host commands must shape validation plans.
- Multi-file repair loop: post-edit diagnostics should handle common multi-file
  edits without noisy output or silent loss of useful checks.
- Spec/task traceability: spec-driven repositories need task-to-requirements,
  design, file, and validation context.
- MCP-server development support: repositories that implement MCP servers need
  protocol, transport, tool-list, session, and smoke-test guidance.
