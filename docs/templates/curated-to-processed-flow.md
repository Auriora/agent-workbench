---
title: Curated to processed flow title
doc_type: reference
status: draft
owner: team-or-person
last_reviewed: YYYY-MM-DD
---

# Title

## Purpose

Document one logical processed data group from curated table inputs through joins, filters, transformations, aggregations, and processed table or view outputs.

Use one document per logical analytical group. Split per processed table only when the table has distinct inputs, rules, consumers, or ownership.

## Scope

In scope:

- Curated tables that act as inputs to this processed model.
- Join keys, filters, derivations, aggregations, and output rules.
- Processed tables, views, exports, or query outputs produced by this model.
- Consumers and data quality checks for the processed outputs.

Out of scope:

- Raw ingest and raw-to-curated transformation details, except as links.
- Operational procedures that belong in runbooks.
- Unrelated processed models.

## Processed Group Summary

| Field | Value |
| --- | --- |
| Logical group |  |
| Processed outputs |  |
| Owning team |  |
| Refresh mode |  |
| Refresh schedule or trigger |  |
| Primary consumers |  |
| Query or job source |  |

## Business Meaning

Explain what business questions this processed model answers and how consumers interpret it.

## End-To-End Flow

```text
Curated input tables
  -> filtering and conformance
  -> joins and lookups
  -> derived fields
  -> aggregations or projections
  -> processed table, view, export, or dashboard query
```

## AppConfig And Runtime Settings

Document every runtime setting that affects processed-model selection, refresh scope, matching, transformation, output publication, or merge/upsert behavior. If the model is fully code/SQL-driven, state that explicitly.

| Config family or source | Key/path | Current default or expected value | Used by | Effect on processing/transformation | If missing, unmatched, or disabled |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

### Config Resolution Notes

Explain precedence and runtime loading behavior, such as job arguments, environment variables, AppConfig, SQL migration constants, and whether a configured value is currently read by the implementation.

### How Config Is Applied

List the ordered runtime application sequence. Explicitly state whether each config family is read by the current implementation or only defines intended behavior.

```text
1. Identify selected curated inputs or processed refresh scope.
2. Apply runtime enablement or source-window settings.
3. Apply dataset/input selection settings.
4. Apply matching, join, transformation, aggregation, or publishing settings.
5. Apply SQL migration/view behavior where relevant.
6. State what happens when config is missing, disabled, or not currently consumed.
```

## Input Curated Tables

| Curated table | Business meaning | Grain | Required | Raw-to-curated flow | Notes |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## Output Processed Tables Or Views

| Output | Type | Business meaning | Grain | Primary or natural key | Partitions | Consumer |
| --- | --- | --- | --- | --- | --- | --- |
|  | Table/View/Export |  |  |  |  |  |

## Processing Source Of Truth

| Rule or artifact | Source of truth | Applies to | Notes |
| --- | --- | --- | --- |
| SQL |  |  |  |
| Job code |  |  |  |
| View definition |  |  |  |
| Runtime config |  |  |  |
| Tests |  |  |  |

## Join And Relationship Rules

| Rule ID | Left input | Right input | Join key or condition | Join type | Cardinality expectation | Failure or missing-match behavior |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

## Filters

| Rule ID | Filter | Applies to | Reason | Source of truth |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Transformations And Derived Fields

| Output | Output field | Source field or expression | Transformation or algorithm | Null handling | Notes |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## Aggregations

| Output | Metric or field | Grain | Aggregation | Inputs | Notes |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## Processing Algorithm

Use this section when the processed model is easier to understand as ordered logic than as tables alone.

```text
1. Select eligible records from curated inputs.
2. Apply conformance filters.
3. Join supporting dimensions or snapshots.
4. Derive normalized fields.
5. Aggregate or project to output grain.
6. Write or expose processed outputs.
```

## Representative Query

Link to the canonical SQL, job, or view definition where possible. Inline only short excerpts that explain the documented behavior.

```sql
-- Representative query or pointer to canonical SQL.
```

## Data Quality Checks

| Check | Applies to | Expected result | Failure behavior | Test evidence |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Refresh, Backfill, And Reprocessing

Document refresh behavior, backfill assumptions, idempotency, and replay constraints. Link to runbooks or scripts for actual operator steps.

## Observability

| Signal | Location | Meaning | Action |
| --- | --- | --- | --- |
|  |  |  |  |

## Consumers

| Consumer | Uses | Freshness expectation | Contact | Notes |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Known Exceptions

Document explicit exceptions, temporary behavior, or approved deviations from the normal processed model.

## Open Questions

Track unresolved questions separately from confirmed behavior.

## Related Docs

- Data flow index:
- Raw-to-curated references:
- Source contracts:
- SQL or job definitions:
- Tests:
- Runbooks:
