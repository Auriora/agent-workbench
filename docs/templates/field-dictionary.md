---
title: Field dictionary title
doc_type: reference
status: draft
owner: team-or-person
last_reviewed: YYYY-MM-DD
---

# Title

## Purpose

Describe the source fields, business meanings, and downstream use for one
provider, contract, dataset family, or processed model.

## Source Of Truth

Identify the source artifact, external contract, schema, workbook, API
response, SQL model, or code/config path used to build this dictionary.

## Scope

In scope:

- Field groups, sheets, tables, or datasets covered by this dictionary.

Out of scope:

- Field groups, sheets, tables, or datasets intentionally excluded.

## How To Use This Dictionary

Explain whether this document is the canonical documentation surface, an
extraction from an external source, or a companion to code/config. Link the
raw-to-curated and curated-to-processed docs that explain transformation rules.

## Field Groups

### Group Name

| Source field | Business description | Source group | Used by flow | Curated or processed target | Notes |
| --- | --- | --- | --- | --- | --- |
| `FIELD_NAME` | Describe the source meaning. | Sheet, table, endpoint, or object path | Linked flow doc | Target field/table when known | Validation, transformation, or usage notes. |

## Shared Terms

| Term | Meaning | Notes |
| --- | --- | --- |
| Term | Business meaning | Alias, source-system, or usage notes |

## Update Procedure

Describe when this dictionary should be updated, how source changes are
verified, and which linked docs should be reviewed after changes.

## Related Docs

- Related raw-to-curated, curated-to-processed, integration, config, schema, or
  runbook docs.
