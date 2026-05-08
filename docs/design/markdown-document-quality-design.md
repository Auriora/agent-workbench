---
title: Markdown document quality design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-05-08
---

# Markdown Document Quality Design

## Purpose

Define a documentation-quality subsystem for checking and formatting Markdown so
documents remain readable as plain text and render correctly.

Markdown quality is not just lint compliance. The runtime should also detect
structural consistency issues and offer formatting that improves text-only
readability without damaging semantic content.

Executable Markdown quality tools are post-MVP. MVP architecture work defines
contracts, ports, fixture shape, and preview/apply safety requirements so the
capability can be added without changing the runtime layering.

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
- formatter planning and preview for Markdown readability
- integration with validation planning

Out of scope for MVP unless fixture-backed:

- rewriting prose style or tone
- semantic contradiction detection across unrelated documents
- generated documentation publishing
- automatic broad formatting without preview

## Design Summary

Markdown document quality has three separate capabilities:

| Capability | Purpose | Mutation |
| --- | --- | --- |
| Structure checker | Detect heading, list, numbering, table, link, and cross-reference consistency issues | None |
| Compliance linter | Check repository documentation rules and markdownlint-style conventions | None |
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

## Checks

### Heading Structure

Detect:

- skipped heading levels, such as `h2` directly to `h4`
- duplicate headings in the same scope
- inconsistent title/frontmatter title
- missing top-level title where required by repository policy
- headings that imply a numbered hierarchy but break sequence
- sections with inconsistent capitalization when a policy is configured

### Ordered Lists

Detect:

- mixed numbering styles in one list
- manually numbered lists that skip or duplicate numbers
- inconsistent reset behavior between sibling lists
- ambiguous nesting caused by indentation

The formatter may normalize ordered lists to either sequential numbering or
Markdown's `1.` style depending on repository policy. The default should prefer
the repository's existing style unless a policy requires one style.

### Tables

Tables are often readable when rendered but poor as plain text. The checker
should flag tables that exceed plain-text readability budgets or use short-form
headers/definitions that obscure meaning.

The formatter should support table rewrite strategies:

- align table columns for plain-text readability
- split wide tables into multiple smaller tables
- convert definition-like tables into definition lists or bullet sections
- preserve tables when alignment is sufficient and rendered structure matters

Formatter choices must be previewed and explain why a rewrite was selected.

### Links And References

Detect:

- broken relative Markdown links when the target is in scope
- non-canonical local document links
- duplicate reference definitions
- unresolved reference-style links
- file references that violate repository documentation conventions

### Frontmatter

Detect:

- missing required fields
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
- `PlanMarkdownFormat`
- `PreviewMarkdownFormat`
- `ApplyMarkdownFormat`

`CheckMarkdownDocument` and `CheckMarkdownSet` are read-only. `PlanMarkdownFormat`
is planning-only. `PreviewMarkdownFormat` produces a bounded edit preview.
`ApplyMarkdownFormat` delegates to the same workspace safety, path containment,
and stale-preview protections as other edit application.

## Ports

MVP or first implementation ports:

- `MarkdownParserPort`
- `MarkdownStructureCheckPort`
- `MarkdownCompliancePolicyPort`
- `MarkdownFormatPlannerPort`
- `MarkdownLinkResolverPort`
- `DocumentationPolicyPort`

Optional future ports:

- `MarkdownStyleAdvisorPort`
- `CrossDocumentConsistencyPort`
- `DocumentationPublishPort`

## MCP Surface

Potential tools:

- `check_markdown_document`
- `check_markdown_set`
- `plan_markdown_format`
- `preview_markdown_format`
- `apply_markdown_format`

These tools are documentation-quality surfaces, not language-semantic tools.
They should report structured findings, severity, source ranges, suggested
actions, and formatter preview tokens using runtime contracts.

## Validation Planning Integration

`verification_plan` may include documentation-quality checks when touched files
include Markdown or documentation policy files. It should plan the checks; it
must not silently run formatting or report success without evidence.

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

Golden outputs should cover checker findings and formatter previews.

## Related Docs

- [Layered runtime architecture](layered-runtime-architecture.md)
- [MCP surface design](mcp-surface-design.md)
- [Edit and validation loop design](edit-and-validation-loop-design.md)
- [Language adapter design](language-adapter-design.md)
- [Runtime contracts](../reference/runtime-contracts.md)
- [Workspace safety contract](../reference/workspace-safety-contract.md)
