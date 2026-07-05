---
title: Markdown document quality design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-05-08
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Markdown Document Quality Design

## Purpose

Define a documentation-quality subsystem for checking and formatting Markdown so
documents remain readable as plain text and render correctly.

Markdown quality is not just lint compliance. The runtime should also detect
structural consistency issues and offer formatting that improves text-only
readability without damaging semantic content.

Read-only Markdown quality tools are available through the MCP surface.
Formatter planning, formatter preview/apply, cross-document reports, and
generated documentation reports remain future work and must still use the edit
preview/apply safety path before any mutation is introduced.

## Scope

This design covers Markdown documents in repo documentation, specs, ADRs,
runbooks, and generated or maintained guidance files.

In scope:

- heading hierarchy and skipped-level checks
- ordered-list numbering consistency
- section numbering consistency when headings include explicit numbers
- duplicate or near-duplicate heading detection
- frontmatter compliance
- link and file-reference shape checks
- table readability checks for plain-text viewing
- bounded read-only MCP checks for one document or an explicit/scoped document
  set
- integration with validation planning

Out of scope until a follow-up spec provides fixture-backed evidence:

- rewriting prose style or tone
- semantic contradiction detection across unrelated documents
- generated documentation reports
- Markdown formatter planning, preview, or apply
- generated documentation publishing
- automatic broad formatting without preview

## Design Summary

Markdown document quality has three separate capabilities:

| Capability | Purpose | Mutation |
| --- | --- | --- |
| Structure checker | Detect heading, list, table, link, and frontmatter consistency issues | None |
| Compliance linter | Check bounded repository documentation rules through configurable required frontmatter fields | None |
| Readability formatter | Produce a previewable rewrite that improves text-only readability while preserving rendered meaning | Preview/apply only |

These capabilities must be implemented through named application use cases and
ports. They must not be hidden inside extraction, MCP handlers, or generic
validation planning.

## Parser Direction

Use a Markdown parser that exposes an AST or event stream as the canonical
documentation structure input. Regex-only parsing is not acceptable for the core
checker because nested lists, fenced code, tables, frontmatter, and link
references need syntactic awareness.

The Markdown/config adapter may continue to emit graph routing evidence, but
document quality checks are a separate documentation-quality capability. The
quality subsystem may reuse extracted document outlines, but it must be able to
parse a document directly when asked to check or format it.

The current implementation uses `MarkdownParserAdapter` as the single approved
parser-aware input path for checker rules. It emits a small document event
stream for frontmatter, headings, ordered-list items, tables, and inline links,
and ignores fenced code blocks so code samples do not create Markdown quality
findings. It is not an external linter and does not execute formatters.

## Checks

### Heading Structure

The read-only checker detects:

- skipped heading levels, such as `h2` directly to `h4`
- duplicate headings under the same parent heading path. Repeated section labels
  under different parents, such as per-requirement `Acceptance Criteria`
  sections, are valid structure.

Deferred checks:

- inconsistent title/frontmatter title
- missing top-level title where required by repository policy
- headings that imply a numbered hierarchy but break sequence
- sections with inconsistent capitalization when a policy is configured

### Ordered Lists

The read-only checker detects:

- manually numbered lists that skip or duplicate numbers

Deferred checks:

- mixed numbering styles in one list
- inconsistent reset behavior between sibling lists
- ambiguous nesting caused by indentation

The formatter may normalize ordered lists to either sequential numbering or
Markdown's `1.` style depending on repository policy. The default should prefer
the repository's existing style unless a policy requires one style.

### Tables

Tables are often readable when rendered but poor as plain text. The read-only
checker flags rows or cells that exceed plain-text readability budgets and
adjacent rows with mismatched cell counts. Definition-like table rewrites
remain formatter work.

The formatter should support table rewrite strategies:

- align table columns for plain-text readability
- split wide tables into multiple smaller tables
- convert definition-like tables into definition lists or bullet sections
- preserve tables when alignment is sufficient and rendered structure matters

Formatter choices must be previewed and explain why a rewrite was selected.

### Links And References

The read-only checker detects:

- broken relative Markdown links when the target is in scope

Deferred checks:

- non-canonical local document links
- duplicate reference definitions
- unresolved reference-style links
- file references that violate repository documentation conventions

### Frontmatter

The read-only checker detects:

- missing required fields

Deferred checks:

- invalid `doc_type`, `status`, or owner values
- stale or malformed review dates
- title/frontmatter mismatch

The canonical field set remains repository-specific and should be configured
through documentation policy, not hard-coded in the Markdown parser.

## Formatter Rules

The formatter is a planning and preview feature before it is a mutation feature.

Required behavior:

- preserve frontmatter keys and values unless explicitly fixing frontmatter
- preserve fenced code blocks exactly by default
- preserve link targets and anchors unless rewriting links is explicitly
  requested
- preserve source meaning and rendered structure
- explain every non-trivial rewrite in formatter metadata
- return a preview token before any mutation
- use the existing edit preview/apply path for workspace writes

The formatter must optimize for text readability and renderability together.
If those goals conflict, it should report the conflict and avoid destructive
rewrites.

## Application Use Cases

- `CheckMarkdownDocument`
- `CheckMarkdownSet`
- future `PlanMarkdownFormat`
- future `PreviewMarkdownFormat`
- future `ApplyMarkdownFormat`

`CheckMarkdownDocument` and `CheckMarkdownSet` are read-only. They apply
catalog policy, generated/vendor skips, workspace-escape refusal, file-size
budgets, finding budgets, and bounded evidence snippets. Clean results are
compact and quiet.

Future `PlanMarkdownFormat` will be planning-only. Future
`PreviewMarkdownFormat` must produce a bounded edit preview. Future
`ApplyMarkdownFormat` must delegate to the same workspace safety, path
containment, and stale-preview protections as other edit application.

## Ports

Implemented first-slice ports:

- `MarkdownParserPort`
- `MarkdownStructureCheckPort`

Optional future ports:

- `MarkdownCompliancePolicyPort`
- `MarkdownFormatPlannerPort`
- `MarkdownLinkResolverPort`
- `DocumentationPolicyPort`
- `MarkdownStyleAdvisorPort`
- `CrossDocumentConsistencyPort`
- `DocumentationPublishPort`

## MCP Surface

Current docs query/read surfaces are part of the MVP MCP surface:

- `repo:///docs/overview`
- `repo:///docs/map`
- `docs_search`
- `docs_outline`
- `docs_read_section`

These surfaces help agents find and read repository documentation. They return
bounded routing evidence, stable section identifiers, direct-read caveats,
truncation metadata, and repo-relative paths. They do not perform document
quality checks, broad crosslink analysis, generated reporting, or formatting.
`docs_search` is not authoritative for precise claims; use
`docs_read_section` for direct section evidence.

Read-only quality tools:

- `check_markdown_document`
- `check_markdown_set`

Deferred formatter tools:

- `plan_markdown_format`
- `preview_markdown_format`
- `apply_markdown_format`

These tools are documentation-quality surfaces, not language-semantic tools.
The read-only checker tools report structured findings, severity, source
ranges, bounded evidence, suggested actions, warnings, budgets, skipped or
blocked states, and repo-relative paths using runtime contracts. Formatter
preview tokens remain deferred to the formatter surface.

Promote cross-document links, generated documentation reports, or formatter
tools only with fixture-backed evidence that the bounded query/read/check
surfaces are insufficient for the workflow and that the new surface stays
within explicit row, source-byte, and mutation budgets.

## Validation Planning Integration

`verification_plan` plans `check_markdown_document` for selected Markdown files
and `check_markdown_set` for include-all Markdown evidence. Non-Markdown config
evidence still receives a manual docs/config review plan. Validation planning
does not execute formatting or report success without evidence.

## Acceptance Evidence

Fixtures should include:

- skipped heading levels
- explicit heading numbering mismatch
- inconsistent ordered-list numbering
- nested lists with ambiguous indentation
- wide tables that are hard to read as plain text
- definition-like tables that should be rewritten
- frontmatter violations
- broken relative links
- documents that should remain unchanged

Golden outputs should cover checker findings. Formatter previews remain future
work.

## Related Docs

- [Layered runtime architecture](layered-runtime-architecture.md)
- [MCP surface design](mcp-surface-design.md)
- [Edit and validation loop design](edit-and-validation-loop-design.md)
- [Language adapter design](language-adapter-design.md)
- [Runtime contracts](../reference/runtime-contracts.md)
- [Workspace safety contract](../reference/workspace-safety-contract.md)
