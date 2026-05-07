---
title: Provider contract integration starter guide
doc_type: guide
status: active
owner: platform
last_reviewed: 2026-05-01
---

# Provider Contract Integration Starter Guide

## Purpose

Define the documentation and design decisions required when adding a new external provider, contract, source, file type, endpoint family, or MQTT topic family to the data lake.

Use this as the starting point for drafting a new external-system integration guide. The companion implementation procedure is [Add Provider/Contract](../runbooks/data-flow/add-provider-contract.md).

## External System

Document the external owner, system purpose, operational contacts, expected delivery schedule, and whether the source is event, file, poller, or MQTT based.

## Contract Summary

Capture the external contract before implementation:

- Endpoint, file, API, queue, MQTT topic, or polling source.
- Payload or file schema version.
- Required and optional fields.
- Timezone, timestamp format, units, and identifiers.
- Delivery semantics: push, poller, upload, replay, batch, or stream.
- Expected volume, frequency, ordering, and idempotency behavior.

## External Spec Status

| Artifact | Status | Notes |
| --- | --- | --- |
| Provider-owned contract | available, pending provider, or not applicable | Link the authoritative external spec when it can be safely referenced. |
| Sample payloads or files | captured in tests, stored out-of-repo, pending provider, or not applicable | State where representative examples can be found. |
| Business field dictionary | available, code-derived, pending provider, or not applicable | Explain how analysts and BI engineers should interpret source fields. |

## Provider And Contract Identity

| Identity | Value | Notes |
| --- | --- | --- |
| Provider | `new-provider` | Must be stable and suitable for route segments, raw keys, and metadata. |
| Contract | `new-contract` | Must identify the external payload family, not a downstream table. |
| Source | `new-source` | Trusted source identity for auth, lineage, and upload metadata. |
| Channel | `push`, `poller`, `upload`, `mqtt`, or `uns` | Must match how raw data lands. |

## Auth And Secrets

Define the authentication model:

- Bearer token allowlist in client-token secret.
- External API credentials in an integration-specific secret.
- AWS IoT certificates or custom-authorizer credentials.
- Rotation owner and rotation process.
- Least-privilege provider, contract, source, and dataset permissions.

## Configuration

Identify which runtime config family controls the integration:

- `dataset-config` for upload/dataset routing and validation.
- `nimbus-repositories` for Nimbus repository/poller behavior.
- `iiot-uns-mapping` for IIoT source-to-UNS mapping and ingest identity.
- New AppConfig profile only if existing profiles cannot model the behavior.
- SSM deploy config only for environment-specific resource wiring.

New config keys require schema updates and config documentation.

## Linked Docs

| Document | Why It Matters |
| --- | --- |
| [Data-flow index](../data-flow/index.md) | Places the new integration in the raw-to-curated and curated-to-processed map. |
| [Raw-to-curated template](raw-to-curated-flow.md) | Template for the provider/contract transformation document. |
| [Dataset config AppConfig](../data-flow/config/dataset-config-appconfig.md) | Common dataset routing and validation config reference. |
| [Add Provider/Contract](../runbooks/data-flow/add-provider-contract.md) | Implementation procedure for new provider/contract work. |
| [Validate Data-Flow Change](../runbooks/data-flow/validate-data-flow-change.md) | Release-readiness checklist. |

## Data Flow

Describe the expected source-to-output path:

1. External system produces event, file, API response, or MQTT message.
2. Integration entrypoint authenticates and validates source identity.
3. Raw object or message is persisted with provider, contract, channel, source, dataset, and timestamp metadata.
4. Dataset resolution and validation run.
5. Curated table receives accepted records.
6. Processed outputs consume curated tables where applicable.

## Source-To-Data-Flow Mapping

| External Input | Provider/Contract Or Topic | Raw Location | Curated Output | Processed Output |
| --- | --- | --- | --- | --- |
| New endpoint, file, or topic | `provider/contract` or MQTT topic filter | `raw/events/...`, `raw/uploads/...`, or IIoT raw prefix | Target curated table or dataset | Target processed table, mart, or n/a |

## Failure Modes

Document at least:

- Authentication or authorization failure.
- Contract/schema validation failure.
- Dataset resolution failure.
- Duplicate or replay behavior.
- External API throttling or availability failure.
- Raw storage succeeds but curation fails.
- Curated data lands but processed output is delayed or wrong.

## Operations

Name the operational runbooks that apply:

- Ingest verification.
- AppConfig safe update.
- Secret safe update.
- Provider-specific add/change runbook.
- Data-flow routing investigation.
- Deployment validation.

## Validation Evidence

Before the integration is considered ready:

- Unit or contract tests cover success and failure paths.
- Sample payload or file is stored in test fixtures when safe to commit.
- Raw key, metadata, and idempotency behavior are verified.
- Curated table shape and validation behavior are verified.
- Processed output evidence is captured where applicable.
- Integration guide, data-flow doc, config doc, and runbook links all resolve.

## Change Process

1. Start with [Add Provider/Contract](../runbooks/data-flow/add-provider-contract.md).
2. Draft or update the integration guide using this document.
3. Draft or update the raw-to-curated data-flow document.
4. Update AppConfig/secret schemas before payloads.
5. Implement code and tests.
6. Update curated and processed docs.
7. Validate with [Validate Data-Flow Change](../runbooks/data-flow/validate-data-flow-change.md).

## References

- External specs:
  - External API, file, payload, MQTT, or source schema references.
- Internal runbooks:
  - [Add Provider/Contract](../runbooks/data-flow/add-provider-contract.md)
  - [Validate Data-Flow Change](../runbooks/data-flow/validate-data-flow-change.md)
  - [Ingest Verification Runbook](../runbooks/deployment-and-environment/ingest-verification-runbook.md)
- Related architecture docs:
  - [System architecture](../architecture/system-architecture.md)
  - [Ingest and processing architecture](../architecture/ingest-and-processing-architecture.md)
