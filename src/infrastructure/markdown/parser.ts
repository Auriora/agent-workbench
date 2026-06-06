import type {
  MarkdownBlock,
  MarkdownDocumentAst,
  MarkdownParsedLink,
  MarkdownParserPort
} from "../../ports/index.js";

export class MarkdownParserAdapter implements MarkdownParserPort {
  public parse(input: { path: string; content: string }): MarkdownDocumentAst {
    const lines = input.content.split(/\r?\n/u);
    const frontmatter = parseFrontmatter(lines);
    const blocks: MarkdownBlock[] = [];
    const links: MarkdownParsedLink[] = [];
    let fenced = false;

    for (let index = 0; index < lines.length; index += 1) {
      const lineNumber = index + 1;
      const line = lines[index] ?? "";
      if (frontmatter !== undefined && lineNumber >= frontmatter.start_line && lineNumber <= frontmatter.end_line) {
        continue;
      }
      const trimmed = line.trimStart();
      if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
        fenced = !fenced;
        continue;
      }
      if (fenced) {
        continue;
      }

      const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(line);
      if (heading !== null) {
        blocks.push({
          kind: "heading",
          line: lineNumber,
          column: 0,
          depth: heading[1]?.length ?? 1,
          text: heading[2] ?? "",
          raw: line
        });
        continue;
      }

      const listItem = /^(\s*)(\d+)[.)]\s+\S/u.exec(line);
      if (listItem !== null) {
        blocks.push({
          kind: "ordered_list_item",
          line: lineNumber,
          column: listItem[1]?.length ?? 0,
          indent: listItem[1]?.length ?? 0,
          number: Number.parseInt(listItem[2] ?? "0", 10),
          raw: line
        });
      }

      if (isTableRow(line)) {
        blocks.push({
          kind: "table_row",
          line: lineNumber,
          column: line.search(/\|/u),
          cells: splitTableCells(line),
          raw: line
        });
      }

      links.push(...parseInlineLinks({ line, lineNumber }));
    }

    return {
      path: input.path,
      lines,
      frontmatter,
      blocks,
      links
    };
  }
}

function parseFrontmatter(lines: readonly string[]): MarkdownDocumentAst["frontmatter"] {
  if ((lines[0] ?? "").trim() !== "---") {
    return undefined;
  }
  const fields = new Map<string, string>();
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "---") {
      return {
        start_line: 1,
        end_line: index + 1,
        fields
      };
    }
    const separator = line.indexOf(":");
    if (separator > 0) {
      fields.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
    }
  }
  return undefined;
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.includes("|") && trimmed.split("|").length >= 3;
}

function splitTableCells(line: string): readonly string[] {
  const trimmed = line.trim();
  const normalized = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const withoutTrailing = normalized.endsWith("|") ? normalized.slice(0, -1) : normalized;
  return withoutTrailing.split("|").map((cell) => cell.trim());
}

function parseInlineLinks(input: { line: string; lineNumber: number }): MarkdownParsedLink[] {
  const links: MarkdownParsedLink[] = [];
  let index = 0;
  while (index < input.line.length) {
    const open = input.line.indexOf("[", index);
    if (open < 0) break;
    if (open > 0 && input.line[open - 1] === "!") {
      index = open + 1;
      continue;
    }
    const close = input.line.indexOf("]", open + 1);
    if (close < 0 || input.line[close + 1] !== "(") {
      index = open + 1;
      continue;
    }
    const targetClose = input.line.indexOf(")", close + 2);
    if (targetClose < 0) {
      index = close + 1;
      continue;
    }
    const rawTarget = input.line.slice(close + 2, targetClose).trim();
    const target = rawTarget.split(/\s+/u, 1)[0] ?? "";
    links.push({
      line: input.lineNumber,
      column: open,
      label: input.line.slice(open + 1, close),
      target,
      raw: input.line.slice(open, targetClose + 1)
    });
    index = targetClose + 1;
  }
  return links;
}
