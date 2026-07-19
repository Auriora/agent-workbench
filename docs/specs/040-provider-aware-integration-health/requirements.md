---
title: Provider-aware integration health requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Introduction

Agent Workbench integration health currently hard-codes the Codex profile for
every client, exposes pseudo-arguments on a static resource that normal MCP
reads cannot supply, and reports only one runtime version. Claude Code can
therefore appear as Codex, caller discovery remains unknowable despite
misleading tests, and plugin/cache drift cannot be distinguished from runtime
drift. This spec introduces evidence-backed per-connection provider identity,
honest discovery semantics, and separated integration identities while keeping
the runtime core provider-neutral.

## Goals

- Replace Codex-derived common health with a provider-neutral profile model.
- Represent provider/client identity per MCP connection with provenance.
- Make static resource evidence honest and provide an argument-bearing path for
  caller-supplied discovery evidence.
- Separate runtime, MCP client, plugin package, and client-cache identities.
- Preserve the existing Codex profile URI and shared-daemon behavior.
- Provide bounded refresh/reload/restart guidance for observed version drift.

## Non-Goals

- Automatically update plugins, contact a network service, or probe remote
  registries.
- Infer provider or cache identity from repository contents, daemon process
  name, or unverified paths.
- Treat MCP client application version as Agent Workbench plugin version.
- Put Codex-, Claude-, or Kiro-specific policy into domain/application core.
- Redesign contextual tool exposure, general capability inventory, or EB019.
- Remove `integration:///profiles/codex`.

## Durable Source Baseline

| Source | Current behavior relied on | Confidence | Notes |
| --- | --- | --- | --- |
| `docs/design/coding-agent-integration-design.md` | Owns common/provider-specific integration boundaries. | high | Provider identity must remain adapter evidence. |
| `docs/reference/runtime-contracts.md` | Owns integration-health/profile/trust vocabulary. | high | Extend additively. |
| `docs/design/mcp-surface-design.md` | Owns public resource/tool behavior and static/read semantics. | high | Caller evidence needs a real argument-bearing surface. |
| `docs/backlog/README.md` EB001 and EB040 | Own observed health and version-identity residuals. | high | Promote active/delivered state here. |
| `src/server.ts` and MCP daemon/stdio composition | Current connection/server composition. | high | Hard-coded Codex profile is the confirmed defect. |
| package/plugin manifests | Current runtime and integration package identity sources. | high when read from active launcher context | Cache identity may be unavailable. |

## Durable Impact

| Durable area | Action | Target | Notes |
| --- | --- | --- | --- |
| integration design | modify | `docs/design/coding-agent-integration-design.md` | Common/current/provider profile model and provenance. |
| MCP behavior | modify | `docs/design/mcp-surface-design.md` | Static resource versus argument-bearing health semantics. |
| contracts | modify | `docs/reference/runtime-contracts.md` | Identity, evidence state, provenance, mismatch guidance. |
| operator guidance | modify | plugin README and install/runbook docs | Explicit refresh/reload/restart only. |
| backlog/changelog | modify | backlog and agent-readable changelog | Delivery/residual record. |

## Requirements

### Requirement 1: Common And Provider Profiles

**User Story:** As a coding agent, I want the integration profile to describe
my actual provider or remain unknown, so that Claude is never mislabeled Codex.

**Priority:** must-have

#### Acceptance Criteria

1. THE SYSTEM SHALL define a common provider-neutral integration profile base
   and explicit `codex`, `claude_code`, `kiro`, and `unknown` provider values.
2. `integration:///profiles/codex` SHALL retain its existing meaning and
   compatible fields.
3. THE SYSTEM SHALL add a current/effective profile resource whose provider is
   derived only from connection-scoped evidence and is `unknown` when that
   evidence is unavailable or ambiguous.
4. Common registered/advertised MCP surfaces SHALL come from the actual MCP
   registry/binding catalog rather than the Codex profile descriptor.
5. Provider-specific descriptions SHALL remain adapter/presentation data and
   SHALL NOT alter application/domain behavior.

### Requirement 2: Connection-Scoped Identity And Provenance

**User Story:** As an operator, I want health to explain how it knows the
client/provider, so that shared daemon sessions cannot contaminate one another.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN an MCP connection, WHEN initialization completes, THEN the system
   SHALL record protocol-observed MCP client name/version separately from Agent
   Workbench provider/plugin identity.
2. Provider/plugin identity SHALL be supplied explicitly by the provider
   launcher/plugin context and carried through stdio/daemon handoff to that
   connection; it SHALL NOT become shared daemon identity.
3. Every identity field SHALL include evidence state and provenance sufficient
   to distinguish observed, configured, inferred-not-allowed, and unknown.
4. Concurrent Codex, Claude Code, and unknown clients on one daemon SHALL retain
   independent effective profiles and health evidence.
5. Client-controlled or unrecognized initialize metadata SHALL map to generic
   or unknown and SHALL NOT override explicit trusted launcher evidence.

### Requirement 3: Honest Health And Discovery Semantics

**User Story:** As a coding agent, I want health to distinguish server-known
state from caller-proven discovery, so that unknown capability is not presented
as callable proof.

**Priority:** must-have

#### Acceptance Criteria

1. An ordinary read of `integration:///health/agent-workbench` SHALL report
   configured bindings, server registration, and connection identity that the
   server actually knows.
2. Static resource reads SHALL NOT advertise or consume pseudo-arguments that
   MCP `resources/read` cannot carry.
3. Caller-discovered resources/tools/prompts SHALL remain unknown unless the
   caller supplies evidence through a real argument-bearing read-only surface.
4. The argument-bearing surface SHALL validate supplied discovery evidence and
   reuse the same application health use case; it SHALL NOT create a parallel
   health implementation.
5. Reading the health resource itself SHALL NOT prove that the caller listed or
   discovered that resource.

### Requirement 4: Separated Version And Package Identity

**User Story:** As an operator, I want runtime and integration-package identity
reported separately, so that I can repair the stale component without guessing.

**Priority:** must-have

#### Acceptance Criteria

1. Health SHALL distinguish runtime package version, MCP client application
   identity, provider plugin manifest/package identity, and client-cache
   identity.
2. Identity values SHALL be reported only when observed from their authoritative
   boundary; unavailable plugin/cache evidence SHALL remain unknown.
3. THE SYSTEM SHALL NOT compare MCP client application version to Agent
   Workbench runtime/plugin versions as if they were the same artifact.
4. WHEN runtime and provider plugin/cache versions are both observed and differ,
   THEN health SHALL emit bounded reinstall/refresh/reload/new-session guidance
   appropriate to that provider.
5. THE SYSTEM SHALL NOT auto-update, perform network checks, or fabricate a
   current version.

### Requirement 5: Compatibility And Packaging Drift Gates

**User Story:** As a maintainer, I want package/profile/health metadata checked
together, so that a release cannot silently reintroduce cross-client drift.

**Priority:** must-have

#### Acceptance Criteria

1. Existing health/profile consumers SHALL remain compatible or receive an
   explicit additive migration path with golden fixtures.
2. Package validation SHALL check root/package/server/plugin profile identity
   fields that share an authority and SHALL reject contradictory license or
   version metadata where those fields are required to agree.
3. Tests SHALL cover Codex, Claude Code, Kiro/generic, unknown clients, absent
   plugin/cache identity, stale plugin versus runtime, and mixed clients on one
   daemon.
4. Provider launchers and MCP registries SHALL remain thin and shell-free; no
   alternate launcher or runtime path is introduced.

## Correctness Properties

- **CP-001:** A connection without explicit or protocol-observed provider
  evidence is never labeled Codex, Claude Code, or Kiro.
- **CP-002:** Two simultaneous connections with different provider evidence do
  not share effective identity through the daemon.
- **CP-003:** Static health never upgrades server registration to
  caller-discovered/callable evidence.
- **CP-004:** Each version value is associated with exactly one artifact class
  and provenance; unknown evidence remains unknown.
- **CP-005:** Version mismatch guidance is emitted only for comparable observed
  Agent Workbench identities and never causes automatic mutation/network work.

## Success Criteria

- **SC-001:** Claude and Codex fixtures receive distinct effective profiles
  while the legacy Codex profile remains compatible.
- **SC-002:** Static health and argument-bearing health fixtures prove honest
  registered versus caller-proven states.
- **SC-003:** Mixed-client daemon fixtures prove connection isolation.
- **SC-004:** Runtime/plugin/cache mismatch fixtures produce bounded provider
  recovery guidance and no update side effect.
- **SC-005:** Plugin/package validation, typecheck, focused tests, packing, and
  the full suite pass.

## Related Artifacts

- Canonical context: `canonical-context.md`
- Change impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
