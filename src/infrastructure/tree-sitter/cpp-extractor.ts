import type {
  ExtractionBatch,
  ExtractionRequest,
  GraphNodeWriteModel
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
    const declarations = extractCppDeclarations(input);
    const nodes = declarations.map((declaration) => toNode(input, declaration));

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
      unresolved_references: [],
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

function extractCppDeclarations(input: ExtractionRequest): CppDeclaration[] {
  const declarations: CppDeclaration[] = [];
  const lines = input.content.split(/\r?\n/u);
  let currentClass: string | undefined;
  let classBraceDepth = 0;

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    const includeMatch = /^\s*#\s*include\s+[<"]([^>"]+)[>"]/u.exec(line);
    if (includeMatch) {
      const name = includeMatch[1] ?? "";
      declarations.push({
        kind: "include",
        name,
        qualifiedName: `${input.path}:include:${name}`,
        signature: trimmed,
        startLine: lineNumber,
        startColumn: line.indexOf("#"),
        endLine: lineNumber,
        endColumn: line.length
      });
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
      declarations.push({
        kind: "method",
        name,
        qualifiedName: `${receiver}.${name}`,
        signature: trimmed,
        startLine: lineNumber,
        startColumn: line.search(/[A-Za-z_~]/u),
        endLine: lineNumber,
        endColumn: line.length
      });
      continue;
    }

    const functionMatch = /^\s*(?:[\w:<>,~*&\s]+?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^;{}]*\)\s*(?:const\s*)?[{;]/u.exec(line);
    if (functionMatch) {
      const name = functionMatch[1] ?? "";
      declarations.push({
        kind: "function",
        name,
        qualifiedName: fileQualifiedName(input.path, name),
        signature: trimmed,
        startLine: lineNumber,
        startColumn: line.search(/[A-Za-z_~]/u),
        endLine: lineNumber,
        endColumn: line.length
      });
    }
  }

  return declarations;
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

function nodeId(snapshotId: string, filePath: string, kind: string, name: string): string {
  return `${snapshotId}:${filePath}:${kind}:${name}`;
}
