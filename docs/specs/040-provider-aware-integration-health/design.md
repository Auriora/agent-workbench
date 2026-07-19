---
title: Provider-aware integration health design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Technical Design

## Overview

Extract common integration bindings and profile contracts from the Codex-only
descriptor. Capture identity at the correct boundaries: MCP initialize metadata
for client application identity and explicit plugin-launch context for provider
and plugin manifest identity. Carry that evidence through stdio/daemon handoff
into each connection's server context. Static health reports only server-known
evidence; an argument-bearing read-only tool accepts caller discovery evidence
and invokes the same health use case.

## Requirement Coverage

| Requirement | Design coverage | Validation |
| --- | --- | --- |
| Requirement 1 | Common bindings/profile base, legacy Codex and current profile resources | Contract and compatibility fixtures |
| Requirement 2 | Connection identity context through initialize and daemon handshake | Mixed-client daemon tests |
| Requirement 3 | Honest static resource plus argument-bearing health tool | Resource/tool golden tests |
| Requirement 4 | Artifact-specific identities, provenance, comparison policy | Missing/mismatch identity fixtures |
| Requirement 5 | Additive schemas and package drift validation | Plugin/package/pack/full-suite gates |

## Correctness Property Coverage

| Property | Design behavior | Validation direction |
| --- | --- | --- |
| CP-001 | Provider defaults to unknown; no process/repo inference. | Unknown/ambiguous fixtures. |
| CP-002 | Identity lives in per-connection server context. | Concurrent mixed-client daemon fixture. |
| CP-003 | Static resource omits caller discovery input. | Ordinary resources/read golden test. |
| CP-004 | Typed artifact identity with state/provenance. | Schema and presenter tests. |
| CP-005 | Comparison allowlist plus pure guidance. | Mismatch/no-side-effect tests. |

## High-Level Design

### Common Profile Model

Move common MCP resource/tool/prompt bindings out of
`describe-codex-integration-profile` into a provider-neutral catalog. Keep the
Codex descriptor as a compatibility projection. Add a current profile use case
and `integration:///profiles/current` resource that combines common bindings
with the connection's provider descriptor or explicit unknown state. A static
Claude profile may be exposed only if it helps package validation; it must use
the same common base.

### Per-Connection Identity Context

Define a connection identity context with:

- protocol-observed MCP client name/version from initialize metadata;
- explicit provider kind from the provider plugin launcher/config;
- observed provider plugin manifest/package version when available;
- observed cache identity/version when the client boundary exposes it;
- provenance and evidence state for every value.

Provider-specific plugin shims/configs pass a narrow identity payload through
the installed stdio launcher and daemon handshake. The daemon continues sharing
repository/index state, but each accepted connection builds its own MCP server
and identity context. Absolute cache/plugin paths are not returned publicly.

### Registered Surface Authority

Derive registered surfaces from the actual MCP registry declarations/common
binding catalog. Provider profiles may describe client guidance and configured
bindings but are not registration authority. This removes the current indirect
Codex dependency from common health.

### Health Surfaces

`integration:///health/agent-workbench` remains a static resource. It accepts no
pseudo-arguments and reports configured, server-registered, connection-observed,
and unknown caller-discovery state.

Add one read-only argument-bearing health tool that accepts validated caller
discovery lists/state. Its adapter invokes the same application use case and
presenter as the resource, passing only the extra caller evidence. No state is
persisted merely because a caller submits discovery evidence.

### Artifact Identity And Mismatch Policy

Use typed identities rather than overloaded `runtime_version`:

```text
IntegrationArtifactIdentity {
  artifact: runtime | mcp_client | provider_plugin | client_cache
  name?: string
  version?: string
  state: observed | configured | unknown
  provenance: initialize | launcher | manifest | cache | package
}
```

Only comparable Agent Workbench artifacts enter version mismatch evaluation.
Provider recovery guidance is data selected at the presentation/integration
boundary: reinstall runtime package, refresh/reinstall plugin, reload plugin,
then start a new session as applicable. It never executes those steps.

## Low-Level Design

The server factory accepts a connection identity context. The stdio/daemon
handshake schema validates explicit provider data and rejects malformed or
untrusted overrides. After MCP initialize, protocol client info augments the
context without replacing stronger explicit provider evidence. Health/profile
use cases receive the context and common binding catalog through composition.

The existing integration health schema is extended additively. Compatibility
fields such as `runtime_version` and legacy Codex profile output remain until a
documented future deprecation, while new typed identities become authoritative.

## Data Flow

```text
provider plugin config/shim -> explicit provider/plugin evidence
installed stdio launcher -> daemon handshake -> per-connection server context
MCP initialize -> protocol client application evidence
registry catalog + connection identity + optional caller discovery
  -> one integration-health use case -> resource/tool presenters
```

## Error Handling And Trust

- Missing/ambiguous identity is unknown, not guessed.
- Invalid caller discovery arguments return the shared MCP validation envelope.
- Missing manifests/cache data are bounded limitations, not launcher failures.
- Provider mismatch cannot alter runtime capability or daemon ownership.
- No network check, automatic update, retry, alternate launcher, or hidden
  fallback is introduced.

## Migration And Compatibility

Preserve `integration:///profiles/codex` and existing compatible health fields.
Add the current profile and typed identities. Remove pseudo-argument metadata
from the static resource only after tests establish it was not a callable MCP
contract; expose equivalent caller-input capability on the new tool. Package
manifest/version/license drift is corrected through the existing validator and
release metadata authorities.

## Slice Boundary And Residual Architecture

| Design target | In this slice | Out of this slice | Destination | Blocks closure? |
| --- | --- | --- | --- | --- |
| Provider-aware profiles | common/current plus Codex compatibility | Provider-specific runtime behavior | rejected | no |
| Connection identity | initialize and explicit launcher evidence | Repo/process inference | rejected | no |
| Caller discovery | honest static state plus argument-bearing tool | Persistent client telemetry | EB009 if evidenced | no |
| Version identity | runtime/plugin/cache separation and guidance | Auto-update/network latest check | rejected | no |
| Capability inventory | registry-backed health surfaces | General EB019 inventory work | EB019 | no |

## Decisions

- **D001 resolved:** keep the health resource static and honest; add one
  argument-bearing read-only tool for caller discovery evidence.
- **D002 resolved:** use a current/effective provider profile additively and
  preserve the legacy Codex resource.
- **D003 resolved:** provider identity is per connection; daemon identity stays
  provider-neutral.

## Validation Strategy

Use schema, use-case, presenter, resource/tool, launcher, daemon, plugin, and
packaging fixtures. Cover mixed concurrent clients, unknown metadata, absent
manifest/cache evidence, comparable/non-comparable versions, static resource
reads, and caller-supplied discovery. Run focused integration/MCP suites before
the full suite and package dry-run.

## Operational Considerations

Health may recommend explicit operator actions but never performs them. A new
coding-agent session remains required after plugin/cache refresh so the client
loads new hooks, skills, and MCP configuration. Do not expose user-specific
absolute cache paths or untrusted initialize strings without bounded
normalization.

## Open Questions

- Which launcher/daemon handshake field can carry plugin manifest identity
  without coupling the installed runtime to one provider's cache layout?

## Related Artifacts

- Requirements: `requirements.md`
- Change impact: `change-impact.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
