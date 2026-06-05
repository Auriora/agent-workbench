import type {
  ExtractionBatch,
  ExtractionRequest,
  GraphNodeWriteModel
} from "../../domain/models/index.js";
import type { ExtractorPort } from "../../ports/index.js";

type GoDeclaration = {
  kind: "package" | "function" | "type" | "method";
  name: string;
  qualifiedName: string;
  signature?: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export class GoDeclarationExtractorAdapter implements ExtractorPort {
  public readonly language = "go";

  public supports(input: { language: string; path: string }): boolean {
    return input.language === "go" && input.path.endsWith(".go");
  }

  public async extract(input: ExtractionRequest): Promise<ExtractionBatch> {
    const extractedAt = new Date(0).toISOString();
    const declarations = extractGoDeclarations(input.content);
    const nodes = declarations.map((declaration) => toNode(input, declaration));

    return {
      snapshot_id: input.snapshot_id,
      source_path: input.path,
      extractor_id: "go-declaration-extractor",
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
      unresolved_references: [],
      diagnostics_hints: [],
      test_hints: [],
      extracted_at: extractedAt
    };
  }
}

function toNode(input: ExtractionRequest, declaration: GoDeclaration): GraphNodeWriteModel {
  return {
    id: nodeId(input.snapshot_id, input.path, declaration.kind, declaration.qualifiedName),
    kind: declaration.kind,
    name: declaration.name,
    qualified_name: declaration.qualifiedName,
    file_path: input.path,
    language: "go",
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
      extractor: "go-declaration-extractor",
      semantic_scope: "declarations_only"
    }
  };
}

function extractGoDeclarations(content: string): GoDeclaration[] {
  const declarations: GoDeclaration[] = [];
  const lines = content.split(/\r?\n/u);
  const packageName = packageNameFromContent(lines);
  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const packageMatch = /^\s*package\s+([A-Za-z_][A-Za-z0-9_]*)\b/u.exec(line);
    if (packageMatch) {
      declarations.push({
        kind: "package",
        name: packageMatch[1] ?? "",
        qualifiedName: packageMatch[1] ?? "",
        signature: line.trim(),
        startLine: lineNumber,
        startColumn: line.indexOf("package"),
        endLine: lineNumber,
        endColumn: line.length
      });
      continue;
    }

    const methodMatch = /^\s*func\s*\(\s*(?:[A-Za-z_][A-Za-z0-9_]*\s+)?\*?([A-Za-z_][A-Za-z0-9_]*)\s*\)\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/u.exec(line);
    if (methodMatch) {
      const receiver = methodMatch[1] ?? "";
      const name = methodMatch[2] ?? "";
      declarations.push({
        kind: "method",
        name,
        qualifiedName: `${packageName}.${receiver}.${name}`,
        signature: line.trim(),
        startLine: lineNumber,
        startColumn: line.indexOf("func"),
        endLine: lineNumber,
        endColumn: line.length
      });
      continue;
    }

    const functionMatch = /^\s*func\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/u.exec(line);
    if (functionMatch) {
      const name = functionMatch[1] ?? "";
      declarations.push({
        kind: "function",
        name,
        qualifiedName: `${packageName}.${name}`,
        signature: line.trim(),
        startLine: lineNumber,
        startColumn: line.indexOf("func"),
        endLine: lineNumber,
        endColumn: line.length
      });
      continue;
    }

    const typeMatch = /^\s*type\s+([A-Za-z_][A-Za-z0-9_]*)\s+/u.exec(line);
    if (typeMatch) {
      const name = typeMatch[1] ?? "";
      declarations.push({
        kind: "type",
        name,
        qualifiedName: `${packageName}.${name}`,
        signature: line.trim(),
        startLine: lineNumber,
        startColumn: line.indexOf("type"),
        endLine: lineNumber,
        endColumn: line.length
      });
    }
  }
  return declarations;
}

function packageNameFromContent(lines: readonly string[]): string {
  for (const line of lines) {
    const match = /^\s*package\s+([A-Za-z_][A-Za-z0-9_]*)\b/u.exec(line);
    if (match?.[1]) {
      return match[1];
    }
  }
  return "unknown";
}

function nodeId(snapshotId: string, filePath: string, kind: string, name: string): string {
  return `${snapshotId}:${filePath}:${kind}:${name}`;
}
