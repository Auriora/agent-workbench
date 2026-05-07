---
title: Provider contract raw to curated flow title
doc_type: reference
status: draft
owner: team-or-person
last_reviewed: YYYY-MM-DD
---

# Title

## Purpose

Document one raw provider/contract/channel family from source ingest through validation, dataset resolution, transformation, and curated table publication.

Use one document per provider/contract when possible. Split further by channel only when channel behavior materially changes validation, transformation, or curated outputs.

## Scope

In scope:

- Source system and delivery behavior for this provider/contract.
- Raw object layout and envelope metadata.
- Validation, curation, dataset resolution, and transformation rules.
- Curated tables produced by this raw source.
- Failure, unmapped, replay, and observability behavior specific to this flow.

Out of scope:

- Downstream joins, aggregations, and processed tables unless they are listed as links.
- Detailed operational procedures that belong in runbooks.
- Unrelated providers or contracts.

## Source Summary

| Field | Value |
| --- | --- |
| Source system |  |
| Provider |  |
| Contract |  |
| Channel or channels |  |
| Delivery mode |  |
| Owning team |  |
| Upstream contact |  |
| Primary consumers |  |

## Business Meaning

Explain what this raw source represents in business terms and what downstream questions it supports.

## End-To-End Flow

```text
Source payload
  -> ingest endpoint, upload flow, or poller
  -> raw S3 object
  -> validation
  -> dataset resolution
  -> transformation and normalization
  -> curated table write
```

## AppConfig And Runtime Settings

Document every runtime setting that affects routing, validation, transformation, identity, or curated merge behavior for this flow. Include settings even when the current checked-in default means the flow is only partially active.

| Config family or source | Key/path | Current default or expected value | Used by | Effect on mapping/transformation | If missing, unmatched, or disabled |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

### Config Resolution Notes

Explain precedence and runtime loading behavior, such as local defaults, AppConfig overrides, environment defaults, fallback behavior, and whether the setting is read by the current implementation.

### How Config Is Applied

List the ordered runtime application sequence. This should let developers, data engineers, BI specialists, business analysts, and support engineers trace a source artifact to its curated output.

```text
1. Identify the source artifact, route, topic, repository ID, filename, or sheet.
2. Apply the first config key that gates or allows the source.
3. Apply mapping keys that resolve provider, contract, dataset, or target table.
4. Apply parser or transformation keys.
5. Apply validation/schema keys.
6. Apply curated merge identity keys.
7. State what happens when no key matches.
```

## Raw Ingest

### Entry Point

| Entry point | Method or trigger | Auth | Implementation reference | Notes |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

### Raw Storage

| Item | Value |
| --- | --- |
| Raw bucket |  |
| Raw key pattern |  |
| File format |  |
| Compression |  |
| Partition fields |  |

### Raw Envelope

| Field | Required | Source | Meaning | Example |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

### Raw Payload Shape

Describe the source payload structure. Link to schemas, examples, or contracts rather than duplicating large payloads.

| Payload area | Description | Source of truth | Notes |
| --- | --- | --- | --- |
|  |  |  |  |

## Validation

| Rule ID | Rule | Severity | Error code | Failure behavior | Source of truth | Test coverage |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

## Dataset Resolution

Explain how the raw source resolves to one or more authoritative datasets.

| Condition | Resolved dataset | Curated table | Rule source | Failure or unmapped behavior |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

### Resolution Algorithm

Use this section when dataset resolution has precedence, inference, or multiple decision points.

```text
1. Read provider, contract, channel, and source metadata.
2. Apply explicit dataset metadata when valid.
3. Apply configured mapping rules.
4. Apply documented inference rules if approved for this flow.
5. Publish to the resolved dataset or fail according to the documented behavior.
```

## Curation And Transformation

### Curation Rules

| Rule ID | Rule | Applies to | Implementation reference | Notes |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

### Field Transformations

| Curated table | Output field | Source field or expression | Transformation | Null handling | Example |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

### Derived Fields

| Curated table | Derived field | Algorithm or expression | Inputs | Notes |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Curated Outputs

| Curated table | Business meaning | Grain | Primary or natural key | Partitions | Location | Notes |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

## Data Quality Checks

| Check | Applies to | Expected result | Failure behavior | Test evidence |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Observability

| Signal | Location | Meaning | Action |
| --- | --- | --- | --- |
|  |  |  |  |

## Replay And Reprocess Notes

Document whether the flow is deterministic, idempotent, and safe to replay. Link to runbooks or scripts for actual operator steps.

## Downstream Processed Outputs

List processed outputs that depend on the curated tables produced here. Keep detailed joins, filters, and aggregations in curated-to-processed documents.

| Curated table | Processed table or view | Logical group | Detailed flow | Consumer |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Known Exceptions

Document explicit exceptions, temporary behavior, or approved deviations from the normal flow.

## Open Questions

Track unresolved questions separately from confirmed behavior.

## Related Docs

- Data flow index:
- Curated-to-processed references:
- Source contracts:
- Schemas:
- Config:
- Tests:
- Runbooks:
