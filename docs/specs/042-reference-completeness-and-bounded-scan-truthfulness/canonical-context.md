---
title: Reference completeness canonical context
doc_type: spec
artifact_type: canonical-context
status: draft
owner: platform
last_reviewed: 2026-07-20
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Canonical Context

## Purpose

Define the authority boundary for Spec 042 without allowing temporary package
claims to overstate current reference behavior.

## Intake

- Source: healthy runtime `0.6.0` Claude Code dogfood recorded on 2026-07-20.
- User-confirmed purpose: prevent incomplete reference results from appearing
  complete and preserve bounded continuation.
- Priority: P0 under EB053.
- Current reproduction: nine Workbench lexical hits versus twelve direct-search
  occurrences for `buildSessionStartContext`; three TypeScript integration-test
  occurrences were omitted.

## Authority Hierarchy

1. `AGENTS.md`, user instructions, source contracts, tests, and live runtime
   evidence remain always canonical.
2. `requirements.md` and `design.md` are canonical only for the intended Spec
   042 slice.
3. Durable current behavior remains owned by MCP surface design, graph-store
   design, and runtime contracts until promotion.
4. Dogfood evidence proves one dated reproduction, not universal prevalence.

## Always-Canonical External Sources

- The user request and the 2026-07-20 runtime `0.6.0` dogfood result establish
  the defect and sequencing priority.
- `AGENTS.md` defines repository architecture, validation, and no-fallback
  constraints.

## Spec-Canonical Working Sources

- `requirements.md` owns the intended acceptance boundary.
- `design.md` owns the selected bounded-continuation and occurrence model.
- `tasks.md`, `traceability.md`, and `verification.md` own delivery and proof
  state until closure.

## Imported Sources

- `docs/backlog/README.md` EB053 supplies the accepted friction signal.
- `docs/reference/dogfood-evidence-ledger.md` supplies dated comparative
  evidence.
- MCP surface, graph-store, language-adapter, runtime-contract, and MVP proof
  documents supply current durable boundaries.

## Non-Canonical Background Sources

- Shell-search counts are comparison evidence, not the Workbench contract or
  implementation path.
- Spec 042 text does not describe shipped runtime behavior until promoted and
  verified.

## Repository Truth At Intake

- `FileCatalogPort.listFiles` already supports ordered `after_path` pagination.
- `findLexicalReferences` accepts TypeScript and JavaScript but reads only the
  first bounded catalog window.
- `WorkspaceFilePort.readText` is a whole-file operation; it exposes no chunk,
  cancellation, or resumable-read cursor. `FileCatalogEntry.file_identity`
  supplies the declared indexed size and identity used for admission/replay.
- Public truncation is computed from collected hits rather than candidate
  source exhaustion.
- Lexical hits are correctly labeled low-confidence unresolved evidence; the
  defect is completeness presentation, not provenance inflation.

## Encoded Constraints

- Keep graph/parser evidence primary and lexical evidence explicitly weak.
- Use one explicit paginated catalog path; do not add a shell or parser fallback.
- Preserve snapshot validity, workspace policy, and query-budget boundaries.
- Do not claim complete absence without evidence-source exhaustion.
- Treat policy-excluded paths as explicitly outside declared scope, while an
  oversized, unreadable, missing, or changed searchable indexed candidate
  remains unresolved evidence that prevents valid absence.
- Use file-atomic scan progress after the last fully inspected or fully
  classified unresolved path. A separate result cursor may page occurrences
  from an inspected file but cannot masquerade as within-file scan progress.

## Review-Reconciled Decisions

- Parser incoming, outgoing, and unresolved routes prove completeness with
  independent limit-plus-one probes and route-bound continuation.
- Whole-file reads use declared-size byte admission and a monotonic time
  admission deadline; declared bytes are admission-bounded while actual bytes
  are observed after the atomic read, and replay reads are accounted separately.
- Opaque cursors are HMAC-authenticated with a daemon-lifetime key epoch; bad
  tags are invalid and pre-restart cursors expire explicitly.
- Parser results drain disjoint outgoing, incoming, and unresolved routes in
  that order using one authenticated composite cursor.
- Failed searchable candidates advance catalog progress as fully classified
  unresolved entries without incrementing unique-file inspection.
- The missing indexed candidate after catalog row 100 is a named acceptance
  fixture, not an inference from the original SessionStart reproduction.
- Package-level provider labels are not real-client evidence. Installed Codex
  and Claude gates require their actual CLIs and structured cleanup receipts.
- Lifecycle lint, Markdown/link checks, expert review, promotion diff, closure,
  and archive-index consistency are separate gates.

## Promotion Map

| Spec content | Durable destination | Required before closure |
| --- | --- | --- |
| completeness and continuation contract | `docs/design/mcp-surface-design.md`; `docs/reference/runtime-contracts.md` | yes |
| catalog pagination behavior | `docs/design/graph-store-design.md` | yes |
| lexical occurrence capability | `docs/design/language-adapter-design.md` | yes |
| bounded reference proof | `docs/reference/mvp-proof-matrix.md` | yes |
| delivered defect disposition | `docs/backlog/README.md` EB053; agent-readable changelog | yes |

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Change impact: `change-impact.md`
- Verification: `verification.md`
- Review disposition: `review-disposition.md`
