import Parser from "tree-sitter";
import Go from "tree-sitter-go";
import type {
  ExtractionBatch,
  ExtractionRequest,
  GraphNodeWriteModel,
  SourceRange,
  UnresolvedReferenceWriteModel
} from "../../domain/models/index.js";
import type { ExtractorPort } from "../../ports/index.js";

type GoImport = {
  alias: string;
  path: string;
  node: Parser.SyntaxNode;
};

type GoDeclaration = {
  kind: "package" | "import" | "function" | "type" | "method";
  name: string;
  qualifiedName: string;
  signature?: string;
  node: Parser.SyntaxNode;
  metadata?: Record<string, unknown>;
};

type GoReference = {
  name: string;
  kind: "go_identifier" | "go_selector";
  node: Parser.SyntaxNode;
  sourceQualifiedName?: string;
  metadata: Record<string, unknown>;
};

const parser = new Parser();
parser.setLanguage(Go as Parser.Language);

export class GoDeclarationExtractorAdapter implements ExtractorPort {
  public readonly language = "go";

  public supports(input: { language: string; path: string }): boolean {
    return input.language === "go" && input.path.endsWith(".go");
  }

  public async extract(input: ExtractionRequest): Promise<ExtractionBatch> {
    const extractedAt = new Date(0).toISOString();
    const tree = parser.parse(input.content);
    const packageName = packageNameFromTree(tree.rootNode);
    const imports = extractImports(tree.rootNode);
    const declarations = extractDeclarations({ root: tree.rootNode, packageName, imports });
    const nodes = declarations.map((declaration) => toNode(input, declaration, packageName));
    const nodeByQualifiedName = new Map(nodes.map((node) => [node.qualified_name ?? node.name, node]));
    const references = extractReferences({
      root: tree.rootNode,
      packageName,
      imports,
      declarations
    });
    const moduleNode = nodes.find((node) => node.kind === "package") ?? nodes[0];
    const unresolvedReferences: UnresolvedReferenceWriteModel[] = references.map((reference, index) => {
      const sourceNode = reference.sourceQualifiedName
        ? nodeByQualifiedName.get(reference.sourceQualifiedName)
        : moduleNode;
      return {
        id: `${input.snapshot_id}:${input.path}:ref:${index}`,
        source_node_id: sourceNode?.id ?? `${input.snapshot_id}:${input.path}:package:${packageName}`,
        source_file_path: input.path,
        reference_name: reference.name,
        reference_kind: reference.kind,
        source_range: rangeForNode(reference.node),
        candidate_metadata: {
          ...reference.metadata,
          package_name: packageName,
          provenance: "tree-sitter-go"
        }
      };
    });

    return {
      snapshot_id: input.snapshot_id,
      source_path: input.path,
      extractor_id: "tree-sitter-go",
      language: "go",
      file_identity: {
        path: input.path,
        language: "go",
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

function toNode(input: ExtractionRequest, declaration: GoDeclaration, packageName: string): GraphNodeWriteModel {
  return {
    id: nodeId(input.snapshot_id, input.path, declaration.kind, declaration.qualifiedName),
    kind: declaration.kind,
    name: declaration.name,
    qualified_name: declaration.qualifiedName,
    file_path: input.path,
    language: "go",
    source_range: rangeForNode(declaration.node),
    signature: declaration.signature,
    metadata: {
      capability_level: "partial_semantic",
      evidence_kinds: ["parser"],
      parser: "tree-sitter-go",
      package_name: packageName,
      ...declaration.metadata
    }
  };
}

function extractDeclarations(input: {
  root: Parser.SyntaxNode;
  packageName: string;
  imports: readonly GoImport[];
}): GoDeclaration[] {
  const declarations: GoDeclaration[] = [];
  const packageNode = input.root.namedChildren.find((child) => child.type === "package_clause");
  if (packageNode !== undefined) {
    declarations.push({
      kind: "package",
      name: input.packageName,
      qualifiedName: input.packageName,
      signature: packageNode.text,
      node: packageNode
    });
  }
  for (const goImport of input.imports) {
    declarations.push({
      kind: "import",
      name: goImport.alias,
      qualifiedName: `${input.packageName}:import:${goImport.path}`,
      signature: goImport.node.text,
      node: goImport.node,
      metadata: {
        import_path: goImport.path,
        import_alias: goImport.alias
      }
    });
  }
  walk(input.root, (node) => {
    if (node.type === "type_spec") {
      const name = firstNamedChildText(node, "type_identifier");
      if (name !== undefined) {
        declarations.push({
          kind: "type",
          name,
          qualifiedName: `${input.packageName}.${name}`,
          signature: node.text.split(/\r?\n/u)[0]?.trim(),
          node
        });
      }
      return;
    }
    if (node.type === "function_declaration") {
      const name = firstNamedChildText(node, "identifier");
      if (name !== undefined) {
        declarations.push({
          kind: "function",
          name,
          qualifiedName: `${input.packageName}.${name}`,
          signature: node.text.split(/\r?\n/u)[0]?.trim(),
          node
        });
      }
      return;
    }
    if (node.type === "method_declaration") {
      const name = firstNamedChildText(node, "field_identifier");
      const receiver = receiverInfo(node);
      if (name !== undefined && receiver?.type !== undefined) {
        declarations.push({
          kind: "method",
          name,
          qualifiedName: `${input.packageName}.${receiver.type}.${name}`,
          signature: node.text.split(/\r?\n/u)[0]?.trim(),
          node,
          metadata: {
            receiver_name: receiver.name,
            receiver_type: receiver.type
          }
        });
      }
    }
  });
  return declarations;
}

function extractReferences(input: {
  root: Parser.SyntaxNode;
  packageName: string;
  imports: readonly GoImport[];
  declarations: readonly GoDeclaration[];
}): GoReference[] {
  const importsByAlias = new Map(input.imports.map((goImport) => [goImport.alias, goImport]));
  const declarationNodes = new Set(input.declarations.map((declaration) => declaration.node.id));
  const references: GoReference[] = [];
  walk(input.root, (node) => {
    if (node.type === "selector_expression") {
      const qualifier = node.namedChild(0);
      const field = node.namedChildren.find((child) => child.type === "field_identifier");
      if (qualifier === null || field === undefined) {
        return;
      }
      const imported = importsByAlias.get(qualifier.text);
      references.push({
        name: field.text,
        kind: "go_selector",
        node: field,
        sourceQualifiedName: enclosingDeclarationQualifiedName(node, input.declarations),
        metadata: {
          selector_qualifier: qualifier.text,
          import_path: imported?.path,
          import_alias: imported?.alias,
          confidence: imported === undefined ? 0.6 : 0.7,
          resolution: imported === undefined ? "receiver_or_package_local" : "import_selector"
        }
      });
      return;
    }
    if (node.type === "call_expression") {
      const callee = node.namedChild(0);
      if (callee?.type === "identifier" && !declarationNodes.has(callee.id)) {
        references.push({
          name: callee.text,
          kind: "go_identifier",
          node: callee,
          sourceQualifiedName: enclosingDeclarationQualifiedName(node, input.declarations),
          metadata: {
            confidence: 0.7,
            resolution: "package_identifier"
          }
        });
      }
    }
  });
  return references;
}

function extractImports(root: Parser.SyntaxNode): GoImport[] {
  const imports: GoImport[] = [];
  walk(root, (node) => {
    if (node.type !== "import_spec") {
      return;
    }
    const pathNode =
      firstDescendantOfType(node, "interpreted_string_literal_content") ??
      firstDescendantOfType(node, "raw_string_literal_content");
    if (pathNode === undefined) {
      return;
    }
    const aliasNode = node.namedChildren.find(
      (child) => child.type === "package_identifier" || child.type === "identifier"
    );
    const importPath = pathNode.text;
    imports.push({
      alias: aliasNode?.text ?? importPath.slice(importPath.lastIndexOf("/") + 1),
      path: importPath,
      node
    });
  });
  return imports;
}

function packageNameFromTree(root: Parser.SyntaxNode): string {
  const packageNode = root.namedChildren.find((child) => child.type === "package_clause");
  const identifier = packageNode?.namedChildren.find((child) => child.type === "package_identifier");
  return identifier?.text ?? "unknown";
}

function receiverInfo(node: Parser.SyntaxNode): { name?: string; type?: string } | undefined {
  const receiverList = node.namedChildren.find((child) => child.type === "parameter_list");
  const receiver = receiverList?.namedChildren.find((child) => child.type === "parameter_declaration");
  if (receiver === undefined) {
    return undefined;
  }
  const name = receiver.namedChildren.find((child) => child.type === "identifier")?.text;
  const typeNode = receiver.namedChildren.find(
    (child) => child.type === "type_identifier" || child.type === "pointer_type"
  );
  const receiverType = typeNode?.type === "pointer_type"
    ? firstDescendantOfType(typeNode, "type_identifier")?.text
    : typeNode?.text;
  return {
    name,
    type: receiverType
  };
}

function enclosingDeclarationQualifiedName(
  node: Parser.SyntaxNode,
  declarations: readonly GoDeclaration[]
): string | undefined {
  const candidates = declarations
    .filter((declaration) => ["function", "method"].includes(declaration.kind))
    .filter((declaration) => containsNode(declaration.node, node))
    .sort((left, right) => spanSize(left.node) - spanSize(right.node));
  return candidates[0]?.qualifiedName;
}

function containsNode(container: Parser.SyntaxNode, child: Parser.SyntaxNode): boolean {
  return container.startIndex <= child.startIndex && container.endIndex >= child.endIndex;
}

function spanSize(node: Parser.SyntaxNode): number {
  return node.endIndex - node.startIndex;
}

function firstNamedChildText(node: Parser.SyntaxNode, type: string): string | undefined {
  return node.namedChildren.find((child) => child.type === type)?.text;
}

function firstDescendantOfType(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | undefined {
  if (node.type === type) {
    return node;
  }
  for (const child of node.namedChildren) {
    const match = firstDescendantOfType(child, type);
    if (match !== undefined) {
      return match;
    }
  }
  return undefined;
}

function walk(node: Parser.SyntaxNode, visit: (node: Parser.SyntaxNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) {
    walk(child, visit);
  }
}

function rangeForNode(node: Parser.SyntaxNode): SourceRange {
  return {
    start_line: node.startPosition.row + 1,
    start_column: node.startPosition.column,
    end_line: node.endPosition.row + 1,
    end_column: node.endPosition.column
  };
}

function nodeId(snapshotId: string, filePath: string, kind: string, name: string): string {
  return `${snapshotId}:${filePath}:${kind}:${name}`;
}
