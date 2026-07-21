---
title: Documentation map
status: current
---

# Documentation Map

| Concern | Canonical owner | Intent terms | Notes |
| --- | --- | --- | --- |
| Coding-agent integrations | [Coding agent integration design](../design/coding-agent-integration-design.md) | SessionStart; codex; kiro; agent hooks; hook parity | One owner governs several exact terms. |
| Runtime contracts | [Runtime contracts](runtime-contracts.md) | runtime contracts | One owner may govern several concerns. |
| Runtime envelope | [Runtime contracts](runtime-contracts.md) | runtime envelope | Same owner as runtime contracts. |
| Graph schema | [Graph store design](../design/graph-store-design.md) | graph schema | Exact multi-token term. |
| Shared governance | [Runtime contracts](runtime-contracts.md) and [Graph store design](../design/graph-store-design.md) | shared governance | Multiple owners are valid, not a conflict. |
| Tie alpha | [Runtime contracts](runtime-contracts.md) | shared tie | Same-length exact term; normalized concern key orders first. |
| Tie beta | [Graph store design](../design/graph-store-design.md) | shared tie | Same-length exact term; owner path is the final concern-evidence tie-breaker. |
| Draft owner | [Draft owner](../drafts/draft-owner.md) | draft governance | Draft status remains truthful. |
| Missing owner | [Missing owner](../missing/missing-owner.md) | missing governance | Missing target is retained as bounded governance evidence. |
| Archived owner | [Archived owner](../history/archived-owner.md) | archived governance | Archived owner is invalid for promotion. |
| Superseded owner | [Superseded owner](../design/superseded-owner.md) | superseded governance | Superseded owner retains replacement evidence. |
| Conflicting owner | [Conflicting owner](../design/conflicting-owner.md) | conflicting governance | Conflict comes from contradictory canonical_owner frontmatter. |
