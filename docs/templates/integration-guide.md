---
title: Integration guide title
doc_type: integration
status: draft
owner: team-or-person
last_reviewed: YYYY-MM-DD
---

# Title

## Purpose

Describe the external integration and why it exists.

## External System

Summarize the system being integrated, including the relevant domain concepts.

## Contract Summary

Describe the key endpoints, payload shapes, events, or files involved.

## External Spec Status

| Artifact | Status | Notes |
| --- | --- | --- |
| External API, file, payload, MQTT, or source schema | available, repo-owned, captured in tests, pending provider, or not applicable | State where the source contract lives and whether it is authoritative. |

## Provider And Contract Identity

| Identity | Value | Notes |
| --- | --- | --- |
| Provider | provider-name | Canonical provider segment used in routes, raw keys, metadata, or config. |
| Contract | contract-name | Canonical contract segment or event family. |
| Source | source-name | Trusted source identity used for auth, lineage, or upload metadata. |
| Channel | push, poller, upload, mqtt, or other | Delivery channel used in raw keys and operational traces. |

## Auth And Secrets

Describe how credentials are managed and where they live.

## Configuration

List the config files, environment settings, or runtime settings that control the integration.

## Linked Docs

| Document | Why It Matters |
| --- | --- |
| Related data-flow doc | Links the external contract to raw, curated, and processed data behavior. |
| Related runbook | Describes operations, change, validation, or troubleshooting procedure. |
| Related config or schema doc | Explains runtime keys and schema constraints. |

## Data Flow

Describe how data moves through the integration.

## Source-To-Data-Flow Mapping

| External Input | Provider/Contract Or Topic | Raw Location | Curated Output | Processed Output |
| --- | --- | --- | --- | --- |
| Endpoint, event, file, or MQTT topic | Canonical identity used by the platform | Raw S3 prefix or message route | Curated table or dataset | Processed table, mart, or n/a |

## Failure Modes

- Failure:
  Cause, detection, and likely impact.

## Operations

Summarize normal operator or support tasks for this integration.

## Validation Evidence

Describe the tests, commands, sample payloads, or deployed checks that prove the integration still works.

## Change Process

Describe which runbook to use when adding providers, contracts, source fields, config keys, credentials, or downstream outputs.

## References

- External specs:
- Internal runbooks:
- Related architecture docs:
