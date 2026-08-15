---
title: PostHog analytics integration change impact
doc_type: spec
artifact_type: change-impact
status: active
owner: platform
last_reviewed: 2026-08-15
---

# Change Impact

## Change Type

- **Primary type:** feature and corrective migration
- **Breaking change:** no
- **Durable docs required:** yes
- **External behavior affected:** optional network analytics only

## Proposed Changes

| Change | Type | Source of truth | New durable destination | Promotion required |
|---|---|---|---|---|
| Remove wizard dev-CLI analytics | remove | `tools/devcli/` | dev CLI remains analytics-free | no |
| Add explicit PostHog runtime adapter | add | `src/infrastructure/telemetry/` | `docs/design/observability-debugging-design.md` | yes |
| Define telemetry ownership | clarify | layered architecture | `docs/design/layered-runtime-architecture.md` | yes |
| Protect local environment secrets | bug_fix | `.gitignore` | workspace safety contract if new rule is needed | review |
| Package vendor SDK | add | package manifests and locks | packaging manifest | yes |
| Inject distribution analytics defaults | change | runtime build and release workflow | observability design and install runbook | yes |
| Add opt-in operational log export | add | `src/infrastructure/telemetry/` | observability design, layered architecture, README, and install runbook | yes |

## Bug Fix Details

- **Observed behavior:** A local `.env` containing live configuration is
  untracked but not ignored; the Python CLI initializes PostHog at import time
  and enables global exception autocapture.
- **Expected behavior:** `.env` cannot be accidentally staged by ordinary Git
  operations; analytics is explicit, runtime-owned, allowlisted, and incapable
  of exporting raw exception data.
- **Root cause evidence:** Wizard-generated direct SDK integration bypassed the
  existing telemetry architecture and privacy contract.
- **Regression risk:** Optional telemetry must not affect runtime startup,
  handler results, daemon shutdown, or package installation.

## Promotion Targets

| Spec content | Durable destination | Promotion status | Notes |
|---|---|---|---|
| PostHog config, privacy, payload, and operations | `docs/design/observability-debugging-design.md` | complete | canonical observability owner |
| Adapter and lifecycle ownership | `docs/design/layered-runtime-architecture.md` | complete | canonical layering owner |
| Secret-path treatment if changed beyond ignore rule | `docs/reference/workspace-safety-contract.md` | review | existing contract already classifies `.env` as secret |

## Durable Source Mapping

| Changed behavior | Pre-change durable owner | Updated durable owner | Evidence |
|---|---|---|---|
| PostHog enablement, payload, privacy, and failure behavior | `docs/design/observability-debugging-design.md` | same | promoted configuration and privacy contract |
| Daemon and standalone telemetry lifecycle ownership | `docs/design/layered-runtime-architecture.md` | same | promoted composition-root ownership rule |
| Local `.env` secret treatment | `docs/reference/workspace-safety-contract.md` | unchanged | existing secret classification plus root `.gitignore` rule |
| Runtime dependency distribution | `packaging/agent-workbench/package-manifest.json` | same | `posthog-node` plus OTLP logs dependencies listed and package dry run passed |
| PostHog OTLP Logs enablement, schema, privacy, and lifecycle | none | `docs/design/observability-debugging-design.md` | implemented, promoted, and validated in T006 |

## Open Questions

The public project token is supplied to official release builds through release
configuration. Source and development builds intentionally remain
analytics-disabled when that configuration is absent.
