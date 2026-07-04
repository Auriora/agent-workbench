/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  ExtractionBatch,
  ExtractionRequest,
  GraphNodeWriteModel,
  UnresolvedReferenceWriteModel
} from "../../domain/models/index.js";
import type { ExtractorPort } from "../../ports/index.js";
import { parseJsTs } from "./javascript-parser.js";
import type Parser from "tree-sitter";

type JsTsDeclaration = {
  kind: "function" | "class" | "method" | "constant" | "type";
  name: string;
  qualifiedName: string;
  signature?: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

type JsTsReference = {
  name: string;
  kind: "js_ts_import" | "js_ts_export";
  sourceQualifiedName?: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  metadata: Record<string, unknown>;
};

export class JavaScriptTypeScriptTreeSitterExtractorAdapter implements ExtractorPort {
  public readonly language: "javascript" | "typescript";

  constructor(input: { language: "javascript" | "typescript" }) {
    this.language = input.language;
  }

  public supports(input: { language: string; path: string }): boolean {
    if (input.language !== this.language) {
      return false;
    }
    return this.language === "typescript"
      ? /\.[cm]?tsx?$/u.test(input.path)
      : /\.[cm]?jsx?$/u.test(input.path);
  }

  public async extract(input: ExtractionRequest): Promise<ExtractionBatch> {
    const extractedAt = new Date(0).toISOString();
    const tree = parseJsTs({
      filePath: input.path,
      language: input.language,
      content: input.content
    });
    const moduleNode = moduleGraphNode(input);
    const extracted = extractDeclarationsAndReferences({
      input,
      root: tree.rootNode,
      moduleQualifiedName: moduleNode.qualified_name ?? input.path
    });
    const nodes = [moduleNode, ...extracted.declarations.map((declaration) => toNode(input, declaration))];
    const nodeByQualifiedName = new Map(nodes.map((node) => [node.qualified_name, node]));
    const unresolvedReferences = extracted.references.map((reference, index) =>
      toUnresolvedReference({
        input,
        reference,
        index,
        moduleNode,
        nodeByQualifiedName
      })
    );

    return {
      snapshot_id: input.snapshot_id,
      source_path: input.path,
      extractor_id: "tree-sitter-js-ts",
      language: input.language,
      file_identity: {
        path: input.path,
        language: input.language,
        content_hash: `content:${Buffer.byteLength(input.content, "utf8")}`,
        size_bytes: Buffer.byteLength(input.content, "utf8"),
        mtime_ms: 0,
        indexed_at: extractedAt
      },
      nodes,
      edges: [],
      unresolved_references: unresolvedReferences,
      diagnostics_hints: [],
      test_hints: [],
      extracted_at: extractedAt
    };
  }
}

function extractDeclarationsAndReferences(input: {
  input: ExtractionRequest;
  root: Parser.SyntaxNode;
  moduleQualifiedName: string;
}): { declarations: JsTsDeclaration[]; references: JsTsReference[] } {
  const declarations: JsTsDeclaration[] = [];
  const references: JsTsReference[] = [];

  function visit(node: Parser.SyntaxNode, qualifiedPrefix: readonly string[]): void {
    if (node.type === "import_statement") {
      references.push(...referencesFromImport(node));
    } else if (node.type === "export_statement") {
      references.push(...referencesFromExport(node));
    }

    const declarationNode = declarationWrapper(node);
    if (declarationNode !== null) {
      const declaration = declarationFromNode(declarationNode, qualifiedPrefix, input.moduleQualifiedName);
      if (declaration !== null) {
        declarations.push(declaration);
        if (declaration.kind === "class") {
          visitChildren(declarationNode, [...qualifiedPrefix, declaration.name]);
          return;
        }
      }
    } else if (node.type === "method_definition") {
      const declaration = declarationFromNode(node, qualifiedPrefix, input.moduleQualifiedName);
      if (declaration !== null) {
        declarations.push(declaration);
      }
    }

    visitChildren(node, qualifiedPrefix);
  }

  function visitChildren(node: Parser.SyntaxNode, qualifiedPrefix: readonly string[]): void {
    for (let index = 0; index < node.namedChildCount; index += 1) {
      const child = node.namedChild(index);
      if (child !== null) {
        visit(child, qualifiedPrefix);
      }
    }
  }

  visit(input.root, []);
  return { declarations, references };
}

function declarationWrapper(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
  if (node.type === "export_statement") {
    return firstNamedChildOfType(node, [
      "function_declaration",
      "class_declaration",
      "lexical_declaration",
      "variable_declaration",
      "type_alias_declaration"
    ]);
  }
  if (
    node.type === "function_declaration" ||
    node.type === "class_declaration" ||
    node.type === "lexical_declaration" ||
    node.type === "variable_declaration" ||
    node.type === "type_alias_declaration"
  ) {
    return node;
  }
  return null;
}

function declarationFromNode(
  node: Parser.SyntaxNode,
  qualifiedPrefix: readonly string[],
  moduleQualifiedName: string
): JsTsDeclaration | null {
  if (node.type === "function_declaration") {
    return namedDeclaration({ node, kind: "function", qualifiedPrefix, moduleQualifiedName });
  }
  if (node.type === "class_declaration") {
    return namedDeclaration({ node, kind: "class", qualifiedPrefix, moduleQualifiedName });
  }
  if (node.type === "method_definition") {
    return namedDeclaration({ node, kind: "method", qualifiedPrefix, moduleQualifiedName });
  }
  if (node.type === "type_alias_declaration") {
    return namedDeclaration({ node, kind: "type", qualifiedPrefix, moduleQualifiedName });
  }
  if (node.type === "lexical_declaration" || node.type === "variable_declaration") {
    const declarator = firstNamedChildOfType(node, ["variable_declarator"]);
    const nameNode = declarator?.childForFieldName("name") ?? firstNamedChildOfType(declarator, ["identifier"]);
    if (nameNode === null || nameNode === undefined) {
      return null;
    }
    return {
      kind: "constant",
      name: nameNode.text,
      qualifiedName: qualifiedName(moduleQualifiedName, qualifiedPrefix, nameNode.text),
      signature: firstLine(node.text),
      startLine: nameNode.startPosition.row + 1,
      startColumn: nameNode.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    };
  }
  return null;
}

function namedDeclaration(input: {
  node: Parser.SyntaxNode;
  kind: JsTsDeclaration["kind"];
  qualifiedPrefix: readonly string[];
  moduleQualifiedName: string;
}): JsTsDeclaration | null {
  const nameNode = input.node.childForFieldName("name") ?? firstNamedChildOfType(input.node, ["identifier", "type_identifier", "property_identifier"]);
  if (nameNode === null || nameNode === undefined) {
    return null;
  }
  return {
    kind: input.kind,
    name: nameNode.text,
    qualifiedName: qualifiedName(input.moduleQualifiedName, input.qualifiedPrefix, nameNode.text),
    signature: firstLine(input.node.text),
    startLine: nameNode.startPosition.row + 1,
    startColumn: nameNode.startPosition.column,
    endLine: input.node.endPosition.row + 1,
    endColumn: input.node.endPosition.column
  };
}

function referencesFromImport(node: Parser.SyntaxNode): JsTsReference[] {
  const names = uniqueSorted([...importedNames(node.text), ...moduleReferenceNames(node)]);
  return names.map((name, index) => referenceFromNode({
    node,
    name,
    kind: "js_ts_import",
    index,
    metadata: {
      provenance: "tree-sitter-js-ts-import",
      confidence: 0.65,
      capability_level: "partial_semantic",
      evidence_kinds: ["parser"],
      semantic_scope: "import_name_routing",
      module_specifier: moduleSpecifier(node)
    }
  }));
}

function referencesFromExport(node: Parser.SyntaxNode): JsTsReference[] {
  const specifier = moduleSpecifier(node);
  if (specifier === undefined) {
    return [];
  }
  const names = uniqueSorted([...importedNames(node.text), ...moduleReferenceNames(node)]);
  return names.map((name, index) => referenceFromNode({
    node,
    name,
    kind: "js_ts_export",
    index,
    metadata: {
      provenance: "tree-sitter-js-ts-export",
      confidence: 0.55,
      capability_level: "partial_semantic",
      evidence_kinds: ["parser"],
      semantic_scope: "export_name_routing",
      module_specifier: specifier
    }
  }));
}

function referenceFromNode(input: {
  node: Parser.SyntaxNode;
  name: string;
  kind: JsTsReference["kind"];
  index: number;
  metadata: Record<string, unknown>;
}): JsTsReference {
  return {
    name: input.name,
    kind: input.kind,
    startLine: input.node.startPosition.row + 1,
    startColumn: input.node.startPosition.column,
    endLine: input.node.endPosition.row + 1,
    endColumn: input.node.endPosition.column,
    metadata: {
      ...input.metadata,
      reference_index: input.index
    }
  };
}

function toNode(input: ExtractionRequest, declaration: JsTsDeclaration): GraphNodeWriteModel {
  return {
    id: nodeId(input.snapshot_id, input.path, declaration.kind, declaration.qualifiedName),
    kind: declaration.kind,
    name: declaration.name,
    qualified_name: declaration.qualifiedName,
    file_path: input.path,
    language: input.language,
    source_range: {
      start_line: declaration.startLine,
      start_column: declaration.startColumn,
      end_line: declaration.endLine,
      end_column: declaration.endColumn
    },
    signature: declaration.signature,
    metadata: {
      capability_level: "partial_semantic",
      evidence_kinds: ["parser"],
      parser: "tree-sitter-js-ts",
      semantic_scope: "declarations_imports_exports"
    }
  };
}

function toUnresolvedReference(input: {
  input: ExtractionRequest;
  reference: JsTsReference;
  index: number;
  moduleNode: GraphNodeWriteModel;
  nodeByQualifiedName: Map<string | undefined, GraphNodeWriteModel>;
}): UnresolvedReferenceWriteModel {
  const sourceNode = input.reference.sourceQualifiedName === undefined
    ? input.moduleNode
    : input.nodeByQualifiedName.get(input.reference.sourceQualifiedName) ?? input.moduleNode;
  return {
    id: `${input.input.snapshot_id}:${input.input.path}:js-ts-ref:${input.index}:${input.reference.kind}:${input.reference.name}`,
    source_node_id: sourceNode.id,
    source_file_path: input.input.path,
    reference_name: input.reference.name,
    reference_kind: input.reference.kind,
    source_range: {
      start_line: input.reference.startLine,
      start_column: input.reference.startColumn,
      end_line: input.reference.endLine,
      end_column: input.reference.endColumn
    },
    candidate_metadata: input.reference.metadata
  };
}

function moduleGraphNode(input: ExtractionRequest): GraphNodeWriteModel {
  return {
    id: nodeId(input.snapshot_id, input.path, "module", input.path),
    kind: "module",
    name: moduleName(input.path),
    qualified_name: moduleQualifiedName(input.path),
    file_path: input.path,
    language: input.language,
    source_range: fullFileRange(input.content),
    metadata: {
      capability_level: "partial_semantic",
      evidence_kinds: ["parser"],
      parser: "tree-sitter-js-ts",
      semantic_scope: "module_declarations_imports_exports"
    }
  };
}

function importedNames(text: string): string[] {
  const importMatch = /\bimport\s+(?:type\s+)?(.+?)\s+from\s+["'][^"']+["']/su.exec(text);
  const exportFromMatch = /\bexport\s+(.+?)\s+from\s+["'][^"']+["']/su.exec(text);
  const clause = importMatch?.[1] ?? exportFromMatch?.[1];
  if (clause === undefined) {
    return [];
  }
  const names: string[] = [];
  const trimmed = clause.trim();
  const namedMatch = /\{([^}]*)\}/su.exec(trimmed);
  if (namedMatch?.[1] !== undefined) {
    names.push(
      ...namedMatch[1]
        .split(",")
        .map((part) => (part.trim().split(/\s+as\s+/u)[0] ?? "").trim())
        .filter(Boolean)
    );
  }
  const defaultPart = trimmed.split("{", 1)[0]?.replace(/\*\s+as\s+/u, "").trim().replace(/,$/u, "");
  if (defaultPart !== undefined && /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(defaultPart)) {
    names.push(defaultPart);
  }
  return names;
}

function moduleReferenceNames(node: Parser.SyntaxNode): string[] {
  const specifier = moduleSpecifier(node);
  if (specifier === undefined) {
    return [];
  }
  const withoutExtension = specifier.replace(/\.[cm]?[jt]sx?$/u, "");
  const lastSegment = withoutExtension.split("/").filter(Boolean).pop();
  if (lastSegment === undefined || lastSegment === "." || lastSegment === "..") {
    return [];
  }
  return [toPascalCase(lastSegment), lastSegment].filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
}

function moduleSpecifier(node: Parser.SyntaxNode): string | undefined {
  const stringNode = firstDescendantOfType(node, "string_fragment") ?? firstNamedChildOfType(node, ["string"]);
  if (stringNode === null || stringNode === undefined) {
    return undefined;
  }
  return stringNode.text.replace(/^["']|["']$/gu, "");
}

function firstNamedChildOfType(node: Parser.SyntaxNode | null | undefined, types: readonly string[]): Parser.SyntaxNode | null {
  if (node === null || node === undefined) {
    return null;
  }
  for (let index = 0; index < node.namedChildCount; index += 1) {
    const child = node.namedChild(index);
    if (child !== null && types.includes(child.type)) {
      return child;
    }
  }
  return null;
}

function firstDescendantOfType(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
  if (node.type === type) {
    return node;
  }
  for (let index = 0; index < node.namedChildCount; index += 1) {
    const child = node.namedChild(index);
    if (child === null) {
      continue;
    }
    const found = firstDescendantOfType(child, type);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

function qualifiedName(moduleNameValue: string, prefix: readonly string[], name: string): string {
  return [moduleNameValue, ...prefix, name].filter(Boolean).join(".");
}

function moduleName(filePath: string): string {
  return filePath.slice(filePath.lastIndexOf("/") + 1).replace(/\.[^.]+$/u, "");
}

function moduleQualifiedName(filePath: string): string {
  return filePath.replace(/\.[^.]+$/u, "").replaceAll("/", ".");
}

function nodeId(snapshotId: string, filePath: string, kind: string, name: string): string {
  return `${snapshotId}:${filePath}:${kind}:${name}`;
}

function fullFileRange(content: string) {
  const lines = content.split("\n");
  const endLine = Math.max(1, lines.length);
  const lastLine = lines[lines.length - 1] ?? "";
  return {
    start_line: 1,
    start_column: 0,
    end_line: endLine,
    end_column: lastLine.length
  };
}

function firstLine(text: string): string | undefined {
  const line = text.split("\n", 1)[0]?.trim();
  return line && line.length > 0 ? line : undefined;
}

function toPascalCase(value: string): string {
  return value
    .split(/[^A-Za-z0-9_$]+/u)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("");
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}
