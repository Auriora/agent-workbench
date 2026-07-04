/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import Parser from "tree-sitter";
import Python from "tree-sitter-python";

export type PythonSymbol = {
  kind: "function" | "class";
  name: string;
  qualifiedName: string;
  signature?: string;
  docstring?: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type PythonReference = {
  name: string;
  kind: "import" | "call";
  sourceQualifiedName?: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type PythonExtraction = {
  symbols: PythonSymbol[];
  references: PythonReference[];
};

const parser = (() => {
  const languageParser = new Parser();
  languageParser.setLanguage(Python as Parser.Language);
  return languageParser;
})();

export class PythonParserAdapter {
  public extractPythonSymbols(source: string): PythonSymbol[] {
    return this.extractPython(source).symbols;
  }

  public extractPython(source: string): PythonExtraction {
    const tree = parser.parse(source);
    const symbols: PythonSymbol[] = [];
    const references: PythonReference[] = [];

    const visit = (node: Parser.SyntaxNode, qualifiedPrefix: readonly string[]): void => {
      if (node.type === "function_definition" || node.type === "class_definition") {
        const nameNode = node.childForFieldName("name");
        if (nameNode) {
          const name = nameNode.text;
          const qualifiedName = [...qualifiedPrefix, name].join(".");
          symbols.push({
            kind: node.type === "function_definition" ? "function" : "class",
            name,
            qualifiedName,
            signature: signatureFor(node),
            docstring: docstringFor(node),
            startLine: node.startPosition.row + 1,
            startColumn: node.startPosition.column,
            endLine: node.endPosition.row + 1,
            endColumn: node.endPosition.column
          });
          visitChildren(node, [...qualifiedPrefix, name]);
          return;
        }
      }

      if (node.type === "import_statement" || node.type === "import_from_statement") {
        for (const name of importNames(node.text)) {
          references.push(referenceFromNode(node, name, "import", qualifiedPrefix));
        }
      } else if (node.type === "call") {
        const functionNode = node.childForFieldName("function");
        const name = functionNode ? referenceName(functionNode.text) : undefined;
        if (name) {
          references.push(referenceFromNode(functionNode ?? node, name, "call", qualifiedPrefix));
        }
      }

      visitChildren(node, qualifiedPrefix);
    };

    const visitChildren = (node: Parser.SyntaxNode, qualifiedPrefix: readonly string[]): void => {
      for (let index = 0; index < node.namedChildCount; index += 1) {
        const child = node.namedChild(index);
        if (child) {
          visit(child, qualifiedPrefix);
        }
      }
    };

    visit(tree.rootNode, []);
    return { symbols, references };
  }
}

export function extractPythonSymbols(source: string): PythonSymbol[] {
  return new PythonParserAdapter().extractPythonSymbols(source);
}

export function extractPython(source: string): PythonExtraction {
  return new PythonParserAdapter().extractPython(source);
}

function referenceFromNode(
  node: Parser.SyntaxNode,
  name: string,
  kind: PythonReference["kind"],
  qualifiedPrefix: readonly string[]
): PythonReference {
  return {
    name,
    kind,
    sourceQualifiedName: qualifiedPrefix.length > 0 ? qualifiedPrefix.join(".") : undefined,
    startLine: node.startPosition.row + 1,
    startColumn: node.startPosition.column,
    endLine: node.endPosition.row + 1,
    endColumn: node.endPosition.column
  };
}

function signatureFor(node: Parser.SyntaxNode): string | undefined {
  const firstLine = node.text.split("\n", 1)[0]?.trim();
  return firstLine && firstLine.length > 0 ? firstLine : undefined;
}

function docstringFor(node: Parser.SyntaxNode): string | undefined {
  const block = node.childForFieldName("body");
  if (!block) {
    return undefined;
  }

  const first = block.namedChild(0);
  if (!first || first.type !== "expression_statement") {
    return undefined;
  }

  const literal = first.namedChild(0);
  if (!literal || literal.type !== "string") {
    return undefined;
  }

  return stripPythonStringLiteral(literal.text);
}

function stripPythonStringLiteral(value: string): string {
  return value
    .replace(/^[rubfRUBF]*/, "")
    .replace(/^'''|^"""|^'|^"/, "")
    .replace(/'''$|"""$|'$|"$/, "")
    .trim();
}

function importNames(text: string): string[] {
  const normalized = text.trim();
  if (normalized.startsWith("from ")) {
    const imported = normalized.split(/\s+import\s+/u)[1] ?? "";
    return imported
      .split(",")
      .map((part) => part.trim().split(/\s+as\s+/u)[0]?.trim())
      .filter((part): part is string => part !== undefined && part.length > 0 && part !== "*")
      .map(referenceName)
      .filter((part): part is string => part !== undefined);
  }

  if (normalized.startsWith("import ")) {
    return normalized
      .slice("import ".length)
      .split(",")
      .map((part) => part.trim().split(/\s+as\s+/u)[0]?.trim())
      .filter((part): part is string => part !== undefined && part.length > 0)
      .map(referenceName)
      .filter((part): part is string => part !== undefined);
  }

  return [];
}

function referenceName(text: string): string | undefined {
  const normalized = text.trim();
  if (normalized.length === 0) {
    return undefined;
  }
  const parts = normalized.split(".");
  return parts[parts.length - 1];
}
