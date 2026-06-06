import type {
  ExtractionBatch,
  ExtractionRequest,
  GraphNodeWriteModel,
  UnresolvedReferenceWriteModel
} from "../../domain/models/index.js";
import type { ExtractorPort } from "../../ports/index.js";

type CppDeclaration = {
  kind: "class" | "function" | "method" | "include";
  name: string;
  qualifiedName: string;
  signature?: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

type CppReference = {
  sourceQualifiedName: string;
  referenceName: string;
  referenceKind: "cpp_include" | "cpp_local_call";
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  metadata: Record<string, unknown>;
};

export class CppDeclarationExtractorAdapter implements ExtractorPort {
  public readonly language: "c" | "cpp";

  constructor(input: { language?: "c" | "cpp" } = {}) {
    this.language = input.language ?? "cpp";
  }

  public supports(input: { language: string; path: string }): boolean {
    return input.language === this.language && /\.(?:c|cc|cpp|cxx|h|hh|hpp|hxx)$/u.test(input.path);
  }

  public async extract(input: ExtractionRequest): Promise<ExtractionBatch> {
    const extractedAt = new Date(0).toISOString();
    const extracted = extractCppDeclarations(input);
    const nodes = extracted.declarations.map((declaration) => toNode(input, declaration));
    const nodesByQualifiedName = new Map(nodes.map((node) => [node.qualified_name, node]));
    const unresolvedReferences = extracted.references.flatMap((reference, index) =>
      toUnresolvedReference({
        input,
        reference,
        index,
        nodesByQualifiedName
      })
    );

    return {
      snapshot_id: input.snapshot_id,
      source_path: input.path,
      extractor_id: "cpp-declaration-extractor",
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

function toNode(input: ExtractionRequest, declaration: CppDeclaration): GraphNodeWriteModel {
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
      capability_level: "resource_backed",
      evidence_kinds: ["heuristic"],
      extractor: "cpp-declaration-extractor",
      semantic_scope: "declarations_only"
    }
  };
}

function toUnresolvedReference(input: {
  input: ExtractionRequest;
  reference: CppReference;
  index: number;
  nodesByQualifiedName: Map<string | undefined, GraphNodeWriteModel>;
}): UnresolvedReferenceWriteModel[] {
  const sourceNode = input.nodesByQualifiedName.get(input.reference.sourceQualifiedName);
  if (sourceNode === undefined) {
    return [];
  }
  return [
    {
      id: `${sourceNode.id}:ref:${input.index}:${input.reference.referenceKind}:${input.reference.referenceName}`,
      source_node_id: sourceNode.id,
      source_file_path: input.input.path,
      reference_name: input.reference.referenceName,
      reference_kind: input.reference.referenceKind,
      source_range: {
        start_line: input.reference.startLine,
        start_column: input.reference.startColumn,
        end_line: input.reference.endLine,
        end_column: input.reference.endColumn
      },
      candidate_metadata: input.reference.metadata
    }
  ];
}

function extractCppDeclarations(input: ExtractionRequest): { declarations: CppDeclaration[]; references: CppReference[] } {
  const declarations: CppDeclaration[] = [];
  const references: CppReference[] = [];
  const lines = input.content.split(/\r?\n/u);
  let currentClass: string | undefined;
  let classBraceDepth = 0;
  let currentFunction:
    | {
        qualifiedName: string;
        name: string;
        braceDepth: number;
      }
    | undefined;

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (currentFunction !== undefined) {
      references.push(...localCallReferences(line, lineNumber, currentFunction.qualifiedName, currentFunction.name));
      currentFunction.braceDepth += braceDelta(line);
      if (currentFunction.braceDepth <= 0) {
        currentFunction = undefined;
      }
      continue;
    }

    const includeMatch = /^\s*#\s*include\s+[<"]([^>"]+)[>"]/u.exec(line);
    if (includeMatch) {
      const name = includeMatch[1] ?? "";
      const qualifiedName = `${input.path}:include:${name}`;
      declarations.push({
        kind: "include",
        name,
        qualifiedName,
        signature: trimmed,
        startLine: lineNumber,
        startColumn: line.indexOf("#"),
        endLine: lineNumber,
        endColumn: line.length
      });
      const includeStem = pathStem(name);
      if (includeStem !== undefined) {
        references.push({
          sourceQualifiedName: qualifiedName,
          referenceName: includeStem,
          referenceKind: "cpp_include",
          startLine: lineNumber,
          startColumn: line.indexOf(name),
          endLine: lineNumber,
          endColumn: line.indexOf(name) + name.length,
          metadata: {
            provenance: "cpp-include-heuristic",
            confidence: 0.35,
            capability_level: "resource_backed",
            evidence_kinds: ["heuristic"],
            semantic_scope: "include_name_routing",
            include_path: name
          }
        });
      }
      continue;
    }

    const classMatch = /^\s*(?:class|struct)\s+([A-Za-z_][A-Za-z0-9_]*)\b/u.exec(line);
    if (classMatch) {
      currentClass = classMatch[1] ?? "";
      classBraceDepth = braceDelta(line);
      declarations.push({
        kind: "class",
        name: currentClass,
        qualifiedName: currentClass,
        signature: trimmed,
        startLine: lineNumber,
        startColumn: line.search(/\b(?:class|struct)\b/u),
        endLine: lineNumber,
        endColumn: line.length
      });
      continue;
    }

    if (currentClass !== undefined) {
      classBraceDepth += braceDelta(line);
      const memberMatch = /^\s*(?:virtual\s+)?(?:static\s+)?(?:[\w:<>,~*&\s]+?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^;{}]*\)\s*(?:const\s*)?(?:=\s*0\s*)?;/u.exec(line);
      if (memberMatch) {
        const name = memberMatch[1] ?? "";
        declarations.push({
          kind: "method",
          name,
          qualifiedName: `${currentClass}.${name}`,
          signature: trimmed,
          startLine: lineNumber,
          startColumn: line.search(/[A-Za-z_~]/u),
          endLine: lineNumber,
          endColumn: line.length
        });
      }
      if (classBraceDepth <= 0 && trimmed.endsWith(";")) {
        currentClass = undefined;
        classBraceDepth = 0;
      }
      continue;
    }

    const qualifiedMethodMatch = /^\s*(?:[\w:<>,~*&\s]+?)\s+([A-Za-z_][A-Za-z0-9_]*)::([A-Za-z_~][A-Za-z0-9_]*)\s*\(/u.exec(line);
    if (qualifiedMethodMatch) {
      const receiver = qualifiedMethodMatch[1] ?? "";
      const name = qualifiedMethodMatch[2] ?? "";
      const qualifiedName = `${receiver}.${name}`;
      declarations.push({
        kind: "method",
        name,
        qualifiedName,
        signature: trimmed,
        startLine: lineNumber,
        startColumn: line.search(/[A-Za-z_~]/u),
        endLine: lineNumber,
        endColumn: line.length
      });
      currentFunction = functionScope({ line, qualifiedName, name });
      if (currentFunction !== undefined) {
        references.push(...localCallReferences(afterOpeningBrace(line), lineNumber, qualifiedName, name));
      }
      continue;
    }

    const functionMatch = /^\s*(?:[\w:<>,~*&\s]+?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^;{}]*\)\s*(?:const\s*)?[{;]/u.exec(line);
    if (functionMatch) {
      const name = functionMatch[1] ?? "";
      const qualifiedName = fileQualifiedName(input.path, name);
      declarations.push({
        kind: "function",
        name,
        qualifiedName,
        signature: trimmed,
        startLine: lineNumber,
        startColumn: line.search(/[A-Za-z_~]/u),
        endLine: lineNumber,
        endColumn: line.length
      });
      currentFunction = functionScope({ line, qualifiedName, name });
      if (currentFunction !== undefined) {
        references.push(...localCallReferences(afterOpeningBrace(line), lineNumber, qualifiedName, name));
      }
    }
  }

  return { declarations, references };
}

function braceDelta(line: string): number {
  let delta = 0;
  for (const character of line) {
    if (character === "{") {
      delta += 1;
    } else if (character === "}") {
      delta -= 1;
    }
  }
  return delta;
}

function fileQualifiedName(filePath: string, name: string): string {
  return `${filePath.replace(/\.(?:c|cc|cpp|cxx|h|hh|hpp|hxx)$/u, "").replaceAll("/", ".")}.${name}`;
}

function pathStem(filePath: string): string | undefined {
  const basename = filePath.split("/").pop()?.replace(/\.(?:c|cc|cpp|cxx|h|hh|hpp|hxx)$/u, "");
  return basename === undefined || basename.length === 0 ? undefined : basename;
}

function functionScope(input: {
  line: string;
  qualifiedName: string;
  name: string;
}): { qualifiedName: string; name: string; braceDepth: number } | undefined {
  if (!input.line.includes("{")) {
    return undefined;
  }
  const braceDepth = braceDelta(input.line);
  if (braceDepth <= 0) {
    return undefined;
  }
  return {
    qualifiedName: input.qualifiedName,
    name: input.name,
    braceDepth
  };
}

function afterOpeningBrace(line: string): string {
  const brace = line.indexOf("{");
  return brace < 0 ? "" : line.slice(brace + 1);
}

function localCallReferences(
  line: string,
  lineNumber: number,
  sourceQualifiedName: string,
  sourceName: string
): CppReference[] {
  const references: CppReference[] = [];
  const callPattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/gu;
  for (const match of line.matchAll(callPattern)) {
    const name = match[1] ?? "";
    if (name.length === 0 || name === sourceName || cppCallKeyword(name)) {
      continue;
    }
    const startColumn = match.index ?? 0;
    references.push({
      sourceQualifiedName,
      referenceName: name,
      referenceKind: "cpp_local_call",
      startLine: lineNumber,
      startColumn,
      endLine: lineNumber,
      endColumn: startColumn + name.length,
      metadata: {
        provenance: "cpp-local-call-heuristic",
        confidence: 0.4,
        capability_level: "resource_backed",
        evidence_kinds: ["heuristic"],
        semantic_scope: "same_file_call_name_routing"
      }
    });
  }
  return references;
}

function cppCallKeyword(name: string): boolean {
  return new Set([
    "if",
    "for",
    "while",
    "switch",
    "catch",
    "return",
    "sizeof",
    "static_cast",
    "dynamic_cast",
    "reinterpret_cast",
    "const_cast"
  ]).has(name);
}

function nodeId(snapshotId: string, filePath: string, kind: string, name: string): string {
  return `${snapshotId}:${filePath}:${kind}:${name}`;
}
