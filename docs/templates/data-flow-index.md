---
title: Data flow index title
doc_type: architecture
status: draft
owner: team-or-person
last_reviewed: YYYY-MM-DD
---

# Title

## Purpose

Describe the end-to-end data flow map from raw sources to curated tables and from curated tables to processed outputs.

This document is the navigation hub for detailed data-flow references. It should summarize the whole lake flow, then link to provider/contract raw-to-curated documents and logical curated-to-processed documents.

## Scope

In scope:

- Source systems, providers, contracts, and channels included in this data-flow map.
- Raw source families and their curated table fan-out.
- Curated tables and their processed table or view fan-in and fan-out.
- Canonical references for validation, curation, transformation, query, and processing rules.

Out of scope:

- Full field-level mappings that belong in linked raw-to-curated or curated-to-processed references.
- Operational procedures that belong in runbooks.
- Historical or superseded flows that belong in history notes.

## Audience

Identify who should use this map, such as platform engineers, analysts, operators, integration owners, or support teams.

## Executive Summary

Summarize the current flow in business terms:

- What categories of data enter the lake.
- Where raw data lands.
- How raw sources fan out to curated tables.
- How curated tables combine into processed outputs.
- Which consumers depend on curated or processed data.

## System Flow

```text
Source systems
  -> ingest APIs, upload flows, or pollers
  -> raw S3 objects
  -> validation and dataset resolution
  -> curated Iceberg tables
  -> processed tables, views, or query outputs
  -> dashboards, APIs, exports, and analysts
```

## Source-To-Curated Map

Use this table as the main raw-source fan-out index. Each row should link to a detailed raw-to-curated document.

| Source system | Provider | Contract | Channel | Delivery mode | Curated outputs | Detailed flow |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

## Curated-To-Processed Map

Use this table as the main processed-output index. Each row should link to a detailed curated-to-processed document.

| Processed group | Processed table or view | Curated inputs | Processing owner | Consumers | Detailed flow |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## Curated Table Inventory

List curated tables once so a reader can move in either direction: source-first or output-first.

| Curated table | Business meaning | Raw source documents | Processed output documents | Notes |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Processed Output Inventory

| Processed table or view | Business meaning | Grain | Source curated tables | Consumers | Notes |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## Cross-Cutting Contracts

| Contract or rule set | Source of truth | Applies to | Notes |
| --- | --- | --- | --- |
| Raw key naming |  |  |  |
| Envelope metadata |  |  |  |
| Validation framework |  |  |  |
| Dataset resolution |  |  |  |
| Curated table naming |  |  |  |
| Processed table naming |  |  |  |
| Runtime config |  |  |  |
| Tests |  |  |  |

## Runtime Config Inventory

Summarize the config families that materially affect routing, validation, transformation, merge identity, or processed publication. Detailed key-level behavior belongs in each linked flow document.

| Config family or source | Primary path | Affects | Detailed docs |
| --- | --- | --- | --- |
|  |  |  |  |

## Cross-Cutting Rules

Document only shared behavior here. Put source-specific or output-specific rules in the linked detailed documents.

### Naming And Storage

- Raw key pattern:
- Curated table naming:
- Processed table or view naming:
- Catalog database naming:
- Partitioning:

### Metadata

| Field | Source | Required | Meaning | Notes |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

### Idempotency, Replay, And Reprocessing

Summarize shared replay behavior and link to runbooks or source-specific notes where details differ.

### Timestamp Handling

Summarize shared timezone, source timestamp, ingest timestamp, and reporting-date rules.

### Schema Evolution

Summarize how new, missing, deprecated, or renamed fields are handled across the lake.

### Failure And Unmapped Behavior

Document explicit shared failure behavior. Avoid undocumented fallback behavior; if fallback behavior exists, document the approval reason and operational impact.

## Coverage And Gaps

Track which detailed documents exist and which are still missing.

| Area | Status | Owner | Next action |
| --- | --- | --- | --- |
|  |  |  |  |

## Related Docs

- Raw-to-curated references:
- Curated-to-processed references:
- Architecture docs:
- Runbooks:
- ADRs:
- Specs:
