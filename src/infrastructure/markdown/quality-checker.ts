/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import type {
  AttentionSeverity,
  MarkdownQualityCategory,
  MarkdownQualityFinding,
  MarkdownQualityRule
} from "../../contracts/index.js";
import type {
  MarkdownBlock,
  MarkdownDocumentAst,
  MarkdownStructureCheckPort
} from "../../ports/index.js";

const TABLE_WIDTH_LIMIT = 100;
const TABLE_CELL_LIMIT = 40;

export class MarkdownStructureCheckerAdapter implements MarkdownStructureCheckPort {
  public check(input: {
    document: MarkdownDocumentAst;
    repo_root: string;
    existing_markdown_paths: ReadonlySet<string>;
    required_frontmatter: readonly string[];
    max_findings: number;
    max_evidence_bytes: number;
  }): { findings: readonly MarkdownQualityFinding[]; truncated: boolean } {
    const findings = [
      ...checkFrontmatter(input),
      ...checkHeadings(input),
      ...checkOrderedLists(input),
      ...checkLinks(input),
      ...checkTables(input)
    ];
    return {
      findings: findings.slice(0, input.max_findings),
      truncated: findings.length > input.max_findings
    };
  }
}

function checkFrontmatter(input: {
  document: MarkdownDocumentAst;
  required_frontmatter: readonly string[];
  max_evidence_bytes: number;
}): MarkdownQualityFinding[] {
  const missing = input.required_frontmatter.filter((field) => !input.document.frontmatter?.fields.has(field));
  if (missing.length === 0) return [];
  return [
    finding({
      document: input.document,
      rule: "markdown.frontmatter.missing_required",
      category: "frontmatter",
      severity: "warning",
      line: 1,
      column: 0,
      evidence: input.document.lines[0] ?? "",
      maxEvidenceBytes: input.max_evidence_bytes,
      message: `Missing required frontmatter field(s): ${missing.join(", ")}.`,
      suggestedAction: "Add the required frontmatter fields before the first Markdown heading."
    })
  ];
}

function checkHeadings(input: {
  document: MarkdownDocumentAst;
  max_evidence_bytes: number;
}): MarkdownQualityFinding[] {
  const findings: MarkdownQualityFinding[] = [];
  const headings = input.document.blocks.filter(isHeading);
  const seen = new Set<string>();
  let previousDepth = 0;
  for (const heading of headings) {
    if (previousDepth > 0 && heading.depth > previousDepth + 1) {
      findings.push(
        finding({
          document: input.document,
          rule: "markdown.heading.skipped_level",
          category: "heading_structure",
          severity: "warning",
          line: heading.line,
          column: heading.column,
          evidence: heading.raw,
          maxEvidenceBytes: input.max_evidence_bytes,
          message: `Heading jumps from level ${previousDepth} to level ${heading.depth}.`,
          suggestedAction: "Insert the missing intermediate heading level or reduce this heading depth."
        })
      );
    }
    const normalized = normalizeHeading(heading.text);
    if (seen.has(normalized)) {
      findings.push(
        finding({
          document: input.document,
          rule: "markdown.heading.duplicate",
          category: "heading_structure",
          severity: "warning",
          line: heading.line,
          column: heading.column,
          evidence: heading.raw,
          maxEvidenceBytes: input.max_evidence_bytes,
          message: `Duplicate heading '${heading.text}'.`,
          suggestedAction: "Rename one heading or add qualifying context."
        })
      );
    }
    seen.add(normalized);
    previousDepth = heading.depth;
  }
  return findings;
}

function checkOrderedLists(input: {
  document: MarkdownDocumentAst;
  max_evidence_bytes: number;
}): MarkdownQualityFinding[] {
  const findings: MarkdownQualityFinding[] = [];
  const expectedByIndent = new Map<number, number>();
  let previousLine = 0;
  for (const item of input.document.blocks.filter(isOrderedListItem)) {
    if (previousLine > 0 && item.line > previousLine + 1) {
      expectedByIndent.delete(item.indent);
    }
    const expected = expectedByIndent.get(item.indent) ?? item.number;
    if (item.number !== expected) {
      findings.push(
        finding({
          document: input.document,
          rule: "markdown.list.numbering",
          category: "numbering",
          severity: "warning",
          line: item.line,
          column: item.column,
          evidence: item.raw,
          maxEvidenceBytes: input.max_evidence_bytes,
          message: `Ordered list item is numbered ${item.number}; expected ${expected}.`,
          suggestedAction: "Renumber the list item or reset the list with a blank line."
        })
      );
    }
    expectedByIndent.set(item.indent, item.number + 1);
    previousLine = item.line;
  }
  return findings;
}

function checkLinks(input: {
  document: MarkdownDocumentAst;
  existing_markdown_paths: ReadonlySet<string>;
  max_evidence_bytes: number;
}): MarkdownQualityFinding[] {
  const findings: MarkdownQualityFinding[] = [];
  for (const link of input.document.links) {
    if (isExternalOrAnchor(link.target)) {
      continue;
    }
    const targetPath = link.target.split("#", 1)[0] ?? "";
    if (targetPath.length === 0) continue;
    const resolved = path
      .normalize(path.join(path.dirname(input.document.path), targetPath))
      .replaceAll("\\", "/");
    if (!input.existing_markdown_paths.has(resolved)) {
      findings.push(
        finding({
          document: input.document,
          rule: "markdown.link.broken_relative",
          category: "link",
          severity: "warning",
          line: link.line,
          column: link.column,
          evidence: link.raw,
          maxEvidenceBytes: input.max_evidence_bytes,
          message: `Relative Markdown link target '${link.target}' was not found.`,
          suggestedAction: "Fix the link target or add the referenced document."
        })
      );
    }
  }
  return findings;
}

function checkTables(input: {
  document: MarkdownDocumentAst;
  max_evidence_bytes: number;
}): MarkdownQualityFinding[] {
  const findings: MarkdownQualityFinding[] = [];
  const rows = input.document.blocks.filter(isTableRow);
  let previous: MarkdownBlock & { kind: "table_row" } | undefined;
  for (const row of rows) {
    const wideLine = row.raw.length > TABLE_WIDTH_LIMIT;
    const wideCell = row.cells.some((cell) => cell.length > TABLE_CELL_LIMIT);
    const mismatchedCells = previous !== undefined && previous.line === row.line - 1 && previous.cells.length !== row.cells.length;
    if (wideLine || wideCell || mismatchedCells) {
      findings.push(
        finding({
          document: input.document,
          rule: "markdown.table.readability",
          category: "table_readability",
          severity: "warning",
          line: row.line,
          column: row.column,
          evidence: row.raw,
          maxEvidenceBytes: input.max_evidence_bytes,
          message: tableMessage({ wideLine, wideCell, mismatchedCells }),
          suggestedAction: "Split or realign the table so it remains readable as plain text."
        })
      );
    }
    previous = row;
  }
  return findings;
}

function finding(input: {
  document: MarkdownDocumentAst;
  rule: MarkdownQualityRule;
  category: MarkdownQualityCategory;
  severity: AttentionSeverity;
  line: number;
  column: number;
  evidence: string;
  maxEvidenceBytes: number;
  message: string;
  suggestedAction: string;
}): MarkdownQualityFinding {
  const evidence = limitEvidence(input.evidence, input.maxEvidenceBytes);
  return {
    category: input.category,
    severity: input.severity,
    rule_id: input.rule,
    code: input.rule,
    path: input.document.path,
    start_line: input.line,
    start_column: input.column,
    end_line: input.line,
    end_column: input.column + evidence.length,
    message: input.message,
    evidence,
    suggested_action: input.suggestedAction,
    evidence_kinds: ["docs", "direct_read"]
  };
}

function limitEvidence(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) {
    return value;
  }
  return value.slice(0, maxBytes);
}

function normalizeHeading(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/gu, " ");
}

function isExternalOrAnchor(target: string): boolean {
  return /^(?:https?:|mailto:|#)/u.test(target);
}

function tableMessage(input: { wideLine: boolean; wideCell: boolean; mismatchedCells: boolean }): string {
  if (input.mismatchedCells) return "Table row has a different cell count from the previous row.";
  if (input.wideCell) return "Table contains a cell that is hard to read as plain text.";
  return "Table row exceeds the plain-text readability width budget.";
}

function isHeading(block: MarkdownBlock): block is MarkdownBlock & { kind: "heading" } {
  return block.kind === "heading";
}

function isOrderedListItem(block: MarkdownBlock): block is MarkdownBlock & { kind: "ordered_list_item" } {
  return block.kind === "ordered_list_item";
}

function isTableRow(block: MarkdownBlock): block is MarkdownBlock & { kind: "table_row" } {
  return block.kind === "table_row";
}
