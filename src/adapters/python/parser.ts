import Parser from "tree-sitter";
import Python from "tree-sitter-python";

export type PythonSymbol = {
  kind: "function" | "class";
  name: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

const parser = new Parser();
parser.setLanguage(Python as Parser.Language);

export function extractPythonSymbols(source: string): PythonSymbol[] {
  const tree = parser.parse(source);
  const symbols: PythonSymbol[] = [];

  function visit(node: Parser.SyntaxNode): void {
    if (node.type === "function_definition" || node.type === "class_definition") {
      const nameNode = node.childForFieldName("name");
      if (nameNode) {
        symbols.push({
          kind: node.type === "function_definition" ? "function" : "class",
          name: nameNode.text,
          startLine: node.startPosition.row + 1,
          startColumn: node.startPosition.column,
          endLine: node.endPosition.row + 1,
          endColumn: node.endPosition.column
        });
      }
    }

    for (let index = 0; index < node.namedChildCount; index += 1) {
      const child = node.namedChild(index);
      if (child) {
        visit(child);
      }
    }
  }

  visit(tree.rootNode);
  return symbols;
}
